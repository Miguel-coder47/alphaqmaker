import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreQuestion,scoreQuiz,grade,maxPoints} from '../src/score.js';
import {frac,toNumber} from '../src/fraction.js';

const multi={id:'m',type:'multi',points:3,options:['A','B','C','D'].map(id=>({id})),key:{correct:['A','C','D']}};
const pts=(q,resp,s,o)=>{const r=scoreQuestion(q,resp,s,o);return [toNumber(r.earned),r.max,r.pending.length];};

test('multiple choice and true/false',()=>{
  const q={id:'q',type:'mcq',key:{correct:'B'}};
  assert.deepEqual(pts(q,'B'),[1,1,0]);
  assert.deepEqual(pts(q,'C'),[0,1,0]);
  assert.deepEqual(pts({id:'t',type:'tf',key:{correct:false}},false),[1,1,0]);
});
test('choose-all: correct minus wrong, never below zero',()=>{
  assert.deepEqual(pts(multi,['A','C','D']),[3,3,0]);
  assert.deepEqual(pts(multi,['A','C']),[2,3,0]);          // 2/3 of 3 points
  assert.deepEqual(pts(multi,['A','C','B']),[1,3,0]);      // (2-1)/3
  assert.deepEqual(pts(multi,['B']),[0,3,0]);
  assert.deepEqual(pts(multi,[]),[0,3,0]);
  assert.deepEqual(pts(multi,['A','B','C','D']),[2,3,0]);  // (3-1)/3
});
test('choose-all, all-or-nothing mode',()=>{
  const s={multiMode:'all-or-nothing'};
  assert.deepEqual(pts(multi,['A','C','D'],s),[3,3,0]);
  assert.deepEqual(pts(multi,['A','C'],s),[0,3,0]);
});
const mt=(truth,extra={})=>({id:'x',type:'modtf',underlined:'mitochondria',prompt:'Photosynthesis occurs in the mitochondria.',key:{truth,correction:truth?undefined:['chloroplast','chloroplasts']},...extra});
test('modified true/false, split credit (default)',()=>{
  assert.deepEqual(pts(mt(true),{answer:true}),[1,1,0]);
  assert.deepEqual(pts(mt(true),{answer:false,correction:'chloroplast'}),[0,1,0]);
  assert.deepEqual(pts(mt(false),{answer:false,correction:'Chloroplast'}),[2,2,0]);
  assert.deepEqual(pts(mt(false),{answer:false,correction:'nucleus'}),[1,2,0]);
  assert.deepEqual(pts(mt(false),{answer:false,correction:''}),[1,2,0]);
  assert.deepEqual(pts(mt(false),{answer:true}),[0,2,0]);
});
test('modified true/false, all-or-nothing',()=>{
  const s={modTfMode:'strict'};
  assert.deepEqual(pts(mt(false),{answer:false,correction:'chloroplast'},s),[1,1,0]);
  assert.deepEqual(pts(mt(false),{answer:false,correction:'nucleus'},s),[0,1,0]);
  assert.deepEqual(pts(mt(true),{answer:true},s),[1,1,0]);
});
test('matching is per pair, or all-or-nothing',()=>{
  const q={id:'k',type:'matching',key:{pairs:{1:'a',2:'b',3:'c'}}};
  assert.deepEqual(pts(q,{1:'a',2:'b',3:'x'}),[2,3,0]);
  assert.deepEqual(pts(q,{1:'a',2:'b',3:'x'},{matchingMode:'all-or-nothing'}),[0,3,0]);
  assert.deepEqual(pts(q,{1:'a',2:'b',3:'c'},{matchingMode:'all-or-nothing'}),[3,3,0]);
});
test('enumeration: duplicates count once, extras are not penalised, order optional',()=>{
  const q={id:'e',type:'enumeration',key:{items:[{accepted:['nucleus']},{accepted:['ribosome','ribosomes']},{accepted:['mitochondria']}]}};
  assert.deepEqual(pts(q,['Ribosomes','nucleus','nucleus','golgi']),[2,3,0]);
  assert.deepEqual(pts({...q,ordered:true},['ribosome','nucleus','mitochondria']),[1,3,0]);
});
test('fill in the blank: each blank scored on its own, interchangeable blanks any order',()=>{
  const q={id:'b',type:'blanks',key:{blanks:[{accepted:['mitochondria']},{accepted:['nucleus']}]}};
  assert.deepEqual(pts(q,['mitochondria','golgi']),[1,2,0]);
  assert.deepEqual(pts(q,['nucleus','mitochondria']),[0,2,0]);
  assert.deepEqual(pts({...q,interchangeable:true},['nucleus','mitochondria']),[2,2,0]);
});
test('"Almost" answers wait for the user and never score silently',()=>{
  const q={id:'b',type:'blanks',key:{blanks:[{accepted:['mitochondria']}]}};
  assert.deepEqual(pts(q,['mitochndra']),[0,1,1]);
  assert.deepEqual(pts(q,['mitochndra'],{}, {decisions:{'blank:0':true}}),[1,1,0]);
  assert.deepEqual(pts(q,['mitochndra'],{}, {decisions:{'blank:0':false}}),[0,1,0]);
  const m=mt(false);
  assert.deepEqual(pts(m,{answer:false,correction:'the chloroplast organelle'}),[1,2,1]);
  assert.deepEqual(pts(m,{answer:false,correction:'the chloroplast organelle'},{}, {decisions:{correction:true}}),[2,2,0]);
});
test('blocklist is built from other answers in the same quiz',()=>{
  const qs=[
    {id:'1',type:'blanks',key:{blanks:[{accepted:['effect']}]}},
    {id:'2',type:'blanks',key:{blanks:[{accepted:['affect']}]}},
  ];
  const res=scoreQuiz(qs,{1:['ffect'],2:['affect']});
  assert.equal(res.pending,1);                       // 'ffect' is one edit from both words -> user decides
  assert.equal(toNumber(res.items[1].earned),1);
});
test('point totals follow the scoring mode',()=>{
  assert.equal(maxPoints(mt(false),{modTfMode:'split'}),2);
  assert.equal(maxPoints(mt(true),{modTfMode:'split'}),1);
  assert.equal(maxPoints(mt(false),{modTfMode:'strict'}),1);
});
test('passing grade: 100 items, 75% passing',()=>{
  const mk=n=>({earned:frac(n),max:100,pending:0});
  assert.equal(grade(mk(75),{type:'percent',value:75}).passed,true);
  assert.equal(grade(mk(74),{type:'percent',value:75}).passed,false);
  assert.equal(grade(mk(60),{type:'percent',value:60}).passed,true);
  assert.equal(grade(mk(59),{type:'percent',value:60}).passed,false);
});
test('passing grade never rounds up',()=>{
  const r={earned:frac(5999,100),max:100,pending:0};     // 59.99 points of 100
  const g=grade(r,{type:'percent',value:60});
  assert.equal(g.passed,false);
  assert.equal(g.percent,59.9);
  assert.equal(grade({earned:frac(60),max:100,pending:0},{type:'percent',value:60}).passed,true);
});
test('passing by points, and unresolved decisions block the verdict',()=>{
  assert.equal(grade({earned:frac(42),max:50,pending:0},{type:'points',value:40}).passed,true);
  assert.equal(grade({earned:frac(39),max:50,pending:0},{type:'points',value:40}).passed,false);
  assert.equal(grade({earned:frac(75),max:100,pending:1},{type:'percent',value:75}).passed,null);
});
test('partial credit sums exactly (no floating-point drift)',()=>{
  const qs=[0,1,2].map(i=>({...multi,id:'m'+i}));
  const res=scoreQuiz(qs,{m0:['A','C'],m1:['A','C'],m2:['A','C']});   // 3 x (2/3 of 3) = 6 of 9
  assert.equal(res.earned.n,6);assert.equal(res.earned.d,1);assert.equal(res.max,9);
});
