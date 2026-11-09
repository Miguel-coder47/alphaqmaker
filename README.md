# alphaQmaker

**Free practice quizzes from your own PDFs and slides.** Live app: __SITE_URL__app/ · Landing page: __SITE_URL__

alphaQmaker turns your study notes into practice quizzes you can take on a phone or laptop. It reads PDF and PowerPoint
files in the browser, supports seven question types, marks answers carefully, compares your score with a passing grade,
and brings missed questions back as flashcards. No account, no tracking, no server.

<!-- Add screenshots here: ![Home](docs/home.png) ![Quiz](docs/quiz.png) ![Results](docs/results.png) -->

## Features
- 1 to 5 PDF or PowerPoint files, with a page or slide range picker (for example "12-30")
- Seven question types: multiple choice, true or false, choose all that apply, fill in the blank, matching, enumeration, modified true or false
- Two ways to get questions without paying: copy a prompt into any free chat AI and paste the reply back, or a built-in no-AI mode
- Careful answer checking, exact scoring, and a configurable passing grade
- Review before submit, flag and report questions, a timer with pause, and a two-column layout on laptops
- Weak-spot tracking with flashcards, score history, light and dark mode
- Backup and restore of everything (quizzes stay in the browser)
- A command-line tool that makes a whole quiz in one step using Google's free Gemini API (`core/GEMINI-TOOL.md`)

## Engineering notes
**Answer checking you can trust.** Typed answers are normalized (case, spacing, punctuation, accents, `1,000` = `1000`, `five` = `5`).
One typo is forgiven on longer answers, but never when it turns the answer into a *different real term* from the same quiz
("meiosis" for "mitosis"). A typo equally close to the answer and a rival term, or a near miss, becomes **"Almost: you decide"**
instead of a silent wrong mark. Pass or fail stays undecided until every "Almost" is settled.

**Exact scoring.** Partial credit is stored as fractions, and the passing grade is compared with integer arithmetic, so a score of
59.99% can never round up to pass a 60% mark. Rules are explicit per type (choose-all: right picks minus wrong picks, never below 0;
modified true or false: split credit or all-or-nothing).

**Questions must be grounded.** Each generated question carries an evidence sentence, and the pipeline checks that the sentence really
appears on the cited page. Broken keys are rejected, duplicates removed, and anything unverifiable is flagged for review.

**Honest about files it can't read.** A copyright footer repeated on every page used to make picture-only slides look "readable".
Repeated lines are now stripped before counting text, and slides that are mostly figures are reported by number.

**Tested.** `core/` holds the engine as plain ES modules with 53 automated tests (`node --test`), including a fake Gemini server for the CLI.

## Project layout
```
index.html        landing page (SEO, social preview, structured data)
app/              the app: src/ (interface) -> index.html (built by build-app.mjs)
core/             the engine: src/, tools/ (CLI), test/, samples/
samples/          an original sample quiz you can import
configure.mjs     fills in your name and GitHub details
```

## Run or modify it
```
node build-app.mjs                      # rebuild app/index.html after changing app/src or core/src
cd core && npm install && npm test      # run the tests
```
The app is a static site. Open `app/index.html` in a browser, or serve the folder with any static host.

## Privacy and content
Everything runs in your browser and nothing is uploaded to an alphaQmaker server. Quizzes, history, and settings are stored in your browser's
local storage. Adding a file loads two open-source libraries (pdf.js and JSZip) from cdnjs. If you use a chat AI or the Gemini tool,
the text you send goes to that provider under their terms. **Do not commit course materials or answer keys made from copyrighted
textbooks.** The included sample quiz is original.

## How it was made
Built as a personal project with AI assistance (Claude): I set the requirements, tested it on my own study material, and reviewed the output. *(Edit this
paragraph so it describes your own contribution accurately.)*

## Limitations and next steps
- Questions written by an AI can still be wrong, so the app flags what it can't verify. Review them.
- Figures, charts, and scanned pages can't be read in the browser; the CLI's `--figures` option can use Gemini for PDFs.
- Next: optional account sync, an in-app question editor, and import of Anki decks.

MIT License. See `LICENSE`.
