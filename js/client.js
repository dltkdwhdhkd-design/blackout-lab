// 학생 화면 — 렌더링, 조작, 공포 연출
window.Client = (function () {
  const T_VIEW_W = 11, T_VIEW_H = 8;
  let cv, ctx, W, H, T;
  let dark, dctx, world, wctx; // 오프스크린
  let me = null, team = -1, settings = null, names = {};
  let S = null; // 마지막 스냅샷
  let others = new Map(); // id -> {x,y,a,tx,ty,down,hid,esc}
  let mon = { x: -99, y: -99, tx: -99, ty: -99, state: "sleep", a: 0, speed: 0 };
  let pos = { x: 2.5, y: 11.5, a: 0 };
  let input = { dx: 0, dy: 0, active: false };
  let keys = {};
  let down = false, hidden = null, escaped = false, phase = "play", revProgress = 0;
  let modal = null; // {fuse, unit, qi, t0, answered, result}
  let toast = { text: "", t: 0 };
  let fx = { shake: 0, flash: 0, static: 0, flicker: 1, jump: 0, jumpT0: 0, fade: 0, spotted: 0 };
  let holdRev = false, lastRev = 0, lastPos = 0, lastMsgTime = 0;
  let running = false, raf = 0, last = 0;
  let fuses = MapUtil.fuses(), breakerPos = MapUtil.find("B")[0];
  let onEnd = null;
  let grain = null;
  let wrongFlashT = 0;
  const colors = ["#7ec8ff", "#ffd27e", "#9dff8a", "#ff9ad5", "#c9a6ff", "#ffb48a"];

  function el(id) { return document.getElementById(id); }

  function start(opts) {
    me = opts.id; team = opts.team; settings = opts.settings; names = opts.names || {};
    onEnd = opts.onEnd;
    cv = el("game-canvas"); ctx = cv.getContext("2d");
    dark = document.createElement("canvas"); dctx = dark.getContext("2d");
    world = document.createElement("canvas"); wctx = world.getContext("2d");
    resize(); window.addEventListener("resize", resize);
    const sp = MapUtil.find("S")[opts.spawnIndex % 6 || 0];
    pos = { x: sp.x + 0.5, y: sp.y + 0.5, a: 0 };
    down = false; hidden = null; escaped = false; phase = "play"; modal = null; others.clear();
    setupInput();
    makeGrain();
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
    Horror.init(); Horror.resume();
    showToast("정전이다. 발전기 부품을 모아 출구를 열어라. 그것과 마주치지 마라.", 5);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function resize() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    T = Math.min(W / T_VIEW_W, H / T_VIEW_H);
    dark.width = world.width = W; dark.height = world.height = H;
  }
  function makeGrain() {
    grain = document.createElement("canvas"); grain.width = grain.height = 128;
    const g = grain.getContext("2d"); const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 28; }
    g.putImageData(img, 0, 0);
  }

  // ---------- 입력 ----------
  function setupInput() {
    window.onkeydown = e => { keys[e.key.toLowerCase()] = true; if (e.key === " " || e.key.toLowerCase() === "e") { e.preventDefault(); interactPress(); } if (e.key === "Escape" && modal) cancelModal(); };
    window.onkeyup = e => { keys[e.key.toLowerCase()] = false; if (e.key === " " || e.key.toLowerCase() === "e") interactRelease(); };
    const stick = el("stick"), knob = el("stick-knob");
    let sid = null, sx = 0, sy = 0;
    const zone = el("touch-zone");
    zone.addEventListener("touchstart", e => {
      for (const t of e.changedTouches) {
        if (sid === null && t.clientX < W * 0.55) { sid = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.display = "block"; stick.style.left = (sx - 60) + "px"; stick.style.top = (sy - 60) + "px"; input.active = true; }
      }
    }, { passive: true });
    zone.addEventListener("touchmove", e => {
      for (const t of e.changedTouches) if (t.identifier === sid) {
        let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy); const m = Math.min(d, 50);
        if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        input.dx = d > 8 ? dx / 50 : 0; input.dy = d > 8 ? dy / 50 : 0;
      }
    }, { passive: true });
    const endT = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; input.dx = input.dy = 0; input.active = false; stick.style.display = "none"; knob.style.transform = ""; } };
    zone.addEventListener("touchend", endT); zone.addEventListener("touchcancel", endT);
    const btn = el("btn-act");
    btn.onpointerdown = e => { e.preventDefault(); interactPress(); };
    btn.onpointerup = btn.onpointerleave = btn.onpointercancel = () => interactRelease();
  }

  function nearest() {
    if (hidden) return { kind: "unhide" };
    // 쓰러진 팀원
    for (const [id, o] of others) if (o.down && !o.esc && Math.hypot(o.x - pos.x, o.y - pos.y) < 1.4) return { kind: "rev", id, name: names[id] || "팀원" };
    for (const f of fuses) if (!(S && (S.f >> f.id) & 1) && Math.hypot(f.x + 0.5 - pos.x, f.y + 0.5 - pos.y) < 1.3) return { kind: "fuse", fuse: f };
    if (Math.hypot(breakerPos.x + 0.5 - pos.x, breakerPos.y + 0.5 - pos.y) < 1.3 && !(S && S.e)) return { kind: "breaker" };
    const tx = Math.floor(pos.x), ty = Math.floor(pos.y);
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (MapUtil.tile(x, y) === "L" && Math.hypot(x + 0.5 - pos.x, y + 0.5 - pos.y) < 1.3) return { kind: "hide", x, y };
    return null;
  }
  function interactPress() {
    if (!running || down || escaped || modal || phase !== "play") return;
    const n = nearest(); if (!n) return;
    if (n.kind === "fuse") { Net.sendToHost({ t: "q", fuse: n.fuse.id }); }
    else if (n.kind === "breaker") Net.sendToHost({ t: "q", fuse: -1 });
    else if (n.kind === "hide") { hidden = { x: n.x, y: n.y }; Net.sendToHost({ t: "hide", x: n.x, y: n.y }); Horror.breath(); showToast("사물함 안. 숨을 죽여라.", 2); }
    else if (n.kind === "unhide") { hidden = null; Net.sendToHost({ t: "unhide" }); }
    else if (n.kind === "rev") { holdRev = n.id; }
  }
  function interactRelease() { holdRev = false; }

  // ---------- 네트워크 수신 ----------
  function onMessage(d) {
    if (!running) return;
    if (d.t === "st") {
      if (d.team !== team) return;
      S = d; lastMsgTime = performance.now();
      mon.tx = d.m[0]; mon.ty = d.m[1]; mon.state = d.m[2]; mon.a = d.m[3]; mon.speed = d.m[4];
      if (mon.x < -50) { mon.x = mon.tx; mon.y = mon.ty; }
      phase = d.ph;
      const seen = new Set();
      for (const p of d.p) {
        const [id, x, y, a, dn, hid, esc, rev] = p;
        if (id === me) { down = !!dn; escaped = !!esc; revProgress = rev; if (hid && !hidden) {} continue; }
        seen.add(id);
        let o = others.get(id); if (!o) { o = { x, y, a }; others.set(id, o); }
        o.tx = x; o.ty = y; o.a = a; o.down = !!dn; o.hid = !!hid; o.esc = !!esc; o.rev = rev;
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
    } else if (d.t === "ev") {
      if (d.team !== team) return;
      handleEvent(d);
    }
  }

  function handleEvent(e) {
    switch (e.k) {
      case "q":
        if (e.id === me) openModal(e);
        break;
      case "fuse":
        if (e.ok) { Horror.right(); if (e.id === me && modal) modalResult(true); else showToast(`${e.by}: ${e.fuse === -1 ? "발전기 가동" : "부품 확보"}`, 2.5); }
        else {
          Horror.wrong(); fx.static = 1; wrongFlashT = 1.2;
          if (e.id === me && modal) modalResult(false); else showToast(`${e.by} 오답 — 경보가 울렸다. 그것이 소리를 들었다.`, 3);
        }
        break;
      case "locked": if (e.id === me) showToast(`발전기 부품이 모자란다. ${e.need}개 더 찾아야 한다.`, 3); break;
      case "cool": if (e.id === me) showToast(`잠겨 있다. ${e.left}초 뒤 다시.`, 2); break;
      case "wake": Horror.bang(); fx.shake = 1; showToast("…건물 어딘가에서 무언가가 깨어났다.", 4); Horror.vibrate([80, 60, 200]); break;
      case "hunt": Horror.scrape(); break;
      case "spotted":
        if (e.id === me) { fx.spotted = 1; Horror.scrape(); Horror.vibrate([60, 40, 60, 40, 200]); showToast("들켰다. 뛰어.", 2); }
        break;
      case "caught":
        if (e.id === me) jumpScare(); else { Horror.bang(); showToast(`${e.name}이(가) 쓰러졌다. 찾아가서 구해야 한다.`, 4); fx.shake = 0.6; }
        break;
      case "revived":
        if (e.id === me) { down = false; fx.fade = 1; showToast(e.self ? "정신이 돌아왔다." : "팀원이 깨워 줬다.", 3); }
        else showToast(`${names[e.id] || "팀원"}이(가) 일어났다.`, 2);
        break;
      case "exit": Horror.right(); showToast("발전기 가동! 출구가 열렸다. 지도 오른쪽 아래 출구로.", 5); break;
      case "escaped": if (e.id === me) { escaped = true; Horror.lightsOn(); } else showToast(`${e.name} 탈출 성공`, 2.5); break;
      case "end": phase = "end"; if (onEnd) onEnd(e); break;
    }
  }

  // ---------- 문제 ----------
  function openModal(e) {
    const item = QUESTION_BANK[e.unit].items[e.qi];
    modal = { fuse: e.fuse, unit: e.unit, qi: e.qi, item, t0: performance.now(), answered: false, result: null, stage: e.stage };
    const m = el("modal"); m.style.display = "flex";
    el("modal-title").textContent = (e.fuse === -1 ? "비상 발전기 · " : "부품 상자 · ") + QUESTION_BANK[e.unit].name;
    el("modal-q").textContent = item.q;
    const box = el("modal-choices"); box.innerHTML = "";
    item.c.forEach((c, i) => { const b = document.createElement("button"); b.textContent = c; b.onclick = () => answer(i); box.appendChild(b); });
    el("modal-exp").textContent = "";
    el("modal-cancel").style.display = "";
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
    modal.result = ok;
    [...el("modal-choices").children].forEach((b, j) => { if (j === modal.item.a) b.classList.add("correct"); else if (j === modal.chosen) b.classList.add("wrong"); });
    el("modal-exp").textContent = (ok ? "부품 확보. " : "오답 — 경보! 그것이 이쪽으로 온다. 상자는 15초 잠김. ") + modal.item.e;
    setTimeout(closeModal, ok ? 1500 : 2300);
  }
  function cancelModal() { if (!modal || modal.answered) return; Net.sendToHost({ t: "cancelq", fuse: modal.fuse }); closeModal(); }
  function closeModal() { modal = null; el("modal").style.display = "none"; }

  function showToast(text, sec) { toast = { text, t: sec }; }

  // ---------- 점프스케어 ----------
  function jumpScare() {
    Horror.screech(); Horror.vibrate([400, 80, 600]);
    fx.jump = 1; fx.jumpT0 = performance.now(); fx.shake = 1.5;
    closeModal();
  }

  // ---------- 루프 ----------
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt, now); render(now);
    raf = requestAnimationFrame(frame);
  }

  function update(dt, now) {
    // 이동
    let dx = input.dx, dy = input.dy;
    if (keys["w"] || keys["arrowup"]) dy -= 1; if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1; if (keys["d"] || keys["arrowright"]) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const canMove = !down && !escaped && !hidden && !modal && phase === "play";
    if (canMove && len > 0.05) {
      const sp = Sim.PLAYER_SPEED;
      const np = MapUtil.move(pos.x, pos.y, dx * sp * dt, dy * sp * dt, 0.3, S && S.e);
      pos.x = np.x; pos.y = np.y;
      const ta = Math.atan2(dy, dx); let da = ta - pos.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      pos.a += da * Math.min(1, dt * 12);
    }
    if (hidden) { pos.x = hidden.x + 0.5; pos.y = hidden.y + 0.5; }
    // 보간
    for (const o of others.values()) { o.x += (o.tx - o.x) * Math.min(1, dt * 10); o.y += (o.ty - o.y) * Math.min(1, dt * 10); }
    mon.x += (mon.tx - mon.x) * Math.min(1, dt * 8); mon.y += (mon.ty - mon.y) * Math.min(1, dt * 8);
    // 전송
    if (now - lastPos > 100 && !down && !escaped) { lastPos = now; Net.sendToHost({ t: "pos", x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), a: +pos.a.toFixed(2) }); }
    if (holdRev && now - lastRev > 100) { lastRev = now; Net.sendToHost({ t: "rev", target: holdRev }); }
    if (holdRev) { const o = others.get(holdRev); if (!o || !o.down || Math.hypot(o.x - pos.x, o.y - pos.y) > 1.6) holdRev = false; }
    // 문제 제한시간
    if (modal && !modal.answered && now - modal.t0 > 20000) answer(-1);
    // 오디오
    const md = Math.hypot(mon.x - pos.x, mon.y - pos.y);
    const sees = MapUtil.los(mon.x, mon.y, pos.x, pos.y);
    Horror.update(mon.state === "sleep" ? 99 : md, mon.x - pos.x, mon.state === "sleep" ? 0 : mon.speed, sees);
    // 효과 감쇠
    fx.shake *= Math.pow(0.02, dt); fx.static *= Math.pow(0.05, dt); fx.spotted *= Math.pow(0.1, dt); fx.fade *= Math.pow(0.1, dt);
    wrongFlashT -= dt; if (toast.t > 0) toast.t -= dt;
    // 손전등 깜빡임: 괴물이 가까우면
    const near = mon.state !== "sleep" ? Math.max(0, 1 - md / 7) : 0;
    if (Math.random() < near * 0.25) fx.flicker = 0.15 + Math.random() * 0.5; else fx.flicker += (1 - fx.flicker) * Math.min(1, dt * 14);
    if (mon.state === "chase" && md < 6) fx.shake = Math.max(fx.shake, 0.25);
    // 점프스케어 종료
    if (fx.jump && now - fx.jumpT0 > 1500) fx.jump = 0;
    updateHud(md);
  }

  function updateHud(md) {
    const n = nearest();
    const b = el("btn-act");
    const label = !n ? "" : n.kind === "fuse" ? "상자 열기" : n.kind === "breaker" ? "발전기" : n.kind === "hide" ? "숨기" : n.kind === "unhide" ? "나오기" : "구조 (꾹)";
    b.textContent = label; b.classList.toggle("on", !!n && !down && !escaped && !modal && phase === "play");
    if (S) {
      const fixed = countBits(S.f);
      el("hud-fuse").textContent = `부품 ${fixed}/${S.req}` + (S.e ? " · 출구 열림" : "");
      el("hud-time").textContent = fmt(S.tm);
      { const md = Math.hypot(mon.x - pos.x, mon.y - pos.y); el("hud-noise").style.width = (mon.state === "sleep" ? 0 : Math.max(0, 100 - md * 8)) + "%"; }
      el("hud-safe").textContent = S.safe > 0 ? `아직 조용하다 … ${S.safe}` : "";
      el("hud-team").innerHTML = S.p.map((p, i) => `<span class="${p[4] ? 'dn' : ''} ${p[6] ? 'esc' : ''}" style="color:${colors[i % colors.length]}">${p[6] ? "✓" : p[4] ? "✕" : "●"} ${names[p[0]] || "?"}</span>`).join(" ");
    }
    el("toast").textContent = toast.t > 0 ? toast.text : "";
    el("toast").style.opacity = toast.t > 0 ? Math.min(1, toast.t) : 0;
  }
  function countBits(n) { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }
  function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

  // ---------- 렌더 ----------
  function w2s(x, y) { return [(x - pos.x) * T + W / 2, (y - pos.y) * T + H / 2]; }

  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (escaped) { renderEscaped(); return; }
    const sh = fx.shake * 6;
    const ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
    // 세계 그리기
    wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.fillStyle = "#000"; wctx.fillRect(0, 0, W, H);
    wctx.translate(ox, oy);
    drawWorld(wctx);
    drawEntities(wctx, now);
    // 어둠 레이어
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = "source-over";
    dctx.fillStyle = "#000"; dctx.fillRect(0, 0, W, H);
    dctx.translate(ox, oy);
    if (!down && !hidden) { cutLight(dctx, pos.x, pos.y, pos.a, 8.5, 0.78, fx.flicker * 0.35, false); cutLight(dctx, pos.x, pos.y, pos.a, 7.5, 0.55, fx.flicker, true); }
    else if (hidden) cutAmbient(dctx, pos.x, pos.y, 0.9, 0.5);
    else cutAmbient(dctx, pos.x, pos.y, 2.2, 0.35);
    for (const o of others.values()) if (!o.down && !o.hid && !o.esc) cutLight(dctx, o.x, o.y, o.a, 5.5, 0.5, 0.8, false);
    ctx.drawImage(world, 0, 0);
    ctx.globalAlpha = down ? 0.985 : 0.975; ctx.drawImage(dark, 0, 0); ctx.globalAlpha = 1;
    // 어둠 속 눈
    drawEyes(ctx, now);
    if (hidden) drawLockerSlit(ctx);
    if (down) drawDowned(ctx, now);
    // 후처리
    postFx(ctx, now);
    if (fx.jump) drawJumpScare(ctx, now);
  }

  function drawWorld(c) {
    const x0 = Math.floor(pos.x - W / 2 / T) - 1, x1 = Math.ceil(pos.x + W / 2 / T) + 1;
    const y0 = Math.floor(pos.y - H / 2 / T) - 1, y1 = Math.ceil(pos.y + H / 2 / T) + 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = MapUtil.tile(x, y);
      const [sx, sy] = w2s(x, y);
      if (t === "#") {
        c.fillStyle = "#2a2d33"; c.fillRect(sx, sy, T + 1, T + 1);
        c.fillStyle = "#1c1e23"; c.fillRect(sx + 2, sy + 2, T - 4, T - 4);
        // 타일 줄눈
        c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 1; c.strokeRect(sx + 0.5, sy + 0.5, T, T / 2);
      } else {
        const room = MapUtil.roomAt(x + 0.5, y + 0.5);
        const hall = room && room.id === "hall";
        c.fillStyle = hall ? ((x + y) % 2 ? "#4a4f57" : "#444952") : ((x + y) % 2 ? "#5a5146" : "#52493f");
        c.fillRect(sx, sy, T + 1, T + 1);
        // 얼룩
        if (((x * 7 + y * 13) % 11) === 0) { c.fillStyle = "rgba(60,20,20,0.35)"; c.beginPath(); c.ellipse(sx + T * 0.5, sy + T * 0.6, T * 0.3, T * 0.18, 0.5, 0, 7); c.fill(); }
        if (t === "L") drawLocker(c, sx, sy);
        if (t === "F") drawFuse(c, sx, sy, fuseFixedAt(x, y));
        if (t === "B") drawBreaker(c, sx, sy);
        if (t === "E") { c.fillStyle = S && S.e ? "#3b6b2b" : "#5a1c1c"; c.fillRect(sx, sy, T, T); c.fillStyle = S && S.e ? "#9bff7a" : "#ff4a4a"; c.font = `${T * 0.32}px sans-serif`; c.textAlign = "center"; c.fillText("EXIT", sx + T / 2, sy + T * 0.6); }
      }
    }
    // 방 이름 (바닥 글씨)
    c.fillStyle = "rgba(255,255,255,0.08)"; c.font = `bold ${T * 0.5}px sans-serif`; c.textAlign = "center";
    for (const r of ROOMS) { if (r.id === "hall") continue; const [sx, sy] = w2s((r.x0 + r.x1 + 1) / 2, (r.y0 + r.y1 + 1) / 2); c.fillText(r.name, sx, sy); }
    // 배전실 안내
    // 실험 테이블 (장식)
    c.fillStyle = "#2b2520";
    for (const r of ROOMS) { if (r.units.length === 0 || r.id === "power") continue; const [sx, sy] = w2s(r.x0 + 2, r.y0 + 3); const [ex] = w2s(r.x1 - 1, 0); if (ex - sx > T) { c.fillRect(sx, sy, ex - sx, T * 0.9); c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(sx, sy, ex - sx, 3); c.fillStyle = "#2b2520"; } }
  }
  function fuseFixedAt(x, y) { const f = fuses.find(f => f.x === x && f.y === y); return f && S ? !!((S.f >> f.id) & 1) : false; }
  function drawLocker(c, sx, sy) {
    c.fillStyle = "#3a4552"; c.fillRect(sx + T * 0.1, sy + T * 0.05, T * 0.8, T * 0.9);
    c.fillStyle = "#222a33"; c.fillRect(sx + T * 0.15, sy + T * 0.1, T * 0.7, T * 0.8);
    c.fillStyle = "#56657a"; c.fillRect(sx + T * 0.48, sy + T * 0.1, 2, T * 0.8);
    for (let i = 0; i < 3; i++) { c.fillRect(sx + T * 0.22, sy + T * (0.2 + i * 0.1), T * 0.2, 1.5); c.fillRect(sx + T * 0.58, sy + T * (0.2 + i * 0.1), T * 0.2, 1.5); }
  }
  function drawFuse(c, sx, sy, fixed) {
    c.fillStyle = "#4a4a4a"; c.fillRect(sx + T * 0.15, sy + T * 0.15, T * 0.7, T * 0.7);
    c.fillStyle = fixed ? "#1f3a1f" : "#3a1f1f"; c.fillRect(sx + T * 0.22, sy + T * 0.22, T * 0.56, T * 0.56);
    c.fillStyle = fixed ? "#58ff7a" : (Math.floor(performance.now() / 600) % 2 ? "#ff3b3b" : "#5a1414");
    c.beginPath(); c.arc(sx + T * 0.5, sy + T * 0.5, T * 0.1, 0, 7); c.fill();
    c.fillStyle = "#ffd34a"; c.font = `bold ${T * 0.25}px sans-serif`; c.textAlign = "center"; c.fillText(fixed ? "" : "?", sx + T * 0.5, sy + T * 0.58);
  }
  function drawBreaker(c, sx, sy) {
    c.fillStyle = "#3d3f45"; c.fillRect(sx, sy + T * 0.05, T, T * 0.9);
    c.fillStyle = S && S.e ? "#58ff7a" : "#5a1414"; c.fillRect(sx + T * 0.2, sy + T * 0.25, T * 0.6, T * 0.5);
    c.fillStyle = "#ccc"; c.font = `${T * 0.22}px sans-serif`; c.textAlign = "center"; c.fillText("발전기", sx + T * 0.5, sy + T * 0.58);
  }

  function drawEntities(c, now) {
    // 팀원
    let i = 0;
    for (const [id, o] of others) {
      i++;
      if (o.esc || o.hid) continue;
      const [sx, sy] = w2s(o.x, o.y);
      drawPerson(c, sx, sy, o.a, colors[(S ? S.p.findIndex(p => p[0] === id) : i) % colors.length], o.down, names[id] || "", o.rev);
    }
    // 나
    if (!hidden && !down) drawPerson(c, W / 2, H / 2, pos.a, colors[(S ? S.p.findIndex(p => p[0] === me) : 0) % colors.length], false, "", 0);
    // 괴물
    if (mon.state !== "sleep") drawMonster(c, now);
  }
  function drawPerson(c, sx, sy, a, col, dn, name, rev) {
    c.save(); c.translate(sx, sy);
    if (dn) {
      c.rotate(1.3); c.fillStyle = "#3a2a2a"; c.beginPath(); c.ellipse(0, 0, T * 0.32, T * 0.18, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(T * 0.22, 0, T * 0.12, 0, 7); c.fill();
      c.restore();
      if (rev > 0) { c.fillStyle = "#222"; c.fillRect(sx - T * 0.4, sy - T * 0.5, T * 0.8, 6); c.fillStyle = "#9bff7a"; c.fillRect(sx - T * 0.4, sy - T * 0.5, T * 0.8 * Math.min(1, rev / 3), 6); }
      c.fillStyle = "rgba(255,120,120,0.9)"; c.font = `${T * 0.22}px sans-serif`; c.textAlign = "center"; c.fillText(name, sx, sy + T * 0.55);
      return;
    }
    c.rotate(a);
    c.fillStyle = "#1a1a1f"; c.beginPath(); c.ellipse(0, 0, T * 0.3, T * 0.22, 0, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, T * 0.15, 0, 7); c.fill();
    c.fillStyle = "#ddd"; c.fillRect(T * 0.15, -2, T * 0.18, 4);
    c.restore();
    if (name) { c.fillStyle = "rgba(255,255,255,0.7)"; c.font = `${T * 0.22}px sans-serif`; c.textAlign = "center"; c.fillText(name, sx, sy - T * 0.4); }
  }
  function drawMonster(c, now) {
    const [sx, sy] = w2s(mon.x, mon.y);
    if (sx < -T * 3 || sy < -T * 4 || sx > W + T * 3 || sy > H + T * 3) return;
    const j = (k = 1) => (Math.random() - 0.5) * T * 0.07 * k;
    const h = T * 2.3, wd = T * 0.5;
    const twitch = Math.random() < 0.08 ? (Math.random() - 0.5) * 0.5 : 0;
    c.save(); c.translate(sx, sy);
    // 주위 어둠이 일그러짐
    c.fillStyle = "rgba(0,0,0,0.5)";
    for (let i = 0; i < 10; i++) c.fillRect((Math.random() - 0.5) * T * 2.4, -h * 1.1 + Math.random() * h * 1.3, T * (0.2 + Math.random() * 0.5), T * 0.05);
    c.fillStyle = "rgba(0,0,0,0.65)"; c.beginPath(); c.ellipse(0, T * 0.12, T * 0.5, T * 0.18, 0, 0, 7); c.fill();
    c.rotate(twitch);
    // 다리 — 거꾸로 꺾인 관절
    c.strokeStyle = "#08080a"; c.lineWidth = T * 0.085; c.lineCap = "round"; c.lineJoin = "round";
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * wd * 0.2, -h * 0.42); c.lineTo(sd * wd * 0.55 + j(), -h * 0.28 + j()); c.lineTo(sd * wd * 0.25 + j(), -h * 0.05); c.lineTo(sd * wd * 0.45 + j(), T * 0.1); c.stroke(); }
    // 몸통 — 구부정하게 앞으로 꺾인 등
    c.fillStyle = "#0c0c0f"; c.beginPath();
    c.moveTo(-wd * 0.45, -h * 0.4); c.quadraticCurveTo(-wd * 0.7 + j(), -h * 0.75, -wd * 0.15 + j(), -h * 0.98);
    c.lineTo(wd * 0.35 + j(), -h * 0.92); c.quadraticCurveTo(wd * 0.55, -h * 0.65, wd * 0.4 + j(), -h * 0.4); c.closePath(); c.fill();
    // 갈비뼈 같은 결
    c.strokeStyle = "rgba(120,110,100,0.25)"; c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const y = -h * (0.5 + i * 0.08); c.beginPath(); c.moveTo(-wd * 0.3, y); c.quadraticCurveTo(0, y + T * 0.06, wd * 0.3, y); c.stroke(); }
    // 팔 — 바닥까지 끌리는 길이, 관절이 많다
    c.strokeStyle = "#08080a"; c.lineWidth = T * 0.065;
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * wd * 0.35, -h * 0.85);
      let x = sd * wd * 0.35, y = -h * 0.85;
      for (let k = 0; k < 4; k++) { x += sd * wd * 0.28 + j(2); y += h * 0.26 + j(); c.lineTo(x, y); }
      c.stroke();
      // 손가락
      c.lineWidth = T * 0.025; c.strokeStyle = "#cfc6b8";
      for (let f = 0; f < 5; f++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + sd * (f - 2) * T * 0.06 + j(), y + T * 0.32 + j(3)); c.stroke(); }
      c.lineWidth = T * 0.065; c.strokeStyle = "#08080a";
    }
    // 목과 머리 — 앞으로 떨구고 비스듬히 기울임
    const hx = -wd * 0.05 + j(), hy = -h * 1.1 + j();
    c.strokeStyle = "#141216"; c.lineWidth = T * 0.09; c.beginPath(); c.moveTo(-wd * 0.05, -h * 0.95); c.lineTo(hx, hy + T * 0.2); c.stroke();
    c.save(); c.translate(hx, hy); c.rotate(0.35 + twitch * 2 + (Math.random() < 0.05 ? 1.2 : 0));
    const g = c.createRadialGradient(-T * 0.05, -T * 0.1, T * 0.02, 0, 0, T * 0.34);
    g.addColorStop(0, "#e6dfd3"); g.addColorStop(0.7, "#a89f92"); g.addColorStop(1, "#3a3430");
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, T * 0.2, T * 0.33, 0, 0, 7); c.fill();
    // 눈구멍 깊고 비대칭, 입은 아래로 길게
    c.fillStyle = "#030203";
    c.beginPath(); c.ellipse(-T * 0.08, -T * 0.09, T * 0.05, T * 0.08, 0.3, 0, 7); c.fill();
    c.beginPath(); c.ellipse(T * 0.07, -T * 0.06, T * 0.065, T * 0.1, -0.2, 0, 7); c.fill();
    c.beginPath(); c.ellipse(T * 0.01, T * 0.17, T * 0.06, T * 0.13 + Math.abs(j(3)), 0, 0, 7); c.fill();
    c.fillStyle = "rgba(255,255,255,0.85)"; c.fillRect(-T * 0.09, -T * 0.1, 2, 2); c.fillRect(T * 0.07, -T * 0.08, 2, 2);
    c.restore();
    // 글리치 슬라이스
    if (Math.random() < 0.35) { const gy = -h * (0.2 + Math.random() * 1.0); c.fillStyle = "#000"; c.fillRect(-wd * 2, gy, wd * 4, T * (0.03 + Math.random() * 0.06)); }
    c.restore();
  }
  function drawEyes(c, now) {
    if (mon.state === "sleep" || down) return;
    const d = Math.hypot(mon.x - pos.x, mon.y - pos.y);
    if (d > 7 || !MapUtil.los(mon.x, mon.y, pos.x, pos.y)) return;
    // 손전등 원뿔 밖에 있으면 눈만 희미하게
    const ang = Math.atan2(mon.y - pos.y, mon.x - pos.x); let da = Math.abs(ang - pos.a); while (da > Math.PI) da = Math.abs(da - 2 * Math.PI);
    if (da < 0.6 && !hidden) return;
    const [sx, sy] = w2s(mon.x, mon.y); const hy = sy - T * 2.3 * 1.1;
    const a = 0.35 + 0.4 * Math.sin(now / 300) ** 2;
    c.fillStyle = `rgba(230,230,255,${a})`; c.fillRect(sx - T * 0.08, hy - T * 0.08, 2, 2); c.fillRect(sx + T * 0.08, hy - T * 0.08, 2, 2);
  }

  function cutLight(c, x, y, a, radius, spread, flick, isMe) {
    const [sx, sy] = w2s(x, y);
    const R = radius * T;
    c.globalCompositeOperation = "destination-out";
    // 원뿔 — 레이캐스트
    const rays = 56; c.beginPath(); c.moveTo(sx, sy);
    for (let i = 0; i <= rays; i++) {
      const ang = a - spread + (spread * 2) * i / rays;
      let rx = x, ry = y, hit = radius;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      for (let t = 0; t < radius; t += 0.08) { rx = x + cx * t; ry = y + cy * t; if (MapUtil.solidFor(Math.floor(rx), Math.floor(ry), S && S.e)) { hit = t + 0.25; break; } }
      c.lineTo(sx + cx * hit * T, sy + cy * hit * T);
    }
    c.closePath();
    const g = c.createRadialGradient(sx, sy, T * 0.2, sx, sy, R);
    g.addColorStop(0, `rgba(0,0,0,${0.95 * flick})`); g.addColorStop(0.55, `rgba(0,0,0,${0.8 * flick})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fill();
    // 주변 희미한 빛
    cutAmbient(c, x, y, isMe ? 1.3 : 0.9, isMe ? 0.5 : 0.3);
    c.globalCompositeOperation = "source-over";
  }
  function cutAmbient(c, x, y, r, alpha) {
    const [sx, sy] = w2s(x, y);
    c.globalCompositeOperation = "destination-out";
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, r * T);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r * T, 0, 7); c.fill();
    c.globalCompositeOperation = "source-over";
  }
  function drawLockerSlit(c) {
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    // 틈새로 보이는 세계
    c.save(); c.beginPath();
    for (let i = -1; i <= 1; i++) c.rect(W / 2 - 10 + i * 40, H * 0.2, 7, H * 0.6);
    c.clip(); c.globalAlpha = 0.6; c.drawImage(world, 0, 0); c.globalAlpha = 0.93; c.drawImage(dark, 0, 0); c.restore();
    c.fillStyle = "rgba(255,255,255,0.5)"; c.font = `${Math.min(W, H) * 0.035}px sans-serif`; c.textAlign = "center";
    c.fillText("숨어 있다. 발소리를 들어라. 버튼을 눌러 나간다.", W / 2, H * 0.9);
  }
  function drawDowned(c, now) {
    c.fillStyle = `rgba(0,0,0,${0.55 + 0.25 * Math.sin(now / 900)})`; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.75)"; c.font = `bold ${Math.min(W, H) * 0.05}px sans-serif`; c.textAlign = "center";
    c.fillText("쓰러졌다", W / 2, H * 0.4);
    c.font = `${Math.min(W, H) * 0.032}px sans-serif`;
    c.fillText("팀원이 와서 깨워 줄 때까지 기다린다", W / 2, H * 0.47);
    if (revProgress > 0) { c.fillStyle = "#222"; c.fillRect(W * 0.3, H * 0.55, W * 0.4, 10); c.fillStyle = "#9bff7a"; c.fillRect(W * 0.3, H * 0.55, W * 0.4 * Math.min(1, revProgress / 3), 10); }
  }
  function renderEscaped() {
    ctx.fillStyle = "#e8e4d8"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#222"; ctx.font = `bold ${Math.min(W, H) * 0.07}px sans-serif`; ctx.textAlign = "center";
    ctx.fillText("탈출했다", W / 2, H * 0.42);
    ctx.font = `${Math.min(W, H) * 0.035}px sans-serif`;
    ctx.fillText("불이 켜졌다. 아직 안에 있는 팀원을 기다리는 중…", W / 2, H * 0.5);
    if (S) { const left = S.p.filter(p => !p[6]).map(p => names[p[0]] || "?"); ctx.fillText(left.length ? "남은 사람: " + left.join(", ") : "", W / 2, H * 0.58); }
  }
  function postFx(c, now) {
    // 비네트
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.85)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // 입자(그레인)
    c.save(); c.globalAlpha = 0.5 + fx.static * 0.5; c.translate(Math.random() * 128, Math.random() * 128);
    c.fillStyle = c.createPattern(grain, "repeat"); c.fillRect(-128, -128, W + 128, H + 128); c.restore();
    // 오답 정전기 플래시
    if (wrongFlashT > 0 && Math.random() < 0.5) { c.fillStyle = `rgba(255,255,255,${0.08 * wrongFlashT})`; for (let i = 0; i < 6; i++) c.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6); }
    // 들켰을 때 가장자리 붉게
    if (fx.spotted > 0.02) { c.fillStyle = `rgba(120,0,0,${fx.spotted * 0.35})`; c.fillRect(0, 0, W, H); }
    if (fx.fade > 0.02) { c.fillStyle = `rgba(0,0,0,${fx.fade})`; c.fillRect(0, 0, W, H); }
    // 심장박동 시각: 괴물 근접 시 화면 수축
    const md = Math.hypot(mon.x - pos.x, mon.y - pos.y);
    if (mon.state !== "sleep" && md < 5 && !down) { c.fillStyle = `rgba(60,0,0,${(1 - md / 5) * 0.25 * (0.5 + 0.5 * Math.sin(now / 120))})`; c.fillRect(0, 0, W, H); }
  }
  function jag(c, cx, cy, rx, ry, n, rough, rot) {
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * Math.PI * 2;
      const r = 1 + (Math.random() - 0.5) * rough;
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }
  function drawJumpScare(c, now) {
    const t = (now - fx.jumpT0) / 1000;
    document.getElementById("hud").style.visibility = t < 1.5 ? "hidden" : "";
    document.getElementById("toast").style.visibility = t < 1.5 ? "hidden" : "";
    document.getElementById("btn-act").style.visibility = t < 1.5 ? "hidden" : "";
    if (settings && settings.scare < 2) { c.fillStyle = `rgba(0,0,0,${Math.min(1, t * 3)})`; c.fillRect(0, 0, W, H); return; }
    if (t < 0.07) { c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); return; }
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    const sc = 1.25 + t * 1.3;
    const cx = W / 2 + (Math.random() - 0.5) * 40 + Math.sin(t * 40) * 10, cy = H / 2 + (Math.random() - 0.5) * 40;
    const base = Math.min(W, H) * 0.3 * sc;
    c.save(); c.translate(cx, cy);
    // 색수차
    for (const [col, off] of [["rgba(200,0,0,0.55)", -7], ["rgba(0,180,200,0.45)", 7]]) {
      c.save(); c.translate(off, 0); c.fillStyle = col; jag(c, 0, 0, base * 0.6, base, 40, 0.07, 0); c.fill(); c.restore();
    }
    // 피부
    const g = c.createRadialGradient(-base * 0.1, -base * 0.2, base * 0.1, 0, 0, base);
    g.addColorStop(0, "#e9e2d6"); g.addColorStop(0.6, "#bdb3a5"); g.addColorStop(1, "#5a5048");
    c.fillStyle = g; jag(c, 0, 0, base * 0.6, base, 40, 0.07, 0); c.fill();
    c.save(); c.clip(); c.globalAlpha = 0.9; c.fillStyle = c.createPattern(grain, "repeat"); c.fillRect(-base, -base * 1.2, base * 2, base * 2.4);
    // 정맥/균열
    c.strokeStyle = "rgba(70,0,0,0.75)"; c.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { c.beginPath(); let x = (Math.random() - 0.5) * base, y = (Math.random() - 0.5) * base * 1.6; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * base * 0.3; y += (Math.random() - 0.5) * base * 0.3; c.lineTo(x, y); } c.stroke(); }
    c.restore();
    // 눈구멍 — 비대칭, 깊고 축축하게
    c.fillStyle = "#050305";
    jag(c, -base * 0.26, -base * 0.3, base * 0.15, base * 0.2, 14, 0.35, 0.3); c.fill();
    jag(c, base * 0.22, -base * 0.22, base * 0.19, base * 0.27, 14, 0.4, -0.2); c.fill();
    c.fillStyle = "rgba(220,220,230,0.9)";
    c.beginPath(); c.arc(-base * 0.22 + Math.random() * 4, -base * 0.34, base * 0.025, 0, 7); c.fill();
    c.beginPath(); c.arc(base * 0.28 + Math.random() * 4, -base * 0.3, base * 0.03, 0, 7); c.fill();
    // 입 — 턱이 빠진 듯 길게 찢어짐
    c.fillStyle = "#070304";
    jag(c, base * 0.02, base * 0.5, base * 0.24, base * 0.45 + Math.random() * 10, 20, 0.3, 0);
    c.fill();
    c.fillStyle = "#b8ad9c";
    for (let i = 0; i < 11; i++) { const x = -base * 0.2 + i * base * 0.04; c.fillRect(x, base * 0.1, base * 0.028, base * (0.08 + Math.random() * 0.1)); }
    // 검은 액체
    c.fillStyle = "rgba(40,0,0,0.9)";
    for (let i = 0; i < 5; i++) { const x = (Math.random() - 0.5) * base * 0.6; c.fillRect(x, base * 0.6, base * 0.03, base * (0.3 + Math.random() * 0.3)); }
    c.restore();
    // 찢어진 줄 / 글리치
    c.fillStyle = "#000"; for (let i = 0; i < 16; i++) c.fillRect(0, Math.random() * H, W, Math.random() * 12);
    if (Math.random() < 0.4) { const y = Math.random() * H, h = 20 + Math.random() * 60; const img = c.getImageData(0, y, W, h); c.putImageData(img, (Math.random() - 0.5) * 60, y); }
    c.fillStyle = `rgba(0,0,0,${Math.max(0, (t - 0.9) / 0.6)})`; c.fillRect(0, 0, W, H);
  }

  return { start, stop, onMessage, cancelModal, get me() { return me; }, _dbg: { pos: () => pos, set: (x, y) => { pos.x = x; pos.y = y; }, mon: () => mon, S: () => S, down: () => down, modal: () => modal } };
})();
