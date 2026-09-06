// Explicit contents only: no local runs, compiler logs or consultation files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateData} from '../core.mjs';
const root=new URL('../',import.meta.url),kit=new URL('class-kit/',root);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const frozen=await readFile(new URL('data/scenarios.json',root));
const provenance=JSON.parse(await readFile(new URL('data/provenance.json',root),'utf8'));
if(hash(frozen)!==provenance.sha256)throw new Error('Frozen export hash mismatch.');
const data=validateData(JSON.parse(frozen));
await mkdir(new URL('data/',kit),{recursive:true});
const rows=['scenario,month,csf,csf_low,csf_high,cast,cast_low,cast_high,truth,unadjusted'];
for(const [name,s] of Object.entries(data.scenarios))data.horizons.forEach((month,i)=>
  rows.push([name,month,s.csf.ate[i],s.csf.lo[i],s.csf.hi[i],s.cast.fit[i],s.cast.lo[i],s.cast.hi[i],s.truth[i],s.naive[i]].join(',')));
await writeFile(new URL('data/frozen-horizons.csv',kit),rows.join('\n')+'\n');

export const kitFiles=['README.md','study-guide.tex','study-guide.pdf','slides.tex','slides.pdf',
  'class-lab.R','cast-exercise.R','R/cast_core.R','R/01_simulate.R',
  'data/demo-cohort.csv','data/answer-key.csv','data/frozen-horizons.csv','LICENSE','provenance.json'];
const sources={};
for(const name of ['cast_core.R','01_simulate.R']){
  const original=await readFile(new URL(`../../R/${name}`,import.meta.url));
  const bundled=await readFile(new URL(`R/${name}`,kit));
  if(!original.equals(bundled))throw new Error(`Bundled source differs: ${name}`);
  sources[`R/${name}`]=hash(bundled);
}
const hashes={};
for(const name of kitFiles.filter(name=>name!=='provenance.json'))hashes[name]=hash(await readFile(new URL(name,kit)));
await writeFile(new URL('provenance.json',kit),JSON.stringify({
  source_repository:provenance.source_repository,source_commit:provenance.source_commit,
  simulation_only:true,cohort:{n:600,seed:20260905,shape:'reversal',measured_confounding:1,hidden_confounding:0,
    // Environment used to generate the bundled CSVs, distinct from the frozen export.
    horizons:data.horizons,excluded_column:'u_hidden',generator:'R/01_simulate.R',R:'4.5.2'},
  answer_key:'Average conditional survival-probability differences for the 600 generated profiles; not paired realised outcomes.',
  frozen_export:{n_per_scenario:2000,scenarios:24,rows:120,sha256:provenance.sha256},
  effect_units:'Probability differences; multiply by 100 for percentage points.',
  source_sha256:sources,file_sha256:hashes
},null,2)+'\n');

// A small standard ZIP writer using stored entries. PDFs are already compressed.
// Fixed entry order/date make the archive reproducible from its source bytes.
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
const date=((2026-1980)<<9)|(9<<5)|6;
for(const name of kitFiles){
  const bytes=await readFile(new URL(name,kit)),filename=Buffer.from(`causal-educators-class-kit/${name}`),crc=crc32(bytes);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);
  h.writeUInt16LE(date,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(bytes.length,18);h.writeUInt32LE(bytes.length,22);h.writeUInt16LE(filename.length,26);
  local.push(h,filename,bytes);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);
  c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
  central.push(c,filename);offset+=h.length+filename.length+bytes.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);end.writeUInt16LE(kitFiles.length,8);end.writeUInt16LE(kitFiles.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await mkdir(new URL('downloads/',root),{recursive:true});
await writeFile(new URL('downloads/causal-educators-class-kit.zip',root),Buffer.concat([...local,directory,end]));
console.log(`Packaged educator kit: ${kitFiles.length} explicit files.`);
