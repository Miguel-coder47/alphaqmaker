import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePageRanges,chunkPages,dedupeQuestions} from '../src/chunk.js';
import {assessExtraction,stripBoilerplate} from '../src/readable.js';
import {validateQuestion,exportQuiz,importQuiz} from '../src/schema.js';
import {mergeAttempts,pendingUploads} from '../src/syncQueue.js';

test('page ranges',()=>{
  assert.deepEqual(parsePageRanges('40-42, 45, 41',200),[40,41,42,45]);
  assert.throws(()=>parsePageRanges('0-3',10),/outside/);
  assert.throws(()=>parsePageRanges('5-99',10),/outside/);
  assert.throws(()=>parsePageRanges('abc',10),/Can't read/);
  assert.throws(()=>parsePageRanges('',10),/No pages/);
});
test('chunking covers every page and respects the size limit',()=>{
  const pages=Array.from({length:40},(_,i)=>({page:i+1,text:('Sentence about topic. '.repeat(30)).trim()}));
  const chunks=chunkPages(pages,{maxChars:3000});
  assert.ok(chunks.length>1);
  const seen=new Set();
  for(const c of chunks){assert.ok(c.text.length<=3000);for(let p=c.pages[0];p<=c.pages[1];p++) seen.add(p);}
  assert.equal(seen.size,40);
  const huge=chunkPages([{page:1,text:'x'.repeat(25000)}],{maxChars:10000});
  assert.ok(huge.length>=3&&huge.every(c=>c.pages[0]===1));
});
test('duplicate questions from overlapping chunks are removed',()=>{
  const qs=[
    {id:'1',type:'mcq',prompt:'Which organelle produces most of the cell ATP?'},
    {id:'2',type:'mcq',prompt:'Which organelle produces most of the cell ATP'},
    {id:'3',type:'mcq',prompt:'What does the nucleus store?'},
    {id:'4',type:'tf',prompt:'Which organelle produces most of the cell ATP?'},
  ];
  const {kept,dropped}=dedupeQuestions(qs);
  assert.deepEqual(kept.map(q=>q.id),['1','3','4']);
  assert.deepEqual(dropped.map(q=>q.id),['2']);
});
test('scanned or image-only files are reported plainly',()=>{
  const scanned=Array.from({length:10},(_,i)=>({page:i+1,text:i===0?'Title page text that is long enough to count as readable here.':''}));
  const a=assessExtraction(scanned);
  assert.equal(a.ok,false);assert.match(a.message,/scanned or made of images/);
  const mixed=[{page:1,text:'x'.repeat(100)},{page:2,text:''},{page:3,text:'y'.repeat(100)},{page:4,text:'z'.repeat(100)}];
  const b=assessExtraction(mixed);
  assert.equal(b.ok,true);assert.deepEqual(b.emptyPages,[2]);
  assert.equal(assessExtraction([]).ok,false);
});
const good={id:'q1',type:'mcq',version:1,prompt:'Which organelle makes ATP?',source:{page:12},options:[{id:'a',text:'Nucleus'},{id:'b',text:'Mitochondria'}],key:{correct:'b'}};
test('answer-key validation catches broken questions',()=>{
  assert.deepEqual(validateQuestion(good),[]);
  assert.ok(validateQuestion({...good,key:{correct:'z'}}).length);
  assert.ok(validateQuestion({...good,source:undefined}).length);
  assert.ok(validateQuestion({...good,version:undefined}).length);
  assert.ok(validateQuestion({id:'m',type:'modtf',version:1,source:{page:1},prompt:'Cells are made in the nucleus.',underlined:'nucleus',key:{truth:false}}).length);
  assert.ok(validateQuestion({id:'b',type:'blanks',version:1,source:{slide:3},prompt:'x',key:{blanks:[{accepted:[]}]}}).length);
  assert.deepEqual(validateQuestion({id:'m',type:'modtf',version:1,source:{page:1},prompt:'Cells are made in the nucleus.',underlined:'nucleus',key:{truth:false,correction:['cell division']}}),[]);
});
test('export and import round trip, and bad files are refused',()=>{
  const quiz={id:'z',title:'Biology',questions:[good]};
  assert.deepEqual(importQuiz(exportQuiz(quiz)),quiz);
  assert.throws(()=>importQuiz('not json'),/not valid/);
  assert.throws(()=>importQuiz(JSON.stringify({quiz})),/schema version/);
  assert.throws(()=>importQuiz(JSON.stringify({schemaVersion:99,quiz})),/newer version/);
  assert.throws(()=>importQuiz(JSON.stringify({schemaVersion:1,quiz:{title:'x',questions:[{...good,key:{correct:'z'}}]}})),/problems/);
});
test('offline sync: same attempt synced twice is harmless, newer wins',()=>{
  const local=[{id:'a',updatedAt:5,startedAt:1,finished:true},{id:'b',updatedAt:1,startedAt:2,finished:false}];
  const remote=[{id:'a',updatedAt:3,startedAt:1,finished:true},{id:'c',updatedAt:1,startedAt:0,finished:true}];
  const m=mergeAttempts(local,remote);
  assert.deepEqual(m.map(x=>x.id),['c','a','b']);
  assert.equal(m.find(x=>x.id==='a').updatedAt,5);
  assert.deepEqual(mergeAttempts(m,m),m);
  assert.deepEqual(pendingUploads(local,new Set()).map(x=>x.id),['a']);
});

test('a copyright footer on every page does not make a picture slide look readable',()=>{
  const foot='Example Course Title, First Edition. 2019 Example Publisher. This line repeats at the bottom of every slide of the file,\nso it must never count as real slide content when we check whether a page has text.';
  const body='Risk is the possibility of loss or gain, and every project has some risk that must be identified and managed by the team over time.';
  const pages=Array.from({length:12},(_,i)=>({page:i+1,text:([3,7].includes(i+1)?`Figure slide ${i+1} title\n`:`Slide ${i+1}\n${body} Detail number ${i+1}.\n`)+foot}));
  const a=assessExtraction(pages);
  assert.equal(a.ok,true);assert.deepEqual(a.emptyPages,[3,7]);assert.match(a.message,/probably pictures.*3, 7/);
  const s=stripBoilerplate(pages);
  assert.ok(!s[0].text.includes('Example Publisher'));assert.ok(s[0].text.includes('Detail number 1'));
  assert.equal(stripBoilerplate(pages.slice(0,3))[0].text,pages[0].text.trim());   // too few pages to tell: left alone
});
