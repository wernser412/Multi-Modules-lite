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

        function rawCaretFromPoint(x, y) {
          if (document.caretPositionFromPoint) {
            return document.caretPositionFromPoint(x, y);
          }
          const r = document.caretRangeFromPoint(x, y);
          return r ? { offsetNode: r.startContainer, offset: r.startOffset } : null;
        }

        // Perfora elementos con pointer-events:none que tapan el punto (p. ej.
        // las tarjetas de Reddit, donde el texto real tiene pointer-events:none
        // y un <a> overlay ("stretched link") de toda la tarjeta lo cubre para
        // navegar). caretPositionFromPoint respeta pointer-events igual que
        // cualquier hit-test de mouse, así que sin esto siempre devuelve una
        // posición dentro del overlay vacío en vez del texto real de abajo.
        function caretFromPoint(x, y) {
          const forced = [];
          let pos = rawCaretFromPoint(x, y);
          let guard = 0;

          while (guard++ < 8) {
            const node = pos?.offsetNode;
            const hasText = node && (
              node.nodeType === 3
                ? node.data.trim().length > 0
                : node.textContent?.trim().length > 0
            );
            if (hasText) break;

            const el = document.elementFromPoint(x, y);
            if (!el || forced.includes(el)) break;

            const cs = getComputedStyle(el);
            if (cs.pointerEvents === "none") break; // ya debería estar excluido del hit-test

            // El elemento encontrado sí recibe eventos (p. ej. el overlay de
            // Reddit): lo apagamos un instante para que el próximo hit-test
            // mire lo que hay debajo.
            el.style.setProperty("pointer-events", "none", "important");
            forced.push(el);
            pos = rawCaretFromPoint(x, y);
          }

          forced.forEach(el => el.style.removeProperty("pointer-events"));
          return pos;
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

        const onMouseDown = e => {
          if (state !== "WAITING") return;
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
