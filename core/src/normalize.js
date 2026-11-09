const ONES={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
const TENS={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const has=(o,k)=>Object.hasOwn(o,k);
export const stripAccents=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC');

// Number words 0-99 and "N hundred" become digits ("twenty five" -> "25").
function wordsToDigits(tokens){
  const out=[];
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i],nx=tokens[i+1];
    if(has(TENS,t)){
      if(has(ONES,nx)&&ONES[nx]>=1&&ONES[nx]<=9){out.push(String(TENS[t]+ONES[nx]));i++;}
      else out.push(String(TENS[t]));
    } else if(has(ONES,t)){
      if(nx==='hundred'&&ONES[t]>=1&&ONES[t]<=9){out.push(String(ONES[t]*100));i++;}
      else out.push(String(ONES[t]));
    } else out.push(t);
  }
  return out;
}

/** Case, spacing, punctuation, accents and number format never affect marking. */
export function normalize(input,{numbers=true,keepAccents=false}={}){
  let t=String(input??'').normalize('NFC').toLowerCase();
  if(!keepAccents) t=stripAccents(t);
  t=t.replace(/(\d),(?=\d{3}(?!\d))/g,'$1');          // 1,000 -> 1000
  t=t.replace(/(?<!\d)\.|\.(?!\d)/g,' ');              // keep decimal points only
  t=t.replace(/[^\p{L}\p{N}.\s]/gu,' ');
  let tokens=t.split(/\s+/).filter(Boolean);
  if(numbers) tokens=wordsToDigits(tokens);
  if(tokens.length>1&&['the','a','an'].includes(tokens[0])) tokens.shift();
  return tokens.join(' ');
}
