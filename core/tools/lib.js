import fs from 'node:fs';
import path from 'node:path';

const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

export async function extractPdf(buf){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc=await pdfjs.getDocument({data:new Uint8Array(buf),useSystemFonts:true,verbosity:0}).promise;
  const pages=[];
  for(let i=1;i<=doc.numPages;i++){
    const tc=await (await doc.getPage(i)).getTextContent();
    let text='';
    for(const it of tc.items) text+=it.str+(it.hasEOL?'\n':' ');
    pages.push({page:i,text:text.replace(/[ \t]+\n/g,'\n').replace(/[ \t]{2,}/g,' ').trim()});
  }
  return pages;
}

// PowerPoint: each slide is one "page". Slide numbers follow the file order inside the .pptx.
export async function extractPptx(buf){
  const JSZip=(await import('jszip')).default;
  const zip=await JSZip.loadAsync(buf);
  const num=n=>+/slide(\d+)\.xml$/.exec(n)[1];
  const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>num(a)-num(b));
  const pages=[];
  for(const [i,n] of names.entries()){
    const xml=await zip.file(n).async('string');
    const text=xml.split('</a:p>').map(p=>[...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>decode(m[1])).join('')).filter(t=>t.trim()).join('\n');
    pages.push({page:i+1,text});
  }
  return pages;
}

export async function readPages(file){
  const buf=fs.readFileSync(file),ext=path.extname(file).toLowerCase();
  if(ext==='.pdf') return extractPdf(buf);
  if(ext==='.pptx') return extractPptx(buf);
  if(ext==='.json'){const j=JSON.parse(buf.toString());return j.pages||j;}
  throw new Error(`Unsupported file type "${ext}". Use .pdf, .pptx, or a .pages.json made by inspect.`);
}
export const flag=(args,name,def)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:def;};
