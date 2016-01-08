// 传入 window.performance.timing
var performance_test = function (timing) {

    var redirect = timing.redirectEnd - timing.redirectStart;

    var dns = timing.domainLookupEnd - timing.domainLookupStart;

    var tcp = timing.connectEnd - timing.connectStart;

    var request = timing.responseStart - timing.requestStart;

    var response = timing.responseEnd - timing.responseStart;

    var processing = timing.domComplete - timing.domLoading;

    var onLoad = timing.loadEventEnd - timing.loadEventStart;

    //focus
    var loadPage = timing.loadEventEnd - timing.navigationStart;

    var domReady = timing.domComplete - timing.responseEnd;

    // DNS 缓存时间
    var app_cache = timing.domainLookupStart - timing.fetchStart;

    var download = request + response;

    var ttfb = timing.responseStart - timing.navigationStart;

   /* // detail
    console.log('redirect: %s', toSecond(redirect));
    console.log('app cache: %s', toSecond(app_cache));
    console.log('dns: %s', toSecond(dns));
    console.log('tcp: %s', toSecond(tcp));
    console.log('request: %s', toSecond(request));
    console.log('response: %s', toSecond(response));
    console.log('processing: %s', toSecond(processing));
    console.log('onLoad: %s', toSecond(onLoad));
    console.log('ttfb: %s', toSecond(ttfb));

    // sum up
    console.log('网络时间: %s', toSecond(dns));
    console.log('下载时间: %s', toSecond(download));
    console.log('DomReady: %s', toSecond(domReady));

    // totally
    console.log('页面加载完成时间: %s', toSecond(loadPage));

    console.log({
        redirect: toSecond(redirect),
        app_cache: toSecond(app_cache),
        dns: toSecond(dns),
        tcp: toSecond(tcp),
        request: toSecond(request),
        response: toSecond(response),
        processing: toSecond(processing),
        onLoad: toSecond(onLoad),
        ttfb: toSecond(ttfb),
        sum_up_network: toSecond(dns),
        sum_up_download: toSecond(download),
        sum_up_DomReady: toSecond(domReady),
        totally: toSecond(loadPage)
    });*/

    return {
        redirect: toSecond(redirect),
        app_cache: toSecond(app_cache),
        dns: toSecond(dns),
        tcp: toSecond(tcp),
        request: toSecond(request),
        response: toSecond(response),
        processing: toSecond(processing),
        onLoad: toSecond(onLoad),
        ttfb: toSecond(ttfb),
        sum_up_network: toSecond(dns),
        sum_up_download: toSecond(download),
        sum_up_DomReady: toSecond(domReady),
        totally: toSecond(loadPage)
    };

};

var toSecond = function (ms) {
    return (+ms / 1000).toFixed(2);
};

module.exports = performance_test;