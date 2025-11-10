const maxSlotsInput = document.getElementById("maxSlots");
const showTimezoneInput = document.getElementById("showTimezone");
const timeBufferRadios = document.querySelectorAll('input[name="timeBuffer"]');
const timeBufferCustomInput = document.getElementById("timeBufferCustom");
const workStartHourInput = document.getElementById("workStartHour");
const workEndHourInput = document.getElementById("workEndHour");
const personalWeekdayStartHourInput = document.getElementById("personalWeekdayStartHour");
const personalWeekdayEndHourInput = document.getElementById("personalWeekdayEndHour");
const personalWeekendStartHourInput = document.getElementById("personalWeekendStartHour");
const personalWeekendEndHourInput = document.getElementById("personalWeekendEndHour");
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
  
  // Load timezone display setting (default: false to match popup)
  const showTimezone = prefs?.showTimezone !== undefined ? prefs.showTimezone : false;
  showTimezoneInput.checked = showTimezone;
  
  // Load time buffer setting (default: 0)
  const timeBuffer = prefs?.timeBuffer || 0;
  const timeBufferCustom = prefs?.timeBufferCustom;
  
  // Check if a custom buffer is set
  if (timeBufferCustom && timeBufferCustom > 0) {
    timeBufferCustomInput.value = String(timeBufferCustom);
  } else if (timeBuffer > 0) {
    // Select the appropriate radio button
    timeBufferRadios.forEach(radio => {
      if (radio.value === String(timeBuffer)) {
        radio.checked = true;
      }
    });
  }
  
  // Load work hours with defaults
  const workStartHour = prefs?.workStartHour || 9;
  const workEndHour = prefs?.workEndHour || 17;
  
  // Convert to time format (HH:MM)
  workStartHourInput.value = `${workStartHour.toString().padStart(2, '0')}:00`;
  workEndHourInput.value = `${workEndHour.toString().padStart(2, '0')}:00`;
  
  // Load personal hours with defaults
  const personalWeekdayStartHour = prefs?.personalWeekdayStartHour || 18;
  const personalWeekdayEndHour = prefs?.personalWeekdayEndHour || 22;
  const personalWeekendStartHour = prefs?.personalWeekendStartHour || 10;
  const personalWeekendEndHour = prefs?.personalWeekendEndHour || 22;
  
  // Convert to time format (HH:MM)
  personalWeekdayStartHourInput.value = `${personalWeekdayStartHour.toString().padStart(2, '0')}:00`;
  personalWeekdayEndHourInput.value = `${personalWeekdayEndHour.toString().padStart(2, '0')}:00`;
  personalWeekendStartHourInput.value = `${personalWeekendStartHour.toString().padStart(2, '0')}:00`;
  personalWeekendEndHourInput.value = `${personalWeekendEndHour.toString().padStart(2, '0')}:00`;
  
  await renderAccounts();
}

async function save() {
  const maxSlots = Math.max(1, Number(maxSlotsInput.value || 3));
  
  // Parse work hours from time inputs
  const workStartTime = workStartHourInput.value;
  const workEndTime = workEndHourInput.value;
  
  // Convert time format (HH:MM) to hour number
  const workStartHour = workStartTime ? parseInt(workStartTime.split(':')[0], 10) : 9;
  const workEndHour = workEndTime ? parseInt(workEndTime.split(':')[0], 10) : 17;
  
  // Validate work hours
  const validatedWorkStartHour = Math.max(0, Math.min(23, workStartHour));
  const validatedWorkEndHour = Math.max(0, Math.min(23, workEndHour));
  
  // Parse personal hours from time inputs
  const personalWeekdayStartTime = personalWeekdayStartHourInput.value;
  const personalWeekdayEndTime = personalWeekdayEndHourInput.value;
  const personalWeekendStartTime = personalWeekendStartHourInput.value;
  const personalWeekendEndTime = personalWeekendEndHourInput.value;
  
  // Convert time format (HH:MM) to hour number
  const personalWeekdayStartHour = personalWeekdayStartTime ? parseInt(personalWeekdayStartTime.split(':')[0], 10) : 18;
  const personalWeekdayEndHour = personalWeekdayEndTime ? parseInt(personalWeekdayEndTime.split(':')[0], 10) : 22;
  const personalWeekendStartHour = personalWeekendStartTime ? parseInt(personalWeekendStartTime.split(':')[0], 10) : 10;
  const personalWeekendEndHour = personalWeekendEndTime ? parseInt(personalWeekendEndTime.split(':')[0], 10) : 22;
  
  // Validate personal hours
  const validatedPersonalWeekdayStartHour = Math.max(0, Math.min(23, personalWeekdayStartHour));
  const validatedPersonalWeekdayEndHour = Math.max(0, Math.min(23, personalWeekdayEndHour));
  const validatedPersonalWeekendStartHour = Math.max(0, Math.min(23, personalWeekendStartHour));
  const validatedPersonalWeekendEndHour = Math.max(0, Math.min(23, personalWeekendEndHour));
  
  // Parse time buffer
  const timeBufferCustom = parseInt(timeBufferCustomInput.value || '0', 10);
  let timeBuffer = 0;
  
  // If custom value is set, use it
  if (timeBufferCustom > 0) {
    timeBuffer = timeBufferCustom;
  } else {
    // Otherwise, get the selected radio value
    const selectedRadio = Array.from(timeBufferRadios).find(radio => radio.checked);
    timeBuffer = selectedRadio ? parseInt(selectedRadio.value, 10) : 0;
  }
  
  const current = (await chrome.storage.sync.get(["prefs"])).prefs || {};
  const updated = { 
    ...current, 
    maxSlots,
    showTimezone: showTimezoneInput.checked,
    timeBuffer,
    timeBufferCustom: timeBufferCustom > 0 ? timeBufferCustom : undefined,
    workStartHour: validatedWorkStartHour,
    workEndHour: validatedWorkEndHour,
    personalWeekdayStartHour: validatedPersonalWeekdayStartHour,
    personalWeekdayEndHour: validatedPersonalWeekdayEndHour,
    personalWeekendStartHour: validatedPersonalWeekendStartHour,
    personalWeekendEndHour: validatedPersonalWeekendEndHour
  };
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
    const fullDayEventsBusyCalendars = new Set((prefs?.fullDayEventsBusyCalendars) || []);

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
          calWrapper.style.padding = "8px 10px";
          calWrapper.style.borderRadius = "4px";
          calWrapper.style.background = "#f5f5f5";
          calWrapper.style.border = "1px solid #ddd";
          calWrapper.style.fontSize = "12px";
          calWrapper.style.marginBottom = "2px";

          // Calendar header with name and selection checkbox
          const calHeader = document.createElement("div");
          calHeader.style.display = "flex";
          calHeader.style.alignItems = "center";
          calHeader.style.justifyContent = "space-between";
          calHeader.style.gap = "10px";
          calHeader.style.marginBottom = "4px";

          const calLabel = document.createElement("label");
          calLabel.htmlFor = calId;
          calLabel.textContent = cal.summary;
          calLabel.style.cursor = "pointer";
          calLabel.style.flex = "1";
          calLabel.style.fontWeight = "500";

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

          calHeader.appendChild(calLabel);
          calHeader.appendChild(calCheckbox);

          // Full-day events setting
          const fullDaySetting = document.createElement("div");
          fullDaySetting.style.display = "flex";
          fullDaySetting.style.alignItems = "center";
          fullDaySetting.style.gap = "6px";
          fullDaySetting.style.marginLeft = "8px";

          const fullDayCheckboxId = `fullday-${btoa(cal.id).replace(/=/g, "")}`;
          const fullDayCheckbox = document.createElement("input");
          fullDayCheckbox.type = "checkbox";
          fullDayCheckbox.id = fullDayCheckboxId;
          fullDayCheckbox.checked = fullDayEventsBusyCalendars.has(cal.id);
          fullDayCheckbox.style.cursor = "pointer";
          fullDayCheckbox.addEventListener("change", async () => {
            const newFullDayBusy = new Set(fullDayEventsBusyCalendars);
            if (fullDayCheckbox.checked) {
              newFullDayBusy.add(cal.id);
            } else {
              newFullDayBusy.delete(cal.id);
            }
            await chrome.runtime.sendMessage({ type: "SET_PREFS", prefs: { fullDayEventsBusyCalendars: Array.from(newFullDayBusy) } });
          });

          const fullDayLabel = document.createElement("label");
          fullDayLabel.htmlFor = fullDayCheckboxId;
          fullDayLabel.textContent = "Mark all-day events as busy";
          fullDayLabel.style.cursor = "pointer";
          fullDayLabel.style.fontSize = "11px";
          fullDayLabel.style.color = "#666";

          fullDaySetting.appendChild(fullDayCheckbox);
          fullDaySetting.appendChild(fullDayLabel);

          calWrapper.appendChild(calHeader);
          calWrapper.appendChild(fullDaySetting);
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
            
            // Add debug logs for busy mode
            if (mode === "busy" && response.debugLogs && response.debugLogs.length > 0) {
              output += "\n--- DEBUG LOGS ---\n";
              response.debugLogs.forEach(log => {
                if (log.includes("🔴") || log.includes("Busy mode") || log.includes("Time buffer")) {
                  output += log + "\n";
                }
              });
              output += "\n";
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

// Event listeners for time buffer
timeBufferRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.checked) {
      timeBufferCustomInput.value = ""; // Clear custom input when a radio is selected
    }
  });
});

timeBufferCustomInput.addEventListener("input", () => {
  // Clear radio selection when custom value is entered
  timeBufferRadios.forEach(radio => {
    radio.checked = false;
  });
});

// Auto-save function that saves only the changed field
async function autoSave(fieldName, value) {
  const current = (await chrome.storage.sync.get(["prefs"])).prefs || {};
  const updated = { ...current };
  
  if (fieldName === "showTimezone") {
    updated.showTimezone = value;
  } else if (fieldName === "maxSlots") {
    updated.maxSlots = value;
  } else if (fieldName === "timeBuffer") {
    updated.timeBuffer = value;
  } else if (fieldName === "timeBufferCustom") {
    updated.timeBufferCustom = value > 0 ? value : undefined;
  } else if (fieldName === "workStartHour") {
    updated.workStartHour = value;
  } else if (fieldName === "workEndHour") {
    updated.workEndHour = value;
  } else if (fieldName === "personalWeekdayStartHour") {
    updated.personalWeekdayStartHour = value;
  } else if (fieldName === "personalWeekdayEndHour") {
    updated.personalWeekdayEndHour = value;
  } else if (fieldName === "personalWeekendStartHour") {
    updated.personalWeekendStartHour = value;
  } else if (fieldName === "personalWeekendEndHour") {
    updated.personalWeekendEndHour = value;
  }
  
  await chrome.storage.sync.set({ prefs: updated });
  
  // Show saved indicator
  savedEl.textContent = "Saved";
  setTimeout(() => (savedEl.textContent = ""), 1200);
}

// Add auto-save listeners for all inputs
showTimezoneInput.addEventListener("change", async () => {
  await autoSave("showTimezone", showTimezoneInput.checked);
});

maxSlotsInput.addEventListener("change", async () => {
  const maxSlots = Math.max(1, Number(maxSlotsInput.value || 3));
  await autoSave("maxSlots", maxSlots);
});

// Work hours
workStartHourInput.addEventListener("change", async () => {
  const workStartTime = workStartHourInput.value;
  const workStartHour = workStartTime ? parseInt(workStartTime.split(':')[0], 10) : 9;
  const validatedWorkStartHour = Math.max(0, Math.min(23, workStartHour));
  await autoSave("workStartHour", validatedWorkStartHour);
});

workEndHourInput.addEventListener("change", async () => {
  const workEndTime = workEndHourInput.value;
  const workEndHour = workEndTime ? parseInt(workEndTime.split(':')[0], 10) : 17;
  const validatedWorkEndHour = Math.max(0, Math.min(23, workEndHour));
  await autoSave("workEndHour", validatedWorkEndHour);
});

// Personal hours
personalWeekdayStartHourInput.addEventListener("change", async () => {
  const personalWeekdayStartTime = personalWeekdayStartHourInput.value;
  const personalWeekdayStartHour = personalWeekdayStartTime ? parseInt(personalWeekdayStartTime.split(':')[0], 10) : 18;
  const validatedPersonalWeekdayStartHour = Math.max(0, Math.min(23, personalWeekdayStartHour));
  await autoSave("personalWeekdayStartHour", validatedPersonalWeekdayStartHour);
});

personalWeekdayEndHourInput.addEventListener("change", async () => {
  const personalWeekdayEndTime = personalWeekdayEndHourInput.value;
  const personalWeekdayEndHour = personalWeekdayEndTime ? parseInt(personalWeekdayEndTime.split(':')[0], 10) : 22;
  const validatedPersonalWeekdayEndHour = Math.max(0, Math.min(23, personalWeekdayEndHour));
  await autoSave("personalWeekdayEndHour", validatedPersonalWeekdayEndHour);
});

personalWeekendStartHourInput.addEventListener("change", async () => {
  const personalWeekendStartTime = personalWeekendStartHourInput.value;
  const personalWeekendStartHour = personalWeekendStartTime ? parseInt(personalWeekendStartTime.split(':')[0], 10) : 10;
  const validatedPersonalWeekendStartHour = Math.max(0, Math.min(23, personalWeekendStartHour));
  await autoSave("personalWeekendStartHour", validatedPersonalWeekendStartHour);
});

personalWeekendEndHourInput.addEventListener("change", async () => {
  const personalWeekendEndTime = personalWeekendEndHourInput.value;
  const personalWeekendEndHour = personalWeekendEndTime ? parseInt(personalWeekendEndTime.split(':')[0], 10) : 22;
  const validatedPersonalWeekendEndHour = Math.max(0, Math.min(23, personalWeekendEndHour));
  await autoSave("personalWeekendEndHour", validatedPersonalWeekendEndHour);
});

// Time buffer radios
timeBufferRadios.forEach(radio => {
  radio.addEventListener("change", async () => {
    const timeBuffer = parseInt(radio.value, 10);
    await autoSave("timeBuffer", timeBuffer);
    if (timeBuffer > 0) {
      timeBufferCustomInput.value = ""; // Clear custom input when a radio is selected
    }
  });
});

timeBufferCustomInput.addEventListener("input", async () => {
  const timeBufferCustom = parseInt(timeBufferCustomInput.value || '0', 10);
  if (timeBufferCustom > 0) {
    await autoSave("timeBufferCustom", timeBufferCustom);
  }
});

// Listen for storage changes to sync with popup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.prefs) {
    const newPrefs = changes.prefs.newValue;
    if (newPrefs && newPrefs.showTimezone !== undefined) {
      showTimezoneInput.checked = newPrefs.showTimezone === true;
    }
  }
});

saveBtn.addEventListener("click", save);
refreshCalendarsBtn.addEventListener("click", renderAccounts);
debugEventsBtn.addEventListener("click", debugCalendarEvents);
debugAvailabilityBtn.addEventListener("click", debugAvailabilitySlots);
debugClearBtn.addEventListener("click", clearDebugOutput);

load();


