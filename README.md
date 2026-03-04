# Hangout Time

Hangboard timer web app with:
- Drift-resistant timing based on a computed timeline + `performance.now()`
- Solo and Collaborate modes
- Real-time synced starts/settings via Firebase Realtime Database
- Mobile-first timer UI with large phase/time/readability

## Current Behavior

- App title: `Hangout Time`
- Default preset on load: `Emil`
- Emil protocol: `30s warmup`, `10s hang`, `20s rest`, `24 reps`, `1 round`
- Emil finger cues shown only during hang phases
- Collaborate mode: create/join session code, sync settings, and sync start timestamp using server time offset

## Project Structure

- `/Users/lukemaggs/Documents/Socket/index.html` UI markup
- `/Users/lukemaggs/Documents/Socket/styles.css` styling and responsive layout
- `/Users/lukemaggs/Documents/Socket/app.js` timer engine + Firebase sync logic
- `/Users/lukemaggs/Documents/Socket/firebase.json` Firebase hosting/database config
- `/Users/lukemaggs/Documents/Socket/database.rules.json` RTDB rules

## Local Development

This is a static app with no Node build tool and no `package.json`.

Run a local static server from project root:

```bash
python3 -m http.server 5173
```

Open:

```text
http://localhost:5173
```

## Firebase Setup

1. Create/select Firebase project.
2. Enable Realtime Database.
3. Add a Web App and copy config keys.
4. Update `firebaseConfig` at top of `/Users/lukemaggs/Documents/Socket/app.js`.
5. Publish RTDB rules (from `/Users/lukemaggs/Documents/Socket/database.rules.json`).

Current rules are intentionally permissive for friend-group sessions under `/sessions`.

## Deploy (Firebase Hosting)

Initial setup (once):

```bash
firebase login
firebase init hosting
```

Suggested answers:
- Existing project: select this Firebase project
- Public directory: `.`
- Single-page app rewrite: `No`
- Overwrite `index.html`: `No`

Deploy:

```bash
firebase deploy
```

Deploy database rules only:

```bash
firebase deploy --only database
```

## Presets

Defined in `/Users/lukemaggs/Documents/Socket/app.js` as `presets`:
- `Repeaters 101`
- `Max Hangs`
- `Emil` (default)

To add a preset:
1. Append a new object to `presets`.
2. Include `settings` with `warmup`, `hang`, `rest`, `reps`, `setRest`, `rounds`.
3. Optionally add `cues` (rep ranges with labels) for per-rep guidance.

## Notes

- `navigator.clipboard` requires secure context (`https` or localhost rules).
- Copy-link has a fallback prompt when clipboard API is unavailable.
- A missing `favicon.ico` warning is harmless; app uses `favicon.svg`.
