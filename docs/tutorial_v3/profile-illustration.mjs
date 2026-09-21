// Invented score contrasts, not survival probabilities, patient data, or CAST output.
// a: one baseline dose; t: follow-up; arbitrary units on both axes.
export function illustrativeEffect(profile,a,t){
  if(!['A','B'].includes(profile)||![a,t].every(Number.isFinite)||a<0||a>10||t<0||t>10)throw new RangeError('Use profile A/B and dose/time between 0 and 10.');
  if(profile==='A')return (22*(1-Math.exp(-0.55*a))-0.12*a*a)*(1-Math.exp(-t/0.5))*Math.exp(-t/4);
  return (15*(1-Math.exp(-0.28*a))-0.2*a*a)*(1-Math.exp(-t/2))*Math.exp(-t/16);
}

export function mountProfileIllustration(){
  const chart=document.getElementById('profile-chart');
  if(!chart)return;
  const time=document.getElementById('profile-time'),dose=document.getElementById('profile-dose');
  const signed=value=>`${value>0?'+':''}${Math.abs(value)<0.05?'0.0':value.toFixed(1)}`;
  const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:1});
  function render(){
    const t=Number(time.value),a=Number(dose.value);
    // Geometry follows available width, so labels retain their physical size on phones.
    const width=Math.max(250,chart.clientWidth),height=300,left=40,right=18,top=35,bottom=48;
    const x=value=>left+value/10*(width-left-right);
    const y=value=>top+(16-value)/24*(height-top-bottom);
    const curve=profile=>Array.from({length:101},(_,i)=>`${i?'L':'M'}${x(i/10).toFixed(2)},${y(illustrativeEffect(profile,i/10,t)).toFixed(2)}`).join(' ');
    const ea=illustrativeEffect('A',a,t),eb=illustrativeEffect('B',a,t);
    const grid=[-8,0,8,16].map(v=>`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="${v===0?'#89918c':'#dcded5'}" ${v===0?'stroke-dasharray="3 4"':''}/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('');
    const ticks=[0,2,4,6,8,10].map(v=>`<text x="${x(v)}" y="${height-bottom+23}" text-anchor="middle">${v}</text>`).join('');
    chart.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="profile-chart-title profile-chart-description">
      <title id="profile-chart-title">Invented dose-response curves for two profiles</title>
      <desc id="profile-chart-description">At follow-up ${number(t)}, the solid teal curve is profile A and dashed rust curve is profile B. At baseline dose ${number(a)}, their fictional score improvements relative to zero dose are ${signed(ea)} and ${signed(eb)}. Negative means a worse score. The curves come from an invented teaching model.</desc>
      <text x="${left}" y="17" class="axis-title">Score difference vs zero dose</text>${grid}${ticks}
      <path d="${curve('A')}" fill="none" stroke="#087e8b" stroke-width="2.8" stroke-linecap="round"/>
      <path d="${curve('B')}" fill="none" stroke="#a65736" stroke-width="2.8" stroke-dasharray="7 5" stroke-linecap="round"/>
      <line x1="${x(a)}" y1="${top}" x2="${x(a)}" y2="${height-bottom}" stroke="#656c68" stroke-dasharray="2 5"/>
      <circle cx="${x(a)}" cy="${y(ea)}" r="5" fill="white" stroke="#087e8b" stroke-width="2.5"/>
      <rect x="${x(a)-4.5}" y="${y(eb)-4.5}" width="9" height="9" fill="white" stroke="#a65736" stroke-width="2.5"/>
      <text x="${(left+width-right)/2}" y="${height-4}" text-anchor="middle" class="axis-title">Baseline dose · illustrative units</text></svg>`;
    document.getElementById('profile-time-value').value=`${number(t)} / 10`;
    document.getElementById('profile-dose-value').value=`${number(a)} / 10`;
    time.setAttribute('aria-valuetext',`${number(t)} of 10 illustrative time units`);
    dose.setAttribute('aria-valuetext',`${number(a)} of 10 illustrative dose units`);
    document.getElementById('profile-a-value').textContent=`${signed(ea)} points`;
    document.getElementById('profile-b-value').textContent=`${signed(eb)} points`;
    let message;
    if(a===0)message='Zero dose is the reference: both contrasts are zero. Move dose to compare the profiles.';
    else if(t===0)message='At the start, neither effect has emerged. Move time to see how the dose-response curves develop.';
    else if(eb<0)message='At this dose and time, profile B has a worse score than under zero dose. More treatment need not mean more benefit.';
    else if(Math.abs(ea-eb)<0.15)message='The profiles have similar effects at this dose and time. Try an earlier or later horizon to compare their trajectories.';
    else message=`At this dose and time, profile ${ea>eb?'A':'B'} benefits more. ${ea>eb?'At dose 4, move toward later follow-up to see the ordering reverse.':'Compare with an earlier time to see how the relative benefits change.'}`;
    const takeaway=document.getElementById('profile-takeaway');
    if(takeaway.textContent!==message)takeaway.textContent=message;
  }
  document.getElementById('profile-experience').hidden=false;
  for(const input of [time,dose]){
    input.addEventListener('input',render);
    input.addEventListener('change',()=>{
      const t=Number(time.value),a=Number(dose.value);
      document.getElementById('profile-status').textContent=`At time ${number(t)} and dose ${number(a)}, profile A differs from zero dose by ${signed(illustrativeEffect('A',a,t))} score points; profile B by ${signed(illustrativeEffect('B',a,t))}. Invented illustration.`;
    });
  }
  new ResizeObserver(render).observe(chart);
  render();
}
