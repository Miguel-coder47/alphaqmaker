// One shared prompt, used by the server AND by tools/prompt.js (copy-paste into any chat AI).
export const TYPE_SHAPES={
  mcq:'{"type":"mcq","prompt":"...","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],"key":{"correct":"a"}}',
  tf:'{"type":"tf","prompt":"A statement","key":{"correct":true}}',
  multi:'{"type":"multi","prompt":"Select all that apply: ...","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."}],"key":{"correct":["a","c"]}}',
  blanks:'{"type":"blanks","prompt":"The ____ is the powerhouse of the cell.","key":{"blanks":[{"accepted":["mitochondria","mitochondrion"]}]}}',
  enumeration:'{"type":"enumeration","prompt":"List three ...","key":{"items":[{"accepted":["item one"]},{"accepted":["item two"]},{"accepted":["item three"]}]}}',
  matching:'{"type":"matching","prompt":"Match each term to its meaning","left":[{"id":"1","text":"..."},{"id":"2","text":"..."}],"right":[{"id":"a","text":"..."},{"id":"b","text":"..."}],"key":{"pairs":{"1":"b","2":"a"}}}',
  modtf:'{"type":"modtf","prompt":"Photosynthesis occurs in the mitochondria.","underlined":"mitochondria","key":{"truth":false,"correction":["chloroplast","chloroplasts"]}}',
};
export const ALL_TYPES=Object.keys(TYPE_SHAPES);

export function buildSystemPrompt(types=['mcq','blanks']){
  const shapes=types.filter(t=>TYPE_SHAPES[t]).map(t=>`- ${t}: ${TYPE_SHAPES[t]}`).join('\n');
  return `You write exam practice questions ONLY from the text the user gives you. Reply with one JSON array and nothing else (no explanation, no markdown).
Every question object has the shape below PLUS two more fields:
  "source": {"page": N}  where N is the number from the [Page N] marker where the answer appears
  "evidence": one sentence copied WORD FOR WORD from the text that proves the answer
Shapes:
${shapes}
Rules:
- Use only facts stated in the text. Never add outside knowledge. If the text does not support a question, skip it.
- Fill-in-the-blank: list EVERY acceptable answer (singular/plural, common alternative names) in "accepted".
- Modified true or false: for a false statement, change one key word; "underlined" is that wrong word exactly as it appears in "prompt"; "correction" lists the right word(s). For a true statement set "truth": true, still underline one key word, and leave out "correction".
- Multiple choice: exactly one correct option and plausible wrong options. Every wrong option must be clearly wrong according to the text: never a synonym of the right answer, a part of it, or something a careful student could also defend. No "all of the above".
- No trick questions and no duplicate questions.`;
}
export const buildQuestionPrompt=(text,count=8)=>`Write ${count} questions from this text:\n\n${text}`;

export const VERIFY_SYSTEM='You check exam questions against a source text. Reply with one JSON array only: [{"index":0,"supported":true},...]. "supported" is true only if the text clearly and fully supports the answer key.';
export const buildVerifyPrompt=(text,qs)=>`Text:\n${text}\n\nQuestions:\n`+qs.map((q,i)=>`[${i}] ${q.prompt}\nKey: ${JSON.stringify(q.key)}`).join('\n');
