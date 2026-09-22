// Continuous reading layer shared by the published walkthroughs.
const exact=(text,from,to)=>{if(!text.includes(from))throw Error(`Missing narrative anchor: ${from.slice(0,70)}`);return text.replace(from,to);};
const phNote='<details class="story-depth"><summary>What proportional hazards assumes</summary><p>A proportional-hazards model with one constant treatment coefficient assumes a constant treatment hazard ratio. It can still produce a survival-probability difference that changes with time. What this fitted specification cannot reproduce is the reversal shown here: the same population’s survival under A starts above B and ends below it. Cox models with time-varying treatment effects can relax that restriction.</p><p><a href="https://search.r-project.org/CRAN/refmans/survival/html/cox.zph.html">The proportional-hazards assumption and its diagnostics ↗</a></p></details>';
export function quietNarrative(html,page){
  // Keep audience resources reachable without asking a new reader to choose a role.
  const picker=html.match(/    <section class="reader-entry"[\s\S]*?    <\/section>/)?.[0];
  if(picker){
    html=html.replace(picker,'');
    html=html.replace('</main>',`<details class="reading-resources"><summary>Reading paths and teaching resources</summary>${picker}</details></main>`);
  }
  html=html.replace(/<nav class="chapter-nav"[\s\S]*?<\/nav>/,'');
  if(page==='tutorial_v2')return comparisonStory(html);
  const opening=page==='tutorial_v3'
    ? 'Hector’s sketch begins with treatment versus none. The same missing-path problem follows a patient choosing between two active treatments: which is better, and for how long?'
    : 'Hector improves after treatment. To know what the treatment changed, we need the path he never took.';
  html=html.replace(/<div class="hero-opening">[\s\S]*?<\/div>/,`<div class="hero-opening"><p class="dek">${opening}</p></div>`);
  html=html.replace('<p class="opening-thesis">The central problem of causal inference...</p>','');
  if(page==='tutorial_v3')html=html.replace('One person.<br><em>Two possible paths.</em>','A choice now.<br><em>A changing answer.</em>');
  html=html.replace(/<p class="eyebrow">(?:0[1-5] \/|Our worked example \/)[\s\S]*?<\/p>/g,'');
  html=exact(html,'<h2>Who receives treatment matters.</h2>','<h2>The groups were different before treatment.</h2>');
  const selection='<p>In this simulation, healthier people are more likely to receive treatment when confounding is present. They also tend to survive longer. A direct comparison can mistake some of that advantage for a treatment effect.</p>';
  html=exact(html,selection,page==='tutorial_v3'?'':'<p>In the starting example, healthier people are more likely to receive treatment. They also tend to survive longer. A direct comparison can mistake some of that advantage for a treatment effect.</p>');
  if(page==='tutorial_v3'){
    const note=html.match(/<aside class="clinic-note" id="clinic-indication"[\s\S]*?<\/aside>/)?.[0];
    if(!note)throw Error('Missing indication note');
    html=html.replace(note,'').replace('<h2>The groups were different before treatment.</h2>','<h2>The groups were different before treatment.</h2>'+note);
  }
  html=html.replace(/<p>A <strong>causal survival forest \(CSF\)<\/strong>[\s\S]*?<\/p>/,'<p>We need to compare survival under both options for the <em>same</em> population. Adjusting for recorded differences helps address this problem. But even a well-adjusted comparison can impose the wrong shape on the answer.</p>');
  html=exact(html,'<h2 id="explore-title">Watch the average change.</h2>','<h2 id="explore-title">An early advantage can disappear.</h2>');
  html=html.replace(/<div class="cast-motivation" id="why-cast">[\s\S]*?(?=      <details id="snapshot-sketch")/,`<div class="cast-motivation" id="why-cast">
      <p>In the starting example below, treatment improves survival early on. Later, the true survival difference reverses. A Cox model with one constant treatment coefficient cannot describe both parts of that story.</p>
      <p>A <strong>causal survival forest (CSF)</strong> takes a different route: estimate the survival difference at each follow-up time, adjusting for recorded baseline characteristics and accounting for censoring. It does not require a constant treatment hazard ratio.</p>
      <p><strong>CAST</strong> connects those estimates with a curve, accounting for their shared uncertainty. The time pattern becomes easier to see, but a smooth curve can still miss features of the truth.</p>
      ${phNote}
`);
  // The distinction between a changing effect and changing treatment remains available.
  const time=html.match(/  <section class="reading section" id="longitudinal">[\s\S]*?  <\/section>/)?.[0];
  if(time){html=html.replace(time,'');html=exact(html,'  <section class="reading-wide section" id="for-whom">',`<details class="reading story-depth"><summary>What if treatment itself changes during follow-up?</summary>${time}</details>\n  <section class="reading-wide section" id="for-whom">`);}
  html=html.replace(/<p class="eyebrow">In the clinic<\/p>/g,'');
  html=html.replace('using the available history—for example, a specified dose reduction where supported.','using the available history, such as a specified dose reduction where supported.');
  const clinicalLabels={'clinic-options':'Defining the two plans','clinic-indication':'Treatment selection','clinic-curve':'Choosing a follow-up time','clinic-whom':'Subgroups and individuals','clinic-registry':'Censoring and time zero'};
  html=html.replace(/<aside class="clinic-note" id="([^"]+)"[\s\S]*?<\/aside>/g,(note,id)=>note.replace('<summary>Read a little further</summary>',`<summary>${clinicalLabels[id]}</summary>`));
  html=html.replace(/<div class="lesson-observation">[\s\S]*?<\/div>/,'<p class="result-caption" id="observation"></p>');
  const sketch=html.match(/<details id="snapshot-sketch">[\s\S]*?<\/details>/)?.[0];
  if(!sketch)throw Error('Missing snapshot sketch');
  html=html.replace(sketch,'').replace(phNote,'');
  html=exact(html,'<details data-technical id="data-table">',`${phNote}${sketch}<details data-technical id="data-table">`);
  const settings=html.match(/<div class="experiment-controls">[\s\S]*?<\/div>/)?.[0];
  const layers=html.match(/<div class="reveal-controls">[\s\S]*?<\/div>/)?.[0];
  if(settings&&layers){html=html.replace(settings,'').replace(layers,`<details class="chart-options"><summary>Change the example</summary>${settings}${layers}</details>`);}
  return html;
}
const figure=(id,caption)=>`<figure class="story-figure"><div class="narrative-plot" id="${id}" role="img" aria-label="${caption}"><p>Loading the figure…</p></div><figcaption>${caption}</figcaption></figure>`;
function comparisonStory(html){
  const comparisonPH=phNote.replace('</details>','<p>__STORY_PH__</p></details>');
  html=html.replace(/<a class="clinical-start"[\s\S]*?<\/a>/,'');
  html=html.replace('<p class="eyebrow">A clinical comparison · simulated patients</p>','');
  html=html.replace(/<p class="sub">Two active treatment options\.[\s\S]*?<\/p>/,'<p class="sub">Patients receiving A live longer. It looks like a better treatment. But the apparent advantage hides two different problems.</p>');
  html=html.replace(/<section class="intro" id="question">[\s\S]*?<\/section>/,`<article class="comparison-story" aria-label="The treatment comparison">
    <section id="question"><h2>A looks better.</h2><p>In this simulated cohort, patients receive one of two active treatment options, A or B. At every displayed follow-up time, survival is higher among those who received A.</p><p>The line shows that observed gap: the difference in survivors per 100 patients. It is tempting to read it as the benefit of treatment.</p>${figure('story-raw','The observed groups favor A at all five horizons. This comparison does not adjust for their baseline differences.')}</section>
    <section id="story-twist"><h2>But who received A?</h2><p>Fitter patients were more likely to receive A. They also tended to live longer either way. Part of the apparent advantage was there before treatment began.</p><p>Because these patients are simulated, we can ask what would happen if the <em>same population</em> received each option. The answer contains a second surprise: A improves early survival, but the survival difference later reverses.</p><h2>Time changes the answer.</h2><p>The adjusted Cox model below assumes a constant treatment hazard ratio. It adjusts for recorded patient characteristics, yet its single treatment coefficient cannot represent this reversal. Adjustment and flexibility solve different problems.</p>${figure('story-cox','Diamonds show the known survival difference for the same target population. The fitted constant-coefficient Cox model stays above zero.')}${comparisonPH}</section>
    <section id="story-resolution"><h2>Let the effect change with time.</h2><p>A <strong>causal survival forest</strong> estimates the difference at each selected horizon without requiring a constant treatment hazard ratio. It adjusts for recorded characteristics and accounts for censoring. Here, its estimates follow the rise and reversal more closely.</p><p><strong>CAST</strong> connects those snapshots with a quadratic curve and carries their shared uncertainty into the result. We can read a trajectory rather than five isolated estimates.</p>${figure('story-cast','CSF estimates and their 95% intervals, the CAST trajectory and pointwise band, and known truth at the five exported horizons.')}<p>The curve also shows the cost of simplification. It smooths past the early peak. At 84 months, its estimate and interval remain positive even though the known difference is negative. CAST makes a time pattern easier to interpret; it does not guarantee a better fit.</p></section>
    <section id="story-boundary"><h2>In a real study, the diamonds disappear.</h2><p>We would need well-defined treatment options, adequate treatment and follow-up support, and defensible assumptions about confounding and censoring. Neither method can adjust for a common cause that was never recorded.</p><p>This is one simulated cohort, not a ranking of methods for every study. A and B are abstract options, and the changing effect of a choice made at baseline is not a rule for when to stop or switch treatment.</p><details class="story-values"><summary>Values behind these figures</summary>__STORY_VALUES__</details></section>
  </article>`);
  const paths=html.match(/<details class="audience-paths">[\s\S]*?<\/section><\/details>/)?.[0];
  if(!paths)throw Error('Comparison audience paths missing');
  html=html.replace(paths,'');
  html=exact(html,'<section class="controls" id="figure"','<details class="analysis-explorer" id="analysis-explorer"><summary>Explore the analysis</summary><section class="controls" id="figure"');
  html=exact(html,'<footer>','</details>'+paths+'<footer>');
  html=html.replace('<details class="diagnostics" open>','<details class="diagnostics">');
  html=html.replace('Choose a reading path','Reading paths');
  html=html.replace('</head>','<script type="module" src="../narrative-figures.mjs"></script>\n</head>');
  return html;
}
