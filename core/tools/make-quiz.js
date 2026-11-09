#!/usr/bin/env node
// One command: PDF/PowerPoint files -> quiz file, using Google's FREE Gemini API. No Claude involved.
//   node tools/make-quiz.js bio.pdf slides.pptx --count 20 --pages "12-30;all" --title "Biology"
// Setup: put GEMINI_API_KEY=... in a file named .env (see GEMINI-TOOL.md).
import fs from 'node:fs';
import path from 'node:path';
import {readPages,flag} from './lib.js';
import {assessExtraction,stripBoilerplate} from '../src/readable.js';
import {chunkPages,parsePageRanges,dedupeQuestions} from '../src/chunk.js';
import {prepareQuestions} from '../src/ingest.js';
import {buildSystemPrompt,buildQuestionPrompt,ALL_TYPES} from '../src/prompt.js';
import {exportQuiz} from '../src/schema.js';
import {makeProvider} from '../server/providers.js';
import {generateFromText} from '../src/ruleBased.js';

// tiny .env reader (no extra install needed)
for(const f of ['.env','.env.local']){
  if(!fs.existsSync(f)) continue;
  for(const line of fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
    const m=/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if(!m||line.trim().startsWith('#')||process.env[m[1]]!==undefined) continue;
    process.env[m[1]]=m[2].replace(/\s+#.*$/,'').trim().replace(/^["']|["']$/g,'');
  }
}
const die=m=>{console.error('\n'+m+'\n');process.exit(1);};
const args=process.argv.slice(2);
const files=args.filter((a,i)=>!a.startsWith('--')&&!args[i-1]?.startsWith('--'));
if(!files.length) die('Usage: node tools/make-quiz.js <file.pdf|file.pptx> [more files, up to 5] [--count 20] [--pages "12-30;all"] [--types mcq,blanks,modtf] [--title "Name"] [--figures "32,33"]');
if(files.length>5) die(`Please use between 1 and 5 files. You gave ${files.length}.`);
const badExt=files.filter(f=>!/\.(pdf|pptx)$/i.test(f));
if(badExt.length) die(`Only .pdf and .pptx files work. Not supported: ${badExt.join(', ')}. (For old .ppt files, open them in PowerPoint and use Save As .pptx.)`);
const missing=files.filter(f=>!fs.existsSync(f));
if(missing.length) die(`Could not find: ${missing.join(', ')}. Put the file in this folder, or give its full path in quotes.`);

const N=Math.min(100,Math.max(1,Math.floor(+flag(args,'count',20))||20));
const types=flag(args,'types','mcq,blanks,modtf').split(',').map(s=>s.trim()).filter(t=>ALL_TYPES.includes(t));
if(!types.length) die(`Unknown --types. Choose from: ${ALL_TYPES.join(', ')}.`);
const per=Math.max(3,Math.min(20,Math.floor(+flag(args,'per',12))||12));
const providerName=flag(args,'provider','gemini');
const ranges=String(flag(args,'pages','')).split(';').map(s=>s.trim());
if(providerName==='gemini'){
  if(!process.env.GEMINI_API_KEY) die('No Gemini key found.\n1. Go to aistudio.google.com, sign in, and choose "Get API key" (free, no card).\n2. In this folder, make a file named .env with this line:\n   GEMINI_API_KEY=paste-your-key-here\n3. Run this command again.');
  process.env.GEMINI_MODEL=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
}
let ai;try{ai=makeProvider(providerName);}catch(e){die(e.message);}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function call(a){
  const base=Number(process.env.MAKEQUIZ_RETRY_MS||20000);
  for(let k=0;;k++){
    try{return await ai.generate(a);}
    catch(e){
      if(e.status===429&&k<3){console.log(`  Free limit reached. Waiting ${Math.round(base*(k+1)/1000)} seconds, then trying again (${k+1} of 3)...`);await wait(base*(k+1));continue;}
      throw e;
    }
  }
}
const explain=e=>e.status===429?'The free limit is used up for now (it resets at midnight Pacific time). Try again later, or use a smaller --count.'
  :[400,401,403].includes(e.status)?`${e.message}\nCheck GEMINI_API_KEY in your .env file, and that GEMINI_MODEL is a model your key can use.`
  :e.status===404?`${e.message}\nThe model name was not found. Set GEMINI_MODEL in .env to a free model shown in aistudio.google.com.`
  :e.message;

// ---- 1. read files (on this computer; nothing sent yet)
const pages=[],map={},notes=[];
for(const [fi,f] of files.entries()){
  console.log(`Reading ${path.basename(f)} ...`);
  let ps;try{ps=stripBoilerplate(await readPages(f));}catch(e){notes.push(`${path.basename(f)}: could not be read (${e.message}).`);continue;}
  const rg=ranges[fi];
  if(rg&&rg.toLowerCase()!=='all'){try{const sel=parsePageRanges(rg,ps.length);ps=ps.filter(p=>sel.includes(p.page));}catch(e){die(`${path.basename(f)}: ${e.message}`);}}
  const a=assessExtraction(ps);
  if(!a.ok){notes.push(`${path.basename(f)}: ${a.message}`);continue;}
  if(a.message) notes.push(`${path.basename(f)}: ${a.message}`);
  for(const p of ps) if(p.text.trim()){const g=pages.length+1;pages.push({page:g,text:p.text});map[g]={file:path.basename(f),page:p.page};}
}
if(!pages.length) die(notes.join('\n')||'No readable text was found.');
const chunks=chunkPages(pages,{maxChars:9000});
const need=Math.min(chunks.length,Math.ceil(N*1.4/per));
const use=Array.from({length:need},(_,i)=>chunks[Math.floor(i*chunks.length/need)]);
console.log(`Using ${pages.length} pages in ${use.length} request${use.length===1?'':'s'} to ${providerName}.`);

// ---- 2. ask the AI, one section at a time
let all=[];
for(const [k,c] of use.entries()){
  console.log(`Section ${k+1} of ${use.length} (${map[c.pages[0]].file} p.${map[c.pages[0]].page} to ${map[c.pages[1]].file} p.${map[c.pages[1]].page}) ...`);
  try{
    const r=await call({kind:'questions',system:buildSystemPrompt(types),user:buildQuestionPrompt(c.text,per)});
    all.push(...prepareQuestions(r.json,{textFor:()=>c.text,pageRange:c.pages}));
  }catch(e){
    notes.push(`Section ${k+1}: ${explain(e)}`);
    if(e.status===429||[400,401,403,404].includes(e.status)){console.log('  Stopping here. '+explain(e));break;}
  }
}
// ---- 3. optional: let Gemini look at picture-only slides
const figs=flag(args,'figures','');
let figQs=[];
if(figs){
  const pdf=files.find(f=>/\.pdf$/i.test(f));
  if(providerName!=='gemini') notes.push('--figures needs the gemini provider.');
  else if(!pdf) notes.push('--figures needs a PDF file.');
  else if(fs.statSync(pdf).size>15*1024*1024) notes.push('--figures: the PDF is bigger than 15 MB, so it was not sent.');
  else{
    const list=figs.split(',').map(x=>+x.trim()).filter(Number.isInteger);
    console.log(`Asking Gemini to look at picture slides ${list.join(', ')} ...`);
    try{
      const sys=buildSystemPrompt(types).replace(/Use only facts stated in the text\./,'Use only what is visible on the slides you are told to look at.');
      const r=await call({kind:'questions',system:sys,pdf:fs.readFileSync(pdf).toString('base64'),
        user:`Look ONLY at these pages of the attached PDF: ${list.join(', ')}. They are mostly figures, charts, tables or diagrams. Write 3 to 5 questions per page using only what is visible. "source": {"page": N} must be one of those page numbers, and "evidence" is a short description of what the figure shows.`});
      figQs=prepareQuestions(r.json).map(q=>{
        const bad=!list.includes(q.source&&q.source.page);
        return {...q,source:{...q.source,file:path.basename(pdf)},needsReview:true,reviewReasons:[...q.reviewReasons,'made from a picture: check it against the slide'].concat(bad?['cited page was not one of the figure pages']:[])};
      });
    }catch(e){notes.push(`Figures: ${explain(e)}`);}
  }
}

// ---- 4. check, remove duplicates, pick, save
const {kept}=dedupeQuestions(all);
const clean=kept.filter(q=>!q.problems.length);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const good=shuffle(clean.filter(q=>!q.needsReview)),flagged=shuffle(clean.filter(q=>q.needsReview));
let pick=good.slice(0,N);pick=pick.concat(flagged.slice(0,Math.max(0,N-pick.length)));
const textQs=pick.map(q=>{const m=map[q.source.page]||{};return {...q,source:{page:m.page||q.source.page,file:m.file}};});
const figKeep=figQs.filter(q=>!q.problems.length);
const final=[...textQs,...figKeep].map(({problems,...q})=>q);
if(!final.length) die('No usable questions came back.\n'+notes.join('\n'));
const title=flag(args,'title',files.length===1?path.basename(files[0]).replace(/\.[^.]+$/,''):`${files.length} files`);
const out=flag(args,'out',title.replace(/[^\w.-]+/g,'-').toLowerCase()+'.quiz.json');
fs.writeFileSync(out,exportQuiz({id:globalThis.crypto.randomUUID(),title,questions:final}));
const rev=final.filter(q=>q.needsReview);
console.log(`\nMade ${final.length} questions (${final.length-rev.length} ready, ${rev.length} to check by hand). Duplicates and broken questions were removed.`);
for(const q of rev.slice(0,8)) console.log(`  CHECK  ${q.source.file||''} p${q.source.page}: "${String(q.prompt).slice(0,55)}" - ${(q.reviewReasons||[]).join('; ')}`);
for(const n of notes) console.log('  NOTE   '+n);
console.log(`\nSaved ${out}. In the app, choose it under "Import a quiz" (tick "Add to my current quiz" to combine it with another).`);
