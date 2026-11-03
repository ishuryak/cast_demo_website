// Tests for the causal roadmap self-test (docs/causal-roadmap/quiz/).
//   node tests/test_causal_roadmap_quiz.mjs
// Exits 1 on any failure. Quote-level checks against the full-text sources run
// outside the repository (causal_roadmap_primer_tools/check_quiz_evidence.py),
// because the sources are under copyright and are not committed.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBank, primerRefs, SECTIONS } from "../docs/causal-roadmap/quiz/bank_rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "docs", "causal-roadmap");
let fails = 0, passes = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passes++; console.log(`PASS ${name}`); } else { fails++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`); }
};

const bank = JSON.parse(readFileSync(join(dir, "quiz", "bank.json"), "utf8"));
const primerHtml = readFileSync(join(dir, "index.html"), "utf8");
const quizHtml = readFileSync(join(dir, "quiz", "index.html"), "utf8");
const quizJs = readFileSync(join(dir, "quiz", "quiz.js"), "utf8");
const refs = primerRefs(primerHtml);

const { errors, stats } = validateBank(bank, refs);
check("bank: passes every rule (30 items, 5 unique choices, balance, style, glossary, all sections covered)", errors.length === 0, errors.join(" | "));
check("bank: the keyed answer is uniquely longest in at most 7 items", stats.longest <= 7, String(stats.longest));

// The references shown by the quiz must be the primer's current ones, word for word.
const stale = bank.refs.filter((r) => { const p = refs.find((x) => x.n === r.n); return !p || p.citation !== r.citation || p.url !== r.url; });
check("bank: references match the primer's current list (rebuild with build_bank.mjs if not)", stale.length === 0, stale.map((r) => r.n).join(","));
const used = new Set(bank.questions.flatMap((q) => q.refs));
check("bank: citations hold plain text, with no HTML entities to be escaped twice", bank.refs.every((r) => !/&[a-z#0-9]+;/i.test(r.citation)), bank.refs.filter((r) => /&[a-z#0-9]+;/i.test(r.citation)).map((r) => r.n).join(","));
check("bank: every reference shown is cited by a question, and every cited one is shown",
  bank.refs.length === used.size && bank.refs.every((r) => used.has(r.n)));
check("bank: every evidence quote names a reference the question cites",
  bank.questions.every((q) => q.evidence.every((e) => q.refs.includes(e.ref) && e.quote.split(/\s+/).length >= 6)));

// Every section a question points to exists in the primer, and the report labels match the anchors.
check("bank: every section anchor exists in the primer", SECTIONS.every((id) => primerHtml.includes(`id="${id}"`)));
const jsSections = [...quizJs.matchAll(/^\s+"?([a-z-]+)"?: "\d+ · /gm)].map((m) => m[1]);
check("page: the quiz's section labels cover exactly the bank's sections", jsSections.join(",") === SECTIONS.join(","), jsSections.join(","));

// Glossary: every abbreviation listed is used, so the start page does not pad.
const text = bank.questions.map((q) => [q.stem, ...q.choices, q.explanation].join(" ")).join(" ");
check("bank: every glossary entry is used in some question", bank.glossary.every(([a]) => new RegExp(`(^|[^A-Za-z])${a}`).test(text)));

// Page contract.
check("page: no em dash in the quiz files", !/—/.test(quizHtml + quizJs));
check("page: the quiz links back to the primer", /href="\.\.\/"/.test(quizHtml));
const hosts = [...quizHtml.matchAll(/(?:href|src)="(https?:\/\/[^/"]+)/g)].map((m) => m[1]);
check("page: external hosts only fonts", hosts.every((h) => ["https://fonts.googleapis.com", "https://fonts.gstatic.com"].includes(h)), hosts.join(","));
check("page: user text is escaped before it reaches innerHTML", /esc\(q\.stem\)/.test(quizJs) && /esc\(t\)/.test(quizJs) && /esc\(q\.explanation\)/.test(quizJs));
// Keyboard and focus contract (F14). Source-level only: the behavior itself is
// driven in a browser by causal_roadmap_primer_tools/play_through.py.
check("page: no document-wide key handler (links and buttons keep native Enter)",
  !/(document|window)\.addEventListener\(\s*["']key/.test(quizJs));
check("page: shortcuts are scoped to the question region and skip composing, repeated or handled keys",
  /\$\("qregion"\)\.addEventListener\("keydown"/.test(quizJs) && /e\.isComposing/.test(quizJs) && /e\.repeat/.test(quizJs) && /e\.defaultPrevented/.test(quizJs));
check("page: Enter is handled only on an answer radio",
  /e\.key === "Enter"\)\s*\{[^}]*t\.type === "radio"/.test(quizJs));
check("page: question and result headings are focusable and focused",
  /id="qhead" tabindex="-1"/.test(quizJs) && /id="rhead" tabindex="-1"/.test(quizJs) && /focusHeading\("qhead"\)/.test(quizJs) && /focusHeading\("rhead"\)/.test(quizJs));
check("page: the answer group is named by the question", /<fieldset[^>]*aria-labelledby="qhead"/.test(quizJs));
check("page: a polite status region exists before any verdict is written",
  /id="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="status"/.test(quizHtml) && /announce\(/.test(quizJs));
check("page: a missing or invalid bank shows a message and keeps Start disabled",
  /id="loaderr"/.test(quizHtml) && /function fail\(/.test(quizJs) && /bankProblem\(data\)/.test(quizJs));
check("primer: links to the self-test", /href="quiz\/"/.test(primerHtml));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
