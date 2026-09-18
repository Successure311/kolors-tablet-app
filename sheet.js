/* Kolors mobile app — data layer.
 *
 * This file replaces the FastAPI backend of the desktop dashboard. Every rule
 * that lived in app/backend/main.py (part IDs, per-department status, the
 * "one physical part can only run in one place" guard) is reimplemented here
 * against the Google Sheet, so the app needs no server of its own.
 */

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycby2USIGol3PDTOc1DXtTauC_RyLve0PvVTyEyzwlSzRJI18_x_c8u8j_qqh6ZK9wx-6/exec";

// Mirrors STAGES / SHIFTS / PLATE_NAMES in app/backend/models.py
const STAGES = [
  "Turning", "Milling", "Grinding", "EDM", "Sparking",
  "VMC", "Wire Cut", "Heat Treatment", "Assembly",
];

// Hindi labels for the fixed STAGES above — mirrors STAGE_NAME_HI in
// app/backend/models.py. Edit directly here to change wording.
const STAGE_NAME_HI = {
  "Turning": "टर्निंग",
  "Milling": "मिलिंग",
  "Grinding": "ग्राइंडिंग",
  "EDM": "ईडीएम",
  "Sparking": "स्पार्किंग",
  "VMC": "वीएमसी",
  "Wire Cut": "वायर कट",
  "Heat Treatment": "हीट ट्रीटमेंट",
  "Assembly": "असेंबली",
  // Not a real department (see OUTSOURCE_STAGE in app.js) but still shown as
  // a tile via machineLabel() — without a curated entry it falls through to
  // the phonetic transliterator and comes out garbled, so it's pinned here
  // the same way the dashboard pins it in STAGE_LABELS after loading.
  "OutSource": "आउटसोर्स",
};

const SHIFTS = ["A", "B"];
const PLATE_NAMES = [
  "TOP PLATE", "BOTTOM PLATE", "DIE PLATE", "PUNCH HOLDER",
  "PUNCH BACK PLATE", "STRIPPER PLATE", "STRIPPER BACK PLATE",
  "WIRE CUT PUNCH", "INSERT",
];

// Fixed manufacturing-activity template for a die's Project Schedule (Plan),
// per the company's Gantt Chart tracking sheet — mirrors SCHEDULE_ACTIVITIES
// in app/backend/models.py. "Tool Room" is a section divider the frontend
// renders before the activity named in SCHEDULE_TOOL_ROOM_START, not a real
// activity row itself.
const SCHEDULE_ACTIVITIES = [
  "Design Release Date", "PR Release Date", "PR Release Date of STD Part",
  "PO Release Date", "Raw Material Cutting", "Sizing/Rough CNC",
  "Surface Grinding", "Chamfering & Tapping", "Heat Treatment",
  "Finishing CNC", "Wire Cutting", "EDM",
  "STD Elements Received Date By Store", "Assembly", "Tool Trial-1",
  "Tool Trial-2", "If Modification",
];
const SCHEDULE_TOOL_ROOM_START = "Raw Material Cutting";

// Fixed "Type Of Project" dropdown options for a die's header metadata.
const TYPE_OF_PROJECT_OPTIONS = ["New Tool", "Modification", "Repair"];

// Used only if the sheet has no Admin tab yet (same as the dashboard's default).
const DEFAULT_ADMIN = { LoginId: "Kolors", Password: "1234" };
const DEFAULT_WORKSHOP = { LoginId: "Work", Password: "1234" };

// ---------- transport ----------

// Older tabs in the sheet still carry snake_case headers (tool_id, created_at)
// from before the dashboard switched to PascalCase. Normalising on read means
// the app works with either, so it isn't broken by whichever style a tab has.
function toPascal(key) {
  return String(key)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function normaliseRow(row) {
  const out = {};
  Object.keys(row).forEach((k) => { out[toPascal(k)] = row[k]; });
  return out;
}

/* Browsers refuse to let a page opened as a file (file://) call any website,
 * so every request below would fail with a bare "Failed to fetch". Catching it
 * here means the user is told the real reason once, instead of seeing that
 * message on every screen. */
const RUNNING_FROM_FILE = location.protocol === "file:";

const FILE_URL_MESSAGE =
  "This app can't run by opening the file directly — browsers block a file:// " +
  "page from reaching Google Sheets. Open it from its web address instead, or " +
  "use the Windows app.";

const OFFLINE_MESSAGE =
  "Can't reach Google Sheets — check this device's internet connection.";

/* Without a timeout, a stalled request (e.g. the backend slow to respond
 * under load from other devices) leaves fetch() pending forever — "Checking..."
 * just sits there with no way to recover short of reloading. */
const REQUEST_TIMEOUT_MS = 15000;

const TIMEOUT_MESSAGE =
  "Google Sheets is taking too long to respond — check the connection and try again.";

/* Apps Script answers a crash with an HTML error page, not JSON, which would
 * otherwise surface as "Unexpected token '<'". In practice it means the script
 * in the sheet is the old version that doesn't know this request. */
async function readJson(res, what) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(
      `The Google Sheet script rejected ${what}. It is probably the old ` +
      `version — paste APPS_SCRIPT.gs into the sheet's Apps Script editor and ` +
      `redeploy (Deploy > Manage deployments > pencil > New version).`
    );
  }
}

async function sheetFetch(url, options, what) {
  if (RUNNING_FROM_FILE) throw new Error(FILE_URL_MESSAGE);
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    // fetch() only rejects on a network-level failure (or the timeout above),
    // never on an HTTP error.
    throw new Error(err.name === "TimeoutError" ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE);
  }
  if (!res.ok) throw new Error(`${what} failed (HTTP ${res.status}).`);
  return res;
}

async function sheetRead(tab) {
  const res = await sheetFetch(
    `${WEBAPP_URL}?sheet=${encodeURIComponent(tab)}`,
    undefined,
    `Reading ${tab}`
  );
  const rows = (await readJson(res, `reading ${tab}`)) || [];
  return rows.map(normaliseRow);
}

// Reads several tabs in ONE Apps Script call instead of one call per tab —
// see the doGet comment in APPS_SCRIPT.gs. Used for the startup bulk load
// (loadAll below), where firing 7 separate requests could queue up past a
// mobile device's timeout even though the client sends them "in parallel".
async function sheetReadMany(tabs) {
  const res = await sheetFetch(
    `${WEBAPP_URL}?sheets=${encodeURIComponent(tabs.join(","))}`,
    undefined,
    `Reading ${tabs.join(", ")}`
  );
  const out = (await readJson(res, `reading ${tabs.join(", ")}`)) || {};
  // An old, not-yet-redeployed script ignores ?sheets= entirely and falls
  // through to ?sheet= (undefined), returning [] instead of an object keyed
  // by tab name. Without this check that would silently look like every
  // tab is empty (no dies/parts) instead of the clear "old version" error
  // readJson already gives for other stale-script cases.
  if (Array.isArray(out)) {
    throw new Error(
      `The Google Sheet script rejected reading ${tabs.join(", ")}. It is probably the old ` +
      `version — paste APPS_SCRIPT.gs into the sheet's Apps Script editor and ` +
      `redeploy (Deploy > Manage deployments > pencil > New version).`
    );
  }
  const result = {};
  tabs.forEach((tab) => { result[tab] = (out[tab] || []).map(normaliseRow); });
  return result;
}

// Sent as text/plain, NOT application/json: that keeps it a "simple" CORS
// request so the browser skips the preflight OPTIONS an Apps Script Web App
// doesn't answer. doPost JSON.parse()s the body either way.
async function sheetPost(payload) {
  const res = await sheetFetch(
    WEBAPP_URL,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    },
    "Saving"
  );
  const out = await readJson(res, "the save");
  if (out && out.error) throw new Error(out.error);
  return out;
}

const sheetUpsert = (tab, row, keyColumn) =>
  sheetPost({ sheet: tab, row, key_column: keyColumn });

// Atomic check-and-append on the server (APPS_SCRIPT.gs, under a script
// lock) — used for Start/Send-out, where two devices could otherwise both
// win the same part. Comes back {ok:false, conflict:{...}} instead of
// writing a second open row if another device already started it a moment
// earlier. See the doPost comment in APPS_SCRIPT.gs.
const sheetStartOperation = (row) =>
  sheetPost({ action: "start_operation", sheet: "Operations", row });

const sheetStartOutsource = (row) =>
  sheetPost({ action: "start_outsource", sheet: "OutsourceEntries", row });

const sheetDelete = (tab, keyColumn, keyValue) =>
  sheetPost({ action: "delete", sheet: tab, key_column: keyColumn, key_value: keyValue });

const sheetClear = (tab) => sheetPost({ action: "clear", sheet: tab });

// Many {sheet, row, key_column} upserts in ONE call — the Apps Script has
// supported this all along (APPS_SCRIPT.gs "batch"), it just had no caller
// on this side until bulk plate/part saves needed it.
const sheetBatch = (items) => sheetPost({ action: "batch", items });

// ---------- date/time ----------
// Sheets returns date/time cells as ISO strings (they're Dates underneath) but
// plain text as-is. These normalise both to the format the dashboard writes,
// so re-saving a row never reformats what's already in the sheet.

const pad = (n) => String(n).padStart(2, "0");

function asDate(v) {
  if (v === "" || v === null || v === undefined) return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isoDate(v) {
  const d = asDate(v);
  if (!d) return v == null ? "" : String(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoTime(v) {
  const d = asDate(v);
  if (!d) return v == null ? "" : String(v);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowParts() {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

const nowStamp = () => {
  const n = nowParts();
  return `${n.date} ${n.time}`;
};

const newOperationId = () => `M-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const startKey = (op) => `${isoDate(op.StartDate)} ${isoTime(op.StartTime)}`;

// ---------- in-memory store ----------

const store = {
  tools: [], parts: [], employees: [], operations: [], customStages: [],
  outsourceEntries: [], childParts: [], scheduleActivities: [],
};

// ---------- local cache: lets the app open with the last-known data
// instantly (see init() in app.js) instead of showing a blocking "Loading
// from Google Sheet…" screen every time — a fresh copy is then fetched in
// the background and silently replaces it. Purely a convenience: if it's
// missing, corrupt, or storage is unavailable (private browsing etc.), the
// app just falls back to waiting on the network as before. ----------
const CACHE_KEY = "kolors_data_cache_v1";

function saveCacheToLocalStorage() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      tools: store.tools,
      parts: store.parts,
      employees: store.employees,
      operations: store.operations,
      customStages: store.customStages,
      outsourceEntries: store.outsourceEntries,
      childParts: store.childParts,
      scheduleActivities: store.scheduleActivities,
    }));
  } catch (_) { /* storage full/unavailable — cache is a nice-to-have, not required */ }
}

function loadCacheFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    store.tools = data.tools || [];
    store.parts = data.parts || [];
    store.employees = data.employees || [];
    store.operations = data.operations || [];
    store.customStages = data.customStages || [];
    store.outsourceEntries = data.outsourceEntries || [];
    store.childParts = data.childParts || [];
    store.scheduleActivities = data.scheduleActivities || [];
    return true;
  } catch (_) {
    return false;
  }
}

async function loadAll() {
  const data = await sheetReadMany([
    "Tools", "Parts", "Employees", "Operations", "CustomStages", "OutsourceEntries", "ChildParts",
    "Schedule",
  ]);
  store.tools = data.Tools;
  store.parts = data.Parts;
  store.employees = data.Employees;
  store.operations = data.Operations;
  store.customStages = data.CustomStages;
  store.outsourceEntries = data.OutsourceEntries;
  store.childParts = data.ChildParts;
  store.scheduleActivities = normaliseScheduleRows(data.Schedule);
  saveCacheToLocalStorage();
}

const reloadTools = async () => { store.tools = await sheetRead("Tools"); saveCacheToLocalStorage(); };
const reloadParts = async () => { store.parts = await sheetRead("Parts"); saveCacheToLocalStorage(); };
const reloadEmployees = async () => { store.employees = await sheetRead("Employees"); saveCacheToLocalStorage(); };
const reloadOperations = async () => { store.operations = await sheetRead("Operations"); saveCacheToLocalStorage(); };
const reloadOutsourceEntries = async () => {
  store.outsourceEntries = await sheetRead("OutsourceEntries").catch(() => []);
  saveCacheToLocalStorage();
};
const reloadChildParts = async () => {
  store.childParts = await sheetRead("ChildParts").catch(() => []);
  saveCacheToLocalStorage();
};
// Reads the SAME "Schedule" tab the dashboard mirrors to (see main.py's
// _schedule_activity_identity_row/_schedule_mark_sheet_row) — one row per
// activity, one dynamically-added column per Plan date holding "P" — so a
// Plan checked in either app shows up in both, instead of the tablet keeping
// its own separate schedule data.
const reloadScheduleActivities = async () => {
  store.scheduleActivities = normaliseScheduleRows(await sheetRead("Schedule").catch(() => []));
  saveCacheToLocalStorage();
};

// ---------- custom (typed via "Other…") departments/machines ----------
// Mirrors the CustomStage table in app/backend/models.py: a name typed once
// is kept permanently, so it shows up as its own tile/option everywhere from
// then on — independent of whether any entry currently references it.

function allKnownStages() {
  const custom = store.customStages.map((c) => c.Name).filter(Boolean);
  return STAGES.concat(custom.filter((s) => !STAGES.includes(s)).sort());
}

// Adds it to the local list immediately (so it's a real tile right away)
// and pushes it to the sheet in the background — never makes the caller
// wait on a network round trip.
function rememberCustomStage(name) {
  const n = (name || "").trim();
  if (!n || STAGES.includes(n) || store.customStages.some((c) => c.Name === n)) return;
  store.customStages.push({ Name: n, CreatedAt: nowStamp() });
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetUpsert("CustomStages", { Name: n, CreatedAt: nowStamp() }, "Name");
    } catch (err) {
      store.customStages = store.customStages.filter((c) => c.Name !== n);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save new department/machine "${n}" to the Google Sheet — undone. ${err.message}`);
    }
  })();
}

// ---------- tools ----------

function listTools() {
  return store.tools
    .slice()
    .sort((a, b) => String(b.CreatedAt || "").localeCompare(String(a.CreatedAt || "")));
}

const findTool = (toolId) => store.tools.find((t) => String(t.ToolId) === String(toolId)) || null;

async function createTool({ toolId, description, productName, typeOfProject, projectStartDate }) {
  const id = (toolId || "").trim();
  if (!id) throw new Error("Die ID is required");
  if (!(description || "").trim()) throw new Error("Description is required");
  if (findTool(id)) throw new Error(`Die ${id} already exists`);
  const row = {
    ToolId: id,
    Description: description.trim(),
    ProductName: (productName || "").trim(),
    TypeOfProject: (typeOfProject || "").trim(),
    ProjectStartDate: (projectStartDate || "").trim(),
    NextPartSeq: 1,
    ScheduleRangeStart: "",
    ScheduleRangeEnd: "",
    CreatedAt: nowStamp(),
  };
  // Auto-populate the fixed 17-activity Project Schedule template, so the
  // schedule table appears fully filled in immediately — same identity-row
  // shape as _schedule_activity_identity_row() in app/backend/main.py, into
  // the SAME "Schedule" tab the dashboard mirrors to.
  const scheduleRows = SCHEDULE_ACTIVITIES.map((name) => ({
    Id: newScheduleActivityId(),
    ToolId: id,
    DieName: row.Description,
    Activity: name,
    IsCustom: false,
  }));
  await sheetBatch(
    [{ sheet: "Tools", row, key_column: "ToolId" }].concat(
      scheduleRows.map((r) => ({ sheet: "Schedule", row: r, key_column: "Id" }))
    )
  );
  await Promise.all([reloadTools(), reloadScheduleActivities()]);
  return row;
}

// Edit a die's Description/Product Name, and optionally rename its Die ID.
// A rename cascades to every row that references this die (Parts,
// Operations, OutsourceEntries, ChildParts) across several sheet tabs, so
// that path (renameTool) still waits on the network — but a plain
// Description/Product Name edit is instant, same as everywhere else: the
// screen updates right away and the sheet write happens in the background.
async function updateTool(toolId, { newToolId, description, productName, typeOfProject, projectStartDate }) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");

  const newId = (newToolId || "").trim();
  if (newId && newId !== toolId) {
    const fields = {
      ...tool,
      Description: description != null ? description.trim() : tool.Description,
      ProductName: productName != null ? productName.trim() : tool.ProductName,
      TypeOfProject: typeOfProject != null ? typeOfProject.trim() : tool.TypeOfProject,
      ProjectStartDate: projectStartDate != null ? projectStartDate.trim() : tool.ProjectStartDate,
      CreatedAt: isoStamp(tool.CreatedAt),
    };
    return renameTool(toolId, newId, fields);
  }

  const before = { ...tool };
  const descChanged = description != null && description.trim() !== tool.Description;
  if (description != null) tool.Description = description.trim();
  if (productName != null) tool.ProductName = productName.trim();
  if (typeOfProject != null) tool.TypeOfProject = typeOfProject.trim();
  if (projectStartDate != null) tool.ProjectStartDate = projectStartDate.trim();
  saveCacheToLocalStorage();

  const fields = { ...tool, CreatedAt: isoStamp(tool.CreatedAt) };

  // DieName is denormalized onto every Operations/OutsourceEntries/
  // ChildParts row for this die (so the Entries/Outsource tables and the raw
  // sheet can show a readable name without joining tables) — a Description
  // change has to refresh it on every row that already carries the old one,
  // same cascade renameTool does, just without a key change.
  const affectedOps = descChanged ? store.operations.filter((o) => String(o.ToolId) === String(toolId)) : [];
  const affectedOutsource = descChanged ? store.outsourceEntries.filter((o) => String(o.ToolId) === String(toolId)) : [];
  const affectedChildParts = descChanged ? store.childParts.filter((c) => String(c.ToolId) === String(toolId)) : [];
  if (descChanged) {
    affectedOps.forEach((o) => { o.DieName = fields.Description; });
    affectedOutsource.forEach((o) => { o.DieName = fields.Description; });
    affectedChildParts.forEach((c) => { c.DieName = fields.Description; });
    saveCacheToLocalStorage();
  }

  (async () => {
    try {
      const items = [{ sheet: "Tools", row: fields, key_column: "ToolId" }];
      affectedOps.forEach((o) => items.push({ sheet: "Operations", row: o, key_column: "Id" }));
      affectedOutsource.forEach((o) => items.push({ sheet: "OutsourceEntries", row: o, key_column: "Id" }));
      affectedChildParts.forEach((c) => items.push({ sheet: "ChildParts", row: c, key_column: "ChildId" }));
      if (items.length > 1) {
        await sheetBatch(items);
      } else {
        await sheetUpsert("Tools", fields, "ToolId");
      }
    } catch (err) {
      Object.assign(tool, before);
      affectedOps.forEach((o) => { o.DieName = before.Description; });
      affectedOutsource.forEach((o) => { o.DieName = before.Description; });
      affectedChildParts.forEach((c) => { c.DieName = before.Description; });
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save changes to Die ${toolId} to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return fields;
}

// Change a Tool's ToolId, moving every row that references the old id
// (Part, PartOperation, OutsourceEntry, ChildPart) along with it, mirroring
// _rename_tool() in app/backend/main.py. `fields` carries any pending
// (uncommitted) field edits from the same Save click.
async function renameTool(oldId, newId, fields) {
  if (findTool(newId)) throw new Error(`Die ID ${newId} already exists`);
  const tool = fields || findTool(oldId);
  if (!tool) throw new Error("Die not found");

  const renamed = { ...tool, ToolId: newId };
  const parts = store.parts.filter((p) => String(p.ToolId) === String(oldId));
  const ops = store.operations.filter((o) => String(o.ToolId) === String(oldId));
  const outsourceEntries = store.outsourceEntries.filter((o) => String(o.ToolId) === String(oldId));
  const childParts = store.childParts.filter((c) => String(c.ToolId) === String(oldId));
  const scheduleActivities = store.scheduleActivities.filter((a) => String(a.ToolId) === String(oldId));

  const items = [{ sheet: "Tools", row: renamed, key_column: "ToolId" }];
  parts.forEach((p) => items.push({ sheet: "Parts", row: { ...p, ToolId: newId }, key_column: "PartId" }));
  ops.forEach((o) => items.push({ sheet: "Operations", row: { ...o, ToolId: newId, DieName: renamed.Description }, key_column: "Id" }));
  outsourceEntries.forEach((o) => items.push({ sheet: "OutsourceEntries", row: { ...o, ToolId: newId, DieName: renamed.Description }, key_column: "Id" }));
  childParts.forEach((c) => items.push({ sheet: "ChildParts", row: { ...c, ToolId: newId, DieName: renamed.Description }, key_column: "ChildId" }));
  // The full row (identity columns + every Plan-date column already on it)
  // is sent, not just {ToolId, DieName} — Schedule rows carry dynamic
  // per-date columns that must survive the rename untouched.
  scheduleActivities.forEach((a) => items.push({ sheet: "Schedule", row: { ...a, ToolId: newId, DieName: renamed.Description }, key_column: "Id" }));

  await sheetBatch(items);
  await sheetDelete("Tools", "ToolId", oldId);
  await Promise.all([
    reloadTools(), reloadParts(), reloadOperations(), reloadOutsourceEntries(), reloadChildParts(),
    reloadScheduleActivities(),
  ]);
  return renamed;
}

// Cascades to every row that references this die (Parts, Operations,
// OutsourceEntries, ChildParts, Schedule), mirroring delete_tool() in
// app/backend/main.py.
async function deleteTool(toolId) {
  if (!findTool(toolId)) throw new Error("Die not found");
  await Promise.all([
    sheetDelete("Tools", "ToolId", toolId),
    sheetDelete("Parts", "ToolId", toolId),
    sheetDelete("Operations", "ToolId", toolId),
    sheetDelete("OutsourceEntries", "ToolId", toolId),
    sheetDelete("ChildParts", "ToolId", toolId),
    sheetDelete("Schedule", "ToolId", toolId),
  ]);
  await Promise.all([
    reloadTools(), reloadParts(), reloadOperations(), reloadOutsourceEntries(), reloadChildParts(),
    reloadScheduleActivities(),
  ]);
}

// ---------- parts ----------

function listParts(toolId) {
  return store.parts
    .filter((p) => String(p.ToolId) === String(toolId))
    .sort((a, b) => Number(a.Seq || 0) - Number(b.Seq || 0));
}

const findPart = (partId) => store.parts.find((p) => String(p.PartId) === String(partId)) || null;

async function addPart(toolId, { name, partId, material, roughSize, qty }) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  if (!(name || "").trim()) throw new Error("Plate name is required");

  const seq = Number(tool.NextPartSeq || 1) || 1;
  const custom = (partId || "").trim();
  let id;
  if (custom) {
    if (findPart(custom)) throw new Error(`Part ID ${custom} already exists`);
    id = custom;
  } else {
    id = `${toolId}-P${pad(seq)}`;
  }

  const row = {
    PartId: id,
    ToolId: toolId,
    Seq: seq,
    Name: name.trim(),
    Material: (material || "").trim(),
    RoughSize: (roughSize || "").trim(),
    Qty: Number(qty || 1) || 1,
    DesignReady: "N",
    CodeReady: "N",
    CreatedAt: nowStamp(),
  };
  await sheetUpsert("Parts", row, "PartId");
  await sheetUpsert("Tools", { ...tool, NextPartSeq: seq + 1 }, "ToolId");
  await Promise.all([reloadParts(), reloadTools()]);
  return row;
}

async function updatePart(partId, { name, material, roughSize, qty }) {
  const part = findPart(partId);
  if (!part) throw new Error("Part not found");
  const row = {
    ...part,
    Name: name != null ? name.trim() : part.Name,
    Material: material != null ? material.trim() : part.Material,
    RoughSize: roughSize != null ? roughSize.trim() : part.RoughSize,
    Qty: qty != null ? Number(qty) || 1 : part.Qty,
    CreatedAt: isoStamp(part.CreatedAt),
  };
  await sheetUpsert("Parts", row, "PartId");
  await reloadParts();
  return row;
}

// Keeps an existing CreatedAt in "YYYY-MM-DD HH:MM:SS" shape when rewriting a row.
function isoStamp(v) {
  const d = asDate(v);
  if (!d) return v == null ? "" : String(v);
  return `${isoDate(v)} ${isoTime(v)}`;
}

// Removed from the screen immediately; the sheet delete (part + its
// tracking entries, same cascade as the dashboard) happens in the
// background, same pattern as Start/Stop/Restart above.
function deletePart(partId) {
  const partSnapshot = store.parts.filter((p) => String(p.PartId) === String(partId));
  const opsSnapshot = store.operations.filter((o) => String(o.PartId) === String(partId));
  const hadOps = opsSnapshot.length > 0;

  store.parts = store.parts.filter((p) => String(p.PartId) !== String(partId));
  store.operations = store.operations.filter((o) => String(o.PartId) !== String(partId));
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetDelete("Parts", "PartId", partId);
      if (hadOps) await sheetDelete("Operations", "PartId", partId);
    } catch (err) {
      store.parts = store.parts.concat(partSnapshot);
      store.operations = store.operations.concat(opsSnapshot);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not delete part ${partId} from the Google Sheet — undone. ${err.message}`);
    }
  })();
}

// Add several plates at once — one Part row each, same auto-generated
// PartId scheme as addPart(), all pushed in ONE batch call.
async function addPartsBulk(toolId, names) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  const clean = (names || []).map((n) => (n || "").trim()).filter(Boolean);
  if (!clean.length) throw new Error("At least one plate name is required");

  let seq = Number(tool.NextPartSeq || 1) || 1;
  const rows = clean.map((name) => {
    const row = {
      PartId: `${toolId}-P${pad(seq)}`,
      ToolId: toolId,
      Seq: seq,
      Name: name,
      Material: "",
      RoughSize: "",
      Qty: 1,
      DesignReady: "N",
      CodeReady: "N",
      CreatedAt: nowStamp(),
    };
    seq += 1;
    return row;
  });

  await sheetBatch(
    rows.map((row) => ({ sheet: "Parts", row, key_column: "PartId" })).concat([
      { sheet: "Tools", row: { ...tool, NextPartSeq: seq }, key_column: "ToolId" },
    ])
  );
  await Promise.all([reloadParts(), reloadTools()]);
  return rows;
}

// Save every inline-edited row of the parts table in one batch call. A row
// whose newPartId differs from its partId is a rename (the auto-generated
// Part ID typed over by hand) — handled separately via renamePart() since it
// changes the sheet's key column, not just a batch-updatable field.
async function updatePartsBulk(edits) {
  const rows = [];
  const renames = [];
  (edits || []).forEach((e) => {
    const part = findPart(e.partId);
    if (!part) return;
    const updated = {
      ...part,
      Material: e.material != null ? String(e.material).trim() : part.Material,
      RoughSize: e.roughSize != null ? String(e.roughSize).trim() : part.RoughSize,
      Qty: e.qty != null ? Number(e.qty) || 1 : part.Qty,
      CreatedAt: isoStamp(part.CreatedAt),
    };
    const newId = (e.newPartId || "").trim();
    if (newId && newId !== part.PartId) {
      renames.push({ oldId: part.PartId, newId, fields: updated });
    } else {
      rows.push(updated);
    }
  });
  if (rows.length) {
    await sheetBatch(rows.map((row) => ({ sheet: "Parts", row, key_column: "PartId" })));
  }
  for (const r of renames) {
    await renamePart(r.oldId, r.newId, r.fields);
  }
  await reloadParts();
  return rows.concat(renames.map((r) => ({ ...r.fields, PartId: r.newId })));
}

// Change a Part's PartId, moving every row that references the old id
// (Operations, OutsourceEntries — NOT ChildParts, which is die-scoped) along
// with it, mirroring _rename_part() in app/backend/main.py. `fields` carries
// any pending (uncommitted) field edits from the same Save All click.
async function renamePart(oldId, newId, fields) {
  if (findPart(newId)) throw new Error(`Part ID ${newId} already exists`);
  const part = fields || findPart(oldId);
  if (!part) throw new Error("Part not found");

  const renamed = { ...part, PartId: newId };
  const ops = store.operations.filter((o) => String(o.PartId) === String(oldId));
  const outsourceEntries = store.outsourceEntries.filter((o) => String(o.PartId) === String(oldId));

  const items = [{ sheet: "Parts", row: renamed, key_column: "PartId" }];
  ops.forEach((o) => items.push({ sheet: "Operations", row: { ...o, PartId: newId }, key_column: "Id" }));
  outsourceEntries.forEach((o) => items.push({ sheet: "OutsourceEntries", row: { ...o, PartId: newId }, key_column: "Id" }));
  await sheetBatch(items);
  await sheetDelete("Parts", "PartId", oldId);
  await Promise.all([reloadParts(), reloadOperations(), reloadOutsourceEntries()]);
  return renamed;
}

// ---------- child parts: one flat Name+Qty list per DIE (not per part),
// filled in bulk from an uploaded Excel/CSV file. Uploading only parses and
// returns a preview — nothing is saved until saveChildParts() is called, so
// the operator can edit/delete staged rows first (same as the dashboard). ----------

const listChildParts = (toolId) =>
  store.childParts.filter((c) => String(c.ToolId) === String(toolId));

// Parses the file with the vendored SheetJS build (handles .csv and .xlsx
// alike) into (name, qty) rows. The first row is always treated as the
// header and skipped, regardless of what it contains — matches the
// dashboard's _parse_child_parts_file (an earlier "sniff the Qty cell"
// heuristic could silently fail to strip the header).
function parseChildPartsRows(rows) {
  let data = (rows || []).filter((r) => r && r.some((c) => String(c == null ? "" : c).trim()));
  data = data.slice(1);
  const out = [];
  data.forEach((r) => {
    const name = String(r[0] == null ? "" : r[0]).trim();
    if (!name) return;
    const qtyRaw = r.length > 1 && String(r[1]).trim() ? String(r[1]).trim() : "1";
    const qty = parseInt(parseFloat(qtyRaw), 10);
    out.push({ name, qty: isNaN(qty) ? 1 : qty });
  });
  return out;
}

function readSheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }));
      } catch (err) {
        reject(new Error("Could not read that file — upload a .csv or .xlsx file."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Parse-only — no sheet writes. Returns [{name, qty}, ...] for the caller to
// stage on screen; nothing is saved until saveChildParts().
async function importChildPartsPreview(file) {
  const parsed = parseChildPartsRows(await readSheetFile(file));
  if (!parsed.length) throw new Error("No child parts found in the file");
  return parsed;
}

// Replaces this die's entire Child Parts list with exactly the rows given —
// whatever the operator currently has on screen (loaded rows, uploaded rows,
// edits, deletions all merged into one list by the UI), mirroring PUT
// /api/tools/{tool_id}/child-parts.
async function saveChildParts(toolId, rows) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  const clean = (rows || [])
    .map((r) => ({ name: (r.name || "").trim(), qty: Number(r.qty) || 1 }))
    .filter((r) => r.name);

  const built = clean.map((cp, i) => ({
    ToolId: toolId,
    DieName: tool.Description,
    ChildName: cp.name,
    Qty: cp.qty,
    ChildId: `${toolId}::${i + 1}::${Date.now()}`,
  }));

  await sheetDelete("ChildParts", "ToolId", toolId);
  if (built.length) {
    await sheetBatch(built.map((row) => ({ sheet: "ChildParts", row, key_column: "ChildId" })));
  }
  await reloadChildParts();
  return built;
}

// ---------- schedule (Project Schedule / Plan) ----------
// Reads/writes the SAME "Schedule" tab the dashboard mirrors to (see
// _schedule_activity_identity_row/_schedule_mark_sheet_row in
// app/backend/main.py): one row per activity — {Id, ToolId, DieName,
// Activity, IsCustom} — plus one dynamically-added column per Plan date
// (named "dd-MM-yyyy") holding "P" when planned. A Plan checked in either
// app therefore shows up in both, instead of the tablet keeping its own
// separate schedule data. The fixed 17 activities are auto-seeded on die
// creation (see createTool()); only custom ("Other") activities are ever
// added by hand here.

const newScheduleActivityId = () => `T-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Older sheet data (or a network hiccup mid-write) can leave behind a stray
// row whose cells are literally the header names themselves, or two rows
// sharing the same Id — defensive even after APPS_SCRIPT.gs's one-time
// "repair_schedule" action has cleaned the sheet itself, since a fresh
// device could still be reading a stale mirror momentarily.
function normaliseScheduleRows(rows) {
  const byId = new Map();
  const order = [];
  (rows || []).forEach((row) => {
    if (String(row.ToolId) === "ToolId") return; // stray header-as-data row
    const id = String(row.Id);
    if (byId.has(id)) {
      const existing = byId.get(id);
      Object.keys(row).forEach((k) => {
        const v = row[k];
        if (v !== "" && v != null && (existing[k] === "" || existing[k] == null)) existing[k] = v;
      });
    } else {
      byId.set(id, { ...row });
      order.push(id);
    }
  });
  return order.map((id) => byId.get(id));
}

// "2026-09-17" -> "17-09-2026", matching mark_date.strftime("%d-%m-%Y") in
// app/backend/main.py — the literal column name a Plan mark lives under.
function dateHeaderKey(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function listScheduleActivities(toolId) {
  const rows = store.scheduleActivities.filter((a) => String(a.ToolId) === String(toolId));
  // No seq/created-at column exists in the shared sheet to sort by — fixed
  // activities sort into their canonical SCHEDULE_ACTIVITIES position
  // (matching the dashboard's own ordering exactly); anything else (custom,
  // "Other" activities) keeps the sheet's own row order, stably, after them.
  return rows
    .map((a, i) => ({ a, i, fixedIdx: SCHEDULE_ACTIVITIES.indexOf(a.Activity) }))
    .sort((x, y) => {
      const xKey = x.fixedIdx >= 0 ? x.fixedIdx : SCHEDULE_ACTIVITIES.length + x.i;
      const yKey = y.fixedIdx >= 0 ? y.fixedIdx : SCHEDULE_ACTIVITIES.length + y.i;
      return xKey - yKey;
    })
    .map((x) => x.a);
}

// Add custom ("Other") schedule activities at once — one row per name. Names
// already present for this die (including the auto-seeded fixed ones) are
// skipped rather than duplicated. Mirrors add_schedule_bulk() in
// app/backend/main.py, minus the seq bookkeeping — order is derived at read
// time instead (see listScheduleActivities() above).
async function addScheduleBulk(toolId, names) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  const clean = (names || []).map((n) => (n || "").trim()).filter(Boolean);
  if (!clean.length) throw new Error("At least one activity name is required");

  const existingNames = new Set(listScheduleActivities(toolId).map((a) => a.Activity));
  const created = [];
  clean.forEach((name) => {
    if (existingNames.has(name)) return;
    created.push({
      Id: newScheduleActivityId(),
      ToolId: toolId,
      DieName: tool.Description,
      Activity: name,
      IsCustom: !SCHEDULE_ACTIVITIES.includes(name),
    });
    existingNames.add(name);
  });
  if (!created.length) return [];

  await sheetBatch(created.map((row) => ({ sheet: "Schedule", row, key_column: "Id" })));
  await reloadScheduleActivities();
  return created;
}

async function deleteScheduleActivity(id) {
  await sheetDelete("Schedule", "Id", id);
  await reloadScheduleActivities();
}

// Every schedule activity for this die, each annotated with its Plan mark
// for every date from start to end inclusive (Sundays skipped, matching the
// paper Gantt Chart's working-day columns) — powers the Generate button's
// bulk planning table. Purely local (no network round trip) since the data
// is already synced into `store`.
function scheduleRange(toolId, start, end) {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    if (cursor.getDay() !== 0) { // Sunday=0 in JS, matches weekday()==6 in Python
      dates.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    dates,
    activities: listScheduleActivities(toolId).map((a) => ({
      ...a,
      marks: Object.fromEntries(dates.map((iso) => [iso, a[dateHeaderKey(iso)] === "P"])),
    })),
  };
}

// Saves the whole Generate table in one go — marksByDate maps each date
// column (ISO string) to the activity ids checked for that date. Only cells
// that actually changed are pushed, mirroring the dashboard's diffing in
// _apply_schedule_marks(). Each push sends the activity's FULL current row
// (every Plan-date column already known locally, not just the one changed)
// so a slow-to-redeploy Apps Script can never blank out other dates by
// treating an omitted column as "clear this" instead of "unchanged" — see
// the APPS_SCRIPT.gs file header for the full story. Also remembers the
// range on the Tool row so reopening this die later shows the same range
// again (see refreshScheduleRange() in app.js).
async function saveScheduleMarkRange(toolId, start, end, marksByDate) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  const activities = listScheduleActivities(toolId);
  const changedActivities = new Set();

  Object.keys(marksByDate).forEach((iso) => {
    const checkedIds = new Set((marksByDate[iso] || []).map(String));
    const key = dateHeaderKey(iso);
    activities.forEach((activity) => {
      const shouldBePlanned = checkedIds.has(String(activity.Id));
      const alreadyPlanned = activity[key] === "P";
      if (shouldBePlanned === alreadyPlanned) return;
      activity[key] = shouldBePlanned ? "P" : "";
      changedActivities.add(activity);
    });
  });

  const items = Array.from(changedActivities).map((row) => ({ sheet: "Schedule", row, key_column: "Id" }));
  items.push({ sheet: "Tools", row: { ...tool, ScheduleRangeStart: start, ScheduleRangeEnd: end }, key_column: "ToolId" });
  await sheetBatch(items);
  tool.ScheduleRangeStart = start;
  tool.ScheduleRangeEnd = end;
  saveCacheToLocalStorage();
}

// ---------- outsource (send a part to an outside vendor) ----------
// Its own tab rather than a department in Operations: most parts never go
// out (so no "Pending" default anywhere) and it tracks different fields.

function listOutsourceEntries(status) {
  return store.outsourceEntries
    .filter((e) => !status || String(e.Status) === String(status))
    .slice()
    .sort((a, b) => startKey(b).localeCompare(startKey(a)));
}

// The latest entry for a part, or null if it never went out — what Track a
// Die's OutSource column reads (blank when null, never "Pending").
function outsourceStatusFor(partId) {
  const mine = store.outsourceEntries
    .filter((e) => String(e.PartId) === String(partId))
    .sort((a, b) => startKey(a).localeCompare(startKey(b)));
  return mine.length ? mine[mine.length - 1] : null;
}

// Instant, same as startOperation()/stopOperation() in the machine tabs:
// updates the screen right away and syncs to the Google Sheet in the
// background, so there's nothing to wait on here.
function startOutsource({ toolId, partId, process, place, duration }) {
  const part = findPart(partId);
  if (!part || String(part.ToolId) !== String(toolId)) throw new Error("Part not found for this die");
  if (!(process || "").trim()) throw new Error("Process is required");
  if (!(place || "").trim()) throw new Error("Place is required");

  const open = store.outsourceEntries.find(
    (e) => String(e.PartId) === String(partId) && String(e.Status) === "OutSource"
  );
  if (open) throw new Error(`Part ${partId} is already OutSource. Mark it returned first.`);

  const tool = findTool(toolId);
  const now = nowParts();
  const row = {
    ToolId: toolId,
    PartId: partId,
    DieName: tool ? tool.Description : "",
    PartName: part.Name,
    Process: process.trim(),
    Place: place.trim(),
    Duration: (duration || "").trim(),
    StartDate: now.date,
    StartTime: now.time,
    EndDate: "",
    EndTime: "",
    Status: "OutSource",
    Id: newOperationId(),
  };

  store.outsourceEntries.push(row);
  saveCacheToLocalStorage();

  (async () => {
    try {
      const out = await sheetStartOutsource(row);
      if (out && out.ok === false) {
        store.outsourceEntries = store.outsourceEntries.filter((e) => e.Id !== row.Id);
        await reloadOutsourceEntries();
        const c = out.conflict || {};
        notifyBackgroundError(
          `Part ${row.PartId} is already OutSource${c.Place ? ` at ${c.Place}` : ""} — someone else sent it out first.`
        );
        return;
      }
    } catch (err) {
      store.outsourceEntries = store.outsourceEntries.filter((e) => e.Id !== row.Id);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save "Send out ${row.PartId}" to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return row;
}

function stopOutsource(entryId) {
  const entry = store.outsourceEntries.find((e) => String(e.Id) === String(entryId));
  if (!entry) throw new Error("Outsource entry not found");
  if (String(entry.Status) !== "OutSource") throw new Error("Entry is not currently out");

  const before = { ...entry };
  const now = nowParts();
  Object.assign(entry, { Status: "Done", EndDate: now.date, EndTime: now.time });
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetUpsert("OutsourceEntries", entry, "Id");
    } catch (err) {
      Object.assign(entry, before);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save "Return ${entry.PartId}" to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return entry;
}

// ---------- die status (Design Ready / Code Ready, per PART) ----------

// Instant, same as startOperation()/stopOperation(): the Y/N buttons update
// the screen right away and sync to the Google Sheet in the background, so
// there's nothing to wait on here.
function updatePartStatus(partId, { designReady, codeReady }) {
  const part = findPart(partId);
  if (!part) throw new Error("Part not found");
  const before = { ...part };
  if (designReady != null) part.DesignReady = designReady;
  if (codeReady != null) part.CodeReady = codeReady;
  saveCacheToLocalStorage();

  const row = { ...part, CreatedAt: isoStamp(part.CreatedAt) };
  (async () => {
    try {
      await sheetUpsert("Parts", row, "PartId");
    } catch (err) {
      Object.assign(part, before);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save status for part ${partId} to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return row;
}

// ---------- employees ----------

function listEmployees() {
  return store.employees
    .slice()
    .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")));
}

const findEmployee = (name) =>
  store.employees.find((e) => String(e.Name) === String(name)) || null;

// Employees with a fixed Machine matching this department — only these show
// up to pick from when starting/stopping work at that department, mirroring
// "there is fix workers in each department" from the dashboard.
const employeesForStage = (stage) =>
  listEmployees().filter((e) => String(e.Machine || "") === String(stage || ""));

async function createEmployee(name, shift, machine) {
  const n = (name || "").trim();
  if (!n) throw new Error("Name is required");
  if (!SHIFTS.includes(shift)) throw new Error("Unknown shift");
  const m = (machine || "").trim();
  if (!m) throw new Error("Machine is required");
  if (findEmployee(n)) throw new Error(`Employee ${n} already exists`);
  rememberCustomStage(m);
  const row = { Name: n, Shift: shift, Machine: m, CreatedAt: nowStamp() };
  await sheetUpsert("Employees", row, "Name");
  await reloadEmployees();
  return row;
}

// Instant, same as updateTool()/updatePartStatus(): the screen updates right
// away and the sheet write happens in the background.
function updateEmployee(name, { shift, machine }) {
  const emp = findEmployee(name);
  if (!emp) throw new Error("Employee not found");
  const m = (machine || "").trim();
  if (!m) throw new Error("Machine is required");
  rememberCustomStage(m);

  const before = { ...emp };
  emp.Shift = shift || emp.Shift;
  emp.Machine = m;
  saveCacheToLocalStorage();

  const row = { ...emp, CreatedAt: isoStamp(emp.CreatedAt) };
  (async () => {
    try {
      await sheetUpsert("Employees", row, "Name");
    } catch (err) {
      Object.assign(emp, before);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save changes to employee ${name} to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return row;
}

// Removed from the screen immediately; the sheet delete happens in the
// background, same pattern as Start/Stop/Restart above.
function deleteEmployee(name) {
  const snapshot = store.employees.filter((e) => String(e.Name) === String(name));
  store.employees = store.employees.filter((e) => String(e.Name) !== String(name));
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetDelete("Employees", "Name", name);
    } catch (err) {
      store.employees = store.employees.concat(snapshot);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not delete employee ${name} from the Google Sheet — undone. ${err.message}`);
    }
  })();
}

// ---------- operations ----------

function listOperations() {
  return store.operations
    .slice()
    .sort((a, b) => startKey(b).localeCompare(startKey(a)));
}

// Waiting is still open (no Y answer to "Task Completed?" yet) — it blocks
// the part elsewhere exactly like Working does, same rule as the dashboard.
const openOperationFor = (partId) =>
  store.operations.find(
    (o) => String(o.PartId) === String(partId) && (o.Status === "Working" || o.Status === "Waiting")
  ) || null;

/* Per-department status for one part — mirrors part_stage_matrix() in
 * app/backend/main.py: the last entry at each department wins, and a
 * department the part was never worked at is simply Pending. Every known
 * department (fixed + custom) gets a column even with no history yet, so
 * the matrix always shows the full picture. */
function partStageMatrix(partId) {
  const ops = store.operations
    .filter((o) => String(o.PartId) === String(partId))
    .sort((a, b) => startKey(a).localeCompare(startKey(b)));

  const byStage = {};
  ops.forEach((o) => { byStage[o.Department] = o; });

  const allStages = allKnownStages().concat(
    Object.keys(byStage).filter((s) => !allKnownStages().includes(s))
  );
  const matrix = {};
  allStages.forEach((stage) => {
    const op = byStage[stage];
    matrix[stage] = op
      ? {
          status: op.Status === "Working" || op.Status === "Waiting" ? op.Status : "Done",
          operator: op.Operator,
          start_time: `${isoDate(op.StartDate)} ${isoTime(op.StartTime)}`.trim(),
          end_time: `${isoDate(op.EndDate)} ${isoTime(op.EndTime)}`.trim(),
        }
      : { status: "Pending" };
  });
  return matrix;
}

/* Parts of a die, each with the shape the dashboard's UI expects. */
function partsWithStatus(toolId) {
  return listParts(toolId).map((p) => {
    const open = openOperationFor(p.PartId);
    return {
      part_id: p.PartId,
      name: p.Name,
      material: p.Material,
      rough_size: p.RoughSize,
      qty: p.Qty,
      current_operation_id: open ? open.Id : null,
      stages: partStageMatrix(p.PartId),
    };
  });
}

// Appends one row to OperationHistory (no key_column, so it's always ADDED,
// never overwritten) — the full Started -> Waiting -> Restarted -> ... ->
// Done trail, mirroring _log_operation_event() in app/backend/main.py. Date/
// Time on the row is THIS event's own timestamp, not the entry's original
// start time.
async function logOperationEvent(op, event) {
  const n = nowParts();
  const row = {
    ToolId: op.ToolId,
    PartId: op.PartId,
    DieName: op.DieName,
    PartName: op.PartName,
    Department: op.Department,
    Operator: op.Operator,
    Shift: op.Shift,
    WaitingCount: op.WaitingCount || 0,
    Date: n.date,
    Time: n.time,
    OpId: op.Id,
    Event: event,
    CycleNo: op.WaitingCount || 0,
  };
  try {
    await sheetUpsert("OperationHistory", row);
  } catch (_) {
    // History is a nice-to-have log — never block Start/Stop on it.
  }
}

// ---------- background sync error reporting ----------
// Start/Stop/Restart below update the on-screen table INSTANTLY from local
// state, then push the actual write to the Google Sheet in the background —
// the sheet catching up a moment later, same as how the dashboard's own
// backend answers its buttons immediately and mirrors to the sheet in a
// background thread. If a background write ultimately fails (e.g. no
// internet), the local change is undone and this callback is told why, so
// the UI can show it and re-render back to the real state.
let notifyBackgroundError = () => {};
function onBackgroundError(fn) {
  notifyBackgroundError = fn;
}

function startOperation({ toolId, partId, stage, operator }) {
  const part = findPart(partId);
  if (!part || String(part.ToolId) !== String(toolId)) throw new Error("Part not found for this die");
  if (!(stage || "").trim()) throw new Error("Department is required");

  const employee = findEmployee((operator || "").trim());
  if (!employee) throw new Error(`Unknown employee ${operator} — add them under Manage Employees first`);

  // Checked against this tablet's own local copy — instant, no network
  // round trip. Trades a rare cross-tablet race (two tablets starting the
  // same part in the same instant) for buttons that respond immediately;
  // Refresh re-syncs from the sheet if that ever actually happens.
  const open = openOperationFor(partId);
  if (open) {
    throw new Error(
      `Part ${partId} is already ${open.Status} at ${open.Department} ` +
      `(started ${isoTime(open.StartTime)}). Stop it first.`
    );
  }

  const stageName = stage.trim();
  rememberCustomStage(stageName);
  const tool = findTool(toolId);
  const n = nowParts();
  const row = {
    ToolId: toolId,
    PartId: partId,
    DieName: tool ? tool.Description : "",
    PartName: part.Name || "",
    Department: stageName,
    Operator: employee.Name,
    StartDate: n.date,
    StartTime: n.time,
    EndDate: "",
    EndTime: "",
    Shift: employee.Shift || "",
    Status: "Working",
    WaitingCount: 0,
    Id: newOperationId(),
  };

  // Shows up on screen immediately; the sheet write happens after, below.
  store.operations.push(row);
  saveCacheToLocalStorage();

  (async () => {
    try {
      // Server re-checks under a lock — the local openOperationFor() check
      // above only guards against this same tablet's own stale cache; this
      // is what actually stops two devices both winning the same Start.
      const out = await sheetStartOperation(row);
      if (out && out.ok === false) {
        store.operations = store.operations.filter((o) => o.Id !== row.Id);
        await reloadOperations();
        const c = out.conflict || {};
        notifyBackgroundError(
          `Part ${row.PartId} is already ${c.Status || "in progress"} at ${c.Department || "another department"} — someone else started it first.`
        );
        return;
      }
      await logOperationEvent(row, "Started");
    } catch (err) {
      store.operations = store.operations.filter((o) => o.Id !== row.Id);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save "Start ${row.PartId}" to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return row;
}

// completed=true (Y) -> Done, exit date/time recorded now.
// completed=false (N) -> Waiting, no exit time taken; the entry stays open
// so Restart can bring it back to Working, then Stop asks again later.
function stopOperation(opId, completed) {
  const op = store.operations.find((o) => String(o.Id) === String(opId));
  if (!op) throw new Error("That entry is no longer open — it may have been stopped elsewhere");
  if (op.Status !== "Working" && op.Status !== "Waiting") throw new Error("Entry is not currently open");

  const prevSnapshot = { ...op };
  const n = nowParts();
  if (completed) {
    op.Status = "Done";
    op.EndDate = n.date;
    op.EndTime = n.time;
  } else {
    op.Status = "Waiting";
    op.EndDate = "";
    op.EndTime = "";
    op.WaitingCount = Number(op.WaitingCount || 0) + 1;
  }
  const row = { ...op, StartDate: isoDate(op.StartDate), StartTime: isoTime(op.StartTime) };
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetUpsert("Operations", row, "Id");
      await logOperationEvent(row, completed ? "Done" : "Waiting");
    } catch (err) {
      Object.assign(op, prevSnapshot);
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save "Stop ${row.PartId}" to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return row;
}

// A Waiting entry hasn't been finished — Restart puts it back to Working so
// the operator can resume; Stop is then offered again (Task Completed? Y/N
// once more) until it's finally answered Yes.
function restartOperation(opId) {
  const op = store.operations.find((o) => String(o.Id) === String(opId));
  if (!op) throw new Error("That entry is no longer open — it may have been stopped elsewhere");
  if (op.Status !== "Waiting") throw new Error("Entry is not currently Waiting");

  const prevStatus = op.Status;
  op.Status = "Working";
  const row = { ...op, StartDate: isoDate(op.StartDate), StartTime: isoTime(op.StartTime) };
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetUpsert("Operations", row, "Id");
      await logOperationEvent(row, "Restarted");
    } catch (err) {
      op.Status = prevStatus;
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not save "Restart ${row.PartId}" to the Google Sheet — undone. ${err.message}`);
    }
  })();

  return row;
}

// Instant, same as start/stopOperation(): clears the screen right away and
// clears the Sheet tabs in the background, so there's nothing to wait on
// here. Restores the local list if the background clear fails partway.
function resetOperations() {
  const count = store.operations.length + store.outsourceEntries.length;
  const prevOperations = store.operations;
  const prevOutsourceEntries = store.outsourceEntries;

  store.operations = [];
  store.outsourceEntries = [];
  saveCacheToLocalStorage();

  (async () => {
    try {
      await sheetClear("Operations");
      try {
        await sheetClear("OperationHistory");
      } catch (_) {
        // Tab may not exist yet if no entry has ever gone through a full cycle.
      }
      try {
        await sheetClear("OutsourceEntries"); // cleared too — one "start fresh"
      } catch (_) {
        // Tab may not exist yet if nothing was ever sent out.
      }
    } catch (err) {
      store.operations = prevOperations;
      store.outsourceEntries = prevOutsourceEntries;
      saveCacheToLocalStorage();
      notifyBackgroundError(`Could not reset entries in the Google Sheet — undone. ${err.message}`);
    }
  })();

  return count;
}

// ---------- logins ----------
// Google Apps Script Web Apps have real latency — 1-3s once "warm", but the
// first request after any period of idle ("cold start") can take 8-10s. Two
// things soften that: (1) prefetchLogin() is fired as early as possible (see
// init() in app.js, right at page load — not just on the role-button tap
// used before) so that cold-start cost overlaps with the operator reading
// the role screen and typing, instead of starting only once Login is
// pressed; (2) the last successful read of each tab is cached to
// localStorage, so a device that has logged in before can validate
// INSTANTLY against that cache without waiting on the network at all, while
// still kicking off a fresh read in the background to catch a changed
// password on the next attempt.
const LOGIN_CACHE_KEY = "kolors_login_cache_v1";
let loginCache = { Admin: [], Workshop: [] };

function loadLoginCacheFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOGIN_CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    loginCache.Admin = data.Admin || [];
    loginCache.Workshop = data.Workshop || [];
  } catch (_) { /* private browsing etc. — falls back to network-only */ }
}

function saveLoginCacheToLocalStorage() {
  try {
    localStorage.setItem(LOGIN_CACHE_KEY, JSON.stringify(loginCache));
  } catch (_) { /* storage full/unavailable — cache is a nice-to-have */ }
}

const loginPrefetch = { Admin: null, Workshop: null };

// Re-fires every time this is called (page load AND every role-button tap —
// see app.js), so it can't go stale across a long-open tablet session — a
// changed password still takes effect on the very next login attempt, and
// each successful read refreshes the instant-path cache above for next time.
function prefetchLogin(tab) {
  loginPrefetch[tab] = sheetRead(tab)
    .then((rows) => {
      loginCache[tab] = rows;
      saveLoginCacheToLocalStorage();
      return rows;
    })
    .catch(() => []);
}

async function checkLoginAgainst(tab, fallback, loginId, password) {
  const matches = (rows) => rows.some(
    (r) => String(r.LoginId).trim() === String(loginId).trim() && String(r.Password) === String(password)
  );

  // Instant path — no network wait at all — for a device that has already
  // logged in successfully before.
  if (loginCache[tab].length && matches(loginCache[tab])) return true;

  let rows = [];
  try {
    rows = await (loginPrefetch[tab] || sheetRead(tab));
  } catch (_) {
    rows = [];
  }
  const valid = rows.length ? rows : (loginCache[tab].length ? loginCache[tab] : [fallback]);
  return matches(valid);
}

const checkAdminLogin = (loginId, password) =>
  checkLoginAgainst("Admin", DEFAULT_ADMIN, loginId, password);

const checkWorkshopLogin = (loginId, password) =>
  checkLoginAgainst("Workshop", DEFAULT_WORKSHOP, loginId, password);
