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
  let fuses = [], breakerPos = null;
  let onEnd = null, grain = null, wrongFlashT = 0, bobT = 0;
  let intro = null, gore = false, flashOn = 1, locked = false, look = 0, mapOpen = false, mapImg = null;
  let slitSnap = null;
  let myCarry = 0, myMed = false;
  let lightOn = true, lightTipShown = false, hideTipShown = false, turnVel = 0, prevA = 0;
  const isTouch = ("ontouchstart" in window) && window.matchMedia && matchMedia("(pointer: coarse)").matches;
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
    document.body.classList.toggle("pc", !isTouch);
    fuses = MapUtil.fuses(); breakerPos = MapUtil.find("B")[0]; S = null; mon = { x: -99, y: -99, tx: -99, ty: -99, state: "sleep", a: 0, speed: 0 };
    setupInput(); makeGrain(); mapImg = null; mapOpen = false; look = 0; lightOn = true; el("btn-light").classList.add("on");
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
    Horror.init(); Horror.resume();
    gore = false; flashOn = 1;
    if (settings && settings.intro) beginIntro(); else { gore = true; showToast("정전이다. 실험실 단말기에서 에너지 셀을 회수해 발전기를 돌려라. 그것이 건물 안에 있다.", 6); }
  }
  function stop() { running = false; cancelAnimationFrame(raf); if (document.pointerLockElement) document.exitPointerLock(); Horror.siren(false); }
  function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; Fps.setup(W, H); }
  function makeGrain() {
    grain = document.createElement("canvas"); grain.width = grain.height = 128;
    const g = grain.getContext("2d"); const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 30; }
    g.putImageData(img, 0, 0);
  }

  // ---------- 입력: 왼쪽 스틱 이동, 오른쪽 드래그 회전 ----------
  function setupInput() {
    window.onkeydown = e => {
      const k = e.key.toLowerCase(); keys[k] = true;
      if (k === " " || k === "e") { e.preventDefault(); interactPress(); }
      if ((k === "m" || k === "tab") && !e.repeat) { e.preventDefault(); if (!intro && !modal) mapOpen = !mapOpen; }
      if (k === "f" && !e.repeat) toggleLight();
      if (e.key === "Escape") { if (modal) cancelModal(); mapOpen = false; if (Options.isOpen) Options.close(); }
    };
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
        } else if (t.identifier === tid && !intro && !mapOpen && !Options.isOpen) { const dx = t.clientX - tx; tx = t.clientX; pos.a += dx * 0.0075 * Options.get("touchSens"); }
      }
    }, { passive: true });
    const endT = e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; input.fwd = input.strafe = 0; stick.style.display = "none"; knob.style.transform = ""; } if (t.identifier === tid) tid = null; } };
    zone.addEventListener("touchend", endT); zone.addEventListener("touchcancel", endT);
    // 마우스: 화면을 한 번 클릭하면 커서가 잠기고, 그다음부터는 마우스만 움직여도 시점이 돈다 (Esc로 해제)
    zone.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse") return;
      if (!locked) {
        if (!modal && !Options.isOpen && zone.requestPointerLock) { try { const r = zone.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} }
        return;
      }
      if (e.button === 0) interactPress();
      else if (e.button === 2) toggleLight();
    });
    zone.addEventListener("contextmenu", e => e.preventDefault());
    el("btn-light").onpointerdown = e => { e.preventDefault(); e.stopPropagation(); toggleLight(); };
    zone.addEventListener("pointerup", e => { if (e.pointerType === "mouse" && locked) interactRelease(); });
    document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === zone; });
    document.addEventListener("mousemove", e => {
      if (!locked || !running || intro || modal || mapOpen || Options.isOpen) return;
      const k = Options.get("mouseSens");
      pos.a += (e.movementX || 0) * 0.0024 * k;
      look = Math.max(-0.28, Math.min(0.28, look - (e.movementY || 0) * 0.0015 * k * (Options.get("invertY") ? -1 : 1)));
    });
    el("btn-map").onclick = () => { if (!intro && !modal) mapOpen = !mapOpen; };
    const btn = el("btn-act");
    btn.onpointerdown = e => { e.preventDefault(); interactPress(); };
    btn.onpointerup = btn.onpointerleave = btn.onpointercancel = () => interactRelease();
  }

  function nearest() {
    if (hidden) return { kind: "unhide" };
    for (const [id, o] of others) if (o.down && !o.esc && Math.hypot(o.x - pos.x, o.y - pos.y) < 1.5) return { kind: "rev", id, name: names[id] || "팀원" };
    const fx0 = pos.x + Math.cos(pos.a) * 0.6, fy0 = pos.y + Math.sin(pos.a) * 0.6;
    if (window.MEDKITS && !myMed) for (let i = 0; i < MEDKITS.length; i++) if (!(S && (S.mk >> i) & 1) && Math.hypot(MEDKITS[i].x - pos.x, MEDKITS[i].y - pos.y) < 1.3) return { kind: "med", id: i };
    { const tx = Math.floor(fx0), ty = Math.floor(fy0); for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (MapUtil.tile(x, y) === "c" && Math.hypot(x + 0.5 - fx0, y + 0.5 - fy0) < 1.25) return { kind: "cctv" }; }
    for (const f of fuses) if (!(S && (S.f >> f.id) & 1) && Math.hypot(f.x + 0.5 - fx0, f.y + 0.5 - fy0) < 1.25) return { kind: "fuse", fuse: f };
    if (Math.hypot(breakerPos.x + 0.5 - fx0, breakerPos.y + 0.5 - fy0) < 1.25 && !(S && S.e)) return { kind: "breaker" };
    const tx = Math.floor(pos.x), ty = Math.floor(pos.y);
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (MapUtil.tile(x, y) === "L" && Math.hypot(x + 0.5 - fx0, y + 0.5 - fy0) < 1.25) return { kind: "hide", x, y };
    return null;
  }
  function interactPress() {
    if (!running || down || escaped || modal || intro || mapOpen || Options.isOpen || phase !== "play") return;
    const n = nearest(); if (!n) return;
    if (n.kind === "fuse") Net.sendToHost({ t: "q", fuse: n.fuse.id });
    else if (n.kind === "breaker") Net.sendToHost({ t: "q", fuse: -1 });
    else if (n.kind === "cctv") Net.sendToHost({ t: "q", fuse: -2 });
    else if (n.kind === "med") Net.sendToHost({ t: "med", id: n.id });
    else if (n.kind === "hide") {
      hidePrev = { x: pos.x, y: pos.y, a: pos.a }; hidden = { x: n.x, y: n.y }; Net.sendToHost({ t: "hide", x: n.x, y: n.y, l: lightOn ? 1 : 0 }); Horror.breath();
      showToast(lightOn ? "사물함 안. 손전등이 켜져 있다 — 틈으로 빛이 샌다. (F로 끄기)" : "사물함 안. 숨을 죽여라.", 3);
    }
    else if (n.kind === "unhide") { hidden = null; if (hidePrev) { pos.x = hidePrev.x; pos.y = hidePrev.y; pos.a = hidePrev.a; } Net.sendToHost({ t: "unhide" }); }
    else if (n.kind === "rev") holdRev = n.id;
  }
  function interactRelease() { holdRev = false; }
  function toggleLight() {
    if (!running || intro || down || escaped || phase !== "play") return;
    lightOn = !lightOn; Horror.click();
    lastPos = 0; // 바로 알림
    if (!lightOn && !lightTipShown) { lightTipShown = true; showToast("손전등을 껐다. 그것도 나를 잘 못 본다. 바로 앞까지 오지 않는 한.", 3.5); }
    else if (lightOn && hidden) showToast("사물함 안에서 켜면 틈으로 빛이 샌다.", 2.5);
  }

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
        const [id, x, y, a, dn, hid, esc, rev, lt, cr, md] = p;
        if (id === me) { down = !!dn; escaped = !!esc; revProgress = rev; myCarry = cr || 0; myMed = !!md; continue; }
        seen.add(id);
        let o = others.get(id); if (!o) { o = { x, y, a }; others.set(id, o); }
        o.tx = x; o.ty = y; o.a = a; o.down = !!dn; o.hid = !!hid; o.esc = !!esc; o.rev = rev; o.name = names[id] || ""; o.light = lt !== 0;
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
    } else if (d.t === "ev") { if (d.team !== team) return; handleEvent(d); }
  }
  function handleEvent(e) {
    switch (e.k) {
      case "q": if (e.id === me) openModal(e); break;
      case "fuse":
        if (e.ok) { Horror.right(); if (e.id === me && modal) modalResult(true); else showToast(`${e.by}: ${e.fuse === -1 ? "발전기 가동" : "에너지 셀을 꺼냈다"}`, 2.5); }
        else { Horror.wrong(); fx.static = 1; wrongFlashT = 1.2; if (e.id === me && modal) modalResult(false); else showToast(`${e.by} 오답 — 경보가 울렸다. 그것이 소리를 들었다.`, 3); }
        break;
      case "locked": if (e.id === me) showToast(`발전기에 셀이 모자란다. ${e.need}개 더 가져와야 한다.`, 3); break;
      case "full": if (e.id === me) showToast("손이 가득 찼다(2개). 발전기실에 셀을 먼저 넣고 오자.", 3); break;
      case "insert": Horror.right(); showToast(`${e.id === me ? "셀" : e.by + ": 셀"} ${e.n}개를 발전기에 넣었다 — ${e.total}/${e.need}` + (e.total >= e.need ? ". 이제 발전기를 돌릴 수 있다!" : ""), 3.5); break;
      case "drop": showToast(`${e.id === me ? "들고 있던" : e.name + "이(가) 들고 있던"} 셀 ${e.n}개가 바닥에 떨어졌다. 지도에 표시된다.`, 3.5); break;
      case "pickup": if (e.id === me) showToast(`떨어진 셀 ${e.n}개를 주웠다.`, 2.5); break;
      case "medkit": showToast(e.id === me ? "구급상자를 챙겼다. 쓰러지면 6초 뒤 혼자 일어난다." : `${e.by}이(가) 구급상자를 챙겼다.`, 3.5); break;
      case "cctv": Horror.right(); if (e.id === me && modal) modalResult(true); showToast(`CCTV 접속 — ${e.secs}초 동안 괴물과 남은 장비 위치가 화면 위에 보인다.`, 4); break;
      case "cctvon": if (e.id === me) showToast(`CCTV는 이미 켜져 있다 (${e.left}초 남음).`, 2); break;
      case "cool": if (e.id === me) showToast(`잠겨 있다. ${e.left}초 뒤 다시.`, 2); break;
      case "wake": Horror.bang(); fx.shake = 1; showToast("…건물 어딘가에서 무언가가 깨어났다.", 4); Horror.vibrate([80, 60, 200]); break;
      case "hunt": Horror.scrape(); break;
      case "light":
        if (e.id === me) {
          Horror.scrape(); Horror.vibrate([60, 40, 120]); fx.spotted = 0.5;
          showToast(e.locker ? "…새어 나간 빛을 봤다. 무언가 사물함 쪽으로 온다." : "…빛을 봤다. 무언가 이쪽으로 온다. 손전등을 꺼라.", 3);
        }
        break;
      case "spotted": if (e.id === me) { fx.spotted = 1; Horror.scrape(); Horror.vibrate([60, 40, 60, 40, 200]); showToast("들켰다. 뛰어.", 2); } break;
      case "caught": if (e.id === me) jumpScare(); else { Horror.bang(); showToast(`${e.name}이(가) 쓰러졌다. 찾아가서 구해야 한다.`, 4); fx.shake = 0.6; } break;
      case "revived": if (e.id === me) { down = false; fx.fade = 1; showToast(e.self ? "정신이 돌아왔다." : "팀원이 깨워 줬다.", 3); } else showToast(`${names[e.id] || "팀원"}이(가) 일어났다.`, 2); break;
      case "exit": Horror.right(); showToast("발전기 가동! 보안 출구가 열렸다. 남동쪽 끝, 보안 출구로.", 5); break;
      case "escaped": if (e.id === me) { escaped = true; Horror.lightsOn(); } else showToast(`${e.name} 탈출 성공`, 2.5); break;
      case "end": phase = "end"; if (onEnd) onEnd(e); break;
    }
  }

  // ---------- 문제 ----------
  function openModal(e) {
    const item = QUESTION_BANK[e.unit].items[e.qi];
    const perm = e.perm || item.c.map((_, i) => i);   // 화면 위치 → 원래 보기
    modal = { fuse: e.fuse, unit: e.unit, qi: e.qi, item, perm, correctPos: perm.indexOf(item.a), t0: performance.now(), answered: false, result: null };
    if (document.pointerLockElement) document.exitPointerLock(); // 보기 클릭을 위해 커서 풀기
    mapOpen = false;
    el("modal").style.display = "flex";
    const dev = e.fuse >= 0 && fuses[e.fuse] ? (window.DEVICE_NAME && DEVICE_NAME[fuses[e.fuse].room]) || "장비" : null;
    el("modal-title").textContent = (e.fuse === -1 ? "비상 발전기 · 기동 인증 · " : e.fuse === -2 ? "CCTV 관제 시스템 · 접속 인증 · " : dev + " · 잠금 해제 · ") + QUESTION_BANK[e.unit].name;
    el("modal-q").textContent = item.q;
    const box = el("modal-choices"); box.innerHTML = "";
    perm.forEach((orig, i) => { const b = document.createElement("button"); b.textContent = item.c[orig]; b.onclick = () => answer(i); box.appendChild(b); });
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
    [...el("modal-choices").children].forEach((b, j) => { if (j === modal.correctPos) b.classList.add("correct"); else if (j === modal.chosen) b.classList.add("wrong"); });
    const okMsg = modal.fuse === -1 ? "발전기 가동! " : modal.fuse === -2 ? "CCTV 접속 성공. " : "셀을 꺼냈다 — 비상 발전기실로 가져가자. ";
    el("modal-exp").textContent = (ok ? okMsg : "인증 실패 — 경보! 그것이 이쪽으로 온다. 15초 잠김. ") + modal.item.e;
    setTimeout(closeModal, ok ? 1500 : 2300);
  }
  function cancelModal() { if (!modal || modal.answered) return; Net.sendToHost({ t: "cancelq", fuse: modal.fuse }); closeModal(); }
  function closeModal() { modal = null; el("modal").style.display = "none"; }
  function showToast(text, sec) { toast = { text, t: sec }; }
  function jumpScare() { Horror.screech(); Horror.vibrate([400, 80, 600]); fx.jump = 1; fx.jumpT0 = performance.now(); fx.shake = 1.5; closeModal(); }

  // ---------- 인트로: 격리 실패 ----------
  const P = a => ({ x: a[0], y: a[1] });
  let IN = null;
  function buildIN() {   // 그 판 지도의 격리실 앞 복도 좌표 (MapGen 이 계산)
    const I = window.INTRO, d = (k, def) => I[k] ? P(I[k]) : def;
    return { cam: { x: I.cam[0], y: I.cam[1], a: I.camA },
      cell: d("cell", { x: 8.5, y: 5.2 }), cellDoor: d("cellDoor", { x: 8.5, y: 7.5 }), door: d("door", { x: 8.5, y: 11.2 }),
      r1: P(I.r1), r2: P(I.r2), r3: d("r3", { x: 17.0, y: 13.5 }), r2end: P(I.kill2), r3end: d("r3end", { x: 19.5, y: 9.6 }),
      m1: d("m1", { x: 9.3, y: 12.4 }), m2: d("m2", { x: 16.0, y: 12.9 }), lunge: d("lunge", { x: I.cam[0] - 2.0, y: I.cam[1] }) };
  }
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  const lerpP = (A, B, t) => ({ x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t) });
  function beginIntro() {
    IN = buildIN();
    intro = { t0: performance.now(), t: 0, ambient: 0.9, done: {}, text: "", sub: "", flash: 0, red: 0, shake: 0, black: 0 };
    el("hud").style.visibility = "hidden"; el("btn-act").style.visibility = "hidden"; el("btn-light").style.visibility = "hidden"; el("stick").style.display = "none";
  }
  function finishIntro() {
    intro = null; flashOn = 1; gore = true; Horror.siren(false);
    el("hud").style.visibility = ""; el("btn-act").style.visibility = ""; el("btn-light").style.visibility = "";
    showToast(`발전기를 돌려야 보안문이 열린다. 방마다 있는 장비에서 에너지 셀을 꺼내(문제) 비상 발전기실로 가져가라. 한 번에 2개까지, 모두 ${settings.requiredFuses}개. …그것은 아직 이 건물 안에 있다.`, 8);
  }
  function once(key, fn) { if (!intro.done[key]) { intro.done[key] = true; fn(); } }
  function updateIntro(dt, now) {
    const I = intro; I.t = (now - I.t0) / 1000; const t = I.t;
    I.flash *= Math.pow(0.001, dt); I.shake *= Math.pow(0.02, dt);
    if (t < 3) { I.text = "지하 3층 · 격리 연구동"; I.sub = "23:47"; }
    if (t >= 3) once("alarm", () => { Horror.siren(true); Horror.vibrate([100, 50, 100]); });
    if (t >= 3 && t < 11.5) { I.text = "⚠ 격리 실패 — 개체 K-7"; I.sub = "전 구역 봉쇄 · 보안 인력 대기"; I.red = 0.5 + 0.5 * Math.sin(t * 9); }
    if (t >= 5) once("bang", () => { Horror.bang(); I.shake = 1.2; });
    if (t >= 6.4) once("kill1", () => { Horror.screech(); I.shake = 1; I.flash = 0.6; });
    if (S && S.it > 0) I.sawIt = true;
    if (S && S.it <= 0 && !I.sawIt && t < 13) { finishIntro(); return; } // 늦게 들어온 학생은 연출 생략
    if (t >= 7.0) once("shatter1", () => { Horror.shatter(); I.flash = 1; I.ambient = 0.6; });
    if (t >= 8.8) once("kill2", () => { Horror.screech(); I.shake = 1.3; I.flash = 0.5; Horror.vibrate([200, 80, 300]); });
    if (t >= 9.2) once("shatter2", () => { Horror.shatter(); Horror.spark(); I.flash = 1; I.ambient = 0.3; });
    if (t >= 10.2) once("shatter3", () => { Horror.shatter(); I.flash = 1; I.ambient = 0.08; Horror.siren(false); });
    if (t >= 11.5) once("lunge", () => { Horror.screech(); Horror.vibrate([500, 100, 500]); I.flash = 1.5; I.black = 1; I.text = ""; I.sub = ""; });
    if (t >= 13.5) { I.text = "…눈을 떴다."; I.sub = "중앙 홀. 조용하다. 비상등도 꺼졌다."; }
    if (t >= 15.0) once("end", () => { Horror.click(); finishIntro(); flashOn = 0; }); // 딸깍 — 내 손전등이 켜지며 바로 내 시점으로
  }
  function renderIntro(now) {
    const I = intro, t = I.t;
    if (I.black) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); if (t > 12.5) { drawIntroText(ctx, I, 0.55); } postFx(ctx, now); return; }
    const extra = [];
    // 연구원
    const r1 = t < 6.4 ? { kind: t > 4.5 ? "researcher_run" : "researcher", ...IN.r1 } : null;
    const r2 = t < 8.8 ? { kind: t > 4.5 ? "researcher_run" : "researcher", ...(t < 6.6 ? IN.r2 : lerpP(IN.r2, IN.r2end, (t - 6.6) / 2.2)) } : null;
    const r3 = { kind: t > 4.5 ? "researcher_run" : "researcher", ...(t < 6.8 ? IN.r3 : lerpP(IN.r3, IN.r3end, (t - 6.8) / 2.6)) };
    for (const r of [r1, r2, r3]) if (r) extra.push(r);
    // 시체는 gore 플래그로 Fps 가 그림 (BODIES 첫 둘)
    // 괴물 경로
    let m = null, still = false;
    if (t >= 5.0 && t < 5.5) m = lerpP(IN.cell, IN.cellDoor, (t - 5.0) / 0.5);
    else if (t >= 5.5 && t < 6.0) m = lerpP(IN.cellDoor, IN.door, (t - 5.5) / 0.5);
    else if (t >= 6.0 && t < 6.4) m = lerpP(IN.door, IN.m1, (t - 6.0) / 0.4);
    else if (t >= 6.4 && t < 7.4) { m = IN.m1; still = true; }
    else if (t >= 7.4 && t < 8.8) m = lerpP(IN.m1, IN.m2, (t - 7.4) / 1.4);
    else if (t >= 8.8 && t < 9.8) { m = IN.m2; still = true; }
    else if (t >= 9.8) m = lerpP(IN.m2, IN.lunge, (t - 9.8) / 1.7);
    if (m) extra.push({ kind: "monster", x: m.x, y: m.y, frame: still ? (Math.floor(now / 160) % 3 ? 3 : 0) : [0, 1, 0, 2][Math.floor(now / 110) % 4] });
    if (t >= 6.4) extra.push({ kind: "body", x: INTRO.kill1[0], y: INTRO.kill1[1] });
    if (t >= 8.8) extra.push({ kind: "body2", x: INTRO.kill2[0], y: INTRO.kill2[1] });
    const sh = I.shake * 14;
    ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    const cam = { x: IN.cam.x, y: IN.cam.y, a: IN.cam.a + (t > 9.8 ? Math.sin(t * 30) * 0.01 : 0) };
    // 전등 깜빡임: 깨진 뒤엔 불안정
    const amb = I.ambient * (I.ambient < 0.9 && Math.random() < 0.15 ? 0.4 : 1);
    Fps.render(ctx, W, H, { pos: cam, fuses, fmask: 0, exitOpen: false, flicker: I.ambient < 0.2 ? 0.6 : 0.15, monster: { state: "sleep" }, others: [], now, downed: false, moving: false, pitch: 0, gore: false, ambient: amb, extra, noHand: true });
    ctx.restore();
    if (I.red > 0 && t >= 3 && t < 11.5) { ctx.fillStyle = `rgba(255,0,0,${0.08 + I.red * 0.14})`; ctx.fillRect(0, 0, W, H); }
    if (I.flash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, I.flash)})`; ctx.fillRect(0, 0, W, H); }
    // 스파크
    if (I.ambient < 0.9 && Math.random() < 0.5) { ctx.fillStyle = "#ffd98a"; for (let i = 0; i < 6; i++) ctx.fillRect(W * (0.3 + Math.random() * 0.4), H * 0.1 + Math.random() * H * 0.25, 2, 2 + Math.random() * 8); }
    drawIntroText(ctx, I, 0.12);
    // 레터박스
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H * 0.07); ctx.fillRect(0, H * 0.93, W, H * 0.07);
    postFx(ctx, now);
  }
  function drawIntroText(c, I, yFrac) {
    if (!I.text) return;
    c.textAlign = "center";
    c.fillStyle = I.text.startsWith("⚠") ? "#ff4a4a" : "#e8e2d6";
    c.font = `bold ${Math.min(W, H) * 0.05}px sans-serif`; c.fillText(I.text, W / 2, H * yFrac + Math.min(W, H) * 0.08);
    c.fillStyle = "rgba(232,226,214,0.75)"; c.font = `${Math.min(W, H) * 0.03}px sans-serif`; c.fillText(I.sub, W / 2, H * yFrac + Math.min(W, H) * 0.13);
  }

  // ---------- 루프 ----------
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt, now); render(now);
    raf = requestAnimationFrame(frame);
  }
  function update(dt, now) {
    if (!intro && flashOn < 1) flashOn = Math.min(1, flashOn + dt * 1.4);
    if (dt > 0) { let da = pos.a - prevA; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; turnVel += (da / dt - turnVel) * 0.2; prevA = pos.a; }
    if (intro) { updateIntro(dt, now); for (const o of others.values()) { o.x = o.tx; o.y = o.ty; } mon.x = mon.tx; mon.y = mon.ty; if (now - lastPos > 500) { lastPos = now; Net.sendToHost({ t: "pos", x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), a: +pos.a.toFixed(2) }); } return; }
    let fwd = input.fwd, strafe = input.strafe, turn = 0;
    if (keys["w"] || keys["arrowup"]) fwd += 1; if (keys["s"] || keys["arrowdown"]) fwd -= 1;
    if (keys["a"]) strafe -= 1; if (keys["d"]) strafe += 1;
    if (keys["arrowleft"] || keys["q"]) turn -= 1; if (keys["arrowright"]) turn += 1;
    const canMove = !down && !escaped && !hidden && !modal && !mapOpen && !Options.isOpen && phase === "play";
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
    if (now - lastPos > 100 && !down && !escaped) { lastPos = now; Net.sendToHost({ t: "pos", x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), a: +pos.a.toFixed(2), l: lightOn ? 1 : 0 }); }
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
    const label = !n ? "" : n.kind === "fuse" ? "셀 꺼내기" : n.kind === "breaker" ? (myCarry > 0 ? `셀 넣기 (${myCarry})` : "발전기 가동") : n.kind === "cctv" ? "CCTV" : n.kind === "med" ? "구급상자" : n.kind === "hide" ? "숨기" : n.kind === "unhide" ? "나오기" : "구조 (꾹)";
    b.textContent = !isTouch && label ? (n.kind === "rev" ? "E 꾹 · " : "E · ") + label.replace(" (꾹)", "") : label; b.classList.toggle("on", !!n && !down && !escaped && !modal && phase === "play");
    if (S) {
      const fixed = countBits(S.f);
      const room = MapUtil.roomAt(pos.x, pos.y);
      void fixed;
      el("hud-fuse").textContent = `발전기 ${S.ins || 0}/${S.req} · 손 ${"◆".repeat(myCarry)}${"◇".repeat(Math.max(0, 2 - myCarry))}` + (myMed ? " · ✚" : "") + (S.cc ? ` · CCTV ${S.cc}` : "") + (S.e ? " · 출구 열림" : "") + (room ? ` · ${room.name}` : "");
      el("hud-time").textContent = fmt(S.tm);
      const md = Math.hypot(mon.x - pos.x, mon.y - pos.y);
      el("hud-noise").style.width = (mon.state === "sleep" ? 0 : Math.max(0, 100 - md * 8)) + "%";
      el("hud-safe").textContent = S.safe > 0 ? `아직 조용하다 … ${S.safe}` : "";
      el("hud-team").innerHTML = S.p.map((p, i) => `<span class="${p[4] ? 'dn' : ''} ${p[6] ? 'esc' : ''}" style="color:${colors[i % colors.length]}">${p[6] ? "✓" : p[4] ? "✕" : "●"} ${names[p[0]] || "?"}</span>`).join(" ");
    }
    el("btn-light").classList.toggle("on", lightOn);
    el("lock-hint").style.display = (!isTouch && !locked && !modal && !mapOpen && !Options.isOpen && !escaped && !intro && !down && phase === "play") ? "block" : "none";
    el("toast").style.visibility = mapOpen ? "hidden" : "";
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
    if (intro) { renderIntro(now); return; }
    const sh = fx.shake * 10;
    ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    const view = hidden ? { x: hidden.x + 0.5, y: hidden.y + 0.5, a: hidePrev ? hidePrev.a + Math.PI : pos.a } : pos;
    Fps.render(ctx, W, H, {
      pos: view, fuses, fmask: S ? S.f : 0, exitOpen: !!(S && S.e), flicker: (lightOn || down ? (hidden ? 0.25 : (down ? 0.3 : fx.flicker)) : 0) * flashOn,
      glow: lightOn || down ? 0 : 0.16,
      monster: mon, others: [...others.values()], now, downed: down, moving, pitch: Math.sin(bobT) * (moving ? 4 : 0), gore,
      look: hidden ? 0 : look, turn: hidden ? 0 : turnVel,
      drops: S ? S.dr : null, meds: (window.MEDKITS || []).filter((m, i) => !(S && (S.mk >> i) & 1)),
    });
    ctx.restore();
    if (hidden) drawLockerSlit(ctx);
    if (down) drawDowned(ctx, now);
    postFx(ctx, now);
    if (mapOpen && !fx.jump) drawMap(ctx, now);
    else if (S && S.cc > 0 && !fx.jump && !down) drawCctv(ctx, now);
    if (fx.jump) drawJumpScare(ctx, now);
  }

  // 지도 위 표시: 떨어진 셀(항상), CCTV가 켜져 있으면 남은 장비와 괴물
  function drawMarks(c, ox, oy, u, now) {
    if (S && S.dr) for (const d of S.dr) { c.fillStyle = "#7ff6ff"; c.beginPath(); c.arc(ox + d[0] * u, oy + d[1] * u, Math.max(3, u * 0.55), 0, 7); c.fill(); }
    if (!(S && S.cc > 0)) return;
    for (const f of fuses) if (!((S.f >> f.id) & 1)) { c.fillStyle = "#ffd34a"; c.fillRect(ox + f.x * u, oy + f.y * u, Math.max(3, u), Math.max(3, u)); }
    if (mon.state !== "sleep") { const r = Math.max(4, u * 0.9) * (1 + 0.25 * Math.sin(now / 120)); c.fillStyle = "#ff2a2a"; c.beginPath(); c.arc(ox + mon.x * u, oy + mon.y * u, r, 0, 7); c.fill(); }
  }
  // CCTV가 켜져 있는 동안 오른쪽 위 작은 화면
  function drawCctv(c, now) {
    if (!mapImg) mapImg = buildMap();
    const mw = Math.min(W * 0.34, 300), k = mw / mapImg.width, mh = mapImg.height * k, ox = W - mw - 10, oy = 64;
    c.save(); c.globalAlpha = 0.88; c.fillStyle = "#000"; c.fillRect(ox - 4, oy - 20, mw + 8, mh + 24); c.drawImage(mapImg, ox, oy, mw, mh); c.globalAlpha = 1;
    const u = k * 8;
    drawMarks(c, ox, oy, u, now);
    c.fillStyle = "#9bdcff"; c.beginPath(); c.arc(ox + pos.x * u, oy + pos.y * u, Math.max(3, u * 0.7), 0, 7); c.fill();
    c.fillStyle = Math.floor(now / 500) % 2 ? "#ff4040" : "#bbb"; c.font = "bold 12px ui-monospace, monospace"; c.textAlign = "left"; c.fillText(`● CCTV  ${S.cc}s`, ox, oy - 6);
    c.fillStyle = "rgba(255,255,255,0.05)"; for (let y = oy; y < oy + mh; y += 3) c.fillRect(ox, y, mw, 1);
    c.restore();
  }

  // ---------- 안내도 (M) ----------
  const ROOM_COL = { lab: "#3d3a34", hall: "#2c3035", contain: "#4a2e2e", power: "#2f3a30" };
  function buildMap() {
    const s = 8, c = document.createElement("canvas"); c.width = MAP_W * s; c.height = MAP_H * s;
    const g = c.getContext("2d");
    g.fillStyle = "#0b0c0e"; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = MapUtil.tile(x, y); if (t === "#") continue;
      const r = MapUtil.roomAt(x + 0.5, y + 0.5);
      g.fillStyle = t === "E" ? "#7a2a2a" : r ? ROOM_COL[r.tex] || "#333" : "#333";
      g.fillRect(x * s, y * s, s, s);
    }
    g.font = "bold 11px sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(230,225,215,0.8)";
    for (const r of ROOMS) if (!r.id.startsWith("hall")) g.fillText(r.name, (r.x0 + r.x1 + 1) / 2 * s, (r.y0 + r.y1 + 1) / 2 * s + 4);
    const b = MapUtil.find("B")[0], e = MapUtil.find("E")[0];
    g.fillStyle = "#ffcf4a"; g.fillRect(b.x * s - 2, b.y * s - 2, s + 4, s + 4); g.textAlign = "left"; g.fillText("발전기", b.x * s + s + 4, b.y * s + 7);
    g.textAlign = "center"; g.fillStyle = "#ff6a6a"; g.fillText("보안 출구 ▼", e.x * s + s / 2, e.y * s - 6);
    return c;
  }
  function drawMap(c, now) {
    if (!mapImg) mapImg = buildMap();
    c.fillStyle = "rgba(0,0,0,0.9)"; c.fillRect(0, 0, W, H);
    const k = Math.min((W - 24) / mapImg.width, (H - 130) / mapImg.height);
    const mw = mapImg.width * k, mh = mapImg.height * k, ox = (W - mw) / 2, oy = Math.max(96, (H - mh) / 2 + 30);
    c.drawImage(mapImg, ox, oy, mw, mh);
    const u = k * 8;
    let i = 0;
    for (const [id, o] of others) { i++; if (o.esc) continue; c.fillStyle = o.down ? "#ff4a4a" : colors[(S ? S.p.findIndex(p => p[0] === id) : i) % colors.length]; c.beginPath(); c.arc(ox + o.x * u, oy + o.y * u, Math.max(3, u * 0.5), 0, 7); c.fill(); }
    drawMarks(c, ox, oy, u, now);
    c.save(); c.translate(ox + pos.x * u, oy + pos.y * u); c.rotate(pos.a);
    c.fillStyle = Math.floor(now / 300) % 2 ? "#ffffff" : "#9bdcff";
    const a = Math.max(5, u * 1.4);
    c.beginPath(); c.moveTo(a, 0); c.lineTo(-a * 0.5, -a * 0.6); c.lineTo(-a * 0.2, 0); c.lineTo(-a * 0.5, a * 0.6); c.closePath(); c.fill();
    c.restore();
    c.textAlign = "center"; c.fillStyle = "#e8e2d6"; c.font = `bold ${Math.max(13, Math.min(W, H) * 0.035)}px sans-serif`;
    c.fillText("K-7 지하 연구동 안내도", W / 2, oy - 24);
    c.font = `${Math.max(11, Math.min(W, H) * 0.026)}px sans-serif`; c.fillStyle = "#b9b0a2";
    c.fillText("지도를 보는 동안은 움직일 수 없다 · M 또는 지도 버튼으로 닫기", W / 2, oy - 7);
  }
  function drawLockerSlit(c) {
    if (!slitSnap) slitSnap = document.createElement("canvas");
    if (slitSnap.width !== W || slitSnap.height !== H) { slitSnap.width = W; slitSnap.height = H; }
    const snap = slitSnap; snap.getContext("2d").drawImage(cv, 0, 0);
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
    for (const id of ["hud", "toast", "btn-act", "btn-light"]) el(id).style.visibility = t < 1.5 ? "hidden" : "";
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
