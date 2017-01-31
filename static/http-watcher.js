document.addEventListener('DOMContentLoaded', function () {
    ready();
}, false);


function ready() {
    var host = window.location.hostname;
    var ws = new WebSocket("ws://" + host + ":" + __port + "/");
    ws.onopen = function () {
        ws.send(JSON.stringify({
            "cmd": "filelist",
            "data": __filelist
        }));
    };

    ws.onmessage = function (e) {
        var data = JSON.parse(e.data);
        if (data.cmd == "reload") {
            location.reload();
        } else if (data.cmd == "reload-css") {
            var ondlnks = document.querySelectorAll('link[data]');
            ondlnks.forEach(function (lnk) {

                console.log(lnk.path,data.data);

                if(lnk.path == data.data){
                    lnk.parentNode.removeChild(lnk);
                }
            });



            var lnk = document.createElement('link');
            lnk.href = data.data;
            lnk.rel = 'stylesheet';
            lnk.type = 'text/css';
            lnk.path = data.data;
            lnk.setAttribute("data",data.data);
            (document.head || document.documentElement).appendChild(lnk);
        }
    };
}