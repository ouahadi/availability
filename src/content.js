// Content script placeholder
(() => {
  const markerId = "availability-ext-marker";
  if (document.getElementById(markerId)) return;

  const el = document.createElement("meta");
  el.id = markerId;
  el.name = "availability-extension";
  el.content = "installed";
  document.documentElement.appendChild(el);
})();


