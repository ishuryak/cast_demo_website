// Build docs/tutorial_v3/: the illustrated walkthrough with a clinical layer.
//
// v3 is the published walkthrough (docs/tutorial/) unchanged in structure,
// styling, artwork and data, plus a clinician reading path and short
// "In the clinic" asides. It is generated, not hand-edited, so it cannot drift
// from the walkthrough: every insertion is anchored to an exact string in
// docs/tutorial/index.html, and a missing anchor stops the build.
import {cp,lstat,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const docs=path.resolve(root,'docs');
const source=path.resolve(docs,'tutorial');
const output=path.resolve(docs,'tutorial_v3');
const existing=await lstat(output).catch(error=>{
  if(error.code==='ENOENT')return null;
  throw error;
});
// Replace only the generated clinical edition; never the walkthrough or root page.
if(path.dirname(output)!==docs||path.basename(output)!=='tutorial_v3'||
   (await lstat(docs)).isSymbolicLink()||existing?.isSymbolicLink()){
  throw new Error('Unsafe GitHub Pages output directory.');
}
await rm(output,{recursive:true,force:true});
await cp(source,output,{recursive:true});

const clinic=(id,title,body)=>`<aside class="clinic-note" id="${id}" aria-label="In the clinic: ${title}"><p class="eyebrow">In the clinic</p><h3>${title}</h3>${body}</aside>`;

const edits=[
  ['<title>One person, two possible paths · CAST and the causal roadmap</title>',
   '<title>One person, two possible paths · A clinical reading of CAST</title>'],
  ['<meta name="description" content="Begin with Hector’s missing counterfactual,',
   '<meta name="description" content="A clinical edition for oncologists. Begin with Hector’s missing counterfactual,'],
  ['<link rel="stylesheet" href="narrative.css">',
   '<link rel="stylesheet" href="narrative.css">\n  <link rel="stylesheet" href="clinical.css">'],
  ['<span class="edition">Causal Analysis for Survival <span class="trajectory-accent">Trajectories</span></span>',
   '<span class="edition">Causal Analysis for Survival <span class="trajectory-accent">Trajectories</span> · clinical edition</span>'],
  ['<a class="text-link" href="#question">Take a snapshot <span aria-hidden="true">↓</span></a></div>',
   '<a class="text-link" href="#question">Take a snapshot <span aria-hidden="true">↓</span></a>'+
   '<p class="clinic-dek">This edition reads the walkthrough as an oncologist would. At the bedside the choice is rarely treatment against nothing. It is one active option against another, and the record of who received which option is shaped by who looked fit enough for it.</p></div>'],
  ['<button type="button" data-reader-path="student"',
   '<button type="button" data-reader-path="clinician" aria-pressed="false" aria-controls="path-clinician">Clinician or oncologist</button>\n        <button type="button" data-reader-path="student"'],
  ['<div class="reader-itinerary" id="path-student" hidden>',
   '<div class="reader-itinerary" id="path-clinician" hidden>\n'+
   '        <div><h3>Start with the choice you actually make.</h3><p>Read the question as two active options, see why the registry alone cannot settle it, then read the survival difference over follow-up.</p></div>\n'+
   '        <ol aria-label="Clinician path"><li><a href="#clinic-options">Two active options, not treatment against nothing</a></li><li><a href="#clinic-indication">Why fitter patients get the intensive option</a></li><li><a href="#clinic-curve">Read the curve at the horizon your patient cares about</a></li></ol>\n'+
   '      </div>\n      <div class="reader-itinerary" id="path-student" hidden>'],
  ['<noscript><nav class="reader-fallback" aria-label="Choose a starting point"><a href="#question">',
   '<noscript><nav class="reader-fallback" aria-label="Choose a starting point"><a href="#clinic-options">Clinician or oncologist: start with the choice you actually make</a><a href="#question">'],
  // 01: the contrast, stated as a clinician states it.
  ['<p>A difference of +10 percentage points means survival is 10 points more likely under treatment at that time. It does not tell us which people benefited.</p>',
   '<p>A difference of +10 percentage points means survival is 10 points more likely under treatment at that time. It does not tell us which people benefited.</p>\n    '+
   clinic('clinic-options','Two active options, not treatment against nothing',
     '<p>Outside a placebo-controlled trial, oncology rarely compares a treatment with nothing. It compares one defensible plan with another, for example concurrent chemoradiation with radiation alone, or a shorter hypofractionated course with a longer conventional one. Read “treatment” here as the more intensive option and “control” as the standard option. Nothing in the method requires either arm to be untreated.</p>'+
     '<p>On that reading, +10 percentage points at five years means that of 100 patients given the intensive option, about 10 more would be alive at five years than if the same 100 had received the standard option. Equivalently, about 10 patients would need the intensive option for one additional survivor at that time.</p>')],
  // Worked example: confounding by indication.
  ['<p>In this simulation, healthier people are more likely to receive treatment when confounding is present. They also tend to survive longer. A direct comparison can mistake some of that advantage for a treatment effect.</p>',
   '<p>In this simulation, healthier people are more likely to receive treatment when confounding is present. They also tend to survive longer. A direct comparison can mistake some of that advantage for a treatment effect.</p>\n    '+
   clinic('clinic-indication','Confounding by indication',
     '<p>This is the familiar pattern of confounding by indication. The more intensive option tends to go to patients judged fit enough to tolerate it: younger, with better performance status and fewer comorbidities. Those patients would likely have lived longer on either option, so the raw survival gap between arms mixes the effect of the option with the head start of the people who received it.</p>'+
     '<p>Adjustment can only remove the part of that head start the record captured. What the clinician saw but the registry did not, such as frailty noticed in clinic or a patient’s preference, stays in the comparison. The “Hidden confounding” setting under Data &amp; settings below shows what that does to every estimate.</p>')],
  // 03: reading the curve.
  ['<details data-technical id="data-table">',
   clinic('clinic-curve','Read the curve at the horizon your patient cares about',
     '<p>The “early benefit, later reversal” pattern has a clinical counterpart: an intensified regimen can buy early disease control and cost late treatment-related deaths, for example cardiac or pulmonary. The survival curves then cross, and a single hazard ratio averages an early gain against a late loss into something close to “no difference”, which is wrong at every individual time point.</p>'+
     '<p>Choose the horizon that matters for the decision in front of you and read the difference there. The shaded band is pointwise, so it describes each time on its own, not the whole curve at once. A peak in the fitted curve describes the curve and is not a recommended time to stop or switch treatment. All of these patients are simulated, and no real regimen is being compared.</p>')+
   '\n      <details data-technical id="data-table">'],
  // 04: heterogeneity.
  ['<div class="section-lead profile-close"><p>A fuller analysis would estimate',
   clinic('clinic-whom','The patient in front of you',
     '<p>A cohort average answers a policy question: what happens if patients like these receive one option rather than the other. It does not say whether this particular patient will benefit. Differences across recognized subgroups, for example by age, comorbidity or tumor biology, need to be specified in advance and need enough patients in each subgroup to estimate them with useful precision.</p>')+
   '\n    <div class="section-lead profile-close"><p>A fuller analysis would estimate'],
  // 05: can the registry answer it?
  ['<p>The <a href="https://doi.org/10.1097/EDE.0000000000000078">causal roadmap</a>',
   clinic('clinic-registry','Can a registry answer it?',
     '<p>Before trusting an adjusted comparison, ask three questions of the data. Were the characteristics that drove the choice recorded before the decision was made? Could a patient of each type plausibly have received either option, or did one type always get the same one? Is follow-up long enough to reach the horizon that matters, with censoring unrelated to prognosis? If any answer is no, a more flexible estimator will not repair it.</p>'+
     '<p>For the same simulated cohorts framed as Option A against Option B, with every estimate beside the known truth, see the <a href="../tutorial_v2/">oncology version of this demo</a>.</p>')+
   '\n    <p>The <a href="https://doi.org/10.1097/EDE.0000000000000078">causal roadmap</a>'],
  ['<li><a href="https://github.com/ishuryak/cast_demo_website">Igor Shuryak · CAST repository and R source</a>',
   '<li><a href="../tutorial_v2/">Oncology version · Option A or Option B?</a><span>The same simulated cohorts, framed as two active treatment options, with every method graded against the truth.</span></li><li><a href="https://github.com/ishuryak/cast_demo_website">Igor Shuryak · CAST repository and R source</a>'],
];

const page=path.join(output,'index.html');
let html=await readFile(page,'utf8');
for(const [anchor,replacement] of edits){
  const count=html.split(anchor).length-1;
  if(count!==1)throw new Error(`tutorial_v3: anchor found ${count} times (expected 1): ${anchor.slice(0,80)}`);
  html=html.replace(anchor,()=>replacement);
}
await writeFile(page,html);

await writeFile(path.join(output,'clinical.css'),
`/* Clinical edition only: the asides and the hero note. Everything else is the walkthrough's own style. */
.clinic-dek{font-size:15px;color:var(--muted);max-width:450px;margin-top:16px}
.clinic-note{border-left:2px solid var(--rust);background:#f6efe6;padding:18px 24px 20px;margin:28px 0;font-size:15px;line-height:1.65}
.clinic-note .eyebrow{color:var(--rust);margin-bottom:6px}
.clinic-note h3{font-family:var(--serif);font-weight:400;font-size:24px;line-height:1.2;letter-spacing:-.02em;margin:0 0 10px}
.clinic-note p{margin:0}.clinic-note p+p{margin-top:.8em}
.reading-wide>.clinic-note,#explore .clinic-note{max-width:780px}
@media(max-width:600px){.clinic-note{padding:16px 18px;font-size:14px}.clinic-note h3{font-size:21px}}
@media print{.clinic-note{background:white}}
`);
console.log('Built the clinical edition in docs/tutorial_v3/.');
