// AI back-ends. All return {json,cost}. Pick one with AI_PROVIDER (mock | ollama | gemini | anthropic).
import {generateFromText} from '../src/ruleBased.js';

export function parseAiJson(text){
  const t=String(text).replace(/```json|```/g,'').trim();
  try{return JSON.parse(t);}catch{
    const a=t.indexOf('['),b=t.lastIndexOf(']');
    if(a>=0&&b>a) return JSON.parse(t.slice(a,b+1));
    throw new Error('The AI reply was not valid JSON.');
  }
}
async function post(url,headers,body){
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  if(!res.ok){
    let msg='';try{const j=await res.json();msg=(j.error&&j.error.message)||'';}catch{}
    const e=new Error(`AI service error ${res.status}${msg?': '+msg.slice(0,220):''}`);e.status=res.status;throw e;
  }
  return res.json();
}

/** FREE, no account, no network: rule-based fill-in-the-blank. Good for testing the whole pipeline. */
export const mockProvider=()=>({paid:false,async generate({kind,user}){
  if(kind==='verify') return {json:[...user.matchAll(/^\[(\d+)\]/gm)].map(m=>({index:+m[1],supported:true})),cost:0};
  return {json:generateFromText(user,8),cost:0};
}});

/** FREE, runs on your own computer (install Ollama, then `ollama pull <model>`). */
export const ollamaProvider=({model=process.env.OLLAMA_MODEL,url=process.env.OLLAMA_URL||'http://localhost:11434'}={})=>({paid:false,async generate({system,user}){
  if(!model) throw new Error('Set OLLAMA_MODEL to a model you have pulled.');
  const j=await post(`${url}/api/chat`,{},{model,stream:false,messages:[{role:'system',content:system},{role:'user',content:user}]});
  return {json:parseAiJson(j.message.content),cost:0};
}});

/** Gemini API (free tier available, no card). Pass `pdf` (base64) to let Gemini look at pictures in a PDF. */
export const geminiProvider=({key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL,base=process.env.GEMINI_BASE_URL||'https://generativelanguage.googleapis.com'}={})=>({paid:false,async generate({system,user,pdf}){
  if(!key||!model) throw new Error('Set GEMINI_API_KEY and GEMINI_MODEL.');
  const parts=[...(pdf?[{inlineData:{mimeType:'application/pdf',data:pdf}}]:[]),{text:user}];
  const body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts}]};
  if(process.env.GEMINI_JSON!=='0') body.generationConfig={temperature:0.4,responseMimeType:'application/json'};
  const j=await post(`${base}/v1beta/models/${model}:generateContent`,{'x-goog-api-key':key},body);
  const c=j.candidates&&j.candidates[0];
  if(!c||!c.content||!c.content.parts) throw new Error('Gemini sent no answer (it may have blocked the request).');
  return {json:parseAiJson(c.content.parts.map(p=>p.text||'').join('')),cost:0};
}});

/** PAID. Only use if you decide to. Cost is counted so the monthly cap works. */
export const anthropicProvider=({key=process.env.ANTHROPIC_API_KEY,model=process.env.MODEL||'claude-sonnet-5-5',
  inUsd=Number(process.env.INPUT_USD_PER_MTOK||0),outUsd=Number(process.env.OUTPUT_USD_PER_MTOK||0)}={})=>({paid:true,async generate({system,user}){
  const j=await post('https://api.anthropic.com/v1/messages',{'x-api-key':key,'anthropic-version':'2023-06-01'},
    {model,max_tokens:4000,system,messages:[{role:'user',content:user}]});
  const text=j.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  return {json:parseAiJson(text),cost:((j.usage?.input_tokens||0)*inUsd+(j.usage?.output_tokens||0)*outUsd)/1e6};
}});

export function makeProvider(name=process.env.AI_PROVIDER||'mock'){
  const p={mock:mockProvider,ollama:ollamaProvider,gemini:geminiProvider,anthropic:anthropicProvider}[name];
  if(!p) throw new Error(`Unknown AI_PROVIDER "${name}"`);
  return p();
}
