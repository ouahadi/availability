const statusEl = document.getElementById("status");
const authButton = document.getElementById("google-auth");
const userProfileEl = document.getElementById("user-profile");
const profilePictureEl = document.getElementById("profile-picture");
const profileNameEl = document.getElementById("profile-name");
const profileEmailEl = document.getElementById("profile-email");
const connectionStatusEl = document.getElementById("connection-status");
const availabilitySection = document.getElementById("availability-section");
const availabilityEl = document.getElementById("availability");
const toastEl = document.getElementById("toast");
const modeApproachable = document.getElementById("mode-approachable");
const modeBusy = document.getElementById("mode-busy");
const ctxPersonal = document.getElementById("ctx-personal");
const ctxWork = document.getElementById("ctx-work");
const modeSwitch = document.getElementById("mode-switch");
const contextSegment = document.getElementById("context-segment");

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

async function showAuthenticatedState() {
  authButton.classList.add("hidden");
  userProfileEl.classList.remove("hidden");
  connectionStatusEl.classList.remove("hidden");
  availabilitySection.classList.remove("hidden");
  statusEl.textContent = "";
  
  // Fetch and display user profile
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_USER_PROFILE" });
    if (res?.ok && res.profile) {
      profilePictureEl.src = res.profile.picture || "";
      profileNameEl.textContent = res.profile.name || "User";
      profileEmailEl.textContent = res.profile.email || "";
    }
  } catch (e) {
    console.error("Failed to fetch user profile:", e);
  }
  
  // Automatically generate and copy availability
  await autoGenerateAvailability();
}

function showUnauthenticatedState() {
  authButton.classList.remove("hidden");
  userProfileEl.classList.add("hidden");
  connectionStatusEl.classList.add("hidden");
  availabilitySection.classList.add("hidden");
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
    // Reflect on custom controls
    modeSwitch.classList.toggle("on", mode === "busy");
    for (const btn of contextSegment.querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.value === context);
    }
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
    } else {
      statusEl.textContent = `Connection failed: ${res?.error || ""}`;
    }
  } catch (e) {
    statusEl.textContent = `Connection error: ${e?.message || e}`;
  }
});


// Auto-generate availability function
async function autoGenerateAvailability() {
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
    statusEl.textContent = "Auto-generated & copied to clipboard";
    
    // Auto-copy to clipboard
    availabilityEl.focus();
    availabilityEl.select();
    document.execCommand("copy");
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2000);
  } catch (e) {
    statusEl.textContent = `Generation error: ${e?.message || e}`;
  }
}

// Generate availability button
const copyBtn = document.getElementById("gen-availability");
copyBtn.addEventListener("click", async () => {
  statusEl.textContent = "Generating availability...";
  availabilityEl.value = "";
  copyBtn.disabled = true;
  try {
    await savePrefs();
    const res = await chrome.runtime.sendMessage({ type: "GENERATE_AVAILABILITY" });
    if (!res?.ok) {
      statusEl.textContent = `Generation failed: ${res?.error || ""}`;
      return;
    }
    availabilityEl.value = res.text;
    statusEl.textContent = "Copied to clipboard";
    availabilityEl.focus();
    availabilityEl.select();
    document.execCommand("copy");
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1200);
  } catch (e) {
    statusEl.textContent = `Generation error: ${e?.message || e}`;
  }
  copyBtn.disabled = false;
});

// Persist changes and regenerate availability when toggles are changed
for (const el of [modeApproachable, modeBusy, ctxPersonal, ctxWork]) {
  el.addEventListener("change", async () => {
    await savePrefs();
    await autoGenerateAvailability();
  });
}

// Custom switch and segmented control wiring
modeSwitch.addEventListener("click", async () => {
  const isBusy = !modeSwitch.classList.contains("on");
  modeSwitch.classList.toggle("on", isBusy);
  modeBusy.checked = isBusy;
  modeApproachable.checked = !isBusy;
  await savePrefs();
  await autoGenerateAvailability();
});

contextSegment.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  for (const b of contextSegment.querySelectorAll("button")) b.classList.remove("active");
  btn.classList.add("active");
  const val = btn.dataset.value;
  ctxPersonal.checked = val === "personal";
  ctxWork.checked = val !== "personal";
  await savePrefs();
  await autoGenerateAvailability();
});


// Initialize
checkAuthStatus();


