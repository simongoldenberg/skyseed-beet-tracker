# Skyseed Beet-Tracker

Installierbare Web-App (PWA) zur Erfassung von Testsaaten in Skyseed-Hochbeeten.
Zwei Beete, je 11 × 7 = 77 Felder im 10 × 10 cm Raster, adressiert `A1`–`G11` (`A1` hinten links).

Live: https://skyseed-beet.netlify.app/

> [!WARNING]
> Der aktuell auf Netlify laufende Stand entspricht **nicht** dem Code in diesem Repo.
> Details unter [Known Issues](CHANGELOG.md#-known-issues). Netlify bitte noch **nicht** mit
> diesem Repo verbinden — sonst gehen die nur live vorhandenen Funktionen verloren.

## Wie es funktioniert

| Schicht | Technik |
|---|---|
| Frontend | Eine einzige `index.html` — inline CSS und JavaScript, keine Dependencies, kein Build |
| Datenhaltung | Google Sheet, ein Tabellenblatt je Beet (`Beet 1`, `Beet 2`) |
| API | Google Apps Script Webapp (`doGet` / `doPost`) |
| Hosting | Netlify, statische Auslieferung von `skyseed-beet-tracker/` |

Die App fragt den Serverstand alle 15 Sekunden ab und schreibt Änderungen sofort zurück.
Fällt das Netz aus, zeigt sie den letzten lokal gespeicherten Stand weiter an; Speichern ist
dann erst wieder online möglich.

## Bedienung

- **Feld antippen** öffnet den Eintrags-Dialog.
- **Schnell-Eintrag:** Raster-ID ins Eingabefeld tippen (`C5`) und Enter — springt direkt in
  den Dialog, ohne im Raster suchen zu müssen.
- **Liste / Raster** schaltet zwischen Rasteransicht und chronologischer Liste um.
- **CSV** exportiert das aktuell gewählte Beet.
- **QR-Codes** erzeugt je Beet einen Code, der die App direkt mit dem richtigen Beet öffnet
  (`?beet=1` bzw. `?beet=2`). Gedacht zum Ausdrucken und Anbringen am Beet.
- Belegte Felder zeigen das Skyseed-Team-Kürzel der Baumart, z. B. `SKi` für Schwarzkiefer.
- Vollständig per Tastatur bedienbar: Tab durch das Raster, Enter/Leertaste öffnet ein Feld,
  Escape schließt Dialoge.

## Lokal starten

Kein Build, kein Server nötig — `skyseed-beet-tracker/index.html` im Browser öffnen genügt.

Zwei Einschränkungen bei `file://`: Service Worker und PWA-Installation funktionieren nicht
(beides verlangt http/https), und die QR-Codes werden ausgeblendet, weil eine lokale Datei-URL
als QR-Code nutzlos wäre. Wer das mittesten will, braucht einen lokalen Webserver, z. B.:

```bash
npx serve skyseed-beet-tracker
```

## Deployment auf Netlify

Beim Verbinden dieses Repos in Netlify:

| Einstellung | Wert |
|---|---|
| Base directory | *(leer)* |
| Build command | *(leer — es gibt keinen Build)* |
| Publish directory | `skyseed-beet-tracker` |

> [!IMPORTANT]
> Für `service-worker.js` sollte Netlify `Cache-Control: no-cache` senden. Ohne das kann ein
> Browser den Service Worker selbst aus dem Cache bedienen und neue Versionen erreichen
> installierte Geräte nie. Aktuell ist das **nicht** konfiguriert.

## Backend einrichten

Vollständige Schritt-für-Schritt-Anleitung steht im Kopfkommentar von
[`apps-script.gs`](apps-script.gs). Kurzfassung:

1. Google Sheet anlegen → **Erweiterungen → Apps Script**
2. Inhalt von `apps-script.gs` einfügen und speichern
3. **Bereitstellen → Neue Bereitstellung** → Typ *Web-App*, Ausführen als *Ich*,
   Zugriff *Jeder*
4. Die erzeugte URL in `skyseed-beet-tracker/index.html` bei `const API_URL = …` einsetzen
5. Für wöchentliche Backups einen Zeit-Trigger auf `weeklyBackup` einrichten (Sonntag, 3–4 Uhr).
   Backups bleiben 8 Wochen erhalten, ältere werden automatisch entfernt.

### Spalten im Google Sheet

`Raster-ID` · `Baumart` · `Benutzer` · `Postennummer` · `Datum` · `Kommentar` · `Updated`

Die Reihenfolge ist bindend — `doGet` liest die Spalten positionsbasiert. Wird im Sheet eine
Spalte eingefügt oder verschoben, liest die App die Felder falsch aus, ohne einen Fehler zu
melden.

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
