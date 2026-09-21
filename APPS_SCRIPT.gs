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
 *  (7) Schedule Ids are plain numbers 1, 2, 3 ... (assigned by the script under
 *      the lock, so they can't collide) instead of per-die "T-1789...-abc"
 *      strings. Run tidySchedule() once from the editor to renumber the rows
 *      already in the tab and sort the date columns.
 *  (6) Schedule tab: date columns are kept in calendar order (oldest ->
 *      newest, after the ToolId/DieName/Activity/IsCustom/Id columns). Any
 *      Schedule save fixes an out-of-order tab automatically; to fix it right
 *      now run sortScheduleColumns() once from the editor.
 *  (5) PartStatus mirror: every tablet Start/Stop/Restart/Send-out/Return now
 *      updates the (Part, Department) row in PartStatus in the same request
 *      (it used to be written only by the desktop dashboard, so it never
 *      moved for tablet work). New parts get a Pending row per department;
 *      deleting / renaming / resetting keeps it consistent. After deploying,
 *      run rebuildPartStatus() once from the editor to fill in / correct the
 *      tab from the current Parts + Operations data.
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
      if (sheet.getName() === "Schedule" && sortScheduleSheet(sheet)) headers = headerRow(sheet);
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

// ===================== Schedule column order =====================
// The Schedule tab gets one column per Plan date ("dd-MM-yyyy"), added at the
// far right whenever a new date is first planned — so they end up in the
// order they were first used (17-09, 09-12, 09-11, 21-09, 04-09 ...), not in
// calendar order. These keep the identity columns (ToolId, DieName, Activity,
// IsCustom, Id, ...) first, in their existing order, followed by every date
// column sorted oldest -> newest. Sorting is by the real date (year, month,
// day), not by the text. Nothing else about the tab changes; the app finds
// columns by header name, so moving them is safe.
function scheduleColumnOrder(headers) {
  var idCols = [], dateCols = [];
  headers.forEach(function (h, i) { (DATE_HEADER_RE.test(String(h)) ? dateCols : idCols).push(i); });
  var key = function (i) { var h = String(headers[i]); return h.slice(6, 10) + h.slice(3, 5) + h.slice(0, 2); };
  dateCols.sort(function (a, b) { return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a - b; });
  var order = idCols.concat(dateCols);
  return { order: order, identity: order.every(function (v, i) { return v === i; }) };
}

// Reorders the columns of the Schedule sheet in place. Returns true if it moved anything.
function sortScheduleSheet(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return false;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(headerKey);
  var o = scheduleColumnOrder(headers);
  if (o.identity) return false;
  var newData = data.map(function (r, idx) {
    return o.order.map(function (i) { return idx === 0 ? headers[i] : r[i]; });
  });
  // Plain Text BEFORE writing, so Sheets can't turn a "09-11-2026" header
  // back into a real Date (see forceTextFormatIfDate).
  newData[0].forEach(function (h, idx) { forceTextFormatIfDate(sheet, h, idx + 1); });
  sheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
  return true;
}

// Runnable straight from the Apps Script editor (Run > sortScheduleColumns).
function sortScheduleColumns() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var moved = sortScheduleSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Schedule"));
    SpreadsheetApp.flush();
    bumpVersion();
    return moved;
  } finally {
    lock.releaseLock();
  }
}

// ===================== Schedule numeric Ids =====================
// Schedule rows are identified by a plain running number (1, 2, 3 ... across
// the whole tab), assigned HERE on the server under the script lock — so two
// tablets creating dies at the same moment can never receive the same number.
// The tablet still invents a temporary "T-..." id locally (it needs one before
// the server has answered); any non-numeric Id arriving in a batch is turned
// into the next free number, or into the number of the row that already holds
// the same die + activity (so a retried / stale request lands on the right row
// instead of creating a duplicate). The mapping is sent back as "idMap".
var SCHEDULE_ACTIVITIES = [
  "Design Release Date", "PR Release Date", "PR Release Date of STD Part",
  "PO Release Date", "Raw Material Cutting", "Sizing/Rough CNC",
  "Surface Grinding", "Chamfering & Tapping", "Heat Treatment",
  "Finishing CNC", "Wire Cutting", "EDM",
  "STD Elements Received Date By Store", "Assembly", "Tool Trial-1",
  "Tool Trial-2", "If Modification"
];
var NUMERIC_ID_RE = /^\d+$/;

// c = applyBatch's cached tab {headers, data, maxNum?}. Returns the Id the row
// should be stored under.
function scheduleNumericId(c, row) {
  var idIdx = c.headers.indexOf("Id"), tIdx = c.headers.indexOf("ToolId"), aIdx = c.headers.indexOf("Activity");
  if (idIdx < 0) return row.Id;
  if (c.maxNum === undefined) {
    c.maxNum = 0;
    for (var m = 1; m < c.data.length; m++) {
      var mv = String(c.data[m][idIdx]);
      if (NUMERIC_ID_RE.test(mv)) c.maxNum = Math.max(c.maxNum, Number(mv));
    }
  }
  var wanted = String(row.Id);
  var byActivity = null;
  for (var i = 1; i < c.data.length; i++) {
    if (String(c.data[i][idIdx]) === wanted) return row.Id; // a legacy row still carrying this id — leave it be
    if (byActivity === null && tIdx >= 0 && aIdx >= 0 && row.ToolId !== undefined && row.Activity !== undefined &&
        String(c.data[i][tIdx]) === String(row.ToolId) && String(c.data[i][aIdx]) === String(row.Activity)) {
      byActivity = c.data[i][idIdx];
    }
  }
  if (byActivity !== null && byActivity !== "") return byActivity;
  c.maxNum += 1;
  return c.maxNum;
}

// One-time tidy of the Schedule tab: every row whose Id is not a plain number
// (the old "T-1789...-abc" ones) gets the next free number — dies in the order
// they first appear, activities in the standard order — existing numeric Ids
// are left exactly as they are, then all rows are sorted by Id, 1 to the end.
function renumberSchedule_(ss) {
  var sh = ss.getSheetByName("Schedule");
  if (!sh || sh.getLastRow() < 2) return { ok: true, message: "Schedule tab is empty" };
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(headerKey);
  var idIdx = headers.indexOf("Id"), tIdx = headers.indexOf("ToolId"), aIdx = headers.indexOf("Activity");
  if (idIdx < 0 || tIdx < 0 || aIdx < 0) return { error: "Schedule tab needs Id, ToolId and Activity columns" };

  var rows = data.slice(1);
  var seen = {}, maxNum = 0, legacy = [];
  rows.forEach(function (r, i) {
    var v = String(r[idIdx]);
    if (NUMERIC_ID_RE.test(v) && !seen[v]) { seen[v] = true; maxNum = Math.max(maxNum, Number(v)); }
    else legacy.push(i);
  });

  // Dies rank by where they FIRST appear in the tab (i.e. creation order).
  var dieOrder = {};
  rows.forEach(function (r) {
    var t = String(r[tIdx]);
    if (dieOrder[t] === undefined) dieOrder[t] = Object.keys(dieOrder).length;
  });
  legacy.sort(function (x, y) {
    var dx = dieOrder[String(rows[x][tIdx])], dy = dieOrder[String(rows[y][tIdx])];
    if (dx !== dy) return dx - dy;
    var ax = SCHEDULE_ACTIVITIES.indexOf(String(rows[x][aIdx])); if (ax < 0) ax = 1000 + x;
    var ay = SCHEDULE_ACTIVITIES.indexOf(String(rows[y][aIdx])); if (ay < 0) ay = 1000 + y;
    return ax - ay;
  });
  legacy.forEach(function (i) { maxNum += 1; rows[i][idIdx] = maxNum; });

  // Stable sort by numeric Id.
  var order = rows.map(function (r, i) { return { r: r, i: i }; });
  order.sort(function (x, y) { return (Number(x.r[idIdx]) - Number(y.r[idIdx])) || (x.i - y.i); });
  var sorted = order.map(function (o) { return o.r; });

  sh.getRange(2, 1, sorted.length, headers.length).setValues(sorted);
  return { ok: true, rows: sorted.length, renumbered: legacy.length, lastId: maxNum };
}

// Runnable from the Apps Script editor (Run > renumberSchedule).
function renumberSchedule() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var res = renumberSchedule_(SpreadsheetApp.getActiveSpreadsheet());
    SpreadsheetApp.flush();
    bumpVersion();
    return res;
  } finally {
    lock.releaseLock();
  }
}

// Run this ONE from the editor: numbers the Ids 1..end AND puts the date
// columns in calendar order.
function tidySchedule() {
  var res = renumberSchedule();
  res.columnsMoved = sortScheduleColumns();
  return res;
}

// ===================== PartStatus mirror =====================
// PartStatus = one row per (Part, Department) holding its CURRENT status
// (Pending / Working / Waiting / Done), plus one "OutSource" row for a part
// that has been sent out. It is what the desktop dashboard's backend keeps up
// to date; the tablet app used to write only Operations, so PartStatus never
// moved. Now every tablet Start/Stop/Restart/Send-out/Return updates its row
// in the SAME request, new parts get a Pending row per department, and
// deleting/renaming/resetting keeps it consistent. Key column: PartDept =
// "<PartId>::<Department>" (same convention as the dashboard).
var FIXED_STAGES = ["Turning", "Milling", "Grinding", "EDM", "Sparking", "VMC", "Wire Cut", "Heat Treatment", "Assembly"];

function opStatusRow(o) {
  return {
    ToolId: o.ToolId, PartId: o.PartId, DieName: o.DieName, PartName: o.PartName,
    Department: o.Department, Operator: o.Operator,
    StartDate: o.StartDate, StartTime: o.StartTime, EndDate: o.EndDate, EndTime: o.EndTime,
    Shift: o.Shift, Status: o.Status, WaitingCount: Number(o.WaitingCount) || 0,
    PartDept: o.PartId + "::" + o.Department
  };
}

function outsourceStatusRow(e) {
  return {
    ToolId: e.ToolId, PartId: e.PartId, DieName: e.DieName, PartName: e.PartName,
    Department: "OutSource", Operator: "",
    StartDate: e.StartDate, StartTime: e.StartTime, EndDate: e.EndDate, EndTime: e.EndTime,
    Shift: "", Status: e.Status, WaitingCount: 0,
    PartDept: e.PartId + "::OutSource"
  };
}

function pendingStatusRow(part, dieName, stage) {
  return {
    ToolId: part.ToolId, PartId: part.PartId, DieName: dieName, PartName: part.Name,
    Department: stage, Operator: "",
    StartDate: "", StartTime: "", EndDate: "", EndTime: "",
    Shift: "", Status: "Pending", WaitingCount: 0,
    PartDept: part.PartId + "::" + stage
  };
}

// The status mirror must never make the REAL write fail (the tablet would
// undo an action that actually saved), so every mirror call swallows errors.
function mirrorStatusRow(ss, row) {
  try {
    var sh = ss.getSheetByName("PartStatus");
    if (!sh) sh = ss.insertSheet("PartStatus");
    upsertRow(sh, row, "PartDept", false);
  } catch (err) { /* mirror only */ }
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

// "2:05:33 PM" / "14:05" -> "14:05:33" / "14:05:00". Time-only cells come back
// from getValues() as 1899-dates whose clock is skewed by the old local-mean-
// time offset, so times are read from the DISPLAYED text instead.
function normTime(s) {
  var m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\s*$/.exec(String(s));
  if (!m) return String(s);
  var h = Number(m[1]);
  if (m[4]) {
    var pm = m[4].toLowerCase() === "pm";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return pad2(h) + ":" + m[2] + ":" + (m[3] || "00");
}

// Operations / OutsourceEntries rows with StartDate/EndDate as "yyyy-MM-dd"
// and StartTime/EndTime as "HH:mm:ss" text, whatever the cells hold.
function readStatusSource(ss, tab) {
  var sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < 2) return [];
  var rng = sh.getDataRange();
  var vals = rng.getValues();
  var disp = rng.getDisplayValues();
  var headers = vals[0].map(headerKey);
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var o = {};
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c], v = vals[r][c];
      if (h === "StartDate" || h === "EndDate") {
        o[h] = Object.prototype.toString.call(v) === "[object Date]"
          ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(v);
      } else if (h === "StartTime" || h === "EndTime") {
        o[h] = Object.prototype.toString.call(v) === "[object Date]" ? normTime(disp[r][c]) : String(v);
      } else {
        o[h] = v;
      }
    }
    out.push(o);
  }
  return out;
}

function allStageNames(ss) {
  var custom = readSheetRows(ss, "CustomStages").map(function (r) { return r.Name; })
    .filter(function (n) { return n && FIXED_STAGES.indexOf(n) < 0; });
  return FIXED_STAGES.concat(custom);
}

// Full PartStatus rows for the parts accepted by matchFn (all if null), for
// every known department — Pending where nothing has happened, the latest
// entry where it has — plus an OutSource row if the part was ever sent out.
// onlyStages limits it to those departments (used when a brand-new
// department appears and every existing part needs a Pending row for it).
function buildPartStatusRows(ss, matchFn, onlyStages) {
  var parts = readSheetRows(ss, "Parts");
  var tools = {};
  readSheetRows(ss, "Tools").forEach(function (t) { tools[String(t.ToolId)] = t; });
  var stages = onlyStages || allStageNames(ss);

  var latest = {}; // PartId -> Department -> newest Operations row
  readStatusSource(ss, "Operations").forEach(function (o) {
    var pid = String(o.PartId);
    latest[pid] = latest[pid] || {};
    var prev = latest[pid][o.Department];
    var key = o.StartDate + " " + o.StartTime;
    if (!prev || key >= prev.StartDate + " " + prev.StartTime) latest[pid][o.Department] = o;
  });
  var outs = {}; // PartId -> newest OutsourceEntries row
  if (!onlyStages) {
    readStatusSource(ss, "OutsourceEntries").forEach(function (e) {
      var pid = String(e.PartId);
      var prev = outs[pid];
      if (!prev || e.StartDate + " " + e.StartTime >= prev.StartDate + " " + prev.StartTime) outs[pid] = e;
    });
  }

  var rows = [];
  parts.forEach(function (p) {
    if (matchFn && !matchFn(p)) return;
    var tool = tools[String(p.ToolId)];
    var dieName = tool ? tool.Description : "";
    var byStage = latest[String(p.PartId)] || {};
    stages.forEach(function (st) {
      var o = byStage[st];
      if (o) {
        var row = opStatusRow(o);
        row.DieName = dieName || row.DieName; // the die's current name wins
        rows.push(row);
      } else {
        rows.push(pendingStatusRow(p, dieName, st));
      }
    });
    if (outs[String(p.PartId)]) {
      var outRow = outsourceStatusRow(outs[String(p.PartId)]);
      outRow.DieName = dieName || outRow.DieName;
      rows.push(outRow);
    }
  });
  return rows;
}

// Rewrites the WHOLE PartStatus tab from Parts + Operations + OutsourceEntries.
// Used by the reset actions and by the one-time rebuild (run
// rebuildPartStatus() from the Apps Script editor after deploying this).
function rebuildPartStatus_(ss) {
  var rows = buildPartStatusRows(ss, null, null);
  var sh = ss.getSheetByName("PartStatus");
  if (!sh) sh = ss.insertSheet("PartStatus");
  sh.clearContents();
  var cols = SCHEMA.PartStatus;
  var data = [cols].concat(rows.map(function (r) {
    return cols.map(function (h) { return r[h] !== undefined ? r[h] : ""; });
  }));
  sh.getRange(1, 1, data.length, cols.length).setValues(data);
  return rows.length;
}

// Runnable straight from the Apps Script editor (Run > rebuildPartStatus).
function rebuildPartStatus() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var n = rebuildPartStatus_(SpreadsheetApp.getActiveSpreadsheet());
    bumpVersion();
    return n;
  } finally {
    lock.releaseLock();
  }
}

// Drops every PartStatus row whose column equals value (a part or die was
// deleted). Rewrites the surviving rows in one go — deleting row by row would
// take many seconds for a die with dozens of parts x departments.
function removePartStatusWhere(ss, col, value) {
  var sh = ss.getSheetByName("PartStatus");
  if (!sh || sh.getLastRow() < 2) return;
  var data = sh.getDataRange().getValues();
  var ci = data[0].map(headerKey).indexOf(col);
  if (ci < 0) return;
  var kept = data.filter(function (r, i) { return i === 0 || String(r[ci]) !== String(value); });
  if (kept.length === data.length) return;
  sh.getRange(2, 1, data.length - 1, data[0].length).clearContent();
  if (kept.length > 1) sh.getRange(2, 1, kept.length - 1, data[0].length).setValues(kept.slice(1));
}

// After a batch: refresh PartStatus for parts that are new / renamed / moved
// to another die, for every part of a die whose description changed, and add a
// Pending row per part for any brand-new department.
function partStatusSyncFromHooks(ss, hooks) {
  var partIds = Object.keys(hooks.parts), toolIds = Object.keys(hooks.tools), stages = Object.keys(hooks.stages);
  if (!partIds.length && !toolIds.length && !stages.length) return;
  try {
    var items = [];
    if (partIds.length || toolIds.length) {
      buildPartStatusRows(ss, function (p) {
        return hooks.parts[String(p.PartId)] || hooks.tools[String(p.ToolId)];
      }, null).forEach(function (r) { items.push({ sheet: "PartStatus", row: r, key_column: "PartDept" }); });
    }
    if (stages.length) {
      buildPartStatusRows(ss, null, stages).forEach(function (r) {
        items.push({ sheet: "PartStatus", row: r, key_column: "PartDept" });
      });
    }
    if (items.length) {
      applyBatch(ss, items);
      SpreadsheetApp.flush();
    }
  } catch (err) { /* mirror only */ }
}

// Applies many {sheet, row, key_column} upserts in memory and writes back only
// what changed. Returns "hooks": the Parts/Tools/CustomStages changes the
// PartStatus mirror needs to refresh (see partStatusSyncFromHooks).
function applyBatch(ss, items) {
  var hooks = { parts: {}, tools: {}, stages: {}, idMap: {} }; // what the PartStatus mirror must refresh afterwards
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
    // Schedule: keep the date columns in calendar order (see above). Only does
    // anything the first time an out-of-order tab is touched, or when this
    // very batch just added a new date column.
    if (name === "Schedule" && c.headers.length) {
      var so = scheduleColumnOrder(c.headers);
      if (!so.identity) {
        var oldData = c.data;
        c.headers = so.order.map(function (i) { return c.headers[i]; });
        c.data = oldData.map(function (r, idx) {
          return idx === 0 ? c.headers : so.order.map(function (i) { return r[i] !== undefined ? r[i] : ""; });
        });
        c.full = true;
        c.reordered = true;
      }
    }
    if (name === "Schedule" && row.Id !== undefined && !NUMERIC_ID_RE.test(String(row.Id))) {
      var numericId = scheduleNumericId(c, row);
      if (String(numericId) !== String(row.Id)) {
        hooks.idMap[row.Id] = numericId;
        var withNumericId = {};
        Object.keys(row).forEach(function (k) { withNumericId[k] = row[k]; });
        withNumericId.Id = numericId;
        row = withNumericId;
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
      if (name === "Parts") {
        var ptIdx = c.headers.indexOf("ToolId"), pnIdx = c.headers.indexOf("Name");
        if ((row.ToolId !== undefined && String(existingRow[ptIdx]) !== String(row.ToolId)) ||
            (row.Name !== undefined && String(existingRow[pnIdx]) !== String(row.Name))) hooks.parts[row.PartId] = true;
      } else if (name === "Tools") {
        var tdIdx = c.headers.indexOf("Description");
        if (row.Description !== undefined && String(existingRow[tdIdx]) !== String(row.Description)) hooks.tools[row.ToolId] = true;
      }
      c.data[foundIdx] = c.headers.map(function (h, i) {
        return row[h] !== undefined ? row[h] : existingRow[i];
      });
      c.changed[foundIdx] = true;
    } else {
      c.data.push(values);
      c.changed[c.data.length - 1] = true;
      if (name === "Parts") hooks.parts[row.PartId] = true;
      else if (name === "CustomStages") hooks.stages[row.Name] = true;
    }
  });

  // Write back ONLY what changed (was: clearContents + rewrite the whole
  // tab, slow on big tabs and the reason batch needed a lock at all).
  Object.keys(cache).forEach(function (name) {
    var c = cache[name];
    if (!c.data.length) return;

    // Only brand-new columns need the Plain Text format applied — the
    // ones that already existed were formatted when they were created.
    for (var hi = c.reordered ? 0 : c.origCols; hi < c.headers.length; hi++) {
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


  return hooks;
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

  // ---- number the Schedule tab's Ids 1..end and sort by them ----
  if (action === "renumber_schedule") {
    return json(renumberSchedule_(ss));
  }

  // ---- reorder the Schedule tab's date columns into calendar order ----
  if (action === "sort_schedule_columns") {
    return json({ ok: true, moved: sortScheduleSheet(ss.getSheetByName("Schedule")) });
  }

  // ---- rebuild the whole PartStatus tab from Parts/Operations/OutsourceEntries ----
  if (action === "rebuild_part_status") {
    return json({ ok: true, rows: rebuildPartStatus_(ss) });
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
    if (deleted && ((sheetName === "Parts" && (body.key_column === "PartId" || body.key_column === "ToolId")) ||
                    (sheetName === "Tools" && body.key_column === "ToolId"))) {
      try { removePartStatusWhere(ss, body.key_column, body.key_value); } catch (err) { /* mirror only */ }
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
    // Resetting entries sends every part back to Pending in PartStatus (and
    // drops the OutSource rows), same as the dashboard's reset.
    if (sheetName === "Operations" || sheetName === "OutsourceEntries") {
      try { rebuildPartStatus_(ss); } catch (err) { /* mirror only */ }
    }
    SpreadsheetApp.flush();
    return json({ ok: true, cleared: Math.max(0, last - 1) });
  }

  // ---- many {sheet, row, key_column} upserts in one execution — reads and
  // writes each tab once instead of once per row, which is what actually
  // makes pushing a lot of rows individually slow ----
  if (action === "batch") {
    var batchItems = body.items || [];
    var batchHooks = applyBatch(ss, batchItems);
    SpreadsheetApp.flush();
    partStatusSyncFromHooks(ss, batchHooks);
    var batchReply = { ok: true, count: batchItems.length };
    if (Object.keys(batchHooks.idMap).length) batchReply.idMap = batchHooks.idMap;
    return json(batchReply);
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
    mirrorStatusRow(ss, action === "start_operation" ? opStatusRow(startRow) : outsourceStatusRow(startRow));
    SpreadsheetApp.flush();
    return json({ ok: true });
  }

  // ---- Stop / Restart: update the Operations row by key, and log the
  // matching OperationHistory event, in ONE execution (was two requests). ----
  if (action === "op_update") {
    if (!sheet) sheet = ss.insertSheet(sheetName);
    upsertRow(sheet, body.row, body.key_column || "Id", false);
    appendHistoryRow(ss, body.history);
    if (sheetName === "Operations") mirrorStatusRow(ss, opStatusRow(body.row));
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
  // Returning a part from OutSource (a plain upsert of its entry) updates its
  // OutSource status row.
  if (sheetName === "OutsourceEntries" && body.row && body.row.PartId) {
    mirrorStatusRow(ss, outsourceStatusRow(body.row));
  }
  SpreadsheetApp.flush();
  // A new department/machine typed via "Other…" (the tablet saves it with a
  // plain upsert): every existing part needs a Pending row for it.
  if (sheetName === "CustomStages" && body.row && body.row.Name) {
    var stageHooks = { parts: {}, tools: {}, stages: {} };
    stageHooks.stages[body.row.Name] = true;
    partStatusSyncFromHooks(ss, stageHooks);
  }
  return json({ ok: true });
}
