#!/usr/bin/env node
var prerender = require('./lib');

var server = prerender({
chromeFlags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage', '--remote-debugging-port=9222', '--hide-scrollbars'],
pageLoadTimeout: 3000,
pageDoneCheckInterval: 100,
browserTryRestartPeriod: 360000000,
});

server.use(prerender.sendPrerenderHeader());
server.use(prerender.browserForceRestart());
// server.use(prerender.blockResources());
server.use(prerender.addMetaTags());
server.use(prerender.removeScriptTags());
server.use(prerender.httpHeaders());

server.start();
