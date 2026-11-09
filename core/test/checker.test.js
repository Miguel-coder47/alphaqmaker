import test from 'node:test';
import assert from 'node:assert/strict';
import {checkText} from '../src/checkText.js';
const v=(t,a,o)=>checkText(t,a,o).verdict;
const r=(t,a,o)=>checkText(t,a,o).reason;

test('capitals, spaces, punctuation and accents never matter',()=>{
  assert.equal(v('  MITOCHONDRIA!! ',['mitochondria']),'correct');
  assert.equal(v('cell    membrane',['Cell Membrane']),'correct');
  assert.equal(v('Café',['cafe']),'correct');
  assert.equal(v('well-known',['well known']),'correct');
});
test('number formats',()=>{
  assert.equal(v('1,000',['1000']),'correct');
  assert.equal(v('1,000,000',['1000000']),'correct');
  assert.equal(v('five',['5']),'correct');
  assert.equal(v('twenty five',['25']),'correct');
  assert.equal(v('3.14',['3.14']),'correct');
  assert.equal(v('314',['3.14']),'wrong');
  assert.equal(v('1001',['1000']),'wrong');           // digits are never typo-forgiven
  assert.equal(v('five',['5'],{numbers:false}),'wrong');
});
test('one small typo is forgiven on longer words',()=>{
  assert.equal(v('mitochondira',['mitochondria']),'correct');   // swapped letters
  assert.equal(v('nucleas',['nucleus']),'correct');
  assert.equal(r('nucleas',['nucleus']),'typo');
});
test('short words get no typo forgiveness',()=>{
  assert.equal(v('cot',['cat']),'wrong');
  assert.equal(v('cill',['cell']),'wrong');
});
test('a typo that is a different real term is wrong',()=>{
  assert.equal(v('meiosis',['mitosis']),'wrong');
  assert.equal(v('meiosis',['mitosis'],{blocked:['meiosis']}),'wrong');
  assert.equal(r('affect',['effect'],{blocked:['affect']}),'other-term');
  assert.equal(v('ffect',['effect'],{blocked:['affect']}),'almost');   // one edit from both words -> ask
  assert.equal(v('effact',['effect'],{blocked:['affect']}),'correct'); // two edits from the rival -> plain typo
  assert.equal(v('effact',['effect']),'correct');
});
test('plurals',()=>{
  assert.equal(v('cells',['cell']),'correct');
  assert.equal(v('cell',['cells']),'correct');
});
test('accepted-answer lists',()=>{
  assert.equal(v('mitochondrion',['mitochondria','mitochondrion']),'correct');
});
test('almost: close but not clearly right',()=>{
  assert.equal(v('mitochndra',['mitochondria']),'almost');
  assert.equal(v('the mitochondria organelle',['mitochondria']),'almost');
});
test('blank and unrelated answers are wrong',()=>{
  assert.equal(v('',['x']),'wrong');
  assert.equal(r('   ',['x']),'blank');
  assert.equal(v('ribosome',['mitochondria']),'wrong');
});
test('single-letter answers are not mangled by article stripping',()=>{
  assert.equal(v('a',['a']),'correct');
  assert.equal(v('b',['a']),'wrong');
});
test('strict spelling',()=>{
  assert.equal(v('mitochondira',['mitochondria'],{strict:true}),'wrong');
  assert.equal(v('cells',['cell'],{strict:true}),'wrong');
  assert.equal(v('Mitochondria',['mitochondria'],{strict:true}),'correct');
  assert.equal(v('cafe',['café'],{strict:true}),'wrong');
});
