import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateData} from '../core.mjs';
import {kitFiles} from './package-class-kit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const data=await readFile(path.join(root,'data/scenarios.json'));
validateData(JSON.parse(data));
const provenance=JSON.parse(await readFile(path.join(root,'data/provenance.json'),'utf8'));
if(createHash('sha256').update(data).digest('hex')!==provenance.sha256)throw new Error('Frozen scenario data does not match its provenance.');
// Only an explicit public allowlist is copied; local design files and lab outputs cannot enter the build.
await mkdir(path.join(root,'dist'),{recursive:true});
for(const item of ['index.html','style.css','narrative.css','app.mjs','narrative.mjs','profile-illustration.mjs','core.mjs','data','LICENSE'])await cp(path.join(root,item),path.join(root,'dist',item),{recursive:true});
// Keep artwork sources and collaboration notes out of the public build.
await mkdir(path.join(root,'dist/assets/art'),{recursive:true});
for(const item of ['manifest.json','fundamentals.html','hector-counterfactual.png','cohort-fork.svg','follow-up-sketchbook.svg','hidden-thread.svg','time-slices.png','longitudinal-policy.png','methods-landscape.png','traditional-missingness.png','inference-contract.png'])await cp(path.join(root,'assets/art',item),path.join(root,'dist/assets/art',item));
await mkdir(path.join(root,'dist/labs'),{recursive:true});
for(const item of ['cast-exercise.R','README.md'])await cp(path.join(root,'labs',item),path.join(root,'dist/labs',item));
for(const item of kitFiles){const destination=path.join(root,'dist/class-kit',item);await mkdir(path.dirname(destination),{recursive:true});await cp(path.join(root,'class-kit',item),destination);}
await mkdir(path.join(root,'dist/downloads'),{recursive:true});
await cp(path.join(root,'downloads/causal-educators-class-kit.zip'),path.join(root,'dist/downloads/causal-educators-class-kit.zip'));
await writeFile(path.join(root,'dist/.nojekyll'),'');
console.log('Built tutorial/dist: 24 validated frozen scenarios, explicit public file allowlist.');
