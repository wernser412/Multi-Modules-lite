// forceLazyLoadImages.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "forceLazyLoadImages",
    mod: {
      title: "🖼 Forzar carga de imágenes",
      desc: "Carga todas las imágenes al instante, sin esperar al scroll",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // Atributos típicos que usan las librerías de lazy-load (lazysizes,
        // yall.js, WordPress, la mayoría de webs de noticias/tiendas, etc.)
        // para guardar la URL real de la imagen hasta que "toca" cargarla.
        const LAZY_ATTRS = [
          "data-src", "data-lazy-src", "data-original", "data-src-retina",
          "data-lazy", "data-echo", "data-url", "data-actualsrc"
        ];
        const LAZY_SRCSET_ATTRS = ["data-srcset", "data-lazy-srcset"];

        const revealImg = (img) => {
          if (img.dataset.mmlLazyDone) return;
          img.dataset.mmlLazyDone = "1";

          // 1) Sacar el lazy-loading nativo del navegador.
          if (img.loading === "lazy") img.loading = "eager";

          // 2) Copiar cualquier atributo data-* con la URL real a src/srcset.
          for (const attr of LAZY_ATTRS) {
            const val = img.getAttribute(attr);
            if (val && img.src !== val) {
              img.src = val;
              break;
            }
          }
          for (const attr of LAZY_SRCSET_ATTRS) {
            const val = img.getAttribute(attr);
            if (val) {
              img.srcset = val;
              break;
            }
          }

          // 3) Muchas libs marcan la imagen como "cargada" solo cuando
          // detectan estas clases; se las agregamos para que no se quede
          // en blur/placeholder aunque ya tenga la imagen real.
          img.classList.remove("lazyload", "lazy");
          img.classList.add("lazyloaded", "loaded");
        };

        const revealBg = (el) => {
          // Fondos lazy (div con data-bg / data-background-image)
          const bgAttr = el.getAttribute("data-bg") || el.getAttribute("data-background-image");
          if (bgAttr && !el.dataset.mmlBgDone) {
            el.dataset.mmlBgDone = "1";
            el.style.backgroundImage = `url("${bgAttr}")`;
          }
        };

        const scan = (root = document) => {
          root.querySelectorAll?.("img").forEach(revealImg);
          root.querySelectorAll?.("[data-bg], [data-background-image]").forEach(revealBg);
        };

        scan();

        // Imágenes que se agregan después (scroll infinito, SPA, carruseles).
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType !== 1) continue;
              if (node.tagName === "IMG") revealImg(node);
              else scan(node);
            }
            if (m.type === "attributes" && m.target.tagName === "IMG") {
              revealImg(m.target);
            }
          }
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-src", "data-lazy-src", "data-original", "src"]
        });

        // Truco: algunas librerías deciden cuándo cargar mirando
        // IntersectionObserver. Lo reemplazamos por una versión que avisa
        // "ya está visible" de inmediato para cualquier elemento que se
        // observe, así esas libs cargan todo apenas arrancan.
        if (!window.__mmlOrigIntersectionObserver) {
          window.__mmlOrigIntersectionObserver = window.IntersectionObserver;
          window.IntersectionObserver = function (callback, options) {
            const fakeObserver = new window.__mmlOrigIntersectionObserver(callback, options);
            const origObserve = fakeObserver.observe.bind(fakeObserver);
            fakeObserver.observe = (target) => {
              origObserve(target);
              requestAnimationFrame(() => {
                const rect = target.getBoundingClientRect();
                callback([{
                  isIntersecting: true,
                  intersectionRatio: 1,
                  target,
                  boundingClientRect: rect,
                  intersectionRect: rect,
                  rootBounds: null,
                  time: performance.now()
                }], fakeObserver);
              });
            };
            return fakeObserver;
          };
        }

        // Reintento periódico corto por si alguna imagen se pierde el
        // primer pase (por ejemplo, cargó su data-src un instante después).
        let ticks = 0;
        this._interval = setInterval(() => {
          scan();
          if (++ticks >= 10) clearInterval(this._interval);
        }, 800);

        this._cleanup = () => {
          observer.disconnect();
          clearInterval(this._interval);
          if (window.__mmlOrigIntersectionObserver) {
            window.IntersectionObserver = window.__mmlOrigIntersectionObserver;
            window.__mmlOrigIntersectionObserver = null;
          }
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
