function createLink(host, test) {
    return 'https://xymon.phys.ethz.ch/xymon-cgi/svcstatus.sh?HOST='
        +host+'&SERVICE='+test;
}

function getJSON(url) {
    var resp ;
    var xmlHttp ;

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
    var xymonData;
    xymonData = getJSON('https://people.phys.ethz.ch/~daduke/xymon2json.json') ;
    xymonData.forEach(function(entry) {
        var host = entry.hostname.trim();
        var test = entry.testname.trim();
        var color = entry.color.trim();
        var prios = entry.XMH_CLASS.match(/_P(\d)_/);
        var prio;
        if (prios) {
            prio = 'p' + prios[1].trim();
        } else {
            prio = 'p4';
        }
        if (entry.ackmsg) {
            prio = 'ack';
        }
        if (host && test && color && prio) {
            var selector = color + '_' + prio;
            $("#" + selector).append("<div class='msg' data-host='"+host+"' data-test='"+test+"' data-ackmsg='"+entry.ackmsg+"' >\
                <span class='info'>"+host+" / </span><span class='test'>"+test+"</span>\
                <img src='img/checkmark.png' alt='ack' class='ack' />\
            </div>");
            $("#" + selector).removeClass("inv");
        }
    });
}

$(document).ready(function(){
    var dialogForm, dialogPopup, form;

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
          var options = $( "#dialog-form" ).dialog( "option" );
      }
    });

    dialogPopup = $( "#dialog-popup" ).dialog({
      autoOpen: false,
      modal: false,
      close: function() {
      },
      open: function() {
          var options = $( "#dialog-popup" ).dialog( "option" );
          var ackmsg = options.ackmsg;
          ackmsg = ackmsg.replace(/\\n/ig, "<br />");
          $("#ack-popup").html(ackmsg);
      }
    });

    fetchData();


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
    $("span.info").click(function(){
        $(this).innerHTML = $(this).parent().data("host")+' / ';
        var link = createLink($(this).parent().data("host"), 'info');
        window.open(link,"_self")
    });
    $("span.test").click(function(){
        var link = createLink($(this).parent().data("host"), $(this).parent().data("test"));
        window.open(link,"_self")
    });
});

function ackTest() {
}

