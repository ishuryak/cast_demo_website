// Style contract: the CSS has to let the markup take a size.
//
// The suite exists because of a defect no other suite could see. app.js emitted
// <span class="rmse-fill" style="width:NN%"> inside a plain block, and the
// render smoke test asserted that markup was present, which it was. But a
// non-replaced INLINE element ignores width and height (CSS 2.1 10.3.1 /
// 10.6.1), so every RMSE bar rendered as an empty grey rail in every state of
// the page, from the day the card was written until 2026-08-27.
//
// Checks:
//   1. Anything app.js sizes with a percentage width, or that style.css gives a
//      percentage height, declares a non-inline display.
//   2. The structural classes the cards depend on are actually defined.
//
//   node tests/test_style_contract.mjs

import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(root, "docs", "style.css"), "utf8");
const js = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");

const fail = [];

// Strip comments so a class named only inside /* ... */ does not count as defined.
const cssLive = css.replace(/\/\*[\s\S]*?\*\//g, "");

// Collect every declaration block for a given simple class selector.
function rulesFor(cls) {
  const out = [];
  const re = new RegExp(`(^|[,\\s>+~])\\.${cls}(?![\\w-])[^{}]*\\{([^{}]*)\\}`, "g");
  let m;
  while ((m = re.exec(cssLive)) !== null) out.push(m[2]);
  return out;
}
function decl(cls, prop) {
  for (const body of rulesFor(cls)) {
    const re = new RegExp(`(^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
    const m = body.match(re);
    if (m) return m[2].trim();
  }
  return null;
}
const SIZEABLE = /^(block|flex|grid|inline-block|inline-flex|inline-grid|table|list-item)\b/;

// ---- 1. elements app.js sizes with a percentage width ----------------------
// e.g.  <span class="rmse-fill" style="width:${...}%">
const sized = new Set();
for (const m of js.matchAll(/class="([\w-]+)"[^"]*style="[^"]*width:\$\{[^}]*\}%/g))
  sized.add(m[1]);
// and anything style.css itself gives a percentage height, which has the same
// constraint and is the other half of how a bar fill is built.
for (const m of cssLive.matchAll(/\.([\w-]+)[^{}]*\{[^{}]*height\s*:\s*100%/g))
  sized.add(m[1]);

if (sized.size === 0)
  fail.push("found nothing sized by percentage: the scan pattern has drifted from app.js");

for (const cls of [...sized].sort()) {
  const d = decl(cls, "display");
  if (d === null)
    fail.push(`.${cls} is sized by percentage but declares no display, so it stays ` +
              `inline and the size is ignored (CSS 2.1 10.3.1/10.6.1)`);
  else if (!SIZEABLE.test(d))
    fail.push(`.${cls} is sized by percentage but has display: ${d}, which ignores width/height`);
}

// ---- 2. the classes the card markup relies on are defined ------------------
for (const cls of ["card-group", "brief", "rmse-track", "rmse-fill", "seg"]) {
  if (html.includes(`class="${cls}`) || html.includes(` ${cls}"`) || cls === "rmse-fill") {
    if (rulesFor(cls).length === 0) fail.push(`.${cls} is used but has no rule in style.css`);
  }
}

// ---- 3. the card face's spans are given a block display --------------------
// A card's live numbers live inside its <summary>, whose content model forbids
// <p> and <div>, so they are <span>s. A span is inline by default: without an
// explicit display they run together on one line and the card face turns into a
// paragraph. The markup cannot say this and the render smoke test cannot see it,
// so it is pinned here.
const summaries = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map(m => m[1]);
const faceClasses = new Set();
for (const s of summaries)
  for (const m of s.matchAll(/<span class="([\w -]+)"/g))
    m[1].split(/\s+/).forEach(c => faceClasses.add(c));
if (faceClasses.size === 0)
  fail.push("no <span class=...> inside any <summary>: the card-face scan has drifted " +
            "from index.html");
for (const cls of [...faceClasses].sort()) {
  const d = decl(cls, "display");
  if (d === null)
    fail.push(`.${cls} rides on a card face inside <summary> but declares no display, ` +
              `so it stays inline and the card face collapses into one run of text`);
  else if (!SIZEABLE.test(d))
    fail.push(`.${cls} rides on a card face but has display: ${d}`);
}

// ---- 4. the segmented control styles its radio options, not just buttons ---
// The confounding controls are radio inputs styled to look like the effect-shape
// buttons. If only `.seg button` is styled they render as raw radios.
if (html.includes('id="conf-buttons"') && !/\.seg\s+input[^{}]*\{/.test(cssLive))
  fail.push(".seg carries radio options but style.css styles no .seg input; " +
            "they would render as unstyled radio buttons");

console.log("style contract: docs/style.css");
console.log(`  checked ${sized.size} percentage-sized class(es): ${[...sized].sort().join(", ")}`);
console.log(`  checked ${faceClasses.size} card-face class(es): ${[...faceClasses].sort().join(", ")}`);
fail.forEach(f => console.log("  FAIL  " + f));
console.log(fail.length ? `  => ${fail.length} FAILURES` : "  => PASS");
process.exit(fail.length ? 1 : 0);
