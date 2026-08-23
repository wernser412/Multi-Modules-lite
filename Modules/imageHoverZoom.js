// imageHoverZoom.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "imageHoverZoom",
    mod: {
      title: "🔍 Image Hover Zoom",
      desc: "Vista previa ampliada de cualquier imagen al pasar el mouse, con botones para rotar y voltear",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        GM_addStyle(`
          #mml-hz-wrap {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            max-height: 88vh;
            max-width: 42vw;
            z-index: 2147483647;
            display: none;
          }
          #mml-hz-preview {
            display: block;
            max-height: 88vh;
            max-width: 42vw;
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(0,0,0,.85);
            background: #000;
            object-fit: contain;
            pointer-events: none;
            transition: transform .15s ease;
          }
          #mml-hz-toolbar {
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 4px;
            background: rgba(20,20,20,.85);
            backdrop-filter: blur(4px);
            padding: 5px;
            border-radius: 10px;
            box-shadow: 0 4px 14px rgba(0,0,0,.4);
            pointer-events: auto;
            opacity: 0;
            transition: opacity .15s ease;
          }
          #mml-hz-wrap:hover #mml-hz-toolbar,
          #mml-hz-toolbar.mml-hz-pinned { opacity: 1; }
          #mml-hz-toolbar button {
            box-sizing: border-box;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 7px;
            background: rgba(255,255,255,.08);
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            line-height: 1;
          }
          #mml-hz-toolbar button:hover { background: rgba(255,255,255,.22); }
          #mml-hz-toolbar button.mml-hz-active { background: #4285F4; }
        `);

        // ---------- Estructura: wrap (posiciona) > img + toolbar ----------
        const wrap = document.createElement("div");
        wrap.id = "mml-hz-wrap";

        const panel = document.createElement("img");
        panel.id = "mml-hz-preview";
        wrap.appendChild(panel);

        // Botón helper: crea un botón del toolbar sin usar innerHTML (evita
        // choques con Trusted Types en sitios con CSP estricto, ej. YouTube).
        const makeBtn = (label, title) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.title = title;
          return b;
        };

        const toolbar = document.createElement("div");
        toolbar.id = "mml-hz-toolbar";

        const btnRotateLeft = makeBtn("⟲", "Rotar 90° a la izquierda");
        const btnRotateRight = makeBtn("⟳", "Rotar 90° a la derecha");
        const btnFlipH = makeBtn("⇋", "Voltear horizontal");
        const btnFlipV = makeBtn("⇕", "Voltear vertical");
        const btnPin = makeBtn("📌", "Mantener siempre visible el toolbar");
        const btnReset = makeBtn("↺", "Restablecer");

        toolbar.append(btnRotateLeft, btnRotateRight, btnFlipH, btnFlipV, btnPin, btnReset);
        wrap.appendChild(toolbar);

        document.documentElement.appendChild(wrap);

        // ---------- Estado de transformación ----------
        const state = { rot: 0, flipH: false, flipV: false, pinned: false };

        const applyTransform = () => {
          panel.style.transform =
            `rotate(${state.rot}deg) scaleX(${state.flipH ? -1 : 1}) scaleY(${state.flipV ? -1 : 1})`;
        };

        const resetState = () => {
          state.rot = 0;
          state.flipH = false;
          state.flipV = false;
          btnFlipH.classList.remove("mml-hz-active");
          btnFlipV.classList.remove("mml-hz-active");
          applyTransform();
        };

        btnRotateLeft.addEventListener("click", (e) => {
          e.stopPropagation();
          state.rot = (state.rot - 90) % 360;
          applyTransform();
        });
        btnRotateRight.addEventListener("click", (e) => {
          e.stopPropagation();
          state.rot = (state.rot + 90) % 360;
          applyTransform();
        });
        btnFlipH.addEventListener("click", (e) => {
          e.stopPropagation();
          state.flipH = !state.flipH;
          btnFlipH.classList.toggle("mml-hz-active", state.flipH);
          applyTransform();
        });
        btnFlipV.addEventListener("click", (e) => {
          e.stopPropagation();
          state.flipV = !state.flipV;
          btnFlipV.classList.toggle("mml-hz-active", state.flipV);
          applyTransform();
        });
        btnPin.addEventListener("click", (e) => {
          e.stopPropagation();
          state.pinned = !state.pinned;
          btnPin.classList.toggle("mml-hz-active", state.pinned);
          toolbar.classList.toggle("mml-hz-pinned", state.pinned);
        });
        btnReset.addEventListener("click", (e) => {
          e.stopPropagation();
          resetState();
        });

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

        // En vez de depender de mouseover/mouseout (que a veces no disparan
        // bien: scroll rápido, elementos que se re-renderizan, overlays,
        // z-index encimados, etc.), se revisa en cada mousemove qué hay
        // realmente bajo el cursor. Así el panel nunca queda "pegado":
        // si no hay imagen debajo, se oculta sí o sí en ese mismo movimiento.
        const onMove = (e) => {
          // Si el cursor está sobre nuestro propio panel/toolbar, no tocar
          // nada: así se puede mover el mouse hacia los botones sin que el
          // preview se oculte a mitad de camino.
          if (wrap.contains(e.target)) return;

          const el = e.target.closest?.("img, image, [style*='background-image']");

          if (!el || isTooSmall(el)) {
            if (lastUrl && !state.pinned) {
              lastUrl = "";
              wrap.style.display = "none";
            }
            return;
          }

          const url = extract(el);

          if (!url) {
            if (lastUrl && !state.pinned) {
              lastUrl = "";
              wrap.style.display = "none";
            }
            return;
          }

          if (url !== lastUrl) {
            lastUrl = url;
            panel.src = url;
            resetState(); // imagen nueva: arrancar sin rotación/volteo previo
          }
          wrap.style.display = "block";
        };

        // Si el cursor sale de la ventana, también se oculta (salvo que el
        // toolbar esté fijado con 📌).
        const onLeaveWindow = (e) => {
          if ((!e.relatedTarget && !e.toElement) && !state.pinned) {
            lastUrl = "";
            wrap.style.display = "none";
          }
        };

        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseout", onLeaveWindow, true);

        this._cleanup = () => {
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseout", onLeaveWindow, true);
          wrap.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
