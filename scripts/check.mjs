import {readFile} from 'node:fs/promises';
for(const f of ['index.html','app.js','styles.css','vercel.json']){await readFile(f,'utf8');}
console.log('production source files present');
