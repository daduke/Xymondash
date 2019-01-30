/* Xymondash - get a concise view of a crowded xymon instance
   (c) 2018 ISG D-PHYS, ETH Zurich
       Claude Becker    - backend code
       Sven Mäder       - Visual FX and JS logic
       Christian Herzog - JS logic
*/

const XYMONURL     = '/xymon-cgi/svcstatus.sh';
const XYMONACKURL  = '/xymondash/cgi/xymon-ack';
const XYMONDISURL  = '/xymondash/cgi/xymon-disable';
const XYMONJSONURL = '/xymondash/cgi/xymon2json';
const XYMONSERVER  = 'silberspitz';

let availableColors = ['red', 'purple', 'yellow', 'blue', 'green'];
let availablePrios = ['prio1', 'prio2', 'prio3', 'other', 'ack'];
let config = {};
if (!config['testState']) config['testState'] = {};

readConfig();

let dialogForm, backgroundColor;
let paused = false;         //true prevents background reloads
let showSearch = false;     //true when host search is displayed
let mouseX = 0;
let mouseY = 0;

$(document).ready(function() {
    $(document).tooltip({                         //initialize tooltips
        items: "[tooltip]",
        content: function() {
            if ($(this).is('span') ||
                ($(this).is('i') && $(this).parent().children("span.test").prop("class").match(/\backed\b/))) {
                //this cleans up the message text in order to make it readable in the tooltip
                return cleanTooltip($(this).attr('tooltip'));
            } else if ($(this).is('button')) {
                return $(this).attr('tooltip');
            }
        },
        open: function(event, ui) {
            paused = true;     //no refresh while tooltip is open
        },
        close: function(event, ui) {
            if (!showSearch) { paused = false; }
        },
        show: {
            effect: "none",
            delay: "250"
        },
        position: {
            using: function(pos, feedback) {
                let maxHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);   //viewport height
                let maxWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);   //viewport width
                let tt = $(this);   //our tooltip
                let height = parseInt(tt.css("height").replace('px',''), 10);  //original height of tooltip
                let width = parseInt(tt.css("width").replace('px',''), 10);  //original width of tooltip
                let fontSize = parseInt(tt.css("font-size"), 10);
                let browserZoomLevel = window.devicePixelRatio;
                let fH = fontSize * browserZoomLevel;
                let fW = fontSize * browserZoomLevel * 0.8;
                let endHeight = 0;
                if (mouseY < maxHeight/2) { //top half of screen
                    endHeight = Math.min(height, maxHeight - mouseY - 3*fH);
                    pos.top = mouseY + fH;
                } else {
                    endHeight = Math.min(height, mouseY - 3*fH);
                    pos.top = mouseY - endHeight - 2*fH;
                }
                if (mouseX + width > maxWidth) {
                    pos.left = maxWidth - width - 5*fW;
                    if (pos.left < 0) {
                        pos.left = 0;
                        width = maxWidth - fW;
                    }
                }
                tt.css("height", endHeight+'px');
                let endWidth = Math.min(width + fW/2, maxWidth - 3*fW)+'px';
                tt.css("width", endWidth);
                tt.css("max-width", endWidth);
                tt.css(pos);
            }
        },
        classes: {
            "ui-tooltip": "ui-widget-shadow"
        }
    });

    $(document).keypress(function(e) {
        if (!$("input#hostname").is(":focus") && !paused) {
            if (e.charCode == 114) {            //reload
                doReload();
            } else if (e.charCode == 109) {     //mark as seen
                doMarkSeen();
            } else if (e.charCode == 115) {     //search
                $("form#searchform").css("display", "inline");
                $("input#hostname").focus();
                $("input#hostname").val('');
            }
        }
    });

    dialogForm = $("#dialog-form").dialog({       //acknowledge form template
        autoOpen: false,
        height: 300,
        width: 350,
        modal: true,
        buttons: {
        },
        open: function() {
            let options = $("#dialog-form").dialog("option");
            let cookie = options.cookie;
            $("#number").val(cookie);
            let host = options.hostname;
            $("#host").val(host);
            let service = options.service;
            $("#service").val(service);
            let buttons = dialogForm.dialog('option', 'buttons');
            if (options.actions.match(/a/)) {
                $.extend(buttons, { "Acknowledge": ackTest });
            }
            if (options.actions.match(/d/)) {
                $.extend(buttons, { "Disable": disableTest });
            }
            dialogForm.dialog('option', 'buttons', buttons);

            paused = true;      //no refresh while ack dialog is open
        },
        close: function() {
            if (!showSearch) { paused = false; }
        }
    });
    $("#dialog-form").on( "submit", function( event ) {
        event.preventDefault();
    });

    $("#period").selectmenu();
    $("#page").css("font-family", config['font']);

    $("#reload").click(function(){
        doReload();
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
        config['newTab'] = false;
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
        ['hideCols', 'notifications', 'newTab', '3D'].forEach(function(checkbox) {
            $('input[name="'+checkbox+'"]:checked').each(function(index) {
                config[checkbox] = true;
            });
        });
        let font = $('select#font').val();
        config['font'] = font;
        $("#page").css("font-family", font);

        Cookies.set('xymondashsettings', config, { expires: 365 });
        paused = false;
        triggerUpdate();
    });

    $("button#search").click(function (e) {
        $("form#searchform").css("display", "inline");
    });

    $("form#searchform").submit(function (e) {
        e.preventDefault();
        paused = true;
        showSearch = true;
        $("form#searchform").blur();
        $(document).focus();
        backgroundColor = 'green';
        let hostname = $(this).children("input#hostname").val();
        let params = "?host="+hostname+"&color="+availableColors.join(',');
        config["activeColors"] = availableColors;
        config["activePrios"] = availablePrios;
        $("form#searchform").css("display", "none");
        getJSON(XYMONJSONURL + params, processData);
    });

    //mark all currently visible tests as 'seen'
    $("#markSeen").click(function (e) {
        doMarkSeen();
    });

    $('button#markSeen').attr('tooltip', 'mark all as seen');
    $('button#search').attr('tooltip', 'search for host(s)');
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
    $(document).focus();
    triggerUpdate();
});

function triggerUpdate() {              //fetch data and fill matrix
    let params = '?';

    if ($.urlParam()) {                 //manual URL color params override color checkboxes
        let needColor = true;
        params += $.urlParam();
        $.urlParam().split('&').forEach(function(param) {
            let [key, val] = param.split('=');
            if (key == 'color') {
                config['activeColors'] = val.split(',');
                needColor = false;
            }
        });
        if (needColor) {
            params += '&'+colorParams();
        }
    } else {
        params += colorParams();
    }

    backgroundColor = 'green';
    getJSON(XYMONJSONURL + '?color=green&host='+XYMONSERVER+'&test=xymongen', processData);
    getJSON(XYMONJSONURL + params, processData);
}

function colorParams() {
    let i = 0;
    let params = '';
    config['activeColors'].forEach(function(color) {
        params += (i++ == 0)?'color=':',';
        params += color;
    });

    return params;
}

function processData() {    //callback when JSON data is ready
    let entries = {};
    let lowestPos = {};
    let leave = false;

    let xymonData = this.response;
    xymonData.forEach(function(entry) {     //loop thru data and process all tests into entries object
        let ackmsg, acktime, dismsg, distime, cookie;
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
        if (entry.dismsg) {
            dismsg = entry.dismsg;
            distime = (entry.disabletime == '-1')?'disabled until OK':entry.disabletime;
        } else {
            dismsg = 'empty';
            distime = '';
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
            entries[color][prio][host][test]['dismsg'] = dismsg;
            entries[color][prio][host][test]['distime'] = distime;
            entries[color][prio][host][test]['cookie'] = cookie;
            entries[color][prio][host][test]['msg'] = msg;
            lowestPos[host] = {};
            lowestPos[host]['x'] = 10;
            lowestPos[host]['y'] = 10;

            if (host == XYMONSERVER && test == 'xymongen') {
                msg = cleanTooltip(msg).replace(/- (Red|Yellow|Clear|Green|Purple|Blue)/g,
                    '<span style="color: $1;">&#x25cf; </span>');
                $('button#stats').attr('tooltip', cleanTooltip(msg));
                $("button#stats").click(function() {
                    window.location.href = createLink(host, test);
                    return false;
                });
                leave = true;
            }
        }
    });
    if (leave) return false;

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
    let ackTests = {};
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
                    if (!ackTests[host]) { ackTests[host] = 0; }
                    for (let test in entries[color][prio][host]) {
                        let ackmsg = entries[color][prio][host][test]['ackmsg'];
                        let acktime = entries[color][prio][host][test]['acktime'];
                        let dismsg = entries[color][prio][host][test]['dismsg'];
                        let distime = entries[color][prio][host][test]['distime'];
                        let msg = entries[color][prio][host][test]['msg'];
                        let cookie = entries[color][prio][host][test]['cookie'];
                        let lowestX = lowestPos[host]['x'];
                        let lowestY = lowestPos[host]['y'];
                        let lowestPosHost = lowestX + 10*lowestY;
                        let selector;
                        let seenSel = host + '_' + test + '_' + color;
                        let modifySel = host + '_' + test;
                        if (config['testState'][seenSel] != 'seen') {
                            allSeen[host] = false;
                        }
                        if (lowestPosHost < pos && !showSearch) {    //if we have a higher prio/color entry already and do not show a search result
                            selector = config['activeColors'][lowestY] + '_' + config['activePrios'][lowestX];
                        } else {
                            selector = color + '_' + prio;
                            lowestPos[host]['x'] = x;
                            lowestPos[host]['y'] = y;
                        }
                        let ackClass = (ackmsg != 'empty' || dismsg != 'empty')?' acked':'';
                        ackmsg = ackmsg.replace(/\\n/ig, "<br />");
                        dismsg = dismsg.replace(/\\n/ig, "<br />");
                        let d = new Date(acktime*1000);
                        acktime = "acked until " + dateFormat(d, "HH:MM, mmmm d (dddd)");
                        if (distime != 'disabled until OK') {
                            let d = new Date(distime*1000);
                            distime = "disabled until " + dateFormat(d, "HH:MM, mmmm d (dddd)");
                        }
                        let ackIcon;
                        if (cookie == 'empty' && dismsg == 'empty') {
                            ackIcon = '&nbsp;&nbsp;';
                        } else {
                            ackIcon = "<i class='ack"+ackClass+" fas fa-check' id='"+modifySel+"'></i>";
                            ackTests[host]++;
                        }
                        let popupmsg = 'empty';
                        let actions = 'd';
                        if (cookie != 'empty') actions += ',a';
                        if (ackmsg != 'empty') {
                            popupmsg = '<b>'+ackmsg+'</b><br /><br />'+acktime;
                        } else if (dismsg != 'empty') {
                            popupmsg = '<b>'+dismsg+'</b><br /><br />'+distime;
                        }
                        if (numTests[host] == 0 || showSearch) {   //new host or search result -> we need a host entry first
                            $("#" + selector).append(
                                "<div class='msg' data-host='"+host+"'>"+
                                    "<span class='info'>"+host+": </span>"+
                                    "<div class='tests'>"+
                                        "<span class='test"+ackClass+"' data-test='"+test+"' data-color='" +color+"' data-cookie='"+cookie+"' data-actions='"+actions+"'>"+
                                            test+
                                        "</span>"+
                                        ackIcon+
                                    "</div>"+
                                "</div>");
                            $("#" + selector).removeClass("inv");
                        } else {                  //host already exists -> just add another test
                            $('[data-host="'+host+'"]').append(
                                "<div class='tests'>"+
                                    "<span class='test"+ackClass+"' data-test='"+test+"' data-color='" +color+"' data-cookie='"+cookie+"' data-actions='"+actions+"' >"+
                                        test+
                                    "</span>"+
                                    ackIcon+
                                "</div>");
                        }
                        let entry = $('[data-host="'+host+'"]').find('div.tests').children('span.test[data-test="' + test + '"][data-color="'+color+'"]');
                        $(entry).attr('tooltip', msg);
                        if (popupmsg != 'empty') {
                            $('i#'+modifySel).attr('tooltip', popupmsg);
                        }
                        if (numEntries++ > 500) {
                            showFlash('Your settings yield too many tests! Please choose fewer colors or prios.');
                            throw new Error("too many results");
                        }
                        numTests[host]++;

                        if (test == 'xymongen') {
                            alert('nu!');
                            $('button#stats').attr('tooltip', 'xymon statistics');
                        }
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

    let numCols = availablePrios.length;
    if (!showSearch) {      //regular run
        //loop over hosts and determine allSeen and ackAll state
        $('[data-host]').each(function(index) {
            let host = $(this).data('host');

            if (allSeen[host]) {
                $('[data-host="'+host+'"]').addClass("seen");
            }
            if (ackTests[host] > 1) {
                $('[data-host="'+host+'"]').append(
                    "<div class='tests'>"+
                        "<i class='ack ackall fas fa-check-double' id='all-"+host+"'></i>"+
                    "</div>");
            }
        });

        //delete gone tests from testState
        $.each(config['testState'], function(sel, value) {
            let [host, test, color] = sel.split('_');
            let entry = $('[data-host="'+host+'"]').find('div.tests').children('span.test[data-test="' + test + '"][data-color="'+color+'"]');
            if (entry.length == 0) {
                delete config['testState'][sel];
            }
        });

        //let's find all empty columns and hide them
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

        Cookies.set('xymondashsettings', config, { expires: 365 }); //write config so that test states are persistent
    } else {            //search result -> recover previous config
        readConfig();
    }

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
    let d = Date();
    $("#date").html( dateFormat(d, "HH:MM, mmmm d"));

    let linkTarget = (config['newTab'])?'_blank':'_self';
    $("span.info").click(function(){
        $(this).innerHTML = $(this).parent().parent().data("host")+' / ';
        let link = createLink($(this).parent().data("host"), 'info');
        window.open(link, linkTarget)
    });
    $("span.test").click(function(){
        let link = createLink($(this).parent().parent().data("host"), $(this).data("test"));
        window.open(link, linkTarget)
    });
    $("i.ack").click(function(){
        dialogForm.dialog("option", "hostname", $(this).parent().parent().data("host"));
        if ($(this).hasClass('ackall')) {   //ack all tests of this host
            let cookies = [];
            let tests = [];
            let actions = [];
            $(this).parent().parent().find("span.test").each(function(e) {
                cookies.push($(this).data("cookie"));
                tests.push($(this).data("test"));
                actions.push($(this).data("actions"));
            });
            dialogForm.dialog("option", "cookie", cookies.join('#'));
            dialogForm.dialog("option", "service", tests.join('#'));
            dialogForm.dialog("option", "actions", actions.join('#'));
        } else {                            //single test
            dialogForm.dialog("option", "cookie", $(this).parent().children("span.test").data("cookie"));
            dialogForm.dialog("option", "service", $(this).parent().children("span.test").data("test"));
            dialogForm.dialog("option", "actions", $(this).parent().children("span.test").data("actions"));
        }
        dialogForm.dialog("open");
    });

    $("*[tooltip]").mouseover(function(event) {
        mouseX = (event.pageX);
        mouseY = (event.pageY);
    });
}       //end processData

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
    let fields = ['number', 'delay', 'period', 'message', 'host', 'service'];
    let vals = {};
    fields.forEach(function(field) {
        vals[field] = $("#"+field).val().trim();
    });
    if (!vals['message']) vals['message'] = '-';
    let min = calcMins(vals['delay'],  vals['period']);

    let i = 0;
    let numbers = vals['number'].split('#');
    let services = vals['service'].split('#');
    numbers.forEach(function(number) {
        if (number != 'empty') {
            $.ajax({
                type: "POST",
                url: XYMONACKURL,
                data: { number: number, min: min, msg: vals['message'], host: vals['host'], test: services[i] },
                success: function(data) {
                    if (++i == numbers.length) {
                        dialogForm.dialog( "close" );
                        triggerUpdate();
                    }
                },
                error: function(data) {
                    console.log(data);
                    alert('could not acknowledge test!');
                },
            });
        }
    });
}

function disableTest() {
    let fields = ['delay', 'period', 'message', 'host', 'service'];
    let vals = {};
    fields.forEach(function(field) {
        vals[field] = $("#"+field).val().trim();
    });
    if (!vals['message']) vals['message'] = '-';
    let min = calcMins(vals['delay'],  vals['period']);

    let i = 0;
    let services = vals['service'].split('#');
    services.forEach(function(service) {
        $.ajax({
            type: "POST",
            url: XYMONDISURL,
            data: { min: min, msg: vals['message'], host: vals['host'], test: service },
            success: function(data) {
                if (++i == services.length) {
                    dialogForm.dialog( "close" );
                    triggerUpdate();
                }
            },
            error: function(data) {
                console.log(data);
                alert('could not disable test!');
            },
        });
    });
}

function calcMins(min, period) {
    if (min == -1) return -1;
    if (period == 'hours') {
        min *= 60;
    } else if (period == 'days') {
        min *= 60*24;
    }
    return min;
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
    if (config['activeBgPrios'].includes(prio) || showSearch) {
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
       } else if (color != 'blue' ) {
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
    $('#settings-container-pick').append('</div>');
    $("#font").selectmenu();

    ['hideCols', 'notifications', 'newTab', '3D'].forEach(function(checkbox) {
        if (config[checkbox]) {
            $("input#"+checkbox).prop("checked", true);
        } else {
            $("input#"+checkbox).prop("checked", false);
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

function readConfig() {
    if (Cookies.get('xymondashsettings')) {
        config = Cookies.getJSON('xymondashsettings');
        if (!config['testState']) config['testState'] = {};
    } else {
        config['activeColors'] = ['red', 'purple', 'yellow'];
        config['activePrios'] = ['prio1', 'prio2', 'prio3', 'other', 'ack'];
        config['activeBgPrios'] = ['prio1', 'prio2', 'prio3', 'other'];
        config['hideCols'] = false;
        config['notifications'] = false;
        config['newTab'] = false;
        config['3D'] = false;
    }
}

function doReload() {
    paused = false;
    showSearch = false;
    triggerUpdate();
}

function doMarkSeen() {
    $('span.test').each(function(index) {
        let sel = $(this).parent().parent().data('host') + '_' + $(this).data('test') + '_' + $(this).data('color');
        config['testState'][sel] = 'seen';
    });
    triggerUpdate();
}

$.urlParam = function() {
    let result = '';
    if (result = window.location.href.match(/\?(.*)$/)) {
        return result[1];
    } else {
        return null;
    }
}

function cleanTooltip(msg) {
    msg = msg.replace(/\\[p|t]/g, '  ')
        .replace(/(&(red|green|yellow|clear) )/g, '<span style="color: $2;">&#x25cf; </span>')
        .replace(/[-=]{10,}/g, '----------')
        .replace(/<table summary.+?<\/table>/g, '')
        .replace(/TIME SPENT\\n.+/, '')
        .replace(/\\n+/g, '\n')
        .replace(/\\n/g, '<br />');

    return msg;
}
