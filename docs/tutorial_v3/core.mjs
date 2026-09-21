export const BASELINE = '43a00101100801eb6c048800d24788455fac0f8b';
export const DEFAULT_STATE = Object.freeze({shape:'reversal',conf:1,unmeas:0,horizon:36,fit:false,truth:false,naive:false});
export function scenarioKey(state) {
  return `${state.shape}_conf${Number(state.conf).toFixed(2)}_unmeas${Number(state.unmeas).toFixed(2)}`;
}
export function parseState(search, data) {
  const p = new URLSearchParams(search);
  const pick = (name, choices, fallback, numeric = false) => {
    const value = numeric ? Number(p.get(name)) : p.get(name);
    return p.has(name) && choices.includes(value) ? value : fallback;
  };
  return {
    shape:pick('shape',data.shapes,DEFAULT_STATE.shape),
    conf:pick('conf',data.conf_grid,DEFAULT_STATE.conf,true),
    unmeas:pick('unmeas',data.unmeas_grid,DEFAULT_STATE.unmeas,true),
    horizon:pick('horizon',data.horizons,DEFAULT_STATE.horizon,true),
    fit:p.get('fit')==='1',truth:p.get('truth')==='1',naive:p.get('naive')==='1'
  };
}
export function stateSearch(state) {
  return new URLSearchParams(Object.entries(state).map(([key,value])=>[key,typeof value==='boolean'?(value?'1':'0'):String(value)])).toString();
}
export function percentagePoints(value, digits=1) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(digits)}`;
}
export function validateData(data) {
  if (!data || !Array.isArray(data.horizons) || !data.horizons.length) throw new Error('Missing evaluation horizons.');
  if (data.horizons.some((t,i,a)=>!Number.isFinite(t)||(i>0&&t<=a[i-1]))) throw new Error('Horizons must increase.');
  const check = (values, length, name) => {
    if(!Array.isArray(values)||values.length!==length||values.some(v=>!Number.isFinite(v))) throw new Error(`Invalid ${name}.`);
  };
  for(const shape of data.shapes) for(const conf of data.conf_grid) for(const unmeas of data.unmeas_grid) {
    const s = data.scenarios[scenarioKey({shape,conf,unmeas})];
    if(!s) throw new Error('A scenario is missing.');
    const n=data.horizons.length;
    for(const k of ['truth','naive']) check(s[k],n,k);
    for(const k of ['ate','lo','hi']) check(s.csf[k],n,`CSF ${k}`);
    for(const k of ['fit','lo','hi']) check(s.cast[k],n,`CAST ${k}`);
    for(const k of ['curve_fit','curve_lo','curve_hi']) check(s.cast[k],s.cast.curve_t.length,k);
    if(s.csf.ate.some((v,i)=>v<s.csf.lo[i]||v>s.csf.hi[i])) throw new Error('Invalid CSF interval.');
  }
  return data;
}
export function selectedValues(data,state) {
  const scenario=data.scenarios[scenarioKey(state)];
  const index=data.horizons.indexOf(state.horizon);
  if(!scenario||index<0) throw new Error('Unsupported scenario or horizon.');
  return {scenario,index,estimate:scenario.csf.ate[index],low:scenario.csf.lo[index],high:scenario.csf.hi[index],truth:scenario.truth[index],fit:scenario.cast.fit[index]};
}
export function plotDomain(s) {
  const values=[0,...s.csf.lo,...s.csf.hi,...s.truth,...s.naive,...s.cast.curve_lo,...s.cast.curve_hi];
  const lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,.015);
  return [lo-pad,hi+pad];
}
