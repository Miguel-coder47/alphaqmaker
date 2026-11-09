// Fills in your details everywhere. Run once:  node configure.mjs your-github-username alphaqmaker "Your Name"
// Optional 4th value: your own domain, e.g.  https://alphaqmaker.example.com/
import fs from 'node:fs';
import path from 'node:path';
const [user,repo='alphaqmaker',author='',domain=''] = process.argv.slice(2);
if(!user){console.log('Usage: node configure.mjs <github-username> [repo-name] ["Your Name"] [custom-domain-url]');process.exit(1);}
const site=domain?domain.replace(/\/?$/,'/'):`https://${user}.github.io/${repo}/`;
const map={'__SITE_URL__':site,'__GITHUB_URL__':`https://github.com/${user}/${repo}`,'__AUTHOR__':author||user,'__YEAR__':String(new Date().getFullYear())};
let changed=0;
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(['node_modules','.git'].includes(e.name))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);
  else if((/\.(html|md|xml|txt|json|mjs|js)$/.test(e.name)||e.name==='LICENSE')&&e.name!=='configure.mjs'){
    const t=fs.readFileSync(p,'utf8');let u=t;for(const [k,v] of Object.entries(map))u=u.split(k).join(v);
    if(u!==t){fs.writeFileSync(p,u);changed++;}}}};
walk('.');
console.log(`Done. Updated ${changed} files.\nYour site will be at: ${site}\nYour code will be at: ${map.__GITHUB_URL__}`);
