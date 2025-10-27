// Content script placeholder
(() => {
  const markerId = "timepaste-ext-marker";
  if (document.getElementById(markerId)) return;

  const el = document.createElement("meta");
  el.id = markerId;
  el.name = "timepaste-extension";
  el.content = "installed";
  document.documentElement.appendChild(el);
})();


