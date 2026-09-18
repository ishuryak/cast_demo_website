// Introduction contract: the page opens with something a non-specialist can read.
//
// The suite exists because of a defect no other suite could see. Every other
// check on this repository verifies that the numbers are right, that the code
// runs, and that the markup the CSS targets is present. All of them passed on a
// page whose first words were "the estimand is the RMST difference", which a
// clinician or a scientist from another field cannot use to decide whether the
// page is for them. Correctness and legibility are different properties, and
// only one of them had a test.
//
// Checks:
//   1. An introduction exists, and a reader meets it BEFORE the controls.
//   2. It answers the five questions it is there to answer: what the goal is,
//      who it helps, what goes in and what comes out, what the familiar methods
//      miss, and what each method on the figure is.
//   3. Every method drawn on the figure has a line in it. A method added to
//      app.js with no introduction line fails here.
//   4. It stays layman-readable: a blocklist of specialist terms that must not
//      appear in the introduction, and a word cap so it cannot grow into the
//      wall of text it replaced.
//   5. The technical lead was FOLDED, not deleted.
//
//   node tests/test_intro_contract.mjs

import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const html = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");

const fail = [];

// ---- 1. it exists, and it comes first --------------------------------------
const introAt = html.indexOf('<section class="intro"');
const controlsAt = html.indexOf('<section class="controls">');
if (introAt === -1)
  fail.push('no <section class="intro">: the page has no plain-language entry point');
else if (controlsAt !== -1 && introAt > controlsAt)
  fail.push("the introduction sits after the controls, so a reader meets the instrument first");

const introEnd = html.indexOf("</section>", html.indexOf('<div class="intro-methods">'));
const intro = introAt === -1 ? "" : html.slice(introAt, introEnd);
const text = intro.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")
                  .replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

// ---- 2. it answers the questions it is there to answer ----------------------
const blocks = [...intro.matchAll(/<div class="intro-block">[\s\S]*?<h3>([^<]+)<\/h3>/g)]
                  .map(m => m[1].toLowerCase());
if (blocks.length < 4)
  fail.push(`${blocks.length} intro blocks; the introduction is meant to cover the goal, ` +
            "the data and deliverable, what the familiar tools miss, and what none of them fix");
const QUESTIONS = [
  [/\bfor\b|\bgoal\b|\bpurpose\b/, "what the demo is for"],
  [/analyz|deliver|data/, "what data goes in and what comes out"],
  [/fall short|familiar|standard|limit/, "why the familiar tools fall short"],
  [/cannot fix|no method|can.?t fix/, "what no method can fix"]
];
for (const [re, what] of QUESTIONS)
  if (!blocks.some(b => re.test(b)))
    fail.push(`no introduction block answers: ${what}`);
if (!/<p class="intro-lead">/.test(intro))
  fail.push("no lead paragraph stating the problem in plain words");

// ---- 3. every method on the figure has a line in the introduction -----------
// Keyed off app.js so a method added to the plot cannot skip the introduction.
const NEEDLE = {
  naive: /naive/i, rsf: /s-learner/i, tlearner: /t-learner/i,
  coxate: /cox/i, csf: /causal survival forest/i, cast: /\bCAST\b/
};
const NOT_A_METHOD = new Set(["truth", "castci"]);
const plotted = [...js.matchAll(/\{ key: "(\w+)",/g)].map(m => m[1])
                  .filter(k => !NOT_A_METHOD.has(k));
const glossary = [...intro.matchAll(/<d[td]>([\s\S]*?)<\/d[td]>/g)].map(m => m[1]).join(" ");
for (const k of plotted) {
  if (!(k in NEEDLE)) {
    fail.push(`method "${k}" is drawn on the figure but this test has no needle for it; ` +
              "add one here and a line for it in the introduction");
  } else if (!NEEDLE[k].test(glossary)) {
    fail.push(`method "${k}" is drawn on the figure but has no line in the introduction glossary`);
  }
}

// ---- 4. it stays readable by a non-specialist -------------------------------
// Terms a clinician or a scientist in another field would have to look up. Each
// one has a plain-language equivalent used in the introduction instead; they are
// all still available further down the page, where a reader has opted in.
const JARGON = [
  "estimand", "orthogonal", "influence function", "positivity", "propensity",
  "RMST", "restricted mean", "Ledoit", "shrinkage", "covariance", "asymptotic",
  "doubly robust", "nuisance", "cross-fitting", "cross-fit", "honest splitting",
  "E-value", "standardized mean difference", "SMD", "quadratic", "sandwich",
  "heteroscedastic", "counterfactual", "ATE", "CATE", "P(T", "γ", "Γ", "Σ"
];
for (const term of JARGON) {
  // An acronym is matched case-sensitively and on word boundaries: a plain
  // case-insensitive substring search for "ATE" fires on "treated", which is how
  // this suite first failed against a page that did not contain the term.
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const acronym = term === term.toUpperCase() && /[A-Z]/.test(term);
  const re = acronym
    ? new RegExp("\\b" + esc + (/\w$/.test(term) ? "\\b" : ""))
    : new RegExp(esc, "i");
  if (re.test(text))
    fail.push(`the introduction uses "${term}", which a non-specialist reader would ` +
              "have to look up; say it in words here and keep the term for the cards below");
}
// "confounding" is the one specialist word the introduction cannot avoid, so it
// has to be defined where it first appears rather than assumed.
const leadM = intro.match(/<p class="intro-lead">([\s\S]*?)<\/p>/);
const firstConfound = text.search(/confound/i);
if (firstConfound !== -1) {
  const lead = leadM ? leadM[1].replace(/<[^>]+>/g, " ") : "";
  if (!/confound/i.test(lead))
    fail.push('"confounding" first appears outside the lead paragraph, so it is used ' +
              "before it is explained");
}
const words = text.split(/\s+/).length;
if (words > 900)
  fail.push(`the introduction runs to ${words} words; it is an entry point, not a chapter`);
if (words < 250)
  fail.push(`the introduction runs to only ${words} words; it cannot answer five questions`);

// ---- 5. the technical lead was folded, not deleted --------------------------
if (!/<details class="lead-detail">/.test(html))
  fail.push("no <details class=\"lead-detail\">: the technical lead is not on the page");
else {
  const fold = html.slice(html.indexOf('<details class="lead-detail">'));
  if (!/<summary>[^<]+<\/summary>/.test(fold))
    fail.push("the folded technical lead has no summary to click");
  if (!fold.includes("survival-probability"))
    fail.push("the folded block does not contain the formal statement of the estimand, " +
              "so the precision was dropped rather than moved");
}

console.log("intro contract: docs/index.html");
console.log(`  ${words} words, ${blocks.length} blocks, ${plotted.length} plotted methods checked`);
fail.forEach(f => console.log("  FAIL  " + f));
console.log(fail.length ? `  => ${fail.length} FAILURES` : "  => PASS");
process.exit(fail.length ? 1 : 0);
