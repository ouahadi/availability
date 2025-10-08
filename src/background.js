// Background service worker (MV3)
chrome.runtime.onInstalled.addListener(() => {
  // Initialize state when the extension is installed or updated
  console.log("Availability extension installed");
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
});


