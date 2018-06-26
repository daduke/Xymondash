/* xymondash - get a concise view of a crowded xymon instance
   (c) 2018 ISG D-PHYS, ETH Zurich
       Claude Becker    - backend code
       Sven Mäder       - Visual FX and JS logic
       Christian Herzog - JS logic
*/

const XYMONURL     = 'https://xymon.phys.ethz.ch/xymon-cgi/svcstatus.sh';
const XYMONACKURL  = 'https://xymon.phys.ethz.ch/xymondash/cgi/xymon-ack';
const XYMONJSONURL = 'https://xymon.phys.ethz.ch/xymondash/cgi/xymon2json';

let availableColors = ['red', 'purple', 'yellow', 'blue', 'green'];
let availablePrios = ['prio1', 'prio2', 'prio3', 'other', 'ack'];
let config = {};
if (!config['testState']) config['testState'] = {};

if (Cookies.get('xymondashsettings')) {
    config = Cookies.getJSON('xymondashsettings');
    if (!config['testState']) config['testState'] = {};
} else {
    config['activeColors'] = ['red', 'purple', 'yellow'];
    config['activePrios'] = ['prio1', 'prio2', 'prio3'];
    config['activeBgPrios'] = ['prio1', 'prio2'];
    config['hideCols'] = false;
    config['notifications'] = false;
    config['3D'] = false;
}

let dialogForm, backgroundColor;
let paused = false;

$(document).ready(function() {
    $(document).tooltip({                         //initialize tooltips
        items: "[tooltip]",
        content: function() {
            if ($(this).is('span') ||
                ($(this).is('i') && $(this).parent().children("span.test").prop("class").match(/\backed\b/))) {
                //this cleans up the message text in order to make it readable in the tooltip
                let msg = $(this).attr('tooltip').replace(/\\n/g, 'LBRK').replace(/\\[p|t]/g, '  ')
                    .replace(/(&(red|green|yellow|clear) )/g, '<span style="color: $2;">&#x25cf; </span>')
                    .replace(/[-=]{10,}/g, '----------').replace(/<table summary.+?<\/table>/g, '');
                let lines = msg.split(/LBRK/);
                let res = lines.slice(0, 18).join('<br />');
                if (lines.length > 18) {
                    res += '<br />...';
                }
                return res;
            } else if ($(this).is('button')) {
                return $(this).attr('tooltip');
            }
        },
        open: function(event, ui) {     //no refresh while tooltip is open
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
            paused = true;      //no refresh while ack dialog is open
        },
        close: function() {
            paused = false;
        }
    });

    $("#period").selectmenu();
    $("#page").css("font-family", config['font']);

    $("#reload").click(function(){
        triggerUpdate();
    });

    //open settings panel
    $("#open-settings").click(function (e) {
        populateSettings();           //fill settings panel dynamically
        $("#settings-panel").toggleClass("active");
        $('#container-buttons').hide();
        $("#close-settings").show();
        paused = true;      //no refresh while settings panel is open
    });

    //close settings panel
    $("#close-settings").click(function (e) {
        $("#settings-panel").toggleClass("active");
        $(this).hide();
        $("#container-buttons").show();

        config['activeColors'] = [];
        config['activePrios'] = [];
        config['activeBgPrios'] = [];
        config['hideCols'] = false;
        config['notifications'] = false;
        config['3D'] = false;

        //update config settings
        $('input[name="colors"]:checked').each(function(index) {
            config['activeColors'].push($(this).attr('id'));
        });
        $('input[name="priorities"]:checked').each(function(index) {
            config['activePrios'].push($(this).attr('id'));
        });
        $('input[name="background"]:checked').each(function(index) {
            config['activeBgPrios'].push($(this).attr('id'));
        });
        $('input[name="hideCols"]:checked').each(function(index) {
            config['hideCols'] = true;
        });
        $('input[name="notifications"]:checked').each(function(index) {
            config['notifications'] = true;
        });
        $('input[name="3D"]:checked').each(function(index) {
            config['3D'] = true;
        });
        let font = $('select#font').val();
        config['font'] = font;
        $("#page").css("font-family", font);

        Cookies.set('xymondashsettings', config, { expires: 365 });
        paused = false;
        triggerUpdate();
    });

    //mark all currently visible tests as 'seen'
    $("#markSeen").click(function (e) {
        $('span.test').each(function(index) {
            config['testState'][$(this).data('cookie')] = 'seen';
        });
        triggerUpdate();
    });

    $('button#markSeen').attr('tooltip', 'mark all as seen');
    $('button#reload').attr('tooltip', 'reload data');
    $('button#open-settings').attr('tooltip', 'open settings');

    if (config['notifications']) {
        if (!window.Notification) {
            alert("Sorry, notifications are not supported in this browser!");
        } else {
            if (Notification.permission === 'default') {
                Notification.requestPermission(function(p) {
                    if (p === 'denied')
                        alert('You have denied Xymondash notifications.');
                    else {
                        notify = new Notification('xymondash', {
                            body: 'You have accepted Xymondash notifications.'
                        });
                    }
                });
            }
        }
    }

    $("input#message").click(function (e) {
        $(this).val('');
    });

    setInterval(function() {    //reload every 30s
        if (!paused) { triggerUpdate() };
    }, 30000);

    populateSettings();
    triggerUpdate();
});

function triggerUpdate() {              //fetch data and fill matrix
    let params = '';

    if ($.urlParam()) {                 //manual URL color params override color checkboxes
        $.urlParam().split('&').forEach(function(param) {
            let [key, val] = param.split('=');
            if (key == 'color') {
                config['activeColors'] = val.split(',');
            }
        });
        params = '?'+$.urlParam();
    } else {
        let i = 0;
        config['activeColors'].forEach(function(color) {
            params += (i++ == 0)?'?color=':',';
            params += color;
        });
    }

    backgroundColor = 'green';
    getJSON(XYMONJSONURL + params, processData);
}

function processData() {    //callback when JSON data is ready
    let entries = {};
    let lowestPos = {};

    let xymonData = this.response;
    xymonData.forEach(function(entry) {     //loop thru data and process all tests into entries object
        let ackmsg, acktime, cookie;
        let host = entry.hostname.trim();
        let test = entry.testname.trim();
        let color = entry.color.trim();
        let msg = entry.msg.trim();
        let prio = 'other';
        if (entry.critscore) {
            prio = 'prio' + entry.critscore;
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

    availableColors.forEach(function(color) {        //clean out DOM
        availablePrios.forEach(function(prio) {
            let sel = color + '_' + prio;
            $('#' + sel).html('<div class="ptag">'+prio+'</div>');
            $('#' + sel).addClass("inv");
            $("#" + sel).removeClass("remove");
        });
    });
    availablePrios.forEach(function(prio) {
        let sel = 'l_' + prio;
        $("#" + sel).removeClass("remove");
    });

    let x = 0;
    let y = 0;
    let numEntries = 0;
    let allSeen = {};
    let numTests = {};
    config['activeColors'].forEach(function(color) {        //build up matrix and display entries data
        config['activePrios'].forEach(function(prio) {
            let pos = x + 10*y;             //this test's 'severity position' in the prio/color matrix
            if (entries[color] && entries[color][prio]) {
                let hosts = entries[color][prio];
                let keys = Object.keys(hosts);
                keys.sort();    //sort by hostname
                for (i = 0; i < keys.length; i++) {         //host loop
                    host = keys[i];
                    if (!allSeen[host]) { allSeen[host] = true; }
                    if (!numTests[host]) { numTests[host] = 0; }
                    for (let test in entries[color][prio][host]) {
                        let ackmsg = entries[color][prio][host][test]['ackmsg'];
                        let acktime = entries[color][prio][host][test]['acktime'];
                        let msg = entries[color][prio][host][test]['msg'];
                        let cookie = entries[color][prio][host][test]['cookie'];
                        let lowestX = lowestPos[host]['x'];
                        let lowestY = lowestPos[host]['y'];
                        let lowestPosHost = lowestX + 10*lowestY;
                        let selector;
                        if (config['testState'][cookie] != 'seen') {
                            allSeen[host] = false;
                        }
                        if (lowestPosHost < pos) {    //if we have a higher prio/color entry already
                            selector = config['activeColors'][lowestY] + '_' + config['activePrios'][lowestX];
                        } else {
                            selector = color + '_' + prio;
                            lowestPos[host]['x'] = x;
                            lowestPos[host]['y'] = y;
                        }
                        let ackClass = (ackmsg != 'empty')?' acked':'';
                        ackmsg = ackmsg.replace(/\\n/ig, "<br />");
                        let d = new Date(acktime*1000);
                        acktime = "acked until " + dateFormat(d, "HH:MM, mmmm d (dddd)");
                        ackmsg = '<b>'+ackmsg+'</b><br /><br />'+acktime;
                        if (numTests[host] == 0) {   //new host -> we need a host entry first
                            $("#" + selector).append(
                                "<div class='msg' data-host='"+host+"'>"+
                                    "<span class='info'>"+host+": </span>"+
                                    "<div class='tests'>"+
                                        "<span class='test"+ackClass+"' data-test='"+test+
                                            "' data-ackmsg='" +escape(ackmsg)+"' data-cookie='"+cookie+"'>"+test+
                                        "</span>"+
                                        "<i class='ack"+ackClass+" fas fa-check' id='"+cookie+"'></i>"+
                                    "</div>"+
                                "</div>");
                            $("#" + selector).removeClass("inv");
                            $('[data-cookie='+cookie+']').attr('tooltip', msg);
                            if (ackmsg != 'empty') {
                                $('i#'+cookie).attr('tooltip', ackmsg);
                            }
                        } else {                  //host already exists -> just add another test
                            $('[data-host='+host+']').append(
                                "<div class='tests'>"+
                                    "<span class='test"+ackClass+"' data-test='"+test+
                                        "' data-ackmsg='"+escape(ackmsg)+"' data-cookie='"+cookie+"' >"+test+
                                    "</span>"+
                                    "<i class='ack"+ackClass+" fas fa-check' id='"+cookie+"'></i>"+
                                "</div>");
                            $('[data-cookie='+cookie+']').attr('tooltip', msg);
                            if (ackmsg != 'empty') {
                                $('i#'+cookie).attr('tooltip', ackmsg);
                            }
                        }
                        if (numEntries++ > 200) {
                            showFlash('Your settings yield too many tests! Please choose fewer colors or prios.');
                            throw new Error("too many results");
                        }
                        numTests[host]++;
                    }                   //test loop
                }                       //host loop
                background(color, prio);
            }                           //valid entry
            x++;
        });                             //prio loop
        x = 0;
        y++;
    });                                 //color loop
    setBackgroundColor();

    //loop over hosts and determine allSeen and ackAll state
    $('[data-host]').each(function(index) {
        let host = $(this).data('host');

        if (allSeen[host]) {
            $('[data-host='+host+']').addClass("seen");
        }
        if (numTests[host] > 1) {
            $('[data-host='+host+']').append(
                "<div class='tests'>"+
                    "<i class='ack ackall fas fa-check-double' id='all-"+host+"'></i>"+
                "</div>");
        }
    });

    //delete gone tests from testState
    $.each(config['testState'], function(cookie, value) {
        if ($('[data-cookie="'+cookie+'"]').length == 0) {
            delete config['testState'][cookie];
        }
    });
    Cookies.set('xymondashsettings', config, { expires: 365 }); //write config so that test states are persistent

    //let's find all empty columns and hide them
    let numCols = availablePrios.length;
    availablePrios.forEach(function(prio) {
        let allEmpty = true;
        availableColors.forEach(function(color) {
            let selector = color + '_' + prio;
            if (!$("#" + selector).hasClass("inv")) {
                allEmpty = false;
            }
        });
        if ($.inArray(prio, config['activePrios']) == -1 || config['hideCols']) {
            if (allEmpty) {
                config['activeColors'].concat('l').forEach(function(color) {
                    let selector = color + '_' + prio;
                    $("#" + selector).addClass("remove");
                });
                numCols--;
            }
        }
    });


    let width = (100/numCols) - 2;
    const mq = window.matchMedia("(max-width: 720px)");
    if (mq.matches) {   //mobile view
        $('.col-sm').css('width', '100%');
        $('.col-sm').css('max-width', '100%');
    } else {            //fullscreen view
        $('.col-sm').css('width', width + '%');
        $('.col-sm').css('max-width', '31%');
    }

    if (config['3D']) {
        $(".msg").css('box-shadow', '2px 2px 4px rgba(0,0,0,0.9), inset -2px -2px 4px rgba(50,50,50,0.8), inset 2px 2px 4px rgba(250,250,250,0.4)');
    }

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
        dialogForm.dialog("option", "hostname", $(this).parent().parent().data("host"));
        if ($(this).hasClass('ackall')) {   //ack all tests of this host
            let cookies = [];
            $(this).parent().parent().find("span.test").each(function(e) {
                let cookie = $(this).data("cookie");
                cookies.push(cookie);
            });
            dialogForm.dialog("option", "cookie", cookies.join(','));
        } else {                            //single test
            dialogForm.dialog("option", "cookie", $(this).parent().children("span.test").data("cookie"));
        }
        dialogForm.dialog("open");
    });
}

function createLink(host, test) {
    return XYMONURL + '?HOST=' +host+'&SERVICE='+test;
}

function getJSON(url, callback) {
    let xhr = new XMLHttpRequest();

    xhr.callback = callback;
    xhr.arguments = Array.prototype.slice.call(arguments, 2);
    xhr.onload  = function() { this.callback.apply(this, this.arguments); };
    xhr.onerror = function() { showFlash('could not load JSON data!'); };
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
    let fields = ['number', 'delay', 'period', 'message'];
    let vals = {};
    fields.forEach(function(field) {
        vals[field] = $("#"+field).val().trim();
    });
    if (vals['period'] == 'hours') {
        vals['delay'] *= 60;
    } else if (vals['period'] == 'days') {
        vals['delay'] *= 60*24;
    }

    let i = 0;
    let numbers = vals['number'].split(',');
    numbers.forEach(function(number) {
        $.ajax({
            type: "POST",
            url: XYMONACKURL,
            data: { number: number, min: vals['delay'], msg: vals['message'] },
            success: function(data) {
                if (++i == numbers.length) {
                    dialogForm.dialog( "close" );
                    triggerUpdate();
                }
            },
        });
    });
}

function keys(obj) {
    let keys = [];
    for(let key in obj) {
        if(obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }

    return keys;
}

function background(color, prio) {
    if (config['activeBgPrios'].includes(prio)) {
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
    $('#bg').css('height', $(document).height() + 'px');
    if (!$('#bg').hasClass('bg-' + backgroundColor)) {  //only update if color changed
        $('#bg').fadeOut(250, function() {
            $('#bg').removeClass();
            $('#bg').addClass('bg-' + backgroundColor);
            $('#bg').fadeIn(250);
        });
        let icon = "img/" + backgroundColor + ".ico";
        changeFavicon(icon);
        if (config['notifications']) {
            showNotification('Xymon overall status changed to ' + backgroundColor, icon);
        }
    }
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
    $('#settings-container-pick').html('');
    $('#settings-container-pick').append(createSettings(availableColors, config['activeColors'], 'colors'));
    $('#settings-container-pick').append(createSettings(availablePrios, config['activePrios'], 'priorities'));
    $('#settings-container-pick').append(createSettings(availablePrios, config['activeBgPrios'], 'background'));
    let activeFont = config['font'];
    let fontSel = '<select name="FONT" id="font">';
    $("body").css("font-family").replace(/\"/g, '').split(',').forEach(function(font) {
        font = font.trim();
        let sel = (font == activeFont)?' selected':'';
        fontSel += '<option value="' + font + '"' + sel + '>' + font + '</option>';
    });
    fontSel += '</select>';
    $('#settings-container-pick').append('<div class="setting-group"><h2 class="text-white">Font</h2>');
    $('#settings-container-pick').append(fontSel);
    $('#settings-container-pick').append('</div');
    $("#font").selectmenu();

    ['hideCols', 'notifications', '3D'].forEach(function(checkbox) {
        if (config[checkbox]) {
            $("input#"+checkbox).prop("checked", true);
        }
    });
}

function changeFavicon(link) {
    let $favicon = document.querySelector('link[rel="icon"]')
    if ($favicon !== null) {
        $favicon.href = link
    } else {
        $favicon = document.createElement("link")
        $favicon.rel = "icon"
        $favicon.href = link
        document.head.appendChild($favicon)
    }
}

function showNotification(msg, icon) {
    notify = new Notification('Xymon status change', {
        body: msg,
        icon: icon
    });
}

function showFlash(msg) {
    $('#flash').html(msg);
    $("table#container").fadeTo("slow", 0.3, function() {
        $("#flash").show("blind", 500).delay(5000).hide("blind", 500, function() {
            $("table#container").fadeTo("slow", 1.0);
        });
    });
}

$.urlParam = function() {
    let result = '';
    if (result = window.location.href.match(/\?(.*)$/)) {
        return result[1];
    } else {
        return null;
    }
}
