// ytToggleComments.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ytToggleComments",
    mod: {
      title: "💬 Ocultar comentarios",
      desc: "Botón para mostrar/ocultar la sección de comentarios",
      category: "YouTube",

      enable() {

        if (!location.hostname.includes("youtube.com")) return;

        const KEY = "vh_comments_enabled";
        let lastState = null;
        let scheduled = false;

        const apply = () => {
          const enabled = JSON.parse(localStorage.getItem(KEY) ?? "true");
          if (enabled === lastState) return;
          lastState = enabled;

          const c = document.querySelector("ytd-comments");
          if (!c) return;

          document.getElementById("vh-c-msg")?.remove();

          if (enabled) {
            c.style.display = "";
            return;
          }

          c.style.display = "none";

          const msg = document.createElement("div");
          msg.id = "vh-c-msg";
          msg.textContent = "💬 Comentarios desactivados";
          msg.style.cssText = "margin:30px auto;text-align:center;font-size:20px;color:#aaa;";
          c.parentElement?.insertBefore(msg, c);
        };

        const safeApply = () => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            apply();
            scheduled = false;
          });
        };

        const toggleComments = () => {
          const current = JSON.parse(localStorage.getItem(KEY) ?? "true");
          localStorage.setItem(KEY, JSON.stringify(!current));
          safeApply();
        };

        const wait = setInterval(() => {
          const controls = document.querySelector(".ytp-right-controls");
          if (!controls) return;
          if (document.getElementById("vh-comments-btn")) return;
          clearInterval(wait);

          const btn = document.createElement("button");
          btn.id = "vh-comments-btn";
          btn.className = "ytp-button";
          btn.textContent = "💬";
          btn.onclick = toggleComments;

          btn.style.cssText = `
            display:flex; align-items:center; justify-content:center;
            width:48px; height:100%; padding:0; margin:0;
            font-size:16px; line-height:48px; box-sizing:border-box; color:white;
          `;
          controls.prepend(btn);

          safeApply();

          const obs = new MutationObserver(() => safeApply());
          const target = document.querySelector("#page-manager") || document.body;
          obs.observe(target, { childList: true, subtree: false });

          this._obs = obs;
        }, 1000);

        this._cleanup = () => {
          clearInterval(wait);
          this._obs?.disconnect();
          document.getElementById("vh-comments-btn")?.remove();
          document.getElementById("vh-c-msg")?.remove();
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
