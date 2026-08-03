// mathSelectSolve.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "mathSelectSolve",
    mod: {
      title: "🧮 Resolver selección matemática",
      desc: "Al seleccionar una operación (ej: 1+5) aparece un ícono para ver el resultado",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        GM_addStyle(`
          .mml-math-icon {
            position: fixed;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: #1e1e1e;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: pointer;
            z-index: 2147483000;
            box-shadow: 0 2px 6px rgba(0,0,0,.35);
            user-select: none;
          }
          .mml-math-icon:hover { transform: scale(1.08); }
          .mml-math-bubble {
            position: fixed;
            max-width: 260px;
            background: #1e1e1e;
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-line;
            z-index: 2147483001;
            box-shadow: 0 4px 14px rgba(0,0,0,.4);
            cursor: pointer;
            user-select: none;
          }
          .mml-math-bubble small {
            display: block;
            opacity: .6;
            font-size: 11px;
            margin-top: 2px;
          }
        `);

        // ---------- Parser matemático seguro (sin eval/Function) ----------
        // Soporta: + - * / % ^ (potencia), paréntesis, decimales, signo unario.
        const tokenize = (str) => {
          const tokens = [];
          let i = 0;
          while (i < str.length) {
            const c = str[i];
            if (/\s/.test(c)) { i++; continue; }
            if (/[0-9.]/.test(c)) {
              let j = i;
              while (j < str.length && /[0-9.]/.test(str[j])) j++;
              const raw = str.slice(i, j);
              if ((raw.match(/\./g) || []).length > 1) throw new Error("Número inválido");
              tokens.push({ t: "num", v: parseFloat(raw) });
              i = j;
              continue;
            }
            if ("+-*/^%()".includes(c)) {
              tokens.push({ t: c });
              i++;
              continue;
            }
            throw new Error("Carácter inválido");
          }
          return tokens;
        };

        const parseExpr = (tokens) => {
          let pos = 0;
          const peek = () => tokens[pos];
          const next = () => tokens[pos++];

          const parsePrimary = () => {
            const tok = peek();
            if (!tok) throw new Error("Expresión incompleta");
            if (tok.t === "num") { next(); return tok.v; }
            if (tok.t === "(") {
              next();
              const val = parseAdd();
              if (!peek() || peek().t !== ")") throw new Error("Falta paréntesis");
              next();
              return val;
            }
            throw new Error("Expresión inválida");
          };

          const parseUnary = () => {
            if (peek() && (peek().t === "+" || peek().t === "-")) {
              const op = next().t;
              const val = parseUnary();
              return op === "-" ? -val : val;
            }
            return parsePrimary();
          };

          const parsePow = () => {
            const base = parseUnary();
            if (peek() && peek().t === "^") {
              next();
              const exp = parsePow(); // asociatividad derecha
              return Math.pow(base, exp);
            }
            return base;
          };

          const parseMul = () => {
            let val = parsePow();
            while (peek() && (peek().t === "*" || peek().t === "/" || peek().t === "%")) {
              const op = next().t;
              const rhs = parsePow();
              if (op === "*") val *= rhs;
              else if (op === "/") val /= rhs;
              else val %= rhs;
            }
            return val;
          };

          const parseAdd = () => {
            let val = parseMul();
            while (peek() && (peek().t === "+" || peek().t === "-")) {
              const op = next().t;
              const rhs = parseMul();
              val = op === "+" ? val + rhs : val - rhs;
            }
            return val;
          };

          const result = parseAdd();
          if (pos !== tokens.length) throw new Error("Expresión inválida");
          return result;
        };

        const solve = (text) => parseExpr(tokenize(text));

        // Filtro rápido antes de intentar parsear: solo caracteres válidos
        // y al menos un operador (para no reaccionar a un número suelto).
        const looksLikeMath = (text) => {
          if (!text || text.length > 200) return false;
          if (!/^[0-9+\-*/^%().\s]+$/.test(text)) return false;
          if (!/[+\-*/^%]/.test(text.replace(/^\s*-/, ""))) return false; // ignora el signo inicial
          return /\d/.test(text);
        };

        // ---------- UI flotante ----------
        let icon = null;
        let bubble = null;

        const removeIcon = () => { icon?.remove(); icon = null; };
        const removeBubble = () => { bubble?.remove(); bubble = null; };
        const removeAll = () => { removeIcon(); removeBubble(); };

        const showIcon = (rect, expression) => {
          removeAll();
          icon = document.createElement("div");
          icon.className = "mml-math-icon";
          icon.textContent = "🧮";
          icon.title = "Calcular selección";
          icon.style.left = `${Math.min(rect.right + 6, window.innerWidth - 32)}px`;
          icon.style.top = `${Math.max(rect.top - 4, 4)}px`;

          icon.addEventListener("mousedown", (e) => e.preventDefault()); // no perder la selección
          icon.addEventListener("click", (e) => {
            e.stopPropagation();
            showResult(expression);
          });

          document.body.appendChild(icon);
        };

        // Un double de JS solo garantiza ~15-17 cifras significativas. Si
        // algún número de la expresión trae más cifras que eso, o el
        // resultado supera el rango de enteros "seguros", el cálculo puede
        // no ser exacto — avisamos en vez de mostrarlo como si lo fuera.
        const hasPrecisionRisk = (expression, result) => {
          const nums = expression.match(/\d*\.?\d+/g) || [];
          for (const n of nums) {
            const digits = n.replace(".", "").replace(/^0+(?=\d)/, "");
            if (digits.length > 15) return true;
          }
          return Number.isFinite(result) && Math.abs(result) > Number.MAX_SAFE_INTEGER;
        };

        const showResult = (expression) => {
          removeBubble();
          let text;
          try {
            const result = solve(expression);
            if (Number.isNaN(result)) throw new Error("No calculable");
            if (!Number.isFinite(result)) {
              text = `${expression.trim()} = no se puede calcular (¿división por 0?)`;
            } else {
              // Limpia el ruido de punto flotante (ej: 0.1+0.2 = 0.30000000000000004)
              // redondeando a 12 cifras SIGNIFICATIVAS en vez de decimales fijos,
              // así funciona igual de bien con números chicos y grandes.
              const clean = Number.isInteger(result) ? result : parseFloat(result.toPrecision(12));
              text = `${expression.trim()} = ${clean}`;
              if (hasPrecisionRisk(expression, result)) {
                text += "\n⚠️ Números muy grandes: el resultado podría no ser exacto";
              }
            }
          } catch {
            text = "No pude interpretar esa operación";
          }

          bubble = document.createElement("div");
          bubble.className = "mml-math-bubble";
          bubble.innerHTML = `${text}<small>Click para copiar el resultado</small>`;

          const iconRect = icon?.getBoundingClientRect();
          const top = iconRect ? iconRect.bottom + 6 : 20;
          const left = iconRect ? Math.min(iconRect.left, window.innerWidth - 270) : 20;
          bubble.style.top = `${top}px`;
          bubble.style.left = `${Math.max(left, 4)}px`;

          bubble.addEventListener("mousedown", (e) => e.preventDefault());
          bubble.addEventListener("click", async (e) => {
            e.stopPropagation();
            const match = text.match(/=\s*(-?[\d.]+)/);
            if (!match) return;
            try {
              await navigator.clipboard.writeText(match[1]);
              bubble.innerHTML = "✅ Copiado";
              setTimeout(removeAll, 700);
            } catch {}
          });

          document.body.appendChild(bubble);
        };

        // ---------- Detección de selección ----------
        const onSelectionUp = (e) => {
          // Si el mouseup ocurrió sobre el ícono o la burbuja, no reprocesar
          // la selección: eso destruiría y recrearía el ícono antes de que
          // el navegador llegue a disparar el evento "click" sobre él.
          if (icon?.contains(e.target) || bubble?.contains(e.target)) return;

          const sel = window.getSelection();
          const text = sel?.toString().trim();

          if (!text || !looksLikeMath(text)) {
            removeAll();
            return;
          }

          try {
            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();
            const rect = rects[rects.length - 1] || range.getBoundingClientRect();
            if (!rect || (rect.width === 0 && rect.height === 0)) return;
            showIcon(rect, text);
          } catch {
            removeAll();
          }
        };

        const onMouseDown = (e) => {
          if (icon?.contains(e.target) || bubble?.contains(e.target)) return;
          removeAll();
        };

        const onKeyDown = (e) => {
          if (e.key === "Escape") removeAll();
        };

        const onScrollOrResize = () => removeAll();

        document.addEventListener("mouseup", onSelectionUp);
        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);

        this._cleanup = () => {
          document.removeEventListener("mouseup", onSelectionUp);
          document.removeEventListener("mousedown", onMouseDown, true);
          document.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("scroll", onScrollOrResize, true);
          window.removeEventListener("resize", onScrollOrResize);
          removeAll();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
