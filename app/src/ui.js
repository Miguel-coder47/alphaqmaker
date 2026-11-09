(()=>{
const app=document.getElementById('app'),body=document.body;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const SUP=['mcq','tf','multi','blanks','matching','enumeration','modtf'];
const TN={mcq:'Multiple choice',tf:'True or false',multi:'Choose all that apply',blanks:'Fill in the blank',matching:'Matching',enumeration:'Enumeration',modtf:'Modified true or false'};
const dl=(name,text)=>{const u=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);};
const slug=t=>String(t||'quiz').replace(/[^\w.-]+/g,'-').toLowerCase();
const hash=x=>[...String(x)].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
const num=x=>Math.round(x*100)/100;
const mk=(id,type,prompt,extra)=>({id,type,prompt,version:1,source:{page:1},...extra});
const op=(...t)=>t.map((x,i)=>({id:'abcdef'[i],text:x}));
const SAMPLE=[
 mk('s01','mcq','Which planet is closest to the Sun?',{options:op('Mercury','Venus','Earth','Mars'),key:{correct:'a'}}),
 mk('s02','mcq','What is the largest planet in the solar system?',{options:op('Saturn','Jupiter','Neptune','Earth'),key:{correct:'b'}}),
 mk('s03','tf','The Sun is a star.',{key:{correct:true}}),
 mk('s04','blanks','Earth takes about ____ days to orbit the Sun once.',{key:{blanks:[{accepted:['365']}]}}),
 mk('s05','blanks','The force that keeps the planets in orbit around the Sun is ____.',{key:{blanks:[{accepted:['gravity']}]}}),
 mk('s06','modtf','Mars is known as the Blue Planet.',{underlined:'Blue',key:{truth:false,correction:['Red']}}),
 mk('s07','modtf','The Moon orbits the Earth.',{underlined:'Earth',key:{truth:true}}),
 mk('s08','multi','Which of these are gas giants?',{options:op('Jupiter','Saturn','Mars','Earth'),key:{correct:['a','b']}}),
 mk('s09','matching','Match each planet to a well-known feature.',{left:[{id:'1',text:'Jupiter'},{id:'2',text:'Saturn'},{id:'3',text:'Venus'}],right:[{id:'a',text:'The Great Red Spot'},{id:'b',text:'Prominent rings'},{id:'c',text:'The hottest surface'}],key:{pairs:{1:'a',2:'b',3:'c'}}}),
 mk('s10','enumeration','Name the four inner (rocky) planets.',{key:{items:[{accepted:['mercury']},{accepted:['venus']},{accepted:['earth']},{accepted:['mars']}]}}),
 mk('s11','blanks','A day on Earth is about ____ hours long.',{key:{blanks:[{accepted:['24']}]}}),
 mk('s12','tf','Venus is the hottest planet in the solar system.',{key:{correct:true}}),
 mk('s13','modtf','Saturn is the planet closest to the Sun.',{underlined:'closest to',key:{truth:false,correction:['farther from','far from','not close to']}})];
const ls=store.get('qm.state')||{};
let S={screen:'home',quiz:store.get('qm.quiz'),qs:[],idx:0,resp:{},flags:{},dec:{},res:null,g:null,msg:'',mode:'all',
  ok:'',addMode:false,hist:ls.hist||[],reports:ls.reports||{},showRep:false,files:[],ranges:[],cards:[],ci:0,cn:0,flip:false,cardRes:{},rep:{},cid:0,sample:null,gen:{msg:'',pct:0},total:0,picked:false,genNote:'',elapsed:0,paused:false,aid:0,onlyMissed:false,sync:'local',
  set:{writer:'manual',strict:false,multiMode:'proportional',matchingMode:'per-pair',incRep:false,modTfMode:'split',pass:75,limit:0,exam:'',count:20,types:['mcq','blanks','modtf'],...store.get('qm.set'),...ls.set}};
const pack=()=>({v:1,hist:S.hist,set:S.set,reports:S.reports});
function persist(){store.set('qm.state',pack());}
function persistQuiz(){store.set('qm.quiz',S.quiz);}
const th=store.get('qm.theme');
body.classList.toggle('dark',th?th==='dark':matchMedia('(prefers-color-scheme: dark)').matches);
const isDark=()=>body.classList.contains('dark');
const settings=()=>({modTfMode:S.set.modTfMode,strict:S.set.strict,multiMode:S.set.multiMode,matchingMode:S.set.matchingMode});
const go=s=>{S.screen=s;render();scrollTo(0,0);};
const cur=()=>S.qs[S.idx];
const answered=q=>{const r=S.resp[q.id];
  if(q.type==='mcq')return !!r;
  if(q.type==='tf')return typeof r==='boolean';
  if(q.type==='multi')return !!(r&&r.length);
  if(q.type==='blanks'||q.type==='enumeration')return !!(r&&r.some(x=>x&&x.trim()));
  if(q.type==='matching')return !!(r&&Object.values(r).some(Boolean));
  return !!r&&typeof r.answer==='boolean';};
const writer=()=>S.set.writer==='basic'?'basic':'manual';
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const parseJ=t=>{t=String(t).replace(/```json|```/g,'').trim();try{return JSON.parse(t);}catch{const a=t.indexOf('['),b=t.lastIndexOf(']');if(a>=0&&b>a)return JSON.parse(t.slice(a,b+1));throw new Error('that reply was not valid JSON');}};
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',PDFW='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',JSZ='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const lib=(url,g)=>window[g]?Promise.resolve():new Promise((ok,no)=>{const e=document.createElement('script');e.src=url;e.onload=ok;e.onerror=()=>no(new Error('could not load the file reader'));document.head.appendChild(e);});
const rdBuf=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error('could not read the file'));r.readAsArrayBuffer(f);});
const decodeX=t=>t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
async function extract(f){
  const ext=(f.name.split('.').pop()||'').toLowerCase(),buf=await rdBuf(f);
  if(ext==='pdf'){
    await lib(PDFJS,'pdfjsLib');window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFW;
    const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
    if(doc.numPages>600)throw new Error('more than 600 pages');
    const pages=[];
    for(let i=1;i<=doc.numPages;i++){const tc=await (await doc.getPage(i)).getTextContent();let t='';for(const it of tc.items)t+=it.str+(it.hasEOL?'\n':' ');
      pages.push({page:i,text:t.replace(/[ \t]+\n/g,'\n').replace(/[ \t]{2,}/g,' ').trim()});}
    return pages;
  }
  if(ext==='pptx'){
    await lib(JSZ,'JSZip');const zip=await window.JSZip.loadAsync(buf);
    const num=n=>+/slide(\d+)\.xml$/.exec(n)[1];
    const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>num(a)-num(b));
    const pages=[];
    for(const [i,n] of names.entries()){const xml=await zip.file(n).async('string');
      pages.push({page:i+1,text:xml.split('</a:p>').map(p=>[...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>decodeX(m[1])).join('')).filter(x=>x.trim()).join('\n')});}
    return pages;
  }
  throw new Error('only .pdf and .pptx files work');
}
function setGen(msg,pct){S.gen={msg,pct};const m=document.getElementById('gm'),b=document.getElementById('gp');if(m&&b){m.textContent=msg;b.style.width=pct+'%';}else if(S.screen==='gen')render();}
function failMsg(m){S.msg=m;S.abort=null;go('home');}
function finish(all,map,notes,N){
  const {kept}=dedupeQuestions(all);
  const clean=kept.filter(q=>!q.problems.length),good=shuffle(clean.filter(q=>!q.needsReview)),flag=shuffle(clean.filter(q=>q.needsReview));
  let pick=good.slice(0,N);const nf=Math.max(0,Math.min(flag.length,N-pick.length));pick=pick.concat(flag.slice(0,nf));
  if(!pick.length)return failMsg('No usable questions were found. '+notes.join(' '));
  const qs=pick.map(({problems,reviewReasons,...q})=>{const m=map[q.source.page]||{};return {...q,source:{page:m.page||q.source.page,file:m.file}};});
  qs.sort(()=>0);
  const base=S.files.length===1?S.files[0].name.replace(/\.[^.]+$/,''):`${S.files.length} files`;
  S.quiz={id:String(Date.now()),title:base,questions:qs};persistQuiz();
  S.genNote=[`${qs.length} questions made.`,nf?`${nf} of them could not be matched exactly to your file, so check those against it.`:'',...notes].filter(Boolean).join(' ');
  S.abort=null;S.files=[];S.msg='';S.set.count=Math.min(S.set.count,100);prep('all');
}
function buildManual(){
  const m=S.man,all=[],errs=[];
  m.use.forEach((c,i)=>{const t=(m.replies[i]||'').trim();if(!t)return;
    try{all.push(...prepareQuestions(parseJ(t),{textFor:()=>c.text,pageRange:c.pages}));}catch(e){errs.push(`Reply ${i+1}: ${e.message}.`);}});
  if(!all.length){m.err=errs.length?errs.join(' '):'Paste at least one reply first.';return render();}
  finish(all,m.map,m.notes.concat(errs),m.N);
}
const pgLabel=(m,c)=>{const a=m.map[c.pages[0]],b=m.map[c.pages[1]];return a&&b?(a.file===b.file?`${a.file} pages ${a.page}–${b.page}`:`${a.file} p.${a.page} to ${b.file} p.${b.page}`):'';};
function manualView(){
  const m=S.man;
  return `${top('Another AI')}<h1 class="t">Get the questions from any chat AI</h1>
  <div class="card"><span class="mu">Nothing here uses Claude. For each prompt: copy it, paste it into Gemini or ChatGPT (free), then paste the AI’s reply into the box under it. You can skip a prompt if you already have enough.</span></div>
  ${m.use.map((c,i)=>{const p=buildSystemPrompt(m.types)+'\n\n=====\n\n'+buildQuestionPrompt(c.text,m.per);
    return `<div class="card" style="gap:10px"><b>Prompt ${i+1} of ${m.use.length}</b><span class="mu" style="font-size:13px">${esc(pgLabel(m,c))} · ${p.length.toLocaleString()} characters</span>
    <textarea class="inp" id="p${i}" readonly rows="4" onclick="this.select()" aria-label="Prompt ${i+1}" style="font-size:12px">${esc(p)}</textarea>
    <button class="ghost" data-act="copyp" data-i="${i}">Copy prompt ${i+1}</button>
    <textarea class="inp" data-reply="${i}" rows="4" placeholder="Paste the AI’s reply here" aria-label="AI reply to prompt ${i+1}" style="font-size:12px">${esc(m.replies[i]||'')}</textarea></div>`;}).join('')}
  ${m.err?`<div class="card no" style="font-weight:500">${esc(m.err)}</div>`:''}
  <div class="foot"><button class="ghost" data-act="home">Cancel</button><button class="btn" data-act="buildman">Build my quiz</button></div>`;
}
async function gen(){
  S.cancel=false;S.abort=new AbortController();S.screen='gen';setGen('Reading your files…',2);render();
  const fail=m=>{S.msg=m;S.abort=null;go('home');};
  try{
    const pages=[],map={},notes=[],N=S.set.count;
    for(const [fi,f] of S.files.entries()){
      setGen(`Reading ${f.name} (${fi+1} of ${S.files.length})`,3+fi*12/S.files.length);
      let ps;try{ps=await extract(f);}catch(e){notes.push(`${f.name}: could not be read (${e.message}).`);continue;}
      ps=stripBoilerplate(ps);
      const rg=(S.ranges[fi]||'').trim();
      if(rg){try{const sel=parsePageRanges(rg,ps.length);ps=ps.filter(p=>sel.includes(p.page));}catch(e){return fail(`${f.name}: ${e.message}`);}}
      const a=assessExtraction(ps);
      if(!a.ok){notes.push(`${f.name}: ${a.message}`);continue;}
      if(a.message)notes.push(`${f.name}: ${a.message}`);
      ps.forEach(p=>{if(p.text.trim()){const g=pages.length+1;pages.push({page:g,text:p.text});map[g]={file:f.name,page:p.page};}});
    }
    if(!pages.length)return fail(notes.join(' ')||'No readable text was found in those files.');
    const chunks=chunkPages(pages,{maxChars:9000}),types=S.set.types.length?S.set.types:['mcq'];
    const wr=writer();
    if(wr==='basic'){const p=Math.max(2,Math.ceil(N*1.5/chunks.length)),all=[];
      chunks.forEach(c=>all.push(...prepareQuestions(generateFromText(c.text,p),{textFor:()=>c.text,pageRange:c.pages})));
      notes.push('Made without AI: fill-in-the-blank questions only.');return finish(all,map,notes,N);}
    const per=wr==='manual'?10:Math.max(3,Math.min(8,Math.ceil(N*1.4/chunks.length))),need=Math.min(chunks.length,Math.ceil(N*1.4/per));
    const use=Array.from({length:need},(_,i)=>chunks[Math.floor(i*chunks.length/need)]);
    if(wr==='manual'){S.man={use,map,notes,per,types,N,replies:[],err:''};S.abort=null;return go('manual');}
    const all=[];
    return finish(all,map,notes,N);
  }catch(e){fail('Something went wrong: '+((e&&e.message)||e));}
}
const isRep=q=>{const r=S.reports[q.id];return !!r&&!r.off;};
function toggleReport(id){const r=S.reports[id],on=!!r&&!r.off;S.reports[id]={t:(r&&r.t)||Date.now(),u:Date.now(),note:(r&&r.note)||'',off:on};persist();}
const dayKey=t=>{const d=new Date(t);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();};
function streak(){const days=new Set(S.hist.map(a=>dayKey(a.t)));const d=new Date();let n=0;if(!days.has(dayKey(d)))d.setDate(d.getDate()-1);while(days.has(dayKey(d))){n++;d.setDate(d.getDate()-1);}return n;}
const sid=q=>String(q.id).slice(0,8);
function stats(){const st={};const g=k=>st[k]||(st[k]={m:0,c:0});for(const a of S.hist){(a.ok||[]).forEach(k=>{g(k).c+=a.cards?2:1;});(a.bad||[]).forEach(k=>{const x=g(k);x.m++;x.c=0;});}return st;}
function weakQs(){if(!S.quiz)return[];const st=stats();return S.quiz.questions.filter(q=>SUP.includes(q.type)&&(S.set.incRep||!isRep(q))&&st[sid(q)]&&st[sid(q)].m>0&&st[sid(q)].c<2);}
const fmt=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const timeLabel=()=>S.set.limit?fmt(S.set.limit*60-S.elapsed):fmt(S.elapsed);
const daysLeft=()=>{if(!S.set.exam)return null;const d=Math.ceil((new Date(S.set.exam+'T00:00:00')-new Date())/864e5);return isNaN(d)?null:d;};
setInterval(()=>{
  if((S.screen!=='quiz'&&S.screen!=='review')||S.paused)return;
  S.elapsed++;
  if(S.set.limit&&S.elapsed>=S.set.limit*60)return submit();
  const el=document.getElementById('tm');if(el)el.textContent=timeLabel();
},1000);
const bar=(label,e,m)=>{const p=m?Math.floor(e*100/m):0,c=p>=S.set.pass?'var(--ok)':'var(--er)';
  return `<div><div class="row"><b class="sp" style="font-size:14px">${label}</b><b style="font-size:14px">${p}%</b></div><div class="bar" style="height:10px;margin-top:6px;flex:none"><i style="width:${p}%;height:10px;background:${c}"></i></div></div>`;};
const top=t=>`<div class="row"><div class="sp"><div class="cap">${t}</div></div><button class="ghost" data-act="theme">${isDark()?'Light':'Dark'} mode</button></div>`;

function repCard(){
  if(!S.quiz)return '';
  const list=S.quiz.questions.filter(isRep);if(!list.length)return '';
  const data=JSON.stringify(list.map(q=>({note:(S.reports[q.id]||{}).note||'',question:q})),null,1);
  return `<div class="card"><b>Reported questions (${list.length})</b><span class="mu">Left out of new quizzes until you restore them.</span>
   ${list.map(q=>`<div class="card" style="gap:8px;padding:14px"><span style="font-size:14px">${esc(q.prompt.slice(0,110))}${q.prompt.length>110?'…':''}</span>
    <input class="inp" data-n="${esc(q.id)}" aria-label="What is wrong with this question?" placeholder="What’s wrong? (optional)" value="${esc((S.reports[q.id]||{}).note||'')}" style="padding:8px 10px;font-size:14px">
    <div class="row" style="flex-wrap:wrap"><button class="ghost" data-act="unreport" data-q="${esc(q.id)}">Restore</button><button class="ghost" style="color:var(--er)" data-act="delq" data-q="${esc(q.id)}">Delete for good</button></div></div>`).join('')}
   <button class="ghost" data-act="showrep">${S.showRep?'Hide':'Show'} reported questions as text (to fix them)</button>
   ${S.showRep?`<textarea class="inp" readonly rows="8" aria-label="Reported questions as text" onclick="this.select()" style="font-size:12px">${esc(data)}</textarea><span class="mu" style="font-size:13px">Tap the box, copy it, and send it to Claude to get corrected versions.</span>`:''}</div>`;
}
function home(){
  const z=S.quiz,w=weakQs().length,dl=daysLeft(),h=S.hist.filter(a=>!a.cards),last=h.slice(-10),avg=h.length?Math.round(h.slice(-5).reduce((n,a)=>n+a.pct,0)/Math.min(5,h.length)):null;
  const syncTxt='Saved in this browser only. Nothing is uploaded.';
  return `<div class="row"><div class="sp"><div class="cap">${dl===null?'alphaQmaker':dl>0?'Finals in '+dl+' day'+(dl===1?'':'s'):dl===0?'Finals are today':'alphaQmaker'}</div></div><button class="ghost" data-act="theme">${isDark()?'Light':'Dark'} mode</button></div>
  <div><h1 class="t">Ready to practice?</h1><div class="mu" style="margin-top:6px">${syncTxt}</div></div>
  ${S.msg?`<div class="card no" style="font-weight:500">${esc(S.msg)}</div>`:''}
  ${S.ok?`<div class="card ok" style="font-weight:500">${esc(S.ok)}</div>`:''}
  ${z?`<div class="card hero"><span class="cap" style="color:inherit">Your quiz</span><div class="q" style="font-size:22px">${esc(z.title)}</div><span>${z.questions.length} questions</span><div class="row" style="flex-wrap:wrap"><button data-act="start">Start quiz</button>${w?`<button data-act="cards">Flashcards (${w})</button><button data-act="weak">Weak-spot quiz</button>`:''}</div></div>`:''}
  <div class="row"><div class="card sp"><span class="n">${streak()}</span><span class="mu">Day streak</span></div><div class="card sp"><span class="n">${avg===null?'–':avg+'%'}</span><span class="mu">Last 5 average</span></div><div class="card sp"><span class="n">${w}</span><span class="mu">Weak spots</span></div></div>
  ${last.length?`<div class="card"><b>Recent scores</b><div class="row" style="align-items:flex-end;height:90px;gap:6px">${last.map(a=>`<div title="${a.pct}%" style="flex:1;height:${Math.max(6,a.pct*0.9)}px;border-radius:6px;background:${a.passed===false?'var(--er)':'var(--ac)'}"></div>`).join('')}</div><span class="mu" style="font-size:13px">Newest on the right. Red = not passed.</span>
   ${last.slice(-3).reverse().map(a=>`<div class="row"><span class="sp mu">${new Date(a.t).toLocaleDateString()}${a.weak?' · weak spots':''}</span><b>${a.pct}%</b><span class="tag" style="${a.passed?'':'background:var(--ers);color:var(--er)'}">${a.passed?'Passed':a.passed===false?'Not passed':'Pending'}</span></div>`).join('')}</div>`:''}
  <div class="card"><b>Make a quiz from your files</b><span class="mu">Choose 1 to 5 files: PDF or PowerPoint (.pptx). Reading your files happens on your device and costs nothing.</span>
   <input type="file" id="docs" accept=".pdf,.pptx" multiple aria-label="Choose 1 to 5 PDF or PowerPoint files">
   ${S.files.map((f,i)=>`<label class="row" style="gap:8px;font-size:14px"><span class="sp">${esc(f.name)}</span><input class="inp" data-r="${i}" aria-label="Pages to use in ${esc(f.name)}" placeholder="All pages (e.g. 12-30)" value="${esc(S.ranges[i]||'')}" style="width:170px;padding:8px 10px"></label>`).join('')}
   ${S.files.length?`<span class="mu" style="font-size:13px">Pages or slides to use. Leave blank for every page. Examples: 12-30, or 1-5, 9.</span>`:''}
   <div class="row" style="flex-wrap:wrap;gap:12px;font-size:14px">${Object.entries(TN).map(([k,l])=>`<label class="row" style="gap:6px"><input type="checkbox" id="ty-${k}"${S.set.types.includes(k)?' checked':''}>${l}</label>`).join('')}</div>
   <label class="row"><span class="sp">Who writes the questions?</span><select class="inp" id="writer"><option value="manual"${writer()==='manual'?' selected':''}>Another AI (free): I copy and paste</option><option value="basic"${writer()==='basic'?' selected':''}>Basic, no AI (free): fill in the blank only</option></select></label>
   <button class="btn" data-act="gen"${S.files.length>=1&&S.files.length<=5?'':' disabled style="opacity:.45"'}>${{manual:`Get prompts for ${S.set.count} questions`,basic:`Make ${S.set.count} questions`}[writer()]}</button></div>
  ${repCard()}
  <div class="card"><b>Import a quiz</b><span class="mu">Choose the .quiz.json file made by the check tool.</span>
   <input type="file" id="f" accept=".json,application/json" aria-label="Choose a quiz file">
   ${S.quiz?`<label class="row" style="gap:8px;font-size:14px"><input type="checkbox" id="addmode"${S.addMode?' checked':''}>Add to my current quiz instead of replacing it</label>`:''}
   <button class="ghost" data-act="sample">Try the sample quiz</button></div>
  <div class="card"><b>Settings</b>
   <label class="row"><span class="sp">How many questions</span><select class="inp" id="count">${[10,20,30,40,50,60,70,80,90,100].map(n=>`<option value="${n}"${S.set.count===n?' selected':''}>${n}</option>`).join('')}</select></label>
   <label class="row"><span class="sp">Passing grade (%)</span><input class="inp" id="pass" type="number" min="1" max="100" step="0.5" value="${S.set.pass}" style="width:96px"></label>
   <label class="row"><span class="sp">Time limit (minutes, 0 = none)</span><input class="inp" id="limit" type="number" min="0" max="300" value="${S.set.limit}" style="width:96px"></label>
   <label class="row"><span class="sp">Exam date</span><input class="inp" id="exam" type="date" value="${esc(S.set.exam)}"></label>
   <label class="row"><span class="sp">Modified true or false</span><select class="inp" id="mt"><option value="split"${S.set.modTfMode==='split'?' selected':''}>Split credit</option><option value="strict"${S.set.modTfMode==='strict'?' selected':''}>All or nothing</option></select></label>
   <label class="row"><span class="sp">Choose all that apply</span><select class="inp" id="mm"><option value="proportional"${S.set.multiMode==='proportional'?' selected':''}>Partial credit</option><option value="all-or-nothing"${S.set.multiMode==='all-or-nothing'?' selected':''}>All or nothing</option></select></label>
   <label class="row"><span class="sp">Matching</span><select class="inp" id="mc"><option value="per-pair"${S.set.matchingMode==='per-pair'?' selected':''}>Point per pair</option><option value="all-or-nothing"${S.set.matchingMode==='all-or-nothing'?' selected':''}>All or nothing</option></select></label>
   <label class="row"><span class="sp">Include reported questions</span><input type="checkbox" id="increp"${S.set.incRep?' checked':''}></label>
   <label class="row"><span class="sp">Strict spelling</span><input type="checkbox" id="strict"${S.set.strict?' checked':''}></label></div>
  <div class="card"><b>Your data</b><span class="mu">Everything stays in this browser. Back it up, or move it to another device.</span>
   <div class="row" style="flex-wrap:wrap"><button class="ghost" data-act="backup">Back up my data</button>${S.quiz?`<button class="ghost" data-act="dlquiz">Download this quiz</button>`:''}</div>
   <label class="mu" style="font-size:14px">Restore a backup <input type="file" id="restore" accept=".json,application/json" aria-label="Restore a backup file"></label></div>
  <div class="mu" style="font-size:13px;text-align:center"><a class="lnk" href="../">About alphaQmaker</a> · <a class="lnk" href="__GITHUB_URL__" rel="noopener">Source code</a></div>`;
}
function rules(){
  const total=S.qs.reduce((n,q)=>n+maxPoints(q,settings()),0),types=new Set(S.qs.map(q=>q.type));
  const typed=types.has('blanks')||types.has('modtf');
  const li=t=>`<div class="row" style="align-items:flex-start"><span class="b">•</span><span class="sp" style="font-size:15px;line-height:1.45">${t}</span></div>`;
  return `${top('Before you start')}
  <h1 class="t">${S.mode==='weak'?'Weak spots practice':'How answers are checked'}</h1>
  ${typed?`<div class="card" style="gap:12px">
   ${li('Capital letters, extra spaces, punctuation, and accents don’t matter.')}
   ${li('1,000 and 1000 are the same. 5 and five count too.')}
   ${li(S.set.strict?'<b>Strict spelling is on:</b> no typo forgiveness.':'One small typo is forgiven on longer words. “Mitochondira” counts.')}
   ${li('A typo that makes a different real term is wrong. Meiosis is not mitosis.')}
   ${li('Close but not clear? You’ll see “Almost: you decide” at the end instead of a silent miss.')}</div>`:''}
  ${types.has('modtf')?`<div class="card" style="gap:8px"><b>Modified true or false</b><span class="mu">${S.set.modTfMode==='split'?'A true statement is worth 1 point. A false statement is worth 2: 1 for answering False and 1 for the right word.':'Every item is worth 1 point. For a false statement you need both False and the right word.'}</span></div>`:''}
  ${['tf','multi','matching','enumeration'].some(x=>types.has(x))?`<div class="card" style="gap:10px"><b>Other question types</b>
   ${types.has('tf')?li('True or false: 1 point.'):''}
   ${types.has('multi')?li(S.set.multiMode==='all-or-nothing'?'Choose all that apply: you only score if you pick every right answer and nothing else.':'Choose all that apply: each right pick earns part of the point and each wrong pick takes one part away (never below 0).'):''}
   ${types.has('matching')?li(S.set.matchingMode==='all-or-nothing'?'Matching: you only score if every pair is right.':'Matching: 1 point for each correct pair.'):''}
   ${types.has('enumeration')?li('Enumeration: 1 point for each correct item. A repeated answer counts once, and extra wrong items cost nothing.'):''}</div>`:''}
  <div class="card row"><div class="sp"><b>${S.qs.length} questions, ${total} points</b><div class="mu">Passing grade: ${S.set.pass}% (${Math.ceil(total*S.set.pass/100)} points)${S.set.limit?' · Time limit: '+S.set.limit+' min':''}</div></div></div>
  ${S.hiddenRep?`<div class="mu">${S.hiddenRep} reported question${S.hiddenRep===1?'':'s'} left out.</div>`:''}
  ${S.picked?`<div class="mu">${S.qs.length} of ${S.total} questions, picked at random. Change “How many questions” in Settings.</div>`:''}
  ${S.genNote?`<div class="card" style="font-size:14px">${esc(S.genNote)}</div>`:''}
  ${S.skipped?`<div class="mu">${S.skipped} question(s) of types not supported yet were left out.</div>`:''}
  <div class="foot"><button class="ghost" data-act="home">Cancel</button><button class="btn" data-act="begin">Start</button></div>`;
}
const inp=(i,v)=>`<input class="inp" data-b="${i}" aria-label="Blank ${i+1}" value="${esc(v||'')}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:150px;padding:4px 10px;font-size:17px;margin:0 4px">`;
function quiz(){
  if(S.paused)return `${top('Paused')}<div class="card" style="align-items:center;text-align:center;gap:14px;padding:32px"><div class="q">Quiz paused</div><span class="mu">Questions are hidden while the timer is stopped.</span><button class="btn" data-act="resume">Resume</button></div>`;
  const q=cur(),n=S.qs.length,r=S.resp[q.id],last=S.idx===n-1;
  let h='';
  if(q.type==='mcq'){
    h=`<h2 class="q">${esc(q.prompt)}</h2>`+q.options.map(o=>`<button class="opt${r===o.id?' pick':''}" data-act="pick" data-id="${esc(o.id)}">${esc(o.text)}</button>`).join('');
  }else if(q.type==='blanks'){
    const parts=q.prompt.split(/_{3,}/);let i=0,t='';
    parts.forEach((p,k)=>{t+=esc(p);if(k<parts.length-1)t+=i<q.key.blanks.length?inp(i,(r||[])[i++]):'____';});
    while(i<q.key.blanks.length){t+=' '+inp(i,(r||[])[i]);i++;}
    h=`<div class="card q" style="line-height:2.1;padding:22px">${t}</div><span class="mu">Capitals and spacing don’t matter. One small typo is fine.</span>`;
  }else if(q.type==='modtf'){
    const u=esc(q.underlined),p=esc(q.prompt).replace(u,`<u style="text-decoration-color:var(--ac);text-decoration-thickness:3px">${u}</u>`);
    h=`<div class="card q" style="padding:22px">${p}</div>
    <div class="row"><button class="opt${r&&r.answer===true?' pick':''}" data-act="tf" data-v="1" style="text-align:center">True</button><button class="opt${r&&r.answer===false?' pick':''}" data-act="tf" data-v="0" style="text-align:center">False</button></div>
    ${r&&r.answer===false?`<label class="mu" for="fix">Replace the underlined word with the correct one</label><input id="fix" class="inp" value="${esc(r.correction||'')}" autocomplete="off" autocapitalize="off" spellcheck="false" style="border:2px solid var(--ac)">`:''}`;
  }else if(q.type==='tf'){
    h=`<div class="card q" style="padding:22px">${esc(q.prompt)}</div><div class="row"><button class="opt${r===true?' pick':''}" data-act="tf2" data-v="1" style="text-align:center">True</button><button class="opt${r===false?' pick':''}" data-act="tf2" data-v="0" style="text-align:center">False</button></div>`;
  }else if(q.type==='multi'){
    h=`<h2 class="q">${esc(q.prompt)}</h2><span class="mu">Select all that apply.</span>`+q.options.map(o=>`<button class="opt${(r||[]).includes(o.id)?' pick':''}" aria-pressed="${(r||[]).includes(o.id)}" data-act="tog" data-id="${esc(o.id)}">${esc(o.text)}</button>`).join('');
  }else if(q.type==='matching'){
    const rs=q.right.slice().sort((x,y)=>hash(q.id+x.id)-hash(q.id+y.id));
    h=`<h2 class="q">${esc(q.prompt)}</h2>`+q.left.map(l=>`<div class="card" style="gap:8px;padding:14px"><b>${esc(l.text)}</b><select class="inp" data-m="${esc(l.id)}" aria-label="Match for ${esc(l.text)}"><option value="">Choose…</option>${rs.map(o=>`<option value="${esc(o.id)}"${r&&r[l.id]===o.id?' selected':''}>${esc(o.text)}</option>`).join('')}</select></div>`).join('');
  }else if(q.type==='enumeration'){
    const n=q.key.items.length;
    h=`<h2 class="q">${esc(q.prompt)}</h2><span class="mu">${n} item${n===1?'':'s'}${q.ordered?', in order':', any order'}.</span>`+Array.from({length:n},(_,i)=>`<input class="inp" data-e="${i}" aria-label="Item ${i+1}" placeholder="Item ${i+1}" value="${esc((r||[])[i]||'')}" autocomplete="off" autocapitalize="off" spellcheck="false">`).join('');
  }
  const tag=TN[q.type];
  const nav=`<div class="g">${S.qs.map((x,k)=>`<div role="button" tabindex="0" data-act="jump" data-i="${k}" class="${k===S.idx?'c ':''}${S.flags[x.id]?'f':answered(x)?'a':''}">${k+1}</div>`).join('')}</div>`;
  return `<div class="row"><button class="ghost" data-act="home">Exit</button><div class="bar"><i style="width:${(S.idx+1)/n*100}%"></i></div><b>${S.idx+1} / ${n}</b><span class="chip" id="tm" style="display:flex;align-items:center;font-weight:600" aria-label="Timer">${timeLabel()}</span><button class="ghost" data-act="pause">Pause</button></div>
  <div class="qgrid"><div class="qmain">
  <div class="row"><span class="tag">${tag}</span><span class="sp"></span><button class="ghost${S.flags[q.id]?' sel':''}" data-act="flag">${S.flags[q.id]?'Flagged':'Flag'}</button><button class="ghost${isRep(q)?' sel':''}" data-act="report" aria-label="Report this question as bad">${isRep(q)?'Reported':'Report'}</button></div>
  ${h}
  <div class="foot"><button class="ghost" data-act="back"${S.idx===0?' disabled style="opacity:.4"':''}>Back</button><button class="ghost" data-act="review">Jump</button><button class="btn" data-act="next">${last?'Review':'Next'}</button></div></div>
  <aside class="side card"><b>Question navigator</b>${nav}<span class="mu" style="font-size:13px">Filled = answered, amber = flagged, outline = open. Click a number to go back.</span></aside></div>`;
}
function review(){
  const un=S.qs.filter(q=>!answered(q)).length,fl=S.qs.filter(q=>S.flags[q.id]).length;
  return `<div class="row"><button class="ghost" data-act="quizback">Back</button><span class="sp"></span><b>Review before submit</b></div>
  <h2 class="q">Jump back to any question</h2>
  <div class="g">${S.qs.map((q,i)=>`<div role="button" tabindex="0" data-act="jump" data-i="${i}" class="${S.flags[q.id]?'f':answered(q)?'a':''}">${i+1}</div>`).join('')}</div>
  <div class="card mu"><span><b style="color:var(--ink)">${S.qs.length-un}</b> answered, <b style="color:var(--gd)">${fl}</b> flagged, <b style="color:var(--er)">${un}</b> unanswered.</span><span>Filled = answered, amber = flagged, outline = not answered.</span></div>
  <div class="foot"><button class="ghost" data-act="firstopen">First unanswered</button><button class="btn" data-act="submit">Submit quiz</button></div>`;
}
const opt=(q,id)=>(q.options.find(o=>o.id===id)||{}).text;
const lt=(q,side,id)=>((q[side]||[]).find(o=>o.id===id)||{}).text||'?';
const NONE='(no answer)';
const userText=q=>{const r=S.resp[q.id];
  if(q.type==='mcq')return opt(q,r)||NONE;
  if(q.type==='tf')return typeof r==='boolean'?(r?'True':'False'):NONE;
  if(q.type==='multi')return r&&r.length?r.map(id=>opt(q,id)).join(', '):NONE;
  if(q.type==='matching'){const l=q.left.filter(x=>r&&r[x.id]).map(x=>`${x.text} → ${lt(q,'right',r[x.id])}`);return l.length?l.join('; '):NONE;}
  if(q.type==='enumeration'||q.type==='blanks')return (r&&r.filter(x=>x&&x.trim()).join(' / '))||NONE;
  return r&&typeof r.answer==='boolean'?(r.answer?'True':'False'+(r.correction?`, “${r.correction}”`:'')):NONE;};
const keyText=q=>{
  if(q.type==='mcq')return opt(q,q.key.correct);
  if(q.type==='tf')return q.key.correct?'True':'False';
  if(q.type==='multi')return q.key.correct.map(id=>opt(q,id)).join(', ');
  if(q.type==='matching')return Object.entries(q.key.pairs).map(([l,r])=>`${lt(q,'left',l)} → ${lt(q,'right',r)}`).join('; ');
  if(q.type==='blanks')return q.key.blanks.map(b=>b.accepted[0]).join(' / ');
  if(q.type==='enumeration')return q.key.items.map(x=>x.accepted[0]).join(' / ');
  return q.key.truth?'True':'False, correct word: '+q.key.correction.slice(0,2).join(' or ');};
function recompute(){S.res=scoreQuiz(S.qs,S.resp,{settings:settings(),decisions:S.dec});S.g=grade(S.res,{type:'percent',value:S.set.pass});}
function commit(){
  const ok=[],bad=[],types={};
  S.qs.forEach((q,i)=>{const it=S.res.items[i],e=toNumber(it.earned),t=types[q.type]||(types[q.type]=[0,0]);t[0]+=e;t[1]+=it.max;
    if(!it.pending.length)(e===it.max?ok:bad).push(sid(q));});
  const rec={id:S.aid,t:S.aid,title:S.quiz.title,pct:S.g.percent,passed:S.g.passed,earned:S.g.earned,max:S.g.max,secs:S.elapsed,ok,bad,types,weak:S.mode==='weak'};
  const k=S.hist.findIndex(a=>a.id===S.aid);if(k>=0)S.hist[k]=rec;else S.hist.push(rec);
  S.hist=S.hist.slice(-40);persist();
}
function submit(){recompute();commit();go('results');}
function parts(){
  const pg=S.qs.map(q=>q.source&&q.source.page).filter(Number.isInteger);if(!pg.length)return[];
  const lo=Math.min(...pg),hi=Math.max(...pg),n=Math.min(4,hi-lo+1),w=Math.ceil((hi-lo+1)/n);
  const b=Array.from({length:n},(_,k)=>({a:lo+k*w,b:Math.min(hi,lo+(k+1)*w-1),e:0,m:0}));
  S.qs.forEach((q,i)=>{const p=q.source&&q.source.page;if(!Number.isInteger(p))return;const k=Math.min(n-1,Math.floor((p-lo)/w));b[k].e+=toNumber(S.res.items[i].earned);b[k].m+=S.res.items[i].max;});
  return b.filter(x=>x.m);
}
function results(){
  const g=S.g,p=g.percent,v=g.passed===null?['Waiting on '+g.pending+' decision(s) below','var(--gd)']:g.passed?['Passed','var(--ok)']:['Not passed','var(--er)'];
  const full=S.res.items.filter(it=>toNumber(it.earned)===it.max).length,w=weakQs().length;
  const tn=TN,tt={};
  S.qs.forEach((q,i)=>{const t=tt[q.type]||(tt[q.type]=[0,0]);t[0]+=toNumber(S.res.items[i].earned);t[1]+=S.res.items[i].max;});
  const items=S.qs.map((q,i)=>{
    const it=S.res.items[i],e=toNumber(it.earned),cls=it.pending.length?'':e===it.max?'ok':e>0?'pick':'no';
    if(S.onlyMissed&&e===it.max&&!it.pending.length)return '';
    return `<div class="card ${cls}" style="font-weight:400;color:var(--ink);gap:8px;${it.pending.length?'background:var(--gds);border:2px solid var(--gd)':''}">
     <div class="row"><b class="sp">${i+1}. ${esc(q.prompt)}</b><b>${num(e)} / ${it.max}</b></div>
     <div class="mu">Your answer: <b style="color:var(--ink)">${esc(userText(q))}</b></div>
     ${e<it.max||it.pending.length?`<div class="mu">Correct: <b style="color:var(--ink)">${esc(keyText(q))}</b></div>`:''}
     ${it.pending.map(x=>`<div class="mu"><b style="color:var(--gd)">Almost: you decide.</b> You typed “${esc(x.typed)}”. Accepted: ${esc(x.accepted.join(', '))}.</div><div class="row"><button class="ghost" data-act="dec" data-q="${esc(q.id)}" data-k="${esc(x.key)}" data-v="1">Count it as correct</button><button class="ghost" data-act="dec" data-q="${esc(q.id)}" data-k="${esc(x.key)}" data-v="0">Mark it wrong</button></div>`).join('')}
     ${q.evidence?`<div class="mu" style="font-size:13px">${q.source&&q.source.file?esc(q.source.file)+' · ':''}Page ${q.source&&q.source.page}: “${esc(String(q.evidence).slice(0,170))}”</div>`:''}
     <button class="ghost" data-act="report" data-q="${esc(q.id)}" style="align-self:flex-start;font-size:13px;min-height:36px">${isRep(q)?'Reported (tap to undo)':'Report this question'}</button></div>`;}).join('');
  return `${top('Results')}
  <div class="card" style="align-items:center;gap:14px;text-align:center"><div style="width:170px;height:170px;border-radius:85px;background:conic-gradient(var(--ac) 0 ${p}%,var(--ln) ${p}% 100%);display:flex;align-items:center;justify-content:center"><div style="width:130px;height:130px;border-radius:65px;background:var(--sf);display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="n" style="font-size:40px">${p}%</span><span class="mu">${num(g.earned)} of ${g.max}</span></div></div>
   <b style="color:${v[1]};font-size:18px">${v[0]}</b><span class="mu">Passing grade: ${S.set.pass}%</span></div>
  <div class="row"><div class="card sp"><span class="n">${fmt(S.elapsed)}</span><span class="mu">Time taken</span></div><div class="card sp"><span class="n">${full}/${S.qs.length}</span><span class="mu">Fully correct</span></div></div>
  <div class="card" style="gap:14px"><b class="q" style="font-size:20px">Accuracy by question type</b>${Object.entries(tt).map(([k,[e,m]])=>bar(tn[k]||k,e,m)).join('')}
   ${parts().length>1?`<b class="q" style="font-size:20px;margin-top:6px">Accuracy by part of the file</b>${parts().map(x=>bar(`Slides ${x.a}–${x.b}`,x.e,x.m)).join('')}`:''}</div>
  <div class="row"><div class="cap sp">Review every answer</div><button class="ghost" data-act="missed">${S.onlyMissed?'Show all':'Show only missed'}</button></div>${items}
  <div class="foot" style="flex-wrap:wrap"><button class="ghost" data-act="home">Home</button>${w?`<button class="ghost" data-act="cards">Flashcards (${w})</button><button class="ghost" data-act="weak">Weak-spot quiz</button>`:''}<button class="btn" data-act="begin">Retake</button></div>`;
}
function genView(){return `${top('Making your quiz')}<h1 class="t">Writing questions…</h1><div class="card"><b id="gm">${esc(S.gen.msg)}</b><div class="bar" style="height:10px;flex:none"><i id="gp" style="width:${S.gen.pct}%;height:10px;transition:width .4s"></i></div><span class="mu">This uses your Claude account and can take a minute or two. Keep this page open.</span></div><button class="ghost" data-act="cancelgen">Cancel</button>`;}
function cardsStart(){
  const w=weakQs();if(!w.length){S.msg='No weak spots right now. Take a quiz first.';return go('home');}
  S.cards=shuffle(w.slice());S.cn=S.cards.length;S.ci=0;S.flip=false;S.cardRes={};S.rep={};S.cid=Date.now();S.msg='';go('cards');
}
function cardsSave(){
  const ok=[],bad=[];for(const [k,v] of Object.entries(S.cardRes))(v==='ok'?ok:bad).push(k);
  const rec={id:S.cid,t:S.cid,title:S.quiz.title,cards:true,weak:true,ok,bad};
  const i=S.hist.findIndex(a=>a.id===S.cid);if(i>=0)S.hist[i]=rec;else S.hist.push(rec);
  S.hist=S.hist.slice(-40);persist();
}
function rate(good){
  const q=S.cards[S.ci],k=sid(q);
  if(!good){S.cardRes[k]='bad';if((S.rep[k]||0)<2){S.rep[k]=(S.rep[k]||0)+1;S.cards.push(q);}}
  else if(S.cardRes[k]!=='bad')S.cardRes[k]='ok';
  S.ci++;S.flip=false;cardsSave();render();
}
function cardFront(q){
  if(q.type==='tf')return `<span class="cap" style="color:inherit">True or false?</span><div class="q" style="color:inherit">${esc(q.prompt)}</div>`;
  if(q.type==='multi')return `<span class="cap" style="color:inherit">Choose all that apply</span><div class="q" style="color:inherit">${esc(q.prompt)}</div><div style="font-size:15px;text-align:left">${q.options.map(o=>'• '+esc(o.text)).join('<br>')}</div>`;
  if(q.type==='matching')return `<span class="cap" style="color:inherit">Match each one</span><div class="q" style="color:inherit">${esc(q.prompt)}</div><div style="font-size:15px;text-align:left">${q.left.map(o=>'• '+esc(o.text)).join('<br>')}</div>`;
  if(q.type==='enumeration')return `<span class="cap" style="color:inherit">List them</span><div class="q" style="color:inherit">${esc(q.prompt)}</div><span style="font-size:14px">${q.key.items.length} item${q.key.items.length===1?'':'s'}</span>`;
  if(q.type==='modtf'){const u=esc(q.underlined);return `<span class="cap" style="color:inherit">True or false?</span><div class="q" style="color:inherit">${esc(q.prompt).replace(u,`<u>${u}</u>`)}</div><span style="font-size:14px">If it’s false, what is the right word?</span>`;}
  return `<span class="cap" style="color:inherit">${q.type==='blanks'?'Fill in the blank':'Question'}</span><div class="q" style="color:inherit">${esc(q.prompt)}</div>`;
}
function cardsView(){
  if(S.ci>=S.cards.length){
    const r=Object.values(S.cardRes),first=r.filter(x=>x==='ok').length,again=r.filter(x=>x==='bad').length,w=weakQs().length;
    return `${top('Flashcards')}<h1 class="t">Done</h1>
    <div class="row"><div class="card sp"><span class="n">${first}</span><span class="mu">Right first time (cleared)</span></div><div class="card sp"><span class="n">${again}</span><span class="mu">Needed another try</span></div></div>
    <div class="card mu">${w?`${w} weak spot${w===1?'':'s'} left. Cards you miss come back until you get them.`:'No weak spots left. Nice work.'}</div>
    <div class="foot" style="flex-wrap:wrap"><button class="ghost" data-act="home">Home</button>${w?`<button class="btn" data-act="cards">Review again</button>`:''}</div>`;
  }
  const q=S.cards[S.ci],left=S.cards.length-S.ci,extra=S.cards.length-S.cn;
  const back=`<span class="cap" style="color:inherit">Answer</span><div class="q" style="color:inherit">${esc(keyText(q))}</div>${q.evidence?`<span style="font-size:13px">${q.source&&q.source.file?esc(q.source.file)+' · ':''}Page ${q.source&&q.source.page}: “${esc(String(q.evidence).slice(0,170))}”</span>`:''}`;
  return `<div class="row"><button class="ghost" data-act="home">Exit</button><div class="bar"><i style="width:${Math.min(100,S.ci/S.cards.length*100)}%"></i></div><b>${left} left</b></div>
  <div class="mu">${S.cn} weak spots${extra?` + ${extra} to repeat`:''}. Get a card right first time to clear it.</div>
  <button class="card hero" data-act="flip" aria-label="${S.flip?'Showing answer':'Show answer'}" style="min-height:300px;align-items:center;justify-content:center;text-align:center;border-radius:28px;font:inherit;cursor:pointer;gap:14px;padding:26px">${S.flip?back:cardFront(q)+'<span style="font-size:14px;margin-top:8px">Tap to show the answer</span>'}</button>
  ${S.flip?`<div class="row"><button class="opt no" data-act="miss" style="text-align:center;min-height:64px">Missed it</button><button class="opt ok" data-act="got" style="text-align:center;min-height:64px">Got it</button></div><button class="ghost" data-act="report" data-q="${esc(q.id)}">${isRep(q)?'Reported (tap to undo)':'Report this question'}</button>`:`<button class="btn" data-act="flip">Show answer</button>`}`;
}
const screens={home,rules,quiz,review,results,gen:genView,cards:cardsView,manual:manualView};
function render(){const h=screens[S.screen]();if(S.screen!=='home')S.ok='';app.innerHTML=h;}
function begin(){S.genNote=S.mode==='weak'?'':S.genNote;S.idx=0;S.resp={};S.flags={};S.dec={};S.elapsed=0;S.paused=false;S.onlyMissed=false;S.aid=Date.now();go('quiz');}
function prep(mode){
  S.mode=mode||'all';const all=S.mode==='weak'?weakQs():S.quiz.questions;
  S.hiddenRep=S.mode==='weak'||S.set.incRep?0:all.filter(isRep).length;
  S.qs=all.filter(q=>SUP.includes(q.type)&&(S.set.incRep||!isRep(q)));S.skipped=S.mode==='weak'?0:all.filter(q=>!SUP.includes(q.type)).length;
  S.total=S.qs.length;S.picked=false;
  if(S.set.count&&S.qs.length>S.set.count){const keep=new Set(shuffle(S.qs.map((_,i)=>i)).slice(0,S.set.count));S.qs=S.qs.filter((_,i)=>keep.has(i));S.picked=true;}
  if(!S.qs.length){S.msg=S.mode==='weak'?'No weak spots right now. Take the quiz first.':'This quiz has no question types the app supports yet.';return go('home');}
  S.msg='';go('rules');
}
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const a=b.dataset.act;
  if(a==='theme'){body.classList.toggle('dark');store.set('qm.theme',isDark()?'dark':'light');return render();}
  if(a==='sample'){S.quiz={title:'Sample',questions:SAMPLE};return prep('all');}
  if(a==='start'){S.genNote='';return prep('all');}
  if(a==='backup'){dl('alphaqmaker-backup.json',JSON.stringify({app:'alphaqmaker',v:1,state:pack(),quiz:S.quiz||null}));return;}
  if(a==='dlquiz'){dl(slug(S.quiz.title)+'.quiz.json',exportQuiz(S.quiz));return;}
  if(a==='gen')return gen();
  if(a==='report'){const id=b.dataset.q||(S.screen==='quiz'&&cur()?cur().id:null);if(id){toggleReport(id);const y=scrollY;render();scrollTo(0,y);}return;}
  if(a==='unreport'){toggleReport(b.dataset.q);return render();}
  if(a==='showrep'){S.showRep=!S.showRep;return render();}
  if(a==='delq'){const id=b.dataset.q;if(S.quiz){S.quiz.questions=S.quiz.questions.filter(q=>q.id!==id);persistQuiz();}S.reports[id]={t:Date.now(),u:Date.now(),note:'',off:true};persist();return render();}
  if(a==='tf2'){S.resp[cur().id]=b.dataset.v==='1';return render();}
  if(a==='tog'){const q=cur(),r=new Set(S.resp[q.id]||[]);r.has(b.dataset.id)?r.delete(b.dataset.id):r.add(b.dataset.id);S.resp[q.id]=[...r];return render();}
  if(a==='cards')return cardsStart();
  if(a==='buildman')return buildManual();
  if(a==='copyp'){const ta=document.getElementById('p'+b.dataset.i);ta.select();try{navigator.clipboard.writeText(ta.value).catch(()=>document.execCommand('copy'));}catch{try{document.execCommand('copy');}catch{}}b.textContent='Copied (if not, tap the box and copy by hand)';return;}
  if(a==='flip'){S.flip=!S.flip;return render();}
  if(a==='got')return rate(true);
  if(a==='miss')return rate(false);
  if(a==='cancelgen'){S.cancel=true;if(S.abort)S.abort.abort();return;}
  if(a==='weak')return prep('weak');
  if(a==='pause'){S.paused=true;return render();}
  if(a==='resume'){S.paused=false;return render();}
  if(a==='missed'){S.onlyMissed=!S.onlyMissed;return render();}
  if(a==='begin')return begin();
  if(a==='home'){S.msg='';return go('home');}
  if(a==='review')return go('review');
  if(a==='quizback')return go('quiz');
  if(a==='back'&&S.idx>0){S.idx--;return render();}
  if(a==='next'){if(S.idx<S.qs.length-1){S.idx++;return render();}return go('review');}
  if(a==='jump'){S.idx=+b.dataset.i;return go('quiz');}
  if(a==='firstopen'){const i=S.qs.findIndex(q=>!answered(q));S.idx=i<0?0:i;return go('quiz');}
  if(a==='flag'){const q=cur();S.flags[q.id]=!S.flags[q.id];return render();}
  if(a==='pick'){S.resp[cur().id]=b.dataset.id;return render();}
  if(a==='tf'){const q=cur();S.resp[q.id]={...(S.resp[q.id]||{}),answer:b.dataset.v==='1'};return render();}
  if(a==='submit')return submit();
  if(a==='dec'){const q=b.dataset.q;S.dec[q]={...(S.dec[q]||{}),[b.dataset.k]:b.dataset.v==='1'};const y=scrollY;recompute();commit();render();return scrollTo(0,y);}
});
app.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset&&e.target.dataset.act==='jump'){e.preventDefault();e.target.click();}});
app.addEventListener('input',e=>{
  const t=e.target,q=S.screen==='quiz'&&cur();
  if(t.dataset.reply!==undefined&&S.man){S.man.replies[+t.dataset.reply]=t.value;return;}
  if(t.dataset.r!==undefined){S.ranges[+t.dataset.r]=t.value;return;}
  if(t.dataset.n!==undefined){const r=S.reports[t.dataset.n];if(r){r.note=t.value;r.u=Date.now();persist();}return;}
  if(t.dataset.e!==undefined&&q){const r=S.resp[q.id]||Array(q.key.items.length).fill('');r[+t.dataset.e]=t.value;S.resp[q.id]=r;return;}
  if(t.dataset.b!==undefined&&q){const r=S.resp[q.id]||Array(q.key.blanks.length).fill('');r[+t.dataset.b]=t.value;S.resp[q.id]=r;}
  else if(t.id==='fix'&&q){S.resp[q.id]={...S.resp[q.id],correction:t.value};}
});
app.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='pass'){S.set.pass=Math.min(100,Math.max(1,+t.value||75));persist();}
  else if(t.id==='limit'){S.set.limit=Math.min(300,Math.max(0,Math.floor(+t.value||0)));persist();}
  else if(t.id==='exam'){S.set.exam=t.value;persist();render();}
  else if(t.id==='mt'){S.set.modTfMode=t.value;persist();}
  else if(t.id==='strict'){S.set.strict=t.checked;persist();}
  else if(t.dataset&&t.dataset.m!==undefined&&S.screen==='quiz'){const q=cur(),r={...(S.resp[q.id]||{})};r[t.dataset.m]=t.value;S.resp[q.id]=r;}
  else if(t.id==='writer'){S.set.writer=t.value;persist();render();}
  else if(t.id==='restore'&&t.files[0]){const rd=new FileReader();rd.onload=()=>{try{
      const d=JSON.parse(String(rd.result));if(d.app!=='alphaqmaker')throw new Error('That file is not an alphaQmaker backup.');
      const st=d.state||{};S.hist=Array.isArray(st.hist)?st.hist:[];S.set={...S.set,...(st.set||{})};S.reports=st.reports||{};
      if(d.quiz)S.quiz=importQuiz(exportQuiz(d.quiz));
      persist();if(S.quiz)persistQuiz();S.msg='';S.ok='Backup restored.';render();}catch(err){S.msg=err.message;render();}};rd.readAsText(t.files[0]);}
  else if(t.id==='addmode'){S.addMode=t.checked;}
  else if(t.id==='mm'){S.set.multiMode=t.value;persist();}
  else if(t.id==='mc'){S.set.matchingMode=t.value;persist();}
  else if(t.id==='increp'){S.set.incRep=t.checked;persist();}
  else if(t.id==='count'){S.set.count=+t.value;persist();render();}
  else if(t.id&&t.id.startsWith('ty-')){const k=t.id.slice(3);S.set.types=S.set.types.filter(x=>x!==k);if(t.checked)S.set.types.push(k);persist();}
  else if(t.id==='docs'){
    const fl=[...t.files];if(!fl.length)return;
    if(fl.length>5){S.files=[];S.msg=`Please choose between 1 and 5 files. You chose ${fl.length}.`;return render();}
    const bad=fl.filter(f=>!/\.(pdf|pptx)$/i.test(f.name));
    if(bad.length){S.files=[];S.msg=`Only .pdf and .pptx files work. Not supported: ${bad.map(f=>f.name).join(', ')}. For an older .ppt file, open it in PowerPoint and use Save As .pptx.`;return render();}
    S.files=fl;S.ranges=[];S.msg='';render();
  }
  else if(t.id==='f'&&t.files[0]){
    const rd=new FileReader();
    rd.onload=()=>{try{
      const nq=importQuiz(String(rd.result));
      if(S.addMode&&S.quiz){const before=S.quiz.questions.length,have=new Set(S.quiz.questions.map(q=>q.id));
        const {kept}=dedupeQuestions([...S.quiz.questions,...nq.questions.filter(q=>!have.has(q.id))]),n=kept.length-before;
        S.quiz={...S.quiz,questions:kept};persistQuiz();S.msg='';S.ok=`Added ${n} question${n===1?'':'s'} to “${S.quiz.title}”. It now has ${kept.length}.`;return go('home');}
      S.quiz=nq;persistQuiz();S.msg='';prep('all');}
      catch(err){S.msg=err.message;go('home');}};
    rd.readAsText(t.files[0]);
  }
});
render();
})();
