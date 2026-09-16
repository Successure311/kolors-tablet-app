/* Kolors mobile app — UI.
 *
 * A port of the desktop dashboard's frontend (app/frontend/app.js) that talks
 * to the Google Sheet via sheet.js instead of a local FastAPI server.
 */

const $ = (id) => document.getElementById(id);

function showMsg(el, text, ok) {
  el.textContent = text || "";
  el.className = "msg" + (ok ? " ok" : "");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const errText = (err, fallback) => (err && err.message) || fallback;

function showGlobal(text, ok) {
  const el = $("global-msg");
  el.textContent = text || "";
  el.className = "msg banner" + (ok ? " ok" : "") + (text ? "" : " empty");
}

// ---------- language: machine/worker name display ----------
// English -> Hindi for the 9 fixed STAGES (from sheet.js). Any other
// machine name (typed via "Other…") or worker name has no curated
// translation, so it's transliterated automatically instead (see i18n.js).
// The underlying value used for comparisons/sheet writes is always the
// English string; only what's shown on screen switches with the language.
function machineLabel(name) {
  if (currentLang !== "hi") return name;
  return STAGE_NAME_HI[name] || transliterateToHindi(name);
}
function employeeLabel(name) {
  if (currentLang !== "hi" || !name) return name;
  return transliterateToHindi(name);
}

// ---------- tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
    // Switching to the Entry tab always lands on Home, never mid-wizard on
    // whatever step/Previous/Next state was left behind.
    if (btn.dataset.tab === "startstop") {
      refreshOpenOps();
      renderDeptGrid();
      wizResetToHome();
      wpGoHome();
    }
    // New Die / Add Parts always lands on "Add a New Die" too.
    if (btn.dataset.tab === "newtool") enterNewToolAddMode();
    window.scrollTo(0, 0);
  });
});

// ---------- Entry page sub-tabs: Add Entry / Work Progress ----------
document.querySelectorAll(".sub-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sub-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".sub-tab-panel").forEach((p) => { p.classList.remove("active"); p.hidden = true; });
    btn.classList.add("active");
    const panel = $(btn.dataset.subtab);
    panel.classList.add("active");
    panel.hidden = false;
    // Same rule one level down: switching between Add Entry and Work
    // Progress always resets that sub-tab's wizard to Home too.
    if (btn.dataset.subtab === "entry-add") wizResetToHome();
    if (btn.dataset.subtab === "entry-progress") wpGoHome();
  });
});

// ---------- role select -> login -> app gate ----------
// Two roles: "admin" (all three tabs) and "workshop" (Entry + Track a Die
// only). In-memory only, exactly as before: a reload always re-asks.
const roleSelect = $("role-select");
const adminLoginScreen = $("admin-login");
const workshopLoginScreen = $("workshop-login");
const appShell = $("app-shell");
const newtoolTabBtn = document.querySelector('.tab-btn[data-tab="newtool"]');

let currentRole = null; // "admin" | "workshop" | null

function showScreen(el) {
  [roleSelect, adminLoginScreen, workshopLoginScreen, appShell].forEach((s) => { s.hidden = true; });
  el.hidden = false;
}

$("role-admin-btn").addEventListener("click", () => { prefetchLogin("Admin"); showScreen(adminLoginScreen); });
$("role-workshop-btn").addEventListener("click", () => { prefetchLogin("Workshop"); showScreen(workshopLoginScreen); });
$("admin-login-back-btn").addEventListener("click", () => showScreen(roleSelect));
$("workshop-login-back-btn").addEventListener("click", () => showScreen(roleSelect));

function enterApp(role) {
  currentRole = role;
  newtoolTabBtn.hidden = role !== "admin";
  // Workshop never sees New Die / Add Parts — fall back to Entry if that
  // tab was left active by a previous admin session.
  if (role !== "admin" && newtoolTabBtn.classList.contains("active")) {
    newtoolTabBtn.classList.remove("active");
    $("newtool").classList.remove("active");
    document.querySelector('.tab-btn[data-tab="startstop"]').classList.add("active");
    $("startstop").classList.add("active");
  }
  if (role === "admin") enterNewToolAddMode();
  showScreen(appShell);
}

async function attemptLogin(check, idEl, pwEl, msgEl, role) {
  const id = $(idEl).value.trim();
  const pw = $(pwEl).value;
  showMsg($(msgEl), t("login.checking"), true);
  try {
    if (await check(id, pw)) {
      showMsg($(msgEl), "");
      $(pwEl).value = "";
      enterApp(role);
    } else {
      showMsg($(msgEl), t("login.error"));
    }
  } catch (err) {
    showMsg($(msgEl), errText(err, t("login.offlineError")));
  }
}

$("admin-login-btn").addEventListener("click", () =>
  attemptLogin(checkAdminLogin, "admin-login-id", "admin-login-password", "admin-login-msg", "admin"));

$("workshop-login-btn").addEventListener("click", () =>
  attemptLogin(checkWorkshopLogin, "workshop-login-id", "workshop-login-password", "workshop-login-msg", "workshop"));

$("logout-btn").addEventListener("click", () => {
  currentRole = null;
  ["admin-login-id", "admin-login-password", "workshop-login-id", "workshop-login-password"]
    .forEach((id) => { $(id).value = ""; });
  showScreen(roleSelect);
});

// ---------- shared: die dropdowns ----------
const partToolSelect = $("part-tool-select");
const trackToolId = $("track-tool-id");
const dieStatusToolSelect = $("die-status-tool-select");

function fillSelectWithTools(select, tools, placeholder) {
  const prev = select.value;
  select.innerHTML = tools.length
    ? tools.map((t) => `<option value="${esc(t.ToolId)}">${esc(t.ToolId)} — ${esc(t.Description)}</option>`).join("")
    : `<option value="">${esc(placeholder)}</option>`;
  if (tools.some((t) => String(t.ToolId) === prev)) select.value = prev;
}

function refreshToolSelects() {
  const tools = listTools();
  fillSelectWithTools(partToolSelect, tools, t("tool.noDiesAddAbove"));
  fillSelectWithTools(trackToolId, tools, t("tool.noDies"));
  fillSelectWithTools(dieStatusToolSelect, tools, t("tool.noDiesAddAbove"));
}

// ---------- New Die / Add Parts: "Add a New Die" / "Edit Existing Die" ----------
// A single physical #parts-card and #employee-form-card are moved between
// mount points depending on which mode is active, instead of duplicating
// markup/ids — same "shared DOM node" pattern the desktop dashboard uses.
const newtoolAddPanel = $("newtool-add");
const newtoolEditPanel = $("newtool-edit");
const addDiePartsMount = $("add-die-parts-mount");
const editDiePartsMount = $("edit-die-parts-mount");
const partsCard = $("parts-card");
const selectDieRow = $("select-die-row");
const editDieControls = $("edit-die-controls");
const partsContent = $("parts-content");
const dieStatusCard = $("die-status-card");
const addDieEmployeeMount = $("add-die-employee-mount");
const editDieEmployeeFormMount = $("edit-die-employee-form-mount");
const employeeFormCard = $("employee-form-card");

let newToolMode = null; // "add" | "edit" | null

// Shows/hides Edit/Delete Die + Parts/Child Parts based on whether a die is
// picked — only meaningful in Edit mode, once a die is actually selected.
function syncEditDieVisibility() {
  if (newToolMode !== "edit") return;
  const has = !!partToolSelect.value;
  editDieControls.hidden = !has;
  partsContent.hidden = !has;
  editDieFields.hidden = true;
}

// Add a New Die: Select Die / Add Plates / Parts / Child Parts only appear
// once a die is actually created below — no dropdown of existing dies here
// at all (that's Edit Existing Die's job); this only ever targets whichever
// die was just created in this session.
async function enterNewToolAddMode() {
  newToolMode = "add";
  newtoolEditPanel.hidden = true;
  newtoolAddPanel.hidden = false;
  document.querySelectorAll(".newtool-mode-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === "add"));
  addDiePartsMount.appendChild(partsCard);
  partsCard.hidden = true;
  selectDieRow.hidden = true;
  editDieControls.hidden = true;
  partsContent.hidden = true;
  addDieEmployeeMount.appendChild(employeeFormCard);
  employeeFormCard.hidden = false;
  exitEmployeeEditMode();
  showMsg(toolMsg, "");
  showMsg(editDieMsg, "");
  refreshToolSelects();
  partToolSelect.value = "";
}

// Edit Existing Die: nothing but the Select Die dropdown shows until a die
// is picked — then Edit/Delete Die and Parts/Child Parts appear via
// syncEditDieVisibility(). Die Status has its own Select Die dropdown
// (shows that one die's parts); the Employees list is die-independent, so
// it's always shown here regardless of selection.
async function enterNewToolEditMode() {
  newToolMode = "edit";
  newtoolAddPanel.hidden = true;
  newtoolEditPanel.hidden = false;
  document.querySelectorAll(".newtool-mode-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === "edit"));
  editDiePartsMount.appendChild(partsCard);
  partsCard.hidden = false;
  selectDieRow.hidden = false;
  editDieControls.hidden = true;
  partsContent.hidden = true;
  dieStatusCard.hidden = false;
  employeeFormCard.hidden = true;
  showMsg(editDieMsg, "");
  showMsg(dieStatusMsg, "");
  refreshEmployeeTable();
  const tools = listTools();
  fillSelectWithTools(partToolSelect, tools, t("tool.noDiesAddAbove"));
  fillSelectWithTools(trackToolId, tools, t("tool.noDies"));
  fillSelectWithTools(dieStatusToolSelect, tools, t("tool.noDiesAddAbove"));
  if (tools.length) {
    partToolSelect.insertAdjacentHTML("afterbegin", `<option value="">${t("newToolSubtab.selectDieToEdit")}</option>`);
    partToolSelect.value = "";
  }
  refreshDieStatusTable();
}

document.querySelectorAll(".newtool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.mode === "add") enterNewToolAddMode();
    else enterNewToolEditMode();
  });
});

// ---------- Add a New Die ----------
const toolForm = $("tool-form");
const toolMsg = $("tool-msg");
toolForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(toolForm);
  showMsg(toolMsg, t("common.saving"), true);
  try {
    const tool = await createTool({
      toolId: fd.get("tool_id"),
      description: fd.get("description"),
      productName: fd.get("product_name"),
    });
    showMsg(toolMsg, t("tool.added", { id: tool.ToolId }), true);
    toolForm.reset();
    refreshToolSelects();
    partToolSelect.value = tool.ToolId;
    // Reveal Add Plates / Parts / Child Parts for the die just created —
    // hidden until now since Add mode never shows a die picker.
    partsCard.hidden = false;
    partsContent.hidden = false;
    refreshParts();
    refreshChildPartsTable();
  } catch (err) {
    showMsg(toolMsg, errText(err, t("tool.addFailed")));
  }
});

// ---------- Edit / Delete the die currently selected in "Select Die" ----------
const editDieBtn = $("edit-die-btn");
const deleteDieBtn = $("delete-die-btn");
const editDieFields = $("edit-die-fields");
const editDieMsg = $("edit-die-msg");
const editDieIdInput = $("edit-die-id");
const editDieDescInput = $("edit-die-description");
const editDieProductInput = $("edit-die-product");

editDieBtn.addEventListener("click", () => {
  const toolId = partToolSelect.value;
  if (!toolId) return showMsg(editDieMsg, t("tool.selectDieFirst"));
  const tool = findTool(toolId);
  if (!tool) return showMsg(editDieMsg, t("tool.selectDieFirst"));
  editDieIdInput.value = tool.ToolId;
  editDieDescInput.value = tool.Description || "";
  editDieProductInput.value = tool.ProductName || "";
  editDieFields.hidden = false;
  showMsg(editDieMsg, "");
});

$("cancel-edit-die-btn").addEventListener("click", () => {
  editDieFields.hidden = true;
  showMsg(editDieMsg, "");
});

$("save-die-btn").addEventListener("click", async () => {
  const toolId = partToolSelect.value;
  if (!toolId) return;
  showMsg(editDieMsg, t("common.saving"), true);
  try {
    const tool = await updateTool(toolId, {
      newToolId: editDieIdInput.value.trim(),
      description: editDieDescInput.value,
      productName: editDieProductInput.value,
    });
    showMsg(editDieMsg, t("tool.updated", { id: tool.ToolId }), true);
    editDieFields.hidden = true;
    refreshToolSelects();
    partToolSelect.value = tool.ToolId;
    syncEditDieVisibility();
    refreshParts();
    refreshChildPartsTable();
    refreshDieStatusTable();
    refreshOpenOps();
  } catch (err) {
    showMsg(editDieMsg, errText(err, t("tool.updateFailed")));
  }
});

deleteDieBtn.addEventListener("click", async () => {
  const toolId = partToolSelect.value;
  if (!toolId) return showMsg(editDieMsg, t("tool.selectDieFirst"));
  if (!confirm(t("tool.deleteConfirm", { id: toolId }))) return;
  try {
    await deleteTool(toolId);
    showMsg(editDieMsg, t("tool.deleted", { id: toolId }), true);
    editDieFields.hidden = true;
    refreshToolSelects();
    syncEditDieVisibility();
    refreshParts();
    refreshChildPartsTable();
    refreshDieStatusTable();
    refreshOpenOps();
  } catch (err) {
    showMsg(editDieMsg, errText(err, t("tool.deleteFailed")));
  }
});

// ---------- Add / Edit Parts: bulk "Add Plates", then edit inline ----------
const partMsg = $("part-msg");
const partTableBody = document.querySelector("#part-table tbody");
const plateCheckboxGrid = $("plate-checkbox-grid");
const plateOtherInput = $("plate-other-input");
const plateCustomList = $("plate-custom-list");
const plateMsg = $("plate-msg");

let customPlateNames = []; // queued "Other" plate names, not yet created
let freshPartIds = new Set(); // just-created via "Add Selected Plates", not yet Saved — render blank

function loadPlateNames() {
  plateCheckboxGrid.innerHTML = PLATE_NAMES.map((n) =>
    `<label><input type="checkbox" value="${esc(n)}" /> ${esc(n)}</label>`
  ).join("");
}

function renderPlateCustomList() {
  plateCustomList.innerHTML = customPlateNames.map((n) =>
    `<span class="chip">${esc(n)} <button type="button" data-name="${esc(n)}">×</button></span>`
  ).join("");
  plateCustomList.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      customPlateNames = customPlateNames.filter((n) => n !== btn.dataset.name);
      renderPlateCustomList();
    }));
}

$("plate-other-add-btn").addEventListener("click", () => {
  const name = plateOtherInput.value.trim();
  if (!name) { plateOtherInput.focus(); return; }
  if (!customPlateNames.includes(name)) customPlateNames.push(name);
  plateOtherInput.value = "";
  renderPlateCustomList();
});
plateOtherInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("plate-other-add-btn").click(); }
});

$("add-plates-btn").addEventListener("click", async () => {
  const toolId = partToolSelect.value;
  if (!toolId) return showMsg(plateMsg, t("parts.addDieFirst"));
  const checked = Array.from(plateCheckboxGrid.querySelectorAll("input:checked")).map((cb) => cb.value);
  const names = checked.concat(customPlateNames);
  if (!names.length) return showMsg(plateMsg, t("parts.selectAtLeastOnePlate"));
  showMsg(plateMsg, t("common.saving"), true);
  try {
    const created = await addPartsBulk(toolId, names);
    showMsg(plateMsg, t("parts.platesAddedMsg", { count: created.length }), true);
    plateCheckboxGrid.querySelectorAll("input:checked").forEach((cb) => { cb.checked = false; });
    customPlateNames = [];
    renderPlateCustomList();
    created.forEach((p) => freshPartIds.add(p.PartId));
    refreshParts();
  } catch (err) {
    showMsg(plateMsg, errText(err, t("parts.platesAddFailed")));
  }
});

partToolSelect.addEventListener("change", () => {
  freshPartIds = new Set();
  syncEditDieVisibility();
  refreshParts();
  refreshChildPartsTable();
});

function refreshParts() {
  const toolId = partToolSelect.value;
  partTableBody.innerHTML = "";
  if (!toolId) return;
  const parts = listParts(toolId);
  partTableBody.innerHTML = parts.map((p) => {
    // A row just created via "Add Selected Plates" and not yet Saved shows
    // only the fixed Plate name; Part ID/Material/Rough Size/Qty start
    // blank (placeholder-only) so the operator fills in their own values
    // instead of seeing the auto-generated defaults.
    const fresh = freshPartIds.has(p.PartId);
    return `
    <tr data-part-id="${esc(p.PartId)}">
      <td>${esc(p.Name)}</td>
      <td><input type="text" class="part-id-input" value="${fresh ? "" : esc(p.PartId)}" placeholder="${esc(p.PartId)}" /></td>
      <td><input type="text" class="part-material-input" value="${fresh ? "" : esc(p.Material || "")}" placeholder="${esc(t("parts.materialPlaceholder"))}" /></td>
      <td><input type="text" class="part-roughsize-input" value="${fresh ? "" : esc(p.RoughSize || "")}" placeholder="${esc(t("parts.roughSizePlaceholder"))}" /></td>
      <td><input type="number" min="1" class="part-qty-input" value="${fresh ? "" : esc(p.Qty)}" placeholder="1" /></td>
      <td class="row-actions">
        <button type="button" class="delete-part-btn" data-id="${esc(p.PartId)}">${t("parts.delete")}</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">${t("parts.none")}</td></tr>`;

  partTableBody.querySelectorAll(".delete-part-btn").forEach((btn) =>
    btn.addEventListener("click", () => removePart(btn.dataset.id)));
}

async function removePart(partId) {
  if (!confirm(t("parts.deleteConfirm", { id: partId }))) return;
  // Instant — deletePart() updates the screen right away and syncs to the
  // Google Sheet in the background.
  try {
    await deletePart(partId);
    showMsg(partMsg, t("parts.deleted", { id: partId }), true);
    refreshParts();
    refreshOpenOps();
  } catch (err) {
    showMsg(partMsg, errText(err, t("parts.deleteFailed")));
  }
}

$("save-parts-btn").addEventListener("click", async () => {
  const toolId = partToolSelect.value;
  if (!toolId) return;
  const edits = Array.from(partTableBody.querySelectorAll("tr[data-part-id]")).map((row) => ({
    partId: row.dataset.partId,
    newPartId: row.querySelector(".part-id-input").value.trim(),
    material: row.querySelector(".part-material-input").value,
    roughSize: row.querySelector(".part-roughsize-input").value,
    qty: row.querySelector(".part-qty-input").value,
  }));
  if (!edits.length) return;
  showMsg(partMsg, t("common.saving"), true);
  try {
    await updatePartsBulk(edits);
    showMsg(partMsg, t("parts.savedAllMsg"), true);
    freshPartIds = new Set();
    refreshParts();
  } catch (err) {
    showMsg(partMsg, errText(err, t("parts.saveAllFailed")));
  }
});

// ---------- Child Parts: one flat Name+Qty list per die, staged in an
// editable table and only persisted when Save Child Parts is clicked.
// Uploading a CSV/Excel file just adds candidate rows — it does not save
// by itself. ----------
const childPartsMsg = $("child-parts-msg");
const childPartsTableBody = document.querySelector("#child-parts-table tbody");
const childPartsFileInput = $("child-parts-file-input");

function childPartRowHtml(name, qty) {
  return `
    <tr>
      <td><input type="text" class="child-part-name-input" value="${esc(name)}" /></td>
      <td><input type="number" min="1" class="child-part-qty-input" value="${esc(qty)}" /></td>
      <td class="row-actions">
        <button type="button" class="delete-child-part-btn">${t("parts.delete")}</button>
      </td>
    </tr>`;
}

function renderChildPartsTable(rows) {
  childPartsTableBody.innerHTML = rows.map((r) => childPartRowHtml(r.ChildName, r.Qty)).join("") ||
    `<tr class="child-parts-empty-row"><td colspan="3">${t("childParts.none")}</td></tr>`;
}

function appendChildPartsRows(rows) {
  const emptyRow = childPartsTableBody.querySelector(".child-parts-empty-row");
  if (emptyRow) emptyRow.remove();
  childPartsTableBody.insertAdjacentHTML("beforeend", rows.map((r) => childPartRowHtml(r.name, r.qty)).join(""));
}

childPartsTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".delete-child-part-btn");
  if (!btn) return;
  btn.closest("tr").remove();
  if (!childPartsTableBody.querySelector("tr")) renderChildPartsTable([]);
});

$("child-parts-upload-btn").addEventListener("click", () => {
  if (!partToolSelect.value) return showMsg(childPartsMsg, t("childParts.selectDieFirst"));
  childPartsFileInput.click();
});

childPartsFileInput.addEventListener("change", async () => {
  const file = childPartsFileInput.files[0];
  if (!file || !partToolSelect.value) return;
  showMsg(childPartsMsg, t("common.saving"), true);
  try {
    const rows = await importChildPartsPreview(file);
    appendChildPartsRows(rows);
    showMsg(childPartsMsg, t("childParts.uploadedMsg", { count: rows.length }), true);
  } catch (err) {
    showMsg(childPartsMsg, errText(err, t("childParts.uploadFailed")));
  } finally {
    childPartsFileInput.value = "";
  }
});

$("save-child-parts-btn").addEventListener("click", async () => {
  const toolId = partToolSelect.value;
  if (!toolId) return showMsg(childPartsMsg, t("childParts.selectDieFirst"));
  const rows = Array.from(childPartsTableBody.querySelectorAll("tr"))
    .map((row) => {
      const nameInput = row.querySelector(".child-part-name-input");
      const qtyInput = row.querySelector(".child-part-qty-input");
      if (!nameInput) return null;
      return { name: nameInput.value.trim(), qty: parseInt(qtyInput.value || "1", 10) };
    })
    .filter((r) => r && r.name);
  showMsg(childPartsMsg, t("common.saving"), true);
  try {
    const saved = await saveChildParts(toolId, rows);
    showMsg(childPartsMsg, t("childParts.savedMsg", { count: saved.length }), true);
    renderChildPartsTable(saved);
  } catch (err) {
    showMsg(childPartsMsg, errText(err, t("childParts.saveFailed")));
  }
});

function refreshChildPartsTable() {
  const toolId = partToolSelect.value;
  childPartsTableBody.innerHTML = "";
  if (!toolId) return;
  renderChildPartsTable(listChildParts(toolId));
}

// ---------- Die Status: Design Ready / Code Ready, Y/N per PART of the
// selected die ----------
const dieStatusTableBody = document.querySelector("#die-status-table tbody");
const dieStatusMsg = $("die-status-msg");

function readyToggle(field, current) {
  return ["Y", "N"].map((v) =>
    `<button type="button" class="ready-btn ${v.toLowerCase()} ${v === (current || "N") ? "selected" : ""}" data-field="${field}" data-value="${v}">${v}</button>`
  ).join("");
}

function refreshDieStatusTable() {
  const toolId = dieStatusToolSelect.value;
  if (!toolId) {
    dieStatusTableBody.innerHTML = `<tr><td colspan="4">${t("dieStatus.selectDieFirst")}</td></tr>`;
    return;
  }
  const parts = listParts(toolId);
  dieStatusTableBody.innerHTML = parts.map((p) => `
    <tr data-part-id="${esc(p.PartId)}">
      <td>${esc(p.Name)}</td><td>${esc(p.PartId)}</td>
      <td><span class="ready-toggle">${readyToggle("designReady", p.DesignReady)}</span></td>
      <td><span class="ready-toggle">${readyToggle("codeReady", p.CodeReady)}</span></td>
    </tr>`).join("") || `<tr><td colspan="4">${t("dieStatus.none")}</td></tr>`;

  dieStatusTableBody.querySelectorAll(".ready-btn").forEach((btn) =>
    btn.addEventListener("click", () => saveDieStatus(
      btn.closest("tr").dataset.partId, { [btn.dataset.field]: btn.dataset.value }
    )));
}

async function saveDieStatus(partId, payload) {
  try {
    await updatePartStatus(partId, payload);
  } catch (err) {
    showMsg(dieStatusMsg, errText(err, t("dieStatus.updateFailed")));
  }
  refreshDieStatusTable();
}

dieStatusToolSelect.addEventListener("change", () => {
  showMsg(dieStatusMsg, "");
  refreshDieStatusTable();
});

// ---------- Employees ----------
const employeeForm = $("employee-form");
const employeeMsg = $("employee-msg");
const employeeTableMsg = $("employee-table-msg");
const employeeTableBody = document.querySelector("#employee-table tbody");

function loadShifts() {
  $("employee-shift-select").innerHTML = SHIFTS.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
}

const employeeMachineSelect = $("employee-machine-select");
const employeeMachineOtherWrap = $("employee-machine-other-wrap");
const employeeMachineOther = $("employee-machine-other");

function loadEmployeeMachineOptions() {
  const prev = employeeMachineSelect.value;
  employeeMachineSelect.innerHTML =
    allKnownStages().map((s) => `<option value="${esc(s)}">${esc(machineLabel(s))}</option>`).join("") +
    `<option value="${OTHER_STAGE_VALUE}">${t("common.other")}</option>`;
  if (allKnownStages().includes(prev)) employeeMachineSelect.value = prev;
}

employeeMachineSelect.addEventListener("change", () => {
  employeeMachineOtherWrap.hidden = employeeMachineSelect.value !== OTHER_STAGE_VALUE;
});

const employeeSubmitBtn = $("employee-submit-btn");
const employeeCancelEditBtn = $("employee-cancel-edit-btn");

function refreshEmployeeTable() {
  const employees = listEmployees();
  employeeTableBody.innerHTML = employees.map((e) => `
    <tr>
      <td>${esc(employeeLabel(e.Name))}</td>
      <td>${esc(machineLabel(e.Machine || ""))}</td>
      <td>${esc(e.Shift)}</td>
      <td class="row-actions">
        <button type="button" class="edit-employee-btn" data-name="${esc(e.Name)}">${t("employees.edit")}</button>
        <button type="button" class="delete-employee-btn" data-name="${esc(e.Name)}">${t("employees.delete")}</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="4">${t("employees.none")}</td></tr>`;
  employeeTableBody.querySelectorAll(".edit-employee-btn").forEach((btn) =>
    btn.addEventListener("click", () => enterEmployeeEditMode(findEmployee(btn.dataset.name))));
  employeeTableBody.querySelectorAll(".delete-employee-btn").forEach((btn) =>
    btn.addEventListener("click", () => removeEmployee(btn.dataset.name)));
}

function enterEmployeeEditMode(emp) {
  if (!emp) return;
  editDieEmployeeFormMount.appendChild(employeeFormCard);
  employeeFormCard.hidden = false;
  loadEmployeeMachineOptions();
  employeeForm.editing_name.value = emp.Name;
  $("employee-name-input").value = emp.Name;
  $("employee-name-input").disabled = true;
  employeeForm.shift.value = emp.Shift || "";
  const hasFixedMachine = allKnownStages().includes(emp.Machine);
  employeeMachineSelect.value = hasFixedMachine ? emp.Machine : OTHER_STAGE_VALUE;
  employeeMachineOtherWrap.hidden = hasFixedMachine;
  employeeMachineOther.value = hasFixedMachine ? "" : (emp.Machine || "");
  employeeSubmitBtn.textContent = t("employees.updateButton", { name: emp.Name });
  employeeCancelEditBtn.hidden = false;
  showMsg(employeeMsg, "");
}

function exitEmployeeEditMode() {
  employeeForm.reset();
  employeeForm.editing_name.value = "";
  $("employee-name-input").disabled = false;
  loadEmployeeMachineOptions();
  employeeMachineOtherWrap.hidden = true;
  employeeSubmitBtn.textContent = t("employees.addButton");
  employeeCancelEditBtn.hidden = true;
  if (newToolMode === "edit") employeeFormCard.hidden = true;
}
employeeCancelEditBtn.addEventListener("click", exitEmployeeEditMode);

async function removeEmployee(name) {
  if (!confirm(t("employees.deleteConfirm", { name }))) return;
  // Instant — deleteEmployee() updates the screen right away and syncs to
  // the Google Sheet in the background.
  try {
    await deleteEmployee(name);
    showMsg(employeeTableMsg, t("employees.deleted", { name }), true);
    if (employeeForm.editing_name.value === name) exitEmployeeEditMode();
    refreshEmployeeTable();
  } catch (err) {
    showMsg(employeeTableMsg, errText(err, t("employees.deleteFailed")));
  }
}

employeeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(employeeForm);
  const machine = fd.get("machine") === OTHER_STAGE_VALUE ? fd.get("machine_other").trim() : fd.get("machine");
  if (!machine) return showMsg(employeeMsg, t("employees.pickMachineOther"));

  const editingName = employeeForm.editing_name.value;
  showMsg(employeeMsg, t("common.saving"), true);
  try {
    if (editingName) {
      const emp = await updateEmployee(editingName, { shift: fd.get("shift"), machine });
      showMsg(employeeMsg, t("employees.updated", { name: emp.Name }), true);
    } else {
      const emp = await createEmployee(fd.get("name"), fd.get("shift"), machine);
      showMsg(employeeMsg, t("employees.added", { name: emp.Name }), true);
    }
    exitEmployeeEditMode();
    refreshEmployeeTable();
    renderDeptGrid();
  } catch (err) {
    showMsg(employeeMsg, errText(err, t("employees.saveFailed")));
  }
});

// ---------- Add Entry wizard: Department -> Die -> Part + Employee ----------
const ssStartBtn = $("ss-start-btn");
const ssMsg = $("ss-msg");

const WIZ_STEPS = ["department", "die", "part"];
let wizIndex = 0;
let wizState = { stage: null, toolId: null, partId: null, employee: null };

function wizResetToHome() {
  wizIndex = 0;
  wizState = { stage: null, toolId: null, partId: null, employee: null };
  showMsg(ssMsg, "");
  $("wiz-step-outsource").hidden = true;
  $("wiz-prev-btn").hidden = false;
  $("wiz-next-btn").hidden = false;
  $("entry-add-entries-card").hidden = false;
  renderDeptGrid();
  renderWizStep();
}

// OutSource isn't part of the linear Department -> Die -> Part flow, so it
// hides every WIZ_STEPS panel plus Prev/Next/breadcrumb — Home is the way
// back. The regular Entries card (every open Start/Stop entry) is unrelated
// to OutSource entries, so it's hidden here too — its own OutSource Entries
// table above already covers this screen.
function showOutsourceStep() {
  WIZ_STEPS.forEach((s) => { $(`wiz-step-${s}`).hidden = true; });
  $("wiz-step-outsource").hidden = false;
  $("wiz-prev-btn").hidden = true;
  $("wiz-next-btn").hidden = true;
  $("wiz-breadcrumb").textContent = "";
  $("entry-add-entries-card").hidden = true;
  loadOutsourceToolOptions();
  refreshOutsourceTable();
}

function wizCanGoNext() {
  if (wizIndex === 0) return !!wizState.stage;
  if (wizIndex === 1) return !!wizState.toolId;
  return false;
}

function renderWizStep() {
  WIZ_STEPS.forEach((s, i) => { $(`wiz-step-${s}`).hidden = i !== wizIndex; });
  $("wiz-prev-btn").disabled = wizIndex === 0;
  $("wiz-next-btn").disabled = !wizCanGoNext();
  $("wiz-breadcrumb").textContent =
    [wizState.stage ? machineLabel(wizState.stage) : null, wizState.toolId].filter(Boolean).join(" › ");
}

$("wiz-home-btn").addEventListener("click", wizResetToHome);

$("wiz-prev-btn").addEventListener("click", () => {
  if (wizIndex > 0) {
    wizIndex--;
    if (wizIndex === 0) renderDeptGrid();
    if (wizIndex === 1) renderDieGrid();
    renderWizStep();
  }
});

$("wiz-next-btn").addEventListener("click", () => {
  if (!wizCanGoNext()) return;
  wizIndex++;
  if (wizIndex === 1) renderDieGrid();
  if (wizIndex === 2) renderPartEmployeeStep();
  renderWizStep();
});

const OTHER_STAGE_VALUE = "__other_stage__";
const deptOtherWrap = $("dept-other-wrap");
const deptOtherInput = $("dept-other-input");

function goToDieStepWithStage(stage) {
  wizState.stage = stage;
  wizState.toolId = null;
  wizState.partId = null;
  wizState.employee = null;
  wizIndex = 1;
  renderDieGrid();
  renderWizStep();
}

function renderDeptGrid() {
  const grid = $("dept-grid");
  deptOtherWrap.hidden = true;
  deptOtherInput.value = "";
  // Custom department names typed via "Other…" before are remembered
  // permanently (CustomStages tab) and show up as their own tile here from
  // then on, same as the dashboard.
  const knownStages = stagesForDeptGrid();
  const isCustomStage = wizState.stage && !knownStages.includes(wizState.stage);
  grid.innerHTML =
    knownStages.map((s) =>
      `<div class="kpi-card ${s === wizState.stage ? "selected" : ""}" data-stage="${esc(s)}">${esc(machineLabel(s))}</div>`
    ).join("") +
    `<div class="kpi-card other-tile ${isCustomStage ? "selected" : ""}" data-stage="${OTHER_STAGE_VALUE}">${t("common.other")}${isCustomStage ? `<small>${esc(wizState.stage)}</small>` : ""}</div>`;
  grid.querySelectorAll(".kpi-card").forEach((card) => card.addEventListener("click", () => {
    if (card.dataset.stage === OTHER_STAGE_VALUE) {
      deptOtherWrap.hidden = false;
      deptOtherInput.focus();
      return;
    }
    if (card.dataset.stage === OUTSOURCE_STAGE) {
      showOutsourceStep();
      return;
    }
    goToDieStepWithStage(card.dataset.stage);
  }));
}

// OutSource is a frontend-only pseudo-tile, always last: it isn't a real
// department (no employees assigned to it, no Pending default anywhere), so
// it's kept out of allKnownStages() and only spliced into the two tile grids.
const OUTSOURCE_STAGE = "OutSource";
function stagesForDeptGrid() {
  return allKnownStages().concat([OUTSOURCE_STAGE]);
}

$("dept-other-continue-btn").addEventListener("click", () => {
  const name = deptOtherInput.value.trim();
  if (!name) { deptOtherInput.focus(); return; }
  goToDieStepWithStage(name);
});
deptOtherInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("dept-other-continue-btn").click();
});

function renderDieGrid() {
  $("wiz-dept-label").textContent = wizState.stage ? machineLabel(wizState.stage) : "";
  const tools = listTools();
  const grid = $("die-grid");
  grid.innerHTML = tools.length
    ? tools.map((t) => `<div class="kpi-card" data-tool="${esc(t.ToolId)}">${esc(t.ToolId)}<small>${esc(t.Description)}</small></div>`).join("")
    : `<p>${t("wizard.noDiesAdd")}</p>`;
  grid.querySelectorAll(".kpi-card").forEach((card) => card.addEventListener("click", () => {
    wizState.toolId = card.dataset.tool;
    wizState.partId = null;
    wizState.employee = null;
    wizIndex = 2;
    renderPartEmployeeStep();
    renderWizStep();
  }));
}

function partCardForStage(p, stage) {
  // A part's completion is tracked per department: finishing it at one
  // department only removes it from THAT department's pending list — it still
  // needs doing at every other department. But a part is one physical object,
  // so it also can't be started here while it's currently open elsewhere.
  const stageInfo = p.stages[stage] || { status: "Pending" };
  // Waiting is still open (no Y answer yet), so it blocks elsewhere exactly
  // like Working does.
  const openHere = stageInfo.status === "Working" || stageInfo.status === "Waiting";
  const workingElsewhere = !!p.current_operation_id && !openHere;
  if (stageInfo.status === "Done") return { label: t("wizard.doneHere"), cls: "done", clickable: false };
  if (stageInfo.status === "Working") return { label: t("wizard.workingHere"), cls: "working", clickable: false };
  if (stageInfo.status === "Waiting") return { label: t("wizard.waitingHere"), cls: "waiting", clickable: false };
  if (workingElsewhere) return { label: t("wizard.workingElsewhere"), cls: "working", clickable: false };
  return { label: t("wizard.pending"), cls: "pending", clickable: true };
}

function renderPartEmployeeStep() {
  $("wiz-die-label").textContent = wizState.toolId || "";
  $("wiz-dept-label-2").textContent = wizState.stage ? machineLabel(wizState.stage) : "";

  const parts = partsWithStatus(wizState.toolId);
  const partGrid = $("part-grid");

  if (!parts.length) {
    partGrid.innerHTML = `<p>${t("wizard.noParts")}</p>`;
  } else {
    partGrid.innerHTML = parts.map((p) => {
      const { label, cls, clickable } = partCardForStage(p, wizState.stage);
      const selected = p.part_id === wizState.partId ? "selected" : "";
      return `<div class="kpi-card ${cls} ${clickable ? "" : "disabled"} ${selected}" data-part="${esc(p.part_id)}" data-clickable="${clickable}">
        ${esc(p.part_id)}<small>${esc(p.name)}</small><small>${esc(label)}</small>
      </div>`;
    }).join("");
    partGrid.querySelectorAll('.kpi-card[data-clickable="true"]').forEach((card) =>
      card.addEventListener("click", () => {
        wizState.partId = card.dataset.part;
        renderPartEmployeeStep();
      }));
  }

  // Only the employees fixed to this machine — each worker is assigned one
  // machine under "New Die / Add Parts", so that's who can be picked here.
  const employees = employeesForStage(wizState.stage);
  const empGrid = $("employee-grid");
  empGrid.innerHTML = employees.length
    ? employees.map((e) => {
        const selected = e.Name === wizState.employee ? "selected" : "";
        return `<div class="kpi-card ${selected}" data-emp="${esc(e.Name)}">${esc(employeeLabel(e.Name))}</div>`;
      }).join("")
    : `<p>${t("wizard.noEmployeesAssigned", { stage: machineLabel(wizState.stage || "") })}</p>`;
  empGrid.querySelectorAll(".kpi-card").forEach((card) =>
    card.addEventListener("click", () => {
      wizState.employee = card.dataset.emp;
      renderPartEmployeeStep();
    }));

  ssStartBtn.disabled = !(wizState.partId && wizState.employee);
}

ssStartBtn.addEventListener("click", async () => {
  if (!wizState.partId || !wizState.employee) return;
  // Instant — startOperation() updates the screen right away and syncs to
  // the Google Sheet in the background, so there's nothing to wait on here.
  try {
    const op = await startOperation({
      toolId: wizState.toolId,
      partId: wizState.partId,
      stage: wizState.stage,
      operator: wizState.employee,
    });
    showMsg(ssMsg, t("wizard.started", { part: op.PartId, stage: machineLabel(op.Department), operator: employeeLabel(op.Operator) }), true);
    wizState.partId = null;
    wizState.employee = null;
    renderPartEmployeeStep();
    refreshOpenOps();
  } catch (err) {
    showMsg(ssMsg, errText(err, t("wizard.startFailed")));
    renderPartEmployeeStep();
  }
});

// ---------- Work Progress: Department -> Employee -> View, the same
// step-by-step shape as Add Entry — pick Department, then only the
// employees fixed to that machine, then View. ----------
const wpMsg = $("wp-msg");
let wpStep = 0; // 0 = department, 1 = employee
let wpFilter = { stage: null, employee: null };
let wpEmpNames = [];

function wpGoHome() {
  wpStep = 0;
  wpFilter = { stage: null, employee: null };
  $("wp-results-card").hidden = true;
  $("wp-step-outsource").hidden = true;
  $("wp-prev-btn").hidden = false;
  renderWpStep();
}

// Mirrors showOutsourceStep() on the Add Entry side.
function showWpOutsourceStep() {
  $("wp-step-department").hidden = true;
  $("wp-step-employee").hidden = true;
  $("wp-step-outsource").hidden = false;
  $("wp-prev-btn").hidden = true;
  $("wp-breadcrumb").textContent = "";
  $("wp-results-card").hidden = true;
  refreshOutsourceOpenTable();
}
$("wp-home-btn").addEventListener("click", wpGoHome);

$("wp-prev-btn").addEventListener("click", () => {
  if (wpStep === 0) return;
  wpStep = 0;
  wpFilter.employee = null;
  $("wp-results-card").hidden = true;
  renderWpStep();
});

function renderWpStep() {
  $("wp-step-department").hidden = wpStep !== 0;
  $("wp-step-employee").hidden = wpStep !== 1;
  $("wp-prev-btn").disabled = wpStep === 0;
  $("wp-breadcrumb").textContent = wpFilter.stage ? machineLabel(wpFilter.stage) : "";
  if (wpStep === 0) renderWpDeptGrid();
}

function renderWpDeptGrid() {
  const grid = $("wp-dept-grid");
  grid.innerHTML = stagesForDeptGrid().map((s) =>
    `<div class="kpi-card ${s === wpFilter.stage ? "selected" : ""}" data-stage="${esc(s)}">${esc(machineLabel(s))}</div>`
  ).join("");
  grid.querySelectorAll(".kpi-card").forEach((card) =>
    card.addEventListener("click", () => {
      if (card.dataset.stage === OUTSOURCE_STAGE) {
        showWpOutsourceStep();
        return;
      }
      enterWpEmployeeStep(card.dataset.stage);
    }));
}

function enterWpEmployeeStep(stage) {
  wpFilter.stage = stage;
  wpFilter.employee = null;
  wpStep = 1;
  $("wp-dept-label").textContent = machineLabel(stage);
  $("wp-results-card").hidden = true;
  // Only the employees fixed to this machine — same assignment used in Add
  // Entry, not narrowed further to who currently has something open. Picking
  // someone with nothing running right now is a valid outcome, not a dead
  // end: View just reports "no running task" for them.
  wpEmpNames = employeesForStage(stage).map((e) => e.Name).sort();
  renderWpEmpTiles();
  renderWpStep();
}

function renderWpEmpTiles() {
  const grid = $("wp-emp-grid");
  grid.innerHTML = wpEmpNames.length
    ? wpEmpNames.map((n) =>
        `<div class="kpi-card ${n === wpFilter.employee ? "selected" : ""}" data-emp="${esc(n)}">${esc(employeeLabel(n))}</div>`
      ).join("")
    : `<p>${t("wp.noEmployeesAssigned", { stage: machineLabel(wpFilter.stage || "") })}</p>`;
  grid.querySelectorAll(".kpi-card").forEach((card) =>
    card.addEventListener("click", () => {
      wpFilter.employee = card.dataset.emp;
      renderWpEmpTiles();
      $("wp-view-btn").disabled = false;
    }));
  $("wp-view-btn").disabled = !wpFilter.employee;
}

$("wp-view-btn").addEventListener("click", () => {
  if (!wpFilter.stage || !wpFilter.employee) return;
  $("wp-results-card").hidden = false;
  refreshOpenOps();
});

// ---------- Entries tables — shown in BOTH sub-tabs from the same data:
// Add Entry always shows every open entry, unfiltered (as it always did).
// Work Progress shows only the Department + Employee picked in its wizard,
// once both are chosen — so it can say "no running task" outright, rather
// than hiding an employee who happens to have nothing open right now. ----------
function entryStatusLabel(status) {
  if (status === "Working") return t("entries.statusWorking");
  if (status === "Waiting") return t("entries.statusWaiting");
  return t("entries.statusDone");
}

function renderOpsRows(tbody, ops, emptyMessage, showActions = true) {
  tbody.innerHTML = ops.map((o) => {
    const statusClass = o.Status === "Working" ? "working" : o.Status === "Waiting" ? "waiting" : "done";
    // Waiting hasn't been finished yet — offer Restart (resume to Working)
    // instead of Stop; once it's Working again, Stop asks Y/N as usual.
    // Add Entry's table is view-only — stopping/restarting only happens in
    // Work Progress, so no action button is rendered there.
    const actionBtn = !showActions ? "" : o.Status === "Working"
      ? `<button type="button" class="stop-entry-btn" data-id="${esc(o.Id)}">${t("entries.stop")}</button>`
      : o.Status === "Waiting"
        ? `<button type="button" class="restart-entry-btn" data-id="${esc(o.Id)}">${t("entries.restart")}</button>`
        : "";
    return `
    <tr>
      <td>${esc(o.ToolId)}</td><td>${esc(o.PartId)}</td><td>${esc(o.DieName || "")}</td><td>${esc(o.PartName || "")}</td>
      <td>${esc(machineLabel(o.Department))}</td><td>${esc(employeeLabel(o.Operator))}</td>
      <td>${esc(isoDate(o.StartDate))}</td><td>${esc(isoTime(o.StartTime))}</td>
      <td>${esc(isoDate(o.EndDate))}</td><td>${esc(isoTime(o.EndTime))}</td>
      <td>${esc(o.Shift)}</td>
      <td class="status-cell ${statusClass}">${entryStatusLabel(o.Status)}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="13">${emptyMessage}</td></tr>`;

  tbody.querySelectorAll(".stop-entry-btn").forEach((btn) =>
    btn.addEventListener("click", () => askTaskCompleted(btn, btn.dataset.id)));
  tbody.querySelectorAll(".restart-entry-btn").forEach((btn) =>
    btn.addEventListener("click", () => restartEntry(btn.dataset.id)));
}

const openTableBodyAdd = document.querySelector("#open-table-add tbody");
const openTableBody = document.querySelector("#open-table tbody");

function refreshOpenOps() {
  const ops = listOperations();

  renderOpsRows(openTableBodyAdd, ops, t("entries.none"), false);

  if (wpFilter.stage && wpFilter.employee) {
    const filtered = ops.filter((o) => o.Department === wpFilter.stage && o.Operator === wpFilter.employee);
    renderOpsRows(
      openTableBody,
      filtered,
      t("entries.noneFiltered", { employee: employeeLabel(wpFilter.employee), stage: machineLabel(wpFilter.stage) })
    );
  }
}
// Refresh re-pulls from the Google Sheet (not just a local re-render) —
// another tablet or the dashboard may have changed something since this
// device last loaded.
async function refreshFromSheet() {
  showGlobal(t("common.refreshing"), true);
  try {
    await loadAll();
    refreshEverything();
    showGlobal("");
  } catch (err) {
    showGlobal(errText(err, t("errors.refreshFailed")));
  }
}
$("refresh-open-btn").addEventListener("click", refreshFromSheet);
$("refresh-open-btn-add").addEventListener("click", refreshFromSheet);

// ---------- background sync: keeps this device's Entries/Outsource lists
// fresh without anyone tapping Refresh, so a change made on one device (PC
// browser, another tablet, another phone) shows up here quickly on its own.
// The server-side lock in APPS_SCRIPT.gs (start_operation/start_outsource)
// is what actually prevents two devices both starting the same part — this
// poll is just about how fast everyone SEES the result, not correctness.
// Quiet — no "Refreshing..." banner, nothing typed in a form is touched;
// only the read-only tables/tiles re-render. Only Operations and
// OutsourceEntries are polled (the fast-changing, shared-conflict data) —
// Tools/Parts/Employees change rarely and still refresh via Refresh/reload.
const SYNC_INTERVAL_MS = 4000;
let syncInFlight = false;

async function backgroundSync() {
  if (syncInFlight || document.hidden) return;
  syncInFlight = true;
  try {
    await Promise.all([reloadOperations(), reloadOutsourceEntries()]);
    refreshOpenOps();
    refreshOutsourceTable();
    refreshOutsourceOpenTable();
    refreshWizPartStepIfActive();
    renderDeptGrid();
    if (wpStep === 0) renderWpDeptGrid();
  } catch (_) {
    // Silent — tries again next tick. The visible Refresh button still
    // surfaces a real error if someone taps it directly.
  } finally {
    syncInFlight = false;
  }
}

setInterval(backgroundSync, SYNC_INTERVAL_MS);
// Tablet screens sleep/wake and browser tabs get backgrounded a lot on the
// shop floor — catch up the moment it's visible again instead of waiting
// up to SYNC_INTERVAL_MS.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) backgroundSync();
});

// ---------- Task-Completed popover (Y = green / N = red), anchored to the
// Stop button that was clicked, instead of the browser's plain confirm() box.
function closeTaskPopover() {
  const existing = document.querySelector(".task-popover");
  if (existing) existing.remove();
  document.removeEventListener("mousedown", onTaskPopoverOutsideClick, true);
}

function onTaskPopoverOutsideClick(e) {
  const pop = document.querySelector(".task-popover");
  if (pop && !pop.contains(e.target)) closeTaskPopover();
}

function showTaskPopover(anchorEl, onAnswer) {
  closeTaskPopover();

  const pop = document.createElement("div");
  pop.className = "task-popover";
  pop.innerHTML = `
    <p>${t("popover.taskCompleted")}</p>
    <div class="task-popover-actions">
      <button type="button" class="task-yes-btn">${t("popover.yes")}</button>
      <button type="button" class="task-no-btn">${t("popover.no")}</button>
    </div>`;
  document.body.appendChild(pop);

  const btnRect = anchorEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  let top = btnRect.bottom + 6;
  if (top + popRect.height > window.innerHeight) top = btnRect.top - popRect.height - 6;
  let left = Math.min(btnRect.left, window.innerWidth - popRect.width - 6);
  if (left < 6) left = 6;
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;

  pop.querySelector(".task-yes-btn").addEventListener("click", () => { closeTaskPopover(); onAnswer(true); });
  pop.querySelector(".task-no-btn").addEventListener("click", () => { closeTaskPopover(); onAnswer(false); });

  setTimeout(() => document.addEventListener("mousedown", onTaskPopoverOutsideClick, true), 0);
}

function askTaskCompleted(anchorEl, opId) {
  showTaskPopover(anchorEl, (completed) => stopEntry(opId, completed));
}

function refreshWizPartStepIfActive() {
  if (wizIndex === 2 && wizState.toolId) renderPartEmployeeStep();
}

// Wired to both tabs' Reset buttons (Add Entry + Work Progress) — same
// action either place, each reporting into its own message line.
async function resetAllEntries(msgEl) {
  if (!confirm(t("entries.resetConfirm"))) return;
  showMsg(msgEl, t("common.clearing"), true);
  try {
    const count = await resetOperations();
    showMsg(msgEl, t("entries.resetDone", { count }), true);
    renderDeptGrid();
    if (wpStep === 0) renderWpDeptGrid();
    refreshOpenOps();
    refreshWizPartStepIfActive();
  } catch (err) {
    showMsg(msgEl, errText(err, t("entries.resetFailed")));
  }
}

const resetMsg = $("reset-msg");
const resetMsgAdd = $("reset-msg-add");
$("reset-entries-btn").addEventListener("click", () => resetAllEntries(resetMsg));
$("reset-entries-btn-add").addEventListener("click", () => resetAllEntries(resetMsgAdd));

// completed=true (Y) -> Done, exit time recorded now.
// completed=false (N) -> Waiting, no exit time taken; the entry stays open
// (Restart brings it back to Working, then Stop can ask again).
// Instant — stopOperation()/restartOperation() update the screen right away
// and sync to the Google Sheet in the background, so there's nothing to
// wait on here.
async function stopEntry(opId, completed) {
  try {
    const op = await stopOperation(opId, completed);
    showMsg(wpMsg, completed ? t("entries.doneMsg", { part: op.PartId }) : t("entries.waitingMsg", { part: op.PartId }), true);
    refreshOpenOps();
    refreshWizPartStepIfActive();
  } catch (err) {
    showMsg(wpMsg, errText(err, t("entries.stopFailed")));
    refreshOpenOps();
  }
}

// Restart puts a Waiting entry back to Working — no Y/N asked here, that
// only happens again once Stop is pressed on it.
async function restartEntry(opId) {
  try {
    const op = await restartOperation(opId);
    showMsg(wpMsg, t("entries.resumedMsg", { part: op.PartId }), true);
    refreshOpenOps();
    refreshWizPartStepIfActive();
  } catch (err) {
    showMsg(wpMsg, errText(err, t("entries.restartFailed")));
  }
}

// ---------- OutSource: send a part to an outside vendor. Its own screen in
// both Add Entry (form + full history) and Work Progress (currently-out
// parts, with Mark Returned) — not a normal department, so it lives in its
// own OutsourceEntries sheet tab rather than Operations. ----------
const osToolSelect = $("os-tool-select");
const osPartSelect = $("os-part-select");
const osMsg = $("os-msg");

function loadOutsourceToolOptions() {
  fillSelectWithTools(osToolSelect, listTools(), t("tool.noDiesAddAbove"));
  loadOutsourcePartOptions();
}

function loadOutsourcePartOptions() {
  const toolId = osToolSelect.value;
  const parts = toolId ? listParts(toolId) : [];
  osPartSelect.innerHTML = parts.length
    ? parts.map((p) => `<option value="${esc(p.PartId)}">${esc(p.PartId)} — ${esc(p.Name)}</option>`).join("")
    : `<option value="">${t("outsource.noParts")}</option>`;
}

osToolSelect.addEventListener("change", loadOutsourcePartOptions);

$("os-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const toolId = osToolSelect.value;
  const partId = osPartSelect.value;
  if (!toolId || !partId) return showMsg(osMsg, t("outsource.selectDiePartFirst"));
  showMsg(osMsg, t("common.saving"), true);
  try {
    await startOutsource({
      toolId,
      partId,
      process: $("os-process-input").value,
      place: $("os-place-input").value,
      duration: $("os-duration-input").value,
    });
    showMsg(osMsg, t("outsource.addedMsg", { part: partId }), true);
    ["os-process-input", "os-place-input", "os-duration-input"].forEach((id) => { $(id).value = ""; });
    refreshOutsourceTable();
  } catch (err) {
    showMsg(osMsg, errText(err, t("outsource.addFailed")));
  }
});

const outsourceStatusLabel = (status) =>
  (status === "Done" ? t("track.statusCompleted") : t("track.statusOutsource"));

function refreshOutsourceTable() {
  const tbody = document.querySelector("#os-table tbody");
  tbody.innerHTML = listOutsourceEntries().map((o) => `
    <tr>
      <td>${esc(o.ToolId)}</td><td>${esc(o.PartId)}</td><td>${esc(o.DieName || "")}</td><td>${esc(o.PartName || "")}</td>
      <td>${esc(o.Process)}</td><td>${esc(o.Place)}</td><td>${esc(o.Duration || "")}</td>
      <td>${esc(isoDate(o.StartDate))}</td><td>${esc(isoTime(o.StartTime))}</td>
      <td>${esc(isoDate(o.EndDate))}</td><td>${esc(isoTime(o.EndTime))}</td>
      <td class="status-cell ${o.Status === "Done" ? "done" : "outsource"}">${outsourceStatusLabel(o.Status)}</td>
    </tr>`).join("") || `<tr><td colspan="12">${t("outsource.none")}</td></tr>`;
}

function refreshOutsourceOpenTable() {
  const tbody = document.querySelector("#wp-os-table tbody");
  tbody.innerHTML = listOutsourceEntries("OutSource").map((o) => `
    <tr>
      <td>${esc(o.ToolId)}</td><td>${esc(o.PartId)}</td><td>${esc(o.DieName || "")}</td><td>${esc(o.PartName || "")}</td>
      <td>${esc(o.Process)}</td><td>${esc(o.Place)}</td><td>${esc(o.Duration || "")}</td>
      <td>${esc(isoDate(o.StartDate))}</td><td>${esc(isoTime(o.StartTime))}</td>
      <td class="status-cell outsource">${outsourceStatusLabel(o.Status)}</td>
      <td><button type="button" class="mark-returned-btn" data-id="${esc(o.Id)}">${t("outsource.markReturned")}</button></td>
    </tr>`).join("") || `<tr><td colspan="11">${t("outsource.noneOpen")}</td></tr>`;

  tbody.querySelectorAll(".mark-returned-btn").forEach((btn) =>
    btn.addEventListener("click", () => markOutsourceReturned(btn.dataset.id)));
}

async function markOutsourceReturned(entryId) {
  showMsg($("wp-os-msg"), t("common.saving"), true);
  try {
    await stopOutsource(entryId);
    showMsg($("wp-os-msg"), "");
    refreshOutsourceOpenTable();
  } catch (err) {
    showMsg($("wp-os-msg"), errText(err, t("outsource.returnFailed")));
  }
}

$("os-refresh-btn").addEventListener("click", refreshFromSheet);
$("wp-os-refresh-btn").addEventListener("click", refreshFromSheet);
$("os-reset-btn").addEventListener("click", () => resetAllEntries($("os-reset-msg")));
$("wp-os-reset-btn").addEventListener("click", () => resetAllEntries($("wp-os-reset-msg")));

// ---------- Track a Die ----------
const trackResult = $("track-result");

function stageCellLabel(cell) {
  if (cell.status === "Pending") return t("track.statusPending");
  if (cell.status === "Working") return t("track.statusRunning");
  if (cell.status === "Waiting") return t("track.statusWaiting");
  if (cell.status === "OutSource") return t("track.statusOutsource");
  return t("track.statusCompleted");
}

function stageCellClass(cell) {
  if (cell.status === "Pending") return "pending";
  if (cell.status === "Working") return "working";
  if (cell.status === "Waiting") return "waiting";
  if (cell.status === "OutSource") return "outsource";
  return "done";
}

function stageCellTitle(cell) {
  if (cell.status === "Pending") return "";
  const who = cell.operator ? t("track.by", { who: employeeLabel(cell.operator) }) : "";
  if (cell.status === "Working") return t("track.startedAt", { time: cell.start_time, who });
  if (cell.status === "Waiting") return t("track.startedWaiting", { time: cell.start_time, who });
  return `${cell.start_time} → ${cell.end_time}${who}`;
}

// Pulled out so the language toggle can re-render the currently displayed
// die's matrix in the new language without the user pressing Show Status again.
function renderTrackResult() {
  const toolId = trackToolId.value;
  if (!toolId) return;
  const tool = findTool(toolId);
  if (!tool) {
    trackResult.innerHTML = `<p class="msg">${t("track.dieNotFound")}</p>`;
    return;
  }
  const parts = partsWithStatus(toolId);
  if (!parts.length) {
    trackResult.innerHTML = `<h3>${esc(tool.ToolId)} — ${esc(tool.Description)}</h3><p>${t("track.none")}</p>`;
    return;
  }
  // Every known department (fixed + custom, remembered permanently) gets a
  // column, not just ones this die's parts already have history at.
  // OutSource is appended last and behaves differently: most parts never go
  // out, so a part with no OutsourceEntry gets a blank cell instead of
  // defaulting to Pending like every other stage — mirrors the dashboard.
  const allStages = allKnownStages().concat([OUTSOURCE_STAGE]);

  function cellFor(p, s) {
    if (s === OUTSOURCE_STAGE) {
      const entry = outsourceStatusFor(p.part_id);
      if (!entry) return null;
      return {
        status: entry.Status,
        operator: null,
        start_time: `${isoDate(entry.StartDate)} ${isoTime(entry.StartTime)}`.trim(),
        end_time: `${isoDate(entry.EndDate)} ${isoTime(entry.EndTime)}`.trim(),
      };
    }
    return p.stages[s] || { status: "Pending" };
  }

  trackResult.innerHTML = `
    <h3>${esc(tool.ToolId)} — ${esc(tool.Description)}</h3>
    <div class="table-scroll">
    <table id="matrix-table">
      <thead><tr>
        <th>${t("track.thPartId")}</th><th>${t("track.thPartName")}</th>
        ${allStages.map((s) => `<th>${esc(machineLabel(s))}</th>`).join("")}
      </tr></thead>
      <tbody>
        ${parts.map((p) => `
          <tr>
            <td>${esc(p.part_id)}</td><td>${esc(p.name)}</td>
            ${allStages.map((s) => {
              const cell = cellFor(p, s);
              if (!cell) return `<td class="status-cell empty"></td>`;
              return `<td class="status-cell ${stageCellClass(cell)}" title="${esc(stageCellTitle(cell))}">${stageCellLabel(cell)}</td>`;
            }).join("")}
          </tr>`).join("")}
      </tbody>
    </table>
    </div>`;
}
$("track-btn").addEventListener("click", renderTrackResult);

// Start/Stop/Restart update the screen instantly and push to the Google
// Sheet in the background (see sheet.js). If that background write ends up
// failing, the local change is already undone by the time this fires — just
// surface why and re-render so the screen matches reality again.
onBackgroundError((message) => {
  showGlobal(message);
  refreshOpenOps();
  refreshWizPartStepIfActive();
  renderDeptGrid();
  if (wpStep === 0) renderWpDeptGrid();
});

// ---------- language toggle ----------
function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll(".lang-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.lang === currentLang));
}

function applyLanguage(lang) {
  setStoredLanguage(lang);
  applyStaticTranslations();
  loadPlateNames();
  refreshToolSelects();
  loadEmployeeMachineOptions();
  renderDeptGrid();
  renderWizStep();
  // renderWizStep() only re-sets the breadcrumb — Step 2's "Select Die —
  // <machine>" heading and Step 3's die/department headings live in their
  // own renderers, so re-run those explicitly or they show stale English
  // after switching language mid-wizard.
  if (wizIndex === 1) renderDieGrid();
  refreshWizPartStepIfActive();
  if (wpStep === 0) {
    renderWpDeptGrid();
  } else {
    $("wp-dept-label").textContent = wpFilter.stage ? machineLabel(wpFilter.stage) : "";
    $("wp-breadcrumb").textContent = wpFilter.stage ? machineLabel(wpFilter.stage) : "";
    renderWpEmpTiles();
  }
  refreshParts();
  refreshChildPartsTable();
  refreshDieStatusTable();
  refreshEmployeeTable();
  refreshOpenOps();
  if (trackToolId.value && trackResult.innerHTML.trim()) renderTrackResult();
}

document.querySelectorAll(".lang-btn").forEach((btn) =>
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang)));

// ---------- init ----------

function refreshEverything() {
  refreshToolSelects();
  refreshParts();
  refreshChildPartsTable();
  refreshDieStatusTable();
  loadEmployeeMachineOptions();
  refreshEmployeeTable();
  refreshOpenOps();
  renderDeptGrid();
  renderWizStep();
  if (wpStep === 0) renderWpDeptGrid();
}

// The app opens straight into its last-known data (cached locally — see
// loadCacheFromLocalStorage() in sheet.js) with no "Loading from Google
// Sheet…" wait: every machine tile, die, part and employee already on
// screen instantly. A fresh copy is then fetched from the sheet in the
// background and silently swapped in — visible only if something actually
// changed since the last open. The very first-ever open on a device (no
// cache yet) has nothing to show instantly, so that one case still waits on
// the network, same as before.
async function init() {
  applyStaticTranslations();
  loadPlateNames();
  loadShifts();
  renderWpStep();

  const hasCache = loadCacheFromLocalStorage();
  if (hasCache) {
    refreshEverything();
    if (wizIndex === 1) renderDieGrid();
    refreshWizPartStepIfActive();
  }

  try {
    await loadAll();
    refreshEverything();
    if (wizIndex === 1) renderDieGrid();
    refreshWizPartStepIfActive();
    showGlobal("");
  } catch (err) {
    // sheet.js already phrases these for a shop-floor reader (no internet /
    // opened as a file / sheet script out of date), so pass it straight on.
    // With a cache already on screen this is a quiet background-refresh
    // failure, not a blocker — the banner just explains why what's showing
    // might be a little out of date.
    showGlobal(errText(err, hasCache ? t("errors.refreshFailed") : t("errors.loadFailed")));
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* file:// or unsupported — fine */ });
}

init();
