// Lines that repeat on many pages (copyright footers, running headers) are not content.
export function boilerplateLines(pages,{repeatShare=0.1}={}){
  if(pages.length<5) return new Set();
  const seen=new Map();
  for(const p of pages) for(const l of new Set(String(p.text||'').split('\n').map(x=>x.trim()).filter(Boolean))) seen.set(l,(seen.get(l)||0)+1);
  return new Set([...seen].filter(([,n])=>n>=3&&n/pages.length>=repeatShare).map(([l])=>l));
}
export function stripBoilerplate(pages,opts){
  const b=boilerplateLines(pages,opts);
  return pages.map(p=>({...p,text:String(p.text||'').split('\n').filter(l=>!b.has(l.trim())).join('\n').trim()}));
}

/** Tells the user plainly when a file has no readable text (scans, image-only slides) instead of inventing questions. */
export function assessExtraction(pages,{minLetters=80,minRatio=0.6}={}){
  const clean=stripBoilerplate(pages);
  const letters=t=>(String(t||'').match(/\p{L}/gu)||[]).length;
  const empty=clean.filter(p=>letters(p.text)<minLetters).map(p=>p.page);
  const total=pages.length,readable=total-empty.length;
  const ok=total>0&&readable/total>=minRatio;
  return {ok,readablePages:readable,totalPages:total,emptyPages:empty,
    message:ok?(empty.length?`${empty.length} page(s) have almost no readable text (probably pictures), so no questions can come from them: ${empty.join(', ')}.`:'')
      :'This file looks scanned or made of images, so no questions were made. Try a version with selectable text, or run OCR on it first.'};
}
