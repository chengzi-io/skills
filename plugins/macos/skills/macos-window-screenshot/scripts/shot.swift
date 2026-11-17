// Usage: xcrun swift shot.swift APP "<window title>" out.png [activate]
// Finds the window, optionally activates its app, waits until the bounds hold still,
// captures it with screencapture -x -o -l, then gives focus back. Polls every 20 ms.
import AppKit
let a = CommandLine.arguments, app = a[1], title = a[2], out = a[3], activate = a.count > 4
func wins() -> [[String: Any]] {
  (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? [])
    .filter { w in w["kCGWindowOwnerName"] as? String == app && w["kCGWindowLayer"] as? Int == 0 }
}
func win() -> (CGWindowID, CGRect)? {
  guard let w = wins().first(where: { w in w["kCGWindowName"] as? String == title }) else { return nil }
  var r = CGRect.zero; CGRectMakeWithDictionaryRepresentation(w["kCGWindowBounds"] as! CFDictionary, &r)
  return (w["kCGWindowNumber"] as! CGWindowID, r)
}
func poll(_ s: Double, _ ok: () -> Bool) -> Bool {
  let end = Date().addingTimeInterval(s)
  while Date() < end { if ok() { return true }; RunLoop.current.run(until: Date().addingTimeInterval(0.02)) }
  return false
}
var f: (CGWindowID, CGRect)?
guard poll(10, { f = win(); return f != nil }), let (id, before) = f else {
  print("no window titled \(title); titles:", wins().compactMap { w in w["kCGWindowName"] as? String }); exit(1)
}
let ws = NSWorkspace.shared, prev = ws.frontmostApplication
let me = ws.runningApplications.first { r in r.localizedName == app }!
if activate { me.activate(); _ = poll(3) { ws.frontmostApplication == me } }
let sm = UserDefaults(suiteName: "com.apple.WindowManager")?.bool(forKey: "GloballyEnabled") ?? false
var last = CGRect.null, same = 0
_ = poll(5) {
  guard let (_, r) = win() else { return false }
  same = r == last ? same + 1 : 0; last = r
  return same >= 10 && !(sm && activate && r == before && before.width < 200)
}
let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
p.arguments = ["-x", "-o", "-l", "\(id)", out]; try! p.run(); p.waitUntilExit()
if activate, let prev, prev != me { prev.activate(); _ = poll(3) { ws.frontmostApplication == prev } }
print("window \(id) \(last) -> \(out)")
