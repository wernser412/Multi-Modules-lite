// modules/iframeUnlock.js
// Este archivo se sube a GitHub y se carga con @require desde el script principal.
// No depende de que "register" ya exista: solo se apunta a una cola global.

(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "iframeUnlock",
    mod: {
      title: "🧩 Desbloquear iframes",
      desc: "Habilita pointer-events, incluso en iframes nuevos",
      category: "General",

      enable() {
        const unlockAll = () => {
          document.querySelectorAll("iframe").forEach(f => {
            f.style.pointerEvents = "auto";
          });
        };
        unlockAll();

        this._observer = new MutationObserver(unlockAll);
        this._observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      },

      disable() {
        this._observer?.disconnect();
      }
    }
  });
})();
