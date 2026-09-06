import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../assets/art/fundamentals.html',import.meta.url),'utf8');
const data=JSON.parse(await readFile(new URL('../data/scenarios.json',import.meta.url),'utf8'));
// Read the actual standalone constants without a browser or an extra dependency.
const real=JSON.parse(JSON.stringify(vm.runInNewContext(`(${html.match(/const REAL=([\s\S]*?);/)[1]})`)));
const toy=vm.runInNewContext(`(()=>{${html.slice(html.indexOf('const TOY='),html.indexOf('/* Exported results:'))};return {TOY,S0,S1,delta,pop,T0,T1};})()`);

test('all 135 animation export values match the frozen reversal scenario',()=>{
  const s=data.scenarios['reversal_conf1.00_unmeas0.00'];
  const expected={h:data.horizons,ate:s.csf.ate,lo:s.csf.lo,hi:s.csf.hi,truth:s.truth,
    naive:s.naive,cast:s.cast.fit,ct:s.cast.curve_t,cfit:s.cast.curve_fit,
    clo:s.cast.curve_lo,chi:s.cast.curve_hi};
  assert.deepEqual(real,expected);
});

test('illustrative survival integrates the time-varying conditional hazard',()=>{
  const {TOY,S0,S1,pop,delta}=toy;
  for(const t of [12,36,60,84,108,120]){
    for(const {h} of TOY.groups){
      const steps=12000,dt=t/steps;
      let hazardIntegral=0;
      for(let j=0;j<steps;j++)hazardIntegral+=h*Math.exp(TOY.a+TOY.c*(j+.5)*dt)*dt;
      assert.ok(Math.abs(S1(h,t)-Math.exp(-hazardIntegral))<1e-8);
      assert.equal(S0(h,t),Math.exp(-h*t));
      assert.ok(S1(h,t)>=0&&S1(h,t)<=1);
    }
    assert.ok(Math.abs(pop(delta,t)-(pop(S1,t)-pop(S0,t)))<1e-14);
  }
  assert.ok(pop(delta,44)>pop(delta,36));
  assert.ok(pop(delta,60)<pop(delta,44));
  assert.ok(pop(delta,120)<0);
  assert.ok(delta(.02,36)>delta(.006,36));
});

test('the illustrative potential-time pair straddles the 60-month horizon',()=>{
  const {S0,S1,T0,T1}=toy,h=.02,u=.449;
  const control=T0(h,u),treated=T1(h,u);
  assert.equal(Math.round(control),40);assert.equal(Math.round(treated),66);
  assert.ok(control<60&&treated>60);
  assert.ok(Math.abs(S0(h,control)-u)<1e-14);
  assert.ok(Math.abs(S1(h,treated)-u)<1e-14);
});
