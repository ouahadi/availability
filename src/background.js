// Background service worker (MV3)
import { startGoogleAuth, fetchUpcomingEvents, fetchEventsInRange, fetchCalendarList, fetchEventsForCalendars, signOutGoogle } from "./calendar.js";
import { generateAvailability } from "./availability.js";
import { GOOGLE_CLIENT_ID as CONFIG_CLIENT_ID } from "./config.js";

// Static client ID from config module
const GOOGLE_CLIENT_ID = CONFIG_CLIENT_ID || null;
chrome.runtime.onInstalled.addListener(() => {
  // Initialize state when the extension is installed or updated
  console.log("Availability extension installed");
  try {
    const redirect = chrome.identity.getRedirectURL();
    console.log("OAuth redirect URI:", redirect);
  } catch (_e) {}
});

chrome.action.onClicked.addListener(async (tab) => {
  // Reserved in case default_action without popup is used
  console.debug("Action clicked", { tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "GET_PREFS") {
    (async () => {
      const { prefs } = await chrome.storage.sync.get(["prefs"]);
      const defaults = { mode: "approachable", context: "work", maxSlots: 3 };
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
        await startGoogleAuth(GOOGLE_CLIENT_ID);
        sendResponse({ ok: true });
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
        const events = await fetchEventsForCalendars(GOOGLE_CLIENT_ID, selectedCalendars, start.toISOString(), end.toISOString());
        const prefsSafe = { mode: (prefs?.mode)||"approachable", context: (prefs?.context)||"work", maxSlots: Number(prefs?.maxSlots)||3 };
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
        const list = await fetchCalendarList(GOOGLE_CLIENT_ID);
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
});


