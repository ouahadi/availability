// Background service worker (MV3)
import { startGoogleAuth, fetchUpcomingEvents, signOutGoogle } from "./calendar.js";
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
  if (message && message.type === "PING") {
    const reply = { message: "PONG from background" };
    sendResponse(reply);
    chrome.runtime.sendMessage({ type: "PONG", message: reply.message });
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


