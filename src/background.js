// Background service worker (MV3)
import { startGoogleAuth, fetchUpcomingEvents, fetchEventsInRange, signOutGoogle, fetchUserProfile } from "./calendar.js";
import { CalendarProvider } from "./providers/index.js";
import { generateAvailability } from "./availability.js";
import { AccountManager } from "./account-manager.js";
import { GOOGLE_CLIENT_ID as CONFIG_CLIENT_ID } from "./config.js";

// Static client ID from config module
const GOOGLE_CLIENT_ID = CONFIG_CLIENT_ID || null;
chrome.runtime.onInstalled.addListener(async () => {
  // Initialize state when the extension is installed or updated
  console.log("TimePaste extension installed");
  try {
    const redirect = chrome.identity.getRedirectURL();
    console.log("OAuth redirect URI:", redirect);
    
    // Migrate existing single account to new multi-account structure
    if (GOOGLE_CLIENT_ID) {
      try {
        await AccountManager.migrateExistingAccount(GOOGLE_CLIENT_ID);
      } catch (error) {
        console.log("Migration failed, continuing:", error.message);
      }
      
      // Start background token refresh
      scheduleTokenRefresh();
    }
  } catch (_e) {}
});

// Schedule proactive token refresh every 30 minutes
function scheduleTokenRefresh() {
  if (!GOOGLE_CLIENT_ID) return;
  
  // Refresh tokens immediately on startup
  refreshTokensInBackground();
  
  // Schedule regular refreshes
  setInterval(refreshTokensInBackground, 30 * 60 * 1000); // 30 minutes
}

async function refreshTokensInBackground() {
  try {
    console.log("Starting background token refresh...");
    const results = await AccountManager.refreshAllTokens(GOOGLE_CLIENT_ID);
    
    // Log summary without failing if some accounts had issues
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (failed > 0) {
      console.warn(`Background token refresh: ${successful} successful, ${failed} failed`);
      // Don't throw error - just log the failures
    } else {
      console.log("Background token refresh completed successfully");
    }
  } catch (error) {
    console.error("Background token refresh failed completely:", error);
    // Don't propagate the error - let the extension continue working
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  // Reserved in case default_action without popup is used
  console.debug("Action clicked", { tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "GET_PREFS") {
    (async () => {
      const { prefs } = await chrome.storage.sync.get(["prefs"]);
      const defaults = { 
        mode: "approachable", 
        context: "work", 
        maxSlots: 3, 
        workStartHour: 9, 
        workEndHour: 17,
        personalWeekdayStartHour: 18,
        personalWeekdayEndHour: 22,
        personalWeekendStartHour: 10,
        personalWeekendEndHour: 22
      };
      sendResponse({ ok: true, prefs: { ...defaults, ...(prefs || {}) } });
    })();
    return true;
  }
  if (message && message.type === "SET_PREFS") {
    (async () => {
      const current = (await chrome.storage.sync.get(["prefs"])).prefs || {};
      const updated = { ...current, ...(message.prefs || {}) };
      await chrome.storage.sync.set({ prefs: updated });
      sendResponse({ ok: true, prefs: updated });
    })();
    return true;
  }
  if (message && message.type === "CHECK_AUTH_STATUS") {
    (async () => {
      try {
        const { googleAuth } = await chrome.storage.sync.get(["googleAuth"]);
        const authenticated = googleAuth && googleAuth.access_token;
        sendResponse({ authenticated });
      } catch (e) {
        sendResponse({ authenticated: false });
      }
    })();
    return true;
  }
  if (message && message.type === "GOOGLE_AUTH") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const result = await AccountManager.authenticateGoogle(GOOGLE_CLIENT_ID);
        if (result.success) {
          sendResponse({ ok: true, account: result.account, isNew: result.isNew });
        } else {
          sendResponse({ ok: false, error: result.error });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "GOOGLE_LIST_EVENTS") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const events = await fetchUpcomingEvents(GOOGLE_CLIENT_ID, message.maxResults || 10);
        sendResponse({ ok: true, events });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "GENERATE_AVAILABILITY") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
        end.setDate(end.getDate() + 14);
        const { prefs } = await chrome.storage.sync.get(["prefs"]);
        const selectedCalendars = prefs?.selectedCalendars || null;
        const activeAccounts = prefs?.activeAccounts || [];
        
        console.log(`🎯 Generating availability using:`);
        console.log(`   📅 Selected calendars: ${selectedCalendars ? selectedCalendars.join(", ") : "All (primary only)"}`);
        
        // Show email addresses instead of account IDs
        if (activeAccounts.length > 0) {
          const { accounts } = await chrome.storage.sync.get(["accounts"]);
          const accountEmails = activeAccounts.map(accountId => {
            const account = (accounts || []).find(acc => acc.id === accountId);
            return account ? account.email : accountId;
          });
          console.log(`   👥 Active accounts: ${accountEmails.join(", ")}`);
        } else {
          console.log(`   👥 Active accounts: None`);
        }
        
        const events = await CalendarProvider.listEventsInRange(GOOGLE_CLIENT_ID, selectedCalendars, start.toISOString(), end.toISOString(), activeAccounts);
    // Get default slot duration based on context if not set
    const defaultSlotDuration = (prefs?.context || "work") === "work" ? 30 : 180;
    const slotDuration = Number(prefs?.slotDuration) || defaultSlotDuration;
    
    const prefsSafe = { 
      mode: (prefs?.mode)||"approachable", 
      context: (prefs?.context)||"work", 
      maxSlots: Number(prefs?.maxSlots)||3,
      showTimezone: prefs?.showTimezone !== undefined ? prefs.showTimezone : false,
      fullDayEventsBusyCalendars: new Set(prefs?.fullDayEventsBusyCalendars || []),
      workHours: {
        startHour: Number(prefs?.workStartHour)||9,
        endHour: Number(prefs?.workEndHour)||17
      },
      personalHours: {
        weekdays: {
          startHour: Number(prefs?.personalWeekdayStartHour)||18,
          endHour: Number(prefs?.personalWeekdayEndHour)||22
        },
        weekends: {
          startHour: Number(prefs?.personalWeekendStartHour)||10,
          endHour: Number(prefs?.personalWeekendEndHour)||22
        }
      },
      timeBuffer: Number(prefs?.timeBuffer)||0,
      slotDuration: slotDuration
    };
        const text = await generateAvailability(events, start, end, prefsSafe);
        sendResponse({ ok: true, text });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "LIST_CALENDARS") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const { prefs } = await chrome.storage.sync.get(["prefs"]);
        const activeAccounts = prefs?.activeAccounts || [];
        const list = await CalendarProvider.listCalendars(GOOGLE_CLIENT_ID, activeAccounts);
        sendResponse({ ok: true, calendars: list });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "GOOGLE_SIGN_OUT") {
    (async () => {
      try {
        await signOutGoogle();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "GET_USER_PROFILE") {
    (async () => {
      try {
        const profile = await fetchUserProfile();
        sendResponse({ ok: true, profile });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "DEBUG_EVENTS") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const { calendarIds, timeMin, timeMax } = message;
        const { prefs } = await chrome.storage.sync.get(["prefs"]);
        const activeAccounts = prefs?.activeAccounts || [];
        const events = await CalendarProvider.listEventsInRange(GOOGLE_CLIENT_ID, calendarIds, timeMin, timeMax, activeAccounts);
        sendResponse({ ok: true, events });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "DEBUG_AVAILABILITY") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const { mode, context, maxSlots } = message;
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
        end.setDate(end.getDate() + 14);
        const { prefs } = await chrome.storage.sync.get(["prefs"]);
        const selectedCalendars = prefs?.selectedCalendars || null;
        const activeAccounts = prefs?.activeAccounts || [];
        const events = await CalendarProvider.listEventsInRange(GOOGLE_CLIENT_ID, selectedCalendars, start.toISOString(), end.toISOString(), activeAccounts);
        const options = { 
          mode, 
          context, 
          maxSlots,
          showTimezone: prefs?.showTimezone !== undefined ? prefs.showTimezone : false,
          fullDayEventsBusyCalendars: new Set(prefs?.fullDayEventsBusyCalendars || []),
          workHours: {
            startHour: Number(prefs?.workStartHour)||9,
            endHour: Number(prefs?.workEndHour)||17
          },
          personalHours: {
            weekdays: {
              startHour: Number(prefs?.personalWeekdayStartHour)||18,
              endHour: Number(prefs?.personalWeekdayEndHour)||22
            },
            weekends: {
              startHour: Number(prefs?.personalWeekendStartHour)||10,
              endHour: Number(prefs?.personalWeekendEndHour)||22
            }
          },
          timeBuffer: Number(prefs?.timeBuffer)||0
        };
        
        // Capture console logs for debug output
        const debugLogs = [];
        const originalLog = console.log;
        console.log = (...args) => {
          debugLogs.push(args.join(' '));
          originalLog(...args);
        };
        
        const text = await generateAvailability(events, start, end, options);
        
        // Restore original console.log
        console.log = originalLog;
        
        sendResponse({ ok: true, text, debugLogs });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "LIST_ACCOUNTS") {
    (async () => {
      try {
        const accounts = await AccountManager.getAccounts();
        sendResponse({ ok: true, accounts });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "ADD_GOOGLE_ACCOUNT") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const result = await AccountManager.authenticateGoogle(GOOGLE_CLIENT_ID);
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "REMOVE_ACCOUNT") {
    (async () => {
      try {
        const success = await AccountManager.removeAccount(message.accountId);
        sendResponse({ ok: success });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "TOGGLE_ACCOUNT_ACTIVE") {
    (async () => {
      try {
        await AccountManager.toggleAccountActive(message.accountId, message.active);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "REFRESH_ACCOUNT_TOKENS") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const results = await AccountManager.refreshAllTokens(GOOGLE_CLIENT_ID);
        sendResponse({ ok: true, results });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "CHECK_ACCOUNT_STATUS") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const status = await AccountManager.getAccountStatus(message.accountId, GOOGLE_CLIENT_ID);
        sendResponse({ ok: true, ...status });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (message && message.type === "RECONNECT_ACCOUNT") {
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in src/config.js");
        const result = await AccountManager.authenticateGoogle(GOOGLE_CLIENT_ID);
        if (result.success) {
          sendResponse({ success: true, account: result.account });
        } else {
          sendResponse({ success: false, error: AccountManager.getUserFriendlyError(result.error) });
        }
      } catch (e) {
        sendResponse({ success: false, error: AccountManager.getUserFriendlyError(String(e?.message || e)) });
      }
    })();
    return true;
  }
});


