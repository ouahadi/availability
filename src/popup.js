const statusEl = document.getElementById("status");
document.getElementById("ping").addEventListener("click", async () => {
  statusEl.textContent = "Pinging...";
  try {
    const response = await chrome.runtime.sendMessage({ type: "PING" });
    statusEl.textContent = response?.message ?? "No response";
  } catch (e) {
    statusEl.textContent = "Error";
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PONG") {
    statusEl.textContent = msg.message;
  }
});

const eventsList = document.getElementById("events");
document.getElementById("google-auth").addEventListener("click", async () => {
  statusEl.textContent = "Authorizing...";
  const res = await chrome.runtime.sendMessage({ type: "GOOGLE_AUTH" });
  statusEl.textContent = res?.ok ? "Authorized" : `Auth error: ${res?.error || ""}`;
});

document.getElementById("google-events").addEventListener("click", async () => {
  statusEl.textContent = "Loading events...";
  const res = await chrome.runtime.sendMessage({ type: "GOOGLE_LIST_EVENTS", maxResults: 10 });
  if (!res?.ok) {
    statusEl.textContent = `Load error: ${res?.error || ""}`;
    return;
  }
  statusEl.textContent = `Loaded ${res.events.length}`;
  eventsList.innerHTML = "";
  for (const ev of res.events) {
    const li = document.createElement("li");
    const when = ev.start ? new Date(ev.start).toLocaleString() : "(no time)";
    const loc = ev.location ? ` @ ${ev.location}` : "";
    li.textContent = `${when} — ${ev.summary}${loc}`;
    eventsList.appendChild(li);
  }
});

document.getElementById("google-signout").addEventListener("click", async () => {
  statusEl.textContent = "Signing out...";
  const res = await chrome.runtime.sendMessage({ type: "GOOGLE_SIGN_OUT" });
  statusEl.textContent = res?.ok ? "Signed out" : `Sign out error: ${res?.error || ""}`;
  eventsList.innerHTML = "";
});


