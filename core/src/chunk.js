import {normalize} from './normalize.js';

/** "40-65, 70" -> [40..65,70]. Throws a plain-language error for bad input. */
export function parsePageRanges(spec,totalPages){
  const set=new Set();
  for(const part of String(spec).split(',').map(s=>s.trim()).filter(Boolean)){
    const m=/^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if(!m) throw new Error(`Can't read "${part}". Use page numbers like 40-65, 70.`);
    const a=+m[1],b=m[2]?+m[2]:a;
    if(a<1||b<a||b>totalPages) throw new Error(`Pages ${part} are outside this file (1-${totalPages}).`);
    for(let p=a;p<=b;p++) set.add(p);
  }
  if(!set.size) throw new Error('No pages selected.');
  return [...set].sort((x,y)=>x-y);
}

function splitLong(text,max){
  const out=[];let buf='';
  for(const p of text.split(/\n{2,}/)){
    if(p.length>max){if(buf){out.push(buf);buf='';}for(let i=0;i<p.length;i+=max) out.push(p.slice(i,i+max));continue;}
    if(buf.length+p.length+2>max){out.push(buf);buf='';}
    buf+=(buf?'\n\n':'')+p;
  }
  if(buf) out.push(buf);
  return out;
}

/** pages: [{page,text}] -> chunks {pages:[first,last],text}. Pages are never cut mid-sentence unless one page is huge. */
export function chunkPages(pages,{maxChars=12000}={}){
  const chunks=[];let cur=null;
  const flush=()=>{if(cur&&cur.text.trim()) chunks.push(cur);cur=null;};
  for(const {page,text} of pages){
    for(const part of (text.length>maxChars?splitLong(text,maxChars):[text])){
      const piece=`[Page ${page}]\n${part}`;
      if(cur&&cur.text.length+piece.length+2>maxChars) flush();
      if(!cur) cur={pages:[page,page],text:''};
      cur.text+=(cur.text?'\n\n':'')+piece;
      cur.pages[1]=page;
    }
  }
  flush();return chunks;
}

/** Drops near-duplicate questions (same type, very similar wording) produced by overlapping chunks. */
export function dedupeQuestions(questions,threshold=0.85){
  const kept=[],dropped=[];
  const tok=q=>new Set(normalize(q.prompt).split(' '));
  for(const q of questions){
    const a=tok(q);
    const dup=kept.find(k=>{
      if(k.type!==q.type) return false;
      const b=tok(k),inter=[...a].filter(x=>b.has(x)).length;
      return inter/(a.size+b.size-inter)>=threshold;
    });
    (dup?dropped:kept).push(q);
  }
  return {kept,dropped};
}
