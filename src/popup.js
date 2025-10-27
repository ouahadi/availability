import { AccountManager } from "./account-manager.js";

const statusEl = document.getElementById("status");
const authButton = document.getElementById("google-auth");
const accountsSection = document.getElementById("accounts-section");
const accountsList = document.getElementById("accounts-list");
const addAccountBtn = document.getElementById("add-account");
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
const targetTimezoneSelect = document.getElementById("target-timezone");

// Check if already authenticated on load
async function checkAuthStatus() {
  try {
    const accountsRes = await chrome.runtime.sendMessage({ type: "LIST_ACCOUNTS" });
    if (accountsRes?.ok && accountsRes.accounts.length > 0) {
      // Check if we have any active accounts
      const activeAccounts = accountsRes.accounts.filter(acc => acc.active);
      if (activeAccounts.length > 0) {
        showAuthenticatedState();
        await loadPrefs();
      } else {
        // All accounts are inactive, show unauthenticated state
        showUnauthenticatedState();
      }
    } else {
      showUnauthenticatedState();
    }
  } catch (e) {
    console.warn("Failed to check auth status:", e);
    // On error, show unauthenticated state to be safe
    showUnauthenticatedState();
  }
}

async function showAuthenticatedState() {
  authButton.classList.add("hidden");
  accountsSection.classList.remove("hidden");
  availabilitySection.classList.remove("hidden");
  statusEl.textContent = "";
  
  // Populate timezone options
  populateTimezoneOptions();
  
  // Load and display accounts
  await renderAccounts();
  
  // Automatically generate and copy availability
  await autoGenerateAvailability();
}

async function renderAccounts() {
  try {
    const accountsRes = await chrome.runtime.sendMessage({ type: "LIST_ACCOUNTS" });
    if (!accountsRes?.ok) {
      accountsList.innerHTML = '<div style="color: #ff6b9d; text-align: center; padding: 8px;">Failed to load accounts</div>';
      return;
    }

    accountsList.innerHTML = "";
    
    for (const account of accountsRes.accounts) {
      const accountItem = document.createElement("div");
      accountItem.className = "account-item";
      
      const left = document.createElement("div");
      left.className = "left";
      
      const accountText = document.createElement("span");
      accountText.textContent = account.email;
      accountText.style.fontSize = "13px";
      accountText.style.fontWeight = account.active ? "600" : "400";
      accountText.style.opacity = account.active ? "1" : "0.6";
      
      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";
      
      // Status dot
      const statusDot = document.createElement("div");
      statusDot.style.width = "8px";
      statusDot.style.height = "8px";
      statusDot.style.borderRadius = "50%";
      
      if (account.active) {
        // Check if account needs reauth by trying to get a token
        try {
          const tokenRes = await chrome.runtime.sendMessage({ 
            type: "CHECK_ACCOUNT_STATUS", 
            accountId: account.id 
          });
          
          if (tokenRes?.ok) {
            if (tokenRes.status === 'needs_reauth') {
              statusDot.style.background = "#f59e0b"; // Amber
              statusDot.title = "Needs reconnection";
              
              // Add retry icon
              const retryIcon = document.createElement("span");
              retryIcon.textContent = "↻";
              retryIcon.style.cursor = "pointer";
              retryIcon.style.fontSize = "12px";
              retryIcon.style.color = "#f59e0b";
              retryIcon.title = "Click to reconnect";
              retryIcon.addEventListener("click", async () => {
                await reconnectAccount(account.id);
              });
              right.appendChild(retryIcon);
            } else if (tokenRes.status === 'active') {
              statusDot.style.background = "#10b981"; // Green
              statusDot.title = "Connected";
            } else {
              statusDot.style.background = "#ef4444"; // Red
              statusDot.title = "Connection error";
            }
          } else {
            // If status check failed, assume it needs reauth
            statusDot.style.background = "#f59e0b"; // Amber
            statusDot.title = "Status unknown - needs reconnection";
            
            const retryIcon = document.createElement("span");
            retryIcon.textContent = "↻";
            retryIcon.style.cursor = "pointer";
            retryIcon.style.fontSize = "12px";
            retryIcon.style.color = "#f59e0b";
            retryIcon.title = "Click to reconnect";
            retryIcon.addEventListener("click", async () => {
              await reconnectAccount(account.id);
            });
            right.appendChild(retryIcon);
          }
        } catch (error) {
          console.warn(`Failed to check status for account ${account.email}:`, error);
          // Don't fail the entire rendering - just mark this account as needing attention
          statusDot.style.background = "#f59e0b"; // Amber
          statusDot.title = "Status check failed - needs reconnection";
          
          const retryIcon = document.createElement("span");
          retryIcon.textContent = "↻";
          retryIcon.style.cursor = "pointer";
          retryIcon.style.fontSize = "12px";
          retryIcon.style.color = "#f59e0b";
          retryIcon.title = "Click to reconnect";
          retryIcon.addEventListener("click", async () => {
            await reconnectAccount(account.id);
          });
          right.appendChild(retryIcon);
        }
      } else {
        statusDot.style.background = "#6b7280"; // Gray
        statusDot.title = "Inactive";
      }
      
      left.appendChild(accountText);
      right.appendChild(statusDot);
      
      accountItem.appendChild(left);
      accountItem.appendChild(right);
      accountsList.appendChild(accountItem);
    }
  } catch (e) {
    accountsList.innerHTML = '<div style="color: #ff6b9d; text-align: center; padding: 8px;">Error loading accounts</div>';
  }
}

async function reconnectAccount(accountId) {
  try {
    const res = await chrome.runtime.sendMessage({ 
      type: "RECONNECT_ACCOUNT", 
      accountId: accountId 
    });
    
    if (res?.success) {
      await renderAccounts(); // Refresh the account list
    } else {
      statusEl.textContent = AccountManager.getUserFriendlyError(res?.error || "Reconnection failed");
    }
  } catch (error) {
    statusEl.textContent = AccountManager.getUserFriendlyError(error.message);
  }
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

// Populate timezone options
function populateTimezoneOptions() {
  // Common timezone offsets from UTC
  const timezones = [
    { offset: -12, name: "UTC-12" },
    { offset: -11, name: "UTC-11" },
    { offset: -10, name: "UTC-10" },
    { offset: -9, name: "UTC-9" },
    { offset: -8, name: "UTC-8" },
    { offset: -7, name: "UTC-7" },
    { offset: -6, name: "UTC-6" },
    { offset: -5, name: "UTC-5" },
    { offset: -4, name: "UTC-4" },
    { offset: -3, name: "UTC-3" },
    { offset: -2, name: "UTC-2" },
    { offset: -1, name: "UTC-1" },
    { offset: 0, name: "UTC+0" },
    { offset: 1, name: "UTC+1" },
    { offset: 2, name: "UTC+2" },
    { offset: 3, name: "UTC+3" },
    { offset: 4, name: "UTC+4" },
    { offset: 5, name: "UTC+5" },
    { offset: 6, name: "UTC+6" },
    { offset: 7, name: "UTC+7" },
    { offset: 8, name: "UTC+8" },
    { offset: 9, name: "UTC+9" },
    { offset: 10, name: "UTC+10" },
    { offset: 11, name: "UTC+11" },
    { offset: 12, name: "UTC+12" }
  ];
  
  // Get local timezone offset
  const localOffset = -new Date().getTimezoneOffset() / 60;
  
  // Add local timezone option
  targetTimezoneSelect.innerHTML = '<option value="local">My Timezone (Local)</option>';
  
  // Add other timezone options
  for (const tz of timezones) {
    if (tz.offset === localOffset) continue; // Skip local as it's already added
    const option = document.createElement('option');
    option.value = tz.offset;
    option.textContent = `GMT${tz.offset >= 0 ? '+' : ''}${tz.offset} (${tz.name})`;
    targetTimezoneSelect.appendChild(option);
  }
}

// Convert availability text to target timezone
function convertAvailabilityToTimezone(text, targetOffset) {
  const localOffset = -new Date().getTimezoneOffset() / 60;
  
  // Remove any existing header
  const cleanedText = text.replace(/^My availability in .+? is as follows:\s*\n*/i, '').trim();
  
  // Always add header with current timezone info
  let header = "";
  if (targetOffset === "local") {
    header = `My availability in GMT${localOffset >= 0 ? '+' : ''}${localOffset} is as follows:\n\n`;
    return header + cleanedText;
  } else {
    const offsetDiff = targetOffset - localOffset;
    
    // Parse availability text and convert times
    const lines = cleanedText.split('\n');
    const converted = lines.map(line => {
      if (!line.trim()) return line;
      
      // Check if this is a time range line
      const timeRangeMatch = line.match(/(.+?)\s+-\s+(\d{2}):(\d{2})[:\s]*-(\d{2}):(\d{2})/);
      if (timeRangeMatch) {
        const [, datePart, startH, startM, endH, endM] = timeRangeMatch;
        
        // Convert times
        const startTime = addHours(parseInt(startH), parseInt(startM), offsetDiff);
        const endTime = addHours(parseInt(endH), parseInt(endM), offsetDiff);
        
        return `${datePart} - ${startTime.hours.toString().padStart(2, '0')}:${startTime.minutes.toString().padStart(2, '0')}-${endTime.hours.toString().padStart(2, '0')}:${endTime.minutes.toString().padStart(2, '0')}`;
      }
      
      return line;
    });
    
    const targetOffsetStr = `GMT ${targetOffset >= 0 ? '+' : ''}${targetOffset}`;
    header = `My availability in ${targetOffsetStr} is as follows:\n\n`;
    
    return header + converted.join('\n');
  }
}

// Helper function to add hours to time
function addHours(hours, minutes, hoursToAdd) {
  const totalMinutes = hours * 60 + minutes + hoursToAdd * 60;
  const resultHours = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  return {
    hours: Math.floor(resultHours / 60),
    minutes: resultHours % 60
  };
}

// Auth button
authButton.addEventListener("click", async () => {
  statusEl.textContent = "Connecting...";
  try {
    const res = await chrome.runtime.sendMessage({ type: "GOOGLE_AUTH" });
    if (res?.ok) {
      statusEl.textContent = "";
      showAuthenticatedState();
      await loadPrefs();
    } else {
      statusEl.textContent = AccountManager.getUserFriendlyError(res?.error || "Connection failed");
    }
  } catch (e) {
    statusEl.textContent = AccountManager.getUserFriendlyError(e?.message || e);
  }
});

// Add account button
addAccountBtn.addEventListener("click", async () => {
  addAccountBtn.textContent = "Adding...";
  addAccountBtn.disabled = true;
  
  try {
    const res = await chrome.runtime.sendMessage({ type: "ADD_GOOGLE_ACCOUNT" });
    if (res?.success) {
      await renderAccounts();
      addAccountBtn.textContent = "Added ✓";
      setTimeout(() => {
        addAccountBtn.textContent = "+ Add Account";
        addAccountBtn.disabled = false;
      }, 2000);
    } else {
      addAccountBtn.textContent = "+ Add Account";
      addAccountBtn.disabled = false;
      statusEl.textContent = AccountManager.getUserFriendlyError(res?.error || "Failed to add account");
    }
  } catch (e) {
    addAccountBtn.textContent = "+ Add Account";
    addAccountBtn.disabled = false;
    statusEl.textContent = AccountManager.getUserFriendlyError(e?.message || e);
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
      const friendlyError = AccountManager.getUserFriendlyError(res?.error || "Generation failed");
      statusEl.textContent = `Generation failed: ${friendlyError}`;
      return;
    }
    
    // Apply timezone conversion
    const targetOffset = targetTimezoneSelect.value === "local" ? "local" : parseInt(targetTimezoneSelect.value);
    const convertedText = convertAvailabilityToTimezone(res.text, targetOffset);
    
    availabilityEl.value = convertedText;
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
      const friendlyError = AccountManager.getUserFriendlyError(res?.error || "Generation failed");
      statusEl.textContent = `Generation failed: ${friendlyError}`;
      return;
    }
    
    // Apply timezone conversion
    const targetOffset = targetTimezoneSelect.value === "local" ? "local" : parseInt(targetTimezoneSelect.value);
    const convertedText = convertAvailabilityToTimezone(res.text, targetOffset);
    
    availabilityEl.value = convertedText;
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

// Timezone selector change handler
targetTimezoneSelect.addEventListener("change", async () => {
  // Reconvert the current availability text
  const currentText = availabilityEl.value;
  if (currentText) {
    const targetOffset = targetTimezoneSelect.value === "local" ? "local" : parseInt(targetTimezoneSelect.value);
    const convertedText = convertAvailabilityToTimezone(currentText, targetOffset);
    availabilityEl.value = convertedText;
    
    // Copy to clipboard
    availabilityEl.focus();
    availabilityEl.select();
    document.execCommand("copy");
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1200);
  }
});


// Initialize
checkAuthStatus();


