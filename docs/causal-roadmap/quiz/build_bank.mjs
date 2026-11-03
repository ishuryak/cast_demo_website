// Builds quiz/bank.json from a question draft plus the primer's reference list.
//   node docs/causal-roadmap/quiz/build_bank.mjs DRAFT.json
// The references are read from ../index.html, so a renumbered or edited primer
// reference shows up here (and tests/test_causal_roadmap_quiz.mjs fails if
// bank.json is stale). Exits 1 without writing if the draft breaks a rule.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBank, GLOSSARY, primerRefs } from "./bank_rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const draft = JSON.parse(readFileSync(process.argv[2], "utf8"));
const refs = primerRefs(readFileSync(join(here, "..", "index.html"), "utf8"));
const used = [...new Set(draft.questions.flatMap((q) => q.refs))].sort((a, b) => a - b);
const text = draft.questions.map((q) => [q.stem, ...q.choices, q.explanation].join(" ")).join(" ");
const bank = {
  title: "Causal Roadmap Self-Test",
  questions: draft.questions.map(({ id, topic, section, stem, choices, answer, explanation, refs: r, evidence }) =>
    ({ id, topic, section, stem, choices, answer, explanation, refs: r, evidence })),
  refs: used.map((n) => refs.find((r) => r.n === n)).filter(Boolean),
  glossary: GLOSSARY.filter(([a]) => new RegExp(`(^|[^A-Za-z])${a}([^A-Za-z]|$)`).test(text)),
};
const { errors, stats } = validateBank(bank, refs);
console.log(stats);
if (errors.length) {
  errors.forEach((e) => console.log("ERROR", e));
  process.exit(1);
}
writeFileSync(join(here, "bank.json"), JSON.stringify(bank, null, 1) + "\n");
console.log(`wrote bank.json: ${bank.questions.length} questions, ${bank.refs.length} references, ${bank.glossary.length} abbreviations`);
