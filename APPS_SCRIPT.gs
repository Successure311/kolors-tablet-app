/* Kolors — Google Sheet Web App
 *
 * PASTE THIS INTO: your spreadsheet > Extensions > Apps Script, replacing
 * everything in Code.gs, then Deploy > Manage deployments > (pencil icon) >
 * Version: New version > Deploy.
 *
 * IMPORTANT: use "Manage deployments" and edit the EXISTING deployment, not
 * "New deployment" — that keeps the same URL, so nothing else has to change.
 *
 * What changed from the first version: added "delete" and "clear" actions, so
 * the mobile app can delete parts/employees and reset entries like the desktop
 * dashboard does. Existing behaviour (read + upsert) is unchanged, so the
 * desktop dashboard keeps working exactly as before.
 *
 * What changed since then: added a "batch" action — many {sheet, row,
 * key_column} upserts in ONE call. Pushing hundreds of rows one at a time was
 * slow because each call re-reads/re-writes the whole tab; batch reads each
 * tab once, applies every upsert in memory, then writes it back once. Used
 * only by the dashboard's bulk backfill script — everything else (single
 * upsert/delete/clear, and the tablet app) is unchanged.
 *
 * What changed since then: every write now calls SpreadsheetApp.flush()
 * before returning. Without it, a write could still be pending when a
 * request right after (e.g. the tablet app re-reading a row it just saved,
 * such as Restart re-fetching Operations) ran — so the change wouldn't show
 * up yet even though the save itself had already succeeded.
 *
 * What changed since then: upsert and batch now ADD a new column instead of
 * silently dropping any field that isn't already a header on an EXISTING
 * tab (a brand-new tab already got this — its very first row became the
 * header — this only affects tabs that already had data). Purely additive:
 * existing columns, rows, and their values are never touched or cleared,
 * new columns just start blank on rows that predate them.
 *
 * What changed since then: added a "cleanup" action — a one-time,
 * DESTRUCTIVE opposite of the additive behaviour above. It deletes any
 * sheet tab whose name isn't in SCHEMA below, and on every tab that IS
 * kept, deletes any column whose header isn't in that tab's list (which
 * deletes that column's data for every row). Used only when the app's
 * fields change and old tabs/columns are left behind as stale leftovers —
 * everything else (read/upsert/delete/clear/batch) is unaffected.
 *
 * What changed since then: doGet now also accepts ?sheets=A,B,C (plural,
 * comma-separated) to read several tabs in ONE script execution instead of
 * one execution per tab. The tablet app's startup load reads 7 tabs; fired
 * as 7 separate requests they don't run truly concurrently server-side and
 * could queue up past a mobile device's timeout. The old single-tab
 * ?sheet=X form still works unchanged for every other caller.
 *
 * What changed since then: the default upsert (not batch) got faster on a
 * tab that's grown large, like Operations after weeks of entries. It used
 * to call getDataRange() (every column of every row) just to find one row
 * by key — now: (1) a new "insert_only" flag skips that scan completely
 * when the caller already knows the key is brand new (Start/Send-out
 * always generate a fresh Id, so they can never already be in the sheet),
 * and (2) when a scan IS needed (Stop/Restart/Return updating an existing
 * row), it reads only the key column instead of every column. Same
 * behaviour and return value either way, just less read/write work.
 *
 * What changed since then: added "start_operation"/"start_outsource"
 * actions. Two tablets tapping Start on the same part in the same instant
 * used to be checked only against each device's own local cache (see
 * openOperationFor in sheet.js), so both could win and create two open rows
 * for the same part. These actions wrap the check-and-append in
 * LockService.getScriptLock(), so only one caller can ever win a race — the
 * loser gets back {ok:false, conflict:{...}} with nothing written, instead
 * of a second row silently existing. The old insert_only path is unchanged
 * and still used by everything that doesn't have this race (Parts/Tools/etc.
 * bulk creation).
 *
 * What changed since then: added Project Schedule (Plan) support — Tools
 * gained TypeOfProject/ProjectStartDate/NextScheduleSeq/ScheduleRangeStart/
 * ScheduleRangeEnd columns. The tablet app now reads/writes the SAME
 * "Schedule" tab the dashboard already mirrors to (one row per activity, one
 * dynamically-added column per Plan date holding "P") instead of a separate
 * tab, so a Plan checked in either app shows up in both.
 *
 * What changed since then: fixed a real corruption bug in that "Schedule"
 * tab. A date-named header cell (e.g. "09-11-2026") can get silently
 * auto-converted by Sheets from plain text into a real Date value — after
 * that, every header-comparison below (indexOf against a plain string) stops
 * matching it, so (a) reads turned that header into a garbled key via
 * Date.toString() when used as a JS object property name, and (b) writes
 * treated it as a brand-new column every time, endlessly duplicating it and
 * eventually confusing the row-matching enough to duplicate whole rows.
 * Fixed two ways: headerKey() below normalises any Date-typed header cell
 * back to the same "dd-MM-yyyy" text everywhere a header is read OR compared
 * against, and any newly-created date-shaped column is explicitly set to
 * Plain Text number format so Sheets can't re-convert it going forward. A
 * one-time "repair_schedule" action (see doPost) cleans up damage already
 * done: it merges the resulting duplicate rows/columns and removes the
 * unrelated PlannedStart/PlannedEnd columns and a stray header-as-data row
 * left over from an earlier version of the schedule feature.
 *
 * What changed since then: added two read-only/targeted admin actions for
 * spring-cleaning stray tabs safely. doGet(?list_sheets=1) reports every
 * tab's name, row/column counts and headers, and whether "cleanup"'s SCHEMA
 * recognises it — read-only, changes nothing. doPost {action:
 * "delete_sheets", names:[...]} deletes only the exact tabs named (e.g. the
 * now-unused "ScheduleMarks"/"ScheduleActivities" tabs left over from
 * before the Schedule-tab-sharing change above) — unlike "cleanup", it
 * never touches columns on any other tab, so it's safe to run without
 * re-auditing the whole schema first.
 *
 * What changed since then: fixed the same "Sheets auto-converts a
 * date-shaped value into a real Date" corruption already handled for
 * Schedule's per-day HEADER columns above, this time on three Tools DATA
 * columns: ProjectStartDate, ScheduleRangeStart, ScheduleRangeEnd. Each is
 * only ever written as a plain "yyyy-MM-dd" from an <input type="date">, but
 * once Sheets silently turns that into a Date cell, JSON.stringify(Date)
 * emits a full UTC datetime like "2026-09-03T18:30:00.000Z" — which then
 * fails to populate an <input type="date"> at all, so re-selecting a die
 * silently fell back to today's date instead of its actual saved Plan
 * range, and the read-only project header showed that raw ISO string
 * instead of a clean date. Fixed the same two ways as before: DATE_ONLY_
 * FIELDS + dateOnlyValue() normalise these three fields back to
 * "yyyy-MM-dd" on every read, and forceTextFormatIfDate() now also locks
 * them to Plain Text format on every write so Sheets can't re-convert them.
 * A one-time "repair_tools_dates" action (dry-run by default, same pattern
 * as "repair_schedule") fixes cells already corrupted this way.
 *
 * What changed since then (speed + safety pass, all backward compatible —
 * the desktop dashboard's existing calls behave exactly as before):
 *  (1) doPost now takes the script lock for EVERY write, so two devices
 *      saving at the same moment can no longer overwrite each other (batch
 *      used to read the whole tab, edit in memory and write it all back with
 *      no lock at all). If the lock can't be had in 20 s it answers
 *      {error, retryable:true} and the tablet just retries.
 *  (2) start_operation/start_outsource accept an optional "history" row that
 *      is appended to OperationHistory in the SAME execution, and a new
 *      "op_update" action does the same for Stop/Restart (update the
 *      Operations row by key + append history). One request per tap instead
 *      of two sequential ones. A Start retried after a lost response is
 *      recognised by its Id and answered ok instead of as a conflict.
 *  (3) every write bumps a version counter (ScriptProperties "ver"). doGet
 *      with ?sheets=A,B&since=N answers {v, unchanged:true} when nothing
 *      changed, else {v, data:{A:rows,B:rows}} — so tablets can poll cheaply.
 *      Without "since" the old response shape is unchanged. Hand edits made
 *      directly in the Sheet don't bump it; tablets force a full read every
 *      minute to cover that.
 *  (4) batch no longer clearContents()+rewrites the whole tab: it writes only
 *      the rows it actually changed, and only re-applies Plain Text format to
 *      columns that are new instead of to every column on every call.
 */

// Canonical schema used only by the "cleanup" action — every sheet tab the
// app currently writes to, and its exact set of columns. Kept in sync by
// hand with the backend's push_row()/push_batch() calls (see main.py).
var SCHEMA = {
  Admin: ["LoginId", "Password"],
  Workshop: ["LoginId", "Password"],
  Tools: ["ToolId", "Description", "ProductName", "TypeOfProject", "ProjectStartDate", "NextPartSeq", "NextScheduleSeq", "ScheduleRangeStart", "ScheduleRangeEnd", "CreatedAt"],
  Parts: ["PartId", "ToolId", "Seq", "Name", "Material", "RoughSize", "Qty", "DesignReady", "CodeReady", "CreatedAt"],
  Employees: ["Name", "Shift", "Machine", "CreatedAt"],
  CustomStages: ["Name", "CreatedAt"],
  Operations: ["ToolId", "PartId", "DieName", "PartName", "Department", "Operator", "StartDate", "StartTime", "EndDate", "EndTime", "Shift", "Status", "WaitingCount", "Id"],
  OperationHistory: ["ToolId", "PartId", "DieName", "PartName", "Department", "Operator", "Shift", "WaitingCount", "Date", "Time", "OpId", "Event", "CycleNo"],
  OutsourceEntries: ["ToolId", "PartId", "DieName", "PartName", "Process", "Place", "Duration", "StartDate", "StartTime", "EndDate", "EndTime", "Status", "Id"],
  PartStatus: ["ToolId", "PartId", "DieName", "PartName", "Department", "Operator", "StartDate", "StartTime", "EndDate", "EndTime", "Shift", "Status", "WaitingCount", "PartDept"],
  ChildParts: ["ToolId", "DieName", "ChildName", "Qty", "ChildId"],
  // Schedule's fixed identity columns — its Plan-date columns (one per day,
  // named "dd-MM-yyyy") are dynamic and deliberately NOT listed here; the
  // "cleanup" action below special-cases this tab so it never trims them.
  Schedule: ["Id", "ToolId", "DieName", "Activity", "IsCustom"]
};

var DATE_HEADER_RE = /^\d{2}-\d{2}-\d{4}$/;

// Field names (any tab) that only ever hold a plain "yyyy-MM-dd" value from
// an <input type="date">, never a date+time. Same auto-conversion problem
// as DATE_HEADER_RE below, but on a DATA cell instead of a header cell: type
// "2026-09-04" into one of these columns and Sheets can silently store it as
// a real Date instead of text. Left alone, JSON.stringify(Date) — used by
// json() below — turns that into a full UTC datetime string like
// "2026-09-03T18:30:00.000Z" (IST midnight the next day, shifted a day
// earlier by the UTC conversion), which then fails to populate an
// <input type="date"> (wrong format) and displays as raw ISO junk anywhere
// shown as text.
var DATE_ONLY_FIELDS = ["ProjectStartDate", "ScheduleRangeStart", "ScheduleRangeEnd"];

// Normalises one header cell to the text form every comparison/lookup below
// expects. A date-shaped header (e.g. "09-11-2026") can get silently
// auto-converted by Sheets from plain text into a real Date value — left
// raw, that breaks indexOf() string comparisons and (via Date.toString())
// produces garbled keys like "Wed Dec 09 2026 00:00:00 GMT+0530 (India
// Standard Time)" wherever the header is used as a JS object property name.
function headerKey(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd-MM-yyyy");
  }
  return v;
}

function headerRow(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(headerKey);
}

// A JSON.stringify(Date) value, e.g. "2026-09-03T18:30:00.000Z" — what a
// corrupted Date cell looks like once it's round-tripped through this
// script's own JSON response and been echoed back in a later write (e.g. a
// client that cached the bad value before a fix landed, then pushed that
// same tool object back unchanged on its next save).
var ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// Normalises one DATE_ONLY_FIELDS data cell the same way headerKey() does
// for header cells — a Date value, OR a literal ISO-datetime STRING (see
// ISO_DATETIME_RE above), becomes plain "yyyy-MM-dd" text; anything else
// (already clean text, or blank) passes through unchanged.
function dateOnlyValue(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  if (typeof v === "string" && ISO_DATETIME_RE.test(v)) {
    return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return v;
}

// Sets a column to Plain Text number format so Sheets can't re-auto-convert
// typed values back into a real Date later — the root cause both headerKey()
// and dateOnlyValue() otherwise have to work around on every read. Covers
// both kinds of corruption: a date-shaped HEADER (Schedule's per-day
// columns) and a known date-only DATA field (see DATE_ONLY_FIELDS above).
function forceTextFormatIfDate(sheet, headerName, colIndex1Based) {
  if (DATE_HEADER_RE.test(headerName) || DATE_ONLY_FIELDS.indexOf(headerName) >= 0) {
    sheet.getRange(1, colIndex1Based, sheet.getMaxRows(), 1).setNumberFormat("@");
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheetRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(headerKey);
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = DATE_ONLY_FIELDS.indexOf(headers[j]) >= 0 ? dateOnlyValue(data[i][j]) : data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function currentVersion() {
  return Number(PropertiesService.getScriptProperties().getProperty("ver")) || 0;
}

function bumpVersion() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("ver", String((Number(props.getProperty("ver")) || 0) + 1));
}

// Appends one row to OperationHistory (always added, never matched by key),
// creating the tab / extending its header additively just like the default
// upsert path does. Used to log an event in the same execution as the
// Operations write it belongs to.
function appendHistoryRow(ss, hist) {
  if (!hist) return;
  var sh = ss.getSheetByName("OperationHistory");
  if (!sh) sh = ss.insertSheet("OperationHistory");
  var headers;
  if (sh.getLastRow() === 0) {
    headers = Object.keys(hist);
    sh.appendRow(headers);
  } else {
    headers = headerRow(sh);
    var newKeys = Object.keys(hist).filter(function (k) { return headers.indexOf(k) < 0; });
    if (newKeys.length) {
      headers = headers.concat(newKeys);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  sh.appendRow(headers.map(function (h) { return hist[h] !== undefined ? hist[h] : ""; }));
}

// Insert or update ONE row of `sheet` (already looked up/created by the
// caller), matched on keyColumn — the "default" upsert, shared by the plain
// upsert action and op_update.
function upsertRow(sheet, row, keyColumn, insertOnly) {
  var headers;
  if (sheet.getLastRow() === 0) {
    headers = Object.keys(row);
    sheet.appendRow(headers);
    headers.forEach(function (h, idx) { forceTextFormatIfDate(sheet, h, idx + 1); });
  } else {
    headers = headerRow(sheet);
    // Additive: a field not already a column gets appended as a new one —
    // only the header row is extended, existing data rows are untouched
    // and just read as blank under the new column until they're written.
    var newKeys = Object.keys(row).filter(function (k) { return headers.indexOf(k) < 0; });
    if (newKeys.length) {
      var startIdx = headers.length;
      headers = headers.concat(newKeys);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      newKeys.forEach(function (h, i) { forceTextFormatIfDate(sheet, h, startIdx + i + 1); });
    }
  }

  var values = headers.map(function (h) {
    return row[h] !== undefined ? row[h] : "";
  });

  if (insertOnly || !keyColumn) {
    sheet.appendRow(values);
    return;
  }

  // Only the key column is read to find the row, not every column of every
  // row — much cheaper than getDataRange() on a wide, tall tab like
  // Operations, and that read/scan is the main cost of a write.
  var keyIdx = headers.indexOf(keyColumn);
  var lastRow = sheet.getLastRow();
  var foundRow = -1;
  if (lastRow > 1) {
    var keyVals = sheet.getRange(2, keyIdx + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keyVals.length; i++) {
      if (String(keyVals[i][0]) === String(row[keyColumn])) {
        foundRow = i + 2;
        break;
      }
    }
  }
  if (foundRow > 0) {
    // Merge onto the existing row instead of replacing it outright — a
    // caller that only sends a few changed fields (e.g. one Plan-mark
    // date) must not blank every other column already recorded there.
    var existingValues = sheet.getRange(foundRow, 1, 1, headers.length).getValues()[0];
    var merged = headers.map(function (h, i) { return row[h] !== undefined ? row[h] : existingValues[i]; });
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([merged]);
  } else {
    sheet.appendRow(values);
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Versioned multi-tab read — ?sheets=A,B&since=N. Cheap "anything new?"
  // poll: if the write counter still equals N nothing was written since, so
  // answer {unchanged:true} without touching a single tab. The version is
  // read BEFORE the data, so a write landing mid-read only makes the next
  // poll refetch — it can never make a tablet miss a change.
  if (e.parameter.sheets && e.parameter.since !== undefined) {
    var ver = currentVersion();
    if (String(e.parameter.since) === String(ver)) return json({ v: ver, unchanged: true });
    var vNames = e.parameter.sheets.split(",");
    var vOut = {};
    for (var vn = 0; vn < vNames.length; vn++) {
      vOut[vNames[vn]] = readSheetRows(ss, vNames[vn]);
    }
    return json({ v: ver, data: vOut });
  }

  // Read-only inventory — ?list_sheets=1 — reports every tab's name, row/
  // column counts and header row, plus whether it's one SCHEMA/"cleanup"
  // knows about. Used to inspect the live spreadsheet before deciding what
  // (if anything) is safe to delete; never modifies anything.
  if (e.parameter.list_sheets) {
    var known = Object.keys(SCHEMA);
    var sheets = ss.getSheets().map(function (sh) {
      var name = sh.getName();
      var rows = sh.getLastRow();
      var cols = sh.getLastColumn();
      return {
        name: name,
        knownToApp: known.indexOf(name) >= 0,
        rows: Math.max(0, rows - 1), // data rows, excluding header
        columns: cols,
        headers: rows > 0 ? headerRow(sh) : [],
      };
    });
    return json({ sheets: sheets });
  }

  // Multiple tabs in one call — ?sheets=Tools,Parts,Employees (comma
  // separated) — used by the tablet app's startup load. Web app requests
  // aren't truly concurrent even when the client fires them in parallel, so
  // reading N tabs used to mean N queued script executions; on a slow mobile
  // connection that was enough to blow past a reasonable timeout. One call
  // that reads every tab in a single execution fixes that.
  if (e.parameter.sheets) {
    var names = e.parameter.sheets.split(",");
    var out = {};
    for (var n = 0; n < names.length; n++) {
      out[names[n]] = readSheetRows(ss, names[n]);
    }
    return json(out);
  }

  return json(readSheetRows(ss, e.parameter.sheet));
}

// Every write goes through one script-wide lock, so read-modify-write actions
// (batch, upsert, delete, ...) from different devices can't interleave and
// silently overwrite each other. Each holds it only briefly.
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json({ error: "Server busy — try again in a moment.", retryable: true });
  }
  try {
    return handlePost(body);
  } finally {
    bumpVersion();
    lock.releaseLock();
  }
}

function handlePost(body) {
  var action = body.action || "upsert";
  var sheetName = body.sheet;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  // ---- delete whole tabs by exact name (body.names: [...]) — narrower and
  // safer than "cleanup" below: only deletes tabs explicitly named, never
  // touches columns on any other tab. Used to remove confirmed-stale tabs
  // (e.g. ScheduleMarks/ScheduleActivities, leftover from an earlier design
  // before the tablet app switched to sharing the dashboard's "Schedule"
  // tab) without any risk to the rest of the spreadsheet. ----
  if (action === "delete_sheets") {
    var names2 = body.names || [];
    var deletedSheets2 = [];
    var skipped2 = [];
    names2.forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (!sh) { skipped2.push(name + " (not found)"); return; }
      if (ss.getSheets().length <= 1) { skipped2.push(name + " (last remaining sheet)"); return; }
      ss.deleteSheet(sh);
      deletedSheets2.push(name);
    });
    SpreadsheetApp.flush();
    return json({ ok: true, deleted: deletedSheets2, skipped: skipped2 });
  }

  // ---- delete every row whose key column matches key_value ----
  if (action === "delete") {
    if (!sheet || sheet.getLastRow() < 2) return json({ ok: true, deleted: 0 });
    var dHeaders = headerRow(sheet);
    var dKeyIdx = dHeaders.indexOf(body.key_column);
    if (dKeyIdx < 0) return json({ error: "Unknown column " + body.key_column });

    var dData = sheet.getDataRange().getValues();
    var deleted = 0;
    // Walk bottom-up so row numbers stay valid as rows are removed.
    for (var d = dData.length - 1; d >= 1; d--) {
      if (String(dData[d][dKeyIdx]) === String(body.key_value)) {
        sheet.deleteRow(d + 1);
        deleted++;
      }
    }
    SpreadsheetApp.flush();
    return json({ ok: true, deleted: deleted });
  }

  // ---- one-time destructive cleanup: delete any tab not in SCHEMA, and on
  // every kept tab, delete any column not in that tab's SCHEMA list ----
  if (action === "cleanup") {
    var keepNames = Object.keys(SCHEMA);
    var deletedSheets = [];
    var trimmedColumns = {};

    ss.getSheets().forEach(function (sh) {
      var name = sh.getName();
      if (keepNames.indexOf(name) < 0) {
        if (ss.getSheets().length > 1) { // a spreadsheet can't have zero sheets
          ss.deleteSheet(sh);
          deletedSheets.push(name);
        }
        return;
      }

      if (sh.getLastRow() === 0) return; // no header row yet, nothing to trim
      // Schedule's Plan-date columns are dynamic (one per day, never listed
      // in SCHEMA) — trimming "unknown" columns there would delete every
      // day's Plan marks. Only Schedule's identity columns are fixed, and
      // this cleanup has nothing useful to trim among those.
      if (name === "Schedule") return;
      var wanted = SCHEMA[name];
      var headers = headerRow(sh);
      var extraCols = []; // 0-based column indexes not in `wanted`
      headers.forEach(function (h, idx) {
        if (wanted.indexOf(h) < 0) extraCols.push(idx);
      });
      if (extraCols.length) {
        // Delete right-to-left so earlier indexes stay valid as columns shift.
        extraCols.sort(function (a, b) { return b - a; }).forEach(function (idx) {
          sh.deleteColumn(idx + 1); // deleteColumn is 1-based
        });
        trimmedColumns[name] = extraCols.length;
      }
    });

    SpreadsheetApp.flush();
    return json({ ok: true, deletedSheets: deletedSheets, trimmedColumns: trimmedColumns });
  }

  // ---- one-time repair for the "Schedule" tab's date-header corruption
  // (see the file header comment above). Defaults to a DRY RUN — reports
  // exactly what it would change without writing anything; only an explicit
  // {dryRun:false} in the request body applies it for real. Fixes, in
  // order: (1) drops the literal PlannedStart/PlannedEnd columns, a
  // leftover from an older design no longer used anywhere; (2) merges any
  // columns whose header normalises to the same date text (one plain text,
  // one a corrupted Date-typed cell) by keeping either non-blank "P"; (3)
  // drops any data row that is actually a stray copy of the header itself
  // (its ToolId cell literally reads "ToolId"); (4) merges rows that share
  // the same Id (created when the corruption above confused the upsert's
  // row-matching), the same non-blank-wins way; (5) re-applies Plain Text
  // format to every surviving date column so this can't recur. ----
  if (action === "repair_schedule") {
    var target = ss.getSheetByName("Schedule");
    if (!target || target.getLastRow() < 2) {
      return json({ ok: true, message: "Schedule tab is empty or missing — nothing to repair." });
    }

    var raw = target.getDataRange().getValues();
    var rawHeaders = raw[0].map(headerKey);
    var dataRows = raw.slice(1);
    var DROP_COLUMNS = ["PlannedStart", "PlannedEnd"];

    // Fold every original column onto the first-seen column with the same
    // (normalised) header text, dropping DROP_COLUMNS entirely.
    var mergedHeaders = [];
    var headerFirstIdx = {};
    var mergeTarget = rawHeaders.map(function (h) {
      if (DROP_COLUMNS.indexOf(h) >= 0) return -1;
      if (Object.prototype.hasOwnProperty.call(headerFirstIdx, h)) return headerFirstIdx[h];
      headerFirstIdx[h] = mergedHeaders.length;
      mergedHeaders.push(h);
      return headerFirstIdx[h];
    });

    var idColIdx = mergedHeaders.indexOf("Id");
    var toolIdColIdx = mergedHeaders.indexOf("ToolId");
    var isBlank = function (v) { return v === "" || v === null || v === undefined; };

    var mergedByKey = {};
    var order = [];
    var droppedGarbageRows = 0;
    var mergedRowGroups = 0;

    dataRows.forEach(function (r) {
      var folded = new Array(mergedHeaders.length).fill("");
      r.forEach(function (cell, origIdx) {
        var t = mergeTarget[origIdx];
        if (t >= 0 && !isBlank(cell)) folded[t] = cell;
      });

      if (toolIdColIdx >= 0 && String(folded[toolIdColIdx]) === "ToolId") {
        droppedGarbageRows++;
        return;
      }

      var key = idColIdx >= 0 ? String(folded[idColIdx]) : ("__row" + order.length);
      if (Object.prototype.hasOwnProperty.call(mergedByKey, key)) {
        var existing = mergedByKey[key];
        folded.forEach(function (v, i) { if (!isBlank(v) && isBlank(existing[i])) existing[i] = v; });
        mergedRowGroups++;
      } else {
        mergedByKey[key] = folded;
        order.push(key);
      }
    });

    var finalRows = order.map(function (k) { return mergedByKey[k]; });
    var droppedCols = DROP_COLUMNS.filter(function (h) { return rawHeaders.indexOf(h) >= 0; });
    var summary = {
      ok: true,
      dryRun: body.dryRun !== false,
      droppedColumns: droppedCols,
      mergedColumnCount: rawHeaders.length - mergedHeaders.length - droppedCols.length,
      droppedGarbageRows: droppedGarbageRows,
      mergedRowGroups: mergedRowGroups,
      columnsBefore: rawHeaders.length,
      columnsAfter: mergedHeaders.length,
      rowsBefore: dataRows.length,
      rowsAfter: finalRows.length,
    };

    if (body.dryRun !== false) return json(summary); // safe by default — preview only

    target.clearContents();
    mergedHeaders.forEach(function (h, idx) { forceTextFormatIfDate(target, h, idx + 1); });
    target.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
    if (finalRows.length) {
      target.getRange(2, 1, finalRows.length, mergedHeaders.length).setValues(finalRows);
    }
    SpreadsheetApp.flush();
    return json(summary);
  }

  // ---- one-time repair for the Tools tab's ProjectStartDate/
  // ScheduleRangeStart/ScheduleRangeEnd corruption (see DATE_ONLY_FIELDS
  // above): Sheets auto-converted these plain "yyyy-MM-dd" values into real
  // Date cells, which then serialised as full UTC datetime strings like
  // "2026-09-03T18:30:00.000Z" — that fails to populate an
  // <input type="date"> at all, so the Schedule screen silently fell back to
  // today's date instead of the die's actual saved plan range. Defaults to a
  // DRY RUN — reports exactly which cells it would fix without writing
  // anything; only an explicit {dryRun:false} applies it for real. ----
  if (action === "repair_tools_dates") {
    var toolsSheet = ss.getSheetByName("Tools");
    if (!toolsSheet || toolsSheet.getLastRow() < 2) {
      return json({ ok: true, message: "Tools tab is empty or missing — nothing to repair." });
    }

    var toolsHeaders = headerRow(toolsSheet);
    var toolsData = toolsSheet.getDataRange().getValues();
    var fixes = []; // {colIdx (0-based), rowIdx (0-based into toolsData), value}
    var fixedByField = {};

    DATE_ONLY_FIELDS.forEach(function (field) {
      var colIdx = toolsHeaders.indexOf(field);
      if (colIdx < 0) return;
      for (var r = 1; r < toolsData.length; r++) {
        var cell = toolsData[r][colIdx];
        var fixed = dateOnlyValue(cell);
        // Catches both corruption forms: a real Date cell, or a literal
        // ISO-datetime STRING (see ISO_DATETIME_RE) — the latter happens
        // when a client cached the bad value before this fix landed and
        // echoed it straight back on its next save. Already-clean values
        // (or blanks) round-trip unchanged, so this is always safe to run.
        if (fixed !== cell) {
          fixes.push({ colIdx: colIdx, rowIdx: r, value: fixed });
          fixedByField[field] = (fixedByField[field] || 0) + 1;
        }
      }
    });

    var toolsSummary = { ok: true, dryRun: body.dryRun !== false, fixedCells: fixes.length, fixedByField: fixedByField };
    if (toolsSummary.dryRun) return json(toolsSummary); // safe by default — preview only

    // Lock every touched column to Plain Text BEFORE writing anything back —
    // writing the plain-text value first and formatting the column after (as
    // an earlier version of this action did) is too late: Sheets can still
    // auto-convert a date-shaped string into a real Date at the moment
    // setValues() runs, while the column format is still "Automatic". Each
    // fixed cell is then written individually with setValue(), not as part
    // of one big multi-row setValues() call, so there's no ambiguity about
    // which format was in effect for which cell at write time.
    toolsHeaders.forEach(function (h, idx) { forceTextFormatIfDate(toolsSheet, h, idx + 1); });
    fixes.forEach(function (f) {
      toolsSheet.getRange(f.rowIdx + 1, f.colIdx + 1).setValue(f.value);
    });
    SpreadsheetApp.flush();
    return json(toolsSummary);
  }

  // ---- remove all data rows, keeping the header row ----
  if (action === "clear") {
    if (!sheet) return json({ ok: true, cleared: 0 });
    var last = sheet.getLastRow();
    if (last > 1) sheet.deleteRows(2, last - 1);
    SpreadsheetApp.flush();
    return json({ ok: true, cleared: Math.max(0, last - 1) });
  }

  // ---- many {sheet, row, key_column} upserts in one execution — reads and
  // writes each tab once instead of once per row, which is what actually
  // makes pushing a lot of rows individually slow ----
  if (action === "batch") {
    var items = body.items || [];
    var cache = {}; // sheet name -> { sheet, headers, data (2D array incl. header row) }

    items.forEach(function (item) {
      var name = item.sheet;
      if (!cache[name]) {
        var sh = ss.getSheetByName(name);
        if (!sh) sh = ss.insertSheet(name);
        var data = sh.getLastRow() > 0 ? sh.getDataRange().getValues() : [];
        if (data.length) data[0] = data[0].map(headerKey);
        cache[name] = {
          sheet: sh, headers: data.length ? data[0] : [], data: data,
          origCols: data.length ? data[0].length : 0, // columns that already existed
          full: false,      // true -> header/column layout changed, rewrite everything
          changed: {},      // data-array index -> true, for rows touched
        };
      }
      var c = cache[name];
      var row = item.row;
      var keyColumn = item.key_column;

      if (c.headers.length === 0) {
        c.headers = Object.keys(row);
        c.data = [c.headers];
        c.full = true;
      } else {
        // Additive: a field not already a column gets appended as a new
        // one, padding every row already queued so the 2D array stays
        // rectangular — never drops a field, never touches existing
        // columns/rows/values otherwise.
        var newKeys = Object.keys(row).filter(function (k) { return c.headers.indexOf(k) < 0; });
        if (newKeys.length) {
          c.headers = c.headers.concat(newKeys);
          c.data = c.data.map(function (r, idx) {
            if (idx === 0) return c.headers;
            var padded = r.slice();
            while (padded.length < c.headers.length) padded.push("");
            return padded;
          });
          c.full = true;
        }
      }
      var values = c.headers.map(function (h) {
        return row[h] !== undefined ? row[h] : "";
      });

      var foundIdx = -1;
      if (keyColumn) {
        var keyIdx = c.headers.indexOf(keyColumn);
        for (var i = 1; i < c.data.length; i++) {
          if (String(c.data[i][keyIdx]) === String(row[keyColumn])) {
            foundIdx = i;
            break;
          }
        }
      }
      if (foundIdx > 0) {
        // Merge onto the existing row instead of replacing it outright — a
        // caller that only sends a few changed fields (e.g. one Plan-mark
        // date) must not blank every other column already recorded there.
        var existingRow = c.data[foundIdx];
        c.data[foundIdx] = c.headers.map(function (h, i) {
          return row[h] !== undefined ? row[h] : existingRow[i];
        });
        c.changed[foundIdx] = true;
      } else {
        c.data.push(values);
        c.changed[c.data.length - 1] = true;
      }
    });

    // Write back ONLY what changed (was: clearContents + rewrite the whole
    // tab, slow on big tabs and the reason batch needed a lock at all).
    Object.keys(cache).forEach(function (name) {
      var c = cache[name];
      if (!c.data.length) return;

      // Only brand-new columns need the Plain Text format applied — the
      // ones that already existed were formatted when they were created.
      for (var hi = c.origCols; hi < c.headers.length; hi++) {
        forceTextFormatIfDate(c.sheet, c.headers[hi], hi + 1);
      }

      if (c.full) {
        c.sheet.getRange(1, 1, c.data.length, c.headers.length).setValues(c.data);
        return;
      }
      var idxs = Object.keys(c.changed).map(Number).sort(function (a, b) { return a - b; });
      if (!idxs.length) return;
      // Group into runs of consecutive rows: one setValues per run.
      var runs = [];
      idxs.forEach(function (ix) {
        var last = runs[runs.length - 1];
        if (last && ix === last.end + 1) last.end = ix;
        else runs.push({ start: ix, end: ix });
      });
      if (runs.length > 15) runs = [{ start: idxs[0], end: idxs[idxs.length - 1] }]; // few big writes beat many tiny ones
      runs.forEach(function (r) {
        c.sheet.getRange(r.start + 1, 1, r.end - r.start + 1, c.headers.length)
          .setValues(c.data.slice(r.start, r.end + 1));
      });
    });

    SpreadsheetApp.flush();
    return json({ ok: true, count: items.length });
  }

  // ---- atomic "start" for Operations/OutsourceEntries — runs under the
  // script-wide lock taken in doPost, so the "is this part already open?"
  // check and the append are one atomic step and two devices racing to start
  // the same part can't both win. Returns {ok:false, conflict:{...the
  // existing open row...}} with nothing written if the part is already open;
  // otherwise appends and returns {ok:true}. An optional body.history row is
  // appended to OperationHistory in this same execution. A retried Start
  // (response lost, tablet resent it) is recognised by its own Id already
  // being in the tab and answered {ok:true} without writing a second row. ----
  if (action === "start_operation" || action === "start_outsource") {
    var startRow = body.row;
    var openStatuses = action === "start_operation" ? ["Working", "Waiting"] : ["OutSource"];
    if (!sheet) sheet = ss.insertSheet(sheetName);
    var sHeaders = sheet.getLastRow() > 0
      ? headerRow(sheet)
      : Object.keys(startRow);
    var pIdx = sHeaders.indexOf("PartId");
    var stIdx = sHeaders.indexOf("Status");
    var idIdx = sHeaders.indexOf("Id");
    if (sheet.getLastRow() > 1 && pIdx >= 0 && stIdx >= 0) {
      var existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sHeaders.length).getValues();
      var conflict = null;
      for (var i = 0; i < existingRows.length; i++) {
        if (idIdx >= 0 && startRow.Id !== undefined &&
            String(existingRows[i][idIdx]) === String(startRow.Id)) {
          return json({ ok: true }); // this exact Start was already saved
        }
        if (!conflict &&
            String(existingRows[i][pIdx]) === String(startRow.PartId) &&
            openStatuses.indexOf(String(existingRows[i][stIdx])) >= 0) {
          conflict = {};
          for (var ci = 0; ci < sHeaders.length; ci++) conflict[sHeaders[ci]] = existingRows[i][ci];
        }
      }
      if (conflict) return json({ ok: false, conflict: conflict });
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sHeaders);
    } else {
      var newCols = Object.keys(startRow).filter(function (k) { return sHeaders.indexOf(k) < 0; });
      if (newCols.length) {
        sHeaders = sHeaders.concat(newCols);
        sheet.getRange(1, 1, 1, sHeaders.length).setValues([sHeaders]);
      }
    }
    var startValues = sHeaders.map(function (h) { return startRow[h] !== undefined ? startRow[h] : ""; });
    sheet.appendRow(startValues);
    appendHistoryRow(ss, body.history);
    SpreadsheetApp.flush();
    return json({ ok: true });
  }

  // ---- Stop / Restart: update the Operations row by key, and log the
  // matching OperationHistory event, in ONE execution (was two requests). ----
  if (action === "op_update") {
    if (!sheet) sheet = ss.insertSheet(sheetName);
    upsertRow(sheet, body.row, body.key_column || "Id", false);
    appendHistoryRow(ss, body.history);
    SpreadsheetApp.flush();
    return json({ ok: true });
  }

  // ---- default: insert or update one row ----
  // insert_only: caller guarantees this key can't already exist (e.g. a
  // freshly generated Id on Start/Send-out) — skips the key scan entirely and
  // just appends, which keeps a write instant even once a tab has grown into
  // thousands of rows; Stop/Restart/Return still need the scan since they
  // must find and update the SAME row Start created.
  if (!sheet) sheet = ss.insertSheet(sheetName);
  upsertRow(sheet, body.row, body.key_column, !!body.insert_only);
  SpreadsheetApp.flush();
  return json({ ok: true });
}
