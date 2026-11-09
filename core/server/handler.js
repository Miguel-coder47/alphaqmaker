// Framework-free request handler. Everything outside (login, usage storage, AI) is passed in,
// so the whole flow is testable without any account or money.
import {assessExtraction} from '../src/readable.js';
import {chunkPages,dedupeQuestions} from '../src/chunk.js';
import {prepareQuestions} from '../src/ingest.js';
import {buildSystemPrompt,buildQuestionPrompt,VERIFY_SYSTEM,buildVerifyPrompt} from '../src/prompt.js';

export function createHandler({authUser,usage,ai,capUsd=5,maxChunks=10}){
  return async function handle({method,headers={},body={}}){
    if(method!=='POST') return {status:405,body:{error:'Use POST.'}};
    const user=await authUser(headers);
    if(!user) return {status:401,body:{error:'Please sign in.'}};

    const month=new Date().toISOString().slice(0,7);
    const startSpent=await usage.get(user.id,month);
    let spent=startSpent;
    // Only paid providers are subject to the dollar cap. Free ones (mock, ollama, gemini free tier) cost 0.
    const paid=ai.paid!==false,limit=paid?capUsd:Infinity;
    if(paid&&!(capUsd>0)) return {status:403,body:{error:'Paid AI is switched off. Set a monthly cap above 0 to allow it, or use a free provider.'}};
    if(spent>=limit) return {status:429,body:{error:'Monthly AI limit reached. It resets next month.'}};

    const {pages,types=['mcq','blanks'],perChunk=8}=body||{};
    if(!Array.isArray(pages)||!pages.length) return {status:400,body:{error:'No pages were sent.'}};
    const check=assessExtraction(pages);
    if(!check.ok) return {status:422,body:{error:check.message}};

    const chunks=chunkPages(pages.filter(p=>p.text&&p.text.trim()));
    const use=chunks.slice(0,maxChunks);
    const all=[],chunkErrors=[];
    let stoppedByCap=false;
    for(const chunk of use){
      if(spent>=limit){stoppedByCap=true;break;}
      try{
        const gen=await ai.generate({kind:'questions',system:buildSystemPrompt(types),user:buildQuestionPrompt(chunk.text,perChunk)});
        spent+=gen.cost||0;
        let prepared=prepareQuestions(gen.json,{textFor:()=>chunk.text,pageRange:chunk.pages});
        if(prepared.length&&spent>=limit){
          stoppedByCap=true;   // never start another paid call once the cap is reached
          prepared=prepared.map(q=>({...q,needsReview:true,reviewReasons:[...q.reviewReasons,'not double-checked: the monthly AI limit was reached']}));
        } else if(prepared.length){
          const ver=await ai.generate({kind:'verify',system:VERIFY_SYSTEM,user:buildVerifyPrompt(chunk.text,prepared)});
          spent+=ver.cost||0;
          const ok=new Set((Array.isArray(ver.json)?ver.json:[]).filter(v=>v.supported===true).map(v=>v.index));
          prepared=prepared.map((q,i)=>ok.has(i)?q:{...q,needsReview:true,reviewReasons:[...q.reviewReasons,'the second AI check could not confirm the answer from the text']});
        }
        all.push(...prepared);
      }catch(e){chunkErrors.push({pages:chunk.pages,error:String(e.message||e)});}
    }
    const {kept,dropped}=dedupeQuestions(all);
    if(spent>startSpent) await usage.add(user.id,month,spent-startSpent);
    return {status:200,body:{questions:kept,duplicatesRemoved:dropped.length,chunkErrors,
      truncated:chunks.length>use.length,stoppedByCap,notice:check.message,spentThisMonthUsd:spent}};
  };
}
