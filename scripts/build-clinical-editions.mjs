// Run after the base walkthrough and clinical notes have been staged.
import {cp,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {quietNarrative} from '../clinical/quiet-narrative.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'docs');
const read=p=>readFile(path.join(out,p),'utf8');
const save=(p,s)=>writeFile(path.join(out,p),s.replace(/[ \t]+$/gm,''));
function once(s,a,b){const n=s.split(a).length-1;if(n!==1)throw Error(`Expected one anchor (${n}): ${a.slice(0,90)}`);return s.replace(a,()=>b);}
const family=(active)=>`<nav class="edition-nav" aria-label="CAST tutorials"><a href="../tutorial/" ${active==='tutorial'?'aria-current="page"':''}>The illustrated story</a><a href="../tutorial_v2/" ${active==='tutorial_v2'?'aria-current="page"':''}>Compare two treatments</a><a href="../tutorial_v3/" ${active==='tutorial_v3'?'aria-current="page"':''}>The clinical walkthrough</a></nav>`;
for(const version of ['tutorial','tutorial_v3']){
  let html=await read(`${version}/index.html`);
  html=once(html,'</head>','<link rel="stylesheet" href="../clinical-theme.css">\n<script src="../clinical-navigation.js" defer></script>\n</head>');
  html=once(html,'</header>','</header>'+family(version));
  html=once(html,'<div class="reader-intro"><h2 id="reader-heading">How would you describe yourself?</h2><p>Choose a starting point. The whole story is yours to explore.</p></div>', '<details class="other-paths" open><summary id="reader-heading">Reading paths</summary>');
  const end='<noscript><nav class="reader-fallback"';
  const start=html.indexOf(end), close=html.indexOf('</noscript>',start)+11;
  if(start<0||close<11)throw Error('Reader fallback missing');
  html=html.slice(0,close)+'</details>'+html.slice(close);
  // Let Hector's illustration complete the opening thought before offering routes.
  const picker=html.match(/    <section class="reader-entry"[\s\S]*?    <\/section>/)?.[0];
  if(!picker)throw Error('Missing route section');
  html=once(html,picker,'');
  const heroEnd=html.indexOf('</figure>',html.indexOf('id="hero-art"'))+9;
  html=html.slice(0,heroEnd)+'\n'+picker+html.slice(heroEnd);
  if(version==='tutorial_v3'){
    html=html.replace(/<p class="clinic-dek">[\s\S]*?<\/p>/,'');
    const notes={
      'clinic-options':['Two active options',
        'The comparison can be between two active treatment plans. In the survival example, read “treatment” as Option A and “control” as Option B; either may be an active option.',
        'The opening Hector sketch illustrates treatment versus no treatment. The same counterfactual question applies to two active options: what would happen in the same target population under each plan? Define eligibility, both plans and the start of follow-up before making the comparison.',
        'A difference of +10 percentage points at five years means about 10 additional survivors per 100 in expectation under A versus B at that horizon. It does not identify which people benefit or imply a permanent survival gain.'],
      'clinic-indication':['Who receives which option?',
        'In this simulation, fitter patients are more likely to receive Option A and tend to live longer either way. The observed survival gap mixes treatment effects with differences present before treatment.',
        'This is one pattern of confounding by treatment selection. In other settings, the sickest patients may receive the more intensive option, so the direction of bias can reverse. A preference predicts confounding only if it is also related to the potential outcome, or is a proxy for such a cause.',
        'Adjustment relies on sufficient recorded baseline information and suitable methods. Open Data & settings and change Hidden confounding to see what happens when a shared cause of treatment choice and survival is omitted.'],
      'clinic-curve':['Read at a meaningful horizon',
        'Ask about survival at a follow-up time that matters for the clinical question. Read the estimated difference and its uncertainty together; a peak in this curve is not a time to stop or switch treatment.',
        'A single proportional-hazards summary can obscure changes over follow-up. Crossing survival curves do not force the fitted hazard ratio to equal one. This demo also shows survival differences standardized from a Cox model; its constant treatment coefficient cannot represent a reversal.',
        'Choose the principal horizon before inspecting the results, and show the surrounding trajectory. The displayed intervals are pointwise, not a simultaneous statement about the whole curve. These are simulated outcomes, with no real regimen being compared.'],
      'clinic-whom':['An average is not a personal forecast',
        'Even an average for patients with similar baseline characteristics cannot tell us whether this particular person benefits.',
        'Prespecify subgroup comparisons intended to support confirmatory claims. Exploratory heterogeneity analyses are also possible, with suitable separation of discovery and evaluation, uncertainty assessment and validation. This demo does not export clinical subgroup treatment effects.'],
      'clinic-registry':['What must the record support?',
        'Were key common causes of treatment choice and survival recorded before treatment? Were both options possible for comparable patients? Is follow-up adequate at the horizon we want to understand?',
        'Censoring may depend on recorded prognosis. What the analysis needs is a defensible assumption that, within treatment and the covariates used for adjustment, censoring carries no further information about survival, together with enough chance of remaining observed through the horizon.',
        'Also define the treatment plans, align eligibility and treatment assignment with time zero, and specify the population. An estimator cannot create missing treatment support or resolve unmeasured confounding without additional information or assumptions.']
    };
    for(const [id,[title,lead,...body]] of Object.entries(notes)){
      const re=new RegExp(`<aside class="clinic-note" id="${id}"[\\s\\S]*?<\\/aside>`);
      if(!re.test(html))throw Error(`Missing note ${id}`);
      html=html.replace(re,`<aside class="clinic-note" id="${id}" aria-label="In the clinic: ${title}"><p class="eyebrow">In the clinic</p><h3>${title}</h3><p>${lead}</p><details><summary>Read a little further</summary>${body.map(p=>`<p>${p}</p>`).join('')}</details></aside>`);
    }
    html=html.replace('Why fitter patients get the intensive option','How treatment selection shapes the comparison');
    html=html.replace('Two active options, not treatment against nothing','Compare two active options');
  }
  await save(`${version}/index.html`,quietNarrative(html,version));
  let app=await read(`${version}/app.mjs`);
  app=once(app,"$('interpretation').textContent=low<=0", "$('interpretation').textContent=state.unmeas>0?'Hidden confounding is active: this adjusted estimate should not be read as the causal effect.':low<=0");
  // Show the main result without a separate tour or required reveal sequence.
  app=once(app,'state=parseState(location.search,data);',"state=parseState(location.search,data);const initial=new URLSearchParams(location.search);if(!initial.has('fit'))state.fit=true;if(!initial.has('truth'))state.truth=true;");
  await save(`${version}/app.mjs`,app);
  const narrative=await read(`${version}/narrative.mjs`);
  await save(`${version}/narrative.mjs`,narrative);
}

for(const item of ['clinical-theme.css','narrative-figures.mjs','clinical-navigation.js'])await cp(path.join(root,'clinical',item),path.join(out,item));
for(const item of ['index.html','app.js'])await cp(path.join(root,'clinical/oncology',item),path.join(out,'tutorial_v2',item));
console.log('Built the reviewed clinical editions and shared narrative assets.');
