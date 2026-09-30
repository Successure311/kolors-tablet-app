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

// The ONLY machines/departments the app knows — the workshop's own list (same
// names as the Machine Rates sheet). Nothing typed or imported adds to it:
// import rows are matched to these names, and unmatched machines are skipped.
const FIXED_MACHINES = [
  "Conventional Lathe", "Milling Machine + Power Feeder", "Small Grinding Machine - 1",
  "Drilling Machine", "Radial Drilling Machine", "Grinding Machine - 2", "Grinding Machine - 3",
  "CNC Milling Machine", "Wirecutting Machine", "EDM Drilling Machine", "EDM Machine",
  "Wire cutting vendor -1", "Wire cutting vendor -2", "STD items", "Cylindrical grinding",
  "Tool maker charges", "Bandsaw", "Tapping Machine",
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
// The first nine mirror models.py; the rest are the unique plate names in the
// "Tool Name / Description" column of the September 2026 work log — spelling
// variants merged (BOTTAM/BOTTEM -> BOTTOM, STRIPPEER -> STRIPPER, GUIDER ->
// GUIDE, ...) and the extra words stripped (M\C, SIZE, SETTING, RE-WORK, -1/-2).
// Names only, no descriptions; names too garbled to be sure of are left out.
const PLATE_NAMES = [
  "TOP PLATE", "BOTTOM PLATE", "DIE PLATE", "PUNCH HOLDER",
  "PUNCH BACK PLATE", "STRIPPER PLATE", "STRIPPER BACK PLATE",
  "WIRE CUT PUNCH", "INSERT",
  "DIE BACK PLATE", "DIE INSERT", "DIE BLANK PLATE", "DIE PUNCH", "PUNCH",
  "STRIPPER INSERT", "STRIP GUIDE", "STRIP BLOCK", "GUIDE BLOCK", "PARALLEL BLOCK",
  "TOP SPACER", "PACKING PLATE", "BUFFER", "BASE PLATE",
  "BENDING DIE", "BENDING PUNCH", "BENDING INSERT", "BENDING PIN",
  "CUTTING PUNCH", "LANCING PUNCH", "PILOT PUNCH", "PILOT PIN", "HIT PUNCH",
  "EMBOSSING DIE", "EMBOSSING PUNCH", "EXTRUSION PUNCH", "PART OFF INSERT",
  "SLOT WEDGE", "SLOT WEDGE PUNCH", "LIFTER", "LIFTER PUNCH", "LINER", "CAM",
  "COLLAPSIBLE PLATE", "ELECTRODE", "TOOL HOLDER", "SLEEVE", "BUSH",
  "WASHER", "DOWEL PIN", "SHOULDER BOLT", "WELDING FIXTURE",
];

// Plate names that appear in the September 2026 work log, per die (Tool No.) —
// the plate step offers only these for that die (cleaned names, no descriptions).
const TOOL_PLATES = {
  "PT-003": ["DIE PLATE"],
  "PT-130": ["CUTTING PUNCH"],
  "PT-16": ["CUTTING PUNCH", "PUNCH HOLDER"],
  "PT-16M": ["PUNCH", "STRIPPER PLATE"],
  "PT-236": ["ELECTRODE"],
  "PT-256": ["TOP PLATE", "DIE PLATE", "BENDING INSERT"],
  "PT-258": ["BOTTOM PLATE", "STRIPPER PLATE", "STRIP BLOCK", "PUNCH BACK PLATE", "DIE BACK PLATE", "STRIP GUIDE", "ELECTRODE", "WELDING FIXTURE", "PARALLEL BLOCK", "DIE BLANK PLATE", "PUNCH HOLDER", "DIE INSERT", "BENDING INSERT", "PART OFF INSERT"],
  "PT-259": ["PARALLEL BLOCK"],
  "PT-260": ["PUNCH", "DIE INSERT"],
  "PT-261": ["PARALLEL BLOCK", "TOP PLATE", "BOTTOM PLATE", "DIE PLATE", "PUNCH HOLDER", "DIE BACK PLATE", "STRIPPER PLATE", "DIE INSERT", "PUNCH BACK PLATE"],
  "PT-263": ["BENDING PUNCH", "PILOT PUNCH", "PUNCH HOLDER", "PUNCH BACK PLATE", "BOTTOM PLATE", "BUFFER", "WASHER", "DIE BACK PLATE", "TOP SPACER", "DIE PLATE", "PUNCH", "HIT PUNCH", "LIFTER PUNCH", "ELECTRODE", "LANCING PUNCH", "EXTRUSION PUNCH", "LIFTER"],
  "PT-264": ["DIE BACK PLATE", "TOP PLATE", "DIE PLATE", "BUSH", "PUNCH HOLDER", "SLOT WEDGE", "SLOT WEDGE PUNCH", "COLLAPSIBLE PLATE", "SHOULDER BOLT", "BENDING PUNCH", "PUNCH", "PACKING PLATE", "STRIPPER PLATE", "BUFFER"],
  "PT-265": ["BENDING DIE", "BENDING PUNCH", "TOP SPACER", "BUFFER", "DIE BACK PLATE", "PUNCH HOLDER", "DIE PLATE", "LIFTER PUNCH", "BENDING PIN", "DIE BLANK PLATE", "LINER", "LIFTER", "PILOT PIN", "STRIPPER PLATE", "PUNCH BACK PLATE", "PUNCH"],
  "PT-280": ["DIE PLATE", "BUFFER", "PACKING PLATE", "STRIPPER INSERT", "PUNCH", "DOWEL PIN"],
  "PT-281": ["DIE PLATE", "PUNCH HOLDER", "STRIPPER PLATE", "DIE PUNCH", "BOTTOM PLATE", "STRIP GUIDE", "LINER"],
  "PT-282": ["DIE INSERT", "PUNCH HOLDER", "DIE PLATE", "STRIPPER PLATE", "STRIP GUIDE", "BOTTOM PLATE"],
  "PT-284": ["DIE PLATE", "TOP PLATE", "BOTTOM PLATE", "STRIPPER PLATE", "PUNCH HOLDER", "STRIPPER BACK PLATE"],
  "PT-285": ["TOP PLATE", "BOTTOM PLATE", "STRIPPER BACK PLATE", "PUNCH HOLDER", "DIE PLATE", "STRIPPER PLATE", "PUNCH BACK PLATE", "DIE BACK PLATE"],
  "PT-286": ["TOP PLATE", "BOTTOM PLATE", "DIE PLATE"],
  "PT-288": ["STRIPPER PLATE", "GUIDE BLOCK", "STRIPPER INSERT", "PUNCH HOLDER", "BOTTOM PLATE", "CAM", "PUNCH BACK PLATE", "WASHER", "SLEEVE"],
  "PT-289": ["BOTTOM PLATE", "TOP PLATE", "EMBOSSING PUNCH", "EMBOSSING DIE", "BASE PLATE", "DIE INSERT", "DIE PUNCH", "ELECTRODE", "CUTTING PUNCH"],
  "PT-290": ["PUNCH BACK PLATE"],
  "PT-2M": ["DIE PLATE", "PILOT PIN"],
  "PT-4M": ["STRIP GUIDE"],
  "PT-73": ["DIE INSERT"],
  "PT-84": ["STRIPPER INSERT"],
  "PT-8H": ["BOTTOM PLATE", "STRIPPER PLATE", "PUNCH HOLDER", "TOP PLATE", "GUIDE BLOCK"],
};

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
 * just sits there with no way to recover short of reloading. 15s used to be
 * the cutoff, but a genuine Apps Script cold start (the container spinning
 * up after a few idle minutes — nothing wrong with the request itself) can
 * take 16-17s on its own, measured directly against this exact endpoint —
 * long enough to trip that timeout and undo a perfectly good action (e.g.
 * Start) for no real reason. Warmed up, the same request answers in 2-3s. */
const REQUEST_TIMEOUT_MS = 28000;

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
    // never on an HTTP error. Flagged transient: the outbox below keeps a
    // queued write and retries it instead of undoing it.
    const e = new Error(err.name === "TimeoutError" ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE);
    e.transient = true;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(`${what} failed (HTTP ${res.status}).`);
    e.transient = res.status >= 500 || res.status === 429;
    throw e;
  }
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

// Same as sheetReadMany but asks the script "anything changed since version
// `since`?" (see ?since= in APPS_SCRIPT.gs). Resolves to
//   { unchanged: true, v }                 nothing to download, or
//   { v, data: {Tab: [rows...], ...} }     fresh data (v = null on an old,
//                                          not-yet-redeployed script, which
//                                          ignores ?since= and always returns
//                                          the full data — still correct,
//                                          just no saving).
async function sheetReadManyVersioned(tabs, since) {
  const res = await sheetFetch(
    `${WEBAPP_URL}?sheets=${encodeURIComponent(tabs.join(","))}&since=${encodeURIComponent(since)}`,
    undefined,
    `Reading ${tabs.join(", ")}`
  );
  const out = (await readJson(res, `reading ${tabs.join(", ")}`)) || {};
  if (Array.isArray(out)) {
    throw new Error(
      `The Google Sheet script rejected reading ${tabs.join(", ")}. It is probably the old ` +
      `version — paste APPS_SCRIPT.gs into the sheet's Apps Script editor and ` +
      `redeploy (Deploy > Manage deployments > pencil > New version).`
    );
  }
  if (out.unchanged) return { unchanged: true, v: out.v };
  const raw = out.data && typeof out.v === "number" ? out.data : out;
  const data = {};
  tabs.forEach((tab) => { data[tab] = (raw[tab] || []).map(normaliseRow); });
  return { v: typeof out.v === "number" ? out.v : null, data };
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
  if (out && out.error) {
    const e = new Error(out.error);
    e.transient = !!out.retryable; // e.g. "Server busy" — worth retrying
    throw e;
  }
  return out;
}

const upsertPayload = (tab, row, keyColumn) => ({ sheet: tab, row, key_column: keyColumn });
const batchPayload = (items) => ({ action: "batch", items });
const deletePayload = (tab, keyColumn, keyValue) =>
  ({ action: "delete", sheet: tab, key_column: keyColumn, key_value: keyValue });
const clearPayload = (tab) => ({ action: "clear", sheet: tab });

const sheetUpsert = (tab, row, keyColumn) => sheetPost(upsertPayload(tab, row, keyColumn));

// Atomic check-and-append on the server (APPS_SCRIPT.gs, under a script
// lock) — used for Start/Send-out, where two devices could otherwise both
// win the same part. Comes back {ok:false, conflict:{...}} instead of
// writing a second open row if another device already started it a moment
// earlier. See the doPost comment in APPS_SCRIPT.gs.
const sheetDelete = (tab, keyColumn, keyValue) => sheetPost(deletePayload(tab, keyColumn, keyValue));

// Many {sheet, row, key_column} upserts in ONE call — the Apps Script has
// supported this all along (APPS_SCRIPT.gs "batch"), it just had no caller
// on this side until bulk plate/part saves needed it.
const sheetBatch = (items) => sheetPost(batchPayload(items));

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

// CreatedDate/CreatedTime for a brand-new Tools/Parts/Employees/CustomStages
// row — kept as two plain fields (not one combined stamp) so the raw sheet
// matches the Date/Time-column shape used everywhere else (StartDate/
// StartTime, Date/Time on OperationHistory, ...).
function createdNow() {
  const n = nowParts();
  return { CreatedDate: n.date, CreatedTime: n.time };
}

// Keeps an existing row's CreatedDate/CreatedTime in their plain shape when
// rewriting it (same idea as StartDate/StartTime being re-sent through
// isoDate()/isoTime() below) — never invents a new creation time.
function keepCreated(row) {
  return { CreatedDate: isoDate(row.CreatedDate), CreatedTime: isoTime(row.CreatedTime) };
}

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

// ---------- outbox: every background write goes through here ----------
// Start/Stop/etc. update the screen instantly, then push the write to the
// sheet. Before, a failed push (no signal for a moment) UNDID the change and
// the operator's work was gone. Now a network failure just keeps the write
// queued and retries it — the change stays on screen, a small "N waiting to
// sync" pill shows, and it goes through when the connection is back. Only a
// real rejection by the server (or a conflict) undoes it, as before.
//
// One request at a time, in order — so a Stop can never overtake its own
// Start. Queued items are also saved to localStorage, so closing/reloading
// the app doesn't lose them (the rollback closure can't survive a reload; an
// item that then fails for real just triggers a fresh full read instead).
const OUTBOX_KEY = "kolors_outbox_v1";
const OUTBOX_BACKOFF_MS = [2000, 5000, 15000, 30000];
let outbox = [];              // {payload, label, failMsg, group, tries, rollback?, onResult?}
let outboxPromise = null;     // the running flush, if any
let outboxTimer = null;
let outboxWaiting = false;    // a backoff retry is already scheduled
let forceFullRead = false;    // next poll/refresh must download everything
let outboxListener = () => {};
const onOutboxChange = (fn) => { outboxListener = fn; };
const outboxPending = () => outbox.length;
// How long the oldest still-unsent change has been waiting (0 if none) — lets
// the screen stay completely quiet for the normal short retry and only speak
// up if something has been stuck for minutes.
const outboxOldestAgeMs = () => (outbox.length ? Date.now() - (outbox[0].queuedAt || Date.now()) : 0);

function saveOutbox() {
  try {
    if (!outbox.length) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(
      outbox.map(({ payload, label, failMsg, group, queuedAt }) => ({ payload, label, failMsg, group, queuedAt }))
    ));
  } catch (_) { /* storage unavailable — queue still works for this session */ }
  outboxListener(outbox.length);
}

function loadOutboxFromLocalStorage() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) outbox = saved.map((it) => ({ ...it, tries: 0 })).concat(outbox);
    outboxListener(outbox.length);
    if (outbox.length) flushOutbox();
  } catch (_) { /* corrupt — ignore */ }
}

// options: label/failMsg (text for the error banner), group (a failure drops
// the rest of the same group — e.g. a Start that failed for real takes its
// own queued Stop with it), rollback() (undo the on-screen change),
// onResult(out) (called with the server's answer, e.g. a Start conflict).
function queueWrite(payload, { failMsg, group, rollback, onResult } = {}) {
  outbox.push({ payload, failMsg: failMsg || "Could not save a change to the Google Sheet.", group: group || null, tries: 0, queuedAt: Date.now(), rollback, onResult });
  saveOutbox();
  // While a backoff retry is pending the connection is known to be down —
  // don't hammer it (and reset the backoff) on every new tap; the scheduled
  // retry, the "online" event, or the app coming back to the foreground
  // will send everything, in order.
  if (!outboxWaiting) flushOutbox();
}

function failOutboxItem(item, err) {
  forceFullRead = true;
  if (item.group) {
    outbox = outbox.filter((o) => o.group !== item.group);
    saveOutbox();
  }
  if (item.rollback) item.rollback();
  else loadAll().catch(() => {}).then(() => notifyBackgroundError(`${item.failMsg} ${err.message}`));
  if (item.rollback) notifyBackgroundError(`${item.failMsg} ${err.message}`);
}

function flushOutbox() {
  if (outboxPromise) return outboxPromise;
  clearTimeout(outboxTimer);
  outboxWaiting = false;
  outboxPromise = (async () => {
    try {
      while (outbox.length) {
        const item = outbox[0];
        let out;
        try {
          out = await sheetPost(item.payload);
        } catch (err) {
          if (err.transient) {
            item.tries += 1;
            outboxWaiting = true;
            outboxTimer = setTimeout(flushOutbox, OUTBOX_BACKOFF_MS[Math.min(item.tries - 1, OUTBOX_BACKOFF_MS.length - 1)]);
            return; // stays queued, on screen, retried later
          }
          outbox.shift();
          saveOutbox();
          failOutboxItem(item, err);
          continue;
        }
        outbox.shift();
        saveOutbox();
        if (item.onResult) {
          try { await item.onResult(out); } catch (_) { /* a handler bug must not wedge the queue */ }
        }
      }
    } finally {
      outboxPromise = null;
      outboxListener(outbox.length);
    }
  })();
  return outboxPromise;
}

// Waits (up to ms) for the queue to empty — used before anything that would
// REPLACE the local data with what's in the sheet, so a change that hasn't
// reached the sheet yet can't vanish from the screen.
async function drainOutbox(ms = 8000) {
  if (!outbox.length) return true;
  await Promise.race([flushOutbox(), new Promise((r) => setTimeout(r, ms))]);
  return !outbox.length;
}

window.addEventListener("online", () => { if (outbox.length) flushOutbox(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && outbox.length) flushOutbox(); });

// ---------- live version: lets a poll ask "anything new?" cheaply ----------
let liveVersion = null;

// One request for both fast-changing tabs (was one per tab). Returns true if
// store.operations/outsourceEntries were replaced. `full` skips the "unchanged"
// shortcut — used periodically because a hand edit made directly in the Sheet
// does not bump the version.
async function pollLive(full) {
  if (outbox.length) { if (!outboxWaiting) flushOutbox(); return false; }
  const since = full || forceFullRead || liveVersion === null ? -1 : liveVersion;
  const res = await sheetReadManyVersioned(LIVE_TABS, since);
  if (res.unchanged) return false;
  if (outbox.length) return false; // a write was queued mid-fetch — don't overwrite it
  const d = res.data;
  const next = {
    tools: d.Tools, parts: d.Parts, employees: d.Employees, operations: d.Operations,
    customStages: d.CustomStages, outsourceEntries: d.OutsourceEntries, childParts: d.ChildParts,
    scheduleActivities: normaliseScheduleRows(d.Schedule),
  };
  // Only swap in (and tell the screen to redraw) what actually differs, so a
  // poll that finds nothing new never disturbs what someone is typing.
  let changed = false;
  for (const k of Object.keys(next)) {
    if (JSON.stringify(store[k]) !== JSON.stringify(next[k])) { store[k] = next[k]; changed = true; }
  }
  liveVersion = res.v;
  forceFullRead = false;
  if (changed) saveCacheToLocalStorage();
  return changed;
}
const LIVE_TABS = ["Tools", "Parts", "Employees", "Operations", "CustomStages", "OutsourceEntries", "ChildParts", "Schedule"];

async function loadAll() {
  // Never replace the screen's data while changes are still waiting to reach
  // the sheet — they'd disappear until the queue catches up.
  if (!(await drainOutbox())) return;
  const res = await sheetReadManyVersioned([
    "Tools", "Parts", "Employees", "Operations", "CustomStages", "OutsourceEntries", "ChildParts",
    "Schedule",
  ], -1);
  if (outbox.length) return;
  const data = res.data;
  liveVersion = res.v;
  forceFullRead = false;
  store.tools = data.Tools;
  store.parts = data.Parts;
  store.employees = data.Employees;
  store.operations = data.Operations;
  store.customStages = data.CustomStages;
  store.outsourceEntries = data.OutsourceEntries;
  store.childParts = data.ChildParts;
  store.scheduleActivities = normaliseScheduleRows(data.Schedule);
  saveCacheToLocalStorage();
  backfillPartDieNames();
}

// One-time-per-session fill of the Parts.DieName column for rows created
// before it existed (or whose die was renamed by hand in the sheet). Only
// writes rows that actually differ, so once filled it is a no-op.
let partDieNamesChecked = false;
function backfillPartDieNames() {
  if (partDieNamesChecked) return;
  partDieNamesChecked = true;
  const stale = store.parts.filter((p) => {
    const want = dieNameOf(p.ToolId);
    return want && String(p.DieName || "") !== want;
  });
  if (!stale.length) return;
  stale.forEach((p) => { p.DieName = dieNameOf(p.ToolId); });
  saveCacheToLocalStorage();
  queueWrite(batchPayload(stale.map((p) => ({
    sheet: "Parts", row: { ...p, ...keepCreated(p) }, key_column: "PartId",
  }))), { failMsg: "Could not add die names to the Parts sheet." });
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
  return FIXED_MACHINES.slice().sort((x, y) => x.localeCompare(y));
}

// Adds it to the local list immediately (so it's a real tile right away)
// and pushes it to the sheet in the background — never makes the caller
// wait on a network round trip.
// Machines come only from FIXED_MACHINES — a name typed anywhere is never added.
function rememberCustomStage() {}

// ---------- tools ----------

const createdKey = (row) => `${row.CreatedDate || ""} ${row.CreatedTime || ""}`;

// Die number order, small to large (PT-73, PT-84, PT-130, PT-258…); ids
// without a number go last, alphabetically.
function toolNumber(t) {
  const m = /(\d+)/.exec(String(t.ToolId));
  return m ? Number(m[1]) : Infinity;
}
function listTools() {
  return store.tools
    .slice()
    .sort((a, b) => toolNumber(a) - toolNumber(b) || String(a.ToolId).localeCompare(String(b.ToolId), undefined, { numeric: true }));
}

// Parts carry the die's readable name (Tools.Description) in a DieName column,
// same denormalization as Operations/ChildParts, so the raw Parts tab shows
// which die a ToolId is — two dies can have look-alike ids (PT 288 / PT-288).
const dieNameOf = (toolId) => { const t = store.tools.find((x) => String(x.ToolId) === String(toolId)); return t ? (t.Description || "") : ""; };

const findTool = (toolId) => store.tools.find((t) => String(t.ToolId) === String(toolId)) || null;

// Instant, same as startOperation()/deletePart(): the new die (and its
// seeded Schedule rows) show up on screen right away, and the sheet write
// happens in the background, undone if it ultimately fails.
function createTool({ toolId, description, productName, typeOfProject, projectStartDate }) {
  const id = (toolId || "").trim();
  if (!id) throw new Error("Project ID is required");
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
    ...createdNow(),
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

  store.tools.push(row);
  store.scheduleActivities = store.scheduleActivities.concat(scheduleRows);
  saveCacheToLocalStorage();

  queueWrite(batchPayload(
    [{ sheet: "Tools", row, key_column: "ToolId" }].concat(
      scheduleRows.map((r) => ({ sheet: "Schedule", row: r, key_column: "Id" }))
    )
  ), {
    failMsg: `Could not save new die ${id} to the Google Sheet — undone.`,
    onResult: applyScheduleIdMap,
    rollback: () => {
      store.tools = store.tools.filter((t) => t !== row);
      store.scheduleActivities = store.scheduleActivities.filter((a) => !scheduleRows.includes(a));
      saveCacheToLocalStorage();
    },
  });

  return row;
}

// Edit a die's Description/Product Name, and optionally rename its Project ID.
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
      ...keepCreated(tool),
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

  const fields = { ...tool, ...keepCreated(tool) };

  // DieName is denormalized onto every Operations/OutsourceEntries/
  // ChildParts row for this die (so the Entries/Outsource tables and the raw
  // sheet can show a readable name without joining tables) — a Description
  // change has to refresh it on every row that already carries the old one,
  // same cascade renameTool does, just without a key change.
  const affectedOps = descChanged ? store.operations.filter((o) => String(o.ToolId) === String(toolId)) : [];
  const affectedOutsource = descChanged ? store.outsourceEntries.filter((o) => String(o.ToolId) === String(toolId)) : [];
  const affectedParts = descChanged ? store.parts.filter((p) => String(p.ToolId) === String(toolId)) : [];
  const affectedChildParts = descChanged ? store.childParts.filter((c) => String(c.ToolId) === String(toolId)) : [];
  if (descChanged) {
    affectedOps.forEach((o) => { o.DieName = fields.Description; });
    affectedOutsource.forEach((o) => { o.DieName = fields.Description; });
    affectedChildParts.forEach((c) => { c.DieName = fields.Description; });
    affectedParts.forEach((p) => { p.DieName = fields.Description; });
    saveCacheToLocalStorage();
  }

  const items = [{ sheet: "Tools", row: fields, key_column: "ToolId" }];
  affectedOps.forEach((o) => items.push({ sheet: "Operations", row: { ...o }, key_column: "Id" }));
  affectedOutsource.forEach((o) => items.push({ sheet: "OutsourceEntries", row: { ...o }, key_column: "Id" }));
  affectedChildParts.forEach((c) => items.push({ sheet: "ChildParts", row: { ...c }, key_column: "ChildId" }));
  affectedParts.forEach((p) => items.push({ sheet: "Parts", row: { ...p, ...keepCreated(p) }, key_column: "PartId" }));
  queueWrite(
    items.length > 1 ? batchPayload(items) : upsertPayload("Tools", fields, "ToolId"),
    {
      failMsg: `Could not save changes to Die ${toolId} to the Google Sheet — undone.`,
      rollback: () => {
        Object.assign(tool, before);
        affectedOps.forEach((o) => { o.DieName = before.Description; });
        affectedOutsource.forEach((o) => { o.DieName = before.Description; });
        affectedChildParts.forEach((c) => { c.DieName = before.Description; });
        affectedParts.forEach((p) => { p.DieName = before.Description; });
        saveCacheToLocalStorage();
      },
    }
  );

  return fields;
}

// Change a Tool's ToolId, moving every row that references the old id
// (Part, PartOperation, OutsourceEntry, ChildPart) along with it, mirroring
// _rename_tool() in app/backend/main.py. `fields` carries any pending
// (uncommitted) field edits from the same Save click.
async function renameTool(oldId, newId, fields) {
  await drainOutbox();
  if (findTool(newId)) throw new Error(`Project ID ${newId} already exists`);
  const tool = fields || findTool(oldId);
  if (!tool) throw new Error("Die not found");

  const renamed = { ...tool, ToolId: newId };
  const parts = store.parts.filter((p) => String(p.ToolId) === String(oldId));
  const ops = store.operations.filter((o) => String(o.ToolId) === String(oldId));
  const outsourceEntries = store.outsourceEntries.filter((o) => String(o.ToolId) === String(oldId));
  const childParts = store.childParts.filter((c) => String(c.ToolId) === String(oldId));
  const scheduleActivities = store.scheduleActivities.filter((a) => String(a.ToolId) === String(oldId));

  const items = [{ sheet: "Tools", row: renamed, key_column: "ToolId" }];
  parts.forEach((p) => items.push({ sheet: "Parts", row: { ...p, ToolId: newId, DieName: renamed.Description }, key_column: "PartId" }));
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
  await drainOutbox();
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
    DieName: tool.Description || "",
    Seq: seq,
    Name: name.trim(),
    Material: (material || "").trim(),
    RoughSize: (roughSize || "").trim(),
    Qty: Number(qty || 1) || 1,
    DesignReady: "N",
    CodeReady: "N",
    ...createdNow(),
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
    DieName: dieNameOf(part.ToolId),
    Name: name != null ? name.trim() : part.Name,
    Material: material != null ? material.trim() : part.Material,
    RoughSize: roughSize != null ? roughSize.trim() : part.RoughSize,
    Qty: qty != null ? Number(qty) || 1 : part.Qty,
    ...keepCreated(part),
  };
  await sheetUpsert("Parts", row, "PartId");
  await reloadParts();
  return row;
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

  const opts = {
    failMsg: `Could not delete part ${partId} from the Google Sheet — undone.`,
    group: `delpart:${partId}`,
    rollback: () => {
      store.parts = store.parts.concat(partSnapshot);
      store.operations = store.operations.concat(opsSnapshot);
      saveCacheToLocalStorage();
    },
  };
  queueWrite(deletePayload("Parts", "PartId", partId), opts);
  if (hadOps) queueWrite(deletePayload("Operations", "PartId", partId), opts);
}

// Add several plates at once — one Part row each, same auto-generated
// PartId scheme as addPart(), all pushed in ONE batch call. Instant, same as
// startOperation()/deletePart(): the table updates right away and the sheet
// write happens in the background, undone if it ultimately fails.
function addPartsBulk(toolId, names) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  const clean = (names || []).map((n) => (n || "").trim()).filter(Boolean);
  if (!clean.length) throw new Error("At least one plate name is required");

  const startSeq = Number(tool.NextPartSeq || 1) || 1;
  let seq = startSeq;
  const rows = clean.map((name) => {
    const row = {
      PartId: `${toolId}-P${pad(seq)}`,
      ToolId: toolId,
      DieName: tool.Description || "",
      Seq: seq,
      Name: name,
      Material: "",
      RoughSize: "",
      Qty: 1,
      DesignReady: "N",
      CodeReady: "N",
      ...createdNow(),
    };
    seq += 1;
    return row;
  });

  store.parts = store.parts.concat(rows);
  tool.NextPartSeq = seq;
  saveCacheToLocalStorage();

  queueWrite(batchPayload(
    rows.map((row) => ({ sheet: "Parts", row, key_column: "PartId" })).concat([
      { sheet: "Tools", row: { ...tool }, key_column: "ToolId" },
    ])
  ), {
    failMsg: `Could not add plates to ${toolId} in the Google Sheet — undone.`,
    rollback: () => {
      store.parts = store.parts.filter((p) => !rows.some((r) => r.PartId === p.PartId));
      tool.NextPartSeq = startSeq;
      saveCacheToLocalStorage();
    },
  });

  return rows;
}

// Save every inline-edited row of the parts table in one batch call. A row
// whose newPartId differs from its partId is a rename (the auto-generated
// Part ID typed over by hand) — handled separately via renamePart() since it
// changes the sheet's key column, not just a batch-updatable field, so
// (rare in practice) still waits on the network, same precedent as
// renameTool(). Every plain (non-rename) edit is instant: the table updates
// right away and the sheet write happens in the background, undone if it
// ultimately fails.
async function updatePartsBulk(edits) {
  const plainUpdates = [];
  const before = [];
  const renames = [];
  (edits || []).forEach((e) => {
    const part = findPart(e.partId);
    if (!part) return;
    const fields = {
      DieName: dieNameOf(part.ToolId),
      Material: e.material != null ? String(e.material).trim() : part.Material,
      RoughSize: e.roughSize != null ? String(e.roughSize).trim() : part.RoughSize,
      Qty: e.qty != null ? Number(e.qty) || 1 : part.Qty,
    };
    const newId = (e.newPartId || "").trim();
    if (newId && newId !== part.PartId) {
      renames.push({ oldId: part.PartId, newId, fields: { ...part, ...fields, ...keepCreated(part) } });
      return;
    }
    before.push({ ...part });
    Object.assign(part, fields);
    plainUpdates.push(part);
  });

  if (plainUpdates.length) {
    saveCacheToLocalStorage();
    queueWrite(batchPayload(plainUpdates.map((row) => ({
      sheet: "Parts", row: { ...row, ...keepCreated(row) }, key_column: "PartId",
    }))), {
      failMsg: "Could not save part changes to the Google Sheet — undone.",
      rollback: () => {
        plainUpdates.forEach((p, i) => Object.assign(p, before[i]));
        saveCacheToLocalStorage();
      },
    });
  }

  const renamed = [];
  for (const r of renames) {
    renamed.push(await renamePart(r.oldId, r.newId, r.fields));
  }
  return plainUpdates.concat(renamed);
}

// Change a Part's PartId, moving every row that references the old id
// (Operations, OutsourceEntries — NOT ChildParts, which is die-scoped) along
// with it, mirroring _rename_part() in app/backend/main.py. `fields` carries
// any pending (uncommitted) field edits from the same Save All click.
async function renamePart(oldId, newId, fields) {
  await drainOutbox();
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
// edits, deletions all merged into one list by the UI). Instant, same as
// deletePart()/addPartsBulk(): the table updates right away and the sheet
// write (delete-all-then-recreate) happens in the background, undone if it
// ultimately fails.
function saveChildParts(toolId, rows) {
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

  const before = store.childParts;
  store.childParts = before.filter((c) => String(c.ToolId) !== String(toolId)).concat(built);
  saveCacheToLocalStorage();

  const opts = {
    failMsg: `Could not save child parts for ${toolId} to the Google Sheet — undone.`,
    group: `childparts:${toolId}`,
    rollback: () => {
      store.childParts = before;
      saveCacheToLocalStorage();
    },
  };
  queueWrite(deletePayload("ChildParts", "ToolId", toolId), opts);
  if (built.length) {
    queueWrite(batchPayload(built.map((row) => ({ sheet: "ChildParts", row, key_column: "ChildId" }))), opts);
  }

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

// A new schedule activity gets a temporary "T-..." id here (it's needed before
// the sheet has answered). The script replaces it with the next plain number
// (1, 2, 3 ... across the whole Schedule tab — see scheduleNumericId in
// APPS_SCRIPT.gs) and sends the mapping back; this adopts the real number so
// later saves/deletes use it. Until then the script matches a temporary id to
// its row by die + activity, so nothing queued in between goes astray.
function applyScheduleIdMap(out) {
  const map = out && out.idMap;
  if (!map) return;
  let changed = false;
  store.scheduleActivities.forEach((a) => {
    const real = map[a.Id];
    if (real !== undefined && String(real) !== String(a.Id)) { a.Id = real; changed = true; }
  });
  if (changed) saveCacheToLocalStorage();
}

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
// time instead (see listScheduleActivities() above). Instant, same as
// addPartsBulk(): the table updates right away and the sheet write happens
// in the background, undone if it ultimately fails.
function addScheduleBulk(toolId, names) {
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

  store.scheduleActivities = store.scheduleActivities.concat(created);
  saveCacheToLocalStorage();

  queueWrite(batchPayload(created.map((row) => ({ sheet: "Schedule", row, key_column: "Id" }))), {
    failMsg: `Could not add schedule activities for ${toolId} to the Google Sheet — undone.`,
    onResult: applyScheduleIdMap,
    rollback: () => {
      store.scheduleActivities = store.scheduleActivities.filter((a) => !created.includes(a));
      saveCacheToLocalStorage();
    },
  });

  return created;
}

// Instant, same as deletePart()/deleteEmployee(): removed from the screen
// right away, and the sheet delete happens in the background, undone if it
// ultimately fails.
function deleteScheduleActivity(id) {
  const snapshot = store.scheduleActivities.filter((a) => String(a.Id) === String(id));
  store.scheduleActivities = store.scheduleActivities.filter((a) => String(a.Id) !== String(id));
  saveCacheToLocalStorage();

  queueWrite(deletePayload("Schedule", "Id", id), {
    failMsg: "Could not delete schedule activity from the Google Sheet — undone.",
    rollback: () => {
      store.scheduleActivities = store.scheduleActivities.concat(snapshot);
      saveCacheToLocalStorage();
    },
  });
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
// the APPS_SCRIPT.gs file header for the full story. Instant, same as
// updatePartStatus(): the grid and the Tool's remembered range update right
// away, and the sheet write happens in the background, undone if it
// ultimately fails.
function saveScheduleMarkRange(toolId, start, end, marksByDate) {
  const tool = findTool(toolId);
  if (!tool) throw new Error("Die not found");
  const activities = listScheduleActivities(toolId);
  const changedActivities = new Set();
  const beforeByActivity = new Map(); // activity -> {changedKey: oldValue, ...}

  Object.keys(marksByDate).forEach((iso) => {
    const checkedIds = new Set((marksByDate[iso] || []).map(String));
    const key = dateHeaderKey(iso);
    activities.forEach((activity) => {
      const shouldBePlanned = checkedIds.has(String(activity.Id));
      const alreadyPlanned = activity[key] === "P";
      if (shouldBePlanned === alreadyPlanned) return;
      if (!beforeByActivity.has(activity)) beforeByActivity.set(activity, {});
      beforeByActivity.get(activity)[key] = activity[key];
      activity[key] = shouldBePlanned ? "P" : "";
      changedActivities.add(activity);
    });
  });

  const beforeRange = { ScheduleRangeStart: tool.ScheduleRangeStart, ScheduleRangeEnd: tool.ScheduleRangeEnd };
  tool.ScheduleRangeStart = start;
  tool.ScheduleRangeEnd = end;
  saveCacheToLocalStorage();

  const items = Array.from(changedActivities).map((row) => ({ sheet: "Schedule", row: { ...row }, key_column: "Id" }));
  items.push({ sheet: "Tools", row: { ...tool }, key_column: "ToolId" });

  queueWrite(batchPayload(items), {
    failMsg: `Could not save schedule changes for ${toolId} to the Google Sheet — undone.`,
    onResult: applyScheduleIdMap,
    rollback: () => {
      beforeByActivity.forEach((oldVals, activity) => Object.assign(activity, oldVals));
      Object.assign(tool, beforeRange);
      saveCacheToLocalStorage();
    },
  });
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

  queueWrite({ action: "start_outsource", sheet: "OutsourceEntries", row }, {
    failMsg: `Could not save "Send out ${row.PartId}" to the Google Sheet — undone.`,
    group: `out:${row.Id}`,
    rollback: () => {
      store.outsourceEntries = store.outsourceEntries.filter((e) => e.Id !== row.Id);
      saveCacheToLocalStorage();
    },
    onResult: async (out) => {
      if (!out || out.ok !== false) return;
      store.outsourceEntries = store.outsourceEntries.filter((e) => e.Id !== row.Id);
      await reloadOutsourceEntries().catch(() => {});
      const c = out.conflict || {};
      notifyBackgroundError(
        `Part ${row.PartId} is already OutSource${c.Place ? ` at ${c.Place}` : ""} — someone else sent it out first.`
      );
    },
  });

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

  queueWrite(upsertPayload("OutsourceEntries", { ...entry }, "Id"), {
    failMsg: `Could not save "Return ${entry.PartId}" to the Google Sheet — undone.`,
    group: `out:${entry.Id}`,
    rollback: () => {
      Object.assign(entry, before);
      saveCacheToLocalStorage();
    },
  });

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

  const row = { ...part, ...keepCreated(part) };
  queueWrite(upsertPayload("Parts", row, "PartId"), {
    failMsg: `Could not save status for part ${partId} to the Google Sheet — undone.`,
    rollback: () => {
      Object.assign(part, before);
      saveCacheToLocalStorage();
    },
  });

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

// Instant, same as updateEmployee()/deleteEmployee(): the new employee shows
// up in the list right away and the sheet write happens in the background,
// undone if it ultimately fails.
function createEmployee(name, shift, machine) {
  const n = (name || "").trim();
  if (!n) throw new Error("Name is required");
  if (!SHIFTS.includes(shift)) throw new Error("Unknown shift");
  const m = (machine || "").trim();
  if (!m) throw new Error("Machine is required");
  if (findEmployee(n)) throw new Error(`Employee ${n} already exists`);
  rememberCustomStage(m);
  const row = { Name: n, Shift: shift, Machine: m, ...createdNow() };

  store.employees.push(row);
  saveCacheToLocalStorage();

  queueWrite(upsertPayload("Employees", { ...row }, "Name"), {
    failMsg: `Could not save new employee ${n} to the Google Sheet — undone.`,
    rollback: () => {
      store.employees = store.employees.filter((e) => e !== row);
      saveCacheToLocalStorage();
    },
  });

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

  const row = { ...emp, ...keepCreated(emp) };
  queueWrite(upsertPayload("Employees", row, "Name"), {
    failMsg: `Could not save changes to employee ${name} to the Google Sheet — undone.`,
    rollback: () => {
      Object.assign(emp, before);
      saveCacheToLocalStorage();
    },
  });

  return row;
}

// Removed from the screen immediately; the sheet delete happens in the
// background, same pattern as Start/Stop/Restart above.
function deleteEmployee(name) {
  const snapshot = store.employees.filter((e) => String(e.Name) === String(name));
  store.employees = store.employees.filter((e) => String(e.Name) !== String(name));
  saveCacheToLocalStorage();

  queueWrite(deletePayload("Employees", "Name", name), {
    failMsg: `Could not delete employee ${name} from the Google Sheet — undone.`,
    rollback: () => {
      store.employees = store.employees.concat(snapshot);
      saveCacheToLocalStorage();
    },
  });
}

// ---------- operations ----------

function listOperations() {
  return store.operations
    .slice()
    .sort((a, b) => startKey(b).localeCompare(startKey(a)));
}

// Setup (setup started, actual work not yet started) and Waiting (no Y
// answer to "Task Completed?" yet) are both still open — they block the part
// elsewhere exactly like Working does, same rule as the dashboard.
const openOperationFor = (partId) =>
  store.operations.find(
    (o) => String(o.PartId) === String(partId) &&
      (o.Status === "Setup" || o.Status === "Working" || o.Status === "Waiting")
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
          status: op.Status === "Setup" || op.Status === "Working" || op.Status === "Waiting" ? op.Status : "Done",
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

// Builds the OperationHistory row (always ADDED by the script, never
// overwritten) — sent in the SAME request as the Operations write (see the
// "history" field in APPS_SCRIPT.gs) instead of as a second request. The full Started -> Waiting -> Restarted -> ... ->
// Done trail, mirroring _log_operation_event() in app/backend/main.py. Date/
// Time on the row is THIS event's own timestamp, not the entry's original
// start time.
function buildHistoryRow(op, event) {
  const n = nowParts();
  return {
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

// `shift` (optional) overrides the employee's own shift — the same operator can work either shift on a machine.
function startOperation({ toolId, partId, stage, operator, shift }) {
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
    Shift: shift || employee.Shift || "",
    Status: "Setup",
    WaitingCount: 0,
    Id: newOperationId(),
  };

  // Shows up on screen immediately; the sheet write happens after, below.
  store.operations.push(row);
  saveCacheToLocalStorage();

  // Server re-checks under a lock — the local openOperationFor() check above
  // only guards against this same tablet's own stale cache; this is what
  // actually stops two devices both winning the same Start. One request: it
  // also appends the "Setup" history row — the operator hasn't started the
  // timed production run yet, just tool/machine setup (see
  // startActualWorkOperation() below for the Setup -> Working step).
  queueWrite({
    action: "start_operation", sheet: "Operations", row, history: buildHistoryRow(row, "Setup"),
  }, {
    failMsg: `Could not save "Setup Start ${row.PartId}" to the Google Sheet — undone.`,
    group: `op:${row.Id}`,
    rollback: () => {
      store.operations = store.operations.filter((o) => o.Id !== row.Id);
      saveCacheToLocalStorage();
    },
    onResult: async (out) => {
      if (!out || out.ok !== false) return;
      store.operations = store.operations.filter((o) => o.Id !== row.Id);
      await reloadOperations().catch(() => {}); // best effort — the message below matters more
      const c = out.conflict || {};
      notifyBackgroundError(
        `Part ${row.PartId} is already ${c.Status || "in progress"} at ${c.Department || "another department"} — someone else started it first.`
      );
    },
  });

  return row;
}

// Setup -> Working: the operator has finished machine/tool setup and is now
// starting the timed production run. Everything after this (Stop, the Y/N
// "Task Completed?" popover, Waiting/Restart) behaves exactly as it already
// did for a Working entry — this only changes what happens BEFORE that.
function startActualWorkOperation(opId) {
  const op = store.operations.find((o) => String(o.Id) === String(opId));
  if (!op) throw new Error("That entry is no longer open — it may have been stopped elsewhere");
  if (op.Status !== "Setup") throw new Error("Entry is not currently in Setup");

  const prevStatus = op.Status;
  op.Status = "Working";
  const row = { ...op, StartDate: isoDate(op.StartDate), StartTime: isoTime(op.StartTime) };
  saveCacheToLocalStorage();

  queueWrite({
    action: "op_update", sheet: "Operations", row, key_column: "Id",
    history: buildHistoryRow(row, "Started"),
  }, {
    failMsg: `Could not save "Start Actual Work ${row.PartId}" to the Google Sheet — undone.`,
    group: `op:${row.Id}`,
    rollback: () => {
      op.Status = prevStatus;
      saveCacheToLocalStorage();
    },
  });

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

  queueWrite({
    action: "op_update", sheet: "Operations", row, key_column: "Id",
    history: buildHistoryRow(row, completed ? "Done" : "Waiting"),
  }, {
    failMsg: `Could not save "Stop ${row.PartId}" to the Google Sheet — undone.`,
    group: `op:${row.Id}`,
    rollback: () => {
      Object.assign(op, prevSnapshot);
      saveCacheToLocalStorage();
    },
  });

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

  queueWrite({
    action: "op_update", sheet: "Operations", row, key_column: "Id",
    history: buildHistoryRow(row, "Restarted"),
  }, {
    failMsg: `Could not save "Restart ${row.PartId}" to the Google Sheet — undone.`,
    group: `op:${row.Id}`,
    rollback: () => {
      op.Status = prevStatus;
      saveCacheToLocalStorage();
    },
  });

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

  // A tab that doesn't exist yet clears as a harmless no-op on the server.
  const opts = {
    failMsg: "Could not reset entries in the Google Sheet — undone.",
    group: "reset",
    rollback: () => {
      store.operations = prevOperations;
      store.outsourceEntries = prevOutsourceEntries;
      saveCacheToLocalStorage();
    },
  };
  queueWrite(clearPayload("Operations"), opts);
  queueWrite(clearPayload("OperationHistory"), opts);
  queueWrite(clearPayload("OutsourceEntries"), opts); // cleared too — one "start fresh"

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

// ---------- one-time import from the monthly Excel/CSV work log ----------
// Fills Operations (work entries), Parts (one per die + plate name, IDs
// continuing the die's own sequence), Tools (new dies only), CustomStages
// (unique machine names -> tiles on the Entry page) and Employees (unique
// operators, one machine + shift each, same as the dashboard) from a workbook
// shaped like "September 2026.xlsx". buildImportPlan() is pure — nothing is
// written until runImport(). Every row runImport() creates carries an
// ImportBatch tag, so revertImport() can remove exactly that import again
// (a delete-by-ImportBatch is ONE request per tab).

const IMPORT_BATCH_COL = "ImportBatch";
const IMPORT_TOOL_ID_RE = /^PT-\d+[A-Z]?$/;
const IMPORT_SKIP_TOOL_RE = /^(no\s*(work|pt)|not\s+(a\s+)?pt|pending)/i;
// Cost/vendor lines in the log, not shop-floor machines — skipped unless asked for.
const IMPORT_NON_MACHINE_KEYS = ["stditems", "toolmakercharges", "wirecuttingvendor1", "wirecuttingvendor2"];
// Spelling variants of ONE machine (compared after importKey()).
const IMPORT_MACHINE_ALIASES = { bandsawcutting: "bandsaw", tappinghmachine: "tappingmachine" };
// Spelling variants of ONE person (compared after importKey()); anything not
// listed keeps its own (title-cased) name and can be renamed in the preview.
const IMPORT_NAME_ALIASES = {
  lavhans: "Lavhans", labhans: "Lavhans", lovhans: "Lavhans", lavhan: "Lavhans",
  subhash: "Subhash", shubhash: "Subhash", subhashkumar: "Subhash", shubhashkumar: "Subhash",
  kandhaiya: "Kandhaiya", kandhiya: "Kandhaiya",
  mahender: "Mahender", mahendar: "Mahender", mhender: "Mahender", maheder: "Mahender", mahinder: "Mahender",
  sonuraj: "Sonu Raj", sukindar: "Sukindar", sukinder: "Sukindar",
  anand: "Anand", aanand: "Anand",
};

// The fixed-list machine whose (alias-merged) key matches, else "".
const importFixedMachine = (mk) => FIXED_MACHINES.find((m) => importMachineKey(m) === mk) || "";

const importClean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const importKey = (s) => importClean(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const importTitle = (s) => importClean(s).toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, c) => a + c.toUpperCase());

function importToolId(raw) {
  const s = importClean(raw);
  if (!s || IMPORT_SKIP_TOOL_RE.test(s)) return "";
  return s.replace(/^pt[\s-]+/i, "PT-").toUpperCase();
}

function importMachineKey(raw) {
  const k = importKey(raw);
  return IMPORT_MACHINE_ALIASES[k] || k;
}

function importOperatorName(raw, overrides) {
  const s = importClean(String(raw == null ? "" : raw).split(/[,\\/]/)[0]);
  const k = importKey(s);
  if (!k || /^(nowork|na|none|nil)$/.test(k)) return "";
  const canon = IMPORT_NAME_ALIASES[k] || importTitle(s);
  return (overrides && overrides[canon]) || canon;
}

function importShift(v) {
  const s = importClean(v).toUpperCase().charAt(0);
  return SHIFTS.includes(s) ? s : "";
}

// Excel Date / serial number / "2026-09-02 10:30" / "02-09-2026 10:30" -> Date,
// rounded to the minute (SheetJS can be a few seconds off). Null if unusable.
function importDateTime(v) {
  if (v == null || v === "") return null;
  let d = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) d = new Date(p.y, p.m - 1, p.d, p.H, p.M, p.S);
  } else {
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    else {
      m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/.exec(s);
      if (m) {
        let y = +m[3]; if (y < 100) y += 2000;
        let h = +m[4];
        if (m[7]) { const pm = /p/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
        d = new Date(y, +m[2] - 1, +m[1], h, +m[5], +(m[6] || 0));
      }
    }
  }
  if (!d || isNaN(d.getTime()) || d.getFullYear() < 2000) return null; // time-only cells are 1899
  return new Date(Math.round(d.getTime() / 60000) * 60000);
}
const importDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const importTimeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

function importHash(str) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    a = Math.imul(a ^ str.charCodeAt(i), 16777619) >>> 0;
    b = Math.imul(b + str.charCodeAt(i), 2246822519) >>> 0;
    b = (b ^ (b >>> 15)) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

const importTop = (counts) => {
  let best = null, n = -1;
  Object.keys(counts).forEach((k) => { if (counts[k] > n) { best = k; n = counts[k]; } });
  return best;
};
const importBump = (obj, key, by = 1) => { obj[key] = (obj[key] || 0) + by; };

// Every sheet of the file as { name, rows: [[cell,...],...] } — dates kept as Date objects.
function readWorkbookFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result), { type: "array", cellDates: true });
        resolve(wb.SheetNames.map((name) => ({
          name,
          rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }),
        })));
      } catch (err) {
        reject(new Error("Could not read that file — upload a .csv, .xls or .xlsx file."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

const importFind = (keys, exact, prefixes) => {
  let i = keys.findIndex((k) => exact.includes(k));
  if (i < 0 && prefixes) i = keys.findIndex((k) => prefixes.some((p) => k.startsWith(p)));
  return i;
};

// The work-log sheet: a header row (within the first 10 rows) with Tool No.,
// a machine column and a Start Time column.
function importFindLogSheet(sheets) {
  for (const s of sheets) {
    for (let r = 0; r < Math.min(10, s.rows.length); r++) {
      const keys = (s.rows[r] || []).map(importKey);
      const c = {
        tool: importFind(keys, ["toolno", "toolnumber", "toolid", "dieno", "dieid"]),
        plate: importFind(keys, ["platename", "partname", "description"], ["toolname", "platename", "partname"]),
        machine: importFind(keys, ["machineprocess", "machine", "department", "process"]),
        shift: importFind(keys, ["shiftt", "shift"]),
        operator: importFind(keys, ["operator", "employee", "worker"]),
        start: importFind(keys, ["starttime", "startdatetime", "start"]),
        end: importFind(keys, ["endtime", "enddatetime", "end"]),
      };
      if (c.tool >= 0 && c.machine >= 0 && c.start >= 0) return { sheet: s, cols: c, dataFrom: r + 1 };
    }
  }
  return null;
}

// The "Machine | Shift | Operator" list (operators comma-separated in one cell).
function importFindOperatorSheet(sheets, skipName) {
  for (const s of sheets) {
    if (s.name === skipName) continue;
    for (let r = 0; r < Math.min(5, s.rows.length); r++) {
      const keys = (s.rows[r] || []).map(importKey);
      const m = importFind(keys, ["mchine", "machine"]);
      const sh = importFind(keys, ["shift"]);
      const op = importFind(keys, ["operator", "operators"]);
      if (m >= 0 && sh >= 0 && op >= 0) return { sheet: s, m, sh, op, dataFrom: r + 1 };
    }
  }
  return null;
}

// Machine display names from a "Machine Rates"-style sheet (canonical spellings).
function importRateNames(sheets) {
  const out = {};
  const s = sheets.find((x) => /rate/i.test(x.name));
  if (!s || !s.rows.length) return out;
  const keys = s.rows[0].map(importKey);
  let col = keys.indexOf("machineprocess");
  if (col < 0) col = 1;
  s.rows.slice(1).forEach((r) => {
    const name = importClean(r && r[col]);
    if (name) out[importMachineKey(name)] = name;
  });
  return out;
}

// opts: { includeNonMachines, includeReview, includeOddTools, nameOverrides: {canonName: newName} }
function buildImportPlan(sheets, opts = {}) {
  const log = importFindLogSheet(sheets);
  if (!log) throw new Error("Could not find the work-log sheet — it needs Tool No., Machine / Process and Start Time columns.");
  const c = log.cols;
  const rateNames = importRateNames(sheets);
  const overrides = opts.nameOverrides || {};

  // ---- pass 1: parse + tally spellings ----
  const skipped = { noTool: 0, oddTool: 0, noStart: 0, noMachine: 0, unknownMachine: 0, nonMachine: 0, duplicate: 0 };
  const oddTools = {};
  const parsed = [];
  const machineSpell = {}, plateSpell = {};
  log.sheet.rows.slice(log.dataFrom).forEach((r) => {
    if (!r || !r.some((x) => x != null && x !== "")) return;
    const toolId = importToolId(r[c.tool]);
    if (!toolId) { skipped.noTool += 1; return; }
    // The Tool No. column also holds free text ("PRESS MACHINE", "KOSMIK"…) —
    // only PT-<number> style ids are real dies unless the admin opts in.
    if (!opts.includeOddTools && !IMPORT_TOOL_ID_RE.test(toolId)) {
      skipped.oddTool += 1; importBump(oddTools, toolId); return;
    }
    const start = importDateTime(r[c.start]);
    if (!start) { skipped.noStart += 1; return; }
    const machRaw = importClean(r[c.machine]);
    const mk = importMachineKey(machRaw);
    if (!mk) { skipped.noMachine += 1; return; }
    if (!importFixedMachine(mk)) { skipped.unknownMachine += 1; return; }
    if (IMPORT_NON_MACHINE_KEYS.includes(mk) && !opts.includeNonMachines) { skipped.nonMachine += 1; return; }
    const plateRaw = c.plate >= 0 ? importClean(r[c.plate]) : "";
    const plateKey = importKey(plateRaw) || "unnamed";
    importBump(machineSpell[mk] = machineSpell[mk] || {}, machRaw);
    importBump(plateSpell[toolId + "|" + plateKey] = plateSpell[toolId + "|" + plateKey] || {}, plateRaw || "UNNAMED");
    parsed.push({
      toolId, plateKey, mk, start,
      end: importDateTime(c.end >= 0 ? r[c.end] : null),
      shift: c.shift >= 0 ? importShift(r[c.shift]) : "",
      operator: c.operator >= 0 ? importOperatorName(r[c.operator], overrides) : "",
    });
  });

  // ---- machines: existing spelling > "Machine Rates" spelling > most frequent ----
  const machineName = importFixedMachine;

  // ---- employees: log tallies + the Machine/Shift/Operator list ----
  const tally = {}; // name -> { mk -> { n, shifts:{A,B} } }
  parsed.forEach((p) => {
    if (!p.operator) return;
    const byM = tally[p.operator] = tally[p.operator] || {};
    const e = byM[p.mk] = byM[p.mk] || { n: 0, shifts: {} };
    e.n += 1;
    if (p.shift) importBump(e.shifts, p.shift);
  });
  const listed = {}; // name -> [{ mk, shift }] in file order
  const opSheet = importFindOperatorSheet(sheets, log.sheet.name);
  if (opSheet) {
    opSheet.sheet.rows.slice(opSheet.dataFrom).forEach((r) => {
      const mk = importMachineKey(r && r[opSheet.m]);
      const shift = importShift(r && r[opSheet.sh]);
      if (!mk || !shift || !r[opSheet.op]) return;
      if (IMPORT_NON_MACHINE_KEYS.includes(mk) && !opts.includeNonMachines) return;
      String(r[opSheet.op]).split(/[,\\/]/).forEach((part) => {
        const name = importOperatorName(part, overrides);
        if (name) (listed[name] = listed[name] || []).push({ mk, shift });
      });
    });
  }
  const knownMachines = new Set(parsed.map((p) => p.mk));
  Object.keys(rateNames).forEach((mk) => {
    if (!IMPORT_NON_MACHINE_KEYS.includes(mk) || opts.includeNonMachines) knownMachines.add(mk);
  });

  const employees = [];
  const finalName = {};
  Array.from(new Set(Object.keys(tally).concat(Object.keys(listed)))).sort().forEach((name) => {
    let mk = "", shift = "";
    if (tally[name]) {
      const counts = {};
      Object.keys(tally[name]).forEach((k) => { counts[k] = tally[name][k].n; });
      mk = importTop(counts);
      shift = importTop(tally[name][mk].shifts) || "";
    }
    const lst = (listed[name] || []).filter((x) => importFixedMachine(x.mk));
    if (!mk && lst.length) mk = lst[0].mk;
    if (!mk) return;
    if (!shift) {
      const same = lst.filter((x) => x.mk === mk);
      shift = same.some((x) => x.shift === "A") ? "A" : (same[0] ? same[0].shift : "A");
    }
    const existing = store.employees.find((e) => importKey(e.Name) === importKey(name));
    finalName[name] = existing ? existing.Name : name;
    employees.push({ canon: name, name: finalName[name], mk, machine: machineName(mk), shift, isNew: !existing });
  });
  const shiftOfEmployee = {};
  employees.forEach((e) => { shiftOfEmployee[e.canon] = e.shift; });

  // ---- dies + plates (PartId continues each die's own sequence) ----
  const toolInfo = {}; // toolId -> { tool, isNew, seq, parts:{plateKey:{partId,name,isNew,seq}} }
  const partsOut = [];
  parsed.forEach((p) => {
    let ti = toolInfo[p.toolId];
    if (!ti) {
      const tool = store.tools.find((t) => String(t.ToolId).toUpperCase() === p.toolId) || null;
      ti = toolInfo[p.toolId] = {
        tool, isNew: !tool, id: tool ? tool.ToolId : p.toolId,
        seq: tool ? (Number(tool.NextPartSeq || 1) || 1) : 1, parts: {},
      };
    }
    if (!ti.parts[p.plateKey]) {
      const name = importTop(plateSpell[p.toolId + "|" + p.plateKey]);
      const old = ti.tool && store.parts.find((x) => String(x.ToolId) === String(ti.id) && importKey(x.Name) === p.plateKey);
      if (old) ti.parts[p.plateKey] = { partId: old.PartId, name: old.Name, isNew: false };
      else {
        let partId;
        do { partId = `${ti.id}-P${pad(ti.seq)}`; ti.seq += 1; } while (findPart(partId));
        ti.parts[p.plateKey] = { partId, name, isNew: true, seq: ti.seq - 1, toolId: ti.id };
        partsOut.push(ti.parts[p.plateKey]);
      }
    }
  });

  // ---- operations ----
  const seen = new Set();
  const operations = [], review = [];
  parsed.forEach((p) => {
    const ti = toolInfo[p.toolId], part = ti.parts[p.plateKey];
    const startStr = `${importDateStr(p.start)} ${importTimeStr(p.start)}`;
    const id = "IMP-" + importHash(`${p.toolId}|${p.plateKey}|${p.mk}|${startStr}|${p.operator}`);
    if (seen.has(id)) { skipped.duplicate += 1; return; }
    seen.add(id);
    const row = {
      ToolId: ti.id, PartId: part.partId,
      DieName: ti.tool ? (ti.tool.Description || ti.id) : ti.id,
      PartName: part.name,
      Department: machineName(p.mk),
      Operator: finalName[p.operator] || p.operator,
      StartDate: importDateStr(p.start), StartTime: importTimeStr(p.start),
      EndDate: p.end ? importDateStr(p.end) : "", EndTime: p.end ? importTimeStr(p.end) : "",
      Shift: p.shift || shiftOfEmployee[p.operator] || "",
      Status: p.end ? "Done" : "Working",
      WaitingCount: 0, Id: id,
    };
    if (p.end && p.end < p.start) { review.push(row); if (!opts.includeReview) return; }
    operations.push(row);
  });

  // ---- machines actually used ----
  const machineCount = {};
  operations.forEach((o) => importBump(machineCount, o.Department));
  employees.forEach((e) => { if (!(e.machine in machineCount)) machineCount[e.machine] = 0; });
  const machines = Object.keys(machineCount).sort().map((name) => ({
    name, count: machineCount[name], isNew: false,
  }));
  const nonMachines = Object.keys(machineSpell).filter((mk) => IMPORT_NON_MACHINE_KEYS.includes(mk)).map((mk) => machineName(mk));

  return {
    machines, employees, operations, review, skipped, nonMachines, oddTools: Object.keys(oddTools),
    tools: Object.keys(toolInfo).map((k) => ({ id: toolInfo[k].id, isNew: toolInfo[k].isNew, nextSeq: toolInfo[k].seq })),
    parts: partsOut,
    totals: {
      operations: operations.length,
      newMachines: machines.filter((m) => m.isNew).length,
      newEmployees: employees.filter((e) => e.isNew).length,
      newTools: Object.keys(toolInfo).filter((k) => toolInfo[k].isNew).length,
      newParts: partsOut.length,
    },
  };
}

// Transient failures ("Server busy", or offline) retried a few times.
async function importPost(payload) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await sheetPost(payload);
    } catch (err) {
      if (!err.transient || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// A tab that never got an ImportBatch column has nothing of this import in it.
async function importDeleteQuiet(payload) {
  try {
    return await importPost(payload);
  } catch (err) {
    if (/unknown column/i.test(err.message || "")) return null;
    throw err;
  }
}

async function importChunks(items, size, onStep) {
  for (let i = 0; i < items.length; i += size) {
    await importPost(batchPayload(items.slice(i, i + size)));
    if (onStep) onStep(Math.min(i + size, items.length), items.length);
  }
}

async function runImport(plan, onProgress) {
  const say = (s) => { if (onProgress) onProgress(s); };
  if (!plan.operations.length && !plan.employees.some((e) => e.isNew)) throw new Error("Nothing to import.");
  if (!(await drainOutbox(60000))) throw new Error("Earlier changes are still waiting to sync — try again in a moment.");

  const d = new Date();
  const batch = `IMP-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const tag = { [IMPORT_BATCH_COL]: batch };

  // New dies go through the normal path so they also get their Project Schedule rows.
  const newTools = plan.tools.filter((t) => t.isNew);
  newTools.forEach((t) => createTool({ toolId: t.id, description: t.id }));
  say(`dies (${newTools.length})`);
  if (!(await drainOutbox(120000)) || newTools.some((t) => !findTool(t.id))) {
    throw new Error("Could not create the new dies in the Google Sheet.");
  }

  // Existing operations keep the batch they were first imported under.
  const opById = {};
  store.operations.forEach((o) => { opById[o.Id] = o; });

  const stageRows = plan.machines.filter((m) => m.isNew).map((m) => ({ Name: m.name, ...createdNow(), ...tag }));
  const empRows = plan.employees.filter((e) => e.isNew)
    .map((e) => ({ Name: e.name, Shift: e.shift, Machine: e.machine, ...createdNow(), ...tag }));
  const partRows = plan.parts.map((p) => {
    const tool = findTool(p.toolId);
    return {
      PartId: p.partId, ToolId: p.toolId, DieName: tool ? tool.Description || "" : "", Seq: p.seq, Name: p.name,
      Material: "", RoughSize: "", Qty: 1, DesignReady: "N", CodeReady: "N", ...createdNow(), ...tag,
    };
  });
  const toolRows = plan.tools.filter((t) => t.isNew || partRows.some((p) => p.ToolId === t.id))
    .map((t) => ({ ToolId: t.id, NextPartSeq: t.nextSeq, ...(t.isNew ? tag : {}) }));
  const opRows = plan.operations.map((o) => {
    const old = opById[o.Id];
    return { ...o, ...(old ? (old[IMPORT_BATCH_COL] ? { [IMPORT_BATCH_COL]: old[IMPORT_BATCH_COL] } : {}) : tag) };
  });

  say("machines, operators, plates");
  await importChunks(
    stageRows.map((r) => ({ sheet: "CustomStages", row: r, key_column: "Name" }))
      .concat(empRows.map((r) => ({ sheet: "Employees", row: r, key_column: "Name" })))
      .concat(partRows.map((r) => ({ sheet: "Parts", row: r, key_column: "PartId" })))
      .concat(toolRows.map((r) => ({ sheet: "Tools", row: r, key_column: "ToolId" }))),
    150
  );
  say("entries 0/" + opRows.length);
  await importChunks(opRows.map((r) => ({ sheet: "Operations", row: r, key_column: "Id" })), 150,
    (n, total) => say(`entries ${n}/${total}`));

  // Local copy updated too, so the app is usable immediately without a re-download.
  stageRows.forEach((r) => store.customStages.push(r));
  empRows.forEach((r) => store.employees.push(r));
  partRows.forEach((r) => store.parts.push(r));
  toolRows.forEach((r) => {
    const tool = findTool(r.ToolId);
    if (tool) Object.assign(tool, r);
  });
  opRows.forEach((r) => {
    const i = store.operations.findIndex((o) => o.Id === r.Id);
    if (i >= 0) store.operations[i] = r; else store.operations.push(r);
  });
  saveCacheToLocalStorage();

  say("status board");
  try { await importPost({ action: "rebuild_part_status" }); } catch (_) { /* mirror only */ }

  return {
    batch, operations: opRows.length, parts: partRows.length, employees: empRows.length,
    machines: stageRows.length, tools: newTools.length,
  };
}

// The newest ImportBatch present anywhere in the app's data (survives reloads
// and works from any device — it's read from the sheet's own rows).
function latestImportInfo() {
  const rows = { ops: store.operations, parts: store.parts, emps: store.employees, stages: store.customStages, dies: store.tools };
  let latest = "";
  Object.keys(rows).forEach((k) => rows[k].forEach((r) => {
    const b = String(r[IMPORT_BATCH_COL] || "");
    if (b > latest) latest = b;
  }));
  if (!latest) return null;
  const count = (k) => rows[k].filter((r) => String(r[IMPORT_BATCH_COL] || "") === latest).length;
  return { batch: latest, ops: count("ops"), parts: count("parts"), emps: count("emps"), dies: count("dies") };
}

// Removes what that import created: its tagged rows on each tab, plus
// everything hanging off the dies it created (entries/plates/schedule added
// later by hand), then rebuilds the status board and re-reads the sheet.
async function revertImport(batch, onProgress) {
  const say = (s) => { if (onProgress) onProgress(s); };
  if (!(await drainOutbox(60000))) throw new Error("Earlier changes are still waiting to sync — try again in a moment.");
  const dieIds = store.tools.filter((t) => String(t[IMPORT_BATCH_COL] || "") === batch).map((t) => t.ToolId);
  for (const tab of ["Operations", "Parts", "Employees", "CustomStages"]) {
    say(tab);
    await importDeleteQuiet(deletePayload(tab, IMPORT_BATCH_COL, batch));
  }
  for (let i = 0; i < dieIds.length; i++) {
    say(`dies ${i + 1}/${dieIds.length}`);
    for (const tab of ["Operations", "Parts", "Schedule", "ChildParts", "OutsourceEntries"]) {
      await importDeleteQuiet(deletePayload(tab, "ToolId", dieIds[i]));
    }
  }
  if (dieIds.length) await importDeleteQuiet(deletePayload("Tools", IMPORT_BATCH_COL, batch));
  say("status board");
  try { await importPost({ action: "rebuild_part_status" }); } catch (_) { /* mirror only */ }
  forceFullRead = true;
  await loadAll();
}
