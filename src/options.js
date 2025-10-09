const maxSlotsInput = document.getElementById("maxSlots");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");

async function load() {
  const { prefs } = await chrome.storage.sync.get(["prefs"]);
  const maxSlots = Number(prefs?.maxSlots) || 3;
  maxSlotsInput.value = String(maxSlots);
}

async function save() {
  const maxSlots = Math.max(1, Number(maxSlotsInput.value || 3));
  const current = (await chrome.storage.sync.get(["prefs"])).prefs || {};
  const updated = { ...current, maxSlots };
  await chrome.storage.sync.set({ prefs: updated });
  savedEl.textContent = "Saved";
  setTimeout(() => (savedEl.textContent = ""), 1200);
}

saveBtn.addEventListener("click", save);
load();


