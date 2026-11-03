// Turns the results of a retrospective causal analysis into an argument for or
// against a new randomized trial (section 10 of the primer). Pure function, so it
// is tested in Node (tests/test_causal_roadmap_primer.mjs).
//
// Inputs (each a string):
//   prior:  "none" | "transports" | "excludes"   existing randomized evidence
//   bench:  "yes" | "no" | "na"                 emulation reproduced a related trial?
//   ci:     "benefit" | "both" | "null"          what the 95% interval includes
//   robust: "robust" | "fragile" | "unknown"     sensitivity to unmeasured confounding
//   gaps:   "yes" | "no"                         patient groups with only one schedule
//   hte:    "yes" | "no"                         effect differs between prespecified groups

export const OPTIONS = {
  prior: ["none", "transports", "excludes"],
  bench: ["yes", "no", "na"],
  ci: ["benefit", "both", "null"],
  robust: ["robust", "fragile", "unknown"],
  gaps: ["yes", "no"],
  hte: ["yes", "no"],
};

const VERDICTS = {
  existing: "A new trial of the same comparison is hard to justify",
  disagree: "Resolve the disagreement with the existing trial first",
  uncertain: "A new trial is justified: the evidence is genuinely uncertain",
  confounding: "A new trial is justified: the effect could be confounding",
  hypothesis: "A strong hypothesis for a confirmatory or pragmatic trial",
  lowpriority: "A trial of this exact comparison is a low priority",
  masked: "Inconclusive: a hidden factor could be masking an effect",
  notready: "Not ready to argue either way: finish the sensitivity analysis",
};

export function trialArgument(a) {
  for (const [k, vals] of Object.entries(OPTIONS)) {
    if (!vals.includes(a[k])) throw new Error(`trialArgument: bad value for ${k}: ${a[k]}`);
  }
  let key;
  const reasons = [];
  if (a.prior === "transports" && a.bench !== "no") {
    key = "existing";
    reasons.push("A randomized trial has already compared these strategies in patients like yours. Randomized evidence outranks an observational estimate, whatever that estimate shows.");
    if (a.bench === "yes") reasons.push("Your emulation reproduces the trial, which adds confidence that its result applies in routine practice.");
    if (a.ci === "both" || a.robust === "fragile") reasons.push("The uncertainty in your own estimate does not reopen the question. It reflects the limits of nonrandomized data.");
  } else if (a.bench === "no") {
    key = "disagree";
    reasons.push("Your emulation did not reproduce a related trial. Before arguing anything, check the design: eligibility, time zero, classification by prescription and the confounders adjusted for.");
    reasons.push("If the difference survives those checks and traces to a real difference in patients or timing, as time since menopause did for hormone therapy, that difference is itself a question for a new trial.");
  } else if (a.ci === "both") {
    key = "uncertain";
    reasons.push("The interval includes both a clinically meaningful benefit and a meaningful harm, so clinicians have good reason to be uncertain. That is the situation a randomized trial exists to resolve.");
    reasons.push("The interval also gives the range of plausible effects to use in the trial's sample-size calculation.");
  } else if (a.robust === "unknown") {
    key = "notready";
    reasons.push("Whether the result could be explained by something you did not measure decides the argument. Run the sensitivity analysis of step 8 before taking a position.");
  } else if (a.ci === "benefit" && a.robust === "fragile") {
    key = "confounding";
    reasons.push("An unmeasured factor no stronger than ones you did measure could explain the effect away. No further analysis of the same data can settle that. Randomization can.");
    reasons.push("Name the factor you could not measure. It is the strongest single sentence in the case for the trial.");
  } else if (a.ci === "benefit") {
    key = "hypothesis";
    reasons.push("The effect is clear and survives the sensitivity analysis. Encouraging nonrandomized evidence is still a reason to run a trial rather than a substitute for one, as RTOG 0617 showed for dose escalation.");
    reasons.push("Whether a trial is still needed depends on whether clinicians remain uncertain. A robust result may be enough for some individual decisions and not for a change in guidelines.");
  } else if (a.robust === "robust") {
    key = "lowpriority";
    reasons.push("The interval excludes a meaningful effect and the result survives the sensitivity analysis, so a trial of this comparison is unlikely to find a meaningful benefit.");
    reasons.push("That is a useful result too: it can redirect effort toward a comparison with more promise.");
  } else {
    key = "masked";
    reasons.push("Confounding can hide an effect as well as create one. If frailer patients were steered toward the schedule that helps, a real benefit can look like no effect.");
    reasons.push("A trial is justified only if a meaningful effect remains clinically plausible and the stakes are high.");
  }
  const extras = [];
  if (a.prior === "excludes" && key !== "existing") extras.push("The existing trial excluded patients like yours. Your analysis addresses exactly the patients it left out. Argue either for a trial in them, or for extending the trial result to them with the methods of section 9, if the factors that modify the effect were measured in both data sets.");
  if (a.bench === "na" && a.prior !== "none") extras.push("You have not yet checked your emulation against the existing trial. Doing so is the most persuasive check available to you: run the same pipeline in the patients the trial would have enrolled and compare.");
  if (a.gaps === "yes") extras.push("Some patient groups almost always received one schedule, so the data say nothing about the other schedule in them (positivity). If they matter clinically, put them in the trial's eligibility rather than excluding them.");
  if (a.hte === "yes") extras.push("The effect seemed to differ between prespecified groups. Treat that as a hypothesis for stratified randomization or an enriched trial, not as a finding.");
  const design = key === "existing" || key === "lowpriority" ? [] : [
    "Protocol: eligibility, strategies, time zero and follow-up from your target trial (step 2).",
    "Primary endpoint: RMST difference at a prespecified horizon (step 4).",
    "Sample size: a range of plausible effects from your interval, not only the point estimate.",
    "Stratification: the strongest prognostic factors, plus any prespecified effect modifier, and a prespecified covariate-adjusted analysis (section 9).",
  ];
  return { key, verdict: VERDICTS[key], reasons, extras, design };
}
