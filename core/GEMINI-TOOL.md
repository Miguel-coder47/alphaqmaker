# Make a quiz with one command (free Gemini API, no Claude)

`tools/make-quiz.js` reads your PDF or PowerPoint files on your own computer, asks Google's Gemini (free tier) to write
the questions, checks every question against your file, and saves a `.quiz.json` you import into the app.

## One-time setup (about 5 minutes)
1. Go to **aistudio.google.com**, sign in with a Google account, and choose **Get API key**. It is free and needs no card.
2. In the `quiz-maker-core` folder, make a text file named **`.env`** (open Notepad, type the line below, then
   **File > Save As**, set *Save as type* to **All files**, and name it exactly `.env`):
   ```
   GEMINI_API_KEY=paste-your-key-here
   ```
   Optional second line, if the default model stops working: `GEMINI_MODEL=gemini-2.5-flash` (pick a model that
   AI Studio shows as free; the default is `gemini-2.5-flash-lite`).
3. Keep the key private. Never post it anywhere.

## Use it (in the black window, inside the folder)
```
node tools/make-quiz.js bio.pdf --count 20
node tools/make-quiz.js bio.pdf slides.pptx --count 30 --title "Biology"
node tools/make-quiz.js bio.pdf --pages "12-30" --types mcq,blanks,matching,modtf
node tools/make-quiz.js a.pdf b.pdf --pages "12-30;all"       (one range per file, separated by ;)
node tools/make-quiz.js bio.pdf --figures "32,33,39"          (also let Gemini look at picture slides)
```
- 1 to 5 files, `.pdf` or `.pptx`. `--count` is 1 to 100 (default 20).
- `--types` can be: mcq, tf, multi, blanks, matching, enumeration, modtf.
- It saves `<title>.quiz.json`. In the app: **Import a quiz**, choose the file (tick *Add to my current quiz* to combine).

## What to expect
- It uses few requests: about 3 for 20 questions. If the free limit is hit it waits and retries, then stops and
  saves what it has. Google does not publish fixed free limits any more; AI Studio shows yours.
- `--figures` sends the whole PDF to Gemini so it can read charts and diagrams. Those questions are always marked
  **CHECK** because the app cannot verify a picture. Look at the slide before trusting them.
- Free-tier requests may be used by Google to improve its products. Do not send private material.

## If something goes wrong
| Message | Fix |
|---|---|
| No Gemini key found | Make the `.env` file (step 2). Check it is not called `.env.txt`. |
| API key not valid / 403 | Re-copy the key from AI Studio into `.env`. |
| Model not found (404) | Set `GEMINI_MODEL` in `.env` to a free model listed in AI Studio. |
| Free limit is used up | Wait (resets at midnight Pacific time) or use a smaller `--count`. |
| Scanned or made of images | The file has no text layer. Use `--figures` (PDF only) or another file. |
