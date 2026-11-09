#!/usr/bin/env node
// Usage: node tools/check-quiz.js quiz-1.json [quiz-2.json ...] --pages my-reviewer.pages.json --title "Biology ch.3"
// Checks the AI's questions against your file, removes duplicates, writes <title>.quiz.json for the app's Import.
import fs from 'node:fs';
import {flag} from './lib.js';
import {parseAiJson} from '../server/providers.js';
import {prepareQuestions} from '../src/ingest.js';
import {dedupeQuestions} from '../src/chunk.js';
import {exportQuiz} from '../src/schema.js';
import {normalize} from '../src/normalize.js';

const args=process.argv.slice(2);
const files=args.filter((a,i)=>!a.startsWith('--')&&!args[i-1]?.startsWith('--'));
if(!files.length){console.log('Usage: node tools/check-quiz.js <reply.json ...> --pages <file.pages.json> [--title "My quiz"]');process.exit(1);}
const pagesFile=flag(args,'pages'),title=flag(args,'title','Imported quiz');
const pageText=new Map();
if(pagesFile){const j=JSON.parse(fs.readFileSync(pagesFile,'utf8'));for(const p of j.pages||j) pageText.set(p.page,p.text);}

let raw=[];
for(const f of files){
  try{const j=parseAiJson(fs.readFileSync(f,'utf8'));raw.push(...(Array.isArray(j)?j:j.questions||j.quiz?.questions||[]));}
  catch(e){console.log(`Could not read ${f}: ${e.message}`);}
}
const prepared=prepareQuestions(raw,pagesFile?{textFor:q=>pageText.get(q.source?.page)}:{});
const {kept,dropped}=dedupeQuestions(prepared);
const broken=kept.filter(q=>q.problems.length),flagged=kept.filter(q=>!q.problems.length&&q.needsReview),clean=kept.filter(q=>!q.needsReview);
const byType={};for(const q of kept) byType[q.type]=(byType[q.type]||0)+1;

console.log(`Read ${raw.length} questions. Duplicates removed: ${dropped.length}.`);
console.log(`  Ready: ${clean.length}   Needs your review: ${flagged.length}   Broken (left out): ${broken.length}`);
console.log(`  By type: ${Object.entries(byType).map(([t,n])=>`${t} ${n}`).join(', ')||'none'}`);
for(const q of flagged) console.log(`  REVIEW  p${q.source?.page} "${q.prompt.slice(0,60)}": ${q.reviewReasons.join('; ')}`);
for(const q of broken) console.log(`  BROKEN  "${String(q.prompt).slice(0,60)}": ${q.problems.join('; ')}`);

const strip=({problems,reviewReasons,...q})=>({...q,needsReview:q.needsReview,reviewReasons});
const quiz={id:globalThis.crypto.randomUUID(),title,questions:kept.filter(q=>!q.problems.length).map(({problems,...q})=>q)};
const out=title.replace(/[^\w.-]+/g,'-').toLowerCase()+'.quiz.json';
fs.writeFileSync(out,exportQuiz(quiz));
console.log(`\nSaved ${out} (${quiz.questions.length} questions). Review the flagged ones before relying on them.`);
