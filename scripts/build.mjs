import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
for(const f of ['index.html','app.js','styles.css','manifest.webmanifest']) copyFileSync(f,`dist/${f}`);
writeFileSync('dist/build-manifest.json',JSON.stringify({name:'FuelPulse Customer',generatedAt:new Date().toISOString(),source:['index.html','app.js','styles.css','manifest.webmanifest']},null,2));
console.log('Built production root assets into dist/.');
