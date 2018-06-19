/* xymondash - get a concise view of a crowded xymon instance
   (c) 2018 ISG D-PHYS, ETH Zurich
       Claude Becker    - backend code
       Sven Mäder       - Visual FX and Javascript logic
       Christian Herzog - Javascript logic

*/

let availableColors = ['red', 'yellow', 'purple', 'blue', 'green'];
let activeColors = ['red', 'yellow'];
let availablePrios = ['prio1', 'prio2', 'prio3', 'prio4', 'ack'];
let activePrios = ['prio1', 'prio2'];
let activeBgPrios = ['prio1', 'prio2'];

if (Cookies.get('xymondashsettings')) {
    [activeColors, activePrios, activeBgPrios] = Cookies.getJSON('xymondashsettings');
}

let dialogForm, dialogPopup, backgroundColor;
let paused = false;

$(document).ready(function(){
    $(document).tooltip({                         //initialize tooltips
        items: "[tooltip]",
        content: function() {
            if ($(this).is('span')
                || $(this).parent().children("span.test").prop("class").match(/\backed\b/)) {
                let msg = $(this).attr('tooltip').replace(/\\n/g, 'LBRK').replace(/\\[p|t]/g, '  ')
                    .replace(/(&(red|green|yellow|clear) )/g, '<span style="color: $2;">&#x25cf; </span>')
                    .replace(/[-=]{10,}/g, '----------');
                let lines = msg.split(/LBRK/);
                let res = lines.slice(0, 18).join('<br />');
                if (lines.length > 18) {
                    res += '<br />...';
                }
                return res;
            }
        },
        open: function(event, ui) {
            paused = true;
        },
        close: function(event, ui) {
            paused = false;
        },
        position: { my: "center top", at: "left bottom", collision: "flipfit" },
        classes: {
            "ui-tooltip": "ui-widget-shadow"
        }
    });

    dialogForm = $("#dialog-form").dialog({       //acknowledge form template
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

    dialogPopup = $("#dialog-popup").dialog({     //acknowledge msg popup
        autoOpen: false,
        modal: false,
        close: function() {
        },
        open: function() {
            let options = $( "#dialog-popup" ).dialog( "option" );
            let ackmsg = options.ackmsg;
            $("#ackmsg-popup").html(ackmsg);
        }
    });

    $("#period").selectmenu();

    $("#reload").click(function(){
        triggerUpdate();
    });

    // Open settings panel
    $("#open-settings").click(function (e) {
        populateSettings();           //fill settings panel dynamically
        e.preventDefault();
        $("#settings-panel").toggleClass("active");
        $('#container-buttons').hide();
        $("#close-settings").show();
    });

    // Close settings panel
    $("#close-settings").click(function (e) {
        e.preventDefault();
        $("#settings-panel").toggleClass("active");
        $(this).hide();
        $("#container-buttons").show();
        triggerUpdate();
        writeCookie();
    });

    $("input#message").click(function (e) {
        $(this).val('');
    });

    setInterval(function() {    //reload every 30s
        if (!paused) { triggerUpdate() };
    }, 30000);

    populateSettings();
    triggerUpdate();              //fetch data and fill matrix
});

function triggerUpdate() {
    let params = '';
    activeColors = [];
    activePrios = [];
    activeBgPrios = [];

    $('input[name="colors"]:checked').each(function(index) {
        params += (index == 0) ? '?color=' : ',';
        params += $(this).attr('id');
        activeColors.push($(this).attr('id'));
    });
    $('input[name="priorities"]:checked').each(function(index) {
        activePrios.push($(this).attr('id'));
    });
    $('input[name="background"]:checked').each(function(index) {
        activeBgPrios.push($(this).attr('id'));
    });
    backgroundColor = "green";
    getJSON('https://xymon.phys.ethz.ch/xymonjs/cgi/xymon2json'+params, processData);
}

function processData() {
    let entries = {};
    let lowestPos = {};
    let hostExists = {};

    let xymonData = this.response;
    xymonData.forEach(function(entry) {     //loop thru data and process it into entries object
        let host = entry.hostname.trim();
        let test = entry.testname.trim();
        let color = entry.color.trim();
        let msg = entry.msg.trim();
        let prioVal = (entry.critscore)?entry.critscore.trim():4;
        let ackmsg, acktime, cookie;
        let prio = 'prio' + prioVal;
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
            if (!entries[color]) entries[color] = {};
            if (!entries[color][prio]) entries[color][prio] = {};
            if (!entries[color][prio][host]) entries[color][prio][host] = {};
            if (!entries[color][prio][host][test]) entries[color][prio][host][test] = {};
            entries[color][prio][host][test]['ackmsg'] = ackmsg;
            entries[color][prio][host][test]['acktime'] = acktime;
            entries[color][prio][host][test]['cookie'] = cookie;
            entries[color][prio][host][test]['msg'] = msg;
            lowestPos[host] = {};
            lowestPos[host]['x'] = 10;
            lowestPos[host]['y'] = 10;
        }
    });

    availableColors.forEach(function(color) {        //clean up old stuff
        availablePrios.forEach(function(prio) {
            var sel = color + '_' + prio;
            $('#' + sel).html('<div class="ptag">'+prio+'</div>');
            $('#' + sel).addClass("inv");
        });
    });

    let x = 0;
    let y = 0;
    activeColors.forEach(function(color) {        //build up matrix and display entries data
        activePrios.forEach(function(prio) {
            let pos = x + 10*y;             //our 'severity position' in the prio/color matrix
            if (entries[color] && entries[color][prio]) {
                let hosts = entries[color][prio];
                let keys = Object.keys(hosts);
                keys.sort();
                for (i = 0; i < keys.length; i++) {
                    host = keys[i];
                    for (let test in entries[color][prio][host]) {
                        let ackmsg = entries[color][prio][host][test]['ackmsg'];
                        let acktime = entries[color][prio][host][test]['acktime'];
                        let msg = entries[color][prio][host][test]['msg'];
                        let cookie = entries[color][prio][host][test]['cookie'];
                        let lowestX = lowestPos[host]['x'];
                        let lowestY = lowestPos[host]['y'];
                        let lowestPosHost = lowestX + 10*lowestY;
                        let selector;
                        if (lowestPosHost < pos) {    //if we have a higher prio/color entry already
                            selector = activeColors[lowestY] + '_' + activePrios[lowestX];
                        } else {
                            selector = color + '_' + prio;
                            lowestPos[host]['x'] = x;
                            lowestPos[host]['y'] = y;
                        }
                        var ackClass = (ackmsg != 'empty')?' acked':'';
                        ackmsg = ackmsg.replace(/\\n/ig, "<br />");
                        let d = new Date(acktime*1000);
                        acktime = "acked until " + dateFormat(d, "HH:MM, mmmm d (dddd)");
                        ackmsg = '<b>'+ackmsg+'</b><br /><br />'+acktime;
                        if (!hostExists[host]) {   //we need a host entry first
                            $("#" + selector).append("<div class='msg' data-host='"+host+"' >\
                                <span class='info'>"+host+": </span><div class='tests'> \
                                <span class='test"+ackClass+"' data-test='"+test+"' data-ackmsg='"
                                +escape(ackmsg)+"' data-cookie='"+cookie
                                +"'>"+test+"</span>\
                                <i class='ack"+ackClass+" fas fa-check' id='"+cookie+"'></i></div>\
                            </div>");
                            $("#" + selector).removeClass("inv");
                            $('[data-cookie='+cookie+']').attr('tooltip', msg);
                            if (ackmsg != 'empty') {
                                $('i#'+cookie).attr('tooltip', ackmsg);
                            }

                            hostExists[host] = 1;
                        } else {                  //just add another test
                            $('[data-host='+host+']').append(" \
                                <div class='tests'><span class='test"+ackClass+"' data-test='"+test
                                +"' data-ackmsg='"+escape(ackmsg)+"' data-cookie='"
                                +cookie+"' >"+test+"</span>\
                                <i class='ack"+ackClass+" fas fa-check' id='"+cookie+"'></i>\
                            </div> ");
                            $('[data-cookie='+cookie+']').attr('tooltip', msg);
                            if (ackmsg != 'empty') {
                                $('i#'+cookie).attr('tooltip', ackmsg);
                            }
                        }
                    }
                }
                background(color, prio);    //TODO bg color only for displayed prios or all?
            }
            x++;
        });
        x = 0;
        y++;
    });
    setBackgroundColor();

    availablePrios.concat('ack').forEach(function(prio) {
        let allEmpty = true;
        availableColors.forEach(function(color) {
            let selector = color + '_' + prio;
            if (!$("#" + selector).hasClass("inv")) {
                allEmpty = false;
            }
        });
        if (allEmpty) {
            activeColors.concat('l').forEach(function(color) {
                let selector = color + '_' + prio;
                $("#" + selector).addClass("remove");
            });
        }
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
    $("i.ack").click(function(){
        if (!$(this).parent().children("span.test").prop("class").match(/\backed\b/)) {
            dialogForm.dialog("option", "cookie", $(this).parent().children("span.test").data("cookie"));
            dialogForm.dialog("option", "hostname", $(this).parent().parent().data("host"));
            dialogForm.dialog("option", "testname", $(this).parent().children("span.test").data("test"));
            dialogForm.dialog("open");
        } else {
            dialogPopup.dialog("option", "ackmsg", unescape($(this).parent().children("span.test").data("ackmsg")));
            dialogPopup.dialog("open");
        }
    });
}

function createLink(host, test) {
    return 'https://xymon.phys.ethz.ch/xymon-cgi/svcstatus.sh?HOST='
        +host+'&SERVICE='+test;
}

function getJSON(url, callback) {
    let xhr = new XMLHttpRequest();

    xhr.callback = callback;
    xhr.arguments = Array.prototype.slice.call(arguments, 2);
    xhr.onload  = function() { this.callback.apply(this, this.arguments); };
    xhr.onerror = function() { console.error(this.statusText); };
    xhr.open("GET", url, true);
    xhr.responseType = "json";
    xhr.withCredentials = true;
    xhr.setRequestHeader('cache-control', 'no-cache, must-revalidate, post-check=0, pre-check=0');
    xhr.setRequestHeader('cache-control', 'max-age=0');
    xhr.setRequestHeader('expires', '0');
    xhr.setRequestHeader('expires', 'Tue, 01 Jan 1980 1:00:00 GMT');
    xhr.setRequestHeader('pragma', 'no-cache');

    xhr.send(null);
}

function ackTest() {
    var fields = ['number', 'delay', 'period', 'message'];
    var vals = {};
    fields.forEach(function(field) {
        vals[field] = $("#"+field).val().trim();
    });
    if (vals['period'] == 'hours') {
        vals['delay'] *= 60;
    } else if (vals['period'] == 'days') {
        vals['delay'] *= 60*24;
    }

    $.ajax({
        type: "POST",
        url: "https://xymon.phys.ethz.ch/xymonjs/cgi/xymon-ack ",
        data: { number: vals['number'], min: vals['delay'], msg: vals['message'] },
        success: function( data ) {
            dialogForm.dialog( "close" );
            triggerUpdate();
        },
    });
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

function background(color, prio) {
    if (activeBgPrios.includes(prio)) {
       if (backgroundColor == 'red') {
           return;
       } else if (backgroundColor == 'purple') {
           if (color == 'red') {
               backgroundColor = color;
           }
       } else if (backgroundColor == 'yellow') {
           if ((color == 'red') || (color == 'purple')) {
               backgroundColor = color;
           }
       } else if (backgroundColor == 'blue') {
           if ((color == 'red') || (color == 'purple') || (color == 'yellow')) {
               backgroundColor = color;
           }
       } else {
               backgroundColor = color;
       }
    }
}

function setBackgroundColor() {
    $('#bg').css('height', $(document).height() + 'px')
    if (!$('#bg').hasClass('bg-' + backgroundColor)) {
        $('#bg').fadeOut(250, function() {
            $('#bg').removeClass();
            $('#bg').addClass('bg-' + backgroundColor);
            $('#bg').fadeIn(250);
        });
    }
    changeFavicon("img/" + backgroundColor + ".ico");
}

function createSettings(availableElements, activeElements, name) {
    settings = '<div class="setting-group"><h2 class="text-white">' + name + '</h2><table>';
    availableElements.forEach(function(element) {
        let checked = (activeElements.includes(element))?'checked="checked" ':'';
        settings += '<tr><td class="text-white">' + element + '</td>';
        settings += '<td class="text-white"><input type="checkbox" name="' + name + '" id="'
            + element + '" ' + checked + '/></td></tr>';
    });
    settings += '</table></div>';
    return settings;
}

function populateSettings() {
    $('#settings-container').html('');
    $('#settings-container').append(createSettings(availableColors, activeColors, 'colors'));
    $('#settings-container').append(createSettings(availablePrios, activePrios, 'priorities'));
    $('#settings-container').append(createSettings(availablePrios, activeBgPrios, 'background'));
}

function writeCookie() {
    Cookies.set('xymondashsettings', [activeColors, activePrios, activeBgPrios]);
}

const changeFavicon = link => {
    let $favicon = document.querySelector('link[rel="icon"]')
    // If a <link rel="icon"> element already exists,
    // change its href to the given link.
    if ($favicon !== null) {
        $favicon.href = link
        // Otherwise, create a new element and append it to <head>.
    } else {
        $favicon = document.createElement("link")
        $favicon.rel = "icon"
        $favicon.href = link
        document.head.appendChild($favicon)
    }
}
