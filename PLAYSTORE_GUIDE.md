# DineDesk — Play Store Publishing Guide (TWA)

The PWA is already installable from the browser. This guide wraps it as a
**Trusted Web Activity (TWA)** — a thin native shell that publishes the same
web app on Google Play with a store listing, while all code stays in this repo.
No duplicate codebase, and every web deploy automatically ships to app users.

## Prerequisites

- A Google Play Console account (**one-time $25 fee**) — https://play.google.com/console
- Java 17 + Node 18+ installed locally
- The site live at https://www.revontechnologies.in (it is)

## 1. Install Bubblewrap (Google's official TWA tool)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://www.revontechnologies.in/manifest.json
```

Bubblewrap reads our manifest (name, icons, theme color, start_url) and asks a
few questions. Suggested answers:

| Prompt | Answer |
|---|---|
| Package name | `in.revontechnologies.dinedesk` |
| App name | DineDesk POS |
| Display mode | standalone |
| Theme/background color | accept manifest values |

It also **generates and stores the signing key** — keep the keystore password
safe (losing it means you can never update the app on Play).

## 2. Build the app bundle

```bash
bubblewrap build
```

Produces `app-release-signed.apk` / `app-release-bundle.aab`.

## 3. Publish

1. Play Console → Create app → "DineDesk POS" (Business, Free)
2. Upload the `.aab` in Production → Releases
3. Complete the store listing (use `frontend/public/og-image.jpg` and the PWA
   icons — 512px is already store-ready), content rating, privacy policy URL
   (`https://www.revontechnologies.in/privacy`), contact email
   `support@dinedesk.in`
4. Submit for review (TWAs of working PWAs usually pass in 1–3 days)

## 4. Wire the digital asset link (kills the URL bar)

After Play accepts your signing key, get the SHA-256 fingerprint:

```bash
bubblewrap fingerprint list
```

Put it into `frontend/public/.well-known/assetlinks.json`
(replace `REPLACE_WITH_SHA256_FINGERPRINT`), commit, and deploy. Verify:

```
https://www.revontechnologies.in/.well-known/assetlinks.json
```

Play's pre-launch checker confirms statement linking. Until this step, the
TWA shows a thin Chrome URL bar — after it, the app is truly full-screen.

## Notes

- **Backend env vars, database, deploy pipeline: unchanged.** The TWA is a
  viewer over the live PWA.
- Play requires a privacy policy — already live at `/privacy`.
- Updates: push code → Vercel deploys → app users get it on next launch (the
  SW update toast handles the reload). Only native-shell changes need a new
  `.aab` upload.
- Keep the bubblewrap project (`twa/` folder it creates) out of git or in a
  separate folder — it contains signing keys and should never be committed.
