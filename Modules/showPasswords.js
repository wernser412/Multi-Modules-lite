// showPasswords.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "showPasswords",
    mod: {
      title: "👁 Mostrar contraseñas",
      desc: "Agrega un botón para revelar el texto en campos de contraseña",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        GM_addStyle(`
          .mml-pw-toggle {
            position: fixed;
            width: 22px;
            height: 22px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            opacity: .6;
            z-index: 2147483000;
            user-select: none;
            pointer-events: auto;
          }
          .mml-pw-toggle:hover { opacity: 1; }
        `);

        // IMPORTANTE: nunca movemos ni re-parentamos el <input> original.
        // Muchos sitios (React, Vue, etc.) esperan que el campo siga siendo
        // hijo directo del nodo que ellos controlan; si lo sacamos para
        // meterlo en un wrapper, en cuanto el framework re-renderiza el
        // formulario (típicamente al perder el foco) intenta reconciliar
        // un DOM que ya no coincide con lo que espera, y el input queda
        // roto o se reemplaza por uno nuevo (perdiendo el estado "visible").
        // Por eso el ícono se dibuja como una capa flotante (position:fixed)
        // posicionada por coordenadas, totalmente por fuera del árbol del
        // formulario.

        const tracked = new Map(); // input -> { toggle, showing }
        let rafId = null;

        const removeToggleFor = (input) => {
          const entry = tracked.get(input);
          if (!entry) return;
          entry.toggle.remove();
          tracked.delete(input);
        };

        const positionToggle = (input, toggle) => {
          const rect = input.getBoundingClientRect();
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            input.isConnected &&
            getComputedStyle(input).visibility !== "hidden" &&
            getComputedStyle(input).display !== "none";

          if (!visible) {
            toggle.style.display = "none";
            return;
          }

          toggle.style.display = "flex";
          const size = Math.min(22, rect.height);
          toggle.style.width = `${size}px`;
          toggle.style.height = `${size}px`;
          toggle.style.left = `${rect.right - size - 6}px`;
          toggle.style.top = `${rect.top + (rect.height - size) / 2}px`;
        };

        const tick = () => {
          tracked.forEach(({ toggle }, input) => positionToggle(input, toggle));
          rafId = requestAnimationFrame(tick);
        };
        const startLoop = () => {
          if (rafId == null) rafId = requestAnimationFrame(tick);
        };
        const stopLoop = () => {
          if (rafId != null) cancelAnimationFrame(rafId);
          rafId = null;
        };

        const wrapInput = (input) => {
          if (tracked.has(input)) return;
          if (!input.isConnected) return;

          const toggle = document.createElement("span");
          toggle.className = "mml-pw-toggle";
          toggle.textContent = "👁";
          toggle.title = "Mostrar/ocultar contraseña";

          toggle.addEventListener("mousedown", (e) => e.preventDefault()); // no robar el foco del input
          toggle.addEventListener("click", () => {
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            toggle.textContent = showing ? "👁" : "🙈";
          });

          document.body.appendChild(toggle);
          tracked.set(input, { toggle });
          positionToggle(input, toggle);
          startLoop();

          // Si el sitio elimina/reemplaza el input (SPA, cierre de modal,
          // otro render), sacamos su ícono para no dejar basura flotando.
          const cleanupObserver = new MutationObserver(() => {
            if (!input.isConnected) {
              cleanupObserver.disconnect();
              removeToggleFor(input);
              if (tracked.size === 0) stopLoop();
            }
          });
          cleanupObserver.observe(document.body, { childList: true, subtree: true });
        };

        const scan = (root = document) => {
          root.querySelectorAll?.('input[type="password"]').forEach(wrapInput);
        };

        scan();

        // Muchos formularios de login se inyectan después (modales, SPA,
        // "iniciar sesión" que aparece recién al hacer clic).
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType !== 1) continue;
              if (node.matches?.('input[type="password"]')) wrapInput(node);
              else scan(node);
            }
          }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const onReposition = () => tracked.forEach(({ toggle }, input) => positionToggle(input, toggle));
        window.addEventListener("scroll", onReposition, true);
        window.addEventListener("resize", onReposition);

        this._cleanup = () => {
          observer.disconnect();
          stopLoop();
          window.removeEventListener("scroll", onReposition, true);
          window.removeEventListener("resize", onReposition);
          tracked.forEach(({ toggle }, input) => {
            toggle.remove();
            input.type = "password";
          });
          tracked.clear();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
