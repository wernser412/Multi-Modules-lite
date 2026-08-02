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
          .mml-pw-wrap {
            position: relative !important;
            display: inline-block !important;
          }
          .mml-pw-toggle {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            opacity: .6;
            z-index: 2147483000;
            user-select: none;
          }
          .mml-pw-toggle:hover { opacity: 1; }
        `);

        // Envuelve el <input> en un wrapper relativo (sin romper el layout
        // original: se copian ancho/display si el input estaba en flujo) y
        // le agrega el botón de ojito encima.
        const wrapInput = (input) => {
          if (input.dataset.mmlPwWrapped) return;
          input.dataset.mmlPwWrapped = "1";

          const wrapper = document.createElement("span");
          wrapper.className = "mml-pw-wrap";

          input.parentNode.insertBefore(wrapper, input);
          wrapper.appendChild(input);

          // Deja lugar para el ícono sin tapar el texto que se está escribiendo.
          const prevPadding = getComputedStyle(input).paddingRight;
          input.style.paddingRight = `calc(${prevPadding} + 22px)`;

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

          wrapper.appendChild(toggle);
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

        this._cleanup = () => {
          observer.disconnect();
          document.querySelectorAll(".mml-pw-wrap").forEach((wrapper) => {
            const input = wrapper.querySelector("input");
            const toggle = wrapper.querySelector(".mml-pw-toggle");
            if (input) {
              input.type = "password";
              input.style.paddingRight = "";
              delete input.dataset.mmlPwWrapped;
              wrapper.parentNode.insertBefore(input, wrapper);
            }
            toggle?.remove();
            wrapper.remove();
          });
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
