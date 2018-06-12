let colors = ['red', 'yellow', 'purple', 'blue'];
let prios = ['p1', 'p2', 'p3', 'p4', 'ack'];

let dialogForm, dialogPopup;

function createLink(host, test) {
    return 'https://xymon.phys.ethz.ch/xymon-cgi/svcstatus.sh?HOST='
        +host+'&SERVICE='+test;
}

function getJSON(url) {
    let resp ;
    let xmlHttp ;

    resp  = '' ;
    xmlHttp = new XMLHttpRequest();

    if(xmlHttp != null) {
        xmlHttp.withCredentials = true;
        xmlHttp.open( "GET", url, false );
        xmlHttp.setRequestHeader('cache-control', 'no-cache, must-revalidate, post-check=0, pre-check=0');
        xmlHttp.setRequestHeader('cache-control', 'max-age=0');
        xmlHttp.setRequestHeader('expires', '0');
        xmlHttp.setRequestHeader('expires', 'Tue, 01 Jan 1980 1:00:00 GMT');
        xmlHttp.setRequestHeader('pragma', 'no-cache');

        xmlHttp.send( null );
        resp = xmlHttp.responseText;
    }

    return JSON.parse(resp);
}

function fetchData(purge) {
    let xymonData;
    let bullets = {};
    let lowestPos = {};
    let hostExists = {};
    let params = '';
    if ($.urlParam()) {
        params = '?'+$.urlParam();
    }
    xymonData = getJSON('https://xymon.phys.ethz.ch/xymonjs/cgi/xymon2json'+params);
    xymonData.forEach(function(entry) {
        let host = entry.hostname.trim();
        let test = entry.testname.trim();
        let color = entry.color.trim();
        let prioString = entry.XMH_CLASS.match(/_P(\d)_/);
        let prio, ackmsg, acktime, cookie;
        if (prioString) {
            prio = 'p' + prioString[1].trim();
        } else {
            prio = 'p4';
        }
        if (entry.ackmsg) {
            ackmsg = entry.ackmsg;
            acktime = entry.acktime;
            prio = 'ack';
        } else {
            ackmsg = 'empty';
            acktime = '';
        }
        if (entry.cookie) {
            cookie = entry.cookie;
        } else {
            cookie = 'empty';
        }
        if (host && test && color && prio) {
            if (!bullets[color]) bullets[color] = {};
            if (!bullets[color][prio]) bullets[color][prio] = {};
            if (!bullets[color][prio][host]) bullets[color][prio][host] = {};
            if (!bullets[color][prio][host][test]) bullets[color][prio][host][test] = {};
            bullets[color][prio][host][test]['ackmsg'] = ackmsg;
            bullets[color][prio][host][test]['acktime'] = acktime;
            bullets[color][prio][host][test]['cookie'] = cookie;
            lowestPos[host] = {};
            lowestPos[host]['x'] = 10;
            lowestPos[host]['y'] = 10;
        }
    });

    let x = 0;
    let y = 0;
    colors.forEach(function(color) {
        prios.forEach(function(prio) {
            if (purge) {    //clean up table if we trigger an internal data reload
                var sel = color + '_' + prio;
                $('#' + sel).html('');
                $('#' + sel).addClass("inv");
            }
            let pos = x + 10*y;     //our 'severity position' in the prio/color matrix
            if (bullets[color] && bullets[color][prio]) {
                let hosts = bullets[color][prio];
                let keys = Object.keys(hosts);
                keys.sort();
                for (i = 0; i < keys.length; i++) {
                    host = keys[i];
                    for (let test in bullets[color][prio][host]) {
                        let ackmsg = bullets[color][prio][host][test]['ackmsg'];
                        let acktime = bullets[color][prio][host][test]['acktime'];
                        let cookie = bullets[color][prio][host][test]['cookie'];
                        let lowestX = lowestPos[host]['x'];
                        let lowestY = lowestPos[host]['y'];
                        let lowestPosHost = lowestX + 10*lowestY;
                        let selector;
                        if (lowestPosHost < pos) {    //if we have a higher prio/color entry already
                            selector = colors[lowestY] + '_' + prios[lowestX];
                        } else {
                            selector = color + '_' + prio;
                            lowestPos[host]['x'] = x;
                            lowestPos[host]['y'] = y;
                        }
                        var ackClass = (ackmsg != 'empty')?' acked':'';
                        if (hostExists[host]) {   //just add another test
                            $('[data-host='+host+']').append(" \
                                <div class='tests'><span class='test"+ackClass+"' data-test='"+test+"' data-ackmsg='"+ackmsg+"' data-acktime='"+acktime+"' data-cookie='"+cookie+"'>"+test+"</span>\
                                <img src='img/checkmark.png' alt='ack' class='ack' /></div> ");
                        } else {                  //we need a host entry first
                            $("#" + selector).append("<div class='msg' data-host='"+host+"' >\
                                <span class='info'>"+host+": </span><div class='tests'><span class='test"+ackClass+"' data-test='"+test+"' data-ackmsg='"+ackmsg+"' data-acktime='"+acktime+"' data-cookie='"+cookie+"'>"+test+"</span>\
                                <img src='img/checkmark.png' alt='ack' class='ack' /></div>\
                            </div>");
                            $("#" + selector).removeClass("inv");

                            hostExists[host] = 1;
                        }
                    }
                }
            }
            x++;
        });
        x = 0;
        y++;
    });

    $("span.info").click(function(){
        $(this).innerHTML = $(this).parent().parent().data("host")+' / ';
        let link = createLink($(this).parent().data("host"), 'info');
        window.open(link,"_self")
    });
    $("span.test").click(function(){
        let link = createLink($(this).parent().parent().data("host"), $(this).data("test"));
        window.open(link,"_self")
    });
    $("div.tests").mouseenter(function(){
        $(this).children("img.ack").css("visibility", "visible");
    });
    $("div.tests").mouseleave(function(){
        $(this).children("img.ack").css("visibility", "hidden");
    });
    $("img.ack").click(function(){
        if (!$(this).parent().children("span.test").attr("class").match(/\backed\b/)) {
            dialogForm.dialog("option", "cookie", $(this).parent().children("span.test").data("cookie"));
            dialogForm.dialog("option", "hostname", $(this).parent().parent().data("host"));
            dialogForm.dialog("option", "testname", $(this).parent().children("span.test").data("test"));
            dialogForm.dialog("open");
        } else {
            dialogPopup.dialog("option", "ackmsg", $(this).parent().children("span.test").data("ackmsg"));
            dialogPopup.dialog("option", "acktime", $(this).parent().children("span.test").data("acktime"));
            dialogPopup.dialog("open");
        }
    });
}

$(document).ready(function(){
    dialogForm = $( "#dialog-form" ).dialog({
      autoOpen: false,
      height: 300,
      width: 350,
      modal: true,
      buttons: {
        "Acknowledge test": ackTest,
        Cancel: function() {
          dialogForm.dialog( "close" );
        }
      },
      close: function() {
//        allFields.removeClass( "ui-state-error" );
      },
      open: function() {
          let options = $( "#dialog-form" ).dialog( "option" );
          let cookie = options.cookie;
          $("#number").val(cookie);
          let hostname = options.hostname;
          $("#hostname").val(hostname);
          let testname = options.testname;
          $("#testname").val(testname);
      }
    });

    dialogPopup = $( "#dialog-popup" ).dialog({
      autoOpen: false,
      modal: false,
      close: function() {
      },
      open: function() {
          let options = $( "#dialog-popup" ).dialog( "option" );
          let ackmsg = options.ackmsg;
          ackmsg = ackmsg.replace(/\\n/ig, "<br />");
          let d = new Date(options.acktime*1000);
          let acktime = "acked until " + dateFormat(d, "HH:MM, mmmm d (dddd)");
          $("#ackmsg-popup").html(ackmsg);
          $("#acktime-popup").html(acktime);
      }
    });

    fetchData(0);

    setInterval(function() {    //reload every 30s
        fetchData(1);
    }, 30000);
});

function ackTest() {
    var fields = ['number', 'delay', 'message'];
    var vals = {};
    fields.forEach(function(field) {
        vals[field] = $("#"+field).val().trim();
    });

    $.ajax({
        type: "POST",
        url: "https://xymon.phys.ethz.ch/xymonjs/cgi/xymon-ack ",
        data: { number: vals['number'], min: vals['delay'], msg: vals['message'] },
        success: function( data ) {
//            alert(data);
            dialogForm.dialog( "close" );
            fetchData(1);
        },
    });
}

$.urlParam = function(){
    let result = '';
    if (result = window.location.href.match(/\?(.*)$/)) {
        return result[1];
    } else {
        return null;
    }
}

function keys(obj) {
    var keys = [];
    for(var key in obj) {
        if(obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }

    return keys;
}
