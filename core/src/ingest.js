import {validateQuestion} from './schema.js';
import {normalize} from './normalize.js';

/**
 * Turns raw AI output into questions we can trust or flag.
 * Deterministic checks (no AI): valid answer key, evidence sentence really appears in the source,
 * cited page is in range. Anything failing is kept but marked needsReview with plain reasons.
 *  opts.textFor(q) -> source text to look for the evidence in (omit to skip that check)
 *  opts.pageRange  -> [first,last] pages the question may cite
 */
export function prepareQuestions(raw,{textFor,pageRange}={}){
  return (Array.isArray(raw)?raw:[]).filter(q=>q&&typeof q==='object').map(q=>{
    const question={...q,id:q.id||globalThis.crypto.randomUUID(),version:q.version??1};
    const problems=validateQuestion(question),reasons=[];
    if(textFor){
      const text=textFor(question);
      if(typeof question.evidence!=='string'||!question.evidence.trim()) reasons.push('no evidence sentence was given');
      else if(!text||!normalize(text).includes(normalize(question.evidence))) reasons.push('the evidence sentence is not in the source text');
    }
    const page=question.source?.page;
    if(pageRange&&Number.isInteger(page)&&(page<pageRange[0]||page>pageRange[1])) reasons.push('cited page is outside the pages that were read');
    return {...question,problems,reviewReasons:reasons,needsReview:problems.length>0||reasons.length>0};
  });
}
