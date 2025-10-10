const maxSlotsInput = document.getElementById("maxSlots");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");
const accountsListEl = document.getElementById("accounts-list");
const refreshCalendarsBtn = document.getElementById("refresh-calendars");
const signOutBtn = document.getElementById("sign-out");

// Debug elements
const debugEventsBtn = document.getElementById("debug-events");
const debugAvailabilityBtn = document.getElementById("debug-availability");
const debugClearBtn = document.getElementById("debug-clear");
const debugOutputEl = document.getElementById("debug-output");

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
      events.forEach((event, index) => {
        output += `${index + 1}. ${event.summary}\n`;
        output += `   Start: ${event.start}\n`;
        output += `   End: ${event.end}\n`;
        if (event.location) output += `   Location: ${event.location}\n`;
        if (event.hangoutLink) output += `   Hangout: ${event.hangoutLink}\n`;
        output += `   Online: ${!event.location || event.hangoutLink || event.location.toLowerCase().includes("online") || event.location.toLowerCase().includes("zoom") || event.location.toLowerCase().includes("meet") || event.location.toLowerCase().includes("teams") ? "Yes" : "No"}\n\n`;
      });
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
debugEventsBtn.addEventListener("click", debugCalendarEvents);
debugAvailabilityBtn.addEventListener("click", debugAvailabilitySlots);
debugClearBtn.addEventListener("click", clearDebugOutput);

saveBtn.addEventListener("click", save);
refreshCalendarsBtn.addEventListener("click", renderCalendars);
load();


