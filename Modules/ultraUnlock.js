// ultraUnlock.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ultraUnlock",
    mod: {
      title: "🖼 Desbloquear web",
      desc: "Copiar, seleccionar texto, menú contextual y traducir con Chrome",
      category: "General",

      enable() {

        GM_addStyle(`
          * {
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            -webkit-touch-callout: default !important;
          }
          input, textarea {
            user-select: text !important;
            -webkit-user-select: text !important;
          }
        `);

        const events = [
          "copy", "beforecopy", "cut", "paste",
          "contextmenu", "selectstart", "keydown", "keyup",
          "mousedown", "mouseup", "dragstart", "drag", "dragend",
          "select", "auxclick", "dblclick"
        ];

        this._handler = e => e.stopImmediatePropagation();
        events.forEach(ev => document.addEventListener(ev, this._handler, true));

        try {
          document.oncopy = null;
          document.oncut = null;
          document.onpaste = null;
          document.oncontextmenu = null;
          document.onselectstart = null;
          document.ondragstart = null;
          window.oncopy = null;
          window.oncut = null;
          window.onpaste = null;
          window.oncontextmenu = null;
        } catch {}

        // ---- Desbloquear la traducción de Chrome ----
        // Quita las marcas con las que algunas webs impiden traducir la página:
        // <meta name="google" content="notranslate">, translate="no" y
        // class="notranslate" en <html>/<body>. (No toca partes internas
        // como bloques de código, que suelen marcarse a propósito.)
        const cleanNoTranslate = () => {
          document.querySelectorAll('meta[name="google" i], meta[name="googlebot" i]').forEach((m) => {
            if (/notranslate/i.test(m.getAttribute("content") || "")) m.remove();
          });
          [document.documentElement, document.body].forEach((el) => {
            if (!el) return;
            if (el.getAttribute("translate") === "no") el.removeAttribute("translate");
            if (el.classList.contains("notranslate")) el.classList.remove("notranslate");
          });
        };
        cleanNoTranslate();

        // Observación liviana: solo <head> (metas nuevas) y los atributos de <html>/<body>.
        this._ntObserver = new MutationObserver(cleanNoTranslate);
        this._ntObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["translate", "class"] });
        if (document.head) this._ntObserver.observe(document.head, { childList: true });
        if (document.body) this._ntObserver.observe(document.body, { attributes: true, attributeFilter: ["translate", "class"] });

        console.log("✅ UltraUnlock ON");
      },

      disable() {
        const events = [
          "copy", "beforecopy", "cut", "paste",
          "contextmenu", "selectstart", "keydown", "keyup",
          "mousedown", "mouseup", "dragstart", "drag", "dragend",
          "select", "auxclick", "dblclick"
        ];
        if (this._handler) {
          events.forEach(ev => document.removeEventListener(ev, this._handler, true));
        }
        this._ntObserver?.disconnect();
        this._ntObserver = null;
      }
    }
  });
})();
