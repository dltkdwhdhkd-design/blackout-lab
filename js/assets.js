// 텍스처와 스프라이트 — 기본은 코드로 생성, img/ 폴더에 같은 이름의 PNG가 있으면 그걸 우선 사용
// 교체 가능한 파일 목록은 docs/art-requests.md 참고
window.Assets = (function () {
  const PROVIDED = ["monster_0", "monster_1", "monster_2", "monster_3", "scare"];
  const TEX = 64;
  const tex = {}, spr = {};
  let rng = mulberry(7);
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function noise(ctx, w, h, alpha, dark) {
    const img = ctx.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rng() - 0.5) * alpha * 255; d[i] = clamp(d[i] + n - dark); d[i + 1] = clamp(d[i + 1] + n - dark); d[i + 2] = clamp(d[i + 2] + n - dark); }
    ctx.putImageData(img, 0, 0);
  }
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

  // ---------- 벽 텍스처 ----------
  function grime(g, n, dark) {
    for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${20 + rng() * 30},${15 + rng() * 20},${10 + rng() * 15},${0.1 + rng() * 0.25})`; g.beginPath(); g.ellipse(rng() * TEX, rng() * TEX, 4 + rng() * 12, 3 + rng() * 10, rng() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 3; i++) { const x = rng() * TEX; g.fillStyle = "rgba(10,5,5,0.3)"; g.fillRect(x, rng() * 20, 1 + rng() * 2, 20 + rng() * 40); }
  }
  // 실험실: 흰 타일 벽, 아래쪽 띠
  function labWall(blood) {
    const c = cv(TEX, TEX), g = c.getContext("2d");
    g.fillStyle = "#b9b6ac"; g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let y = 0; y < TEX; y += 12) { g.fillRect(0, y, TEX, 1); const off = (y / 12) % 2 ? 12 : 0; for (let x = off; x < TEX; x += 24) g.fillRect(x, y, 1, 12); }
    g.fillStyle = "#5f6b61"; g.fillRect(0, 50, TEX, 14); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, 50, TEX, 1);
    grime(g, 5, 0);
    if (blood) {
      for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(${90 + rng() * 40},${5 + rng() * 10},${5 + rng() * 10},0.85)`; g.beginPath(); g.ellipse(rng() * TEX, 10 + rng() * 30, 5 + rng() * 10, 4 + rng() * 8, rng() * 3, 0, 7); g.fill();
        for (let k = 0; k < 4; k++) { const x = rng() * TEX; g.fillRect(x, 20 + rng() * 10, 1 + rng() * 2, 10 + rng() * 30); } }
      // 손자국
      g.fillStyle = "rgba(110,10,10,0.7)"; const hx = 10 + rng() * 40, hy = 20 + rng() * 20; g.beginPath(); g.ellipse(hx, hy + 6, 5, 7, 0, 0, 7); g.fill(); for (let f = 0; f < 4; f++) g.fillRect(hx - 5 + f * 3, hy - 8, 1.6, 9);
    }
    noise(g, TEX, TEX, 0.14, 0);
    return c;
  }
  // 격리실: 콘크리트 + 경고 띠
  function containWall() {
    const c = cv(TEX, TEX), g = c.getContext("2d");
    g.fillStyle = "#5a5a58"; g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(0, 31, TEX, 2); g.fillRect(31, 0, 2, TEX);
    for (let i = 0; i < 8; i++) { g.fillStyle = "#d8b21a"; g.beginPath(); g.moveTo(i * 16 - 8, 46); g.lineTo(i * 16, 46); g.lineTo(i * 16 - 8, 58); g.lineTo(i * 16 - 16, 58); g.closePath(); g.fill(); }
    g.fillStyle = "#151515"; g.fillRect(0, 44, TEX, 2); g.fillRect(0, 58, TEX, 2);
    g.fillStyle = "#c33"; g.font = "bold 7px sans-serif"; g.textAlign = "center"; g.fillText("K-7", 32, 20);
    grime(g, 6, 0); noise(g, TEX, TEX, 0.16, 0); return c;
  }
  // 복도: 회색 패널
  function hallWall() {
    const c = cv(TEX, TEX), g = c.getContext("2d");
    g.fillStyle = "#6a6e70"; g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "#5a5e60"; g.fillRect(2, 2, 60, 28); g.fillRect(2, 34, 60, 28);
    g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(2, 2, 60, 1); g.fillRect(2, 34, 60, 1);
    g.fillStyle = "#2d3a44"; g.fillRect(0, 30, TEX, 3);
    grime(g, 4, 0); noise(g, TEX, TEX, 0.12, 0); return c;
  }
  // 발전기실/창고: 어두운 금속
  function powerWall() {
    const c = cv(TEX, TEX), g = c.getContext("2d");
    g.fillStyle = "#3b3f3e"; g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < TEX; y += 16) g.fillRect(0, y, TEX, 2);
    g.fillStyle = "#6a6e6c"; for (let y = 4; y < TEX; y += 16) for (let x = 4; x < TEX; x += 20) g.fillRect(x, y, 2, 2);
    g.fillStyle = "#7a5a1a"; g.fillRect(10, 20, 44, 6); g.fillStyle = "#111"; g.font = "5px sans-serif"; g.textAlign = "center"; g.fillText("HIGH VOLTAGE", 32, 25);
    grime(g, 5, 0); noise(g, TEX, TEX, 0.14, 0); return c;
  }
  function makeTextures() {
    tex.wall = labWall(false); tex.wall2 = labWall(false); tex.wall_blood = labWall(true);
    tex.contain = containWall(); tex.contain_blood = (() => { const c = containWall(), g = c.getContext("2d"); for (let i = 0; i < 4; i++) { g.fillStyle = "rgba(110,8,8,0.85)"; g.beginPath(); g.ellipse(rng() * TEX, rng() * 40, 6 + rng() * 10, 5 + rng() * 8, 0, 0, 7); g.fill(); } return c; })();
    tex.hall = hallWall(); tex.hall_blood = (() => { const c = hallWall(), g = c.getContext("2d"); for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(110,8,8,0.8)"; g.beginPath(); g.ellipse(rng() * TEX, 10 + rng() * 30, 6 + rng() * 10, 5 + rng() * 8, 0, 0, 7); g.fill(); for (let k = 0; k < 3; k++) g.fillRect(rng() * TEX, 25, 1.5, 10 + rng() * 30); } return c; })();
    tex.power = powerWall();
    // 사물함
    { const c = cv(TEX, TEX), g = c.getContext("2d"); g.fillStyle = "#3a4654"; g.fillRect(0, 0, TEX, TEX);
      for (const x of [2, 34]) { g.fillStyle = "#2a333d"; g.fillRect(x, 2, 28, 60); g.fillStyle = "#1a2129"; for (let i = 0; i < 4; i++) g.fillRect(x + 6, 8 + i * 4, 16, 1.5); g.fillStyle = "#6a7784"; g.fillRect(x + 22, 30, 3, 6); g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(x, 2, 1, 60); g.fillRect(x + 27, 2, 1, 60); }
      noise(g, TEX, TEX, 0.12, 0); tex.locker = c; }
    // 보안 출구 문
    const door = open => { const c = cv(TEX, TEX), g = c.getContext("2d"); g.fillStyle = "#4a4e52"; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = open ? "#1e4a26" : "#4a1a1a"; g.fillRect(6, 4, 52, 60);
      g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(31, 4, 2, 60);
      g.fillStyle = "#8a8a8a"; g.fillRect(24, 34, 5, 2); g.fillRect(35, 34, 5, 2);
      g.fillStyle = open ? "#7dff8f" : "#ff5a5a"; g.fillRect(14, 8, 36, 10); g.fillStyle = "#000"; g.font = "bold 7px sans-serif"; g.textAlign = "center"; g.fillText(open ? "OPEN" : "LOCKED", 32, 15);
      noise(g, TEX, TEX, 0.1, 0); return c; };
    tex.exit_closed = door(false); tex.exit_open = door(true);
  }

  // ---------- 스프라이트 ----------
  function monsterFrame(k) {
    const W = 160, H = 360, c = cv(W, H), g = c.getContext("2d");
    const j = (s = 1) => (rng() - 0.5) * 6 * s;
    const cx = 80, feet = 350;
    const h = 300, wd = 44;
    const twitch = k === 3 ? 0.18 : (k - 1.5) * 0.03;
    g.save(); g.translate(cx, feet); g.rotate(twitch);
    // 다리: 거꾸로 꺾임
    g.strokeStyle = "#17171c"; g.lineWidth = 10; g.lineCap = "round"; g.lineJoin = "round";
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * wd * 0.25, -h * 0.42); g.lineTo(sd * wd * 0.7 + j(), -h * 0.26 + j()); g.lineTo(sd * wd * 0.3 + j(), -h * 0.06); g.lineTo(sd * wd * 0.6 + j(), 0); g.stroke(); }
    // 몸통
    const bg = g.createLinearGradient(0, -h, 0, -h * 0.4); bg.addColorStop(0, "#2a2a33"); bg.addColorStop(1, "#0e0e12");
    g.fillStyle = bg; g.beginPath();
    g.moveTo(-wd * 0.5, -h * 0.4); g.quadraticCurveTo(-wd * 0.95 + j(), -h * 0.75, -wd * 0.2 + j(), -h * 0.98);
    g.lineTo(wd * 0.4 + j(), -h * 0.93); g.quadraticCurveTo(wd * 0.7, -h * 0.65, wd * 0.45 + j(), -h * 0.4); g.closePath(); g.fill();
    // 갈비
    g.strokeStyle = "rgba(170,160,145,0.4)"; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const y = -h * (0.48 + i * 0.065); g.beginPath(); g.moveTo(-wd * 0.4, y); g.quadraticCurveTo(0, y + 8, wd * 0.4, y); g.stroke(); }
    // 팔
    g.strokeStyle = "#17171c"; g.lineWidth = 8;
    for (const sd of [-1, 1]) {
      let x = sd * wd * 0.45, y = -h * 0.86; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += sd * wd * 0.3 + j(2); y += h * 0.25 + j(); g.lineTo(x, y); }
      g.stroke();
      g.strokeStyle = "#cfc6b8"; g.lineWidth = 2.5;
      for (let f = 0; f < 5; f++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sd * (f - 2) * 5, y + 18, x + sd * (f - 2) * 8 + j(), y + 36 + j(3)); g.stroke(); }
      g.strokeStyle = "#17171c"; g.lineWidth = 8;
    }
    // 목·머리
    const hx = -wd * 0.1 + j(), hy = -h * 1.1 + j();
    g.strokeStyle = "#111014"; g.lineWidth = 11; g.beginPath(); g.moveTo(-wd * 0.05, -h * 0.96); g.lineTo(hx, hy + 22); g.stroke();
    g.save(); g.translate(hx, hy); g.rotate(0.4 + twitch * 3 + (k === 3 ? 1.1 : 0));
    const sg = g.createRadialGradient(-6, -12, 2, 0, 0, 40); sg.addColorStop(0, "#ece5d9"); sg.addColorStop(0.6, "#b4aa9c"); sg.addColorStop(1, "#3b3531");
    g.fillStyle = sg; g.beginPath(); g.ellipse(0, 0, 24, 38, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(70,20,20,0.5)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo((rng() - 0.5) * 30, (rng() - 0.5) * 50); g.lineTo((rng() - 0.5) * 30, (rng() - 0.5) * 50); g.lineWidth = 1; g.strokeStyle = "rgba(70,10,10,0.6)"; g.stroke(); }
    g.fillStyle = "#030203";
    g.beginPath(); g.ellipse(-9, -11, 6, 9, 0.3, 0, 7); g.fill();
    g.beginPath(); g.ellipse(8, -7, 7.5, 11, -0.2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(1, 19, 7, 15 + (k % 2) * 4, 0, 0, 7); g.fill();
    g.fillStyle = "#b9ae9d"; for (let t = 0; t < 6; t++) g.fillRect(-5 + t * 2, 7, 1.2, 4 + (t % 2) * 2);
    g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(-10, -12, 2, 2); g.fillRect(8, -9, 2, 2);
    g.restore();
    g.restore();
    // 주변을 갉아먹는 검은 결
    g.fillStyle = "rgba(0,0,0,0.7)"; for (let i = 0; i < 14; i++) g.fillRect(rng() * W, rng() * H, 10 + rng() * 40, 1 + rng() * 3);
    return c;
  }
  function mateSprite(downed) {
    const W = 96, H = 200, c = cv(W, H), g = c.getContext("2d");
    if (downed) {
      g.save(); g.translate(48, 170);
      g.fillStyle = "#2a2a30"; g.beginPath(); g.ellipse(0, 0, 44, 14, 0, 0, 7); g.fill();
      g.fillStyle = "#3b3b45"; g.beginPath(); g.ellipse(-6, -6, 30, 12, 0, 0, 7); g.fill();
      g.fillStyle = "#e6d2bd"; g.beginPath(); g.arc(30, -4, 9, 0, 7); g.fill();
      g.fillStyle = "#1b1b1f"; g.beginPath(); g.ellipse(30, -9, 9, 5, 0, 0, 7); g.fill();
      g.restore(); return c;
    }
    // 서 있는 학생: 후드, 손전등
    g.fillStyle = "rgba(0,0,0,0.5)"; g.beginPath(); g.ellipse(48, 192, 22, 6, 0, 0, 7); g.fill();
    g.fillStyle = "#23252c"; g.fillRect(36, 120, 10, 70); g.fillRect(50, 120, 10, 70);
    g.fillStyle = "#1b1c21"; g.fillRect(32, 184, 16, 8); g.fillRect(48, 184, 16, 8);
    const jg = g.createLinearGradient(0, 60, 0, 130); jg.addColorStop(0, "#3d4150"); jg.addColorStop(1, "#262933");
    g.fillStyle = jg; g.beginPath(); g.moveTo(28, 70); g.lineTo(68, 70); g.lineTo(66, 128); g.lineTo(30, 128); g.closePath(); g.fill();
    g.fillStyle = "#30343f"; g.fillRect(20, 72, 12, 46); g.fillRect(64, 72, 12, 40);
    g.fillStyle = "#e6d2bd"; g.fillRect(21, 116, 10, 10); g.beginPath(); g.arc(70, 112, 6, 0, 7); g.fill();
    // 손전등
    g.fillStyle = "#777"; g.fillRect(66, 106, 18, 8); g.fillStyle = "#fff8d0"; g.fillRect(82, 104, 5, 12);
    const lg = g.createRadialGradient(86, 110, 2, 86, 110, 40); lg.addColorStop(0, "rgba(255,245,200,0.6)"); lg.addColorStop(1, "rgba(255,245,200,0)"); g.fillStyle = lg; g.fillRect(40, 70, 56, 80);
    // 후드와 얼굴
    g.fillStyle = "#3d4150"; g.beginPath(); g.ellipse(48, 52, 20, 24, 0, 0, 7); g.fill();
    g.fillStyle = "#e6d2bd"; g.beginPath(); g.ellipse(48, 56, 12, 15, 0, 0, 7); g.fill();
    g.fillStyle = "#2a1e18"; g.beginPath(); g.ellipse(48, 46, 13, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#222"; g.fillRect(43, 56, 3, 3); g.fillRect(51, 56, 3, 3);
    return c;
  }

  // 실험실 단말기 (에너지 셀 보관) — 바닥에 선 기계
  function consoleSprite(on) {
    const W = 140, H = 220, c = cv(W, H), g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.ellipse(70, 210, 55, 10, 0, 0, 7); g.fill();
    // 몸체
    const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, "#3a3f46"); bg.addColorStop(0.5, "#5a6068"); bg.addColorStop(1, "#2e3238");
    g.fillStyle = bg; g.fillRect(25, 90, 90, 118);
    g.fillStyle = "#23262b"; g.fillRect(25, 200, 90, 8); g.fillRect(25, 90, 90, 4);
    // 기울어진 패널
    g.fillStyle = "#4a5058"; g.beginPath(); g.moveTo(20, 92); g.lineTo(120, 92); g.lineTo(112, 40); g.lineTo(28, 40); g.closePath(); g.fill();
    // 화면
    const sc = on ? "#1b3a2a" : "#101214"; g.fillStyle = sc; g.fillRect(36, 48, 68, 36);
    if (on) { g.fillStyle = "#6dff9a"; g.font = "bold 9px monospace"; g.textAlign = "left"; g.fillText("CELL READY", 40, 60); g.fillStyle = "#3fa86a"; for (let i = 0; i < 5; i++) g.fillRect(40, 66 + i * 3, 20 + rng() * 40, 1.5);
      const gl = g.createRadialGradient(70, 66, 5, 70, 66, 70); gl.addColorStop(0, "rgba(100,255,150,0.35)"); gl.addColorStop(1, "rgba(100,255,150,0)"); g.fillStyle = gl; g.fillRect(0, 0, W, 130); }
    else { g.fillStyle = "#3a1414"; g.font = "bold 8px monospace"; g.textAlign = "left"; g.fillText("CELL REMOVED", 40, 66); }
    // 셀 슬롯
    g.fillStyle = "#1a1c20"; g.fillRect(45, 110, 50, 60);
    if (on) { const cg = g.createLinearGradient(0, 115, 0, 165); cg.addColorStop(0, "#9ff0ff"); cg.addColorStop(1, "#1e8fa8"); g.fillStyle = cg; g.fillRect(55, 116, 30, 48); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(58, 118, 4, 44); }
    g.fillStyle = "#777"; for (let i = 0; i < 3; i++) g.fillRect(30, 180 + i * 6, 80, 1.5);
    // 라벨
    g.fillStyle = "#d8b21a"; g.fillRect(28, 96, 30, 8); g.fillStyle = "#111"; g.font = "6px sans-serif"; g.fillText("ENERGY", 30, 102);
    return c;
  }
  // 비상 발전기
  function generatorSprite(on) {
    const W = 300, H = 220, c = cv(W, H), g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.ellipse(150, 208, 140, 12, 0, 0, 7); g.fill();
    const bg = g.createLinearGradient(0, 60, 0, 200); bg.addColorStop(0, "#5a5f5a"); bg.addColorStop(1, "#2a2d2a");
    g.fillStyle = bg; g.fillRect(20, 70, 260, 135);
    g.fillStyle = "#d8b21a"; g.fillRect(20, 70, 260, 10); g.fillStyle = "#111"; for (let i = 0; i < 13; i++) g.fillRect(20 + i * 20, 70, 10, 10);
    // 엔진 블록
    g.fillStyle = "#3a3d3a"; g.fillRect(40, 90, 120, 100); g.fillStyle = "#222"; for (let i = 0; i < 6; i++) g.fillRect(48 + i * 18, 95, 10, 90);
    // 배기관
    g.fillStyle = "#555"; g.fillRect(60, 30, 18, 50); g.fillRect(90, 40, 18, 40);
    // 제어판
    g.fillStyle = "#1e2024"; g.fillRect(180, 90, 85, 100);
    for (let i = 0; i < 3; i++) { g.fillStyle = on ? "#6dff9a" : (i === 0 ? "#ff3b3b" : "#3a1414"); g.beginPath(); g.arc(195 + i * 25, 105, 5, 0, 7); g.fill(); }
    g.fillStyle = "#333"; g.fillRect(190, 120, 65, 30); g.fillStyle = on ? "#6dff9a" : "#8a2020"; g.font = "bold 9px monospace"; g.textAlign = "center"; g.fillText(on ? "RUNNING" : "NO FUEL", 222, 139);
    // 큰 레버
    g.fillStyle = "#777"; g.fillRect(215, 160, 14, 8); g.fillStyle = "#c33"; g.save(); g.translate(222, 164); g.rotate(on ? 0.3 : -1.1); g.fillRect(-4, -34, 8, 36); g.restore();
    // 셀 슬롯 줄
    g.fillStyle = "#101214"; g.fillRect(30, 195, 240, 8);
    if (on) { const gl = g.createRadialGradient(222, 110, 5, 222, 110, 120); gl.addColorStop(0, "rgba(100,255,150,0.3)"); gl.addColorStop(1, "rgba(100,255,150,0)"); g.fillStyle = gl; g.fillRect(0, 0, W, H); }
    return c;
  }
  // 연구원: 흰 가운
  function researcherSprite(pose) {
    const W = 96, H = 200, c = cv(W, H), g = c.getContext("2d");
    if (pose === "dead" || pose === "dead2") {
      // 바닥에 쓰러진 연구원 + 핏자국
      g.fillStyle = "rgba(120,8,8,0.9)"; g.beginPath(); g.ellipse(48, 176, pose === "dead" ? 46 : 40, 14, 0, 0, 7); g.fill();
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(10 + rng() * 76, 160 + rng() * 30, 3 + rng() * 6, 2 + rng() * 4, 0, 0, 7); g.fill(); }
      g.save(); g.translate(48, 170); if (pose === "dead2") g.scale(-1, 1);
      g.fillStyle = "#d9d6cf"; g.beginPath(); g.ellipse(-4, -6, 32, 11, 0.08, 0, 7); g.fill();   // 가운 몸통
      g.fillStyle = "#2a2e38"; g.fillRect(-36, -4, 22, 8);                                      // 다리
      g.fillStyle = "#e6d2bd"; g.beginPath(); g.arc(30, -6, 9, 0, 7); g.fill();                  // 머리
      g.fillStyle = "#2a1e18"; g.beginPath(); g.ellipse(32, -11, 9, 5, 0, 0, 7); g.fill();
      g.fillStyle = "#e6d2bd"; g.fillRect(8, -18, 18, 5);                                        // 팔
      g.fillStyle = "rgba(120,8,8,0.8)"; g.fillRect(-10, -12, 22, 4); g.fillRect(14, -2, 10, 3);  // 가운 핏자국
      g.restore(); return c;
    }
    const run = pose === "run";
    g.fillStyle = "rgba(0,0,0,0.5)"; g.beginPath(); g.ellipse(48, 192, 22, 6, 0, 0, 7); g.fill();
    g.fillStyle = "#2a2e38"; if (run) { g.fillRect(30, 125, 10, 62); g.fillRect(56, 120, 10, 66); } else { g.fillRect(37, 122, 10, 68); g.fillRect(50, 122, 10, 68); }
    g.fillStyle = "#1b1c21"; g.fillRect(28, 184, 16, 8); g.fillRect(54, 184, 16, 8);
    const cg = g.createLinearGradient(0, 60, 0, 140); cg.addColorStop(0, "#eeeae2"); cg.addColorStop(1, "#c9c4b8");
    g.fillStyle = cg; g.beginPath(); g.moveTo(26, 68); g.lineTo(70, 68); g.lineTo(72, 140); g.lineTo(24, 140); g.closePath(); g.fill();
    g.fillStyle = "#3a6ea5"; g.fillRect(43, 70, 10, 50);   // 셔츠/넥타이
    g.fillStyle = "#d8d3c8"; g.fillRect(18, 72, 12, run ? 30 : 48); g.fillRect(66, 72, 12, run ? 26 : 44);
    g.fillStyle = "#e6d2bd"; g.fillRect(19, run ? 100 : 118, 10, 10); g.fillRect(67, run ? 96 : 114, 10, 10);
    g.fillStyle = "#4a7bd0"; g.fillRect(30, 100, 10, 12);   // 명찰
    g.fillStyle = "#e6d2bd"; g.beginPath(); g.ellipse(48, 52, 13, 16, 0, 0, 7); g.fill();
    g.fillStyle = pose === "run" ? "#5a4a3a" : "#2a1e18"; g.beginPath(); g.ellipse(48, 42, 14, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#222"; g.fillRect(43, 52, 3, 3); g.fillRect(52, 52, 3, 3);
    if (run) { g.fillStyle = "#3a1414"; g.beginPath(); g.ellipse(48, 61, 3, 4, 0, 0, 7); g.fill(); } // 벌린 입
    return c;
  }

  function tryImage(name, cb) {
    const im = new Image(); im.onload = () => cb(im); im.onerror = () => {}; im.src = "img/" + name + ".png";
  }
  function init() {
    makeTextures();
    spr.monster = [0, 1, 2, 3].map(monsterFrame);
    spr.mate = mateSprite(false); spr.mate_down = mateSprite(true);
    spr.console_on = consoleSprite(true); spr.console_off = consoleSprite(false);
    spr.generator = generatorSprite(false); spr.generator_on = generatorSprite(true);
    spr.researcher = researcherSprite("stand"); spr.researcher_run = researcherSprite("run");
    spr.body = researcherSprite("dead"); spr.body2 = researcherSprite("dead2");
    // 외부 이미지가 있으면 교체
    // img/ 에 실제로 넣은 파일만 불러온다 (새 그림을 넣으면 여기에 이름을 추가)
    const has = n => PROVIDED.includes(n);
    for (const k of Object.keys(tex)) if (has(k)) tryImage(k, im => { tex[k] = im; });
    [0, 1, 2, 3].forEach(i => { if (has("monster_" + i)) tryImage("monster_" + i, im => { spr.monster[i] = im; }); });
    for (const k of ["mate", "mate_down", "console_on", "console_off", "generator", "generator_on", "researcher", "researcher_run", "body", "body2"]) if (has(k)) tryImage(k, im => { spr[k] = im; });
    if (has("scare")) tryImage("scare", im => { spr.scare = im; });
  }
  return { init, tex, spr, TEX };
})();
