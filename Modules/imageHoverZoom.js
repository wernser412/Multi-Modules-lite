// imageHoverZoom.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "imageHoverZoom",
    mod: {
      title: "🔍 Image Hover Zoom",
      desc: "Vista previa ampliada de cualquier imagen al pasar el mouse",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        const panel = document.createElement("img");
        panel.id = "mml-hover-zoom-preview";

        Object.assign(panel.style, {
          position: "fixed",
          top: "50%",
          right: "20px",
          transform: "translateY(-50%)",
          maxHeight: "88vh",
          maxWidth: "42vw",
          zIndex: 2147483647,
          borderRadius: "12px",
          boxShadow: "0 0 40px rgba(0,0,0,.85)",
          background: "#000",
          display: "none",
          pointerEvents: "none",
          objectFit: "contain"
        });

        document.documentElement.appendChild(panel);

        // Misma lógica de extracción que imageTooltip.js: sirve para
        // imágenes normales, lazy-load (data-src/data-original), <image>
        // de SVG y fondos con background-image.
        const extract = (node) => {
          while (node) {
            if (node.nodeType !== 1) {
              node = node.parentElement;
              continue;
            }

            const tag = node.tagName.toLowerCase();

            if (tag === "img") {
              return (
                node.getAttribute("orig") ||
                node.currentSrc ||
                node.src ||
                node.getAttribute("data-src") ||
                node.getAttribute("data-original") ||
                ""
              );
            }

            if (tag === "image") {
              return (
                node.getAttribute("href") ||
                node.getAttribute("xlink:href") ||
                ""
              );
            }

            const child = node.querySelector?.("img") || node.querySelector?.("image");

            if (child) {
              const cs2 = getComputedStyle(child);
              return (
                child.getAttribute("orig") ||
                child.currentSrc ||
                child.src ||
                child.getAttribute("data-src") ||
                child.getAttribute("data-original") ||
                child.getAttribute("href") ||
                child.getAttribute("xlink:href") ||
                (cs2.backgroundImage !== "none" &&
                  cs2.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]) ||
                ""
              );
            }

            const cs = getComputedStyle(node);
            if (cs.backgroundImage && cs.backgroundImage !== "none") {
              const m = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
              if (m) return m[1];
            }

            node = node.parentElement;
          }
          return "";
        };

        // Tamaño mínimo para no activar el preview con iconos/avatares/sprites.
        const MIN_SIZE = 48;

        const isTooSmall = (el) => {
          const r = el.getBoundingClientRect?.();
          if (!r) return false;
          return r.width < MIN_SIZE || r.height < MIN_SIZE;
        };

        let lastUrl = "";

        const onOver = (e) => {
          // Ignorar el propio panel para no auto-dispararse.
          if (e.target === panel || panel.contains(e.target)) return;

          const el = e.target.closest("img, image, [style*='background-image']") || e.target;
          if (isTooSmall(el)) return;

          const url = extract(el);
          if (!url || url === panel.src) return;

          lastUrl = url;
          panel.src = url;
          panel.style.display = "block";
        };

        const onOut = (e) => {
          const related = e.relatedTarget;
          // Si el mouse se mueve hacia el propio panel, no ocultarlo.
          if (related && (related === panel || panel.contains(related))) return;

          const el = e.target.closest("img, image, [style*='background-image']");
          if (!el) return;

          lastUrl = "";
          panel.style.display = "none";
        };

        document.addEventListener("mouseover", onOver, true);
        document.addEventListener("mouseout", onOut, true);

        this._cleanup = () => {
          document.removeEventListener("mouseover", onOver, true);
          document.removeEventListener("mouseout", onOut, true);
          panel.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
