#!/usr/bin/env node
// Does the published page fit its viewport at phone and tablet widths?
//
// WHY THIS EXISTS. A headless SCREENSHOT is not a measurement of layout.
// Chrome on Windows will not open a window narrower than about 500 px, so
// `--window-size=420,H --screenshot` lays the page out at ~497 px and then crops
// the image to 420, which looks exactly like a page overflowing its viewport.
// Reading that crop is how this repository came to record, in FIXES.md and in
// development/2026_08_27_site-review-comments.md, that "the page overflows its
// viewport horizontally below about 720 px", with a count of 22 clipped rows at
// 620 px. Measured instead inside an iframe of the requested width -- a real
// viewport at any size -- the page reports zero overflowing elements and
// scrollWidth === clientWidth at every width below. The defect was in the
// instrument.
//
// WHAT IT ASSERTS. At each width: no element's right edge passes the viewport's,
// and the document does not scroll sideways.
//
// THE NEGATIVE CONTROL RUNS EVERY TIME. A check that has only ever been seen
// passing is not known to be a check, and this one is measuring the absence of
// something. A second iframe loads the same page with one deliberately
// 1600 px-wide <div> appended; if that does NOT report an overflow, the
// measurement is not working and the suite fails rather than reporting a pass it
// cannot support.
//
// HOW THE RESULT GETS BACK, and why it is not --dump-dom. Until 2026-09-18 the
// harness left its JSON in a <pre> and Chrome was asked to --dump-dom once its
// --virtual-time-budget expired. Those are two different clocks: virtual time
// compresses the harness's own setTimeout sleeps, so the dump could land while
// the measurement loop was still running, and the suite then reported "the
// harness produced no measurement" for a page that was perfectly fine. Measured
// over five runs it failed twice, on a step that gates every push and pull
// request. The harness now POSTs its result to the server it was loaded from and
// node waits for that POST, which is the measurement saying it is finished
// rather than a guess about when it will be.
//
// SKIPS, rather than fails, when no Chrome is found: the other suites need no
// browser and must stay runnable on a machine without one.
//
//   node tests/test_viewport_overflow.mjs [docsDir]

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";

const DOCS = resolve(process.argv[2] || "docs");
// Optional third argument: which page under DOCS to measure. Defaults to the
// site root, so every existing invocation behaves exactly as before. The
// control copy is served from the SAME directory as the page, because a page
// in a subdirectory resolves its stylesheet, script and data relatively.
const PAGE = ("/" + (process.argv[3] || "index.html")).replace(/\/+/g, "/");
const PAGE_DIR = PAGE.slice(0, PAGE.lastIndexOf("/"));
const CONTROL_URL = `${PAGE_DIR}/__overflow_control.html`;
const WIDTHS = [360, 420, 620, 720, 1024, 1440];

function findChrome() {
  // An explicit CHROME is honoured strictly: if it is set and does not exist,
  // skip loudly rather than silently falling back to some other browser, which
  // would make the suite report on a binary the caller did not ask for.
  if (process.env.CHROME) return existsSync(process.env.CHROME) ? process.env.CHROME : null;
  const candidates = [
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find(p => existsSync(p)) || null;
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

// The harness measures every width in ONE page load: it resizes a single iframe
// and re-reads it, so the whole suite costs one browser launch.
const HARNESS = (widths, page, controlUrl) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" src="${page}" style="border:0;width:${widths[0]}px;height:1400px"></iframe>
<iframe id="neg" src="${controlUrl}" style="border:0;width:400px;height:1400px"></iframe>
<pre id="out">pending</pre>
<script>
const WIDTHS = ${JSON.stringify(widths)};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function measure(frame) {
  const d = frame.contentDocument;
  const vw = d.documentElement.clientWidth;
  let n = 0, worst = "";
  for (const el of d.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) {
      n++;
      if (!worst) worst = Math.round(r.right) + "px " + el.tagName +
        (el.id ? "#" + el.id : "") +
        (typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\\s+/).join(".") : "");
    }
  }
  return { vw, scrollW: d.documentElement.scrollWidth, n, worst };
}
(async () => {
  const f = document.getElementById("f"), neg = document.getElementById("neg");
  const rows = [];
  await sleep(2500);                       // first load + Plotly's first draw
  for (const w of WIDTHS) {
    f.style.width = w + "px";
    await sleep(700);                      // reflow, and Plotly's resize handler
    const m = measure(f);
    rows.push({ requested: w, ...m });
  }
  const control = measure(neg);
  const payload = JSON.stringify({ rows, control }, null, 1);
  document.getElementById("out").textContent = payload;
  // Reported by POST rather than left in the DOM for --dump-dom to scrape.
  // --dump-dom races the page: Chrome dumps when its virtual-time budget runs
  // out, which is not the moment this function finishes, so roughly one run in
  // four dumped while <pre> still read "pending" and the suite failed with "the
  // harness produced no measurement" on a page that was fine. A POST is the
  // measurement telling the server it is done, which is not a race.
  fetch("/__result", { method: "POST", body: payload });
})();
</script></body>`;

const chrome = findChrome();
if (!chrome) {
  console.log("viewport overflow: SKIP (no Chrome/Edge found; set CHROME=/path/to/chrome)");
  process.exit(0);
}
if (!existsSync(join(DOCS, PAGE.replace(/^\/+/, "")))) {
  console.error(`viewport overflow: FAIL (no ${PAGE} under ${DOCS})`);
  process.exit(1);
}

// The negative control is the real page plus one element wider than any phone.
const control = readFileSync(join(DOCS, PAGE.replace(/^\/+/, "")), "utf8").replace(
  "</body>",
  '<div id="deliberate-overflow" style="width:1600px;height:8px"></div></body>');

let resolveResult;
const resultPromise = new Promise(r => { resolveResult = r; });

const server = createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/__result" && req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => { res.writeHead(204); res.end(); resolveResult(body); });
    return;
  }
  if (url === CONTROL_URL) {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(control);
  }
  if (url === "/__harness.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(HARNESS(WIDTHS, PAGE, CONTROL_URL));
  }
  const file = join(DOCS, url === "/" ? "index.html" : url.replace(/^\/+/, ""));
  if (!file.startsWith(DOCS) || !existsSync(file)) { res.writeHead(404); return res.end("nope"); }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

// A Windows Chrome reached from WSL cannot resolve a /tmp/... profile path, so
// --user-data-dir is passed only to a Linux binary; likewise --no-sandbox, which
// a Windows Chrome does not need and a container Chrome does.
const isWindowsChrome = chrome.toLowerCase().endsWith(".exe");

// Chrome is spawned ASYNCHRONOUSLY and deliberately. spawnSync blocks node's
// event loop, so the server three lines up could never answer the browser's own
// requests: every page would load empty and the suite would report "no
// measurement" while the page under test was perfectly fine.
function runChrome(port) {
  const args = ["--headless=new", "--disable-gpu"];
  if (!isWindowsChrome) {
    args.push("--no-sandbox", `--user-data-dir=${mkdtempSync(join(tmpdir(), "cast-viewport-"))}`);
  }
  // No --virtual-time-budget and no --dump-dom: the harness now reports by POST,
  // so Chrome is simply left running in real time until it does, and killed
  // after. Virtual time compressed the harness's own sleeps, which is what made
  // the dump land mid-measurement.
  args.push("--window-size=1600,1500", `http://localhost:${port}/__harness.html`);
  const p = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  p.stderr.on("data", d => { err += d; });
  return { proc: p, errText: () => err };
}

// A Windows Chrome reaches a WSL server through Windows' localhost forwarding,
// which only forwards to a socket bound on all interfaces; 127.0.0.1 inside WSL
// is not reachable from the Windows side. A Linux Chrome takes the loopback.
server.listen(0, isWindowsChrome ? "0.0.0.0" : "127.0.0.1", async () => {
  const port = server.address().port;
  const { proc, errText } = runChrome(port);

  // Wait for the harness's POST, with a ceiling. The harness's own schedule is
  // ~6.7s of real time (a 2.5s first paint plus 700ms per width), so 90s is a
  // hang, not a slow machine.
  const TIMEOUT_MS = 90_000;
  let timer;
  const timeout = new Promise(r => { timer = setTimeout(() => r(null), TIMEOUT_MS); });
  const body = await Promise.race([resultPromise, timeout]);
  clearTimeout(timer);
  proc.kill("SIGKILL");
  server.close();
  server.closeAllConnections?.();

  if (!body) {
    console.error(`viewport overflow: FAIL (no measurement posted within ${TIMEOUT_MS / 1000}s)`);
    console.error(errText().split("\n").filter(l => !/ERROR:google_apis/.test(l)).slice(0, 5).join("\n"));
    process.exit(1);
  }
  const data = JSON.parse(body);

  let fails = 0;
  const ok = (msg, cond) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`); };

  console.log("viewport overflow: " + DOCS + PAGE);
  // The control first: everything after it is only meaningful if it fires.
  ok(`the measurement detects a real overflow (control: ${data.control.n} element(s), scrollWidth ${data.control.scrollW} > ${data.control.vw})`,
     data.control.n >= 1 && data.control.scrollW > data.control.vw);

  for (const row of data.rows) {
    ok(`no element overflows at ${row.vw}px (requested ${row.requested})` +
       (row.n ? ` -- first: ${row.worst}` : ""), row.n === 0);
    ok(`no sideways scroll at ${row.vw}px (scrollWidth ${row.scrollW} === clientWidth ${row.vw})`,
       row.scrollW === row.vw);
  }

  console.log(`viewport overflow: ${fails === 0 ? "PASS" : "FAIL"} (${fails} failure${fails === 1 ? "" : "s"})`);
  process.exit(fails === 0 ? 0 : 1);
});
