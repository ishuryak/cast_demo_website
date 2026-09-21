// Optional counterfactual exercise and animation. Prose stays in index.html.
import {mountProfileIllustration} from './profile-illustration.mjs';
mountProfileIllustration();

// Reader choices suggest routes through the shared story. Route copy lives in HTML.
const readerChoices=[...document.querySelectorAll('[data-reader-path]')];
const readerRoutes=[...document.querySelectorAll('.reader-itinerary')];
const readerReset=document.getElementById('reader-reset');
let selectedReader=null;
function chooseReader(path){
  const selected=readerChoices.find(button=>button.dataset.readerPath===path);
  selectedReader=selected||null;
  for(const button of readerChoices)button.setAttribute('aria-pressed',String(button===selected));
  for(const route of readerRoutes)route.hidden=route.id!==selected?.getAttribute('aria-controls');
  readerReset.hidden=!selected;
  const route=selected&&document.getElementById(selected.getAttribute('aria-controls'));
  document.getElementById('reader-status').textContent=selected?`${selected.textContent} path selected. ${route.querySelector('h3').textContent} Three suggested stops are below.`:'Choice cleared. You can follow the full story or choose another starting point.';
}
for(const button of readerChoices)button.addEventListener('click',()=>chooseReader(button.dataset.readerPath));
readerReset.addEventListener('click',()=>{
  const previous=selectedReader;
  chooseReader(null);
  previous?.focus();
});
document.querySelector('.reader-choices').hidden=false;
// Reveal destinations before native anchor navigation, including a repeat click
// on the current fragment. Chart state and the browser's Back behavior stay native.
for(const link of document.querySelectorAll('.reader-entry a[href^="#"]'))link.addEventListener('click',()=>{
  let target=document.getElementById(link.hash.slice(1));
  while(target){if(target.matches('details'))target.open=true;target=target.parentElement;}
});

// Both faces remain readable without JavaScript; the button progressively adds the turn.
const turnButton=document.getElementById('turn-problem');
const baselineFace=document.getElementById('baseline-decision');
const repeatedFace=document.getElementById('repeated-decisions');
function showProblem(repeated){
  baselineFace.hidden=repeated;
  repeatedFace.hidden=!repeated;
  turnButton.setAttribute('aria-expanded',String(repeated));
  turnButton.innerHTML=`${repeated?'Return to the baseline choice':'Turn to repeated decisions'} <span aria-hidden="true">↻</span>`;
  baselineFace.classList.toggle('is-turning',!repeated);
  repeatedFace.classList.toggle('is-turning',repeated);
}
turnButton.hidden=false;
showProblem(location.hash==='#repeated-decisions');
turnButton.addEventListener('click',()=>showProblem(repeatedFace.hidden));
addEventListener('hashchange',()=>{
  if(location.hash==='#repeated-decisions')showProblem(true);
  if(location.hash==='#baseline-decision')showProblem(false);
});
const viewButtons=[...document.querySelectorAll('[data-counterfactual-view]')];
const cells=[...document.querySelectorAll('[data-potential-outcome]')];
function selectCompletion(view){
  for(const button of viewButtons)button.setAttribute('aria-pressed',String(button.dataset.counterfactualView===view));
  for(const cell of cells){
    if(cell.dataset.factual==='true')continue;
    cell.textContent=view==='observed'?'?':cell.dataset[view]==='1'?'Alive':'Died';
    cell.className=view==='observed'?'missing':'hypothetical';
    cell.setAttribute('aria-label',view==='observed'?'Unobserved counterfactual':`Hypothetical: ${cell.textContent.toLowerCase()}`);
  }
  for(const result of document.querySelectorAll('[data-completion-result]'))result.hidden=result.dataset.completionResult!==view;
}
for(const button of viewButtons)button.addEventListener('click',()=>selectCompletion(button.dataset.counterfactualView));
document.querySelector('.counterfactual-controls').hidden=false;
selectCompletion('observed');

// Load the standalone walkthrough on request. Unmounting stops every child timer.
const fundamentals=document.getElementById('fundamentals');
const player=document.getElementById('fundamentals-player');
let animationFrame=null,animationObserver=null;
function syncFundamentals(){
  if(!fundamentals.open){
    animationObserver?.disconnect();animationObserver=null;
    player.replaceChildren();animationFrame=null;
    return;
  }
  if(animationFrame)return;
  const frame=document.createElement('iframe');
  animationFrame=frame;
  frame.title='Two paths through time: five scenes on individual counterfactuals and average survival effects';
  frame.src='assets/art/fundamentals.html';
  frame.addEventListener('load',()=>{
    if(animationFrame!==frame)return;
    const doc=frame.contentDocument;
    if(!doc?.body)return;
    // The standalone file retains its own system theme; this page uses white.
    doc.documentElement.dataset.theme='light';
    const resize=()=>{frame.style.height=`${Math.ceil(doc.body.getBoundingClientRect().height)+2}px`;};
    animationObserver=new ResizeObserver(resize);
    animationObserver.observe(doc.body);
    resize();
  });
  player.append(frame);
}
fundamentals.addEventListener('toggle',syncFundamentals);
syncFundamentals();
