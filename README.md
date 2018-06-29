Xymondash - because it's not 1997 any more
==========================================

For monitoring large scale computing environments, we love <a href="https://www.xymon.com/">Xymon</a> as much as the next guy, but let's face it: once your setup reaches a certain complexity (we're at > 10k tests on ~ 900 hosts), the Xymon web interface just doesn't cut it any more. We've been experimenting with prio classes on the critical view, pages and all sorts of other hacks to only see what's important but not miss any of it. Either important things get overlooked between just too many smilies and icons, or you dumb down the interface to a point where you're just ignoring many tests. Finally we sat down and brainstormed what the ideal monitoring front end should look like (at least for us). We then started implementing Xymondash. It uses a python CGI that fetches Xymon's data and provides it as JSON. A Javascript app then parses this data and generates the interface. Here are the design guidelines we came up with:

[<img src="img/screenshot_th.png">](img/screenshot.png)

  * for each test, we have a two-dimensional coordinate defined by the test's priority (P1 to P3 or none) and the result of the test (red, yellow, green..). So it makes sense to display the test results in a matrix with the most important stuff in the upper left corner and the least important items in the lower right. We decided on prio for the x axis and color for the y axis
  * if a hosts has multiple non-green entries (say P2/yellow and P1/red), we only want to see it once in our matrix, at P1/red. The P2/yellow entry will be added to the P1/red and "jumps back" to P2/yello once P1/red has been resolved or acknowledged
  * we want to make acknowledgements fast and easy in order to encourage team members to let their colleagues know they're working on something and get the corresponding entry off of everybody's matrix. You can acknowledge individual tests or all tests of a host
  * we want to show as much information as possible as unobtrusively as possible. Hence we use mouse-over tooltips a lot
  * if you're like us, you're looking at the monitoring interface a lot of times during the day. There might be tests that shouldn't be acknowledged, but you can't get rid of them right now either. In order not to have to "mentally parse" the whole matrix each time, you can hit the 'mark all as seen' button which will fade out all currently present tests so that all new ones will be very hard to miss
  * there's a dynamic favicon and you can turn on desktop notifications
  * you can override the URL parameters used to fetch the JSON data in order to modify which tests to fetch (see `xymon2json` for details)
  * the interface should be usable on mobile devices ("responsive")
  * everything is configurable: which colors and prios to see, display acknowledged tests or not, conditions for the overall background color etc

Installation
------------

In order to get Xymondash running on top of your Xymon monitoring, you'll have to do the following:

  * check out the Xymondash folder on your monitoring server
  * copy `config.ini.example` to `config.ini`
  * change `XYMONCLI` and `CRITICAL` in `config.ini` to the correct location in your file system
  * run `./config.sh` to configure the CGI scripts
  * make sure the CGI scripts are working. They require Python >= 3.5 (if you need to support 3.4 you have to switch to the [old subprocess API](https://docs.python.org/3/library/subprocess.html#call-function-trio) instead of the now recommended run method). If your web server is picky about CGI locations, you can copy the two CGIs to `<path-to>/xymon/cgi-bin/` and run them from there. Open the URL of `xymon2json` in your browser and make sure it generates JSON. Don't bother to proceed until this works!
  * with the CGIs in place, edit `config.ini` to the correct URLs of `XYMONURL`, `XYMONACKURL` and `XYMONJSONURL`
  * run `./config.sh` again to configure the JS
  * finally pick a `TITLE` in `config.ini` and rerun `./config.sh`
  * point your web browser to the Xymondash URL and you should be good to go!

Known issues
------------

  * the 'test detail tooltip' doesn't display if screen space is too tight. The only option I see is showing fewer lines at the expense of readability
  * hover tooltips on mobile devices: iOS seems to work around by doing 'first click -> hover, 2nd click -> real click', but on Android hover doesn't work. There seems to be no real way of doing this
  * Safari and Edge don't render a nice color gradient on the background as they don't support `background-blend-mode: soft-light`. Oh well, 2018 and some browsers still suck...
  * acks don't show in Xymons' critical view. There seems to be a separate mechanism to that end that we yet have to understand
