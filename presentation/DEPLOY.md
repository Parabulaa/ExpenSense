# Deploying to Cloudflare Pages

The presentation is a static site, deployed with the Cloudflare CLI (Wrangler).
No GitHub repo needed.

## Live URL

```
https://main.expensense-7aw.pages.dev
```

(The plain name `expensense` was already taken by another Cloudflare user, so this
project is `expensense-7aw`. To share, use the URL above.)

## One-time setup

1. Free Cloudflare account: https://dash.cloudflare.com/sign-up
2. Log in from the terminal (opens a browser to authorize):

   ```powershell
   cd C:\Users\james\ExpenSense\presentation
   npx wrangler login
   ```

## Deploy

```powershell
npm run deploy
```

Builds the site and uploads `dist/` to the **expensense** Pages project.
Every later run publishes an update to the same URL.

## IMPORTANT: the 25 MB per-file limit

Cloudflare Pages rejects any single file larger than **25 MiB**. The raw demo
recording is ~78 MB, so it must be compressed before it can ship.

### Compress a new demo video

Original master is kept at `C:\Users\james\ExpenSense\ExpenSense.mp4`.
With ffmpeg installed (`winget install Gyan.FFmpeg`), from `public/assets/video/`:

```powershell
ffmpeg -y -i INPUT.mp4 -vf "scale=720:-2" -c:v libx264 -preset slow -crf 26 `
  -c:a aac -b:a 128k -movflags +faststart expensense-demo.mp4
```

- `scale=720:-2` — 720 px wide, height auto (keeps the 3:4 ratio)
- `crf 26` — quality/size tradeoff; lower = larger/sharper (try 23 if you want more detail)
- `+faststart` — video starts playing immediately instead of buffering

The current file is ~6.8 MB (720x960, full length), well under the limit.

## Short / custom domain

- Free subdomain: `expensense-7aw.pages.dev` (already short).
- For a real custom domain (e.g. `expensense.app`): buy it, then in the Cloudflare
  dashboard open **Workers & Pages → expensense → Custom domains → Set up a domain**.

## Presenting

For a live talk on unreliable wifi, present from a local build
(`npm run preview`) and keep the Cloudflare URL as a backup/share link.
