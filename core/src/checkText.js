import {normalize} from './normalize.js';

/** Optimal-string-alignment distance: a swapped pair of letters counts as ONE typo. */
export function editDistance(a,b){
  const m=a.length,n=b.length;
  const d=Array.from({length:m+1},(_,i)=>{const r=Array(n+1).fill(0);r[0]=i;return r;});
  for(let j=0;j<=n;j++) d[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
    const c=a[i-1]===b[j-1]?0:1;
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[m][n];
}
const hasDigit=s=>/\d/.test(s);
const subset=(small,big)=>small.length>0&&small.every(w=>big.includes(w));

/**
 * Returns {verdict:'correct'|'almost'|'wrong', reason, matched?}
 *  - blocked: other real terms (other answers in the quiz, listed distractors). Typing one is wrong,
 *    and a typo that sits as close to a blocked term as to the answer is never auto-forgiven.
 *  - strict: no typo or plural forgiveness, accents must match.
 */
export function checkText(typed,accepted,{blocked=[],strict=false,numbers=true}={}){
  const opt={numbers,keepAccents:strict};
  const t=normalize(typed,opt);
  if(!t) return {verdict:'wrong',reason:'blank'};
  const acc=[...new Set(accepted.map(a=>normalize(a,opt)).filter(Boolean))];
  const blk=[...new Set(blocked.map(b=>normalize(b,opt)).filter(b=>b&&!acc.includes(b)))];
  if(acc.includes(t)) return {verdict:'correct',reason:'exact',matched:t};
  if(blk.includes(t)) return {verdict:'wrong',reason:'other-term'};
  if(strict) return {verdict:'wrong',reason:'no-match'};

  let best={verdict:'wrong',reason:'no-match'};
  const rank={wrong:0,almost:1,correct:2};
  const offer=r=>{if(rank[r.verdict]>rank[best.verdict]) best=r;};
  const tTok=t.split(' ');
  for(const a of acc){
    if(!hasDigit(a)&&!hasDigit(t)&&(t===a+'s'||t===a+'es'||t+'s'===a||t+'es'===a)){
      offer({verdict:'correct',reason:'plural',matched:a});continue;
    }
    const digits=hasDigit(a)||hasDigit(t);
    const d=editDistance(t,a);
    const nearBlocked=n=>blk.some(b=>editDistance(t,b)<=n);
    if(!digits&&a.length>=6&&d===1){
      offer(nearBlocked(1)?{verdict:'almost',reason:'ambiguous-typo',matched:a}:{verdict:'correct',reason:'typo',matched:a});
      continue;
    }
    if(!digits&&a.length>=8&&d===2&&!nearBlocked(2)){offer({verdict:'almost',reason:'close',matched:a});continue;}
    const aTok=a.split(' ');
    if(subset(aTok,tTok)||(aTok.length>1&&subset(tTok,aTok)&&tTok.length*2>=aTok.length)){
      offer({verdict:'almost',reason:'extra-or-missing-words',matched:a});
    }
  }
  return best;
}
