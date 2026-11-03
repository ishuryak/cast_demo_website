import { findGuardedTerms } from "../guard_terms.mjs";
// Rules every quiz bank must meet. Shared by build_bank.mjs and the tests, so
// the builder cannot write a bank the tests would reject.

export const SECTIONS = ["questions", "question", "trial", "dag", "estimand", "identify", "policies",
  "estimators", "checks", "rct", "trial-argument"];

// Abbreviations a reader may meet in the questions. Shown on the quiz start page.
export const GLOSSARY = [
  ["AIPW", "Augmented inverse probability of treatment weighting"],
  ["ATE", "Average treatment effect"],
  ["ATT", "Average treatment effect in the treated"],
  ["CAST", "Causal Analysis for Survival Trajectories"],
  ["CATE", "Conditional average treatment effect"],
  ["CHHiP", "Randomized trial of conventional versus hypofractionated radiotherapy for prostate cancer"],
  ["CI", "Confidence interval"],
  ["CSF", "Causal survival forest"],
  ["DAG", "Directed acyclic graph"],
  ["DML", "Double machine learning"],
  ["EHR", "Electronic health record"],
  ["FDA", "US Food and Drug Administration"],
  ["HR", "Hazard ratio"],
  ["IPTW", "Inverse probability of treatment weighting"],
  ["LMTP", "Longitudinal modified treatment policy"],
  ["NCDB", "National Cancer Database"],
  ["PATH", "Predictive Approaches to Treatment effect Heterogeneity statement"],
  ["RCT", "Randomized controlled trial"],
  ["RMST", "Restricted mean survival time"],
  ["RTOG", "Radiation Therapy Oncology Group"],
  ["SEER", "Surveillance, Epidemiology, and End Results program"],
  ["SHAP", "SHapley Additive exPlanations"],
  ["TMLE", "Targeted maximum likelihood estimation"],
  ["WHI", "Women's Health Initiative"],
];
// Capitalized tokens that are not abbreviations needing a gloss.
const NOT_ACRONYMS = new Set(["Gy", "II", "III", "IIIA", "IIIB", "US", "A", "B", "C", "D", "E", "I", "R2", "R²"]);

// Strip tags, then decode the few entities the primer's reference list uses, so
// the quiz (which escapes on output) never shows "&amp;amp;".
const plain = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const BANNED = ["Unpublished", "highlight", "underscore", "delve", "leverage", "pivotal", "crucial"];

export function primerRefs(html) {
  return [...html.matchAll(/<li id="ref-(\d+)">([\s\S]*?)<\/li>/g)].map((m) => {
    const body = m[2];
    const first = body.indexOf("<a ");
    const citation = plain(first >= 0 ? body.slice(0, first) : body).replace(/\s+/g, " ").trim();
    const url = (body.match(/href="([^"]+)"/) || [])[1] || "";
    return { n: +m[1], citation, url };
  });
}

export function validateBank(bank, primer) {
  const errors = [];
  const qs = bank.questions;
  const N = qs.length;
  if (N !== 30) errors.push(`${N} questions, expected 30`);
  const ids = qs.map((q) => q.id);
  if (new Set(ids).size !== N) errors.push("duplicate ids");
  if (new Set(qs.map((q) => plain(q.stem).trim().toLowerCase())).size !== N) errors.push("duplicate stems");
  const primerNums = new Set(primer.map((r) => r.n));
  let longest = 0, shortest = 0;
  const answerCounts = [0, 0, 0, 0, 0];
  for (const q of qs) {
    const c = q.choices || [];
    if (c.length !== 5 || new Set(c.map((x) => plain(x).trim().toLowerCase())).size !== 5) { errors.push(`${q.id}: needs 5 unique choices`); continue; }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 4) { errors.push(`${q.id}: answer out of range`); continue; }
    answerCounts[q.answer]++;
    if (!SECTIONS.includes(q.section)) errors.push(`${q.id}: unknown section ${q.section}`);
    if (!q.explanation || !q.refs?.length) errors.push(`${q.id}: missing explanation or refs`);
    for (const r of q.refs || []) if (!primerNums.has(r)) errors.push(`${q.id}: ref ${r} is not in the primer's reference list`);
    if (!q.evidence?.length) errors.push(`${q.id}: no evidence quote`);
    const lens = c.map((x) => plain(x).length);
    const a = lens[q.answer];
    if (a === Math.max(...lens) && lens.filter((x) => x === a).length === 1) longest++;
    if (a === Math.min(...lens) && lens.filter((x) => x === a).length === 1) shortest++;
    if (/all of the above|none of the above/i.test(c.join(" "))) errors.push(`${q.id}: all/none of the above`);
    const t = [q.topic, q.stem, ...c, q.explanation].join(" ");
    if (/—/.test(t)) errors.push(`${q.id}: em dash`);
    if (/[a-z0-9)]; [a-zA-Z]/.test(t)) errors.push(`${q.id}: semicolon in prose`);
    for (const b of BANNED) if (t.toLowerCase().includes(b.toLowerCase())) errors.push(`${q.id}: banned word or name "${b}"`);
    if (findGuardedTerms(t).length) errors.push(`${q.id}: contains a guarded name or number (see guard_terms.mjs)`);
    const glossed = new Set(GLOSSARY.map(([g]) => g));
    for (const m of t.matchAll(/\b[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/g)) {
      const tok = m[0].replace(/s$/, "");
      if (!glossed.has(tok) && !NOT_ACRONYMS.has(tok) && /^[A-Z0-9]+[a-z]?[A-Z0-9]*$/.test(tok)) errors.push(`${q.id}: abbreviation ${tok} is not in the glossary`);
    }
  }
  if (longest > 7) errors.push(`correct answer is uniquely longest in ${longest}/${N}`);
  if (shortest > 7) errors.push(`correct answer is uniquely shortest in ${shortest}/${N}`);
  if (Math.max(...answerCounts) > 10) errors.push(`answer positions unbalanced: ${answerCounts.join(",")}`);
  for (const id of SECTIONS) if (!qs.some((q) => q.section === id)) errors.push(`no question on primer section ${id}`);
  return { errors, stats: { longest, shortest, answerCounts: answerCounts.join(","), perSection: SECTIONS.map((s) => `${s}:${qs.filter((q) => q.section === s).length}`).join(" ") } };
}
