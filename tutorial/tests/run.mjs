// Importing the tests runs node:test in this process, including in restricted Windows environments.
import {readdir} from 'node:fs/promises';
for(const file of (await readdir(new URL('./',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort())await import(new URL(file,import.meta.url));
