// 텍스처와 스프라이트 — 기본은 코드로 생성, img/ 폴더에 같은 이름의 PNG가 있으면 그걸 우선 사용
// 교체 가능한 파일: img/wall.png img/locker.png img/fuse_off.png img/fuse_on.png img/breaker.png img/exit_closed.png img/exit_open.png
//                 img/monster_0.png ~ img/monster_3.png (세로로 긴 투명 PNG, 4프레임) img/mate.png img/mate_down.png img/scare.png
window.Assets = (function () {
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
  function wallBase(c, tint) {
    const g = c.getContext("2d");
    g.fillStyle = tint; g.fillRect(0, 0, TEX, TEX);
    // 타일 줄눈
    g.fillStyle = "rgba(0,0,0,0.45)";
    for (let y = 0; y < TEX; y += 16) { g.fillRect(0, y, TEX, 1); const off = (y / 16) % 2 ? 16 : 0; for (let x = off; x < TEX; x += 32) g.fillRect(x, y, 1, 16); }
    // 얼룩
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${20 + rng() * 30},${10 + rng() * 20},${10 + rng() * 15},${0.15 + rng() * 0.3})`; g.beginPath(); g.ellipse(rng() * TEX, rng() * TEX, 4 + rng() * 12, 3 + rng() * 10, rng() * 3, 0, 7); g.fill(); }
    // 흘러내린 자국
    for (let i = 0; i < 3; i++) { const x = rng() * TEX; g.fillStyle = "rgba(10,5,5,0.35)"; g.fillRect(x, rng() * 20, 1 + rng() * 2, 20 + rng() * 40); }
    noise(g, TEX, TEX, 0.18, 0);
    return c;
  }
  function makeTextures() {
    tex.wall = wallBase(cv(TEX, TEX), "#4a5048");
    tex.wall2 = wallBase(cv(TEX, TEX), "#524c44");
    // 사물함
    { const c = cv(TEX, TEX), g = c.getContext("2d"); g.fillStyle = "#3a4654"; g.fillRect(0, 0, TEX, TEX);
      for (const x of [2, 34]) { g.fillStyle = "#2a333d"; g.fillRect(x, 2, 28, 60); g.fillStyle = "#1a2129"; for (let i = 0; i < 4; i++) g.fillRect(x + 6, 8 + i * 4, 16, 1.5); g.fillStyle = "#6a7784"; g.fillRect(x + 22, 30, 3, 6); g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(x, 2, 1, 60); g.fillRect(x + 27, 2, 1, 60); }
      noise(g, TEX, TEX, 0.12, 0); tex.locker = c; }
    // 퓨즈/부품 상자
    const fuse = on => { const c = wallBase(cv(TEX, TEX), "#4a5048"), g = c.getContext("2d");
      g.fillStyle = "#30333a"; g.fillRect(14, 12, 36, 40); g.fillStyle = "#1b1d22"; g.fillRect(17, 15, 30, 34);
      g.fillStyle = on ? "#2b6a35" : "#6a1d1d"; g.fillRect(20, 18, 24, 14);
      g.fillStyle = on ? "#7dff8f" : "#ff3b3b"; g.beginPath(); g.arc(32, 40, 3.5, 0, 7); g.fill();
      if (!on) { g.fillStyle = "#ffd34a"; g.font = "bold 12px sans-serif"; g.textAlign = "center"; g.fillText("?", 32, 29); }
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(14, 12, 36, 2); return c; };
    tex.fuse_off = fuse(false); tex.fuse_on = fuse(true);
    // 발전기 패널
    { const c = wallBase(cv(TEX, TEX), "#3e4140"), g = c.getContext("2d"); g.fillStyle = "#2a2c30"; g.fillRect(4, 6, 56, 54); g.fillStyle = "#15171a"; g.fillRect(7, 9, 50, 48);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? "#5a1414" : "#3a3a3a"; g.fillRect(10 + i * 8, 14, 5, 12); }
      g.fillStyle = "#777"; g.fillRect(10, 32, 44, 2); g.fillRect(10, 38, 44, 2); g.fillStyle = "#c33"; g.fillRect(24, 44, 16, 9); g.fillStyle = "#ddd"; g.font = "7px sans-serif"; g.textAlign = "center"; g.fillText("GEN", 32, 51);
      tex.breaker = c; }
    // 출구 문
    const door = open => { const c = cv(TEX, TEX), g = c.getContext("2d"); g.fillStyle = open ? "#1e4a26" : "#4a1a1a"; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(31, 0, 2, TEX); g.fillRect(0, 0, TEX, 2); g.fillRect(0, 62, TEX, 2);
      g.fillStyle = "#8a8a8a"; g.fillRect(26, 34, 4, 2); g.fillRect(34, 34, 4, 2);
      g.fillStyle = open ? "#7dff8f" : "#ff5a5a"; g.fillRect(16, 6, 32, 10); g.fillStyle = "#000"; g.font = "bold 8px sans-serif"; g.textAlign = "center"; g.fillText("EXIT", 32, 14);
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

  function tryImage(name, cb) {
    const im = new Image(); im.onload = () => cb(im); im.onerror = () => {}; im.src = "img/" + name + ".png";
  }
  function init() {
    makeTextures();
    spr.monster = [0, 1, 2, 3].map(monsterFrame);
    spr.mate = mateSprite(false); spr.mate_down = mateSprite(true);
    // 외부 이미지가 있으면 교체
    for (const k of Object.keys(tex)) tryImage(k, im => { tex[k] = im; });
    [0, 1, 2, 3].forEach(i => tryImage("monster_" + i, im => { spr.monster[i] = im; }));
    tryImage("mate", im => { spr.mate = im; }); tryImage("mate_down", im => { spr.mate_down = im; });
    tryImage("scare", im => { spr.scare = im; });
  }
  return { init, tex, spr, TEX };
})();
