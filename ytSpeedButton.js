// ytSpeedButton.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ytSpeedButton",
    mod: {
      title: "⏩ Botón de velocidad",
      desc: "Ciclo 1× / 1.5× / 2×, se mantiene entre videos",
      category: "YouTube",

      enable() {

        if (!location.hostname.includes("youtube.com")) return;

        let observer;
        let btn;
        let videoObserver;

        const speeds = [1, 1.5, 2];
        let index = 0;

        const applyRate = () => {
          const v = document.querySelector("video");
          if (v) v.playbackRate = speeds[index];
        };

        const createButton = (controls) => {
          if (!controls) return;
          if (document.getElementById("vh-speed")) return;

          btn = document.createElement("button");
          btn.id = "vh-speed";
          btn.className = "ytp-button";
          btn.textContent = speeds[index] + "×";

          btn.style.cssText = `
            display:flex; align-items:center; justify-content:center;
            width:48px; height:100%; font-size:13px; font-weight:700;
            line-height:1; padding:0; margin:0; color:white; text-align:center;
          `;

          btn.onclick = () => {
            index = (index + 1) % speeds.length;
            btn.textContent = speeds[index] + "×";
            applyRate();
          };

          controls.prepend(btn);
          applyRate();
        };

        const waitControls = setInterval(() => {
          const controls = document.querySelector(".ytp-right-controls");
          if (!controls) return;
          clearInterval(waitControls);
          createButton(controls);

          observer = new MutationObserver(() => {
            const c = document.querySelector(".ytp-right-controls");
            if (c && !document.getElementById("vh-speed")) createButton(c);
          });
          observer.observe(document.body, { childList: true, subtree: true });

          videoObserver = new MutationObserver(() => applyRate());
          videoObserver.observe(document.body, { childList: true, subtree: true });

          const v = document.querySelector("video");
          v?.addEventListener("loadedmetadata", applyRate);
        }, 500);

        this._cleanup = () => {
          clearInterval(waitControls);
          observer?.disconnect();
          videoObserver?.disconnect();
          document.querySelector("video")?.removeEventListener("loadedmetadata", applyRate);
          btn?.remove();
          btn = null;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
