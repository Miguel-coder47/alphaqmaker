import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateFromText} from '../src/ruleBased.js';
import {importQuiz} from '../src/schema.js';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TOOL=path.join(ROOT,'tools/make-quiz.js'),S=path.join(ROOT,'samples');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-'));
let reqs=[],mode='ok';
// A stand-in for Google's server: same URL shape, same JSON shape.
const srv=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{
  const body=JSON.parse(b||'{}');reqs.push({url:req.url,headers:req.headers,body});
  const send=(code,o)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(o));};
  if(mode==='429-once'&&reqs.length===1)return send(429,{error:{message:'Quota exceeded'}});
  if(mode==='429-always')return send(429,{error:{message:'Quota exceeded'}});
  if(mode==='badkey')return send(400,{error:{message:'API key not valid. Please pass a valid API key.'}});
  const parts=body.contents[0].parts,fig=parts.find(p=>p.inlineData),text=parts.find(p=>p.text).text;
  const arr=fig?[{type:'mcq',prompt:'What does the figure show?',options:[{id:'a',text:'A bar chart'},{id:'b',text:'A tree'}],key:{correct:'a'},source:{page:2},evidence:'A bar chart'},
                 {type:'tf',prompt:'The figure is a table.',key:{correct:false},source:{page:9},evidence:'wrong page cited'}]
              :generateFromText(text.split('=====')[1]||text,6);
  send(200,{candidates:[{content:{parts:[{text:JSON.stringify(arr)}]}}]});
});});
let base;
test.before(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${srv.address().port}`;});
test.after(()=>srv.close());
const run=(argv,env={})=>{reqs=[];return new Promise(res=>execFile(process.execPath,[TOOL,...argv],{cwd:tmp,
  env:{...process.env,GEMINI_API_KEY:'k',GEMINI_MODEL:'m1',GEMINI_BASE_URL:base,MAKEQUIZ_RETRY_MS:'30',...env}},(err,so,se)=>res({code:err?err.code:0,out:so+se})));};
const sentText=()=>reqs.map(r=>r.body.contents[0].parts.map(p=>p.text||'').join(' ')).join(' ');

test('one command turns a PDF and a PowerPoint into an importable quiz',async()=>{
  mode='ok';
  const r=await run([path.join(S,'reviewer.pdf'),path.join(S,'deck.pptx'),'--count','10','--title','Trial'],{});
  assert.equal(r.code,0,r.out);assert.match(r.out,/Made \d+ questions/);
  const quiz=importQuiz(fs.readFileSync(path.join(tmp,'trial.quiz.json'),'utf8'));
  assert.ok(quiz.questions.length>=3&&quiz.questions.length<=10);
  assert.ok(quiz.questions.every(q=>['reviewer.pdf','deck.pptx'].includes(q.source.file)));
  const q=reqs[0];
  assert.equal(q.url,'/v1beta/models/m1:generateContent');
  assert.equal(q.headers['x-goog-api-key'],'k');
  assert.ok(q.body.systemInstruction.parts[0].text.includes('JSON array'));
  assert.equal(q.body.generationConfig.responseMimeType,'application/json');
  assert.ok(!sentText().includes('Example Publisher'));
});
test('page ranges only send the chosen pages',async()=>{
  mode='ok';const r=await run([path.join(S,'reviewer.pdf'),'--pages','2','--title','Range'],{});
  assert.equal(r.code,0,r.out);const t=sentText();
  assert.ok(t.includes('Photosynthesis')&&!t.includes('Mitochondria release energy'));
});
test('a hit free limit waits and retries',async()=>{
  mode='429-once';const r=await run([path.join(S,'reviewer.pdf'),'--title','Retry'],{});
  assert.equal(r.code,0,r.out);assert.match(r.out,/Free limit reached\. Waiting/);assert.equal(reqs.length,2);
});
test('a used-up free limit stops with a plain explanation and no crash',async()=>{
  mode='429-always';const r=await run([path.join(S,'reviewer.pdf'),'--title','Limit'],{});
  assert.equal(r.code,1);assert.match(r.out,/free limit is used up/);
});
test('a wrong API key is explained',async()=>{
  mode='badkey';const r=await run([path.join(S,'reviewer.pdf'),'--title','Key'],{});
  assert.equal(r.code,1);assert.match(r.out,/Check GEMINI_API_KEY/);
});
test('no key gives step-by-step setup instructions',async()=>{
  mode='ok';const r=await run([path.join(S,'reviewer.pdf')],{GEMINI_API_KEY:''});
  assert.equal(r.code,1);assert.match(r.out,/aistudio\.google\.com/);assert.match(r.out,/\.env/);
});
test('file rules: 1 to 5 files, only pdf or pptx, scanned files refused',async()=>{
  mode='ok';
  let r=await run(Array.from({length:6},()=>path.join(S,'reviewer.pdf')));assert.match(r.out,/between 1 and 5 files\. You gave 6/);
  r=await run(['old.ppt']);assert.match(r.out,/Only \.pdf and \.pptx/);
  r=await run([path.join(S,'reviewer.pdf'),'--pages','9-12']);assert.match(r.out,/outside this file \(1-3\)/);
  r=await run([path.join(S,'scanned.pdf')]);assert.equal(r.code,1);assert.match(r.out,/scanned or made of images/);assert.equal(reqs.length,0);
});
test('--figures sends the PDF to Gemini and flags the answers for checking',async()=>{
  mode='ok';const r=await run([path.join(S,'reviewer.pdf'),'--figures','2','--count','5','--title','Figs'],{});
  assert.equal(r.code,0,r.out);
  const fig=reqs.find(x=>x.body.contents[0].parts.some(p=>p.inlineData));
  assert.ok(fig,'a request carried the PDF');assert.equal(fig.body.contents[0].parts[0].inlineData.mimeType,'application/pdf');
  const quiz=importQuiz(fs.readFileSync(path.join(tmp,'figs.quiz.json'),'utf8'));
  const f=quiz.questions.filter(q=>(q.reviewReasons||[]).some(x=>/made from a picture/.test(x)));
  assert.equal(f.length,2);assert.ok(f.every(q=>q.needsReview));
  assert.ok(f.some(q=>(q.reviewReasons||[]).some(x=>/not one of the figure pages/.test(x))));
});
