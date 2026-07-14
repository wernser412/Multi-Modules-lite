// ultraUnlock.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ultraUnlock",
    mod: {
      title: "🖼 Desbloquear web",
      desc: "Copiar, seleccionar texto y menú contextual",
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
      }
    }
  });
})();
