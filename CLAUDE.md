# CLAUDE.md — Skyseed Beet-Tracker

## Projekt-Konfiguration
- **Git-Workflow:** vereinfacht        <!-- vollständig | vereinfacht -->
- **Doku-Sprache:** Deutsch            <!-- Deutsch | Englisch -->
- **GitHub:** https://github.com/simongoldenberg/skyseed-beet-tracker

---

## Was ist das Projekt?

Eine installierbare Web-App (PWA), mit der im Feld erfasst wird, welche Baumart in welchem
Feld eines Skyseed-Hochbeets ausgesät wurde. Zwei Beete, je ein Raster von 11 × 7 = 77 Feldern
(10 × 10 cm), adressiert als `A1` bis `G11` — `A1` liegt hinten links. Die Daten liegen in einem
Google Sheet, angebunden über ein Google-Apps-Script-Webapp.

## Architektur-Constraints

Diese Punkte sind bewusst so und sollten nicht ohne Rücksprache aufgeweicht werden:

- **Kein Build-Tool, kein npm.** Die gesamte App ist eine einzige `index.html` mit inline CSS
  und inline JavaScript. Es gibt keinen Bundler, keinen Transpiler, keine Dependencies.
- **Deployment = Dateien kopieren.** Netlify liefert das Verzeichnis `skyseed-beet-tracker/`
  statisch aus. Es gibt keinen Build-Schritt.
- **Backend ist Google Apps Script.** `apps-script.gs` wird nicht deployt, sondern manuell in
  den Apps-Script-Editor des Google Sheets eingefügt (siehe Kopfkommentar in der Datei).
- **Kein Auth.** Das Apps-Script-Webapp läuft mit Zugriff „Jeder, ohne Anmeldung". Wer die URL
  kennt, kann das Sheet lesen und schreiben. Deshalb ist das Repo privat.
- **Relative Pfade.** Manifest, Icons und Service Worker werden relativ (`./`) eingebunden,
  damit die App auch in einem Unterverzeichnis funktioniert.

## Dateistruktur

```
.
├── skyseed-beet-tracker/        ← das, was Netlify ausliefert (Publish-Verzeichnis)
│   ├── index.html               ← die komplette App: CSS, HTML, JS, Baumartenliste
│   ├── manifest.json            ← PWA-Metadaten (Name, Farben, Icons)
│   ├── service-worker.js        ← Offline-Cache für die statischen Dateien
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── apps-script.gs               ← Backend, manuell ins Google Sheet einzufügen
├── deployed-snapshot/           ← Sicherung des abweichenden Netlify-Livestands
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
| Neue Baumart, Kürzel ändern | `BAUMARTEN` in `index.html` — **einzige** Datenquelle, Dropdown und Kürzel entstehen daraus |
| Neues Eingabefeld im Modal | `index.html`: Feld im Modal-Markup, Auslesen in `saveEntry()`, Vorbelegen in `openModal()`, Spalte in `HEADER` (`apps-script.gs`), Spalte im CSV-Export |
| Neue Benutzer-Kürzel | `<select id="f-benutzer">` in `index.html` |
| Sync-/Timeout-Verhalten | Konstanten `POLL_INTERVAL`, `FETCH_TIMEOUT`, `SAVE_TIMEOUT` in `index.html` |
| Backend-Logik, Backups | `apps-script.gs` — danach im Apps-Script-Editor neu bereitstellen |

**Beim Hinzufügen eines Feldes an alle fünf Stellen denken** — Markup, `openModal()`,
`saveEntry()`, `HEADER` im Apps Script und `exportCSV()`. Vergisst man das Apps Script,
landen die Daten still im Nichts.

### Barrierefreiheit nicht zurückbauen

Rasterzellen und Listeneinträge sind bewusst `<button>`-Elemente, nicht `<div>`s — nur so
funktionieren Tastaturbedienung und Screenreader. Wer sie zurück auf `div` ändert, muss die
globalen `button`-Regeln in `.cell` / `.list-entry` nicht mehr zurücksetzen, bricht aber die
Bedienbarkeit. Die Dialoge halten den Fokus über `openOverlay()` / `closeOverlay()`.

## Offener Punkt: Livestand weicht ab

Der auf Netlify laufende Stand und der Code in diesem Repo sind **auseinandergelaufen** — siehe
den Abschnitt „Known Issues" im [CHANGELOG.md](CHANGELOG.md). Vor dem nächsten Deployment muss
das zusammengeführt werden, sonst gehen Funktionen verloren. Netlify daher **noch nicht** mit
diesem Repo verbinden.
