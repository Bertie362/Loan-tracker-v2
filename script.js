const STORAGE_KEY = "loans";
const BACKUP_KEY = "lastBackup";

const THEME_KEY = "loanTheme";
const ACCENT_KEY = "loanAccent";

let lastDeleted = null;
let undoTimer = null;
let editingId = null;
let pendingDeleteId = null;

/* ========================
   DATA
======================== */

function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(data)) return [];

    return data.map(item => ({
      id: item.id || crypto.randomUUID(),
      amount: Number(item.amount) || 0,
      type: item.type === "paid" ? "paid" : "lent",
      date: item.date || new Date().toISOString(),
      reason: String(item.reason || "")
    }));
  } catch (e) {
    console.error("Data corrupted", e);
    return [];
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return `£${Number(value).toFixed(2)}`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;

  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  }
}

/* ========================
   BACKUP STATUS
======================== */
function renderLastBackup() {
  const label = document.getElementById("lastBackup");
  if (!label) return;

  const saved = localStorage.getItem(BACKUP_KEY);

  label.className = "backup-text";

  if (!saved) {
    label.textContent = "⚪ Never backed up";
    label.classList.add("backup-none");
    return;
  }

  const backupDate = new Date(saved);
  const now = new Date();
  const diffMs = now - backupDate;

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const time = backupDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });

  let text = "";

  if (diffMins < 1) {
    text = `Just now at ${time}`;
  } else if (diffMins < 60) {
    text = `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    text = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago at ${time}`;
  } else {
    text = `${diffDays} day${diffDays === 1 ? "" : "s"} ago at ${time}`;
  }

  if (diffDays < 7) {
    label.textContent = `🟢 Last Backup: ${text}`;
    label.classList.add("backup-good");
  } else if (diffDays < 30) {
    label.textContent = `🟡 Backup Recommended: ${text}`;
    label.classList.add("backup-warning");
  } else {
    label.textContent = `🔴 Backup Overdue: ${text}`;
    label.classList.add("backup-danger");
  }
}



/* ========================
   BALANCE + MONTH
======================== */

function renderBalance() {
  const data = getData();

  const lent = data
    .filter(item => item.type === "lent")
    .reduce((sum, item) => sum + item.amount, 0);

  const paid = data
    .filter(item => item.type === "paid")
    .reduce((sum, item) => sum + item.amount, 0);

  setText("balance", money(lent - paid));
  setText("totalLent", money(lent));
  setText("totalPaid", money(paid));
}

function renderMonthTitle() {
  const title = document.getElementById("monthTitle");
  if (!title) return;

  const now = new Date();

  const month = now.toLocaleString("en-GB", {
    month: "long",
    year: "numeric"
  });

  title.textContent = `${month} Summary`;
}

function renderMonthlySummary() {
  const now = new Date();

  const monthData = getData().filter(item => {
    const d = new Date(item.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const lent = monthData
    .filter(item => item.type === "lent")
    .reduce((sum, item) => sum + item.amount, 0);

  const paid = monthData
    .filter(item => item.type === "paid")
    .reduce((sum, item) => sum + item.amount, 0);

  setText("monthLent", money(lent));
  setText("monthPaid", money(paid));
  setText("monthBalance", money(lent - paid));
}

/* ========================
   LOG FILTERING
======================== */

function getFilteredLog(data) {
  const search = document.getElementById("search")?.value.toLowerCase() || "";
  const sort = document.getElementById("sort")?.value || "date-desc";

  let result = [...data];

  if (search) {
    result = result.filter(item =>
      item.reason.toLowerCase().includes(search)
    );
  }

  if (sort === "amount-asc") {
    result.sort((a, b) => a.amount - b.amount);
  } else if (sort === "amount-desc") {
    result.sort((a, b) => b.amount - a.amount);
  } else if (sort === "date-asc") {
    result.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else {
    result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return result;
}

/* ========================
   RENDER ENTRIES
======================== */

function createEntryElement(item, showActions = false) {
  const div = document.createElement("div");
  div.className = `${showActions ? "log-item" : "recent-item"} ${item.type} fade-in`;

  div.innerHTML = `
    <div class="entry-info">
      <strong>${money(item.amount)}</strong>
      <p>${item.reason}</p>
      <small>${new Date(item.date).toLocaleString()}</small>
    </div>

    <div class="entry-actions">
      <span class="tag">${item.type.toUpperCase()}</span>

      ${
        showActions
          ? `
            <button class="edit-btn" data-id="${item.id}">Edit</button>
            <button class="delete-btn" data-id="${item.id}">Delete</button>
          `
          : ""
      }
    </div>
  `;

  return div;
}

function renderRecent() {
  const container = document.getElementById("recentList");
  if (!container) return;

  const recent = getData().slice(-5).reverse();
  container.innerHTML = "";

  if (recent.length === 0) {
    container.innerHTML = `<p class="empty">No recent activity yet.</p>`;
    return;
  }

  recent.forEach(item => {
    container.appendChild(createEntryElement(item, false));
  });
}

function renderLog() {
  const container = document.getElementById("logContainer");
  if (!container) return;

  const entries = getFilteredLog(getData());
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = `<p class="empty">No entries found.</p>`;
    return;
  }

  entries.forEach(item => {
    container.appendChild(createEntryElement(item, true));
  });
}

/* ========================
   REFRESH
======================== */

function refreshUI() {
  renderLastBackup();
  renderMonthTitle();
  renderBalance();
  renderMonthlySummary();
  renderRecent();
  renderLog();
  renderUndoBar();
}

/* ========================
   ADD / SETTLE
======================== */

function addEntry(amount, reason, type) {
  const cleanAmount = Number(amount);
  let cleanReason = String(reason || "").trim();

  if (!cleanAmount || cleanAmount <= 0) {
    alert("Enter an amount first.");
    return;
  }

  if (type === "lent" && !cleanReason) {
    alert("Enter a reason for money lent.");
    return;
  }

  if (type === "paid") {
    cleanReason = "Payment received";
  }

  const data = getData();

  data.push({
    id: crypto.randomUUID(),
    amount: cleanAmount,
    reason: cleanReason,
    type,
    date: new Date().toISOString()
  });

  saveData(data);

  const amountBox = document.getElementById("amount");
  const reasonBox = document.getElementById("reason");

  if (amountBox) amountBox.value = "";
  if (reasonBox) reasonBox.value = "";

  refreshUI();
}

function settleBalance() {
  const data = getData();

  const lent = data
    .filter(item => item.type === "lent")
    .reduce((sum, item) => sum + item.amount, 0);

  const paid = data
    .filter(item => item.type === "paid")
    .reduce((sum, item) => sum + item.amount, 0);

  const balance = lent - paid;

  if (balance <= 0) {
    alert("There is no balance to settle.");
    return;
  }

  const confirmed = confirm(`Settle the remaining balance of ${money(balance)}?`);

  if (!confirmed) return;

  data.push({
    id: crypto.randomUUID(),
    amount: balance,
    reason: "Balance settled",
    type: "paid",
    date: new Date().toISOString()
  });

  saveData(data);
  refreshUI();
}

/* ========================
   DELETE + UNDO
======================== */

function requestDelete(id) {
  pendingDeleteId = id;
  createDeleteModal();

  const item = getData().find(entry => entry.id === id);
  if (!item) return;

  document.getElementById("deleteText").textContent =
    `Delete ${money(item.amount)} — ${item.reason}?`;

  document.getElementById("deleteModal").classList.add("show");
}

function confirmDelete() {
  if (!pendingDeleteId) return;

  const data = getData();
  const item = data.find(entry => entry.id === pendingDeleteId);

  if (!item) return;

  lastDeleted = item;

  saveData(data.filter(entry => entry.id !== pendingDeleteId));

  pendingDeleteId = null;
  closeDeleteModal();

  clearTimeout(undoTimer);

  undoTimer = setTimeout(() => {
    lastDeleted = null;
    renderUndoBar();
  }, 7000);

  refreshUI();
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById("deleteModal")?.classList.remove("show");
}

function undoDelete() {
  if (!lastDeleted) return;

  const data = getData();
  data.push(lastDeleted);

  saveData(data);

  lastDeleted = null;
  clearTimeout(undoTimer);

  refreshUI();
}

function renderUndoBar() {
  let bar = document.getElementById("undoBar");

  if (!lastDeleted) {
    if (bar) bar.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement("div");
    bar.id = "undoBar";
    bar.className = "undo-bar";
    document.body.appendChild(bar);
  }

  bar.innerHTML = `
    <span>Entry deleted</span>
    <button id="undoBtn">Undo</button>
  `;

  document.getElementById("undoBtn").onclick = undoDelete;
}

function createDeleteModal() {
  if (document.getElementById("deleteModal")) return;

  const modal = document.createElement("div");
  modal.id = "deleteModal";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal">
      <h2>Delete Entry?</h2>
      <p id="deleteText">Are you sure?</p>

      <div class="modal-actions">
        <button id="cancelDeleteBtn" class="modal-cancel">Cancel</button>
        <button id="confirmDeleteBtn" class="modal-danger">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteModal);
  document.getElementById("confirmDeleteBtn").addEventListener("click", confirmDelete);

  modal.addEventListener("click", e => {
    if (e.target.id === "deleteModal") closeDeleteModal();
  });
}

/* ========================
   EDIT MODAL
======================== */

function createEditModal() {
  if (document.getElementById("editModal")) return;

  const modal = document.createElement("div");
  modal.id = "editModal";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal">
      <h2>Edit Entry</h2>

      <label>Amount (£)</label>
      <input id="editAmount" type="number" />

      <label>Type</label>
      <select id="editType">
        <option value="lent">Money Lent</option>
        <option value="paid">Money Paid Back</option>
      </select>

      <div id="editReasonWrap">
        <label>Reason</label>
        <input id="editReason" type="text" />
      </div>

      <div class="modal-actions">
        <button id="cancelEditBtn" class="modal-cancel">Cancel</button>
        <button id="saveEditBtn" class="modal-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("editType").addEventListener("change", updateEditReasonVisibility);
  document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
  document.getElementById("saveEditBtn").addEventListener("click", saveEditedEntry);

  modal.addEventListener("click", e => {
    if (e.target.id === "editModal") closeEditModal();
  });
}

function updateEditReasonVisibility() {
  const type = document.getElementById("editType").value;
  const wrap = document.getElementById("editReasonWrap");

  wrap.style.display = type === "paid" ? "none" : "block";
}

function openEditModal(id) {
  createEditModal();

  const item = getData().find(entry => entry.id === id);
  if (!item) return;

  editingId = id;

  document.getElementById("editAmount").value = item.amount;
  document.getElementById("editType").value = item.type;
  document.getElementById("editReason").value =
    item.type === "paid" ? "" : item.reason;

  updateEditReasonVisibility();

  document.getElementById("editModal").classList.add("show");
}

function closeEditModal() {
  editingId = null;
  document.getElementById("editModal")?.classList.remove("show");
}

function saveEditedEntry() {
  if (!editingId) return;

  const amount = Number(document.getElementById("editAmount").value);
  const type = document.getElementById("editType").value;
  let reason = document.getElementById("editReason").value.trim();

  if (!amount || amount <= 0) {
    alert("Enter a valid amount.");
    return;
  }

  if (type === "lent" && !reason) {
    alert("Enter a reason for money lent.");
    return;
  }

  if (type === "paid") {
    reason = "Payment received";
  }

  const updated = getData().map(entry => {
    if (entry.id !== editingId) return entry;

    return {
      ...entry,
      amount,
      type,
      reason
    };
  });

  saveData(updated);
  closeEditModal();
  refreshUI();
}

/* ========================
   BACKUP
======================== */

function exportBackup() {
  const data = getData();

  if (!data.length) {
    alert("No entries to back up yet.");
    return;
  }

  const backup = JSON.stringify(data, null, 2);
  const blob = new Blob([backup], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = url;
  a.download = `loan-tracker-backup-${today}.json`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  renderLastBackup();

  URL.revokeObjectURL(url);

  alert(`Backup exported: ${data.length} entries saved.`);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);

      if (!Array.isArray(imported)) {
        alert("Invalid backup file.");
        return;
      }

      const cleaned = imported.map(item => ({
        id: item.id || crypto.randomUUID(),
        amount: Number(item.amount) || 0,
        type: item.type === "paid" ? "paid" : "lent",
        date: item.date || new Date().toISOString(),
        reason: String(item.reason || "")
      }));

      saveData(cleaned);

      event.target.value = "";

      refreshUI();

      alert("Backup restored successfully.");
    } catch (err) {
      console.error(err);
      alert("Could not restore backup.");
    }
  };

  reader.readAsText(file);
}

/* ========================
   APPEARANCE SETTINGS
======================== */

function getThemeSetting() {
  return localStorage.getItem(THEME_KEY) || "system";
}

function getAccentSetting() {
  return localStorage.getItem(ACCENT_KEY) || "blue";
}

function applyAppearanceSettings() {
  const theme = getThemeSetting();
  const accent = getAccentSetting();

  document.body.classList.remove("theme-light", "theme-dark");

  document.body.classList.remove(
    "accent-blue",
    "accent-green",
    "accent-purple",
    "accent-orange",
    "accent-slate"
  );

  if (theme === "light") {
    document.body.classList.add("theme-light");
  }

  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  }

  if (theme === "system") {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    if (prefersLight) {
      document.body.classList.add("theme-light");
    }
  }

  document.body.classList.add(`accent-${accent}`);
}

function setupSettingsPage() {
  const themeButtons = document.querySelectorAll("[data-theme]");
  const accentButtons = document.querySelectorAll("[data-accent]");

  themeButtons.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.theme === getThemeSetting()
    );

    button.addEventListener("click", () => {
      localStorage.setItem(THEME_KEY, button.dataset.theme);
      applyAppearanceSettings();
      setupSettingsPage();
    });
  });

  accentButtons.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.accent === getAccentSetting()
    );

    button.addEventListener("click", () => {
      localStorage.setItem(ACCENT_KEY, button.dataset.accent);
      applyAppearanceSettings();
      setupSettingsPage();
    });
  });
}

/* ========================
   DEVELOPER MENU
======================== */

let versionTapCount = 0;

function setupDeveloperMenu(){

    const version=document.getElementById("appVersion");

    if(!version) return;

    version.addEventListener("click",()=>{

        versionTapCount++;

        if(versionTapCount<7){

            const remaining=7-versionTapCount;

            if(remaining<=3){
                alert(`${remaining} more taps to unlock Developer Mode`);
            }

            return;
        }

        localStorage.setItem("developerMode","true");

        showDeveloperMenu();

    });

    showDeveloperMenu();

}

function showDeveloperMenu(){

    if(localStorage.getItem("developerMode")!=="true")
        return;

    document
        .getElementById("developerMenu")
        ?.classList.remove("hidden");

}

async function clearPWACache(){

    if("caches" in window){

        const keys=await caches.keys();

        for(const key of keys){
            await caches.delete(key);
        }

    }

    alert("Cache cleared.");

}

function refreshApp(){

    location.reload();

}

async function reloadPWA(){

    if(navigator.serviceWorker){

        const regs=await navigator.serviceWorker.getRegistrations();

        for(const reg of regs){

            reg.update();

        }

    }

    location.reload();

}

/* ========================
   INIT
======================== */

document.addEventListener("DOMContentLoaded", () => {
  applyAppearanceSettings();
  setupSettingsPage();
  refreshUI();

  setupDeveloperMenu();

  document
    .getElementById("refreshAppBtn")
    ?.addEventListener("click", refreshApp);

  document
    .getElementById("clearCacheBtn")
    ?.addEventListener("click", clearPWACache);

  document
    .getElementById("reloadPWABtn")
    ?.addEventListener("click", reloadPWA);

  document.getElementById("lendBtn")?.addEventListener("click", () => {
    addEntry(
      document.getElementById("amount").value,
      document.getElementById("reason").value,
      "lent"
    );
  });

  document.getElementById("paidBtn")?.addEventListener("click", () => {
    addEntry(
      document.getElementById("amount").value,
      document.getElementById("reason").value,
      "paid"
    );
  });

  document.getElementById("settleBtn")?.addEventListener("click", settleBalance);

  document.getElementById("search")?.addEventListener("input", renderLog);
  document.getElementById("sort")?.addEventListener("change", renderLog);

  document.getElementById("exportBtn")?.addEventListener("click", exportBackup);
  document.getElementById("importInput")?.addEventListener("change", importBackup);

  document.addEventListener("click", e => {
    const deleteButton = e.target.closest(".delete-btn");
    const editButton = e.target.closest(".edit-btn");

    if (deleteButton) requestDelete(deleteButton.dataset.id);
    if (editButton) openEditModal(editButton.dataset.id);
  });

  window.addEventListener("focus", refreshUI);
  window.addEventListener("pageshow", refreshUI);
});

/* ========================
   GLOBALS
======================== */

window.addEntry = addEntry;
window.refreshUI = refreshUI;
