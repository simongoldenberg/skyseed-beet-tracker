# Sicherung des Netlify-Livestands

`index.html` in diesem Verzeichnis ist der Stand, der am **2026-08-11** unter
https://skyseed-beet.netlify.app/ ausgeliefert wurde, unverändert von dort heruntergeladen.

**Warum das hier liegt:** Für diese Version gab es keinen Quellcode — sie existierte
ausschließlich als Deployment auf Netlifys CDN. Ein verlorenes oder überschriebenes Deployment
hätte sie ersatzlos gelöscht. Sie ist hier gesichert, bis die beiden Entwicklungslinien
zusammengeführt sind.

**Das ist kein aktiver Teil der App.** Netlify liefert `skyseed-beet-tracker/` aus, nicht dieses
Verzeichnis. Hier wird nicht weiterentwickelt.

## Was diese Version anders macht

Sie ist keine veraltete Kopie des Repo-Stands, sondern eine eigene Linie:

- **Foto-Erfassung je Feld** — Kameraaufnahme (`capture="environment"`), Upload nach Google
  Drive, Datum je Foto, Vorschaubilder, Zähler-Punkt auf belegten Rasterfeldern
- **Anderes Backend** — abweichende `API_URL`, also eine andere Apps-Script-Bereitstellung
- **Kein Feld „Benutzer"**, keine eigenen Baumarten, keine Kürzel-Anzeige in den Zellen
- **Bindet `manifest.json`, `service-worker.js` und Icons ein, die auf Netlify nicht deployt
  sind** (404). Die Live-App ist deshalb nicht installierbar und hat keinen Offline-Modus.

Der vollständige Vergleich steht unter „Known Issues" im [CHANGELOG.md](../CHANGELOG.md).

## Vor dem nächsten Deployment zu klären

1. Welche Features sollen in die zusammengeführte Version? (Fotos **und** Benutzer/Kürzel/eigene
   Baumarten sind nicht in Konflikt — beides ist kombinierbar.)
2. Welches Apps-Script-Backend und welches Google Sheet gelten künftig?
3. Welches Spaltenlayout hat das Sheet? `doGet` liest positionsbasiert; das aktuell im Repo
   hinterlegte Layout passt nicht zu allen Zeilen im Sheet.
