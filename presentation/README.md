# ExpenSense Presentation

Browser-based slide deck for ExpenSense — *Track Smarter. Live Better.*
9 slides, about 10 minutes including the demo video.

## How to run

```powershell
cd presentation
npm install
npm run dev
```

Open http://localhost:5173

## How to build

```powershell
npm run build
npm run preview   # serves the build at http://localhost:4173
```

## Slide order

1. Cover · 2. Presented by · 3. The Problem · 4. Target Users · 5. Scope & Limitations ·
6. Our Solution · 7. Core Features · 8. Live Demo · 9. Closing

Reorder in `src/slides/index.ts`.

## Edit the content

All text lives in `src/data/presentation.ts`. Replace every `[bracketed]` placeholder:
team members and roles, course, section, instructor, school, date, and scope/limitations.

## Add the video

Put your MP4 at:

```
public/assets/video/expensense-demo.mp4
public/assets/video/poster.png   (optional thumbnail)
```

Until the file exists, the Demo slide shows a placeholder. The video never autoplays.

## How to present

- Open localhost, press **F** (or the fullscreen button)
- **→ / Space / PageDown** next · **← / PageUp** previous · **Home / End** first/last
- On the Demo slide, click **PLAY DEMO**. While the video is focused, Space plays/pauses and arrows seek.
- Controls fade after 2.5 s idle; move the mouse to bring them back.

## Export PDF

**Browser:** click the printer button → Save as PDF → Margins: None → enable **Background graphics**.
One slide per page; the video becomes a static "VIDEO DEMO" card. Set `demo.link` in the data file to print a link on it.

**Automated:**

```powershell
npx playwright install chromium   # first time only
npm run export:pdf
```

Output: `dist/ExpenSense-Presentation.pdf`

## Assets

- `public/assets/logo/` — official wordmark and logo mark (copied from `/assets/Branding`)
- `public/assets/shapes/` — the app's organic shapes (copied from `/assets/organic-shapes`)
- `public/assets/mascot/` — mascot art from the app
- `public/fonts/` — Plus Jakarta Sans (local, works offline)
