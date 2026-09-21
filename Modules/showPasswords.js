// showPasswords.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "showPasswords",
    mod: {
      title: "👁 Mostrar contraseñas",
      desc: "Panel flotante y movible: mostrar contraseñas siempre en todas las páginas, o solo al pasar el mouse sobre el campo",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // Si es true, el panel aparece en TODAS las páginas (como Image Hover
        // Zoom). Si es false, solo aparece en páginas que tengan algún campo
        // de contraseña.
        const ALWAYS_SHOW_TOOLBAR = false;

        // ---------- Config / persistencia ----------
        // Los modos son GLOBALES (GM_setValue se comparte entre todos los
        // sitios y pestañas). La posición del panel se guarda por sitio.
        const SITE = location.hostname || "default";
        const KEY = {
          all: "mml_pw_mode_all",
          hover: "mml_pw_mode_hover",
          x: `mml_pw_toolbar_x__${SITE}`,
          y: `mml_pw_toolbar_y__${SITE}`,
          open: `mml_pw_toolbar_open__${SITE}`
        };
        const DEFAULT_POS = { x: 20, y: 124 }; // distancia desde bottom-left
        const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

        let showAll = !!GM_getValue(KEY.all, false);   // siempre visibles
        let hoverMode = !!GM_getValue(KEY.hover, false); // visibles al pasar el mouse

        GM_addStyle(`
          #mml-pw-toolbar {
            position: fixed;
            z-index: 2147483647;
          }
          #mml-pw-fab {
            width: 38px;
            height: 38px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 999px;
            background: #14161a;
            color: #eee;
            font-size: 16px;
            cursor: grab;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
            border: 1px solid rgba(255,255,255,.08);
            user-select: none;
            touch-action: none;
          }
          #mml-pw-fab.mml-pw-dragging { cursor: grabbing; }
          #mml-pw-fab.mml-pw-active { background: #4285F4; }
          #mml-pw-row {
            position: absolute;
            top: 0;
            display: none;
            align-items: center;
            gap: 4px;
            background: #14161a;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 999px;
            padding: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
            white-space: nowrap;
          }
          #mml-pw-row.mml-pw-open { display: flex; }
          #mml-pw-row.mml-pw-row-right { left: 44px; }
          #mml-pw-row.mml-pw-row-left { right: 44px; }
          #mml-pw-row button {
            box-sizing: border-box;
            height: 30px;
            padding: 0 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,.08);
            color: #eee;
            font-size: 12px;
            font-family: system-ui, sans-serif;
            cursor: pointer;
            line-height: 1;
            flex: none;
          }
          #mml-pw-row button:hover { background: rgba(255,255,255,.2); }
          #mml-pw-row button.mml-pw-active { background: #4285F4; }
        `);

        // ---------- Estado: qué campos hemos tocado ----------
        // Marcamos los inputs con data-mml-pw para poder encontrarlos aunque
        // ya no tengan type="password" (al mostrarlos pasan a type="text").
        // shownByUs: solo revertimos los campos que nosotros mismos
        // mostramos, así respetamos el ojito nativo del sitio si lo hay.
        const shownByUs = new Set();
        const hoverSet = new Set();
        const INPUT_SEL = 'input[type="password"], input[data-mml-pw]';
        const allInputs = () => document.querySelectorAll(INPUT_SEL);

        const shouldShow = (input) => showAll || (hoverMode && hoverSet.has(input));

        const apply = (input) => {
          if (shouldShow(input)) {
            if (input.type === "password") {
              input.type = "text";
              shownByUs.add(input);
            }
          } else if (shownByUs.has(input)) {
            input.type = "password";
            shownByUs.delete(input);
          }
        };
        const applyAll = () => allInputs().forEach(apply);

        // ---------- Toolbar: FAB + fila de controles ----------
        const toolbar = document.createElement("div");
        toolbar.id = "mml-pw-toolbar";
        toolbar.style.display = ALWAYS_SHOW_TOOLBAR ? "" : "none";

        const fab = document.createElement("button");
        fab.id = "mml-pw-fab";
        fab.type = "button";
        fab.textContent = "👁";
        fab.title = "Mostrar contraseñas (arrastrar para mover)";

        const row = document.createElement("div");
        row.id = "mml-pw-row";
        row.className = "mml-pw-row-right";

        const makeBtn = (label, title) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.title = title;
          return b;
        };
        const btnAll = makeBtn("🌐 Siempre", "Mostrar las contraseñas siempre, en todas las páginas");
        const btnHover = makeBtn("🖱 Al pasar el mouse", "Mostrar la contraseña solo mientras el mouse está sobre el campo (en todas las páginas)");
        row.append(btnAll, btnHover);

        toolbar.append(fab, row);
        document.documentElement.appendChild(toolbar);

        const refreshButtons = () => {
          btnAll.classList.toggle("mml-pw-active", showAll);
          btnHover.classList.toggle("mml-pw-active", hoverMode);
        };
        refreshButtons();

        const clearHover = () => {
          const old = [...hoverSet];
          hoverSet.clear();
          old.forEach(apply);
        };

        btnAll.addEventListener("click", (e) => {
          e.stopPropagation();
          showAll = !showAll;
          try { GM_setValue(KEY.all, showAll); } catch {}
          refreshButtons();
          applyAll();
        });
        btnHover.addEventListener("click", (e) => {
          e.stopPropagation();
          hoverMode = !hoverMode;
          try { GM_setValue(KEY.hover, hoverMode); } catch {}
          refreshButtons();
          if (!hoverMode) clearHover();
          applyAll();
        });

        // ---------- Abrir/cerrar la fila (compacto) ----------
        const placeRow = () => {
          if (!row.classList.contains("mml-pw-open")) return;
          row.classList.remove("mml-pw-row-left");
          row.classList.add("mml-pw-row-right");
          const r = row.getBoundingClientRect();
          // Si abrirlo hacia la derecha se saldría de pantalla, se abre
          // hacia la izquierda.
          if (r.right > window.innerWidth - 4) {
            row.classList.remove("mml-pw-row-right");
            row.classList.add("mml-pw-row-left");
          }
        };
        const setOpen = (open) => {
          row.classList.toggle("mml-pw-open", open);
          fab.classList.toggle("mml-pw-active", open);
          try { GM_setValue(KEY.open, open ? "1" : "0"); } catch {}
          if (open) placeRow();
        };

        // ---------- Arrastrar el FAB (posición persistida por sitio) ----------
        const setToolbarPos = (x, y) => {
          const w = 38, h = 38;
          x = clamp(x, 4, window.innerWidth - w - 4);
          y = clamp(y, 4, window.innerHeight - h - 4);
          toolbar.style.left = `${x}px`;
          toolbar.style.top = `${y}px`;
          return { x, y };
        };

        const savedX = Number(GM_getValue(KEY.x, DEFAULT_POS.x));
        const savedY = Number(GM_getValue(KEY.y, DEFAULT_POS.y));
        setToolbarPos(savedX, window.innerHeight - savedY - 38);
        setOpen(GM_getValue(KEY.open, "0") === "1");

        let dragging = false;
        let moved = false;
        let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

        const onDragStart = (e) => {
          dragging = true;
          moved = false;
          fab.classList.add("mml-pw-dragging");
          fab.setPointerCapture(e.pointerId);
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          const r = toolbar.getBoundingClientRect();
          dragStartLeft = r.left;
          dragStartTop = r.top;
        };
        const onDragMove = (e) => {
          if (!dragging) return;
          if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) moved = true;
          if (!moved) return;
          const pos = setToolbarPos(
            dragStartLeft + (e.clientX - dragStartX),
            dragStartTop + (e.clientY - dragStartY)
          );
          GM_setValue(KEY.x, pos.x);
          GM_setValue(KEY.y, window.innerHeight - pos.y - 38);
          placeRow();
        };
        const onDragEnd = (e) => {
          if (!dragging) return;
          dragging = false;
          fab.classList.remove("mml-pw-dragging");
          try { fab.releasePointerCapture(e.pointerId); } catch {}
          // Sin arrastre real = click: abrir/cerrar la fila.
          if (!moved) setOpen(!row.classList.contains("mml-pw-open"));
        };
        fab.addEventListener("pointerdown", onDragStart);
        fab.addEventListener("pointermove", onDragMove);
        fab.addEventListener("pointerup", onDragEnd);
        fab.addEventListener("pointercancel", onDragEnd);

        const onWindowResize = () => {
          const r = toolbar.getBoundingClientRect();
          setToolbarPos(r.left, r.top);
          placeRow();
        };
        window.addEventListener("resize", onWindowResize);

        // ---------- Modo "al pasar el mouse" ----------
        // Se revisa en cada movimiento qué campo de contraseña hay bajo el
        // cursor (por coordenadas, no por mouseover), así el campo sigue
        // "hovered" aunque el sitio ponga encima su propio ojito o ícono.
        let mx = 0, my = 0, hoverRaf = false;

        const processHover = () => {
          hoverRaf = false;
          if (!hoverMode && hoverSet.size === 0) return;

          const now = new Set();
          if (hoverMode) {
            const el = document.elementFromPoint(mx, my);
            if (el) {
              allInputs().forEach((input) => {
                const r = input.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) return;
                if (mx < r.left || mx > r.right || my < r.top || my > r.bottom) return;
                if (
                  el === input ||
                  el.contains(input) ||
                  input.parentElement?.contains(el)
                ) now.add(input);
              });
            }
          }

          [...hoverSet].forEach((i) => {
            if (!now.has(i)) {
              hoverSet.delete(i);
              apply(i);
            }
          });
          now.forEach((i) => {
            if (!hoverSet.has(i)) {
              hoverSet.add(i);
              apply(i);
            }
          });
        };

        const onMove = (e) => {
          if (!hoverMode && hoverSet.size === 0) return;
          mx = e.clientX;
          my = e.clientY;
          if (!hoverRaf) {
            hoverRaf = true;
            requestAnimationFrame(processHover);
          }
        };
        const onLeaveWindow = (e) => {
          if (!e.relatedTarget && hoverSet.size) clearHover();
        };
        document.addEventListener("mousemove", onMove, { capture: true, passive: true });
        document.addEventListener("mouseout", onLeaveWindow, true);

        // ---------- Detectar campos de contraseña ----------
        const mark = (input) => {
          if (!input.hasAttribute("data-mml-pw")) input.setAttribute("data-mml-pw", "1");
        };
        const handleInput = (input) => {
          mark(input);
          apply(input);
        };

        let visRaf = false;
        const updateToolbarVisibility = () => {
          visRaf = false;
          if (ALWAYS_SHOW_TOOLBAR) return;
          const has = !!document.querySelector(INPUT_SEL);
          const wasHidden = toolbar.style.display === "none";
          toolbar.style.display = has ? "" : "none";
          if (has && wasHidden) {
            const r = toolbar.getBoundingClientRect();
            setToolbarPos(r.left || savedX, r.top || (window.innerHeight - savedY - 38));
            placeRow();
          }
        };
        const scheduleVisibility = () => {
          if (visRaf) return;
          visRaf = true;
          requestAnimationFrame(updateToolbarVisibility);
        };

        const scan = (root = document) => {
          root.querySelectorAll?.('input[type="password"]').forEach(handleInput);
        };

        scan();
        scheduleVisibility();

        // Formularios inyectados después (modales, SPA, "iniciar sesión"
        // que aparece recién al hacer clic).
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType !== 1) continue;
              if (node.matches?.('input[type="password"]')) handleInput(node);
              else scan(node);
            }
          }
          scheduleVisibility();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // ---------- Sincronizar con otras pestañas/sitios ----------
        // Consultamos GM_getValue cada segundo (no requiere permisos extra).
        const syncTimer = setInterval(() => {
          let a, h;
          try {
            a = !!GM_getValue(KEY.all, false);
            h = !!GM_getValue(KEY.hover, false);
          } catch { return; }
          if (a === showAll && h === hoverMode) return;
          showAll = a;
          hoverMode = h;
          refreshButtons();
          if (!hoverMode) clearHover();
          applyAll();
        }, 1000);

        this._cleanup = () => {
          observer.disconnect();
          clearInterval(syncTimer);
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseout", onLeaveWindow, true);
          window.removeEventListener("resize", onWindowResize);
          fab.removeEventListener("pointerdown", onDragStart);
          fab.removeEventListener("pointermove", onDragMove);
          fab.removeEventListener("pointerup", onDragEnd);
          fab.removeEventListener("pointercancel", onDragEnd);

          // Devolver los campos a su estado original.
          allInputs().forEach((input) => {
            if (shownByUs.has(input)) input.type = "password";
            input.removeAttribute("data-mml-pw");
          });
          shownByUs.clear();
          hoverSet.clear();
          toolbar.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
