// plainCopy.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "plainCopy",
    mod: {
      title: "📋 Copiar sin formato",
      desc: "Copia siempre como texto plano, sin negritas/colores/tablas/links",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        const onCopy = (e) => {
          const text = window.getSelection().toString();
          if (!text) return; // Nada seleccionado (ej: copiando un input) -> no tocar

          e.preventDefault();
          e.clipboardData.setData("text/plain", text);
        };

        document.addEventListener("copy", onCopy);

        this._cleanup = () => {
          document.removeEventListener("copy", onCopy);
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
