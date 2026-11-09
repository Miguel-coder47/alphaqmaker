#!/usr/bin/env node
// Usage: node tools/prompt.js my-reviewer.pages.json --pages 40-65 --types mcq,blanks --count 10
// Writes prompts/prompt-1.txt ... Paste each into ANY chat AI (Claude, Gemini, ChatGPT: free plans work).
// Save the AI's reply as quiz-1.json, quiz-2.json ... then run tools/check-quiz.js.
import fs from 'node:fs';
import {readPages,flag} from './lib.js';
import {parsePageRanges,chunkPages} from '../src/chunk.js';
import {assessExtraction,stripBoilerplate} from '../src/readable.js';
import {buildSystemPrompt,buildQuestionPrompt,ALL_TYPES} from '../src/prompt.js';

const [file,...rest]=process.argv.slice(2);
if(!file){console.log('Usage: node tools/prompt.js <file.pages.json|pdf|pptx> [--pages 40-65] [--types mcq,blanks,tf,multi,enumeration,matching,modtf] [--count 10] [--max-chars 9000]');process.exit(1);}
const pages=stripBoilerplate(await readPages(file));
const range=flag(rest,'pages');
const chosen=range?parsePageRanges(range,pages.length):pages.map(p=>p.page);
const subset=pages.filter(p=>chosen.includes(p.page)&&p.text.trim());
const a=assessExtraction(pages.filter(p=>chosen.includes(p.page)));
if(!a.ok){console.log(a.message);process.exit(2);}
const types=flag(rest,'types','mcq,blanks').split(',').filter(t=>ALL_TYPES.includes(t));
const count=+flag(rest,'count',10),maxChars=+flag(rest,'max-chars',9000);
fs.mkdirSync('prompts',{recursive:true});
const chunks=chunkPages(subset,{maxChars});
chunks.forEach((c,i)=>{
  const f=`prompts/prompt-${i+1}.txt`;
  fs.writeFileSync(f,`${buildSystemPrompt(types)}\n\n=====\n\n${buildQuestionPrompt(c.text,count)}\n`);
  console.log(`${f}  (pages ${c.pages[0]}-${c.pages[1]}, ${c.text.length} characters)`);
});
console.log(`\nNext: paste each prompt into a chat AI, save each reply as quiz-N.json, then run:\n  node tools/check-quiz.js quiz-1.json quiz-2.json --pages ${file.endsWith('.json')?file:file.replace(/\.[^.]+$/,'')+'.pages.json'}`);
