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


