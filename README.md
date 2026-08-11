# Skyseed Beet-Tracker

Installierbare Web-App (PWA) zur Erfassung von Testsaaten in Skyseed-Hochbeeten, inklusive
Fotodokumentation je Feld. Zwei Beete, je 20 × 13 = 260 Felder im 5,5 × 5,5 cm Raster,
adressiert `A1`–`M20` (`A1` hinten links).

Gehostet über **GitHub Pages** — kein Netlify.

## Wie es funktioniert

| Schicht | Technik |
|---|---|
| Frontend | Eine einzige `index.html` — inline CSS und JavaScript, keine Dependencies, kein Build |
| Datenhaltung | Google Sheet, ein Tabellenblatt je Beet (`Beet 1`, `Beet 2`) |
| Fotos | Google Drive, referenziert per Datei-ID im Sheet |
| API | Google Apps Script Webapp (`doGet` / `doPost`) |
| Hosting | GitHub Pages, Deployment über GitHub Actions (`.github/workflows/deploy-pages.yml`) |

Die App fragt den Serverstand alle 15 Sekunden ab und schreibt Änderungen sofort zurück.
Fällt das Netz aus, zeigt sie den letzten lokal gespeicherten Stand weiter an (mit Zeitstempel);
Speichern ist dann erst wieder online möglich.

## Bedienung

- **Feld antippen** öffnet den Eintrags-Dialog.
- **Schnell-Eintrag:** Raster-ID ins Eingabefeld tippen (`C5`, `M20`) und Enter — springt direkt
  in den Dialog, ohne im Raster suchen zu müssen.
- **Liste / Raster** schaltet zwischen Rasteransicht und chronologischer Liste um.
- **CSV** exportiert das aktuell gewählte Beet.
- **Fotos:** im Dialog „+ Foto hinzufügen" — nimmt mit der Kamera auf oder wählt eine Datei,
  lädt sie nach Google Drive hoch. Belegte Felder mit Fotos zeigen einen kleinen Zähler-Punkt.
- Ein direkter Link mit `?beet=1` bzw. `?beet=2` öffnet die App gleich im richtigen Beet.
- Vollständig per Tastatur bedienbar: Tab durch das Raster, Enter/Leertaste öffnet ein Feld,
  Escape schließt den Dialog.

## Lokal starten

Kein Build, kein Server nötig — `skyseed-beet-tracker/index.html` im Browser öffnen genügt.

Einzige Einschränkung bei `file://`: Service Worker und PWA-Installation funktionieren nicht
(beides verlangt http/https). Wer das mittesten will, braucht einen lokalen Webserver, z. B.:

```bash
npx serve skyseed-beet-tracker
```

## Hosting auf GitHub Pages

Kein separater Hosting-Account nötig. Einrichtung einmalig:

1. **Settings → Pages → Source: GitHub Actions** im Repo aktivieren.
2. Push auf `main` mit Änderungen unter `skyseed-beet-tracker/**` löst
   `.github/workflows/deploy-pages.yml` automatisch aus.
3. Die URL steht danach unter **Settings → Pages** bzw. im Workflow-Run als `page_url`.

Es gibt keine Build-Pipeline — der Workflow lädt den Ordner `skyseed-beet-tracker/` unverändert
als Pages-Artefakt hoch (`actions/upload-pages-artifact` + `actions/deploy-pages`).

> [!NOTE]
> GitHub Pages liefert das Repo typischerweise unter einem Unterpfad
> (`https://<user>.github.io/skyseed-beet-tracker/`), nicht unter einer eigenen Domain wie bei
> Netlify. Alle Pfade in der App sind relativ und funktionieren damit ohne Anpassung.

## Backend einrichten

Vollständige Schritt-für-Schritt-Anleitung steht im Kopfkommentar von
[`apps-script.gs`](apps-script.gs). Kurzfassung:

1. Google Sheet anlegen → **Erweiterungen → Apps Script**
2. Inhalt von `apps-script.gs` einfügen und speichern
3. **Bereitstellen → Neue Bereitstellung** → Typ *Web-App*, Ausführen als *Ich*,
   Zugriff *Jeder*
4. Die erzeugte URL in `skyseed-beet-tracker/index.html` bei `const API_URL = …` einsetzen
5. Beim ersten Foto-Upload fragt Google nach Drive-Zugriff — einmalig bestätigen
   (Berechtigung des Deployment-Besitzers, nicht der einzelnen Nutzer:innen)
6. Für wöchentliche Backups einen Zeit-Trigger auf `weeklyBackup` einrichten (Sonntag, 3–4 Uhr).
   Backups bleiben 8 Wochen erhalten, ältere werden automatisch entfernt.

> [!IMPORTANT]
> `apps-script.gs` in diesem Repo ist eine **Referenz-Implementierung**, abgeleitet aus dem
> API-Vertrag, den die App tatsächlich nutzt (`upsert` / `delete` / `uploadFoto` /
> `deleteFoto`). Läuft bereits ein Deployment hinter der aktuellen `API_URL`, dieses hier
> **nicht blind drüberkopieren** — dessen Quellcode ist über HTTP nicht einsehbar und könnte
> ein anderes Sheet-Layout oder andere Foto-Ablage verwenden. Vorher im Apps-Script-Editor
> vergleichen.

### Spalten im Google Sheet

`Raster-ID` · `Baumart` · `Postennummer` · `Datum` · `Kommentar` · `Fotos` (JSON-Array) ·
`Updated`

Die Reihenfolge ist bindend — `doGet` liest die Spalten positionsbasiert.

## Zugriff und Vertraulichkeit

Das Apps-Script-Webapp läuft mit Zugriff „Jeder, ohne Anmeldung". Es gibt keine
Authentifizierung: **wer die API-URL kennt, kann alle Einträge lesen, ändern und löschen.**
Die URL steht im Quelltext der App und ist damit für jeden sichtbar, der die Seite öffnet.

Deshalb ist dieses Repo privat. Wird es öffentlich gestellt, ist die URL zusätzlich über
Suchmaschinen und Code-Scanner auffindbar. Soll das Repo öffentlich werden, vorher die
API-URL rotieren (neue Bereitstellung im Apps Script erzeugt eine neue URL) und über eine
nicht eingecheckte Konfiguration einbinden.

## Versionierung

Aktuelle Version steht in `APP_VERSION` in `index.html` und wird unten in der App angezeigt.
Änderungen sind im [CHANGELOG.md](CHANGELOG.md) dokumentiert.
