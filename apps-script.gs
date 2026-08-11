/**
 * Beet-Tracker Backend — Google Apps Script v3 (mit Foto-Funktion)
 * ================================================================
 *
 * WICHTIG: Dieses Script gehört in das Sheet "Skyseed Beet-Tracker".
 * NICHT verwechseln mit dem KFK-Tracker-Apps-Script (anderes Sheet).
 *
 * Dies ist der tatsächlich produktiv laufende Backend-Code (verifiziert
 * über einen direkten Netlify-Deploy-Export), ergänzt um eine Schreibsperre
 * (LockService, siehe unten) gegen gleichzeitige Konflikt-Schreibvorgänge —
 * die einzige Abweichung vom Original.
 *
 * NEU in v3:
 * - Foto-Upload pro Feld (action: 'uploadFoto')
 * - Foto-Löschen (action: 'deleteFoto')
 * - Spalte "Fotos" im Sheet (JSON-Array mit fileId/datum/url), NACH "Updated"
 * - Automatischer Drive-Folder "Skyseed Beet-Tracker Fotos" mit Subordnern Beet 1/Beet 2
 * - Beim Löschen eines Feldes werden alle zugehörigen Drive-Fotos mit gelöscht
 *
 * Installation (Erstdeployment):
 * 1. Google Sheet "Skyseed Beet-Tracker" anlegen (oder bestehendes öffnen)
 * 2. Erweiterungen → Apps Script
 * 3. Code.gs löschen, diesen Code komplett einfügen, speichern (Strg+S)
 * 4. "Bereitstellen" → "Neue Bereitstellung"
 *    - Typ: Web-App
 *    - Beschreibung: "Beet-Tracker v3 (Foto)"
 *    - Ausführen als: Ich
 *    - Zugriff: Jeder
 *    - Bereitstellen → URL kopieren
 * 5. URL in skyseed-beet-tracker/index.html oben im <script>-Block
 *    bei `const API_URL = ...` einsetzen
 *
 * Update von v2 auf v3 (wenn Apps Script schon deployed):
 * - Code komplett ersetzen, speichern
 * - "Bereitstellen" → "Bereitstellungen verwalten"
 * - Stiftsymbol → Version "Neue Version" → Bereitstellen
 * - URL bleibt gleich
 * - Beim ersten Aufruf wird die "Fotos"-Spalte automatisch zu beiden Sheets ergänzt (Migration)
 *
 * Backups (einmalig einrichten):
 * - Symbol "Trigger" (Uhr) in der linken Leiste
 * - Trigger hinzufügen
 * - Funktion: weeklyBackup
 * - Ereignisquelle: Zeitgesteuert · Wochentimer · Sonntag · 03:00–04:00
 * - WICHTIG: Backups werden bewusst NIE automatisch gelöscht (keine Pruning-
 *   Funktion). Das Backup speichert sowohl Sheet-Daten als auch Foto-
 *   Referenzen. Die Foto-Dateien selbst bleiben im Drive-Folder dauerhaft
 *   erhalten.
 *
 * Beim ersten Aufruf der Funktion fragt Google nach erweiterten Berechtigungen
 * (Drive-Zugriff für Foto-Upload). Einmal bestätigen, danach läuft alles automatisch.
 */

const BEET_SHEETS = { '1': 'Beet 1', '2': 'Beet 2' };
const HEADER = ['Raster-ID', 'Baumart', 'Postennummer', 'Datum', 'Kommentar', 'Updated', 'Fotos'];
const BACKUP_PREFIX = 'Backup_';
const FOTO_ROOT_FOLDER = 'Skyseed Beet-Tracker Fotos';

/* ============ GET: Einträge eines Beets liefern ============ */
function doGet(e) {
  try {
    const beet = (e && e.parameter && e.parameter.beet) || '1';
    const sheetName = BEET_SHEETS[beet];
    if (!sheetName) return json({ error: 'invalid beet: ' + beet });

    const sheet = getOrCreateSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const entries = {};
    for (let i = 1; i < data.length; i++) {
      const [id, baumart, posten, datum, kommentar, updated, fotosJson] = data[i];
      if (!id) continue;
      entries[String(id)] = {
        baumart: String(baumart || ''),
        posten: String(posten || ''),
        datum: formatDate(datum),
        kommentar: String(kommentar || ''),
        updated: formatISO(updated),
        fotos: parseFotos(fotosJson)
      };
    }
    return json({ beet, entries });
  } catch (err) {
    return json({ error: String(err) + '\n' + (err.stack || '') });
  }
}

/* ============ POST: Aktionen ausführen ============ */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'upsert';

    // Foto-Aktionen greifen nicht auf das Sheet zu (ausser deleteEntry, das
    // Fotos mitraeumt) — kein Schreib-Lock nötig, damit ein langsamer Upload
    // keine parallelen Sheet-Schreibvorgänge blockiert.
    switch (action) {
      case 'uploadFoto': return json(uploadFoto(body));
      case 'deleteFoto': return json(deleteFoto(body));
      case 'upsert':     return json(withSheetLock(() => upsertEntry(body)));
      case 'delete':     return json(withSheetLock(() => deleteEntry(body)));
      default:           return json({ error: 'unknown POST action: ' + action });
    }
  } catch (err) {
    return json({ error: String(err) + '\n' + (err.stack || '') });
  }
}

// Serialisiert Sheet-Schreibvorgänge. Ohne Sperre koennen zwei gleichzeitige
// Eintraege dieselbe Raster-ID doppelt anlegen oder sich gegenseitig
// ueberschreiben: beide lesen den Bestand, finden die Zeile nicht und
// haengen je eine neue an. Im Feld tippen mehrere Leute parallel — das
// passiert real. (Ergänzung gegenüber dem beobachteten Original.)
function withSheetLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { error: 'Server gerade beschäftigt — bitte erneut speichern' };
  }
  try {
    const result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

/* ============ Eintrag-Operationen ============ */
function upsertEntry(body) {
  const beet = String(body.beet || '1');
  const sheetName = BEET_SHEETS[beet];
  if (!sheetName) return { error: 'invalid beet: ' + beet };
  const sheet = getOrCreateSheet(sheetName);

  const now = new Date();
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) { rowIndex = i + 1; break; }
  }

  // Wenn body.fotos undefined: existierende Foto-Liste behalten (z.B. wenn nur Baumart geändert wird)
  // Wenn body.fotos ein Array: dieses Array übernehmen (auch leeres Array = alle Fotos abräumen)
  let fotosJson;
  if (body.fotos !== undefined) {
    fotosJson = JSON.stringify(body.fotos);
  } else if (rowIndex > 0) {
    fotosJson = String(data[rowIndex - 1][6] || '[]');
  } else {
    fotosJson = '[]';
  }

  const row = [
    String(body.id || ''),
    String(body.baumart || ''),
    String(body.posten || ''),
    body.datum || '',
    String(body.kommentar || ''),
    now,
    fotosJson
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, HEADER.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true, action: 'upsert', id: body.id, updated: formatISO(now) };
}

function deleteEntry(body) {
  const beet = String(body.beet || '1');
  const sheetName = BEET_SHEETS[beet];
  if (!sheetName) return { error: 'invalid beet: ' + beet };
  const sheet = getOrCreateSheet(sheetName);

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) {
      // Vor Löschen: Fotos im Drive ebenfalls löschen
      const fotos = parseFotos(data[i][6]);
      fotos.forEach(f => {
        try { DriveApp.getFileById(f.fileId).setTrashed(true); }
        catch (e) { /* schon gelöscht oder nicht zugreifbar — ignorieren */ }
      });
      sheet.deleteRow(i + 1);
      return { ok: true, action: 'delete', id: body.id, deletedFotos: fotos.length };
    }
  }
  return { ok: true, action: 'delete', id: body.id, note: 'not found' };
}

/* ============ Foto-Operationen ============ */
function uploadFoto(body) {
  const beet = String(body.beet || '1');
  if (!BEET_SHEETS[beet]) return { error: 'invalid beet: ' + beet };
  if (!body.id) return { error: 'missing id' };
  if (!body.fileBase64) return { error: 'missing fileBase64' };

  const mimeType = body.mimeType || 'image/jpeg';
  const datum = body.datum || Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');

  // Filename: A1_2026-04-29_153022.jpg
  const ts = Utilities.formatDate(new Date(), 'Europe/Berlin', 'HHmmss');
  const ext = pickExtension(mimeType);
  const filename = body.id + '_' + datum + '_' + ts + ext;

  // Decode + Blob (Name MUSS beim Erstellen gesetzt werden,
  // sonst wirft DriveApp "Blob object must have non-null name")
  const decoded = Utilities.base64Decode(body.fileBase64);
  const blob = Utilities.newBlob(decoded, mimeType, filename);

  // In Drive-Folder ablegen
  const folder = getOrCreateFotoFolder(beet);
  const file = folder.createFile(blob);

  // Sharing: anyone with link can view (sonst kein Embed möglich)
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Sharing failed (Workspace-Restriction?): ' + e);
    // Falls die Domain Anyone-with-Link blockiert: File trotzdem nutzbar, nur Embed evtl. eingeschränkt.
  }

  const fileId = file.getId();
  return {
    ok: true,
    fileId: fileId,
    url: 'https://drive.google.com/file/d/' + fileId + '/view',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400',
    datum: datum,
    filename: filename
  };
}

function deleteFoto(body) {
  if (!body.fileId) return { error: 'missing fileId' };
  try {
    DriveApp.getFileById(body.fileId).setTrashed(true);
    return { ok: true, fileId: body.fileId };
  } catch (e) {
    return { ok: true, fileId: body.fileId, note: 'file not found or already deleted' };
  }
}

/* ============ Drive-Folder-Verwaltung ============ */
function getOrCreateFotoFolder(beet) {
  const beetName = 'Beet ' + beet;

  // Root-Folder
  let root;
  const rootIter = DriveApp.getFoldersByName(FOTO_ROOT_FOLDER);
  if (rootIter.hasNext()) {
    root = rootIter.next();
  } else {
    root = DriveApp.createFolder(FOTO_ROOT_FOLDER);
  }

  // Beet-Subfolder
  const beetIter = root.getFoldersByName(beetName);
  if (beetIter.hasNext()) {
    return beetIter.next();
  }
  return root.createFolder(beetName);
}

function pickExtension(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('heic') || m.includes('heif')) return '.heic';
  return '.jpg';
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
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setFontWeight('bold')
      .setBackground('#ebe5d3');
    sheet.setFrozenRows(1);
    return sheet;
  }
  // Migration: prüfen ob "Fotos"-Spalte existiert (v2 → v3 upgrade)
  const lastCol = sheet.getLastColumn();
  if (lastCol < HEADER.length) {
    sheet.getRange(1, HEADER.length).setValue('Fotos').setFontWeight('bold').setBackground('#ebe5d3');
    Logger.log('Migration: "Fotos"-Spalte zu Sheet "' + name + '" ergänzt');
  }
  return sheet;
}

function parseFotos(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
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
    const existing = ss.getSheetByName(backupName);
    if (existing) ss.deleteSheet(existing);
    backup.setName(backupName);
  });

  Logger.log('Backup erstellt: ' + stamp);
  // KEIN Auto-Pruning. Foto-Files im Drive bleiben unabhängig erhalten.
}

function manualBackupNow() {
  weeklyBackup();
}

/* ============ Hilfsfunktion: Drive-Folder-Link ausgeben ============ */
function showFotoFolderLink() {
  const rootIter = DriveApp.getFoldersByName(FOTO_ROOT_FOLDER);
  if (!rootIter.hasNext()) {
    Logger.log('Folder "' + FOTO_ROOT_FOLDER + '" existiert noch nicht.');
    Logger.log('Wird beim ersten erfolgreichen Foto-Upload (oder Selbsttest) automatisch erstellt.');
    return;
  }
  const root = rootIter.next();
  Logger.log('Root-Folder: ' + root.getName());
  Logger.log('URL: ' + root.getUrl());
  const subs = root.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    Logger.log('  - ' + sub.getName() + ' → ' + sub.getUrl());
    const files = sub.getFiles();
    let count = 0;
    while (files.hasNext()) { files.next(); count++; }
    Logger.log('    (' + count + ' Foto(s))');
  }
}

/* ============ Selbsttest (manuell aus Editor ausführen) ============ */
function selfTest() {
  // Ein kompletter Round-Trip: upsert, get, uploadFoto (1px gif), deleteFoto, delete
  const TEST_ID = 'TEST';

  const upsertE = { postData: { contents: JSON.stringify({
    beet: '1', action: 'upsert', id: TEST_ID, baumart: 'TestArt',
    posten: '000', datum: '2026-01-01', kommentar: 'Selbsttest', fotos: []
  })}};
  Logger.log('1. Upsert: ' + doPost(upsertE).getContent());

  // 1×1 transparentes PNG als Base64
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
  const uploadE = { postData: { contents: JSON.stringify({
    beet: '1', action: 'uploadFoto', id: TEST_ID, datum: '2026-01-01',
    fileBase64: tinyPng, mimeType: 'image/png'
  })}};
  const uploadResult = JSON.parse(doPost(uploadE).getContent());
  Logger.log('2. UploadFoto: ' + JSON.stringify(uploadResult));

  Logger.log('3. Get: ' + doGet({ parameter: { beet: '1' }}).getContent().substring(0, 300) + '…');

  if (uploadResult.fileId) {
    const delFotoE = { postData: { contents: JSON.stringify({
      action: 'deleteFoto', fileId: uploadResult.fileId
    })}};
    Logger.log('4. DeleteFoto: ' + doPost(delFotoE).getContent());
  }

  const delEntryE = { postData: { contents: JSON.stringify({
    beet: '1', action: 'delete', id: TEST_ID
  })}};
  Logger.log('5. DeleteEntry: ' + doPost(delEntryE).getContent());

  Logger.log('=== Selbsttest abgeschlossen ===');
}
