import test from 'node:test';
import assert from 'node:assert/strict';
import {illustrativeEffect} from '../profile-illustration.mjs';

test('invented dose contrasts share a zero-dose reference and start at zero',()=>{
  for(const profile of ['A','B'])for(let v=0;v<=10;v+=0.5){
    assert.equal(illustrativeEffect(profile,0,v),0);
    assert.ok(Math.abs(illustrativeEffect(profile,v,0))===0);
  }
});

test('the illustration demonstrates profile ordering changing with time and harm at high dose',()=>{
  assert.ok(illustrativeEffect('A',4,1)>illustrativeEffect('B',4,1));
  assert.ok(illustrativeEffect('A',4,8)<illustrativeEffect('B',4,8));
  assert.ok(illustrativeEffect('B',10,5)<0);
  for(const profile of ['A','B'])for(let a=0;a<=10;a+=0.1)for(let t=0;t<=10;t+=0.1){
    const effect=illustrativeEffect(profile,a,t);
    assert.ok(Number.isFinite(effect)&&effect>=-8&&effect<=16,'The fixed plot bounds must include the full teaching domain.');
  }
});
