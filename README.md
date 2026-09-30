# Poster companion website

A mobile-first website that goes with the CRISPR-Cas poster (reached through a QR code), plus a separate editor page.

## Our links

- **Website (for the QR code):** https://moira0809.github.io/lennard-moira-crispr_poster_companion/
- **Editor:** https://moira0809.github.io/lennard-moira-crispr_poster_companion/admin.html
- **GitHub repository:** https://github.com/Moira0809/lennard-moira-crispr_poster_companion

```
index.html        public page (what visitors see)
admin.html        editor (text, images, videos, authors, references, QR code)
content.json      ALL text + media paths live here
media/            images and videos
*.css, *.js       styles and scripts
```

## Try it locally

The page loads `content.json`, so it has to run through a small web server. Double-clicking the file won't work.

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 (the site) and http://localhost:8765/admin.html (the editor).

## Put it online (GitHub Pages)

1. Create a **public** repository on GitHub (e.g. `crispr-poster`) and upload every file in this folder.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
3. After about 1 minute the site is live at `https://<user>.github.io/<repo>/`.

## Editing through admin.html

1. Create a token: GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*.
   Repository access: *Only select repositories* → your repo. Permissions: **Contents → Read and write**.
2. Open `https://<user>.github.io/<repo>/admin.html` → tab **Publish & QR** → enter the user, repo and token → *Save connection*.
3. Edit the text and choose image/video files. Your changes are kept as a draft in your browser and show up in the live preview.
4. Click **Publish**. This uploads the new files and `content.json`, and the live site updates in about 1 minute.

Notes
- `admin.html` is publicly reachable, but nobody can change anything without a token. The token is stored only in your own browser.
- If several people edit, click **Load latest from GitHub** before you start so you don't overwrite each other's work.
- Keep videos small: MP4 (H.264), ideally under 20 MB (GitHub's limit is 100 MB per file). `.mov` often won't play on Android.
- `.avi` files (e.g. time-lapses from Fiji) are converted to MP4 automatically when you choose them in the editor. This happens in your browser, so keep the tab open until it's done. The first time, the converter needs to download about 30 MB. Very large AVIs (over 1.5 GB) can't be converted in the browser. Use HandBrake (https://handbrake.fr, preset "Fast 1080p30") for those.
- Leaving a media path empty shows an "Image/Video coming soon" placeholder.
- Removing media in the editor only removes it from the page. The file stays in the repo's `media/` folder.
- Before printing the poster, download the QR code in the **Publish & QR** tab and test it with several phones.
