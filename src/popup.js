const statusEl = document.getElementById("status");
const authButton = document.getElementById("google-auth");
const signOutButton = document.getElementById("google-signout");
const availabilitySection = document.getElementById("availability-section");
const accountsSection = document.getElementById("accounts-section");
const calendarListEl = document.getElementById("calendar-list");
const refreshCalendarsBtn = document.getElementById("refresh-calendars");
const availabilityEl = document.getElementById("availability");
const modeApproachable = document.getElementById("mode-approachable");
const modeBusy = document.getElementById("mode-busy");
const ctxPersonal = document.getElementById("ctx-personal");
const ctxWork = document.getElementById("ctx-work");

// Check if already authenticated on load
async function checkAuthStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" });
    if (res?.authenticated) {
      showAuthenticatedState();
      await loadPrefs();
    }
  } catch (e) {
    // Ignore errors on startup
  }
}

function showAuthenticatedState() {
  authButton.classList.add("hidden");
  signOutButton.classList.remove("hidden");
  availabilitySection.classList.remove("hidden");
  accountsSection.classList.remove("hidden");
  statusEl.textContent = "Connected to Google Calendar";
}

function showUnauthenticatedState() {
  authButton.classList.remove("hidden");
  signOutButton.classList.add("hidden");
  availabilitySection.classList.add("hidden");
  accountsSection.classList.add("hidden");
  statusEl.textContent = "";
}

async function loadPrefs() {
  const res = await chrome.runtime.sendMessage({ type: "GET_PREFS" });
  if (res?.ok) {
    const { mode = "approachable", context = "work" } = res.prefs || {};
    modeApproachable.checked = mode === "approachable";
    modeBusy.checked = mode === "busy";
    ctxPersonal.checked = context === "personal";
    ctxWork.checked = context !== "personal";
    await renderCalendars();
  }
}

async function savePrefs() {
  const mode = modeBusy.checked ? "busy" : "approachable";
  const context = ctxPersonal.checked ? "personal" : "work";
  await chrome.runtime.sendMessage({ type: "SET_PREFS", prefs: { mode, context } });
}

// Auth button
authButton.addEventListener("click", async () => {
  statusEl.textContent = "Connecting...";
  try {
    const res = await chrome.runtime.sendMessage({ type: "GOOGLE_AUTH" });
    if (res?.ok) {
      showAuthenticatedState();
      await loadPrefs();
      await renderCalendars();
    } else {
      statusEl.textContent = `Connection failed: ${res?.error || ""}`;
    }
  } catch (e) {
    statusEl.textContent = `Connection error: ${e?.message || e}`;
  }
});

// Sign out button
signOutButton.addEventListener("click", async () => {
  statusEl.textContent = "Signing out...";
  try {
    const res = await chrome.runtime.sendMessage({ type: "GOOGLE_SIGN_OUT" });
    if (res?.ok) {
      showUnauthenticatedState();
      availabilityEl.value = "";
    } else {
      statusEl.textContent = `Sign out failed: ${res?.error || ""}`;
    }
  } catch (e) {
    statusEl.textContent = `Sign out error: ${e?.message || e}`;
  }
});

// Generate availability button
document.getElementById("gen-availability").addEventListener("click", async () => {
  statusEl.textContent = "Generating availability...";
  availabilityEl.value = "";
  try {
    await savePrefs();
    const res = await chrome.runtime.sendMessage({ type: "GENERATE_AVAILABILITY" });
    if (!res?.ok) {
      statusEl.textContent = `Generation failed: ${res?.error || ""}`;
      return;
    }
    availabilityEl.value = res.text;
    statusEl.textContent = "Generated and copied to clipboard";
    availabilityEl.focus();
    availabilityEl.select();
    document.execCommand("copy");
  } catch (e) {
    statusEl.textContent = `Generation error: ${e?.message || e}`;
  }
});

// Persist changes when toggles are changed
for (const el of [modeApproachable, modeBusy, ctxPersonal, ctxWork]) {
  el.addEventListener("change", savePrefs);
}

async function renderCalendars() {
  calendarListEl.innerHTML = "Loading...";
  try {
    const list = await chrome.runtime.sendMessage({ type: "LIST_CALENDARS" });
    if (!list?.ok) {
      calendarListEl.textContent = list?.error || "Failed to load";
      return;
    }
    const { prefs } = await chrome.storage.sync.get(["prefs"]);
    const selected = new Set((prefs?.selectedCalendars) || []);
    calendarListEl.innerHTML = "";
    for (const cal of list.calendars) {
      const id = `cal-${btoa(cal.id).replace(/=/g, "")}`;
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = id;
      cb.checked = selected.size ? selected.has(cal.id) : !!cal.primary; // default to primary
      cb.addEventListener("change", async () => {
        const newSelected = new Set(selected);
        if (cb.checked) newSelected.add(cal.id); else newSelected.delete(cal.id);
        const arr = Array.from(newSelected);
        await chrome.runtime.sendMessage({ type: "SET_PREFS", prefs: { selectedCalendars: arr } });
      });
      const span = document.createElement("span");
      span.textContent = cal.summary;
      row.appendChild(cb);
      row.appendChild(span);
      calendarListEl.appendChild(row);
    }
  } catch (e) {
    calendarListEl.textContent = String(e?.message || e);
  }
}

refreshCalendarsBtn.addEventListener("click", renderCalendars);

// Initialize
checkAuthStatus();


