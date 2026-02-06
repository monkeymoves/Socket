# Hangboard Tabata Timer

A drift-free hangboard timer with presets, quick settings, and real-time start sync using Firebase Realtime Database.

## Local Run

Open `index.html` in a browser. No build step required.

## Firebase Setup (Start Together)

1. Create a Firebase project.
2. Enable **Realtime Database** in test mode.
3. Add a Web App and copy the config values.
4. Paste them into `app.js` under `firebaseConfig`.

## Deploy (Free Options)

### Netlify
- Drag and drop the folder in the Netlify UI, or connect the repo and deploy as a static site.

### GitHub Pages
- Commit the files to a repo.
- In GitHub settings, enable Pages on the `main` branch and root (`/`).

## Presets

Presets are defined in `app.js` under `presets`. Add more by appending to that array.
