// mathSelectSolve.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "mathSelectSolve",
    mod: {
      title: "🧮 Resolver selección matemática",
      desc: "Al seleccionar una operación (ej: 4+5, √9, sen30, 2π, x²) aparece un ícono para ver el resultado",
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
        // Soporta: + - * / % ^ (potencia), paréntesis, decimales, signo
        // unario, constantes (pi, e) y funciones (sin, cos, sqrt, log...),
        // igual que el evaluador en AHK puro (EvaluarExpresionAHK).
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
            if (/[a-z]/i.test(c)) {
              let j = i + 1;
              while (j < str.length && /[a-z0-9]/i.test(str[j])) j++;
              tokens.push({ t: "id", v: str.slice(i, j).toLowerCase() });
              i = j;
              continue;
            }
            if ("+-*/^%(),".includes(c)) {
              tokens.push({ t: c });
              i++;
              continue;
            }
            throw new Error("Carácter inválido");
          }
          return tokens;
        };

        const MATH_CONSTANTS = { pi: Math.PI, e: Math.E };

        const factorial = (n) => {
          if (n < 0 || !Number.isInteger(n)) throw new Error("factorial() solo acepta enteros no negativos");
          let r = 1;
          for (let k = 2; k <= n; k++) r *= k;
          return r;
        };

        // Reemplaza a "from math import *": mismas funciones que soporta
        // el evaluador AHK (sqrt, sin, cos, tan, asin, acos, atan, ln,
        // log, log10, exp, abs, floor, ceil, round, factorial).
        const callFunction = (name, args) => {
          const need = (n) => {
            if (args.length !== n) throw new Error(`${name}() esperaba ${n} argumento(s), recibió ${args.length}`);
          };
          switch (name) {
            case "sqrt": need(1); return Math.sqrt(args[0]);
            case "sin": need(1); return Math.sin(args[0]);
            case "cos": need(1); return Math.cos(args[0]);
            case "tan": need(1); return Math.tan(args[0]);
            case "asin": need(1); return Math.asin(args[0]);
            case "acos": need(1); return Math.acos(args[0]);
            case "atan": need(1); return Math.atan(args[0]);
            case "ln": need(1); return Math.log(args[0]);
            case "log":
              if (args.length === 1) return Math.log(args[0]);
              need(2);
              return Math.log(args[0]) / Math.log(args[1]);
            case "log10": need(1); return Math.log10(args[0]);
            case "exp": need(1); return Math.exp(args[0]);
            case "abs": need(1); return Math.abs(args[0]);
            case "floor": need(1); return Math.floor(args[0]);
            case "ceil": need(1); return Math.ceil(args[0]);
            case "round":
              if (args.length === 1) return Math.round(args[0]);
              need(2);
              { const f = Math.pow(10, args[1]); return Math.round(args[0] * f) / f; }
            case "factorial": need(1); return factorial(args[0]);
            default:
              throw new Error(`Función desconocida: ${name}(). Soportadas: sqrt, sin, cos, tan, asin, acos, atan, ln, log, log10, exp, abs, floor, ceil, round, factorial`);
          }
        };

        const parseExpr = (tokens) => {
          let pos = 0;
          const peek = () => tokens[pos];
          const next = () => tokens[pos++];

          const parsePrimary = () => {
            const tok = peek();
            if (!tok) throw new Error("Expresión incompleta");
            if (tok.t === "num") { next(); return tok.v; }
            if (tok.t === "id") {
              next();
              const name = tok.v;
              if (peek() && peek().t === "(") {
                next();
                const args = [];
                if (!(peek() && peek().t === ")")) {
                  args.push(parseAdd());
                  while (peek() && peek().t === ",") { next(); args.push(parseAdd()); }
                }
                if (!(peek() && peek().t === ")")) throw new Error(`Falta paréntesis de cierre en ${name}(...)`);
                next();
                return callFunction(name, args);
              }
              if (name in MATH_CONSTANTS) return MATH_CONSTANTS[name];
              throw new Error(`Identificador desconocido: ${name}`);
            }
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

        // ---------- Normalización tipo AHK (NormalizarExpresionMatematica) ----------
        // Traduce notación "humana" en español y símbolos Unicode a la
        // sintaxis que entiende el parser de arriba: ÷ × • → /  * ,
        // "sen"/"π" → sin/pi, √ ∛ → potencias fraccionarias, superíndices
        // (x²) → ^, coma/punto y coma decimales → punto, etc.
        const SUPERSCRIPTS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };

        const normalizeExpression = (text) => {
          let b = text.replace(/ /g, "");
          b = b.replace(/\u200B/g, "");   // espacio de ancho cero
          b = b.replace(/[\u2013\u2014\u2212]/g, "-"); // guion medio/largo, signo menos matemático
          b = b.toLowerCase();

          b = b.replace(/[;,]/g, ".");    // coma/punto y coma decimal (notación en español)
          b = b.replace(/[÷:]/g, "/");
          b = b.replace(/[•×]/g, "*");
          b = b.replace(/x/g, "*");       // ninguna función soportada contiene "x"
          b = b.replace(/log10/g, "log\u0000ten"); // protege el "0" de log10 antes de la multiplicación implícita
          b = b.replace(/[\[{]/g, "(");
          b = b.replace(/[\]}]/g, ")");
          b = b.replace(/\)\(/g, ")*(");
          b = b.replace(/(\d)\(/g, "$1*(");
          b = b.replace(/log\u0000ten/g, "log10");

          // Trigonometría en español → inglés, con o sin paréntesis
          b = b.replace(/sen(\d+)/g, "sin($1)");
          b = b.replace(/sen\((\d+)\)/g, "sin($1)");
          b = b.replace(/(sin|cos|tan)(\d+)/g, "$1($2)");

          // π
          b = b.replace(/π/g, "pi");
          b = b.replace(/(\d)\**pi/g, "$1*pi");

          // Raíces
          b = b.replace(/√(\d+)/g, "($1^(1/2))");
          b = b.replace(/∛(\d+)/g, "($1^(1/3))");
          b = b.replace(/√\((\d+)\)/g, "($1^(1/2))");
          b = b.replace(/∛\((\d+)\)/g, "($1^(1/3))");

          // Superíndices (2³, (2)³, π²)
          b = b.replace(/(\d+|\(-?\d+\)|pi)([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, "($1)^($2)");
          b = b.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (ch) => SUPERSCRIPTS[ch]);

          return b;
        };

        const MATH_FUNCTION_NAMES = ["asin", "acos", "atan", "sin", "cos", "tan", "sen", "ln", "log10", "log", "sqrt", "exp", "abs", "floor", "ceil", "round", "factorial"];

        // Filtro rápido antes de intentar parsear: solo caracteres válidos
        // y que "se vea" como una operación (con operador, función, raíz,
        // potencia o pi) — así no reacciona a un número o palabra sueltos.
        const looksLikeMath = (text) => {
          if (!text || text.length > 200) return false;
          const t = text.trim();
          if (!/\d/.test(t)) return false;
          if (!/^[0-9a-zA-Z.,;:()[\]{}+\-*/^%×÷•π√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻\s\u2013\u2014\u2212]+$/.test(t)) return false;

          const lower = t.toLowerCase();
          const hasOperator = /[+\-*/^%×÷•]/.test(t);
          const hasFn = new RegExp(`\\b(${MATH_FUNCTION_NAMES.join("|")})(?=\\d|\\()`).test(lower);
          const hasRootOrPow = /[√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/.test(t) || /\bpi\b|π/.test(lower);
          const hasXMultiply = /\d\s*x\s*\d/i.test(t);
          return hasOperator || hasFn || hasRootOrPow || hasXMultiply;
        };

        // Una selección puede traer VARIAS operaciones a la vez (una por
        // línea, o separadas por dos o más espacios). Ya NO se corta por
        // coma/punto y coma: esos ahora son separadores decimales (3,5 = 3.5),
        // igual que en la normalización de AHK.
        const extractExpressions = (text) => {
          const parts = text
            .split(/[\r\n]+|\s{2,}/)
            .map((s) => s.trim())
            .filter(Boolean);

          const candidates = parts.length ? parts : [text.trim()];
          const exprs = candidates.filter(looksLikeMath);

          // Si nada individual "parece math" pero la selección completa sí
          // (ej: una sola operación con espacios simples, "4 + 5"), la
          // usamos entera como única expresión.
          if (!exprs.length && looksLikeMath(text)) return [text.trim()];
          return exprs;
        };

        // ---------- UI flotante ----------
        let icon = null;
        let bubble = null;

        const removeIcon = () => { icon?.remove(); icon = null; };
        const removeBubble = () => { bubble?.remove(); bubble = null; };
        const removeAll = () => { removeIcon(); removeBubble(); };

        const showIcon = (rect, expressions) => {
          removeAll();
          icon = document.createElement("div");
          icon.className = "mml-math-icon";
          icon.textContent = expressions.length > 1 ? "🧮×" + expressions.length : "🧮";
          icon.title = expressions.length > 1
            ? `Calcular ${expressions.length} operaciones`
            : "Calcular selección";
          icon.style.left = `${Math.min(rect.right + 6, window.innerWidth - 32)}px`;
          icon.style.top = `${Math.max(rect.top - 4, 4)}px`;

          icon.addEventListener("mousedown", (e) => e.preventDefault()); // no perder la selección
          icon.addEventListener("click", (e) => {
            e.stopPropagation();
            showResult(expressions);
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

        // Resuelve una sola expresión y arma su línea de resultado
        // + el valor numérico limpio (o null si no se pudo calcular).
        const solveOne = (expression) => {
          try {
            const normalized = normalizeExpression(expression);
            const result = solve(normalized);
            if (Number.isNaN(result)) throw new Error("No calculable");
            if (!Number.isFinite(result)) {
              return { line: `${expression.trim()} = no se puede calcular (¿÷0?)`, value: null };
            }
            // Limpia el ruido de punto flotante (ej: 0.1+0.2 = 0.30000000000000004)
            // redondeando a 12 cifras SIGNIFICATIVAS en vez de decimales fijos,
            // así funciona igual de bien con números chicos y grandes.
            const clean = Number.isInteger(result) ? result : parseFloat(result.toPrecision(12));
            let line = `${expression.trim()} = ${clean}`;
            if (hasPrecisionRisk(normalized, result)) line += " ⚠️";
            return { line, value: clean };
          } catch {
            return { line: `${expression.trim()} → no pude interpretar`, value: null };
          }
        };

        const showResult = (expressions) => {
          removeBubble();

          const results = expressions.map(solveOne);
          const text = results.map((r) => r.line).join("\n");
          const copyLabel = results.length > 1 ? "Click para copiar los resultados" : "Click para copiar el resultado";

          bubble = document.createElement("div");
          bubble.className = "mml-math-bubble";
          bubble.innerHTML = `${text}<small>${copyLabel}</small>`;

          const iconRect = icon?.getBoundingClientRect();
          const top = iconRect ? iconRect.bottom + 6 : 20;
          const left = iconRect ? Math.min(iconRect.left, window.innerWidth - 270) : 20;
          bubble.style.top = `${top}px`;
          bubble.style.left = `${Math.max(left, 4)}px`;

          bubble.addEventListener("mousedown", (e) => e.preventDefault());
          bubble.addEventListener("click", async (e) => {
            e.stopPropagation();
            const values = results.filter((r) => r.value !== null).map((r) => r.value);
            if (!values.length) return;
            try {
              await navigator.clipboard.writeText(values.join("\n"));
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
          const expressions = text ? extractExpressions(text) : [];

          if (!expressions.length) {
            removeAll();
            return;
          }

          try {
            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();
            const rect = rects[rects.length - 1] || range.getBoundingClientRect();
            if (!rect || (rect.width === 0 && rect.height === 0)) return;
            showIcon(rect, expressions);
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
