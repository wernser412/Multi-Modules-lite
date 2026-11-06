// linkSelect.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "linkSelect",
    mod: {
      title: "🔗 Seleccionar texto dentro de links",
      desc: "Permite marcar texto sin activar el enlace",
      category: "General",

      enable() {

        const selection = window.getSelection();

        let state = "WAITING";
        let anchorEl = null; // <a> ancestor, si existe (solo para el estilo user-select)
        let initPos = [0, 0];
        let selectType = "new";
        let mousemoves = 0;

        function findLink(el) {
          while (el && el.nodeName !== "A") el = el.parentNode;
          return el;
        }

        // Elemento real bajo el mouse, atravesando Shadow DOM. Sitios como
        // Reddit ponen la barra lateral/menús dentro de shadow roots
        // reales; sin esto, e.target queda "retargeteado" al componente
        // host en vez del <a> real de adentro.
        const deepTarget = (e) => {
          let t = e.target;
          if (typeof e.composedPath === "function") {
            const path = e.composedPath();
            if (path && path.length) t = path[0];
          }
          if (t && t.nodeType !== 1) t = t.parentElement;
          return t;
        };

        function caretFromPoint(x, y) {
          if (document.caretPositionFromPoint) {
            return document.caretPositionFromPoint(x, y);
          }
          const r = document.caretRangeFromPoint(x, y);
          return r ? { offsetNode: r.startContainer, offset: r.startOffset } : null;
        }

        function getInitPos() {
          return caretFromPoint(initPos[0] - window.scrollX, initPos[1] - window.scrollY);
        }

        function startWaiting() {
          if (anchorEl) anchorEl.classList.remove("mml-select-inside-link");
          state = "WAITING";
          anchorEl = null;
        }

        // Chequeo de la verdad: hay o no una selección de texto real en
        // este momento. Sirve como red de seguridad para sitios donde
        // nuestra detección manual (caretPositionFromPoint) falla —p. ej.
        // por "pointer-events: none" en el texto, como en las tarjetas de
        // Reddit— pero el navegador igual permitió seleccionar el texto
        // por su cuenta.
        //
        // OJO: si el texto vive dentro de un Shadow DOM real (no
        // proyectado por slot, sino definido dentro del propio shadow
        // root -típico en la barra lateral/menús de Reddit-),
        // document.getSelection() a nivel de la página NO ve esa
        // selección: Chrome la expone solo a través del getSelection()
        // propio de ese shadow root. Por eso recorremos composedPath()
        // buscando shadow roots y consultamos cada uno también.
        const hasRealSelection = (e) => {
          const isReal = sel => !!(sel && !sel.isCollapsed && sel.toString().trim().length > 0);

          if (isReal(window.getSelection())) return true;

          const path = e?.composedPath ? e.composedPath() : [];
          const checked = new Set();

          for (const node of path) {
            const root = node?.getRootNode ? node.getRootNode() : null;
            if (
              root &&
              root !== document &&
              typeof root.getSelection === "function" &&
              !checked.has(root)
            ) {
              checked.add(root);
              if (isReal(root.getSelection())) return true;
            }
          }

          return false;
        };

        function startSelecting() {
          const pos = getInitPos();
          if (!pos || !pos.offsetNode) return;

          if (selectType === "new") {
            selection.collapse(pos.offsetNode, pos.offset);
          } else if (selectType === "add") {
            const range = new Range();
            range.setStart(pos.offsetNode, pos.offset);
            selection.addRange(range);
          }

          state = "STARTED";
        }

        // Los clics sobre la interfaz propia de Multi Modules (íconos de
        // selección 🧮/🔎/🌐, burbujas, cajas, panel ⚙) nunca deben bloquearse
        // ni iniciar una selección: si no, mientras hay texto seleccionado
        // (justo cuando aparecen esos íconos) ningún clic les llegaría.
        // OJO: el propio link que se está seleccionando lleva la clase
        // "mml-select-inside-link"; NO cuenta como interfaz propia (si contara,
        // su clic no se bloquearía y se abriría el enlace).
        const isOwnUI = e => !!e.target?.closest?.(
          ':is([class^="mml-"], [class*=" mml-"], [id^="mml-"]):not(.mml-select-inside-link)'
        );

        // ¿El mousedown cayó sobre texto que YA está seleccionado? Entonces el
        // usuario quiere ARRASTRAR ese texto (p. ej. soltarlo en una pestaña para
        // buscarlo en Google), no hacer otra selección: no se interviene.
        const isOnSelectedText = e => {
          try {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
            const rects = sel.getRangeAt(0).getClientRects();
            for (const r of rects) {
              if (e.clientX >= r.left - 1 && e.clientX <= r.right + 1 &&
                  e.clientY >= r.top - 1 && e.clientY <= r.bottom + 1) return true;
            }
          } catch {}
          return false;
        };

        const onMouseDown = e => {
          if (isOwnUI(e)) return;
          if (state !== "WAITING") return;
          if (e.button === 0 && isOnSelectedText(e)) return; // arrastre nativo del texto seleccionado
          if (e.button !== 0 || e.altKey) return;

          const target = deepTarget(e);

          // No interferir con inputs, textareas, contenteditable ni botones:
          // ahí un click normal (sin selección de texto) debe funcionar tal cual.
          if (target?.closest?.("input, textarea, [contenteditable='true'], button, [role='button'], select")) return;

          selectType = e.ctrlKey ? "add" : e.shiftKey ? "extend" : "new";
          initPos = [e.pageX, e.pageY];
          mousemoves = 0;
          state = "STARTING";

          // Si hay un <a> ancestro, le forzamos user-select por si el sitio
          // se lo desactivó (común en tarjetas/enlaces clickeables).
          anchorEl = findLink(target);
          // (la clase también desactiva el arrastre nativo del enlace vía CSS)
          if (anchorEl) anchorEl.classList.add("mml-select-inside-link");
        };

        const onMouseMove = e => {
          if (state === "STARTING") {
            mousemoves++;
            if (mousemoves >= 3) startSelecting();
          }

          if (state === "STARTED") {
            const caret = caretFromPoint(e.pageX - window.scrollX, e.pageY - window.scrollY);
            if (caret) {
              try { selection.extend(caret.offsetNode, caret.offset); } catch {}
            }
          }
        };

        const onMouseUp = (e) => {
          if (state === "STARTED" || hasRealSelection(e)) {
            // Hubo una selección real (nuestra o nativa del navegador,
            // incluso dentro de un shadow root): recién acá bloqueamos
            // el click siguiente.
            state = "ENDING";
            setTimeout(startWaiting, 0);
          } else if (state !== "WAITING") {
            // Fue un click normal (sin seleccionar texto): no bloquear nada.
            startWaiting();
          }
        };

        const onClick = e => {
          if (isOwnUI(e)) return;
          if (state === "ENDING" || hasRealSelection(e)) {
            // Hubo una selección de texto real: no dejar que el click
            // dispare una navegación. Esto cubre <a> normales, tarjetas
            // que navegan por JS al detectar un click en cualquier parte
            // (YouTube, Reddit) y también texto dentro de shadow roots
            // reales (barra lateral / menús de Reddit), ya que al frenar
            // la propagación acá (fase de captura, antes de llegar al
            // elemento) el handler que navega nunca se llega a ejecutar.
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          if (state !== "WAITING") startWaiting();
        };

        const onDragStart = e => {
          // Un <a> es "arrastrable" por defecto: si el usuario empieza a arrastrar
          // para SELECCIONAR texto, Chrome inicia además el arrastre nativo del
          // enlace, y al soltarlo sobre la página abre ese link (la redirección).
          // Por eso se cancela el arrastre nativo también en STARTING (antes solo
          // se cancelaba en STARTED).
          if (state === "STARTING") {
            const t = deepTarget(e);
            const isMedia = !!t?.closest?.("img, svg, video, canvas, picture");
            if (!anchorEl || isMedia) { startWaiting(); return; } // no es un arrastre de enlace: se deja nativo
            startSelecting();
          }
          if (state === "STARTED" || state === "ENDING") e.preventDefault();
        };

        // Red de seguridad: si el arrastre nativo llegó a empezar igual, evita
        // que soltarlo sobre la página navegue al enlace.
        const onDragOverOrDrop = e => {
          if (state === "STARTED" || state === "ENDING") e.preventDefault();
        };
        const onDragEnd = () => {
          if (state !== "WAITING") startWaiting();
        };

        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("mouseup", onMouseUp, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("dragstart", onDragStart, true);
        document.addEventListener("dragover", onDragOverOrDrop, true);
        document.addEventListener("drop", onDragOverOrDrop, true);
        document.addEventListener("dragend", onDragEnd, true);

        GM_addStyle(`
          .mml-select-inside-link {
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -webkit-user-drag: none !important;
            user-drag: none !important;
          }
        `);

        this._cleanup = () => {
          document.removeEventListener("mousedown", onMouseDown, true);
          document.removeEventListener("mousemove", onMouseMove, true);
          document.removeEventListener("mouseup", onMouseUp, true);
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("dragstart", onDragStart, true);
          document.removeEventListener("dragover", onDragOverOrDrop, true);
          document.removeEventListener("drop", onDragOverOrDrop, true);
          document.removeEventListener("dragend", onDragEnd, true);
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
