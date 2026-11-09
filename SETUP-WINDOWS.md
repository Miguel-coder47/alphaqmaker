# Put alphaQmaker online (Windows, free, no Git needed)

Do this once. It takes about 20 minutes. Do not add your Gemini key or any course PDFs to this folder.

## 1. Fill in your details
1. Unzip this folder. Open the black window inside it (click the folder's address bar, type `cmd`, press Enter).
2. Run (change the three values; keep the quotes around your name):
   `node configure.mjs your-github-username alphaqmaker "Your Name"`
3. It prints your future website address, like `https://your-github-username.github.io/alphaqmaker/`.
   Open `README.md` and edit the "How it was made" paragraph so it is true for you.

## 2. Make a GitHub repository
1. Create a free account at github.com and sign in.
2. Click **+ > New repository**. Name it exactly `alphaqmaker` (the same as in step 1), choose **Public**, and click **Create repository**.
3. On the next page click **uploading an existing file**. Open this folder, select everything inside it (`Ctrl + A`), and drag it into the page.
   If a file named `.nojekyll` or `.gitignore` seems missing, add it with the same upload button.
4. Wait for the upload to finish, then click **Commit changes**. If GitHub says there are too many files, upload the `core` folder separately.

## 3. Turn on the website
1. In your repository, open **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. Wait one to three minutes, refresh the page, and open the address shown. You should see the alphaQmaker home page, and `/app/` should open the app.

## 4. Make it findable on search engines
1. Go to **search.google.com/search-console** and click **Add property**. Choose **URL prefix** and paste your site address.
2. Verify ownership: choose **HTML tag**, copy the `<meta name="google-site-verification" ...>` line, and paste it just above `</head>` in your repository's
   `index.html` (open the file on GitHub, click the pencil icon, edit, commit). Then press **Verify**.
3. In Search Console open **Sitemaps** and submit `sitemap.xml`. Then open **URL inspection**, paste your home page address, and press **Request indexing**.
4. Optional: at bing.com/webmasters you can import your site from Search Console, which covers Bing too.
5. Check progress by searching Google for `site:your-github-username.github.io/alphaqmaker`. It can take a few days to a few weeks. Ranking for general words like "quiz maker" is
   unlikely, but searches for "alphaQmaker quiz" plus your name should find it.

Note: search engines read `robots.txt` only at the root of a site (`your-github-username.github.io/robots.txt`), so the copy in this folder matters only if you later use your own domain.
That is fine, because the default is to allow crawling.

## 5. Show it off
- On your repository page click the gear next to **About**: add a description, your website address, and topics like `quiz`, `education`, `javascript`, `pdf`.
- Pin the repository on your GitHub profile, add screenshots to a `docs` folder, and uncomment the screenshot line in `README.md`.
- Link both the live app and the repository from your portfolio, and describe the answer-checking and testing work, not just the screens.

## Updating later
Change files on GitHub (pencil icon) or upload new versions. After editing anything in `app/src` or `core/src`, run `node build-app.mjs` and upload the new `app/index.html`.
