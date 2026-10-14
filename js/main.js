/* ==========================================================
   Do Mercado à Docência — interações
   Navegação: ← → / espaço / PageUp PageDown / Home End
              F = tela cheia · toque: deslizar
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slides = $$('.slide');
  const dotsEl = $('#dots');
  let current = -1;
  let runId = 0;          // muda a cada troca de slide; animações antigas param sozinhas
  let settleTimer;

  /* ---------------- navegação ---------------- */
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    b.title = `${i + 1}. ${s.dataset.title}`;
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', () => go(i));
    dotsEl.appendChild(b);
  });
  const dots = $$('button', dotsEl);

  // passos internos (slides com data-steps): → revela o próximo, ← volta um
  let step = 0;
  const stepCount = s => parseInt(s.dataset.steps, 10) || 0;

  function setStep(n, animate) {
    const slide = slides[current];
    step = n;
    runId++;
    $$('[data-step]', slide).forEach(el => el.classList.toggle('show', +el.dataset.step <= n));
    $$('.pips i', slide).forEach((p, idx) => p.classList.toggle('on', idx < n));
    stepHooks[slide.dataset.hook]?.(slide, runId, n, animate);
  }

  slides.forEach(s => {
    const pips = $('.pips', s);
    if (pips) pips.innerHTML = '<i></i>'.repeat(stepCount(s));
  });

  function go(i, fromAhead = false) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === current) return;
    current = i;
    step = 0;
    runId++;
    startTimer();

    slides.forEach((s, idx) => {
      s.classList.toggle('active', idx === i);
      s.classList.toggle('before', idx < i);
      s.classList.remove('settled');
    });
    dots.forEach((d, idx) => d.classList.toggle('on', idx === i));

    const slide = slides[i];
    slide.scrollTop = 0;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => slide.classList.add('settled'), 2200);

    document.documentElement.style.setProperty('--h', slide.dataset.hue || 150);
    $('#hudTitle').textContent = slide.dataset.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-');
    $('#counter').textContent = `${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    $('#progressBar').style.width = `${((i + 1) / slides.length) * 100}%`;
    history.replaceState(null, '', `#${i + 1}`);

    const hook = hooks[slide.dataset.hook];
    if (hook) hook(slide, runId);

    // voltando do slide seguinte, o slide em passos já aparece completo
    if (stepCount(slide)) setStep(fromAhead ? stepCount(slide) : 0, false);
  }

  function next() {
    if (step < stepCount(slides[current])) setStep(step + 1, true);
    else go(current + 1);
  }
  function prev() {
    if (step > 0) setStep(step - 1, false);
    else go(current - 1, true);
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home': go(0); break;
      case 'End': go(slides.length - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
    }
  });

  $('#nextBtn').addEventListener('click', next);
  $('#prevBtn').addEventListener('click', prev);
  $('#fsBtn').addEventListener('click', toggleFullscreen);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // deslizar no celular/tablet
  let touchX = null, touchY = null;
  document.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? next() : prev();
    touchX = null;
  });

  /* ---------------- cronômetro do apresentador ---------------- */
  let timerStart = null;
  function startTimer() {
    if (timerStart !== null || current === 0) return;
    timerStart = Date.now();
    setInterval(() => {
      const s = Math.floor((Date.now() - timerStart) / 1000);
      $('#timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 1000);
  }

  /* ---------------- destaque de sintaxe (simples) ---------------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const TOKENS = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(\$\w+)|\b(def|return|if|not|for|in|while|else|function|const|let|true|false|True|False|None)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)(?=\()/g;
  function highlight(src) {
    let out = '', last = 0, m;
    TOKENS.lastIndex = 0;
    while ((m = TOKENS.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'v' : m[4] ? 'k' : m[5] ? 'n' : 'f';
      out += `<span class="t-${cls}">${esc(m[0])}</span>`;
      last = TOKENS.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  async function typeCode(el, code, id, speed = 22) {
    for (let i = 0; i <= code.length; i++) {
      if (id !== runId) return false;
      el.innerHTML = highlight(code.slice(0, i)) + '<span class="caret"></span>';
      if (!reduceMotion) await sleep(code[i - 1] === '\n' ? speed * 6 : speed + Math.random() * speed);
    }
    return true;
  }

  async function typeText(el, text, id, speed = 32) {
    for (let i = 0; i <= text.length; i++) {
      if (id !== runId) return false;
      el.textContent = text.slice(0, i);
      if (!reduceMotion) await sleep(speed + Math.random() * speed * .6);
    }
    return true;
  }

  /* ---------------- ganchos por slide ---------------- */
  const hooks = {
    async cover(slide, id) {
      const el = $('#coverTerm');
      const lines = [
        ['cmd', 'whoami'],
        ['out', 'cristian — dev, redes & professor'],
        ['cmd', 'cat roteiro.txt'],
        ['out', 'mercado ➜ código ➜ redes ➜ sala de aula ➜ IA'],
        ['cmd', './iniciar --turma=informatica'],
      ];
      el.innerHTML = '';
      await sleep(1000);
      for (const [type, text] of lines) {
        if (id !== runId) return;
        const row = document.createElement('div');
        el.appendChild(row);
        if (type === 'cmd') {
          row.innerHTML = '<span class="p">$ </span><span></span>';
          if (!await typeText(row.lastChild, text, id, 45)) return;
          await sleep(350);
        } else {
          row.className = 'out';
          row.textContent = text;
          await sleep(500);
        }
      }
      el.lastChild.insertAdjacentHTML('beforeend', '<span class="caret"></span>');
    },

    async code(slide, id) {
      const el = $('#codeTyping');
      const out = $('#codeOutput');
      out.classList.remove('show');
      el.innerHTML = '';
      await sleep(900);
      const code =
`def media_turma(notas):
    if not notas:
        return 0
    return sum(notas) / len(notas)

turma = [8.5, 7.0, 9.5, 6.0]
print(f"Média: {media_turma(turma):.1f}")`;
      if (await typeCode(el, code, id, 24)) {
        await sleep(500);
        if (id === runId) out.classList.add('show');
      }
    },

    counters(slide, id) {
      $$('[data-count]', slide).forEach(el => {
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        if (Number.isNaN(target)) { el.textContent = el.dataset.count; return; }
        el.textContent = '0';
        const delay = 700, dur = 1600;
        const t0 = performance.now() + delay;
        const tick = now => {
          if (id !== runId) return;
          const p = Math.min(1, Math.max(0, (now - t0) / dur));
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + (p === 1 ? suffix : '');
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },

    scramble(slide, id) {
      $$('[data-scramble]', slide).forEach(el => scramble(el, el.dataset.scramble, id));
    },

    matrix(slide, id) { matrix(slide, id); },
  };

  /* ---------------- demo: IA gera código vulnerável (em passos) ----------------
     passo 0: só o título · 1: a pergunta · 2: a IA responde
     passo 3: linha vulnerável + SQL Injection · 4: senha em texto puro · 5: revisão humana */
  const AI_PROMPT = 'Cria uma função de login em PHP pra mim?';
  const AI_CODE =
`function login($conn, $user, $senha) {
  $sql = "SELECT * FROM usuarios WHERE user = '$user' AND senha = '$senha'";
  $res = $conn->query($sql);
  return $res->num_rows > 0;
}`;

  const renderAiCode = markBad => highlight(AI_CODE).split('\n')
    .map((l, i) => `<span class="ln${markBad && i === 1 ? ' bad' : ''}">${l || ' '}</span>`).join('');

  const stepHooks = {
    async chat(slide, id, n, animate) {
      const prompt = $('#chatPrompt'), typing = $('#chatTyping'),
            aiBubble = $('#aiBubble'), aiCode = $('#aiCode');

      typing.classList.add('gone');

      // passo 1: a pergunta
      if (n >= 1 && animate && n === 1) {
        prompt.textContent = '';
        await sleep(300);
        typeText(prompt, AI_PROMPT, id, 38);
      } else {
        prompt.textContent = n >= 1 ? AI_PROMPT : '';
      }

      // passo 2: a IA "pensa" e digita o código
      if (n < 2) {
        aiBubble.classList.add('hidden');
        aiCode.innerHTML = '';
      } else if (animate && n === 2) {
        aiBubble.classList.add('hidden');
        aiCode.innerHTML = '';
        typing.classList.remove('gone');
        await sleep(1400);
        if (id !== runId) return;
        typing.classList.add('gone');
        aiBubble.classList.remove('hidden');
        if (await typeCode(aiCode, AI_CODE, id, 14)) aiCode.innerHTML = renderAiCode(false);
      } else {
        aiBubble.classList.remove('hidden');
        aiCode.innerHTML = renderAiCode(n >= 3);   // passo 3+: destaca a linha vulnerável
      }
      // passos 3, 4 e 5 (alertas, frase final e correção) são revelados via data-step
    },
  };

  $('#replayChat').addEventListener('click', e => { e.currentTarget.blur(); setStep(0, false); });

  /* ---------------- texto embaralhado ---------------- */
  function scramble(el, finalText, id) {
    const chars = '!<>-_\\/[]{}—=+*^?#01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const queue = [...finalText].map((ch, i) => ({
      ch, start: Math.floor(Math.random() * 20) + 10, end: Math.floor(Math.random() * 30) + 30 + i * 2,
    }));
    let frame = 0;
    const tick = () => {
      if (id !== runId) { el.textContent = finalText; return; }
      let done = 0, out = '';
      for (const q of queue) {
        if (frame >= q.end || q.ch === ' ') { done++; out += q.ch; }
        else if (frame >= q.start) out += chars[Math.floor(Math.random() * chars.length)];
        else out += q.ch === ' ' ? ' ' : '·';
      }
      el.textContent = out;
      frame++;
      if (done < queue.length) requestAnimationFrame(tick);
    };
    if (reduceMotion) el.textContent = finalText; else tick();
  }

  /* ---------------- chuva de código (slide final) ---------------- */
  function matrix(slide, id) {
    const c = $('.matrix', slide);
    const ctx = c.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = 16 * dpr;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const cols = Math.ceil(c.width / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const glyphs = '01<>{}[]/=+*;$#IFFarアイウエオカキクケコ'.split('');
    const hue = slide.dataset.hue || 150;
    let last = 0;
    const draw = now => {
      if (id !== runId) return;
      requestAnimationFrame(draw);
      if (now - last < 50) return;
      last = now;
      ctx.fillStyle = 'rgba(5, 8, 13, .12)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `${size}px JetBrains Mono, monospace`;
      drops.forEach((y, i) => {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillStyle = Math.random() > .96 ? '#fff' : `hsl(${hue} 85% 58%)`;
        ctx.fillText(ch, i * size, y * size);
        drops[i] = y * size > c.height && Math.random() > .975 ? 0 : y + 1;
      });
    };
    ctx.clearRect(0, 0, c.width, c.height);
    if (!reduceMotion) requestAnimationFrame(draw);
  }

  /* ---------------- cartas mito/verdade ---------------- */
  $$('.flip').forEach(card => card.addEventListener('click', () => card.classList.toggle('flipped')));

  /* ---------------- brilho que segue o mouse ---------------- */
  document.addEventListener('pointermove', e => {
    document.body.style.setProperty('--mx', `${e.clientX}px`);
    document.body.style.setProperty('--my', `${e.clientY}px`);
    const card = e.target.closest?.('.card');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--cx', `${e.clientX - r.left}px`);
      card.style.setProperty('--cy', `${e.clientY - r.top}px`);
    }
  });

  /* ---------------- fundo: rede de nós trocando pacotes ---------------- */
  (function network() {
    const c = $('#bg');
    const ctx = c.getContext('2d');
    let w, h, dpr, nodes = [], packets = [];
    const mouse = { x: -1e4, y: -1e4 };
    let hue = 150;

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.width = innerWidth * dpr;
      h = c.height = innerHeight * dpr;
      c.style.width = innerWidth + 'px';
      c.style.height = innerHeight + 'px';
      const n = Math.round(Math.min(120, (innerWidth * innerHeight) / 13000));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .3 * dpr, vy: (Math.random() - .5) * .3 * dpr,
        r: (Math.random() * 1.5 + .7) * dpr,
      }));
      packets = [];
    }

    function neighbor(a, link) {
      const near = nodes.filter(n => n !== a && Math.hypot(n.x - a.x, n.y - a.y) < link);
      return near.length ? near[Math.floor(Math.random() * near.length)] : null;
    }

    function frame() {
      // a matiz acompanha a do slide atual suavemente
      const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h')) || 150;
      hue += (target - hue) * .05;

      ctx.clearRect(0, 0, w, h);
      const link = 150 * dpr;

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 160 * dpr && d > 0) { n.x += (dx / d) * .8 * dpr; n.y += (dy / d) * .8 * dpr; }
      }

      ctx.lineWidth = .7 * dpr;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) {
            ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${(1 - d / link) * .28})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      ctx.fillStyle = `hsla(${hue}, 80%, 70%, .7)`;
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill(); }

      // pacotes: saltam de nó em nó, como numa rota
      if (packets.length < 14 && Math.random() < .08) {
        const a = nodes[Math.floor(Math.random() * nodes.length)];
        const b = a && neighbor(a, link);
        if (b) packets.push({ a, b, t: 0, sp: .015 + Math.random() * .02, hops: 2 + Math.floor(Math.random() * 4) });
      }
      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k];
        p.t += p.sp;
        if (p.t >= 1) {
          const nb = p.hops > 0 && neighbor(p.b, link);
          if (nb) { p.a = p.b; p.b = nb; p.t = 0; p.hops--; }
          else { packets.splice(k, 1); continue; }
        }
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        ctx.fillStyle = `hsla(${hue}, 95%, 65%, .18)`;
        ctx.beginPath(); ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, .95)`;
        ctx.beginPath(); ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2); ctx.fill();
      }

      requestAnimationFrame(frame);
    }

    addEventListener('resize', resize);
    addEventListener('pointermove', e => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
    addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    resize();
    if (!reduceMotion) requestAnimationFrame(frame);
  })();

  /* ---------------- início ---------------- */
  const fromHash = parseInt(location.hash.slice(1), 10);
  go(Number.isInteger(fromHash) ? fromHash - 1 : 0);
})();
