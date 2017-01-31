#! /usr/bin/env node


var chokidar = require('chokidar');
var http = require("http");
var ws = require("ws");
var fs = require("fs");
var path = require("path");
var mimes = require('mime-types');
var cheerio = require("cheerio");

var WS_PORT = 2020;
var HTTP_PORT = 8080;
var PATH_EX = process.cwd();

var FIX_URL = {
    "/_/http-watcher.js": "http-watcher.js"
};


var wsServer = ws.createServer({
    perMessageDeflate: false,
    port: WS_PORT
}, function (ws) {
    var watcher;

    ws.on("message", function (message) {
        message = JSON.parse(message);
        if (message.cmd == "filelist") {
            watcher = chokidar.watch(message.data, {
                ignored: /(^|[\/\\])\../,
                persistent: true
            });

            watcher.on('change', function (p) {
                if (path.extname(p) == ".css" || path.extname(p) == ".sass") {
                    p = path.relative(PATH_EX, p);
                    reloadCss("/" + p);
                } else {
                    reload();
                }
            });
            watcher.on("unlint", function (path) {
                reload();
            });

            function reload() {
                ws.send(JSON.stringify({
                    "cmd": "reload"
                }));
            }

            function reloadCss(p) {
                ws.send(JSON.stringify({
                    "cmd": "reload-css",
                    "data": p
                }));
            }
        }
    });

    ws.on("close", function () {
        if (watcher) {
            watcher.close();
            watcher = undefined;
        }
    });

    ws.on("error", function () {
        if (watcher) {
            watcher.close();
            watcher = undefined;
        }
    });

});


var httpServer = http.createServer(function (request, response) {
    var url = path.join(PATH_EX, request.url);
    var fix = FIX_URL[request.url];
    if (fix) {
        url = path.join(__dirname, "static", fix);
    }

    fs.stat(url, function (error, stat) {
        if (!error && stat.isFile()) {
            fs.readFile(url, 'utf-8', function (e, fileData) {
                if (!e) {
                    var ext = path.extname(url);
                    var mime = mimes.lookup(ext);
                    var root = path.join(url + "/../");

                    if (ext == ".html" || ext == ".htm") {
                        var $ = cheerio.load(fileData);

                        var $sass = sassHandler($, root);
                        var $scripts = scriptHandler($, root);
                        var files = $sass.concat($scripts);
                        files.push(url);

                        var $body = $("body");
                        var _data = "";
                        _data = _data + "var __filelist =" + JSON.stringify(files) + ";";
                        _data = _data + "var __port = " + WS_PORT + ";";

                        $body
                            .append("<script>" + _data + "</script>");
                        $body.append("<script src='/_/http-watcher.js'></script>");

                        fileData = $.html();
                    }
                    _202(response, mime, fileData);

                } else {
                    _404(response);
                }
            });
        } else {
            _404(response);
        }
    });
});

httpServer.listen(HTTP_PORT);


function sassHandler($, root) {
    var files = [];
    var $css = $("link");
    $css.each(function (i, val) {
        var href = root + val.attribs.href;
        if (href && fs.existsSync(href) && path.extname(href) == ".css") {
            files.push(href);
        }
    });
    return files;
}


function scriptHandler($, root) {
    var files = [];
    var $scripts = $("script");
    $scripts.each(function (i, val) {
        var src = root + val.attribs.src;
        if (src && path.extname(src) == ".js") {
            if (fs.existsSync(src)) {
                files.push(src);
            }
        }
    });

    return files;
}


function _404(response) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain");
    response.write("404");
    response.end();
}

function _202(response, mime, data) {
    response.statusCode = 200;
    response.setHeader("Content-Type", mime);
    response.write(data);
    response.end();
}

