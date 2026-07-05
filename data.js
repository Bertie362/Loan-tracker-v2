const STORAGE_KEY = "loans";

const DEFAULT_BORROWER_ID = "default";
const DEFAULT_BORROWER_NAME = "Default";

function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(data)) return [];

    return data.map(item => ({
      id: item.id || crypto.randomUUID(),
      borrowerId: item.borrowerId || DEFAULT_BORROWER_ID,
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

function migrateDefaultBorrower() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;

    let changed = false;

    const migrated = data.map(item => {
      if (!item.borrowerId) {
        changed = true;
        return {
          ...item,
          borrowerId: DEFAULT_BORROWER_ID
        };
      }

      return item;
    });

    if (changed) {
      saveData(migrated);
    }
  } catch (e) {
    console.error("Borrower migration failed", e);
  }
}