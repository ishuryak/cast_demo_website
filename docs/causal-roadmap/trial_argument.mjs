// Turns the results of a retrospective causal analysis into a CONDITIONAL
// argument about a new randomized trial (section 10 of the primer). It says what
// the retrospective evidence contributes and what it cannot settle. It is a
// teaching aid, not a trial-approval or value-of-information tool.
// Pure function, so it is tested in Node (tests/test_causal_roadmap_primer.mjs).
//
// Inputs (each a string). "Thresholds" are the clinically meaningful benefit and
// harm values the team prespecified for the primary estimand.
//   aim:     "superiority" | "noninferiority"    is the new schedule meant to be better,
//                                                 or as good with other advantages?
//   prior:   "none" | "conclusive" | "inconclusive" | "excludes"
//            conclusive = a precise, credible randomized trial of the SAME question
//            (population, strategies, endpoint, horizon); inconclusive = imprecise,
//            or a different endpoint or horizon; excludes = it left out patients like these
//   bench:   "na" | "yes" | "no"                  did the emulation reproduce a related trial?
//   ci:      "clear_benefit" | "benefit_or_none" | "both" | "negligible" | "harm_or_none" | "clear_harm"
//            the 95% interval against the benefit threshold B > 0 and harm threshold H < 0
//            (for noninferiority, H is minus the margin). See classifyInterval().
//   bias:    "unknown" | "within" | "crosses"     under a plausible, stated range of unmeasured
//            confounding, does the estimate stay on the same side of the thresholds?
//   support: "full" | "restricted"               overlap for the whole target, or only part of it
//   hte:     "no" | "yes"                         effect seemed to differ between prespecified groups

export const OPTIONS = {
  aim: ["superiority", "noninferiority"],
  prior: ["none", "conclusive", "inconclusive", "excludes"],
  bench: ["na", "yes", "no"],
  ci: ["clear_benefit", "benefit_or_none", "both", "negligible", "harm_or_none", "clear_harm"],
  bias: ["unknown", "within", "crosses"],
  support: ["full", "restricted"],
  hte: ["no", "yes"],
};

// Plain-language reading of each interval pattern, used in every output.
export const CI_TEXT = {
  clear_benefit: "the whole interval lies beyond the meaningful-benefit threshold",
  benefit_or_none: "the interval reaches a meaningful benefit but also smaller effects, and excludes meaningful harm",
  both: "the interval includes both a meaningful benefit and a meaningful harm",
  negligible: "the whole interval lies between the two thresholds, so neither a meaningful benefit nor a meaningful harm is supported",
  harm_or_none: "the interval reaches a meaningful harm but also smaller effects, and excludes meaningful benefit",
  clear_harm: "the whole interval lies beyond the meaningful-harm threshold",
};

// Which pattern a numeric interval (lo, hi) falls in, given thresholds
// harm < 0 < benefit. Every interval maps to exactly one pattern.
export function classifyInterval(lo, hi, harm, benefit) {
  if (!(lo <= hi) || !(harm < 0 && benefit > 0)) throw new Error("classifyInterval: need lo <= hi and harm < 0 < benefit");
  if (lo >= benefit) return "clear_benefit";
  if (hi <= harm) return "clear_harm";
  const reachesBenefit = hi >= benefit, reachesHarm = lo <= harm;
  if (reachesBenefit && reachesHarm) return "both";
  if (reachesBenefit) return "benefit_or_none";
  if (reachesHarm) return "harm_or_none";
  return "negligible";
}

export const LEANS = {
  duplicate: "A duplicate trial of the same question is likely a low priority",
  investigate: "Explain the disagreement with the related trial before leaning on this estimate",
  notready: "Not ready to weigh the estimate: run the bias analysis first",
  consider: "The evidence supports considering a randomized trial",
  hypothesis: "A strong hypothesis for a confirmatory or pragmatic trial",
  harm: "A harm signal: examine it before any trial of the new schedule",
  lowpriority: "A superiority trial on this endpoint is likely a low priority",
  nobenefit: "A superiority trial is likely a low priority: meaningful benefit is excluded, but harm is not",
  inconclusive: "Inconclusive: hidden bias could hide a benefit or a harm",
  ni_consider: "Supports considering a noninferiority trial",
  ni_doubt: "A loss of efficacy looks likely: a noninferiority trial is hard to justify as it stands",
};

const cap = (t) => t[0].toUpperCase() + t.slice(1);

export function trialArgument(a) {
  for (const [k, vals] of Object.entries(OPTIONS)) {
    if (!vals.includes(a[k])) throw new Error(`trialArgument: bad value for ${k}: ${a[k]}`);
  }
  const supports = [], cannot = [], open = [];
  const ni = a.aim === "noninferiority";
  const pop = a.support === "restricted" ? "the supported (overlap) population" : "the target population";
  const harmSide = a.ci === "clear_harm" || a.ci === "harm_or_none";
  let key;

  if (a.prior === "conclusive" && a.bench !== "no") {
    key = "duplicate";
    supports.push("A precise, credible randomized trial has already answered this same question, for the same population, strategies, endpoint and horizon. A second trial of exactly that question adds little.");
    if (a.bench === "yes") supports.push("Your emulation reproduces that trial, which adds confidence that its result holds in routine practice.");
    cannot.push("Your estimate cannot overturn that trial. Where they differ, the reasons (population, era, treatment versions) are what to study next.");
  } else if (a.bench === "no") {
    key = "investigate";
    cannot.push("Your emulation disagreed with a related trial, so its estimate should carry little weight until the reason is found. Check eligibility, time zero, classification by prescription, censoring and the confounders adjusted for.");
    if (a.prior === "conclusive") {
      supports.push("A precise, credible trial already answered this question. The disagreement most likely points to a problem in the emulation or to a real difference in patients. Find it before using this estimate. A new trial is justified only if that difference defines a new question.");
    } else {
      supports.push("A trial may still be justified on independent grounds. If the disagreement traces to a real difference in patients or timing, as time since menopause did for hormone therapy, that difference can itself be the question for a new trial.");
    }
  } else if (a.bias === "unknown") {
    key = "notready";
    cannot.push(`Without a bias analysis you cannot say whether ${CI_TEXT[a.ci]} because of the treatment or because of what was not measured.`);
    open.push("State a plausible range of unmeasured confounding, with reasons, and check whether the estimate stays on the same side of your thresholds across that range.");
  } else if (!ni) {
    if (a.ci === "both" || a.ci === "benefit_or_none") {
      key = "consider";
      supports.push(`For ${pop}, ${CI_TEXT[a.ci]}. Clinicians have good reason to be uncertain, which is the situation randomization exists to resolve.`);
      if (a.bias === "crosses") supports.push("Plausible hidden confounding could also move the estimate across a threshold, which adds to the case.");
    } else if (a.ci === "clear_benefit" && a.bias === "crosses") {
      key = "consider";
      supports.push("The effect looks clear, but plausible unmeasured confounding could explain it away. No further analysis of the same data can settle that. Randomization can.");
    } else if (a.ci === "clear_benefit") {
      key = "hypothesis";
      supports.push("The effect is clear and stays beyond no effect across the plausible bias range. Encouraging nonrandomized evidence is still a reason to test, not a substitute for testing, as RTOG 0617 showed for dose escalation.");
      open.push("Whether a confirmatory trial is still needed depends on whether clinicians remain uncertain. A robust result may be enough for some individual decisions and not for a change in guidelines.");
    } else if (a.ci === "harm_or_none" && a.bias === "within") {
      key = "nobenefit";
      supports.push(`For ${pop}, ${CI_TEXT[a.ci]}, across the plausible bias range. A superiority trial would be looking for a benefit the data already exclude.`);
      open.push("If the new schedule has other advantages, a noninferiority question would first have to rule out the possible harm, with a margin set in advance.");
    } else if (harmSide) {
      key = a.bias === "within" && a.ci === "clear_harm" ? "harm" : "inconclusive";
      if (key === "harm") {
        supports.push("The new schedule looks harmful, and the harm survives the plausible bias range. Randomizing patients to it may no longer be acceptable. Report the finding and examine it for errors in design or data before anyone proposes a trial.");
      } else {
        supports.push(`${cap(CI_TEXT[a.ci])}. A superiority trial is hard to justify on these data. If the new schedule has other advantages, ask instead whether a noninferiority question fits.`);
        if (a.bias === "crosses") cannot.push("Plausible hidden confounding could move the estimate across a threshold in either direction.");
      }
    } else if (a.ci === "negligible" && a.bias === "within") {
      key = "lowpriority";
      supports.push(`For ${pop}, effects large enough to matter on this endpoint are excluded across the plausible bias range, so a superiority trial of this comparison on this endpoint is unlikely to find a meaningful difference.`);
      open.push("This does not show the schedules are equivalent for other outcomes. If the shorter schedule reduces burden, toxicity, cost or travel, a noninferiority question on the right endpoint may still be worth asking.");
    } else {
      key = "inconclusive";
      cannot.push("The estimate looks negligible, but plausible confounding could be hiding a meaningful benefit or harm. If frailer patients were steered toward the schedule that helps, a real benefit can look like no effect.");
      open.push("A trial is worth considering only if a meaningful effect remains clinically plausible and the stakes are high.");
    }
  } else {
    // Noninferiority: preserving efficacy while gaining other advantages.
    cannot.push("Similar observational survival does not establish noninferiority. That needs a randomized trial with a prespecified endpoint and a justified margin.");
    if (a.ci === "clear_harm" && a.bias === "within") {
      key = "ni_doubt";
      supports.push("The shorter schedule looks worse, beyond the plausible bias range. A noninferiority trial would be testing a schedule the data already count against. Examine the finding first.");
    } else if (harmSide || a.ci === "both" || a.bias === "crosses") {
      key = "ni_consider";
      supports.push(`For ${pop}, ${CI_TEXT[a.ci]}${a.bias === "crosses" ? ", and plausible confounding could move the estimate across a threshold" : ""}. A loss of efficacy cannot be ruled out from these data. A noninferiority trial is the way to settle it, provided clinicians are uncertain and the other advantages are real.`);
    } else {
      key = "ni_consider";
      supports.push(`For ${pop}, ${CI_TEXT[a.ci]}, across the plausible bias range. That is compatible with noninferiority and makes a noninferiority trial a reasonable proposal, with the margin set before seeing its data.`);
    }
  }

  const extras = [];
  if (a.prior === "inconclusive") extras.push("An earlier trial exists but does not settle this question (imprecise, or a different endpoint or horizon). Say exactly what it left open. Your analysis can inform the next trial's design, not replace it.");
  const against = ["duplicate", "lowpriority", "nobenefit", "harm", "ni_doubt"].includes(key);
  if (a.prior === "excludes") {
    extras.push(against
      ? `The earlier trial excluded patients like these, and your analysis is about them. ${key === "harm" || key === "ni_doubt" ? "It flags a possible harm in them" : "It argues against a new trial of this comparison in them"}, so report it as evidence for that group rather than as a case for a trial.`
      : "The earlier trial excluded patients like these, and your analysis speaks to exactly those patients. That can support a trial in them. Patients the trial excluded outright had no chance of enrolling, so extending its result to them is an extrapolation that rests on modeling assumptions, not a transport of the trial's evidence (section 9).");
  }
  if (a.bench === "na" && a.prior !== "none") extras.push("You have not yet checked your emulation against the existing trial. Running the same pipeline in the patients that trial would have enrolled, and comparing, is the most persuasive check available.");
  if (a.support === "restricted") extras.push("Your estimate applies only to the patients with overlap. It says nothing about patients who almost always received one schedule (positivity, section 5). A trial in them is a separate question with its own justification, not a conclusion of this analysis.");
  if (a.hte === "yes") extras.push("The effect seemed to differ between prespecified groups. Treat that as a hypothesis for stratified randomization or an enriched trial, not as a finding.");

  const proposing = !against && !(key === "investigate" && a.prior === "conclusive");
  const design = proposing ? [
    "Protocol: eligibility, fully specified strategies (total dose, fraction size and number), time zero and follow-up from your target trial (section 2).",
    ni ? "Primary endpoint and noninferiority margin, both prespecified and clinically justified." : "Primary endpoint at a prespecified horizon, for example an RMST difference (section 4).",
    "Sample size: from a clinically relevant target effect or margin, with scenario assumptions for control-arm survival, accrual, censoring and feasibility. Your interval reflects sampling error only, not bias, so it is one input, not the plan.",
    "Stratification: the strongest prognostic factors and any prespecified effect modifier, plus a prespecified covariate-adjusted analysis (section 9).",
  ] : [];
  return { key, lean: LEANS[key], supports, cannot, open, extras, design };
}
