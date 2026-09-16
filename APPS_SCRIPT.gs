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
 */

// Canonical schema used only by the "cleanup" action — every sheet tab the
// app currently writes to, and its exact set of columns. Kept in sync by
// hand with the backend's push_row()/push_batch() calls (see main.py).
var SCHEMA = {
  Admin: ["LoginId", "Password"],
  Workshop: ["LoginId", "Password"],
  Tools: ["ToolId", "Description", "ProductName", "NextPartSeq", "CreatedAt"],
  Parts: ["PartId", "ToolId", "Seq", "Name", "Material", "RoughSize", "Qty", "DesignReady", "CodeReady", "CreatedAt"],
  Employees: ["Name", "Shift", "Machine", "CreatedAt"],
  CustomStages: ["Name", "CreatedAt"],
  Operations: ["ToolId", "PartId", "DieName", "PartName", "Department", "Operator", "StartDate", "StartTime", "EndDate", "EndTime", "Shift", "Status", "WaitingCount", "Id"],
  OperationHistory: ["ToolId", "PartId", "DieName", "PartName", "Department", "Operator", "Shift", "WaitingCount", "Date", "Time", "OpId", "Event", "CycleNo"],
  OutsourceEntries: ["ToolId", "PartId", "DieName", "PartName", "Process", "Place", "Duration", "StartDate", "StartTime", "EndDate", "EndTime", "Status", "Id"],
  PartStatus: ["ToolId", "PartId", "DieName", "PartName", "Department", "Operator", "StartDate", "StartTime", "EndDate", "EndTime", "Shift", "Status", "WaitingCount", "PartDept"],
  ChildParts: ["ToolId", "DieName", "ChildName", "Qty", "ChildId"]
};

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

  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

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

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action || "upsert";
  var sheetName = body.sheet;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  // ---- delete every row whose key column matches key_value ----
  if (action === "delete") {
    if (!sheet || sheet.getLastRow() < 2) return json({ ok: true, deleted: 0 });
    var dHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
      var wanted = SCHEMA[name];
      var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
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
        cache[name] = { sheet: sh, headers: data.length ? data[0] : [], data: data };
      }
      var c = cache[name];
      var row = item.row;
      var keyColumn = item.key_column;

      if (c.headers.length === 0) {
        c.headers = Object.keys(row);
        c.data = [c.headers];
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
        c.data[foundIdx] = values;
      } else {
        c.data.push(values);
      }
    });

    Object.keys(cache).forEach(function (name) {
      var c = cache[name];
      if (!c.data.length) return;
      c.sheet.clearContents();
      c.sheet.getRange(1, 1, c.data.length, c.headers.length).setValues(c.data);
    });

    SpreadsheetApp.flush();
    return json({ ok: true, count: items.length });
  }

  // ---- atomic "start" for Operations/OutsourceEntries — a script-wide lock
  // makes the "is this part already open?" check and the append happen as
  // one atomic step, so two devices racing to start the same part can't both
  // win. Returns {ok:false, conflict:{...the existing open row...}} with
  // nothing written if the part is already open; otherwise appends and
  // returns {ok:true}, same shape as the default insert_only path below. ----
  if (action === "start_operation" || action === "start_outsource") {
    var startRow = body.row;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json({ error: "Server busy — try again in a moment." });
    try {
      var openStatuses = action === "start_operation" ? ["Working", "Waiting"] : ["OutSource"];
      if (!sheet) sheet = ss.insertSheet(sheetName);
      var sHeaders = sheet.getLastRow() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        : Object.keys(startRow);
      var pIdx = sHeaders.indexOf("PartId");
      var stIdx = sHeaders.indexOf("Status");
      if (sheet.getLastRow() > 1 && pIdx >= 0 && stIdx >= 0) {
        var existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sHeaders.length).getValues();
        for (var i = 0; i < existingRows.length; i++) {
          if (String(existingRows[i][pIdx]) === String(startRow.PartId) &&
              openStatuses.indexOf(String(existingRows[i][stIdx])) >= 0) {
            var conflict = {};
            sHeaders.forEach(function (h, idx) { conflict[h] = existingRows[i][idx]; });
            return json({ ok: false, conflict: conflict });
          }
        }
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
      SpreadsheetApp.flush();
      return json({ ok: true });
    } finally {
      lock.releaseLock();
    }
  }

  // ---- default: insert or update one row ----
  var row = body.row;
  var keyColumn = body.key_column;
  // Caller guarantees this key can't already exist (e.g. a freshly
  // generated Id on Start/Send-out) — skips the scan below entirely and
  // just appends. This is what keeps Start instant even once a tab has
  // grown into thousands of rows; Stop/Restart/Return still need the scan
  // since they must find and update the SAME row Start created.
  var insertOnly = !!body.insert_only;

  if (!sheet) sheet = ss.insertSheet(sheetName);

  var headers;
  if (sheet.getLastRow() === 0) {
    headers = Object.keys(row);
    sheet.appendRow(headers);
  } else {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // Additive: a field not already a column gets appended as a new one —
    // only the header row is extended, existing data rows are untouched
    // and just read as blank under the new column until they're written.
    var newKeys = Object.keys(row).filter(function (k) { return headers.indexOf(k) < 0; });
    if (newKeys.length) {
      headers = headers.concat(newKeys);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  var values = headers.map(function (h) {
    return row[h] !== undefined ? row[h] : "";
  });

  if (insertOnly) {
    sheet.appendRow(values);
  } else if (keyColumn) {
    // Only the key column is read to find the row, not every column of
    // every row — much cheaper than getDataRange() on a wide, tall tab
    // like Operations, and that read/scan is the main cost of a write.
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
      sheet.getRange(foundRow, 1, 1, headers.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }
  } else {
    sheet.appendRow(values);
  }

  SpreadsheetApp.flush();
  return json({ ok: true });
}
