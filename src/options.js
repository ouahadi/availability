const maxSlotsInput = document.getElementById("maxSlots");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");
const accountsListEl = document.getElementById("accounts-list");
const refreshCalendarsBtn = document.getElementById("refresh-calendars");
const signOutBtn = document.getElementById("sign-out");

async function load() {
  const { prefs } = await chrome.storage.sync.get(["prefs"]);
  const maxSlots = Number(prefs?.maxSlots) || 3;
  maxSlotsInput.value = String(maxSlots);
  await renderCalendars();
}

async function save() {
  const maxSlots = Math.max(1, Number(maxSlotsInput.value || 3));
  const current = (await chrome.storage.sync.get(["prefs"])).prefs || {};
  const updated = { ...current, maxSlots };
  await chrome.storage.sync.set({ prefs: updated });
  savedEl.textContent = "Saved";
  setTimeout(() => (savedEl.textContent = ""), 1200);
}

async function renderCalendars() {
  accountsListEl.innerHTML = "Loading...";
  try {
    const list = await chrome.runtime.sendMessage({ type: "LIST_CALENDARS" });
    if (!list?.ok) {
      accountsListEl.textContent = list?.error || "Failed to load";
      return;
    }
    const { prefs } = await chrome.storage.sync.get(["prefs"]);
    const selected = new Set((prefs?.selectedCalendars) || []);
    accountsListEl.innerHTML = "";
    for (const cal of list.calendars) {
      const id = `cal-${btoa(cal.id).replace(/=/g, "")}`;
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "space-between";
      wrapper.style.gap = "10px";
      wrapper.style.padding = "10px 12px";
      wrapper.style.borderRadius = "10px";
      wrapper.style.background = "#f5f5f5";
      wrapper.style.border = "1px solid #ddd";
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      const icon = document.createElement("span");
      icon.textContent = "📅";
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = cal.summary;
      left.appendChild(icon);
      left.appendChild(label);
      const right = document.createElement("div");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = id;
      cb.checked = selected.size ? selected.has(cal.id) : !!cal.primary;
      const check = document.createElement("span");
      check.textContent = cb.checked ? "✓" : "";
      check.style.width = "18px";
      check.style.height = "18px";
      check.style.borderRadius = "50%";
      check.style.border = "1px solid #ccc";
      check.style.display = "inline-flex";
      check.style.alignItems = "center";
      check.style.justifyContent = "center";
      check.style.fontSize = "12px";
      check.style.color = "#0f0";
      cb.addEventListener("change", async () => {
        const newSelected = new Set(selected);
        if (cb.checked) newSelected.add(cal.id); else newSelected.delete(cal.id);
        const arr = Array.from(newSelected);
        check.textContent = cb.checked ? "✓" : "";
        await chrome.runtime.sendMessage({ type: "SET_PREFS", prefs: { selectedCalendars: arr } });
      });
      right.appendChild(cb);
      right.appendChild(check);
      wrapper.appendChild(left);
      wrapper.appendChild(right);
      accountsListEl.appendChild(wrapper);
    }
  } catch (e) {
    accountsListEl.textContent = String(e?.message || e);
  }
}

signOutBtn.addEventListener("click", async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GOOGLE_SIGN_OUT" });
    if (res?.ok) {
      signOutBtn.textContent = "Signed out";
      setTimeout(() => window.close(), 1000);
    } else {
      alert(`Sign out failed: ${res?.error || ""}`);
    }
  } catch (e) {
    alert(`Sign out error: ${e?.message || e}`);
  }
});

saveBtn.addEventListener("click", save);
refreshCalendarsBtn.addEventListener("click", renderCalendars);
load();


