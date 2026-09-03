// ytSpeedButton.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ytSpeedButton",
    mod: {
      title: "⏩ Botón de velocidad",
      desc: "Click: abre lista de velocidades para elegir directo.",
      category: "YouTube",

      enable() {

        if (!location.hostname.includes("youtube.com")) return;

        let observer;
        let btn;
        let menu;
        let videoObserver;
        let outsideClickHandler;

        const speeds = [0.5, 1, 1.5, 2, 2.5, 3];
        let current = 1;

        const applyRate = () => {
          const v = document.querySelector("video");
          if (v) v.playbackRate = current;
        };

        const setSpeed = (s) => {
          current = s;
          if (btn) btn.textContent = current + "×";
          applyRate();
          closeMenu();
        };

        const closeMenu = () => {
          menu?.remove();
          menu = null;
          if (outsideClickHandler) {
            document.removeEventListener("click", outsideClickHandler, true);
            outsideClickHandler = null;
          }
        };

        const openMenu = () => {
          if (menu) {
            closeMenu();
            return;
          }

          const rect = btn.getBoundingClientRect();

          menu = document.createElement("div");
          menu.id = "vh-speed-menu";
          menu.style.cssText = `
            position:fixed;
            bottom:${window.innerHeight - rect.top + 6}px;
            left:${rect.right - 64}px;
            background:rgba(28,28,28,.97);
            border-radius:6px;
            padding:4px 0;
            display:flex; flex-direction:column;
            min-width:64px;
            box-shadow:0 4px 14px rgba(0,0,0,.5);
            font-family:inherit;
            z-index:2147483647;
          `;

          speeds.forEach((s) => {
            const item = document.createElement("div");
            item.textContent = s + "×";
            item.style.cssText = `
              padding:6px 14px;
              font-size:13px;
              color:${s === current ? "#3ea6ff" : "white"};
              font-weight:${s === current ? "700" : "400"};
              cursor:pointer;
              text-align:right;
            `;
            item.onmouseenter = () => item.style.background = "rgba(255,255,255,.15)";
            item.onmouseleave = () => item.style.background = "transparent";
            item.onclick = (e) => {
              e.stopPropagation();
              setSpeed(s);
            };
            menu.appendChild(item);
          });

          document.body.appendChild(menu);

          // Cierra el menú si haces click fuera de él.
          outsideClickHandler = (e) => {
            if (menu && !menu.contains(e.target) && e.target !== btn) {
              closeMenu();
            }
          };
          setTimeout(() => {
            document.addEventListener("click", outsideClickHandler, true);
          }, 0);
        };

        const createButton = (controls) => {
          if (!controls) return;
          if (document.getElementById("vh-speed")) return;

          btn = document.createElement("button");
          btn.id = "vh-speed";
          btn.className = "ytp-button";
          btn.textContent = current + "×";
          btn.title = "Elegir velocidad";

          btn.style.cssText = `
            display:flex; align-items:center; justify-content:center;
            width:48px; height:100%; font-size:13px; font-weight:700;
            line-height:1; padding:0; margin:0; color:white; text-align:center;
          `;

          btn.onclick = (e) => {
            e.stopPropagation();
            openMenu();
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
          closeMenu();
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
