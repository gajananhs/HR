# Quickair HR — installable HR dashboard (PWA)

A production-ready Progressive Web App that brings the Quickair HR modules (attendance, leave, payroll, people,
requests, KPI reviews, skill matrix, documents) into the **Meridian** design language — same palette, Fraunces / IBM Plex
typography, cards, hero check-in, stat strip, ring, bars and bottom tab bar.

* **100 % static** — plain HTML, CSS and ES modules. No framework, no bundler, no server.
* **CAPL data, no sample data** — the 53-employee master and 9 skill-matrix workbooks are imported by
  `scripts/import-data.py`. Fields the sources don't contain show as *Not on file*; nothing is invented.
* **Salary is never bundled** — HR imports the wages register on their own device; it is AES-encrypted with a
  passcode before it is stored (see *Payroll* below). Check-ins and requests are stored in `localStorage`.
* **Responsive** — phone: bottom tab bar · tablet: icon rail · desktop: full sidebar + multi-column layout.
* **Full PWA** — manifest, service worker (pre-cache + runtime cache), offline fallback, update prompt, install prompt,
  maskable icons, theme colour, iOS meta tags, app shortcuts.
* **GitHub Pages ready** — all URLs are relative and routing uses `#/hash` URLs, so it works from
  `https://<user>.github.io/<repo>/` with no configuration.

---

## Project structure

```
quickair-hr-pwa/
├── index.html                  App shell (sidebar, tab bar, dialogs, PWA meta tags)
├── manifest.json               Web app manifest (name, icons, shortcuts, colours)
├── service-worker.js           Pre-cache, runtime caching, offline fallback, update flow
├── offline.html                Last-resort offline page
├── 404.html                    GitHub Pages "not found" page that links back to the app
├── .nojekyll                   Tells GitHub Pages to serve files as-is
├── css/
│   └── styles.css              Meridian tokens + responsive layout (mobile / tablet / desktop)
├── js/
│   ├── app.js                  Entry: hash router, event delegation, forms
│   ├── views.js                Screen templates (Home, Time, Leave, Pay, People, …)
│   ├── data.js                 Company, leave policy, holidays, KPI + skill helpers
│   ├── data-employees.js       GENERATED — employee master (name + code)
│   ├── data-skills.js          GENERATED — skill matrices, linked to employee codes
│   ├── payroll.js              Encrypted on-device payroll import, unlock, Sl No → code links
│   ├── attendance.js           Attendance + leave-balance calculations
│   ├── store.js                Persisted state (localStorage, fail-safe)
│   ├── docs.js                 Printable payslip / letters ("Save as PDF")
│   ├── pwa.js                  SW registration, update + install prompts, offline banner
│   └── utils.js                Formatting, escaping, toasts
├── icons/
│   ├── icon-192.png  icon-512.png  icon-512-maskable.png
│   ├── apple-touch-icon.png  favicon-32.png  favicon.svg
├── scripts/
│   ├── check.mjs               Verifies precache list, manifest icons and imports
│   ├── build.mjs               Copies to dist/ and stamps the service-worker cache id
│   ├── import-data.py          Rebuilds the data files from CAPL's spreadsheets + validation report
│   └── generate-icons.py       Regenerates all PNG icons (optional)
├── .github/workflows/deploy.yml  CI: check → build → deploy to GitHub Pages
├── package.json  .gitignore  LICENSE  README.md
```

---

## Screens

| Route | What it shows |
| --- | --- |
| `#/home` | Live clock + check-in / out, stat strip, team attendance bars, pending approvals (approve / reject), upcoming holidays & events |
| `#/time` | Monthly attendance calendar (P, CL, SL, EL, H, OFF, ?), daily log, **Regularize** missed punches, team snapshot |
| `#/leave` | Balance ring (CL / SL / EL), request form with validation, history, employment details, leave policy |
| `#/pay` | Restricted payroll: import + passcode, register exactly as in the wages sheet, link Sl No → employee code, payslip PDF |
| `#/people`, `#/people/<id>` | Searchable directory with department filters and profile pages |
| `#/requests` | Salary advance, late / early permission, expenses, approvals queue |
| `#/performance` | KPI reviews with weighted scores (empty until KPI data is supplied) |
| `#/skills` | Department skill matrices — Expected vs Current (1–4), gaps, competency % |
| `#/documents` | Employment letter, salary certificate, etc. (print / save as PDF) |
| `#/more` | Mobile menu, install button, data status, clear local records |

---

## 1. Run it locally

You need **Node 18+** (only for the tiny dev server and scripts). Service workers require `http://localhost` or HTTPS —
opening `index.html` by double-click (`file://`) will not work.

```bash
git clone https://github.com/<your-user>/<your-repo>.git
cd <your-repo>

npm start          # serves the project at http://localhost:8080
```

No Node? Any static server works, for example:

```bash
python3 -m http.server 8080      # then open http://localhost:8080
```

Open the site in Chrome / Edge and check **DevTools → Application** for the manifest, service worker and cache storage.

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Local dev server on port 8080 |
| `npm run check` | Verifies every pre-cached file, manifest icon and JS import exists |
| `npm run build` | Runs the check, then writes the deployable site to `dist/` |
| `npm run preview` | Serves `dist/` on port 8081 to test the production build |
| `npm run icons` | Regenerates the PNG icons (needs `pip install pillow`) |

---

## 2. Create the GitHub repository and push

1. On GitHub, click **New repository**. Name it (e.g. `quickair-hr-pwa`), keep it **Public** (free GitHub Pages requires
   a public repo unless you have a paid plan), and **do not** add a README / .gitignore / licence (this project has them).
2. In the project folder:

```bash
git init
git add .
git commit -m "Initial commit: Quickair HR PWA"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

---

## 3. Deploy to GitHub Pages

### Option A — GitHub Actions (recommended)

The workflow in `.github/workflows/deploy.yml` checks the project, builds `dist/` with a fresh service-worker cache id
and publishes it on every push to `main`.

1. In the repository go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or open the **Actions** tab → *Deploy to GitHub Pages* → **Run workflow**).
4. When the run turns green, the site is live at:

```
https://<your-user>.github.io/<your-repo>/
```

### Option B — Deploy from a branch (no CI)

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Branch: `main`, folder: `/ (root)` → **Save**.
3. Wait ~1 minute; the site is served from `https://<your-user>.github.io/<your-repo>/`.

> With Option B nothing stamps a new cache id. Whenever you change app files, bump `VERSION` at the top of
> `service-worker.js` (e.g. `'1.0.1'`) so installed apps pick up the update.

### Custom domain (optional)

Add the domain under **Settings → Pages → Custom domain** and create the DNS record GitHub shows. The app needs no
changes — all paths are relative, so it works at a domain root as well as at `/<repo>/`.

---

## 4. Install and test the PWA

1. Open the live URL in **Chrome / Edge** (desktop or Android) → click the install icon in the address bar, or open
   **More → Install app** (mobile).
2. **iPhone / iPad (Safari):** Share → **Add to Home Screen**.
3. Verify offline mode: after the first load, turn on airplane mode (or DevTools → Network → *Offline*) and reload —
   the app still opens and shows an "offline" banner.
4. Lighthouse (DevTools → Lighthouse → *Progressive Web App*) should report the app as installable.

### How updates reach users

Each deployment changes the service-worker cache id. Installed users see a **"A new version is ready — Update"**
toast; tapping it activates the new worker and reloads.

---

## How subpath hosting works

* Every asset, the manifest `start_url` / `scope`, and the service-worker registration use **relative** paths.
* The service worker resolves its pre-cache list against `self.registration.scope`, so it works at `/` and `/<repo>/`.
* Navigation uses `#/route` hashes, so refreshing or sharing a deep link (`…/<repo>/#/leave`) never hits a 404.
* `404.html` is a safety net for mistyped URLs and links back to the app root.

---

## Data import (CAPL spreadsheets)

```bash
pip install openpyxl
python3 scripts/import-data.py \
  --master Emp_Name_With_ID.xlsx \
  --salary salary_statement.xlsx \
  --skills skill_matrix_*.xlsx ASSEMBLY_*.xlsx BALL_VALVE_*.xlsx CONVEYOR_*.xlsx \
  --payroll-out ../private/payroll-YYYY-MM.json \
  --report-out ../private/import-report.json
```

* Rewrites `js/data-employees.js` and `js/data-skills.js`, then bump `VERSION` in `service-worker.js`.
* Skill-matrix names are linked to codes only when exactly one master employee matches; ambiguous or unknown
  names stay unlinked and are listed in the report.
* The payroll JSON and the report go **outside** the project. `.gitignore` blocks `private/` and `*payroll*.json`.

## Payroll (restricted)

1. Pay → choose the payroll `.json` → set a passcode (6+ characters) → **Import & encrypt**.
2. The register has no employee names, so link each Sl No to an employee code (one code per row).
   Links are stored inside the encrypted blob; **Download links (CSV)** exports Sl No / code / name only.
3. Payroll auto-locks after 5 minutes in the background, or with **Lock**. A lost passcode cannot be recovered —
   remove payroll from the device and import again.

> Employee names, codes and skill ratings are still employee data. Host the app privately (behind the CAPL login
> on Hostinger, or a private GitHub Pages site on an Enterprise plan) rather than on a public Pages URL.

## Customising

| Want to change… | Edit |
| --- | --- |
| Employees, skills | Re-run `scripts/import-data.py` |
| Holidays, KPI reviews (`KPI_REVIEWS`) | `js/data.js` |
| Leave entitlement (CL / SL / EL) | `LEAVE_POLICY` in `js/data.js` |
| Colours & typography | CSS variables at the top of `css/styles.css` |
| App name / short name / theme colour | `manifest.json` and the `<meta>` tags in `index.html` |
| Icons | Edit `scripts/generate-icons.py`, run `npm run icons` |
| Adding a JS file | Add it to `PRECACHE` in `service-worker.js` (`npm run check` will remind you) |

### Connecting a real backend later

All reads/writes go through `js/store.js` and the view helpers. To connect the original PHP/MySQL API (Employee
Master, salary slips, LOGBOOK attendance), replace the generated `js/data-*.js` modules with `fetch()` calls and keep the service worker's network-first strategy for
`/api/` requests (add a rule in `fetch` for that path prefix).

---

## Fonts and offline

Fraunces, IBM Plex Sans and IBM Plex Mono load from Google Fonts and are cached by the service worker after the first
visit. Until then (or if blocked) the app falls back to Georgia / system-ui, so it stays fully usable. To self-host the
fonts, download the `.woff2` files into `fonts/`, add `@font-face` rules to `css/styles.css`, remove the Google Fonts
`<link>` tags from `index.html`, and add the files to `PRECACHE`.

## Browser support

Current Chrome, Edge, Firefox, Safari (iOS 16.4+ for install features) and Samsung Internet. Uses ES modules,
`<dialog>`, CSS grid and `localStorage`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank page on GitHub Pages | Confirm Pages source is set (Step 3) and the URL ends with `/<repo>/`. |
| Old version still showing | DevTools → Application → Service Workers → *Unregister*, or accept the in-app update toast. |
| "Install" not offered | Must be served over HTTPS (GitHub Pages is) and not already installed; Safari uses *Add to Home Screen*. |
| Works locally, not after deploy | Run `npm run check`; a missing file in `PRECACHE` blocks service-worker installation. |
| Clear my check-ins / requests | **More → Clear my local records** (payroll is untouched). |

## Licence

MIT — see [LICENSE](LICENSE). Employee data © Canares Automation Pvt. Ltd. — confidential.
