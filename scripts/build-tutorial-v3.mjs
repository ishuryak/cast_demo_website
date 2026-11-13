// Preserve old shared URLs while maintaining one canonical story.
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../docs/tutorial_v3/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('index.html',output),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The CAST story has moved</title><link rel="canonical" href="../tutorial/"></head><body><main><h1>Follow Susan through the CAST story</h1><p>The clinical and illustrated reading paths now share one page.</p><a href="../tutorial/">Continue to the CAST story</a></main><script>
const aliases={'clinic-options':'question','clinic-indication':'comparison','clinic-curve':'explore','clinic-whom':'for-whom','clinic-registry':'causal-roadmap','choose-path':'story','missingness':'question','fundamentals':'question','profile-lab':'for-whom','profile-target':'for-whom','baseline-decision':'method-family','repeated-decisions':'method-family','separation-shapes':'one-number','snapshot-sketch':'slices-to-curve'};
const hash=location.hash.slice(1);location.replace('../tutorial/'+location.search+(hash?'#'+(aliases[hash]||hash):''));
</script></body></html>`);
console.log('Kept tutorial_v3 as a redirect to the canonical Susan story.');
