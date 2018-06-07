let colors = ['red', 'yellow', 'purple'];
let prios = ['p1', 'p2', 'p3', 'p4', 'ack'];

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
        xmlHttp.open( "GET", url, false );
        xmlHttp.send( null );
        resp = xmlHttp.responseText;
    }

    return JSON.parse(resp);
}

function fetchData() {
    let xymonData;
    let bullets = {};
    let lowestPos = {};
    let hostExists = {};
    xymonData = getJSON('https://people.phys.ethz.ch/~daduke/xymon2json.json') ;
    xymonData.forEach(function(entry) {
        let host = entry.hostname.trim();
        let test = entry.testname.trim();
        let color = entry.color.trim();
        let prioString = entry.XMH_CLASS.match(/_P(\d)_/);
        let prio, ackmsg;
        if (prioString) {
            prio = 'p' + prioString[1].trim();
        } else {
            prio = 'p4';
        }
        if (entry.ackmsg) {   //TODO acklist vs ackmsg??
            ackmsg = entry.ackmsg;
            prio = 'ack';
        } else {
            ackmsg = 'empty';
        }
        if (host && test && color && prio) {
            if (!bullets[color]) bullets[color] = {};
            if (!bullets[color][prio]) bullets[color][prio] = {};
            if (!bullets[color][prio][host]) bullets[color][prio][host] = {};
            bullets[color][prio][host][test] = ackmsg;
            lowestPos[host] = {};
            lowestPos[host]['x'] = 10;
            lowestPos[host]['y'] = 10;
        }
    });
    console.log(bullets);
    console.log(lowestPos);

    let x = 0;
    let y = 0;
    colors.forEach(function(color) {
        prios.forEach(function(prio) {
            let pos = x + 10*y;     //our 'severity position' in the prio/color matrix
            if (bullets[color] && bullets[color][prio]) {
                for (let host in bullets[color][prio]) {
                    for (let test in bullets[color][prio][host]) {
                        let ackmsg = bullets[color][prio][host][test];
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
                        if (hostExists[host]) {   //just add another test
                                $('[data-host='+host+']').append(" \
                                    <span class='test' data-test='"+test+"' data-ackmsg='"+ackmsg+"' >"+test+"</span>\
                                    <img src='img/checkmark.png' alt='ack' class='ack' /> ");
                        } else {                  //we need a host entry first
                            $("#" + selector).append("<div class='msg' data-host='"+host+"' >\
                                <span class='info'>"+host+": </span><span class='test' data-test='"+test+"' data-ackmsg='"+ackmsg+"' >"+test+"</span>\
                                <img src='img/checkmark.png' alt='ack' class='ack' />\
                            </div>");
                            $("#" + selector).removeClass("inv");

                            hostExists[host] = 1;
                        }
                    } //TODO ack noch richtig darstellen
                }
            }
            x++;
        });
        x = 0;
        y++;
    });
}

$(document).ready(function(){
    let dialogForm, dialogPopup, form;

    dialogForm = $( "#dialog-form" ).dialog({
      autoOpen: false,
      height: 400,
      width: 350,
      modal: true,
      buttons: {
        "Acknowledge test": ackTest,
        Cancel: function() {
          dialog.dialog( "close" );
        }
      },
      close: function() {
        form[ 0 ].reset();
        allFields.removeClass( "ui-state-error" );
      },
      open: function() {
          let options = $( "#dialog-form" ).dialog( "option" );
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
          $("#ack-popup").html(ackmsg);
      }
    });

    fetchData();


    $("span.info").click(function(){
        $(this).innerHTML = $(this).parent().data("host")+' / ';
        let link = createLink($(this).parent().data("host"), 'info');
        window.open(link,"_self")
    });
    $("span.test").click(function(){
        let link = createLink($(this).parent().data("host"), $(this).data("test"));
        window.open(link,"_self")
    });
    $("img.ack").click(function(){
        if (!$(this).parent().parent().attr("class").match(/\back\b/)) {
            dialogForm.dialog("option", "host", $(this).parent().data("host"));
            dialogForm.dialog("option", "test", $(this).parent().data("test"));
            dialogForm.dialog("open");
        }
    });
    $("img.ack").click(function(){
        if ($(this).parent().parent().attr("class").match(/\back\b/)) {
            dialogPopup.dialog("option", "ackmsg", $(this).parent().data("ackmsg"));
            dialogPopup.dialog("open");
        }
    });
});

function ackTest() {
}

