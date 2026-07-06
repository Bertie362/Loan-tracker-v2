const STORAGE_KEY = "loans";
const BORROWERS_KEY = "borrowers";

const DEFAULT_BORROWER_ID = "default";
const DEFAULT_BORROWER_NAME = "Default";

/* ========================
   LOANS
======================== */

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

/* ========================
   BORROWERS
======================== */

function getBorrowers() {
  try {
    const raw = localStorage.getItem(BORROWERS_KEY);
    const borrowers = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(borrowers) || borrowers.length === 0) {
      return [
        {
          id: DEFAULT_BORROWER_ID,
          name: DEFAULT_BORROWER_NAME
        }
      ];
    }

    return borrowers.map(borrower => ({
      id: borrower.id || crypto.randomUUID(),
      name: String(borrower.name || DEFAULT_BORROWER_NAME)
    }));
  } catch (e) {
    console.error("Borrower data corrupted", e);

    return [
      {
        id: DEFAULT_BORROWER_ID,
        name: DEFAULT_BORROWER_NAME
      }
    ];
  }
}

function saveBorrowers(borrowers) {
  localStorage.setItem(BORROWERS_KEY, JSON.stringify(borrowers));
}

function getBorrowerName(borrowerId) {
  const borrower = getBorrowers().find(b => b.id === borrowerId);
  return borrower ? borrower.name : DEFAULT_BORROWER_NAME;
}

/* ========================
   MIGRATION
======================== */

function migrateDefaultBorrower() {
  const borrowers = getBorrowers();

  const hasDefault = borrowers.some(b => b.id === DEFAULT_BORROWER_ID);

  if (!hasDefault) {
    borrowers.unshift({
      id: DEFAULT_BORROWER_ID,
      name: DEFAULT_BORROWER_NAME
    });
  }

  saveBorrowers(borrowers);

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
function addBorrower(name) {
  const cleanName = String(name || "").trim();

  if (!cleanName) return false;

  const borrowers = getBorrowers();

  const exists = borrowers.some(
    b => b.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (exists) return false;

  borrowers.push({
    id: crypto.randomUUID(),
    name: cleanName
  });

  saveBorrowers(borrowers);

  return true;
}