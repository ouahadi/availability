const greetingInput = document.getElementById("greeting");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");

async function load() {
  const { greeting = "Hello!" } = await chrome.storage.sync.get(["greeting"]);
  greetingInput.value = greeting;
}

async function save() {
  await chrome.storage.sync.set({ greeting: greetingInput.value.trim() });
  savedEl.textContent = "Saved";
  setTimeout(() => (savedEl.textContent = ""), 1200);
}

saveBtn.addEventListener("click", save);
load();


