const maxSlotsInput = document.getElementById("maxSlots");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");
const accountsListEl = document.getElementById("accounts-list");
const refreshCalendarsBtn = document.getElementById("refresh-calendars");
const signOutBtn = document.getElementById("sign-out");
const addGoogleAccountBtn = document.getElementById("add-google-account");

// Debug elements
const debugEventsBtn = document.getElementById("debug-events");
const debugAvailabilityBtn = document.getElementById("debug-availability");
const debugClearBtn = document.getElementById("debug-clear");
const debugOutputEl = document.getElementById("debug-output");

// Helper function to get account email from account ID for logging
async function getAccountEmail(accountId) {
  try {
    const { accounts } = await chrome.storage.sync.get(["accounts"]);
    const account = (accounts || []).find(acc => acc.id === accountId);
    return account ? account.email : accountId;
  } catch (error) {
    return accountId; // Fallback to account ID if we can't get email
  }
}

async function load() {
  const { prefs } = await chrome.storage.sync.get(["prefs"]);
  const maxSlots = Number(prefs?.maxSlots) || 3;
  maxSlotsInput.value = String(maxSlots);
  await renderAccounts();
}

async function save() {
  const maxSlots = Math.max(1, Number(maxSlotsInput.value || 3));
  const current = (await chrome.storage.sync.get(["prefs"])).prefs || {};
  const updated = { ...current, maxSlots };
  await chrome.storage.sync.set({ prefs: updated });
  savedEl.textContent = "Saved";
  setTimeout(() => (savedEl.textContent = ""), 1200);
}

async function renderAccounts() {
  accountsListEl.innerHTML = "Loading...";
  try {
    // Load accounts
    const accountsResponse = await chrome.runtime.sendMessage({ type: "LIST_ACCOUNTS" });
    if (!accountsResponse?.ok) {
      accountsListEl.textContent = accountsResponse?.error || "Failed to load accounts";
      return;
    }

    // Load calendars
    const calendarsResponse = await chrome.runtime.sendMessage({ type: "LIST_CALENDARS" });
    if (!calendarsResponse?.ok) {
      accountsListEl.textContent = calendarsResponse?.error || "Failed to load calendars";
      return;
    }

    const { prefs } = await chrome.storage.sync.get(["prefs"]);
    const selectedCalendars = new Set((prefs?.selectedCalendars) || []);
    const activeAccounts = new Set((prefs?.activeAccounts) || []);

    accountsListEl.innerHTML = "";

    // Render accounts
    for (const account of accountsResponse.accounts) {
      const accountWrapper = document.createElement("div");
      accountWrapper.style.marginBottom = "16px";
      
      // Simple account header
      const accountHeader = document.createElement("div");
      accountHeader.style.display = "flex";
      accountHeader.style.alignItems = "center";
      accountHeader.style.justifyContent = "space-between";
      accountHeader.style.padding = "10px 12px";
      accountHeader.style.borderRadius = "6px";
      accountHeader.style.background = activeAccounts.has(account.id) ? "#e8f0fe" : "#f8f9fa";
      accountHeader.style.border = `1px solid ${activeAccounts.has(account.id) ? "#4285f4" : "#ddd"}`;
      accountHeader.style.marginBottom = "8px";

      // Account info
      const accountInfo = document.createElement("div");
      accountInfo.textContent = `${account.name || account.email} (${account.email})`;
      accountInfo.style.fontSize = "14px";
      accountInfo.style.fontWeight = activeAccounts.has(account.id) ? "600" : "400";

      // Account actions
      const accountActions = document.createElement("div");
      accountActions.style.display = "flex";
      accountActions.style.alignItems = "center";
      accountActions.style.gap = "8px";

      // Active toggle
      const activeToggle = document.createElement("input");
      activeToggle.type = "checkbox";
      activeToggle.checked = activeAccounts.has(account.id);
      activeToggle.style.margin = "0";
      activeToggle.addEventListener("change", async () => {
        await chrome.runtime.sendMessage({ 
          type: "TOGGLE_ACCOUNT_ACTIVE", 
          accountId: account.id,
          active: activeToggle.checked
        });
        await renderAccounts();
      });

      // Remove button
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.style.background = "none";
      removeBtn.style.border = "1px solid #dc3545";
      removeBtn.style.color = "#dc3545";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.fontSize = "12px";
      removeBtn.style.padding = "4px 8px";
      removeBtn.style.borderRadius = "4px";
      
      removeBtn.addEventListener("click", async () => {
        if (confirm(`Remove ${account.email}?`)) {
          const response = await chrome.runtime.sendMessage({ type: "REMOVE_ACCOUNT", accountId: account.id });
          if (response?.ok) {
            await renderAccounts();
          } else {
            alert(`Failed to remove account: ${response?.error || "Unknown error"}`);
          }
        }
      });

      accountActions.appendChild(activeToggle);
      accountActions.appendChild(removeBtn);
      
      accountHeader.appendChild(accountInfo);
      accountHeader.appendChild(accountActions);
      accountWrapper.appendChild(accountHeader);

      // Render calendars for this account (only if active)
      const accountCalendars = calendarsResponse.calendars.filter(cal => cal.accountId === account.id);
      if (accountCalendars.length > 0 && activeAccounts.has(account.id)) {
        const calendarsContainer = document.createElement("div");
        calendarsContainer.style.marginTop = "8px";
        calendarsContainer.style.marginLeft = "16px";
        
        for (const cal of accountCalendars) {
          const calId = `cal-${btoa(cal.id).replace(/=/g, "")}`;
          const calWrapper = document.createElement("div");
          calWrapper.style.display = "flex";
          calWrapper.style.alignItems = "center";
          calWrapper.style.justifyContent = "space-between";
          calWrapper.style.gap = "10px";
          calWrapper.style.padding = "6px 10px";
          calWrapper.style.borderRadius = "4px";
          calWrapper.style.background = "#f5f5f5";
          calWrapper.style.border = "1px solid #ddd";
          calWrapper.style.fontSize = "12px";
          calWrapper.style.marginBottom = "2px";

          const calLabel = document.createElement("label");
          calLabel.htmlFor = calId;
          calLabel.textContent = cal.summary;
          calLabel.style.cursor = "pointer";
          calLabel.style.flex = "1";

          const calCheckbox = document.createElement("input");
          calCheckbox.type = "checkbox";
          calCheckbox.id = calId;
          calCheckbox.checked = selectedCalendars.has(cal.id);
          calCheckbox.style.cursor = "pointer";
          calCheckbox.addEventListener("change", async () => {
            const newSelected = new Set(selectedCalendars);
            if (calCheckbox.checked) {
              newSelected.add(cal.id);
            } else {
              newSelected.delete(cal.id);
            }
            await chrome.runtime.sendMessage({ type: "SET_PREFS", prefs: { selectedCalendars: Array.from(newSelected) } });
          });

          calWrapper.appendChild(calLabel);
          calWrapper.appendChild(calCheckbox);
          calendarsContainer.appendChild(calWrapper);
        }
        accountWrapper.appendChild(calendarsContainer);
      }

      accountsListEl.appendChild(accountWrapper);
    }

    if (accountsResponse.accounts.length === 0) {
      accountsListEl.innerHTML = `
        <div style="text-align:center; color:#666; padding:40px 20px; border:2px dashed #ddd; border-radius:8px; background:#fafafa;">
          <div style="font-size:48px; margin-bottom:12px;">📅</div>
          <div style="font-size:16px; font-weight:500; margin-bottom:8px;">No accounts connected</div>
          <div style="font-size:14px;">Add a Google account to get started</div>
        </div>
      `;
    }
  } catch (e) {
    accountsListEl.innerHTML = `
      <div style="text-align:center; color:#dc3545; padding:20px; border:1px solid #f5c6cb; border-radius:8px; background:#f8d7da;">
        <div style="font-weight:500; margin-bottom:4px;">Error loading accounts</div>
        <div style="font-size:12px;">${String(e?.message || e)}</div>
      </div>
    `;
  }
}

addGoogleAccountBtn.addEventListener("click", async () => {
  try {
    addGoogleAccountBtn.textContent = "Adding...";
    addGoogleAccountBtn.disabled = true;
    
    const res = await chrome.runtime.sendMessage({ type: "ADD_GOOGLE_ACCOUNT" });
    if (res?.success) {
      await renderAccounts();
      addGoogleAccountBtn.textContent = "Added ✓";
      setTimeout(() => {
        addGoogleAccountBtn.textContent = "+ Add Google Account";
        addGoogleAccountBtn.disabled = false;
      }, 2000);
    } else {
      alert(`Failed to add account: ${res?.error || "Unknown error"}`);
      addGoogleAccountBtn.textContent = "+ Add Google Account";
      addGoogleAccountBtn.disabled = false;
    }
  } catch (e) {
    alert(`Error: ${e?.message || e}`);
    addGoogleAccountBtn.textContent = "+ Add Google Account";
    addGoogleAccountBtn.disabled = false;
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GOOGLE_SIGN_OUT" });
    if (res?.ok) {
      signOutBtn.textContent = "Signed out";
      await renderAccounts(); // Refresh accounts list
      setTimeout(() => window.close(), 1000);
    } else {
      alert(`Sign out failed: ${res?.error || ""}`);
    }
  } catch (e) {
    alert(`Sign out error: ${e?.message || e}`);
  }
});

// Debug functions
function showDebugOutput(content) {
  debugOutputEl.style.display = "block";
  debugOutputEl.textContent = content;
}

function clearDebugOutput() {
  debugOutputEl.style.display = "none";
  debugOutputEl.textContent = "";
}

async function debugCalendarEvents() {
  try {
    showDebugOutput("Loading calendar events...");
    
    // Get current date range (next 14 days)
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    
    // Get selected calendars
    const { prefs } = await chrome.storage.sync.get(["prefs"]);
    const selectedCalendars = prefs?.selectedCalendars || null;
    
    // Fetch events via background script
    const response = await chrome.runtime.sendMessage({
      type: "DEBUG_EVENTS",
      calendarIds: selectedCalendars,
      timeMin: start.toISOString(),
      timeMax: end.toISOString()
    });
    
    if (!response?.ok) {
      showDebugOutput(`Error: ${response?.error || "Failed to fetch events"}`);
      return;
    }
    
    const events = response.events;
    let output = `=== CALENDAR EVENTS DEBUG ===\n`;
    output += `Timestamp: ${new Date().toLocaleString()}\n`;
    output += `Date Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\n`;
    output += `Selected Calendars: ${selectedCalendars ? selectedCalendars.join(", ") : "All (primary only)"}\n`;
    output += `Total Events Found: ${events.length}\n\n`;
    
    if (events.length === 0) {
      output += "No events found in the specified range.\n";
    } else {
      for (const [index, event] of events.entries()) {
        output += `${index + 1}. ${event.summary}\n`;
        
        // Show email instead of account ID
        if (event.accountId && event.calendarId) {
          const accountEmail = await getAccountEmail(event.accountId);
          const calendarName = event.calendarId.includes(':') ? event.calendarId.split(':').slice(1).join(':') : event.calendarId;
          output += `   📅 Source: Account ${accountEmail}, Calendar ${calendarName}\n`;
        } else {
          output += `   📅 Source: Account ${event.accountId || 'N/A'}, Calendar ${event.calendarId || 'N/A'}\n`;
        }
        
        output += `   🕐 Start: ${event.start}\n`;
        output += `   🕐 End: ${event.end}\n`;
        if (event.location) output += `   📍 Location: ${event.location}\n`;
        if (event.hangoutLink) output += `   💻 Hangout: ${event.hangoutLink}\n`;
        output += `   🌐 Online: ${!event.location || event.hangoutLink || event.location.toLowerCase().includes("online") || event.location.toLowerCase().includes("zoom") || event.location.toLowerCase().includes("meet") || event.location.toLowerCase().includes("teams") ? "Yes" : "No"}\n\n`;
      }
    }
    
    showDebugOutput(output);
  } catch (error) {
    showDebugOutput(`Error: ${error.message}`);
  }
}

async function debugAvailabilitySlots() {
  try {
    showDebugOutput("Generating availability slots...");
    
    // Get current preferences
    const { prefs } = await chrome.storage.sync.get(["prefs"]);
    const currentPrefs = { 
      mode: prefs?.mode || "approachable", 
      context: prefs?.context || "work", 
      maxSlots: Number(prefs?.maxSlots) || 3 
    };
    
    let output = `=== AVAILABILITY SLOTS DEBUG ===\n`;
    output += `Timestamp: ${new Date().toLocaleString()}\n`;
    output += `Current Settings:\n`;
    output += `- Mode: ${currentPrefs.mode}\n`;
    output += `- Context: ${currentPrefs.context}\n`;
    output += `- Max Slots: ${currentPrefs.maxSlots}\n\n`;
    
    // Test all combinations of modes and contexts
    const modes = ["approachable", "busy"];
    const contexts = ["work", "personal"];
    const results = {};
    
    for (const mode of modes) {
      for (const context of contexts) {
        const scenario = `${mode}/${context}`;
        output += `--- ${mode.toUpperCase()} mode, ${context.toUpperCase()} context ---\n`;
        
        try {
          const response = await chrome.runtime.sendMessage({
            type: "DEBUG_AVAILABILITY",
            mode,
            context,
            maxSlots: currentPrefs.maxSlots
          });
          
          if (response?.ok) {
            const availability = response.text;
            if (availability.trim()) {
              output += availability + "\n";
              results[scenario] = { status: "available", slots: availability.split('\n').filter(line => line.trim()).length };
            } else {
              output += "No available slots found.\n";
              results[scenario] = { status: "none", slots: 0 };
            }
          } else {
            output += `Error: ${response?.error || "Failed to generate availability"}\n`;
            results[scenario] = { status: "error", slots: 0 };
          }
        } catch (error) {
          output += `Error: ${error.message}\n`;
          results[scenario] = { status: "error", slots: 0 };
        }
        output += "\n";
      }
    }
    
    // Summary
    output += `=== SUMMARY ===\n`;
    Object.entries(results).forEach(([scenario, result]) => {
      const status = result.status === "available" ? "✓" : result.status === "error" ? "✗" : "○";
      output += `${status} ${scenario}: ${result.status === "available" ? `${result.slots} slots` : result.status}\n`;
    });
    
    showDebugOutput(output);
  } catch (error) {
    showDebugOutput(`Error: ${error.message}`);
  }
}

// Event listeners
saveBtn.addEventListener("click", save);
refreshCalendarsBtn.addEventListener("click", renderAccounts);
debugEventsBtn.addEventListener("click", debugCalendarEvents);
debugAvailabilityBtn.addEventListener("click", debugAvailabilitySlots);
debugClearBtn.addEventListener("click", clearDebugOutput);

load();


