// Builds app/index.html: one self-contained page from the tested engine (core/src) and the interface (app/src).
// Run: node build-app.mjs
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const strip=s=>s.replace(/^import .*;\n/gm,'').replace(/^export (const|function|async function)/gm,'$1');
const core=['normalize','checkText','fraction','score','schema','chunk','readable','prompt','ingest','ruleBased']
  .map(f=>`\n// --- ${f}\n`+strip(read(`core/src/${f}.js`))).join('');
const html=read('app/src/template.html')
  .replace('/*CSS*/',()=>read('app/src/theme.css')+read('app/src/extra.css'))
  .replace('/*CORE*/',()=>core)
  .replace('/*UI*/',()=>read('app/src/ui.js'));
fs.writeFileSync('app/index.html',html);
console.log(`Built app/index.html (${Math.round(html.length/1024)} KB)`);
