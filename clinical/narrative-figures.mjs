// Fixed figures for the article. Interactive controls live in the optional analysis.
export function storyPlots(data){
  const s=data.scenarios['reversal_conf1.00_unmeas0.00'],h=data.horizons,pp=a=>a.map(x=>100*x);
  const line=(x,y,name,color,dash='solid')=>({x,y:pp(y),name,type:'scatter',mode:'lines',line:{color,width:2.5,dash}});
  const truth={x:h,y:pp(s.truth),name:'Known truth',type:'scatter',mode:'markers',marker:{symbol:'diamond',size:9,color:'#242a29'}};
  const csf={x:h,y:pp(s.csf.ate),name:'CSF',type:'scatter',mode:'markers',marker:{size:8,color:'#a65736'},error_y:{type:'data',symmetric:false,array:s.csf.hi.map((x,i)=>100*(x-s.csf.ate[i])),arrayminus:s.csf.lo.map((x,i)=>100*(s.csf.ate[i]-x)),color:'#a65736',thickness:1.3,width:4}};
  const band={x:[...s.cast.curve_t,...s.cast.curve_t.toReversed()],y:pp([...s.cast.curve_hi,...s.cast.curve_lo.toReversed()]),type:'scatter',fill:'toself',fillcolor:'rgba(8,126,139,.10)',line:{width:0},hoverinfo:'skip',showlegend:false,name:'CAST pointwise band'};
  return {'story-raw':[line(h,s.naive,'Observed gap','#a65736')],'story-cox':[line(h,s.cox.ate,'Adjusted Cox','#756b86','dot'),truth],'story-cast':[band,line(s.cast.curve_t,s.cast.curve_fit,'CAST','#087e8b'),csf,truth]};
}
async function mount(){
  const response=await fetch('../data/scenarios.json');if(!response.ok)throw Error('Data unavailable');
  const plots=storyPlots(await response.json());
  for(const [id,traces] of Object.entries(plots)){
    const el=document.getElementById(id);if(!el)continue;
    const small=el.getBoundingClientRect().width<500;
    el.replaceChildren();
    await Plotly.newPlot(el,traces,{height:small?300:350,margin:{l:45,r:10,t:12,b:75},xaxis:{title:'Months after treatment choice',tickvals:[12,36,60,84,108],range:[8,112],fixedrange:true},yaxis:{range:[-12,38],ticksuffix:' pp',zerolinecolor:'#8a938e',gridcolor:'#eef0ed',fixedrange:true},legend:{orientation:'h',x:0,y:-.25,font:{size:12}},font:{family:'DM Sans, Arial, sans-serif',size:12,color:'#656c68'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',showlegend:true},{staticPlot:true,responsive:true,displayModeBar:false});
  }
}
if(typeof document!=='undefined')mount().catch(()=>{for(const el of document.querySelectorAll('.narrative-plot'))el.textContent='The figure could not load. The values behind these figures are available below.';});
