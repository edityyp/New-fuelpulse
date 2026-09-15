import {readFile} from 'node:fs/promises';
const files=['app.js'];
for(const f of files){const s=await readFile(f,'utf8');if(/x-demo-|InMemoryStore|Good Morning, Yash|1,250/.test(s))throw new Error(`Demo code detected in ${f}`);}
console.log('lint checks passed');
