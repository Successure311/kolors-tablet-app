KOLORS MOBILE APP
=================

The same dashboard, as an app for department tablets and phones. It has all
three tabs — New Die / Add Parts (admin login), Add Entry, Track a Die — and
saves everything into the Kolors Google Sheet.

It is completely separate from the desktop dashboard (D:\Kolors\app):
  - It does NOT need the office PC/laptop running.
  - It does NOT need to be on the office network.
  - It only needs internet on the tablet.

Both the app and the desktop dashboard read and write the same Google Sheet, so
whatever one adds, the other sees.

There are only 3 steps. Do them in order.


===========================================================
STEP 1 — Update the Apps Script (once)
===========================================================
The app needs the sheet to support deleting rows (delete a part, delete an
employee, reset entries). The current script cannot do that yet.

1. Open your Google Sheet > Extensions > Apps Script.
2. Delete everything in Code.gs.
3. Open APPS_SCRIPT.gs (in this folder), copy all of it, paste it in.
4. Save (Ctrl+S).
5. Click "Deploy" > "Manage deployments".
6. Click the pencil (edit) icon on your existing deployment.
7. Set "Version" to "New version", then click "Deploy".

   IMPORTANT: use "Manage deployments" and edit the EXISTING deployment.
   Do NOT use "New deployment" — that would create a different URL and the
   app would stop working.

The desktop dashboard keeps working exactly as before. This only adds new
abilities; nothing that already worked is changed.


===========================================================
STEP 2 — Put the app online (once, ~2 minutes)
===========================================================
1. Go to  https://app.netlify.com/drop
2. Drag this whole "tablet-app" folder onto that page.
3. Wait a few seconds. It gives you a URL like:
       https://some-random-name-123.netlify.app
4. Open that URL in your computer's browser and check the app loads and shows
   your dies. Write the URL down — every tablet uses it.

(You can create a free Netlify account afterwards to keep the URL permanently
and give it a nicer name. Without an account the site still works, but keep the
URL safe — you cannot look it up again later.)

NOTE: do not just double-click index.html on the PC. Some parts of the app do
not work when opened directly from a folder — it must be opened from the URL.


===========================================================
STEP 3 — Put it on each tablet (~1 minute each)
===========================================================
On every department tablet:

1. Open Chrome.
2. Type in the URL from Step 2.
3. Tap the ⋮ menu (top-right) > "Add to Home screen" (sometimes shown as
   "Install app").
4. Confirm. The Kolors logo now sits on the tablet's home screen.

Tapping that icon opens the app full-screen, with no address bar and no browser
buttons — it looks and behaves like an installed app.

Do this once per tablet. After that, staff just tap the Kolors icon.


===========================================================
USING THE APP
===========================================================
Add Entry tab (opens by default)
  Department > Die > Part + Employee > START.
  Date, time and shift fill in automatically.
  To finish a job, find it in the Entries list below and tap STOP.

New Die / Add Parts tab
  Asks for the admin login first (same as the dashboard: Kolors / 1234).
  The login is checked against the "Admin" tab of your Google Sheet, so if you
  change the password there, the app uses the new one straight away.
  Closing or reloading the app always asks for the login again, so operators
  cannot wander into the admin screens.

Track a Die tab
  Pick a die and tap "Show Status" to see every part against every department
  (Pending / Running / Completed).


===========================================================
NOTES
===========================================================
- A part already running at another department shows "Working elsewhere" and
  cannot be started twice — one physical part, one machine at a time.
- Once a part is stopped (Done) at a department, it disappears from that
  department's list but still shows for all the others.
- "Refresh" (under Entries) re-reads everything from the sheet. Use it when
  several people are working at once and you want the very latest.
- No internet = nothing is saved. The app says so, and nothing is half-written.
  Just try again once the connection is back.
- To change the app later: drag the updated folder onto Netlify again (or, with
  an account, use "Deploys" > drag the folder). Tablets pick up the change the
  next time they are opened — nothing to reinstall.
- The primary URL is now https://kolors.pages.dev (Cloudflare Pages), which
  auto-deploys from the kolors-tablet-app GitHub repo on every push to main —
  no manual zip/upload needed. Same Google Sheet, same data. Netlify is kept
  only until tablet home-screen shortcuts are repointed, then retired. See
  CLOUDFLARE_DEPLOY_STEPS.txt for details.


===========================================================
IF YOU LATER WANT A REAL .APK FILE
===========================================================
Not required — the Home-screen version above is the same app. But if you ever
want an installable APK to pass around:

  1. Go to  https://www.pwabuilder.com
  2. Paste your Netlify URL, click Start.
  3. "Package for stores" > "Android" > accept the signing defaults.
  4. Download the ZIP; the APK is inside.
  5. Copy it to a tablet and tap it to install (allow "unknown sources").
