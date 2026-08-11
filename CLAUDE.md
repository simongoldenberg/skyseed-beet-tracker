# CLAUDE.md — Skyseed Beet-Tracker

## Projekt-Konfiguration
- **Git-Workflow:** vereinfacht        <!-- vollständig | vereinfacht -->
- **Doku-Sprache:** Deutsch            <!-- Deutsch | Englisch -->
- **GitHub:** https://github.com/simongoldenberg/skyseed-beet-tracker

---

## Was ist das Projekt?

Eine installierbare Web-App (PWA), mit der im Feld erfasst wird, welche Baumart in welchem
Feld eines Skyseed-Hochbeets ausgesät wurde — inklusive Fotodokumentation je Feld. Zwei Beete,
je ein Raster von 20 × 13 = 260 Feldern (5,5 × 5,5 cm), adressiert als `A1` bis `M20` — `A1`
liegt hinten links. Die Daten liegen in einem Google Sheet, angebunden über ein
Google-Apps-Script-Webapp; Fotos landen in Google Drive.

Gehostet wird ausschließlich über **GitHub Pages** — kein Netlify, kein anderer Hoster.

## Architektur-Constraints

Diese Punkte sind bewusst so und sollten nicht ohne Rücksprache aufgeweicht werden:

- **Kein Build-Tool, kein npm.** Die gesamte App ist eine einzige `index.html` mit inline CSS
  und inline JavaScript. Es gibt keinen Bundler, keinen Transpiler, keine Dependencies.
- **Deployment = Dateien kopieren.** Ein GitHub-Actions-Workflow lädt `skyseed-beet-tracker/`
  unverändert als Pages-Artefakt hoch — keine Build-Pipeline, kein Kompilierschritt.
- **Backend ist Google Apps Script.** `apps-script.gs` wird nicht deployt, sondern manuell in
  den Apps-Script-Editor des Google Sheets eingefügt (siehe Kopfkommentar in der Datei). Der
  Code ist der tatsächlich produktiv laufende Stand (verifiziert über einen direkten
  Netlify-Deploy-Export), ergänzt um eine Schreibsperre (`LockService`) — das ist die einzige
  bewusste Abweichung vom Original.
- **Kein Auth.** Das Apps-Script-Webapp läuft mit Zugriff „Jeder, ohne Anmeldung". Wer die URL
  kennt, kann das Sheet lesen und schreiben. Deshalb ist das Repo privat.
- **Relative Pfade.** Manifest, Icons und Service Worker werden relativ (`./`) eingebunden,
  damit die App auch unter einem GitHub-Pages-Unterpfad (`/skyseed-beet-tracker/`) funktioniert.
- **Keine QR-Codes.** Die Beet-Zuordnung ist im Feld eindeutig, ein QR-Feature wurde bewusst
  nicht (mehr) eingebaut.

## Dateistruktur

```
.
├── .github/workflows/
│   └── deploy-pages.yml         ← lädt skyseed-beet-tracker/ als GitHub-Pages-Artefakt hoch
├── skyseed-beet-tracker/        ← das, was GitHub Pages ausliefert
│   ├── index.html               ← die komplette App: CSS, HTML, JS, Baumartenliste
│   ├── manifest.json            ← PWA-Metadaten (Name, Farben, Icons)
│   ├── service-worker.js        ← Offline-Cache für statische Dateien + Foto-Thumbnails
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── apps-script.gs               ← Backend-Referenz, manuell ins Google Sheet einzufügen
├── CHANGELOG.md
├── README.md
└── CLAUDE.md
```

## Versionierung

- `APP_VERSION` steht in `skyseed-beet-tracker/index.html` oben im `<script>`-Block, direkt
  unter `API_URL`. Sie wird unten in der fixierten Hinweisleiste angezeigt (`#app-version`).
- **Wichtig:** Bei jeder Änderung an einer Datei aus `STATIC_CACHE` muss `CACHE_VERSION` in
  `service-worker.js` hochgezählt werden. Sonst behalten bereits installierte Geräte die alte
  Version im Cache und sehen die Änderung nie.

## Hinweise für neue Features

| Was du ändern willst | Wo das hingehört |
|---|---|
| Baumartenliste | `<select id="f-baumart">` in `index.html` — direkt als `<option>`-Einträge, keine separate Datenquelle |
| Neues Eingabefeld im Modal | `index.html`: Feld im Modal-Markup, Auslesen in `saveEntry()`, Vorbelegen in `openModal()`, Spalte in `HEADER` (`apps-script.gs`), Spalte im CSV-Export |
| Sync-/Timeout-Verhalten | Konstanten `POLL_INTERVAL`, `FETCH_TIMEOUT`, `SAVE_TIMEOUT`, `UPLOAD_TIMEOUT` in `index.html` |
| Foto-Ablage (Drive-Ordner, Sharing) | `getOrCreatePhotoFolder()` / `handleUploadFoto()` in `apps-script.gs` |
| Backend-Logik, Backups | `apps-script.gs` — danach im Apps-Script-Editor neu bereitstellen |
| Hosting/Deployment | `.github/workflows/deploy-pages.yml` |

**Beim Hinzufügen eines Feldes an alle Stellen denken** — Markup, `openModal()`,
`saveEntry()`, `HEADER` im Apps Script und `exportCSV()`. Vergisst man das Apps Script,
landen die Daten still im Nichts.

### Barrierefreiheit nicht zurückbauen

Rasterzellen und Listeneinträge sind bewusst `<button>`-Elemente, nicht `<div>`s — nur so
funktionieren Tastaturbedienung und Screenreader. Wer sie zurück auf `div` ändert, muss die
globalen `button`-Regeln in `.cell` / `.list-entry` nicht mehr zurücksetzen, bricht aber die
Bedienbarkeit. Der Eintrags-Dialog hält den Fokus (Tab-Trap) und gibt ihn beim Schließen an das
ursprüngliche Element zurück.

## Hosting: GitHub Pages statt Netlify

`.github/workflows/deploy-pages.yml` läuft bei jedem Push auf `main`, der
`skyseed-beet-tracker/**` betrifft, und veröffentlicht den Ordner unverändert über die
offizielle Pages-Action (`actions/upload-pages-artifact` + `actions/deploy-pages`) — keine
Build-Pipeline, nur ein Artefakt-Upload. Repo-Einstellung: **Settings → Pages → Source: GitHub
Actions**.

Die App liegt danach voraussichtlich unter einem Unterpfad
(`https://simongoldenberg.github.io/skyseed-beet-tracker/`), nicht unter einer eigenen Domain
wie bei Netlify. Alle Pfade in `index.html`/`manifest.json`/`service-worker.js` sind relativ,
das funktioniert unter einem Unterpfad ohne Anpassung.

## Fotos: Ablage in Google Drive

`apps-script.gs` implementiert `uploadFoto`/`deleteFoto` wie im tatsächlich produktiv
laufenden Backend: Fotos liegen unter einem Root-Ordner „Skyseed Beet-Tracker Fotos" in
Unterordnern je Beet („Beet 1" / „Beet 2"), Freigabe „Jeder mit Link" (sonst kann der
`<img>`-Tag im Browser das Thumbnail nicht ohne Google-Anmeldung laden). Löschen eines Feldes
räumt die zugehörigen Drive-Dateien mit ab. Backups werden **bewusst nicht** automatisch
gelöscht (siehe Kopfkommentar in `apps-script.gs`) — das ist Absicht, kein Nachholbedarf.
