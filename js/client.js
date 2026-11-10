// 학생 화면 — 1인칭, 조작, 공포 연출
window.Client = (function () {
  let cv, ctx, W, H;
  let me = null, team = -1, settings = null, names = {};
  let S = null;
  let others = new Map();
  let mon = { x: -99, y: -99, tx: -99, ty: -99, state: "sleep", a: 0, speed: 0 };
  let pos = { x: 2.5, y: 11.5, a: 0 };
  let input = { fwd: 0, strafe: 0 };
  let keys = {};
  let down = false, hidden = null, hidePrev = null, escaped = false, phase = "play", revProgress = 0;
  let modal = null;
  let toast = { text: "", t: 0 };
  let fx = { shake: 0, static: 0, flicker: 1, jump: 0, jumpT0: 0, fade: 0, spotted: 0 };
  let holdRev = false, lastRev = 0, lastPos = 0;
  let running = false, raf = 0, last = 0, moving = false;
  let fuses = MapUtil.fuses(), breakerPos = MapUtil.find("B")[0];
  let onEnd = null, grain = null, wrongFlashT = 0, bobT = 0;
  const colors = ["#7ec8ff", "#ffd27e", "#9dff8a", "#ff9ad5", "#c9a6ff", "#ffb48a"];
  const el = id => document.getElementById(id);

  function start(opts) {
    me = opts.id; team = opts.team; settings = opts.settings; names = opts.names || {}; onEnd = opts.onEnd;
    cv = el("game-canvas"); ctx = cv.getContext("2d");
    Assets.init();
    resize(); window.addEventListener("resize", resize);
    const sp = MapUtil.find("S")[opts.spawnIndex % 6 || 0];
    pos = { x: sp.x + 0.5, y: sp.y + 0.5, a: 0 };
    down = false; hidden = null; escaped = false; phase = "play"; modal = null; others.clear();
    setupInput(); makeGrain();
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
    Horror.init(); Horror.resume();
    showToast("정전이다. 발전기 부품을 모아 출구를 열어라. 그것과 마주치지 마라.", 5);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; Fps.setup(W, H); }
  function makeGrain() {
    grain = document.createElement("canvas"); grain.width = grain.height = 128;
    const g = grain.getContext("2d"); const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 30; }
    g.putImageData(img, 0, 0);
  }

  // ---------- 입력: 왼쪽 스틱 이동, 오른쪽 드래그 회전 ----------
  function setupInput() {
    window.onkeydown = e => { keys[e.key.toLowerCase()] = true; if (e.key === " " || e.key.toLowerCase() === "e") { e.preventDefault(); interactPress(); } if (e.key === "Escape" && modal) cancelModal(); };
    window.onkeyup = e => { keys[e.key.toLowerCase()] = false; if (e.key === " " || e.key.toLowerCase() === "e") interactRelease(); };
    const stick = el("stick"), knob = el("stick-knob"), zone = el("touch-zone");
    let sid = null, sx = 0, sy = 0, tid = null, tx = 0;
    zone.addEventListener("touchstart", e => {
      for (const t of e.changedTouches) {
        if (sid === null && t.clientX < W * 0.45) { sid = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.display = "block"; stick.style.left = (sx - 60) + "px"; stick.style.top = (sy - 60) + "px"; }
        else if (tid === null) { tid = t.identifier; tx = t.clientX; }
      }
    }, { passive: true });
    zone.addEventListener("touchmove", e => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) {
          let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy); const m = Math.min(d, 50);
          if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          input.fwd = d > 8 ? -dy / 50 : 0; input.strafe = d > 8 ? dx / 50 : 0;
        } else if (t.identifier === tid) { const dx = t.clientX - tx; tx = t.clientX; pos.a += dx * 0.0075; }
      }
    }, { passive: true });
    const endT = e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; input.fwd = input.strafe = 0; stick.style.display = "none"; knob.style.transform = ""; } if (t.identifier === tid) tid = null; } };
    zone.addEventListener("touchend", endT); zone.addEventListener("touchcancel", endT);
    let md = false, mx = 0;
    zone.addEventListener("mousedown", e => { md = true; mx = e.clientX; });
    window.addEventListener("mousemove", e => { if (md) { pos.a += (e.clientX - mx) * 0.005; mx = e.clientX; } });
    window.addEventListener("mouseup", () => md = false);
    const btn = el("btn-act");
    btn.onpointerdown = e => { e.preventDefault(); interactPress(); };
    btn.onpointerup = btn.onpointerleave = btn.onpointercancel = () => interactRelease();
  }

  function nearest() {
    if (hidden) return { kind: "unhide" };
    for (const [id, o] of others) if (o.down && !o.esc && Math.hypot(o.x - pos.x, o.y - pos.y) < 1.5) return { kind: "rev", id, name: names[id] || "팀원" };
    const fx0 = pos.x + Math.cos(pos.a) * 0.6, fy0 = pos.y + Math.sin(pos.a) * 0.6;
    for (const f of fuses) if (!(S && (S.f >> f.id) & 1) && Math.hypot(f.x + 0.5 - fx0, f.y + 0.5 - fy0) < 1.25) return { kind: "fuse", fuse: f };
    if (Math.hypot(breakerPos.x + 0.5 - fx0, breakerPos.y + 0.5 - fy0) < 1.25 && !(S && S.e)) return { kind: "breaker" };
    const tx = Math.floor(pos.x), ty = Math.floor(pos.y);
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (MapUtil.tile(x, y) === "L" && Math.hypot(x + 0.5 - fx0, y + 0.5 - fy0) < 1.25) return { kind: "hide", x, y };
    return null;
  }
  function interactPress() {
    if (!running || down || escaped || modal || phase !== "play") return;
    const n = nearest(); if (!n) return;
    if (n.kind === "fuse") Net.sendToHost({ t: "q", fuse: n.fuse.id });
    else if (n.kind === "breaker") Net.sendToHost({ t: "q", fuse: -1 });
    else if (n.kind === "hide") { hidePrev = { x: pos.x, y: pos.y, a: pos.a }; hidden = { x: n.x, y: n.y }; Net.sendToHost({ t: "hide", x: n.x, y: n.y }); Horror.breath(); showToast("사물함 안. 숨을 죽여라.", 2); }
    else if (n.kind === "unhide") { hidden = null; if (hidePrev) { pos.x = hidePrev.x; pos.y = hidePrev.y; pos.a = hidePrev.a; } Net.sendToHost({ t: "unhide" }); }
    else if (n.kind === "rev") holdRev = n.id;
  }
  function interactRelease() { holdRev = false; }

  // ---------- 수신 ----------
  function onMessage(d) {
    if (!running) return;
    if (d.t === "st") {
      if (d.team !== team) return;
      S = d;
      mon.tx = d.m[0]; mon.ty = d.m[1]; mon.state = d.m[2]; mon.a = d.m[3]; mon.speed = d.m[4];
      if (mon.x < -50) { mon.x = mon.tx; mon.y = mon.ty; }
      phase = d.ph;
      const seen = new Set();
      for (const p of d.p) {
        const [id, x, y, a, dn, hid, esc, rev] = p;
        if (id === me) { down = !!dn; escaped = !!esc; revProgress = rev; continue; }
        seen.add(id);
        let o = others.get(id); if (!o) { o = { x, y, a }; others.set(id, o); }
        o.tx = x; o.ty = y; o.a = a; o.down = !!dn; o.hid = !!hid; o.esc = !!esc; o.rev = rev; o.name = names[id] || "";
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
    } else if (d.t === "ev") { if (d.team !== team) return; handleEvent(d); }
  }
  function handleEvent(e) {
    switch (e.k) {
      case "q": if (e.id === me) openModal(e); break;
      case "fuse":
        if (e.ok) { Horror.right(); if (e.id === me && modal) modalResult(true); else showToast(`${e.by}: ${e.fuse === -1 ? "발전기 가동" : "부품 확보"}`, 2.5); }
        else { Horror.wrong(); fx.static = 1; wrongFlashT = 1.2; if (e.id === me && modal) modalResult(false); else showToast(`${e.by} 오답 — 경보가 울렸다. 그것이 소리를 들었다.`, 3); }
        break;
      case "locked": if (e.id === me) showToast(`발전기 부품이 모자란다. ${e.need}개 더 찾아야 한다.`, 3); break;
      case "cool": if (e.id === me) showToast(`잠겨 있다. ${e.left}초 뒤 다시.`, 2); break;
      case "wake": Horror.bang(); fx.shake = 1; showToast("…건물 어딘가에서 무언가가 깨어났다.", 4); Horror.vibrate([80, 60, 200]); break;
      case "hunt": Horror.scrape(); break;
      case "spotted": if (e.id === me) { fx.spotted = 1; Horror.scrape(); Horror.vibrate([60, 40, 60, 40, 200]); showToast("들켰다. 뛰어.", 2); } break;
      case "caught": if (e.id === me) jumpScare(); else { Horror.bang(); showToast(`${e.name}이(가) 쓰러졌다. 찾아가서 구해야 한다.`, 4); fx.shake = 0.6; } break;
      case "revived": if (e.id === me) { down = false; fx.fade = 1; showToast(e.self ? "정신이 돌아왔다." : "팀원이 깨워 줬다.", 3); } else showToast(`${names[e.id] || "팀원"}이(가) 일어났다.`, 2); break;
      case "exit": Horror.right(); showToast("발전기 가동! 출구가 열렸다. 건물 오른쪽 아래 출구로.", 5); break;
      case "escaped": if (e.id === me) { escaped = true; Horror.lightsOn(); } else showToast(`${e.name} 탈출 성공`, 2.5); break;
      case "end": phase = "end"; if (onEnd) onEnd(e); break;
    }
  }

  // ---------- 문제 ----------
  function openModal(e) {
    const item = QUESTION_BANK[e.unit].items[e.qi];
    modal = { fuse: e.fuse, unit: e.unit, qi: e.qi, item, t0: performance.now(), answered: false, result: null };
    el("modal").style.display = "flex";
    el("modal-title").textContent = (e.fuse === -1 ? "비상 발전기 · " : "부품 상자 · ") + QUESTION_BANK[e.unit].name;
    el("modal-q").textContent = item.q;
    const box = el("modal-choices"); box.innerHTML = "";
    item.c.forEach((c, i) => { const b = document.createElement("button"); b.textContent = c; b.onclick = () => answer(i); box.appendChild(b); });
    el("modal-exp").textContent = ""; el("modal-cancel").style.display = "";
  }
  function answer(i) {
    if (!modal || modal.answered) return;
    modal.answered = true; modal.chosen = i;
    [...el("modal-choices").children].forEach((b, j) => { b.disabled = true; if (j === i) b.classList.add("picked"); });
    Net.sendToHost({ t: "ans", fuse: modal.fuse, chosen: i });
    el("modal-cancel").style.display = "none";
  }
  function modalResult(ok) {
    if (!modal) return;
    [...el("modal-choices").children].forEach((b, j) => { if (j === modal.item.a) b.classList.add("correct"); else if (j === modal.chosen) b.classList.add("wrong"); });
    el("modal-exp").textContent = (ok ? "부품 확보. " : "오답 — 경보! 그것이 이쪽으로 온다. 상자는 15초 잠김. ") + modal.item.e;
    setTimeout(closeModal, ok ? 1500 : 2300);
  }
  function cancelModal() { if (!modal || modal.answered) return; Net.sendToHost({ t: "cancelq", fuse: modal.fuse }); closeModal(); }
  function closeModal() { modal = null; el("modal").style.display = "none"; }
  function showToast(text, sec) { toast = { text, t: sec }; }
  function jumpScare() { Horror.screech(); Horror.vibrate([400, 80, 600]); fx.jump = 1; fx.jumpT0 = performance.now(); fx.shake = 1.5; closeModal(); }

  // ---------- 루프 ----------
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt, now); render(now);
    raf = requestAnimationFrame(frame);
  }
  function update(dt, now) {
    let fwd = input.fwd, strafe = input.strafe, turn = 0;
    if (keys["w"] || keys["arrowup"]) fwd += 1; if (keys["s"] || keys["arrowdown"]) fwd -= 1;
    if (keys["a"]) strafe -= 1; if (keys["d"]) strafe += 1;
    if (keys["arrowleft"] || keys["q"]) turn -= 1; if (keys["arrowright"]) turn += 1;
    const canMove = !down && !escaped && !hidden && !modal && phase === "play";
    moving = false;
    if (canMove) {
      pos.a += turn * 2.4 * dt;
      const len = Math.hypot(fwd, strafe);
      if (len > 0.05) {
        const k = Math.min(1, len); const sp = Sim.PLAYER_SPEED;
        const dx = (Math.cos(pos.a) * fwd + Math.cos(pos.a + Math.PI / 2) * strafe) / len * k;
        const dy = (Math.sin(pos.a) * fwd + Math.sin(pos.a + Math.PI / 2) * strafe) / len * k;
        const np = MapUtil.move(pos.x, pos.y, dx * sp * dt, dy * sp * dt, 0.28, S && S.e);
        pos.x = np.x; pos.y = np.y; moving = true; bobT += dt * 9;
      }
    }
    if (hidden) { pos.x = hidden.x + 0.5; pos.y = hidden.y + 0.5; }
    for (const o of others.values()) { o.x += (o.tx - o.x) * Math.min(1, dt * 10); o.y += (o.ty - o.y) * Math.min(1, dt * 10); }
    mon.x += (mon.tx - mon.x) * Math.min(1, dt * 8); mon.y += (mon.ty - mon.y) * Math.min(1, dt * 8);
    if (now - lastPos > 100 && !down && !escaped) { lastPos = now; Net.sendToHost({ t: "pos", x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), a: +pos.a.toFixed(2) }); }
    if (holdRev && now - lastRev > 100) { lastRev = now; Net.sendToHost({ t: "rev", target: holdRev }); }
    if (holdRev) { const o = others.get(holdRev); if (!o || !o.down || Math.hypot(o.x - pos.x, o.y - pos.y) > 1.7) holdRev = false; }
    if (modal && !modal.answered && now - modal.t0 > 20000) answer(-1);
    const md = Math.hypot(mon.x - pos.x, mon.y - pos.y);
    const sees = MapUtil.los(mon.x, mon.y, pos.x, pos.y);
    const relX = Math.cos(pos.a + Math.PI / 2) * (mon.x - pos.x) + Math.sin(pos.a + Math.PI / 2) * (mon.y - pos.y);
    Horror.update(mon.state === "sleep" ? 99 : md, relX, mon.state === "sleep" ? 0 : mon.speed, sees);
    fx.shake *= Math.pow(0.02, dt); fx.static *= Math.pow(0.05, dt); fx.spotted *= Math.pow(0.1, dt); fx.fade *= Math.pow(0.1, dt);
    wrongFlashT -= dt; if (toast.t > 0) toast.t -= dt;
    const near = mon.state !== "sleep" ? Math.max(0, 1 - md / 7) : 0;
    if (Math.random() < near * 0.25) fx.flicker = 0.1 + Math.random() * 0.5; else fx.flicker += (1 - fx.flicker) * Math.min(1, dt * 14);
    if (mon.state === "chase" && md < 6) fx.shake = Math.max(fx.shake, 0.3);
    if (fx.jump && now - fx.jumpT0 > 1500) fx.jump = 0;
    updateHud();
  }
  function updateHud() {
    const n = nearest(); const b = el("btn-act");
    const label = !n ? "" : n.kind === "fuse" ? "상자 열기" : n.kind === "breaker" ? "발전기" : n.kind === "hide" ? "숨기" : n.kind === "unhide" ? "나오기" : "구조 (꾹)";
    b.textContent = label; b.classList.toggle("on", !!n && !down && !escaped && !modal && phase === "play");
    if (S) {
      const fixed = countBits(S.f);
      const room = MapUtil.roomAt(pos.x, pos.y);
      el("hud-fuse").textContent = `부품 ${fixed}/${S.req}` + (S.e ? " · 출구 열림" : "") + (room ? ` · ${room.name}` : "");
      el("hud-time").textContent = fmt(S.tm);
      const md = Math.hypot(mon.x - pos.x, mon.y - pos.y);
      el("hud-noise").style.width = (mon.state === "sleep" ? 0 : Math.max(0, 100 - md * 8)) + "%";
      el("hud-safe").textContent = S.safe > 0 ? `아직 조용하다 … ${S.safe}` : "";
      el("hud-team").innerHTML = S.p.map((p, i) => `<span class="${p[4] ? 'dn' : ''} ${p[6] ? 'esc' : ''}" style="color:${colors[i % colors.length]}">${p[6] ? "✓" : p[4] ? "✕" : "●"} ${names[p[0]] || "?"}</span>`).join(" ");
    }
    el("toast").textContent = toast.t > 0 ? toast.text : "";
    el("toast").style.opacity = toast.t > 0 ? Math.min(1, toast.t) : 0;
  }
  const countBits = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ---------- 렌더 ----------
  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (escaped) { renderEscaped(); return; }
    const sh = fx.shake * 10;
    ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    const view = hidden ? { x: hidden.x + 0.5, y: hidden.y + 0.5, a: hidePrev ? hidePrev.a + Math.PI : pos.a } : pos;
    Fps.render(ctx, W, H, {
      pos: view, fuses, fmask: S ? S.f : 0, exitOpen: !!(S && S.e), flicker: hidden ? 0.25 : (down ? 0.3 : fx.flicker),
      monster: mon, others: [...others.values()], now, downed: down, moving, pitch: Math.sin(bobT) * (moving ? 4 : 0),
    });
    ctx.restore();
    if (hidden) drawLockerSlit(ctx);
    if (down) drawDowned(ctx, now);
    postFx(ctx, now);
    if (fx.jump) drawJumpScare(ctx, now);
  }
  function drawLockerSlit(c) {
    const snap = document.createElement("canvas"); snap.width = W; snap.height = H; snap.getContext("2d").drawImage(cv, 0, 0);
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    for (const s of [-0.08, 0, 0.08]) { c.save(); c.beginPath(); c.rect(W * (0.5 + s) - W * 0.012, H * 0.18, W * 0.024, H * 0.6); c.clip(); c.drawImage(snap, 0, 0); c.restore(); }
    c.fillStyle = "rgba(255,255,255,0.45)"; c.font = `${Math.min(W, H) * 0.035}px sans-serif`; c.textAlign = "center";
    c.fillText("숨어 있다. 발소리를 들어라. 버튼을 누르면 나간다.", W / 2, H * 0.9);
  }
  function drawDowned(c, now) {
    c.fillStyle = `rgba(0,0,0,${0.6 + 0.25 * Math.sin(now / 900)})`; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.75)"; c.font = `bold ${Math.min(W, H) * 0.05}px sans-serif`; c.textAlign = "center";
    c.fillText("쓰러졌다", W / 2, H * 0.4);
    c.font = `${Math.min(W, H) * 0.032}px sans-serif`; c.fillText("팀원이 와서 깨워 줄 때까지 기다린다", W / 2, H * 0.47);
    if (revProgress > 0) { c.fillStyle = "#222"; c.fillRect(W * 0.3, H * 0.55, W * 0.4, 10); c.fillStyle = "#9bff7a"; c.fillRect(W * 0.3, H * 0.55, W * 0.4 * Math.min(1, revProgress / 3), 10); }
  }
  function renderEscaped() {
    ctx.fillStyle = "#e8e4d8"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#222"; ctx.font = `bold ${Math.min(W, H) * 0.07}px sans-serif`; ctx.textAlign = "center";
    ctx.fillText("탈출했다", W / 2, H * 0.42);
    ctx.font = `${Math.min(W, H) * 0.035}px sans-serif`; ctx.fillText("불이 켜졌다. 아직 안에 있는 팀원을 기다리는 중…", W / 2, H * 0.5);
    if (S) { const left = S.p.filter(p => !p[6]).map(p => names[p[0]] || "?"); ctx.fillText(left.length ? "남은 사람: " + left.join(", ") : "", W / 2, H * 0.58); }
  }
  function postFx(c, now) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.8)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.45 + fx.static * 0.55; c.translate(Math.random() * 128, Math.random() * 128);
    c.fillStyle = c.createPattern(grain, "repeat"); c.fillRect(-128, -128, W + 128, H + 128); c.restore();
    if (wrongFlashT > 0 && Math.random() < 0.5) { c.fillStyle = `rgba(255,255,255,${0.08 * wrongFlashT})`; for (let i = 0; i < 6; i++) c.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6); }
    if (fx.spotted > 0.02) { c.fillStyle = `rgba(120,0,0,${fx.spotted * 0.35})`; c.fillRect(0, 0, W, H); }
    if (fx.fade > 0.02) { c.fillStyle = `rgba(0,0,0,${fx.fade})`; c.fillRect(0, 0, W, H); }
    const md = Math.hypot(mon.x - pos.x, mon.y - pos.y);
    if (mon.state !== "sleep" && md < 5 && !down) { c.fillStyle = `rgba(60,0,0,${(1 - md / 5) * 0.25 * (0.5 + 0.5 * Math.sin(now / 120))})`; c.fillRect(0, 0, W, H); }
  }
  function jag(c, cx, cy, rx, ry, n, rough, rot) {
    c.beginPath();
    for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; const r = 1 + (Math.random() - 0.5) * rough; const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath();
  }
  function drawJumpScare(c, now) {
    const t = (now - fx.jumpT0) / 1000;
    for (const id of ["hud", "toast", "btn-act"]) el(id).style.visibility = t < 1.5 ? "hidden" : "";
    if (settings && settings.scare < 2) { c.fillStyle = `rgba(0,0,0,${Math.min(1, t * 3)})`; c.fillRect(0, 0, W, H); return; }
    if (t < 0.07) { c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); return; }
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    const sc = 1.25 + t * 1.3;
    const cx = W / 2 + (Math.random() - 0.5) * 40 + Math.sin(t * 40) * 10, cy = H / 2 + (Math.random() - 0.5) * 40;
    if (Assets.spr.scare) { const im = Assets.spr.scare; const h = Math.min(W, H) * 0.9 * sc, w = h * im.width / im.height; c.drawImage(im, cx - w / 2 + (Math.random() - 0.5) * 20, cy - h / 2, w, h); }
    else {
      const base = Math.min(W, H) * 0.3 * sc;
      c.save(); c.translate(cx, cy);
      for (const [col, off] of [["rgba(200,0,0,0.55)", -7], ["rgba(0,180,200,0.45)", 7]]) { c.save(); c.translate(off, 0); c.fillStyle = col; jag(c, 0, 0, base * 0.6, base, 40, 0.07, 0); c.fill(); c.restore(); }
      const g = c.createRadialGradient(-base * 0.1, -base * 0.2, base * 0.1, 0, 0, base);
      g.addColorStop(0, "#e9e2d6"); g.addColorStop(0.6, "#bdb3a5"); g.addColorStop(1, "#5a5048");
      c.fillStyle = g; jag(c, 0, 0, base * 0.6, base, 40, 0.07, 0); c.fill();
      c.save(); c.clip(); c.globalAlpha = 0.9; c.fillStyle = c.createPattern(grain, "repeat"); c.fillRect(-base, -base * 1.2, base * 2, base * 2.4);
      c.strokeStyle = "rgba(70,0,0,0.75)"; c.lineWidth = 1.5;
      for (let i = 0; i < 18; i++) { c.beginPath(); let x = (Math.random() - 0.5) * base, y = (Math.random() - 0.5) * base * 1.6; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * base * 0.3; y += (Math.random() - 0.5) * base * 0.3; c.lineTo(x, y); } c.stroke(); }
      c.restore();
      c.fillStyle = "#050305";
      jag(c, -base * 0.26, -base * 0.3, base * 0.15, base * 0.2, 14, 0.35, 0.3); c.fill();
      jag(c, base * 0.22, -base * 0.22, base * 0.19, base * 0.27, 14, 0.4, -0.2); c.fill();
      c.fillStyle = "rgba(220,220,230,0.9)";
      c.beginPath(); c.arc(-base * 0.22 + Math.random() * 4, -base * 0.34, base * 0.025, 0, 7); c.fill();
      c.beginPath(); c.arc(base * 0.28 + Math.random() * 4, -base * 0.3, base * 0.03, 0, 7); c.fill();
      c.fillStyle = "#070304"; jag(c, base * 0.02, base * 0.5, base * 0.24, base * 0.45 + Math.random() * 10, 20, 0.3, 0); c.fill();
      c.fillStyle = "#b8ad9c"; for (let i = 0; i < 11; i++) { const x = -base * 0.2 + i * base * 0.04; c.fillRect(x, base * 0.1, base * 0.028, base * (0.08 + Math.random() * 0.1)); }
      c.fillStyle = "rgba(40,0,0,0.9)"; for (let i = 0; i < 5; i++) { const x = (Math.random() - 0.5) * base * 0.6; c.fillRect(x, base * 0.6, base * 0.03, base * (0.3 + Math.random() * 0.3)); }
      c.restore();
    }
    c.fillStyle = "#000"; for (let i = 0; i < 16; i++) c.fillRect(0, Math.random() * H, W, Math.random() * 12);
    if (Math.random() < 0.4) { const y = Math.random() * H, h = 20 + Math.random() * 60; const img = c.getImageData(0, y, W, h); c.putImageData(img, (Math.random() - 0.5) * 60, y); }
    c.fillStyle = `rgba(0,0,0,${Math.max(0, (t - 0.9) / 0.6)})`; c.fillRect(0, 0, W, H);
  }

  return { start, stop, onMessage, cancelModal, get me() { return me; }, _dbg: { pos: () => pos, set: (x, y, a) => { pos.x = x; pos.y = y; if (a !== undefined) pos.a = a; }, mon: () => mon, S: () => S, down: () => down, modal: () => modal, hidden: () => hidden } };
})();
