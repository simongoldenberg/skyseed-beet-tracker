# Changelog

Alle nennenswerten Änderungen am Skyseed Beet-Tracker.

## Version 3.0.1 — 2026-08-11

Ersetzt die in v3.0.0 als „Referenz-Implementierung" gekennzeichnete `apps-script.gs` durch den
tatsächlich produktiv laufenden Backend-Code — direkt aus einem zweiten, unabhängigen Export
bereitgestellt. Behebt dabei mehrere Abweichungen, die bei einer frischen Bereitstellung der
v3.0.0-Datei gegen das echte Sheet zu falschen Daten geführt hätten.

### 🐛 Fixed
- **Sheet-Spaltenreihenfolge korrigiert:** `Updated` steht vor `Fotos`, nicht danach. Die
  v3.0.0-Fassung hätte beim echten, bereits produktiv befüllten Sheet die beiden Spalten
  positionsbasiert vertauscht ausgelesen.
- **Löschen eines Feldes löscht jetzt auch dessen Drive-Fotos.** Bisher blieben verwaiste
  Foto-Dateien im Drive-Ordner zurück.
- **Fotos liegen in Unterordnern je Beet** (`Skyseed Beet-Tracker Fotos/Beet 1` bzw.
  `/Beet 2`) statt in einem einzigen gemeinsamen Ordner.
- Backup-Pruning entfernt — das produktive Backend behält Backups bewusst dauerhaft
  (Foto-Referenzen müssen erhalten bleiben), v3.0.0 hätte sie nach 8 Wochen gelöscht.

### 🚀 Added
- Migrationslogik: fehlt einem bestehenden Sheet die „Fotos"-Spalte, wird sie automatisch
  ergänzt (v2 → v3-Upgrade eines schon befüllten Sheets).
- `selfTest()` und `showFotoFolderLink()` als Diagnose-Funktionen, direkt aus dem
  Apps-Script-Editor ausführbar.
- Fehlermeldungen enthalten jetzt den Stacktrace (`err.stack`).

### 🔄 Changed
- `apps-script.gs` gilt nicht mehr als unverifizierte Referenz-Implementierung, sondern als
  verifizierter Produktivcode plus einer einzigen bewussten Ergänzung: einer Schreibsperre
  (`LockService`) um `upsert`/`delete`, die im beobachteten Original fehlt. Foto-Aktionen
  bleiben ohne Sperre, damit ein langsamer Upload keine parallelen Sheet-Schreibvorgänge
  blockiert.

## Version 3.0.0 — 2026-08-11

**[BREAKING]** Ersetzt die in v2.0.0 unter Versionskontrolle gebrachte Version vollständig durch
den tatsächlich produktiv laufenden Stand (per Netlify-Deploy-Export bereitgestellt) und
migriert das Hosting von Netlify auf GitHub Pages.

Der in v2.0.0 dokumentierte „Known Issues"-Verdacht — Repo-Stand und Netlify-Livestand liefen
auseinander — hat sich bestätigt: v2.0.0 basierte auf einer veralteten, nie live gegangenen
Zwischenversion (77-Felder-Raster, Felder „Benutzer" und eigene Baumarten, kein Foto-Feature).
Der echte Produktivstand hat ein 260-Felder-Raster und eine Fotodokumentation je Feld, aber
weder „Benutzer" noch eigene Baumarten. Diese Version übernimmt den echten Stand als neue
Grundlage.

### 💥 Breaking Changes
- **Rastergröße:** 20 × 13 = 260 Felder (5,5 × 5,5 cm) statt 11 × 7 = 77 Felder (10 × 10 cm).
  Quick-Eintrag-Muster jetzt `A1`–`M20` statt `A1`–`G11`.
- **Feld „Benutzer" entfernt** — existierte nur in der veralteten Zwischenversion, nie in
  Produktion.
- **Eigene Baumarten (Hinzufügen/Verwalten) entfernt** — ebenfalls nur in der veralteten
  Zwischenversion. Die Baumartenliste ist jetzt fest im Dropdown hinterlegt, mit einer
  Sammelkategorie „Andere / Freitext" für Sonderfälle.
- **Kürzel-Tabelle entfernt.** Die Rasterzelle zeigt jetzt den ersten Namensteil vor der
  Klammer, gekürzt auf 4 Zeichen (z. B. „Fich…" für „Fichte (Picea abies)") — abgeleitet aus
  einer einzigen Funktion (`kurzLabel()`), keine separate Kürzel-Liste mehr zu pflegen.
- **`API_URL` geändert** auf die tatsächlich produktiv genutzte Apps-Script-Bereitstellung.
- **Sheet-Spaltenlayout geändert:** `Raster-ID · Baumart · Postennummer · Datum · Kommentar ·
  Fotos · Updated` (keine `Benutzer`-Spalte mehr, neue `Fotos`-Spalte als JSON-Array).

### 🚀 Added
- **Fotodokumentation je Feld.** Kameraaufnahme oder Dateiauswahl, Upload nach Google Drive,
  Datum je Foto editierbar, Vorschaubild, Zähler-Punkt auf belegten Rasterzellen.
- **Hosting über GitHub Pages** statt Netlify — `.github/workflows/deploy-pages.yml` lädt
  `skyseed-beet-tracker/` bei jedem Push auf `main` unverändert als Pages-Artefakt hoch, keine
  Build-Pipeline.
- **Backend-Aktionen `uploadFoto` / `deleteFoto`** in `apps-script.gs` — legt Fotos in einem
  Drive-Ordner „Skyseed Beet-Tracker Fotos" ab, mit Freigabe „Jeder mit Link" für die
  Thumbnail-Anzeige im Browser.
- Alle Robustheits- und Barrierefreiheits-Verbesserungen aus v2.0.0 wurden auf den echten
  Produktivstand übertragen: lokaler Zwischenspeicher der Einträge in `localStorage` mit
  sichtbarem Zeitstempel bei Offline-Anzeige, Zeitgrenzen für Server-Requests (12 s lesend,
  20 s schreibend, 60 s für Foto-Uploads), echte `<button>`-Rasterzellen/-Listeneinträge mit
  sprechender Beschriftung, Fokus-Halt und -Rückgabe im Eintrags-Dialog, kein Hintergrund-
  Polling, Beet-Pinning beim Speichern, `LockService` + `flush()` im Backend für Sheet-Schreib-
  vorgänge (nicht für Foto-Uploads — die brauchen kein Sheet-Lock und sollen parallele
  Sheet-Schreibvorgänge nicht blockieren).

### 🔄 Changed
- **QR-Codes entfernt.** Die Beet-Zuordnung ist im Feld eindeutig, das Feature war überflüssig.
  Der direkte Link mit `?beet=1`/`?beet=2` bleibt erhalten (z. B. für Lesezeichen), nur die
  QR-Bild-Erzeugung und der zugehörige Dialog sind weg.
- `CACHE_VERSION` des Service Workers auf `skyseed-beet-v4` erhöht.
- Icons durch die tatsächlich produktiv genutzten Dateien ersetzt (weichen leicht von den
  vorherigen ab).

### 🐛 Fixed
- `apps-script.gs` implementierte `uploadFoto`/`deleteFoto` nicht und wäre bei diesen Aktionen
  stillschweigend in den `upsert`-Standardfall gefallen — hätte bei einer frischen Bereitstellung
  falsche Zeilen ins Sheet geschrieben. Jetzt beide Aktionen als Referenz-Implementierung
  vorhanden (siehe Hinweis unten).

> [!CAUTION]
> ### 🐙 Known Issues
>
> **`apps-script.gs` ist eine Referenz-Implementierung, nicht der verifizierte Produktivcode.**
> Die Aktionen `uploadFoto`/`deleteFoto` wurden aus dem Vertrag abgeleitet, den `index.html`
> tatsächlich an die API stellt — der Quellcode des bereits hinter `API_URL` laufenden Scripts
> ist über HTTP nicht einsehbar und wurde daher nicht 1:1 übernommen. Vor einem Redeploy dieser
> Datei über ein bereits produktiv laufendes Script: im Apps-Script-Editor vergleichen, sonst
> drohen ein abweichendes Sheet-Layout oder eine andere Foto-Ablage.
>
> **Datenkontinuität ungeklärt:** Diese Version zeigt bei `?beet=1`/`?beet=2` die Daten hinter
> der neuen `API_URL`. Ob und wie das vorher im Repo hinterlegte, andere Sheet (siehe v2.0.0)
> weiterverwendet werden soll, ist offen.

## Version 2.0.0 — 2026-08-11 *(überholt, siehe v3.0.0)*

Erste Version unter Versionskontrolle. Der bestehende Stand wurde übernommen und um
Robustheit, Barrierefreiheit und eine zentrale Baumartenliste erweitert.

### 🚀 Added
- **Lokaler Zwischenspeicher der Einträge.** Der letzte vom Server geladene Stand wird je Beet
  in `localStorage` gehalten und im Funkloch angezeigt — inklusive Zeitstempel, wann er geladen
  wurde. Bisher versprach die Offline-Meldung genau das, lieferte aber ein leeres Raster.
- **Zeitgrenze für Server-Requests** (12 s lesend, 20 s schreibend). Ein hängender Request im
  schwachen Netz hat die Anzeige vorher dauerhaft auf „lade…" stehen lassen.
- **Tastatur- und Screenreader-Bedienung.** Rasterzellen und Listeneinträge sind jetzt echte
  `<button>`-Elemente mit sprechender Beschriftung („Feld C5, Reihe C Spalte 5, belegt:
  Fichte (Picea abies), Aussaat 2026-03-14"). Dialoge halten den Fokus fest und geben ihn beim
  Schließen an das ursprüngliche Feld zurück. Sichtbarer Fokus-Ring.
- **Sichtbare Versionsnummer** (`APP_VERSION`) in der Hinweisleiste am unteren Rand.
- **Sperre gegen parallele Schreibzugriffe im Backend** (`LockService`). Zwei gleichzeitige
  Einträge konnten dieselbe Raster-ID doppelt anlegen oder sich gegenseitig überschreiben,
  weil beide den Bestand lasen, die Zeile nicht fanden und je eine neue anhängten.

### 🔄 Changed
- **Baumarten kommen aus einer einzigen Datenquelle.** Dropdown-Optionen und Kürzel-Anzeige
  entstehen beide aus der Liste `BAUMARTEN`. Vorher waren das zwei parallel gepflegte Listen —
  eine neue Art musste an zwei Stellen ergänzt werden, sonst fehlte still das Kürzel.
- **Kein Polling im Hintergrund.** Liegt die App nicht im Vordergrund, entfällt die
  Abfrage alle 15 s; beim Zurückkehren wird sofort aktualisiert. Schont Akku und Datenvolumen
  im Feld.
- Escape schließt nur noch die oberste Dialogebene statt mehrerer gleichzeitig.
- `CACHE_VERSION` des Service Workers auf `skyseed-beet-v2` erhöht, damit installierte Geräte
  die neue Version erhalten.

### 🐛 Fixed
- **Beet-Wechsel während des Speicherns.** Speichern und Löschen halten das Zielbeet fest.
  Vorher wurde beim Wechsel mitten im Vorgang der lokale Stand des falschen Beets verändert.
- Verweis auf eine nicht existierende Datei `beet-tracker.html` im Kopfkommentar von
  `apps-script.gs` korrigiert.
- Backend erzwingt `SpreadsheetApp.flush()`, bevor die Schreibsperre fällt — sonst konnte der
  nächste Request noch den alten Bestand lesen.

> [!CAUTION]
> ### 🐙 Known Issues
>
> **Der Netlify-Livestand und dieses Repo sind auseinandergelaufen.** Es sind zwei
> unterschiedliche Entwicklungslinien, keine bloß veraltete Kopie. Ein Deployment dieses Repos
> würde live vorhandene Funktionen entfernen.
>
> Nur **live** vorhanden (`deployed-snapshot/index.html`):
> - Foto-Erfassung je Feld: Kameraaufnahme, Upload nach Google Drive, Datum je Foto,
>   Vorschaubilder, Zähler-Punkt auf belegten Feldern
> - Ein anderes Apps-Script-Backend (abweichende `API_URL`)
> - Spaltenlayout im Sheet mit Foto- und Beobachtungs-Feldern
>
> Nur in **diesem Repo** vorhanden:
> - Feld „Benutzer"
> - Eigene Baumarten hinzufügen und verwalten (`localStorage`)
> - Kürzel-Anzeige in den Rasterzellen
> - Funktionierende PWA: `manifest.json`, `service-worker.js` und Icons sind auf Netlify
>   **nicht** deployt (liefern 404), die Live-App ist daher nicht installierbar und hat keinen
>   Offline-Modus
>
> **Folge für die Datenanzeige:** Das Sheet hinter der im Repo hinterlegten `API_URL` enthält
> inzwischen Zeilen im neuen Spaltenlayout. Diese Version liest sie positionsbasiert falsch
> aus — beobachtet wurden Anzeigen wie „Aussaat Beobachtung 2" und eine Postennummer, die einen
> Zeitstempel enthält. Vor dem Zusammenführen sollte geklärt werden, welches Spaltenlayout
> gilt.
>
> **Nächster Schritt:** beide Linien zusammenführen (Fotos + Benutzer/Kürzel/eigene Baumarten in
> einer Version), Spaltenlayout im Sheet festlegen, dann erst Netlify auf dieses Repo umstellen.
>
> **Nicht konfiguriert:** `Cache-Control: no-cache` für `service-worker.js` auf Netlify. Ohne
> diesen Header können neue Versionen installierte Geräte dauerhaft nicht erreichen.
