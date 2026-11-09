import {checkText} from './checkText.js';
import {frac,add,ZERO} from './fraction.js';

export const DEFAULTS={modTfMode:'split',multiMode:'proportional',matchingMode:'per-pair',strict:false,numbers:true};
const S=s=>({...DEFAULTS,...s});

export function maxPoints(q,settings){
  const s=S(settings);
  switch(q.type){
    case 'mcq':case 'tf':case 'multi': return q.points??1;
    case 'blanks': return q.key.blanks.reduce((n,b)=>n+(b.points??1),0);
    case 'matching': return Object.keys(q.key.pairs).length*(q.pointsPerPair??1);
    case 'enumeration': return q.key.items.length*(q.pointsPerItem??1);
    case 'modtf': return s.modTfMode==='split'?(q.key.truth?1:2):1;
  }
  throw new Error('Unknown question type: '+q.type);
}

/** Other real terms in the quiz: typing one of them for this question is never forgiven as a typo. */
export function buildBlocklist(questions,q){
  const out=[...(q.distractors||[])];
  for(const o of questions){
    if(o.id===q.id) continue;
    if(o.type==='blanks') o.key.blanks.forEach(b=>out.push(...b.accepted));
    if(o.type==='enumeration') o.key.items.forEach(i=>out.push(...i.accepted));
    if(o.type==='modtf'&&o.key.correction) out.push(...o.key.correction);
  }
  return out;
}

function judgeOne(typed,accepted,decisions,key,opts){
  const r=checkText(typed,accepted,opts);
  if(r.verdict==='correct') return {ok:true};
  if(r.verdict==='almost'){
    const d=decisions?.[key];
    if(d===true) return {ok:true};
    if(d===false) return {ok:false};
    return {pending:{key,typed,accepted}};
  }
  return {ok:false};
}

// Match typed answers to targets: exact matches first, then "almost" ones the user must decide on.
function assign(typed,targets,ordered,decisions,prefix,opts){
  const used=new Set(),matches=[],pending=[],taken=typed.map(()=>false);
  typed.forEach((t,i)=>{
    for(let j=0;j<targets.length;j++){
      if(ordered&&j!==i) continue;
      if(!used.has(j)&&checkText(t,targets[j],opts).verdict==='correct'){used.add(j);matches.push(j);taken[i]=true;break;}
    }
  });
  typed.forEach((t,i)=>{
    if(taken[i]) return;
    for(let j=0;j<targets.length;j++){
      if(ordered&&j!==i) continue;
      if(used.has(j)||checkText(t,targets[j],opts).verdict!=='almost') continue;
      const key=`${prefix}:${i}`,d=decisions?.[key];
      if(d===true){used.add(j);matches.push(j);}
      else if(d===undefined) pending.push({key,typed:t,accepted:targets[j]});
      break;
    }
  });
  return {matches,pending};
}

export function scoreQuestion(q,resp,settings,{blocked=[],decisions={}}={}){
  const s=S(settings),opts={blocked,strict:s.strict,numbers:s.numbers};
  const max=maxPoints(q,s);let earned=ZERO,pending=[];
  switch(q.type){
    case 'mcq': case 'tf':
      earned=resp===q.key.correct?frac(max):ZERO;break;
    case 'multi':{
      const picks=new Set(resp||[]),correct=new Set(q.key.correct);
      const tp=[...picks].filter(x=>correct.has(x)).length,fp=picks.size-tp;
      earned=s.multiMode==='all-or-nothing'
        ?(tp===correct.size&&fp===0?frac(max):ZERO)
        :frac(Math.max(0,tp-fp)*max,correct.size);
      break;}
    case 'blanks':{
      const blanks=q.key.blanks;
      const r=assign(resp||[],blanks.map(b=>b.accepted),!q.interchangeable,decisions,'blank',opts);
      r.matches.forEach(j=>{earned=add(earned,frac(blanks[j].points??1));});
      pending=r.pending;break;}
    case 'enumeration':{
      const items=q.key.items,per=q.pointsPerItem??1;
      const r=assign(resp||[],items.map(i=>i.accepted),!!q.ordered,decisions,'item',opts);
      earned=frac(r.matches.length*per);pending=r.pending;break;}
    case 'matching':{
      const pairs=Object.entries(q.key.pairs),c=pairs.filter(([l,rt])=>resp?.[l]===rt).length;
      earned=s.matchingMode==='all-or-nothing'?(c===pairs.length?frac(max):ZERO):frac(c*(q.pointsPerPair??1));
      break;}
    case 'modtf':{
      const {truth,correction}=q.key,ans=resp?.answer;
      if(truth){earned=ans===true?frac(1):ZERO;break;}
      if(ans!==false) break;
      const j=judgeOne(resp.correction,correction,decisions,'correction',opts);
      if(j.pending) pending=[j.pending];
      const gotWord=j.ok===true;
      earned=s.modTfMode==='split'?(gotWord?frac(2):frac(1)):(gotWord?frac(1):ZERO);
      break;}
    default: throw new Error('Unknown question type: '+q.type);
  }
  return {id:q.id,max,earned,pending};
}

export function scoreQuiz(questions,responses,{settings,decisions={}}={}){
  const items=questions.map(q=>scoreQuestion(q,responses[q.id],settings,{blocked:buildBlocklist(questions,q),decisions:decisions[q.id]}));
  return {
    items,
    earned:items.reduce((a,i)=>add(a,i.earned),ZERO),
    max:items.reduce((a,i)=>a+i.max,0),
    pending:items.reduce((a,i)=>a+i.pending.length,0),
  };
}

/**
 * passing: {type:'percent',value:75} or {type:'points',value:60}.
 * Compared with exact integers, so 59.99% never passes a 60% mark.
 * While any "Almost: you decide" is unresolved, passed is null (not yet known).
 */
export function grade(result,passing){
  const {earned,max,pending}=result;
  const percent=max?Math.floor((earned.n*1000)/(earned.d*max))/10:0;   // floored, never rounded up
  let passed=null;
  if(!pending&&max){
    passed=passing.type==='points'
      ?earned.n>=passing.value*earned.d
      :earned.n*10000>=Math.round(passing.value*100)*earned.d*max;
  }
  return {earned:earned.n/earned.d,max,percent,pending,passed};
}
