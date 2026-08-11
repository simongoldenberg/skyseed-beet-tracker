/**
 * Beet-Tracker Backend — Google Apps Script
 * ==========================================
 *
 * Referenz-Implementierung, abgestimmt auf den Vertrag, den
 * skyseed-beet-tracker/index.html an die API stellt (Aktionen upsert /
 * delete / uploadFoto / deleteFoto). Läuft bereits ein Apps-Script-Deployment
 * hinter der in index.html hinterlegten API_URL, dieses hier NICHT blind
 * drüberkopieren — vorher im Apps-Script-Editor des zugehörigen Google
 * Sheets vergleichen, sonst drohen Datenverlust oder ein anderes Spalten-
 * layout im Sheet.
 *
 * Installation (neues Sheet / neue Instanz):
 * 1. Google Sheet anlegen ("Skyseed Beet-Tracker")
 * 2. Erweiterungen → Apps Script
 * 3. Code.gs löschen, diesen Code komplett einfügen, speichern (Strg+S)
 * 4. "Bereitstellen" (oben rechts) → "Neue Bereitstellung"
 *    - Typ: Web-App
 *    - Ausführen als: Ich (eigene E-Mail)
 *    - Zugriff: Jeder (KEINE Anmeldung nötig)
 *    - Bereitstellen → URL kopieren
 * 5. URL in skyseed-beet-tracker/index.html oben im <script>-Block
 *    bei `const API_URL = ...` einsetzen
 * 6. Beim ersten Foto-Upload fragt Google nach Drive-Zugriff (für die
 *    Fotoablage) — das ist die "Ausführen als"-Berechtigung des Deployment-
 *    Besitzers, nicht der einzelnen Nutzer:innen. Einmal bestätigen.
 * 7. Für Backups: Symbol "Trigger" (Uhr) in der linken Leiste
 *    - Trigger hinzufügen
 *    - Funktion: weeklyBackup
 *    - Ereignisquelle: Zeitgesteuert
 *    - Zeitgesteuerter Trigger-Typ: Wochentimer
 *    - Wochentag: Sonntag
 *    - Uhrzeit: 03:00–04:00
 *    - Speichern
 */

const BEET_SHEETS = { '1': 'Beet 1', '2': 'Beet 2' };
const HEADER = ['Raster-ID', 'Baumart', 'Postennummer', 'Datum', 'Kommentar', 'Fotos', 'Updated'];
const PHOTO_FOLDER_NAME = 'Skyseed Beet-Tracker Fotos';
const BACKUP_PREFIX = 'Backup_';
const BACKUP_WEEKS_TO_KEEP = 8;

/* ============ GET: Einträge eines Beets liefern ============ */
function doGet(e) {
  try {
    const beet = (e && e.parameter && e.parameter.beet) || '1';
    const sheetName = BEET_SHEETS[beet];
    if (!sheetName) return json({ error: 'invalid beet' });

    const sheet = getOrCreateSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const entries = {};
    for (let i = 1; i < data.length; i++) {
      const [id, baumart, posten, datum, kommentar, fotosRaw, updated] = data[i];
      if (!id) continue;
      entries[String(id)] = {
        baumart: String(baumart || ''),
        posten: String(posten || ''),
        datum: formatDate(datum),
        kommentar: String(kommentar || ''),
        fotos: parseFotos(fotosRaw),
        updated: formatISO(updated)
      };
    }
    return json({ beet, entries });
  } catch (err) {
    return json({ error: String(err) });
  }
}

/* ============ POST: Einträge anlegen/updaten/löschen, Fotos hoch-/runterladen ============ */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Foto-Aktionen greifen nicht auf das Sheet zu — kein Schreib-Lock nötig,
    // damit ein langsamer Upload keine parallelen Sheet-Schreibvorgänge blockiert.
    if (body.action === 'uploadFoto') return handleUploadFoto(body);
    if (body.action === 'deleteFoto') return handleDeleteFoto(body);

    const beet = String(body.beet || '1');
    const sheetName = BEET_SHEETS[beet];
    if (!sheetName) return json({ error: 'invalid beet' });

    // Schreibzugriffe auf das Sheet werden serialisiert. Ohne Sperre koennen
    // zwei gleichzeitige Eintraege dieselbe Raster-ID doppelt anlegen oder
    // sich gegenseitig ueberschreiben: beide lesen den Bestand, finden die
    // Zeile nicht und haengen je eine neue an. Im Feld tippen mehrere Leute
    // parallel — das passiert real.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      return json({ error: 'Server gerade beschäftigt — bitte erneut speichern' });
    }
    try {
      const sheet = getOrCreateSheet(sheetName);

      if (body.action === 'delete') {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(body.id)) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
        SpreadsheetApp.flush();
        return json({ ok: true, action: 'delete', id: body.id });
      }

      // upsert (default)
      const now = new Date();
      const row = [
        String(body.id || ''),
        String(body.baumart || ''),
        String(body.posten || ''),
        body.datum || '',
        String(body.kommentar || ''),
        JSON.stringify(body.fotos || []),
        now
      ];

      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.id)) { rowIndex = i + 1; break; }
      }
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, HEADER.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
      // Schreiben erzwingen, bevor die Sperre faellt — sonst kann der
      // naechste Request noch den alten Bestand lesen.
      SpreadsheetApp.flush();
      return json({ ok: true, action: 'upsert', id: body.id, updated: formatISO(now) });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ error: String(err) });
  }
}

/* ============ Fotos: Ablage in Google Drive ============ */
function handleUploadFoto(body) {
  try {
    const folder = getOrCreatePhotoFolder();
    const bytes = Utilities.base64Decode(body.fileBase64);
    const mimeType = body.mimeType || 'image/jpeg';
    const filename = 'Beet' + '_' + (body.id || 'feld') + '_' + Date.now();
    const blob = Utilities.newBlob(bytes, mimeType, filename);
    const file = folder.createFile(blob);
    // Ohne oeffentlichen Link-Zugriff kann der <img>-Tag im Browser das
    // Thumbnail nicht ohne Google-Anmeldung laden.
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    return json({
      ok: true,
      fileId: fileId,
      url: 'https://drive.google.com/file/d/' + fileId + '/view',
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400',
      datum: body.datum || ''
    });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function handleDeleteFoto(body) {
  try {
    if (body.fileId) {
      DriveApp.getFileById(body.fileId).setTrashed(true);
    }
    return json({ ok: true, action: 'deleteFoto', fileId: body.fileId });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function getOrCreatePhotoFolder() {
  const existing = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (existing.hasNext()) return existing.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function parseFotos(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/* ============ Helpers ============ */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setFontWeight('bold')
      .setBackground('#ebe5d3');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setFontWeight('bold')
      .setBackground('#ebe5d3');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, 'Europe/Berlin', 'yyyy-MM-dd');
  return String(d);
}

function formatISO(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, 'Europe/Berlin', "yyyy-MM-dd'T'HH:mm:ss");
  return String(d);
}

/* ============ Backup-Funktion (Trigger wöchentlich) ============ */
function weeklyBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stamp = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');

  Object.values(BEET_SHEETS).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const backup = sheet.copyTo(ss);
    const backupName = BACKUP_PREFIX + name + '_' + stamp;
    // alten gleichnamigen Backup-Tab entfernen (idempotent bei manuellem Test)
    const existing = ss.getSheetByName(backupName);
    if (existing) ss.deleteSheet(existing);
    backup.setName(backupName);
  });

  pruneOldBackups();
  Logger.log('Backup erstellt: ' + stamp);
}

function pruneOldBackups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BACKUP_WEEKS_TO_KEEP * 7);

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    const match = name.match(/^Backup_.+_(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      if (date < cutoff) {
        Logger.log('Pruning ' + name);
        ss.deleteSheet(sheet);
      }
    }
  });
}

/* ============ Manuell aufrufbar zum Testen ============ */
function manualBackupNow() {
  weeklyBackup();
}
