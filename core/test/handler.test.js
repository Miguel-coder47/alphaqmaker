import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/handler.js';
import {mockProvider} from '../server/providers.js';
import {generateFromText} from '../src/ruleBased.js';
import {prepareQuestions} from '../src/ingest.js';

const sentence=n=>`Chloroplasts perform photosynthesis in plant cells during daylight number ${n}. `;
const pages=(n=6)=>Array.from({length:n},(_,i)=>({page:i+1,text:sentence(i+1).repeat(3)+'Mitochondria release energy for the cell through respiration.'}));
const usageStore=(start=0)=>{const s={v:start,adds:[]};return {s,get:async()=>s.v,add:async(o,m,d)=>{s.v+=d;s.adds.push(d);}};};
const user={id:'u1'};
const make=(over={})=>{const usage=over.usage||usageStore();return {usage,handle:createHandler({authUser:async h=>h.authorization?user:null,usage,ai:mockProvider(),capUsd:5,...over})};};
const req=(body)=>({method:'POST',headers:{authorization:'x'},body});

test('rejects signed-out users and wrong methods',async()=>{
  const {handle}=make();
  assert.equal((await handle({method:'POST',headers:{},body:{pages:pages()}})).status,401);
  assert.equal((await handle({method:'GET',headers:{authorization:'x'}})).status,405);
});
test('stops when the monthly cap is already used',async()=>{
  const {handle}=make({usage:usageStore(5),ai:{paid:true,generate:async()=>({json:[],cost:1})}});
  const r=await handle(req({pages:pages()}));
  assert.equal(r.status,429);
});
test('scanned files get a plain message, no questions',async()=>{
  const {handle}=make();
  const r=await handle(req({pages:[{page:1,text:''},{page:2,text:''}]}));
  assert.equal(r.status,422);assert.match(r.body.error,/scanned or made of images/);
});
test('free rule-based generator runs the whole flow with zero cost',async()=>{
  const {handle,usage}=make();
  const r=await handle(req({pages:pages(4)}));
  assert.equal(r.status,200);
  assert.ok(r.body.questions.length>0);
  for(const q of r.body.questions){assert.deepEqual(q.problems,[]);assert.equal(q.needsReview,false);assert.ok(q.source.page>=1&&q.source.page<=4);}
  assert.equal(usage.s.adds.length,0);            // nothing spent, nothing recorded
});
test('blank answers always come straight from the text',()=>{
  const text='[Page 3]\nPhotosynthesis converts light energy into chemical energy inside chloroplasts of plants.';
  const [q]=generateFromText(text);
  assert.ok(q.prompt.includes('____'));
  assert.ok(text.toLowerCase().includes(q.key.blanks[0].accepted[0]));
  assert.equal(q.source.page,3);
});
test('evidence that is not in the source, or a bad key, is flagged for review',()=>{
  const src='Mitochondria release energy for the cell through respiration.';
  const good={type:'blanks',prompt:'____ release energy for the cell.',key:{blanks:[{accepted:['mitochondria']}]},source:{page:1},evidence:src};
  const made={...good,evidence:'The nucleus is the control centre of every cell.'};
  const badKey={...good,key:{blanks:[{accepted:[]}]}};
  const [a,b,c]=prepareQuestions([good,made,badKey],{textFor:()=>src,pageRange:[1,1]});
  assert.equal(a.needsReview,false);
  assert.equal(b.needsReview,true);assert.match(b.reviewReasons[0],/not in the source/);
  assert.equal(c.needsReview,true);assert.ok(c.problems.length>0);
  assert.equal(prepareQuestions([{...good,source:{page:9}}],{textFor:()=>src,pageRange:[1,3]})[0].needsReview,true);
});
const fakeAi=(qs,{verify=true,cost=1,failChunk=-1}={})=>{let n=-1;return {async generate({kind,user}){
  if(kind==='verify') return {json:[...user.matchAll(/^\[(\d+)\]/gm)].map(m=>({index:+m[1],supported:verify})),cost};
  n++; if(n===failChunk) throw new Error('AI service error 429');
  return {json:qs(),cost};}};};
const goodQ=(page)=>({type:'blanks',prompt:'____ perform photosynthesis in plant cells.',key:{blanks:[{accepted:['chloroplasts']}]},source:{page},evidence:'Chloroplasts perform photosynthesis in plant cells during daylight number 1.'});
test('second AI check that disagrees marks the question for review',async()=>{
  const {handle}=make({ai:fakeAi(()=>[goodQ(1)],{verify:false,cost:0})});
  const r=await handle(req({pages:pages(1)}));
  assert.equal(r.body.questions[0].needsReview,true);
  assert.match(r.body.questions[0].reviewReasons.join(' '),/second AI check/);
});
test('duplicate questions from different chunks are removed',async()=>{
  const big=Array.from({length:30},(_,i)=>({page:i+1,text:sentence(i+1).repeat(40)}));
  const {handle}=make({ai:fakeAi(()=>[goodQ(1)],{cost:0})});
  const r=await handle(req({pages:big}));
  assert.equal(r.body.questions.length,1);
  assert.ok(r.body.duplicatesRemoved>=1);
});
test('a failing chunk is reported and the others still finish',async()=>{
  const big=Array.from({length:30},(_,i)=>({page:i+1,text:sentence(i+1).repeat(40)}));
  const {handle}=make({ai:fakeAi(()=>[goodQ(1)],{cost:0,failChunk:0})});
  const r=await handle(req({pages:big}));
  assert.equal(r.body.chunkErrors.length,1);
  assert.ok(r.body.questions.length>=1);
});
test('the cost cap stops generation part-way and spending is recorded',async()=>{
  const big=Array.from({length:30},(_,i)=>({page:i+1,text:sentence(i+1).repeat(40)}));
  const {handle,usage}=make({ai:fakeAi(()=>[goodQ(1)],{cost:2}),capUsd:5});
  const r=await handle(req({pages:big}));
  assert.equal(r.body.stoppedByCap,true);
  assert.ok(usage.s.v>=5&&usage.s.v<=7);          // stopped right after crossing the cap
  assert.equal(usage.s.adds.length,1);
});
test('free providers ignore the dollar cap; paid ones need a cap above zero',async()=>{
  const free=make({capUsd:0});                                   // mock provider is free
  assert.equal((await free.handle(req({pages:pages(2)}))).status,200);
  const paid=make({ai:{...fakeAi(()=>[goodQ(1)],{cost:1}),paid:true},capUsd:0});
  const r=await paid.handle(req({pages:pages(2)}));
  assert.equal(r.status,403);assert.match(r.body.error,/Paid AI is switched off/);
});
