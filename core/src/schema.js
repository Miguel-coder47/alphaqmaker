export const SCHEMA_VERSION=1;
export const TYPES=['mcq','tf','multi','blanks','matching','enumeration','modtf'];
const nonEmpty=a=>Array.isArray(a)&&a.length>0&&a.every(x=>typeof x==='string'&&x.trim());

/** Returns a list of problems with a question's answer key. Empty list = safe to use. */
export function validateQuestion(q){
  const e=[],id=q?.id??'?',bad=m=>e.push(`${id}: ${m}`);
  if(!q||typeof q!=='object') return ['question is not an object'];
  if(typeof q.id!=='string'||!q.id) bad('missing id');
  if(!TYPES.includes(q.type)) return [...e,`${id}: unknown type "${q.type}"`];
  if(typeof q.prompt!=='string'||!q.prompt.trim()) bad('missing question text');
  if(!(Number.isInteger(q.source?.page)||Number.isInteger(q.source?.slide))) bad('missing source page or slide');
  if(!Number.isInteger(q.version)) bad('missing version');
  const k=q.key||{},ids=(q.options||[]).map(o=>o.id);
  if(['mcq','multi'].includes(q.type)){
    if(ids.length<2||new Set(ids).size!==ids.length) bad('needs at least 2 options with unique ids');
    if(q.type==='mcq'&&!ids.includes(k.correct)) bad('correct option is not one of the options');
    if(q.type==='multi'&&!(Array.isArray(k.correct)&&k.correct.length&&k.correct.every(c=>ids.includes(c)))) bad('correct options must be a non-empty subset of the options');
  }
  if(q.type==='tf'&&typeof k.correct!=='boolean') bad('correct must be true or false');
  if(q.type==='blanks'&&!(Array.isArray(k.blanks)&&k.blanks.length&&k.blanks.every(b=>nonEmpty(b.accepted)))) bad('every blank needs a non-empty accepted-answers list');
  if(q.type==='enumeration'&&!(Array.isArray(k.items)&&k.items.length&&k.items.every(i=>nonEmpty(i.accepted)))) bad('every item needs a non-empty accepted-answers list');
  if(q.type==='matching'){
    const pairs=Object.entries(k.pairs||{});
    if(pairs.length<2) bad('needs at least 2 pairs');
    else if(!pairs.every(([l,r])=>(q.left||[]).some(x=>x.id===l)&&(q.right||[]).some(x=>x.id===r))) bad('pairs must point at listed items');
  }
  if(q.type==='modtf'){
    if(typeof k.truth!=='boolean') bad('truth must be true or false');
    if(k.truth===false&&!nonEmpty(k.correction)) bad('a false statement needs accepted corrections');
    if(!q.underlined||!String(q.prompt).includes(q.underlined)) bad('underlined word must appear in the statement');
  }
  return e;
}

export function exportQuiz(quiz){
  return JSON.stringify({schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),quiz},null,2);
}

export function importQuiz(text){
  let data;
  try{data=JSON.parse(text);}catch{throw new Error('This file is not valid quiz data (could not read it as JSON).');}
  if(!Number.isInteger(data.schemaVersion)) throw new Error('This file has no schema version, so it was not made by this app.');
  if(data.schemaVersion>SCHEMA_VERSION) throw new Error('This file is from a newer version of the app. Update the app first.');
  const quiz=data.quiz;
  if(!quiz||typeof quiz.title!=='string'||!Array.isArray(quiz.questions)) throw new Error('Quiz title or questions are missing.');
  const problems=quiz.questions.flatMap(validateQuestion);
  if(problems.length) throw new Error('Some questions have problems:\n'+problems.join('\n'));
  return quiz;
}
