import {BASELINE,parseState,stateSearch,selectedValues,plotDomain,percentagePoints,validateData} from './core.mjs';
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let data,state,timer=null,guideFrame=null,previousGuide=null,hadFit=false;
const svgNS='http://www.w3.org/2000/svg';
function svgNode(name,attrs={},text){const n=document.createElementNS(svgNS,name);for(const [key,value] of Object.entries(attrs)) n.setAttribute(key,String(value));if(text!==undefined)n.textContent=text;return n;}
function stopPlay(){clearInterval(timer);timer=null;$('play').textContent='Play snapshots ▷';$('play').setAttribute('aria-pressed','false');}
function updateURL(){history.replaceState(null,'',`${location.pathname}?${stateSearch(state)}${location.hash}`);}
function update(next,announce=true){Object.assign(state,next);render();updateURL();if(announce)$('interaction-status').textContent=`Month ${state.horizon}: ${percentagePoints(selectedValues(data,state).estimate)} percentage points. View updated.`;}
function drawChart(){
  const {scenario:s}=selectedValues(data,state);
  const width=Math.max(280,Math.round($('chart').getBoundingClientRect().width));
  const height=width<430?305:345,m={left:47,right:15,top:38,bottom:42};
  const [lo,hi]=plotDomain(s),start=data.horizons[0],end=data.horizons.at(-1);
  const x=t=>m.left+8+(t-start)/(end-start)*(width-m.left-m.right-16);
  const y=v=>height-m.bottom-(v-lo)/(hi-lo)*(height-m.top-m.bottom);
  const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-labelledby':'plot-title plot-description'});
  svg.append(svgNode('title',{id:'plot-title'},'Estimated survival benefit across follow-up horizons'));
  svg.append(svgNode('desc',{id:'plot-description'},`Five CSF estimates with 95% intervals. Selected horizon: ${state.horizon} months. ${state.fit?'CAST fitted curve and pointwise band are shown. ':''}${state.truth?'Known simulated truth is shown as diamonds. ':''}Exact values are in Data & settings below.`));
  svg.append(svgNode('text',{x:m.left,y:17,class:'axis-label'},'Survival difference (percentage points)'));
  const tickStep=(hi-lo)>.7?.2:(hi-lo)>.35?.1:.05;
  for(let v=Math.ceil(lo/tickStep)*tickStep;v<=hi;v+=tickStep){
    svg.append(svgNode('line',{x1:m.left,y1:y(v),x2:width-m.right,y2:y(v),class:Math.abs(v)<1e-6?'zero-line':'grid-line'}));
    svg.append(svgNode('text',{x:m.left-9,y:y(v)+4,'text-anchor':'end'},Math.round(v*100)));
  }
  for(const t of data.horizons) svg.append(svgNode('text',{x:x(t),y:height-23,'text-anchor':'middle'},t));
  svg.append(svgNode('text',{x:(width+m.left)/2,y:height-4,'text-anchor':'middle',class:'axis-label'},'Follow-up (months)'));
  const path=(times,values)=>times.map((t,i)=>`${i?'L':'M'}${x(t).toFixed(2)},${y(values[i]).toFixed(2)}`).join(' ');
  if(state.fit){
    const low=path(s.cast.curve_t,s.cast.curve_lo);
    const high=s.cast.curve_t.map((t,i)=>[t,s.cast.curve_hi[i]]).reverse().map(([t,v])=>`L${x(t)},${y(v)}`).join(' ');
    svg.append(svgNode('path',{d:`${low} ${high} Z`,class:'cast-band'}));
    const line=svgNode('path',{d:path(s.cast.curve_t,s.cast.curve_fit),class:`cast-line ${!hadFit?'fit-draw':''}`,pathLength:1});
    if(!hadFit){line.setAttribute('stroke-dasharray','1');line.addEventListener('animationend',()=>line.removeAttribute('stroke-dasharray'),{once:true});}
    svg.append(line);
  }
  if(state.naive)svg.append(svgNode('path',{d:path(data.horizons,s.naive),class:'naive-line'}));
  const target=x(state.horizon),initial=previousGuide??target;
  const guide=svgNode('line',{x1:initial,x2:initial,y1:m.top,y2:height-m.bottom,class:'horizon-guide'});
  svg.append(guide);
  data.horizons.forEach((t,i)=>{
    const cx=x(t),cy=y(s.csf.ate[i]);
    svg.append(svgNode('line',{x1:cx,x2:cx,y1:y(s.csf.lo[i]),y2:y(s.csf.hi[i]),class:'csf-whisker'}));
    for(const v of [s.csf.lo[i],s.csf.hi[i]])svg.append(svgNode('line',{x1:cx-4,x2:cx+4,y1:y(v),y2:y(v),class:'csf-whisker'}));
    const point=svgNode('circle',{cx,cy,r:t===state.horizon?6:4,class:`csf-point ${t===state.horizon?'selected':''}`});
    point.append(svgNode('title',{},`${t} months: ${percentagePoints(s.csf.ate[i])} pp; 95% interval ${percentagePoints(s.csf.lo[i])} to ${percentagePoints(s.csf.hi[i])} pp`));
    svg.append(point);
    if(state.truth){const ty=y(s.truth[i]);const truth=svgNode('path',{d:`M${cx},${ty-5} l5,5 l-5,5 l-5,-5 Z`,class:'truth-point'});truth.append(svgNode('title',{},`Known truth at ${t} months: ${percentagePoints(s.truth[i])} pp`));svg.append(truth);}
    const hit=svgNode('rect',{x:cx-18,y:m.top,width:36,height:height-m.top-m.bottom,class:'point-hit','aria-hidden':'true'});
    hit.append(svgNode('title',{},`Select month ${t}: ${percentagePoints(s.csf.ate[i])} percentage points`));
    hit.addEventListener('click',()=>{stopPlay();update({horizon:t});});svg.append(hit);
  });
  $('chart').replaceChildren(svg);cancelAnimationFrame(guideFrame);
  if(!reduced.matches&&Math.abs(initial-target)>1){const begun=performance.now();const step=now=>{const f=Math.min(1,(now-begun)/350),e=1-(1-f)**3;const pos=initial+(target-initial)*e;guide.setAttribute('x1',pos);guide.setAttribute('x2',pos);if(f<1)guideFrame=requestAnimationFrame(step);};guideFrame=requestAnimationFrame(step);}else{guide.setAttribute('x1',target);guide.setAttribute('x2',target);}
  previousGuide=target;hadFit=state.fit;
}
function render(){
  const {scenario:s,index,estimate,low,high,truth,fit}=selectedValues(data,state);
  $('shape').value=state.shape;$('conf').value=String(state.conf);$('unmeas').value=String(state.unmeas);
  for(const [name,id] of [['fit','show-fit'],['truth','show-truth'],['naive','show-naive']]){$(id).checked=state[name];$(`${name}-legend`).hidden=!state[name];}
  $('fit-note').hidden=!state.fit;$('selected-horizon').textContent=`At ${state.horizon} months`;
  $('selected-estimate').textContent=percentagePoints(estimate);
  $('selected-interval').textContent=`95% interval: ${percentagePoints(low)} to ${percentagePoints(high)} pp`;
  $('extra-values').replaceChildren();
  for(const [shown,label,value] of [[state.fit,'CAST fit',fit],[state.truth,'Known truth',truth]])if(shown){const p=document.createElement('p');p.textContent=`${label}: ${percentagePoints(value)} pp`;$('extra-values').append(p);}
  $('interpretation').textContent=state.unmeas>0?'Hidden confounding is active: this adjusted estimate should not be read as the causal effect.':low<=0&&high>=0?'This interval includes zero. The point estimate alone does not establish a benefit or harm at this horizon.':estimate>0?'The adjusted estimate favors treatment at this horizon, under the causal assumptions.':'The adjusted estimate favors control at this horizon, under the causal assumptions.';
  $('n-label').textContent=s.meta.n.toLocaleString();
  for(const b of $('horizons').children)b.setAttribute('aria-pressed',String(Number(b.dataset.horizon)===state.horizon));
  let observation='Select a horizon, then reveal the CAST trajectory to connect the snapshots.';
  if(state.naive)observation='The dashed comparison does not adjust for baseline differences. Compare it with the CSF estimates, then reveal the answer key available in this simulation.';
  if(state.fit)observation='The fitted curve summarizes the five estimates using a quadratic model. Between horizons, its values depend on that model.';
  if(state.truth&&state.fit){const gaps=s.truth.map((v,i)=>Math.abs(s.cast.fit[i]-v));const worst=gaps.indexOf(Math.max(...gaps));observation=`Across the five horizons, the largest gap is at ${data.horizons[worst]} months: the fitted curve differs from truth by ${(gaps[worst]*100).toFixed(1)} percentage points. Compare the curve with the simulated truth to see where the model fits poorly.`;}
  else if(state.truth)observation=`At ${state.horizon} months, the simulated cohort’s true average survival difference is ${percentagePoints(truth)} percentage points. Compare it with the estimate above.`;
  if(state.unmeas>0)observation+=' The selected cohort also contains an unmeasured common cause; adjustment cannot use it.';
  $('observation').textContent=observation;
  $('table-body').replaceChildren(...data.horizons.map((t,i)=>{const tr=document.createElement('tr');for(const value of [t,percentagePoints(s.csf.ate[i],2),`${percentagePoints(s.csf.lo[i],2)} to ${percentagePoints(s.csf.hi[i],2)}`,percentagePoints(s.cast.fit[i],2),percentagePoints(s.truth[i],2)]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;}));
  drawChart();
}
function openAnchor(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(!target)return;if(target.matches('details'))target.open=true;let parent=target.parentElement;while(parent){if(parent.matches('details'))parent.open=true;parent=parent.parentElement;}}
async function loadArt(){try{const res=await fetch('assets/art/manifest.json');if(!res.ok)return;const art=await res.json();if(!art.hero?.src||!art.hero.alt)return;const root=new URL('assets/art/',location.href),url=new URL(art.hero.src,root);if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;const img=new Image();img.alt=art.hero.alt;img.decoding='async';img.onload=()=>{$('hero-art-fallback').replaceChildren(img);};img.src=url.href;}catch{/* The complete baseline schematic remains visible if optional artwork is absent. */}}
async function start(){
  try{const response=await fetch('data/scenarios.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);data=validateData(await response.json());state=parseState(location.search,data);const initial=new URLSearchParams(location.search);if(!initial.has('fit'))state.fit=true;if(!initial.has('truth'))state.truth=true;
    data.horizons.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.dataset.horizon=t;b.setAttribute('aria-label',`${t} months`);b.addEventListener('click',()=>{stopPlay();update({horizon:t});});$('horizons').append(b);});
    for(const id of ['shape','conf','unmeas'])$(id).addEventListener('change',()=>{stopPlay();update({[id]:id==='shape'?$(id).value:Number($(id).value)});});
    for(const [id,name] of [['show-fit','fit'],['show-truth','truth'],['show-naive','naive']])$(id).addEventListener('change',()=>update({[name]:$(id).checked}));
    $('play').addEventListener('click',()=>{if(timer){stopPlay();return;}if(data.horizons.indexOf(state.horizon)===data.horizons.length-1)update({horizon:data.horizons[0]});$('play').textContent='Pause snapshots Ⅱ';$('play').setAttribute('aria-pressed','true');timer=setInterval(()=>{const next=data.horizons.indexOf(state.horizon)+1;if(next>=data.horizons.length){stopPlay();return;}update({horizon:data.horizons[next]});if(next===data.horizons.length-1)stopPlay();},1300);});
    $('share').addEventListener('click',async()=>{updateURL();try{await navigator.clipboard.writeText(location.href);$('share').textContent='View link copied ✓';}catch{$('share').textContent='Copy the address bar to share';}setTimeout(()=>{$('share').textContent='Copy this view ↗';},3500);});
    $('experience').hidden=false;$('load-status').hidden=true;render();new ResizeObserver(()=>{previousGuide=null;drawChart();}).observe($('chart'));
  }catch(error){$('load-status').textContent=`The interactive data could not load (${error.message}). Serve the tutorial over HTTP, or use the downloadable R exercise below.`;$('load-status').setAttribute('role','alert');}
}
for(const link of document.querySelectorAll('[data-source]'))link.href=`https://github.com/ishuryak/cast_demo_website/blob/${BASELINE}/${link.dataset.source}`;
let printState=[];addEventListener('beforeprint',()=>{printState=[...document.querySelectorAll('details')].map(d=>[d,d.open]);printState.forEach(([d])=>d.open=true);});addEventListener('afterprint',()=>printState.forEach(([d,open])=>d.open=open));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlay();});
addEventListener('hashchange',openAnchor);openAnchor();loadArt();start();
