#!/usr/bin/env node
// Does the published page fit its viewport at phone and tablet widths?
//
// WHY THIS EXISTS. A headless SCREENSHOT is not a measurement of layout.
// Chrome on Windows will not open a window narrower than about 500 px, so
// `--window-size=420,H --screenshot` lays the page out at ~497 px and then crops
// the image to 420, which looks exactly like a page overflowing its viewport.
// Reading that crop is how this repository came to record, in FIXES.md and in
// development/2026_08_27_everest-yang-feedback.md, that "the page overflows its
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
const HARNESS = (widths) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" src="/index.html" style="border:0;width:${widths[0]}px;height:1400px"></iframe>
<iframe id="neg" src="/__overflow_control.html" style="border:0;width:400px;height:1400px"></iframe>
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
  document.getElementById("out").textContent =
    JSON.stringify({ rows, control }, null, 1);
})();
</script></body>`;

const chrome = findChrome();
if (!chrome) {
  console.log("viewport overflow: SKIP (no Chrome/Edge found; set CHROME=/path/to/chrome)");
  process.exit(0);
}
if (!existsSync(join(DOCS, "index.html"))) {
  console.error(`viewport overflow: FAIL (no index.html under ${DOCS})`);
  process.exit(1);
}

// The negative control is the real page plus one element wider than any phone.
const control = readFileSync(join(DOCS, "index.html"), "utf8").replace(
  "</body>",
  '<div id="deliberate-overflow" style="width:1600px;height:8px"></div></body>');

const server = createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/__overflow_control.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(control);
  }
  if (url === "/__harness.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(HARNESS(WIDTHS));
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
  args.push("--virtual-time-budget=25000", "--window-size=1600,1500", "--dump-dom",
            `http://localhost:${port}/__harness.html`);
  return new Promise((res) => {
    const p = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 120_000);
    p.stdout.on("data", d => { out += d; });
    p.stderr.on("data", d => { err += d; });
    p.on("close", () => { clearTimeout(kill); res({ out, err }); });
  });
}

// A Windows Chrome reaches a WSL server through Windows' localhost forwarding,
// which only forwards to a socket bound on all interfaces; 127.0.0.1 inside WSL
// is not reachable from the Windows side. A Linux Chrome takes the loopback.
server.listen(0, isWindowsChrome ? "0.0.0.0" : "127.0.0.1", async () => {
  const port = server.address().port;
  const { out: dom, err } = await runChrome(port);
  server.close();
  server.closeAllConnections?.();

  const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!m || m[1].trim() === "pending") {
    console.error("viewport overflow: FAIL (the harness produced no measurement)");
    console.error(err.split("\n").filter(l => !/ERROR:google_apis/.test(l)).slice(0, 5).join("\n"));
    process.exit(1);
  }
  const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                       .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const data = JSON.parse(decode(m[1]));

  let fails = 0;
  const ok = (msg, cond) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`); };

  console.log("viewport overflow: " + DOCS);
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
