// showPasswords.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "showPasswords",
    mod: {
      title: "👁 Mostrar contraseñas",
      desc: "Agrega un botón para revelar el texto en campos de contraseña (estado global entre sitios)",
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
        // El ícono se dibuja como capa flotante (position:fixed) por fuera
        // del árbol del formulario, para no romper React/Vue/etc.

        // ── ESTADO GLOBAL ────────────────────────────────────────────
        // Un único valor (mostrar / ocultar) guardado con GM_setValue,
        // que Tampermonkey comparte entre TODOS los sitios y pestañas.
        const GLOBAL_KEY = "mml_pw_show_global";
        let globalShow = !!GM_getValue(GLOBAL_KEY, false);

        const tracked = new Map(); // input -> { toggle, skipped, applied }
        let rafId = null;
        let frame = 0;

        // ── DETECCIÓN DE OJITO PROPIO DEL SITIO ─────────────────────
        // Miramos qué elementos hay justo donde iría nuestro ícono. Si hay
        // algo "tipo botón/ícono" que no sea el input ni un ancestro suyo,
        // asumimos que es el ojito nativo y NO mostramos el nuestro.
        const PM_ATTR = /^(data-lastpass|data-bwautofill|data-1p|data-dashlane|com-1password|data-keeper)/i;
        const PM_ID = /^(lp-|__lpform|bitwarden|1password|dashlane)/i;
        const isPasswordManager = (el) =>
          PM_ID.test(el.id || "") ||
          [...(el.attributes || [])].some((a) => PM_ATTR.test(a.name));

        const ICON_SELECTOR = 'button,[role="button"],svg,i,img,a,[tabindex]';
        const isIconLike = (el, input) => {
          const c = el.closest?.(ICON_SELECTOR);
          if (c && !c.contains(input)) return true;
          try {
            return getComputedStyle(el).cursor === "pointer";
          } catch {
            return false;
          }
        };

        // elemento = hay ojito nativo, false = no hay, null = no se puede saber
        // (input fuera de pantalla u oculto): en ese caso se conserva la
        // decisión anterior.
        const detectNative = (input) => {
          if (!input.isConnected) return null;
          const r = input.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          if (
            r.bottom < 0 || r.top > innerHeight ||
            r.right < 0 || r.left > innerWidth
          ) return null;

          const size = Math.min(22, r.height);
          const yc = r.top + r.height / 2;
          const ys = [yc, yc - size / 4, yc + size / 4];
          const xs = [0.25, 0.5, 0.75, 1].map((k) => r.right - 6 - size * k);

          for (const x of xs) {
            for (const y of ys) {
              const els = document.elementsFromPoint(x, y);
              for (const el of els) {
                if (el === input) continue;
                if (el.classList?.contains("mml-pw-toggle")) continue;
                if (el.contains(input)) continue; // ancestros
                if (isPasswordManager(el)) continue;
                if (isIconLike(el, input)) return el;
              }
            }
          }
          return false;
        };

        // ── APLICAR ESTADO ──────────────────────────────────────────
        const applyState = (input, entry, showing) => {
          input.type = showing ? "text" : "password";
          entry.toggle.textContent = showing ? "🙈" : "👁";
          entry.applied = showing;
        };

        const applyAll = () => {
          tracked.forEach((entry, input) => {
            if (entry.skipped !== null) applyState(input, entry, globalShow);
          });
        };

        const evaluate = (input, entry) => {
          const res = detectNative(input);
          if (res === null) return;
          const isNative = !!res;
          if (isNative) entry.nativeEl = res;
          if (isNative === entry.skipped) return;
          entry.skipped = isNative;
          // Con o sin ojito nativo, aplicamos el estado global. La
          // diferencia: si hay ojito nativo, ocultamos el nuestro.
          if (isNative) entry.toggle.style.display = "none";
          applyState(input, entry, globalShow);
        };

        // ── POSICIÓN ────────────────────────────────────────────────
        const positionToggle = (input, entry) => {
          const toggle = entry.toggle;
          if (entry.skipped !== false) {
            toggle.style.display = "none";
            return;
          }
          const rect = input.getBoundingClientRect();
          const cs = getComputedStyle(input);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            input.isConnected &&
            cs.visibility !== "hidden" &&
            cs.display !== "none";

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
          frame++;
          // Re-evaluar la presencia de ojito nativo ~2 veces por segundo
          // (algunos sitios lo dibujan tarde).
          if (frame % 30 === 0) tracked.forEach((entry, input) => evaluate(input, entry));
          tracked.forEach((entry, input) => positionToggle(input, entry));
          rafId = requestAnimationFrame(tick);
        };
        const startLoop = () => {
          if (rafId == null) rafId = requestAnimationFrame(tick);
        };
        const stopLoop = () => {
          if (rafId != null) cancelAnimationFrame(rafId);
          rafId = null;
        };

        const removeToggleFor = (input) => {
          const entry = tracked.get(input);
          if (!entry) return;
          entry.toggle.remove();
          tracked.delete(input);
        };

        const wrapInput = (input) => {
          if (tracked.has(input)) return;
          if (!input.isConnected) return;

          const toggle = document.createElement("span");
          toggle.className = "mml-pw-toggle";
          toggle.title = "Mostrar/ocultar contraseña (todos los sitios)";
          toggle.textContent = "👁";
          toggle.style.display = "none"; // oculto hasta decidir si hay ojito nativo

          // skipped: null = sin decidir, true = ojito nativo, false = usamos el nuestro
          const entry = { toggle, skipped: null, applied: false };

          toggle.addEventListener("mousedown", (e) => e.preventDefault()); // no robar el foco
          toggle.addEventListener("click", () => {
            globalShow = !globalShow;
            try { GM_setValue(GLOBAL_KEY, globalShow); } catch {}
            applyAll();
          });

          document.body.appendChild(toggle);
          tracked.set(input, entry);
          startLoop();

          // Primera evaluación rápida (el ojito nativo suele existir ya).
          setTimeout(() => {
            if (tracked.get(input) === entry) evaluate(input, entry);
          }, 250);

          // Si el sitio elimina/reemplaza el input, quitamos su ícono.
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

        // Formularios inyectados después (modales, SPA, etc.).
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

        const onReposition = () => tracked.forEach((entry, input) => positionToggle(input, entry));
        window.addEventListener("scroll", onReposition, true);
        window.addEventListener("resize", onReposition);

        // Clic en el ojito NATIVO del sitio: tras el clic, si el campo
        // cambió de tipo, ese nuevo estado pasa a ser el global.
        // (Se ignoran cambios que no vengan de un clic, p. ej. re-renders.)
        const onNativeClick = (e) => {
          tracked.forEach((entry, input) => {
            if (entry.skipped !== true || e.target === input) return;
            const r = input.getBoundingClientRect();
            const inside =
              e.clientX >= r.left && e.clientX <= r.right + 8 &&
              e.clientY >= r.top && e.clientY <= r.bottom;
            if (!inside) return;
            setTimeout(() => {
              const newShow = input.type === "text";
              if (newShow === globalShow) return;
              globalShow = newShow;
              try { GM_setValue(GLOBAL_KEY, globalShow); } catch {}
              applyAll();
            }, 80);
          });
        };
        document.addEventListener("click", onNativeClick, true);

        // Sincronizar con otras pestañas/sitios: sin necesidad de
        // @grant GM_addValueChangeListener, consultamos cada segundo.
        const syncTimer = setInterval(() => {
          let v;
          try { v = !!GM_getValue(GLOBAL_KEY, false); } catch { return; }
          if (v !== globalShow) {
            globalShow = v;
            applyAll();
          }
        }, 1000);

        this._cleanup = () => {
          observer.disconnect();
          clearInterval(syncTimer);
          document.removeEventListener("click", onNativeClick, true);
          stopLoop();
          window.removeEventListener("scroll", onReposition, true);
          window.removeEventListener("resize", onReposition);
          tracked.forEach((entry, input) => {
            entry.toggle.remove();
            if (entry.applied) input.type = "password";
          });
          tracked.clear();
          // Al apagar el módulo volvemos a "oculto" en todos lados.
          try { GM_setValue(GLOBAL_KEY, false); } catch {}
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
