// Zero-cost, no-AI generator: fill-in-the-blank only. Picks long key words from real sentences.
// Basic on purpose: the answer is always a word copied from the text, so the key cannot be invented.
const STOP=new Set('because between through however another without including different important following although whether during against before around within should would could which their there these those about being after other under while where'.split(' '));
export function generateFromText(chunkText,count=8){
  const out=[];
  const parts=chunkText.split(/\[Page (\d+)\]\n/);           // ['', '12', 'text', '13', 'text'...]
  for(let i=1;i<parts.length&&out.length<count;i+=2){
    const page=+parts[i];
    const sentences=parts[i+1].replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(s=>s.length>=40&&s.length<=220);
    let perPage=0;
    for(const s of sentences){
      if(perPage>=2||out.length>=count) break;
      const words=(s.match(/\p{L}{7,}/gu)||[]).filter(w=>!STOP.has(w.toLowerCase()));
      if(!words.length) continue;
      const w=words.sort((a,b)=>b.length-a.length)[0];
      const re=new RegExp(`\\b${w}\\b`,'i');
      out.push({type:'blanks',prompt:s.replace(re,'____'),key:{blanks:[{accepted:[w.toLowerCase()]}]},source:{page},evidence:s});
      perPage++;
    }
  }
  return out;
}
