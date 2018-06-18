Xymondash - because it's not 1997 any more
==========================================

For monitoring large scale computing environments, we love <a href="https://www.xymon.com/">Xymon</a> as much as the next guy, but let's face it: once your setup reaches a certain complexity (we're at > 10k tests on ~ 900 hosts), the Xymon web interface just doesn't cut it any more. We've been experimenting with prio classes on the critical view, pages and all sorts of other hacks to only see what's important but not miss any of it. Either important things get missed between just too many smilies and icons, or you dumb down the interface to a point where you're just ignoring many tests. Finally we sat down and brainstormed what the ideal monitoring front end should look like (at least for us). We then sat down and started implementing xymondash. It uses a python CGI that fetches Xymon's data and provides it as JSON. A Javascript app then parses this data and generates the interface. Here are the guidelines we came up with:

  * for each test, we have a two-dimensional coordinate defined by the test's priority (P1 to P3 or none) and the result of the test (red, yellow, green..). So it makes sense to display the test results in a matrix with the most important stuff in the upper left corner and the least important items in the lower right. We decided on prio for the x axis and color for the y axis
  * if a hosts has multiple non-green entries (say P2/yellow and P1/red), we only want to see it once in our matrix, at P1/red. The P2/yellow entry will be added to the P1/red and "jumps back" to P2/yello once P1/red has been resolved or acknowledged
  * we want to make acknowledgements fast and easy in order to encourage team members to let their colleagues know they're working on something and get the corresponding entry off of everybody's matrix
  * we want to show as much information as possible as unobtrusively as possible. Hence we use mouse-over tooltips a lot
  * the interface should be usable on mobile devices ("responsive")
  * everything is configurable: which colors and prios to see, display acknowledged tests or not, conditions for the overall background color etc



internal:

use:
  * jquery
  * jqueryui with dialog

TODO
  * ack greift nicht auf critical
  * prio setting greift nicht (nijet versteh...)
  * grün wird nicht angezeigt?
  * favicon
  * ack button on mobile?
  * bg color logic -> daduke check if done by rda
  * form clear on enter
  * couple colors array to URL
  * ack time period
  * hide acked -> JS -> andere prios dürfen nicht da rein rutschen
  * https redirect
  * graphen + Lupe in msg
  * config:
    * JSON URL configurable
    * xymon detail URL configurable
    * ack URL configurable
    * font

Ideen:
  * host search+filter inkl. grün
  * regex exclude filter (test/host)
  * dirtyvcs exclude filter
