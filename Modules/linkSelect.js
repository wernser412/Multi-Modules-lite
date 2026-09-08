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

        const DEBUG = true;
        const log = (...args) => { if (DEBUG) console.log("[linkSelect]", ...args); };

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

        function hasRealText(node) {
          if (!node) return false;
          return node.nodeType === 3
            ? node.data.trim().length > 0
            : (node.textContent || "").trim().length > 0;
        }

        // Devuelve el offset (índice de carácter) dentro de un nodo de texto
        // más cercano al punto (x, y), midiendo carácter por carácter con
        // Range.getClientRects(). Como es puro layout, no le importa el
        // pointer-events del nodo ni de sus ancestros.
        function offsetForPoint(textNode, x, y) {
          const len = textNode.data.length;
          const r = document.createRange();
          for (let i = 0; i < len; i++) {
            r.setStart(textNode, i);
            r.setEnd(textNode, i + 1);
            const rects = r.getClientRects();
            for (const rect of rects) {
              if (y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right + 1) {
                const mid = rect.left + rect.width / 2;
                return x < mid ? i : i + 1;
              }
            }
          }
          return len;
        }

        // Recorre a mano los nodos de texto de "root" buscando cuál cae bajo
        // (x, y). Es el fallback para sitios tipo Reddit, donde el texto real
        // de las tarjetas tiene pointer-events:none (y encima suele haber un
        // <a> que cubre toda la tarjeta para navegar). El hit-test nativo del
        // navegador (elementFromPoint / caretPositionFromPoint) EXCLUYE por
        // completo cualquier elemento con pointer-events:none —igual que para
        // un click real—, así que nunca "aterriza" en ese texto por más capas
        // que se le saquen de encima al overlay: hay que ignorar pointer-events
        // del todo y guiarse solo por la posición visual (rects) del texto.
        function findTextCaret(root, x, y) {
          if (!root) return null;
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
              if (!n.data.trim()) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          });

          const range = document.createRange();
          let node;
          while ((node = walker.nextNode())) {
            range.selectNodeContents(node);
            const rects = range.getClientRects();
            for (const rect of rects) {
              if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return { offsetNode: node, offset: offsetForPoint(node, x, y) };
              }
            }
          }
          return null;
        }

        function caretFromPoint(x, y) {
          const direct = rawCaretFromPoint(x, y);
          if (hasRealText(direct?.offsetNode)) {
            log("caret: hit-test nativo encontró texto directo", direct.offsetNode);
            return direct;
          }

          // El hit-test nativo no encontró texto real (probablemente por
          // pointer-events:none). Buscamos a mano dentro de un contenedor
          // razonable alrededor del punto.
          const hit = document.elementFromPoint(x, y);
          const root = hit?.closest?.("article, main, [role='article'], body") || document.body;
          const manual = findTextCaret(root, x, y);
          if (manual) {
            log("caret: encontrado a mano dentro de", root, manual.offsetNode);
          } else {
            log("caret: NO se encontró texto ni con hit-test nativo ni a mano. hit=", hit, "root=", root, "direct=", direct);
          }
          return manual || direct;
        }

        function getInitPos() {
          return caretFromPoint(initPos[0] - window.scrollX, initPos[1] - window.scrollY);
        }

        let forcedEls = [];

        // Fuerza user-select:text en toda la cadena de ancestros del nodo de
        // texto real (no solo en el <a> más cercano al punto de click). En
        // Reddit el texto de las tarjetas suele tener user-select:none
        // además de pointer-events:none, así que aunque logremos crear la
        // selección por JS, el navegador no la pinta si no revertimos eso.
        function forceSelectableChain(node) {
          let el = node?.nodeType === 3 ? node.parentElement : node;
          let guard = 0;
          while (el && el !== document.body && guard++ < 12) {
            if (!el.classList.contains("mml-select-inside-link")) {
              el.classList.add("mml-select-inside-link");
              forcedEls.push(el);
            }
            el = el.parentElement;
          }
        }

        function startWaiting() {
          if (anchorEl) anchorEl.classList.remove("mml-select-inside-link");
          forcedEls.forEach(el => el.classList.remove("mml-select-inside-link"));
          forcedEls = [];
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
          log("startSelecting, pos=", pos);
          if (!pos || !pos.offsetNode) { log("startSelecting abortado: sin posición de texto"); return; }

          forceSelectableChain(pos.offsetNode);

          if (selectType === "new") {
            selection.collapse(pos.offsetNode, pos.offset);
          } else if (selectType === "add") {
            const range = new Range();
            range.setStart(pos.offsetNode, pos.offset);
            selection.addRange(range);
          }

          log("selection tras collapse/addRange:", selection.toString(), "isCollapsed:", selection.isCollapsed);
          state = "STARTED";
        }

        const onMouseDown = e => {
          if (state !== "WAITING") { log("mousedown ignorado, state=", state); return; }
          if (e.button !== 0 || e.altKey) return;

          const target = deepTarget(e);
          log("mousedown en", target);

          // No interferir con inputs, textareas, contenteditable ni botones:
          // ahí un click normal (sin selección de texto) debe funcionar tal cual.
          if (target?.closest?.("input, textarea, [contenteditable='true'], button, [role='button'], select")) {
            log("mousedown descartado: target está dentro de un control interactivo");
            return;
          }

          selectType = e.ctrlKey ? "add" : e.shiftKey ? "extend" : "new";
          initPos = [e.pageX, e.pageY];
          mousemoves = 0;
          state = "STARTING";
          log("state -> STARTING");

          // Si hay un <a> ancestro, le forzamos user-select por si el sitio
          // se lo desactivó (común en tarjetas/enlaces clickeables).
          anchorEl = findLink(target);
          if (anchorEl) anchorEl.classList.add("mml-select-inside-link");
        };

        const onMouseMove = e => {
          if (state === "STARTING") {
            mousemoves++;
            if (mousemoves >= 3) { log("umbral de 3 mousemoves alcanzado, llamando startSelecting()"); startSelecting(); }
          }

          if (state === "STARTED") {
            const caret = caretFromPoint(e.pageX - window.scrollX, e.pageY - window.scrollY);
            if (caret) {
              forceSelectableChain(caret.offsetNode);
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
