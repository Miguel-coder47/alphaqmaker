#!/usr/bin/env node
// Usage: node tools/inspect.js my-reviewer.pdf   (or .pptx)
// Shows whether the file can be read, and saves my-reviewer.pages.json for the other tools.
import fs from 'node:fs';
import path from 'node:path';
import {readPages,flag} from './lib.js';
import {assessExtraction} from '../src/readable.js';
import {chunkPages,parsePageRanges} from '../src/chunk.js';

const [file,...rest]=process.argv.slice(2);
if(!file){console.log('Usage: node tools/inspect.js <file.pdf|file.pptx> [--pages 40-65]');process.exit(1);}
const pages=await readPages(file);
const range=flag(rest,'pages');
const chosen=range?parsePageRanges(range,pages.length):pages.map(p=>p.page);
const subset=pages.filter(p=>chosen.includes(p.page));
const a=assessExtraction(subset);
const out=file.replace(/\.[^.]+$/,'')+'.pages.json';
fs.writeFileSync(out,JSON.stringify({source:path.basename(file),pages},null,1));

console.log(`File: ${path.basename(file)}`);
console.log(`Pages/slides in file: ${pages.length}   Selected: ${subset.length}${range?` (${range})`:''}`);
console.log(`Readable: ${a.readablePages} of ${a.totalPages}   Verdict: ${a.ok?'OK to generate':'NOT READABLE'}`);
if(a.message) console.log(a.message);
if(a.ok) console.log(`Sections for the AI: ${chunkPages(subset.filter(p=>p.text.trim())).length}`);
console.log('\nPreview (first 90 characters per page):');
for(const p of subset.slice(0,8)) console.log(`  p${p.page}: ${p.text.replace(/\s+/g,' ').slice(0,90)||'(no text)'}`);
console.log(`\nSaved ${out}`);
