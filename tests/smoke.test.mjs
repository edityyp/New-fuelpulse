import test from 'node:test'; import assert from 'node:assert/strict'; import {readFile} from 'node:fs/promises';
test('production source is not demo code',async()=>{for(const f of ['index.html','app.js']){const t=await readFile(f,'utf8');assert(!t.includes('x-demo-role'));assert(!t.includes('x-demo-user'));assert(!t.includes('1,250'));assert(!t.includes('Yash'));}});
test('build script uses root production files',async()=>{const t=await readFile('scripts/build.mjs','utf8');assert(t.includes("'app.js'"));assert(!t.includes('src/app.js'));});
