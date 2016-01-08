
var app = require('app');
var ipc = require('electron').ipcMain;
var BrowserWindow = require('browser-window');
var testing = require('./testing.json');
var fs = require('fs');
var marked = require('marked');
var Promise = require('bluebird');

var performance = require('./scripts/performance');

app.on('window-all-closed', function () {
    if (process.platform != 'darwin') {
        app.quit();
    }
});

var mainWindow = null;

var processes = testing.processes;
var sessionCookies = testing.cookies;
var testing_url = testing.url;

var networkMap = {
    '2G': {
        latency: 300,
        downloadThroughput: 32000,
        uploadThroughput: 32000
    },
    '3G': {
        latency: 100,
        downloadThroughput: 128000,
        uploadThroughput: 128000
    }
};

var argv = process.argv.slice(2);
var emulation = false;

// network emulate
var network = argv.indexOf('-network');
if (network != -1) {
    var type = argv[network + 1];
    emulation = networkMap[type];
}

var index = 0;
var reqs = [];

app.on('ready', function () {

    mainWindow = new BrowserWindow({
        "width": 800,
        "height": 600,
        "center": true
    });

    var webContents = mainWindow.webContents;
    var session = webContents.session;
    Promise.promisifyAll(session.cookies);

    session.clearStorageData({
        storages: ['cookies', 'localstorage']
    }, function () {

        var settings = [];
        for (var key in sessionCookies) {
            settings.push(session.cookies.setAsync({
                url: testing_url,
                name: key,
                value: sessionCookies[key]
            }));
        }

        Promise.all(settings).then(function () {
            if (emulation) {
                session.enableNetworkEmulation(emulation);
            }

            webContents.on('did-finish-load', function () {
                var test_process = processes[index];

                var code = [
                    'var ipc = require("electron").ipcRenderer;',
                    'var data = { name: "' + test_process.name + '" , url: "' + test_process.url + '", timing: window.performance.timing };',
                    'var timing_str = JSON.stringify(data);',
                    'ipc.send("test.performance", timing_str);'
                ].join('');

                var delay = emulation? 10000 : 20000;
                setTimeout(function () {
                    webContents.executeJavaScript(code);
                    next(++index);
                }, delay);
            });

            session.webRequest.onBeforeSendHeaders(function (details, callback) {
                var test_process = processes[index];

                if (!test_process || !test_process.name) {
                    return;
                }
                var key = test_process.name + '-' + details.id;
                reqs.push({
                    id: details.id,
                    resourceType: details.resourceType,
                    key: key,
                    started_at: details.timestamp,
                    url: details.url
                });

                details.requestHeaders['User-Agent'] =  testing.userAgent || "Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4";
                callback({cancel: false, requestHeaders: details.requestHeaders});
            });

            session.webRequest.onCompleted(function (details) {

                var test_process = processes[index];

                if (!test_process || !test_process.name) {
                    return;
                }

                reqs.forEach(function (req) {
                    if (req.id === details.id) {
                        req.ended_at = details.timestamp;
                        req.duration = toSecond(req.ended_at - req.started_at);
                    }
                });
            });

            session.webRequest.onErrorOccurred(function (details) {
                //@TODO record request error related information
                console.log('-----------error!--------------');
                console.log(details.url);
                console.log(details.error);
                console.log('-----------error!--------------');
            });

            var next = function (index) {
                setTimeout(function () {
                    session.clearCache(function () {
                        var test_process = processes[index];
                        if (!test_process) return;
                        mainWindow.loadURL(test_process.url);
                    });
                }, 1000);
            };

            next(0);
        });
    });
});

var toMD = function (result) {
    //var grids = '| [<%page_name%>](<%page_url%>) | <%redirect%> | <%app_cache%> | <%dns%> | <%tcp%> | <%request%> | <%response%> | <%processing%> | <%onLoad%> | <%ttfb%> | <%sum_up_network%> | <%sum_up_download%> | <%sum_up_DomReady%> | <%totally%> |';
    var grids = '| [<%page_name%>](<%page_url%>) | <%ttfb%> | <%dns%> | <%totally%> | [<%slowest%>](<%slowest_request%>) | [<%js_load%>](<%js_url%>) |';
    for (var key in result) {
        var reg_str = '<%' + key + '%>';
        var reg = new RegExp(reg_str, 'gi');
        grids = grids.replace(reg, result[key]);
    }
    return grids;
};

var toSecond = function (ms) {
    return (+ms / 1000).toFixed(2);
};

var classify = function (arr) {
    var items = {};
    arr.forEach(function (v) {
        var tokens = v.key.split('-');
        var key = tokens[0];
        if (!items[key]) {
            items[key] = [];
        }
        items[key].push(v);
    });
    return items;
};

var caculate = function (results, items) {
    results.forEach(function (result) {
        var reqs = items[result.page_name];
        var js = {
            time: -1,
            url: ''
        };
        var request = {
            time: -1,
            url: ''
        };
        reqs.forEach(function (req) {
            if (!req.duration) return;
            if (req.url.indexOf('.js') != -1 && req.duration > js.time) {
                js.time = req.duration;
                js.url = req.url;
            }
            if (req.duration > request.time) {
                request.time = req.duration;
                request.url = req.url;
            }
        });
        if (js.time > -1) {
            result.js_load = js.time;
            result.js_url = js.url;
        }
        if (request.time > -1) {
            result.slowest = request.time;
            result.slowest_request = request.url;
        }
    });
};

var result = [];

ipc.on('test.performance', function (event, arg) {

    var data = JSON.parse(arg);
    console.log('-------%s--------', data.name);
    var obj = performance(data.timing);
    obj.page_name = data.name;
    obj.page_url = data.url;
    result.push(obj);

    var filename = Date.parse(new Date()) + (emulation? '-' + type : '') + '.html';

    if (index === processes.length) {

        // parse reqs
        var items = classify(reqs);

        // caculate
        caculate(result, items);

        var result_data = [
            '| 页面名称 | 首字节加载时间(ttfb) | dns 时间 | 页面下载时间 | 接口时间(最慢) | js 加载时间 |', '\n',
            '| ------- | ------------------ | -------- | ---------- | ------------- | ---------- |', '\n'
        ].join('');

        //var result_data = [
        //    '| 页面名称 | redirect | app cache | dns | tcp | request | response | processing | onLoad | ttfb | 网络时间 | 下载时间 | DomReady | 页面加载完成时间 |', '\n',
        //    '| ------- | -------- | --------- | --- | --- | --------| ---------| ---------- | ------ | ---- | ------- | ------- | -------- | -------------- |', '\n'
        //].join('');

        result.forEach(function (v, i) {
            result_data += toMD(v) + '\n';
        });

        marked.setOptions({
            render: new marked.Renderer(),
            gfm: true,
            tables: true,
            breaks: false,
            pedantic: false,
            sanitize: true,
            smartLists: true,
            smartypants: false
        });

        fs.readFile('./styles/github-markdown.css', function (err, data) {
            if (err) {
                console.log(err);
                return;
            }

            var style = ['<style type="text/css">',
                            data.toString(),
                        '</style>'].join('');

            result_data = [
                '<html><head><meta charset="UTF-8"/>',style,'</head><body>',
                    '<div class="markdown-body">', marked(result_data), '</div>',
                '</body></html>'
            ].join('');

            fs.writeFile('./result/' + filename, result_data, function () {
                console.log('completed!');
                app.quit();
            });
        });
    }
});
