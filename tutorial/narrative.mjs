// Optional exercise; the main reading path needs no route picker.
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

document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  let target=document.getElementById(link.hash.slice(1));
  while(target){if(target.matches('details'))target.open=true;target=target.parentElement;}
});
