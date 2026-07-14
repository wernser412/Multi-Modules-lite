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
        let linkTarget = null;
        let initPos = [0, 0];
        let selectType = "new";
        let mousemoves = 0;

        const moves = [[0, 0], [0, 0], [0, 0]];
        let index = 0;

        const onTrackMove = e => {
          moves[index][0] = e.pageX;
          moves[index][1] = e.pageY;
          index = (index + 1) % 3;
        };

        function findLink(el) {
          while (el && el.nodeName !== "A") el = el.parentNode;
          return el;
        }

        function caretFromPoint(x, y) {
          if (document.caretPositionFromPoint) {
            return document.caretPositionFromPoint(x, y);
          }
          const r = document.caretRangeFromPoint(x, y);
          return { offsetNode: r.startContainer, offset: r.startOffset };
        }

        function getInitPos() {
          return caretFromPoint(initPos[0] - window.scrollX, initPos[1] - window.scrollY);
        }

        function startWaiting() {
          if (linkTarget) linkTarget.classList.remove("mml-select-inside-link");
          state = "WAITING";
          linkTarget = null;
        }

        function startSelecting() {
          const pos = getInitPos();

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

          const link = findLink(e.target);
          if (!link || !link.href) return;

          selectType = e.ctrlKey ? "add" : e.shiftKey ? "extend" : "new";
          initPos = [e.pageX, e.pageY];
          mousemoves = 0;
          state = "STARTING";
          linkTarget = link;
          link.classList.add("mml-select-inside-link");
        };

        const onMouseMove = e => {
          if (state === "STARTING") {
            mousemoves++;
            if (mousemoves >= 3) startSelecting();
          }

          if (state === "STARTED") {
            const caret = caretFromPoint(e.pageX - window.scrollX, e.pageY - window.scrollY);
            try { selection.extend(caret.offsetNode, caret.offset); } catch {}
          }
        };

        const onMouseUp = () => {
          if (state !== "WAITING") {
            state = "ENDING";
            setTimeout(startWaiting, 0);
          }
        };

        const onClick = e => {
          if (state === "ENDING" && linkTarget) {
            const clicked = findLink(e.target);
            if (clicked === linkTarget) {
              e.preventDefault();
              e.stopImmediatePropagation();
            }
            startWaiting();
          }
        };

        const onDragStart = e => {
          if (state === "STARTED") e.preventDefault();
          else if (state === "STARTING") startSelecting();
        };

        document.addEventListener("mousemove", onTrackMove, true);
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
          document.removeEventListener("mousemove", onTrackMove, true);
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
