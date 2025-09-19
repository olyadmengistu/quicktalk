
# QuickTalk — MVP (10s Voice & Video feed)

This is a minimal, free-first **web app** MVP for a short voice/video social platform.
It uses Firebase (free tier) for Auth, Firestore and Storage. The code is intentionally simple
so you can run, test and deploy quickly.

## What is included
- `index.html` — main app UI
- `styles.css` — simple clean styles
- `app.js` — app logic (recording, upload, feed)
- `firebase-config.js` — placeholder; replace with your Firebase config
- `manifest.json` — PWA manifest
- `README.md` — this file

## Quick setup (simple)
1. Install Python (if you don't have it). To test locally:
   - Open terminal in this folder and run:
     ```
     python -m http.server 8000
     ```
   - Open `http://localhost:8000` in your browser.

2. Create a Firebase project (https://console.firebase.google.com)
   - Click "Add project".
   - In Project settings -> SDK setup, copy the web config (replace values in `firebase-config.js`).
   - In "Build" enable **Authentication** (enable Google and Email/Password; or enable Anonymous).
   - Enable **Firestore** (start in test mode for now).
   - Enable **Storage** (start in test mode for testing).

3. Update rules for quick testing (only while testing!):
   - Firestore rules (temporary test, opens to read/write):
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if true;
         }
       }
     }
     ```
   - Storage rules (temporary test):
     ```
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /{allPaths=**} {
           allow read, write: if true;
         }
       }
     }
     ```

4. Run locally and test recording/upload:
   - Serve files (`python -m http.server 8000`) and open the page.
   - Sign in (Google or anonymous), click **Start Recording** and allow mic/camera.
   - Record up to 10 seconds. The clip will upload to Storage and appear in the feed.

5. Deploy to the web (Firebase Hosting) — optional free hosting:
   - Install Firebase CLI: `npm install -g firebase-tools` (requires Node.js)
   - Login: `firebase login`
   - Init hosting: `firebase init hosting` and follow prompts (select project, public directory=`.`)
   - Deploy: `firebase deploy --only hosting`

6. Make it installable / Android:
   - This project is a PWA (has a manifest). Use PWABuilder (https://www.pwabuilder.com/) to generate an Android package (or use Bubblewrap).
   - PWABuilder offers an easy way to make an Android APK/AAB from your hosted site (follow their steps).

## Notes & next steps
- Posts are not automatically deleted from Storage/Firestore. The client hides posts older than 24 hours.
  To actually delete old posts you can add a Firebase Cloud Function (scheduled) or use Firestore TTL features.
- To earn money: add ads, premium features, paid stickers, or promote creator subscriptions.
- Security: before going public, tighten Firestore/Storage rules and add moderation tools.

Good luck! If you want, I can:
- Walk you through creating the Firebase project and pasting the config.
- Add Cloud Function sample code to auto-delete after 24h.
- Create an Android wrapper project for Play Store.
