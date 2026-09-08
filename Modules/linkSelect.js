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
        const hasRealSelection = () => {
          const sel = window.getSelection();
          return !!(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
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

        const onMouseDown = e => {
          if (state !== "WAITING") return;
          if (e.button !== 0 || e.altKey) return;

          // No interferir con inputs, textareas, contenteditable ni botones:
          // ahí un click normal (sin selección de texto) debe funcionar tal cual.
          if (e.target.closest?.("input, textarea, [contenteditable='true'], button, [role='button'], select")) return;

          selectType = e.ctrlKey ? "add" : e.shiftKey ? "extend" : "new";
          initPos = [e.pageX, e.pageY];
          mousemoves = 0;
          state = "STARTING";

          // Si hay un <a> ancestro, le forzamos user-select por si el sitio
          // se lo desactivó (común en tarjetas/enlaces clickeables).
          anchorEl = findLink(e.target);
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

        const onMouseUp = () => {
          if (state === "STARTED" || hasRealSelection()) {
            // Hubo una selección real (nuestra o nativa del navegador):
            // recién acá bloqueamos el click siguiente.
            state = "ENDING";
            setTimeout(startWaiting, 0);
          } else if (state !== "WAITING") {
            // Fue un click normal (sin seleccionar texto): no bloquear nada.
            startWaiting();
          }
        };

        const onClick = e => {
          if (state === "ENDING" || hasRealSelection()) {
            // Hubo una selección de texto real: no dejar que el click
            // dispare una navegación. Esto cubre tanto los <a> normales
            // como tarjetas que navegan por JS al detectar un click en
            // cualquier parte (p. ej. las tarjetas de video de YouTube o
            // de posts de Reddit), ya que al frenar la propagación acá
            // (fase de captura, antes de llegar al elemento) el handler
            // de esas tarjetas nunca se llega a ejecutar.
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          if (state !== "WAITING") startWaiting();
        };

        const onDragStart = e => {
          if (state === "STARTED") e.preventDefault();
          else if (state === "STARTING") startSelecting();
        };

        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("mouseup", onMouseUp, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("dragstart", onDragStart, true);

        GM_addStyle(`
          .mml-select-inside-link {
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
          }
        `);

        this._cleanup = () => {
          document.removeEventListener("mousedown", onMouseDown, true);
          document.removeEventListener("mousemove", onMouseMove, true);
          document.removeEventListener("mouseup", onMouseUp, true);
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("dragstart", onDragStart, true);
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
