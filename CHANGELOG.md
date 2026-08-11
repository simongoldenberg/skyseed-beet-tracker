# Changelog

Alle nennenswerten Änderungen am Skyseed Beet-Tracker.

## Version 2.0.0 — 2026-08-11

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
