// 1인칭 레이캐스팅 렌더러
window.Fps = (function () {
  let buf, bctx, RW = 320, RH = 180, zbuf = null;
  const FOV = 0.72; // 카메라 평면 반폭 (약 72°)

  function setup(W, H) {
    RW = Math.min(420, Math.max(240, Math.floor(W / 2.6)));
    RH = Math.round(RW * H / W);
    if (!buf) { buf = document.createElement("canvas"); bctx = buf.getContext("2d"); }
    buf.width = RW; buf.height = RH; zbuf = new Float32Array(RW);
    bctx.imageSmoothingEnabled = false;
  }

  function texFor(tx, ty, st) {
    const t = MapUtil.tile(tx, ty);
    const T = Assets.tex;
    if (t === "L") return T.locker;
    if (t === "F") { const f = st.fuses.find(f => f.x === tx && f.y === ty); return f && ((st.fmask >> f.id) & 1) ? T.fuse_on : T.fuse_off; }
    if (t === "B") return st.exitOpen ? T.fuse_on : T.breaker;
    if (t === "E") return st.exitOpen ? T.exit_open : T.exit_closed;
    return ((tx * 7 + ty * 3) % 5 === 0) ? T.wall2 : T.wall;
  }
  function isWall(tx, ty) { const t = MapUtil.tile(tx, ty); return t === "#" || t === "L" || t === "F" || t === "B" || t === "E"; }

  // st: {pos:{x,y,a}, fuses, fmask, exitOpen, flicker, monster:{x,y,state,speed}, others:[...], now, downed}
  function render(ctx, W, H, st) {
    if (!buf || buf.width !== Math.min(420, Math.max(240, Math.floor(W / 2.6)))) setup(W, H);
    const g = bctx;
    const p = st.pos;
    const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    const planeX = -dirY * FOV, planeY = dirX * FOV;
    const flick = st.flicker;
    const pitch = st.pitch || 0; // 세로 흔들림(픽셀)
    const horizon = RH / 2 + pitch;
    const K = RW / (2 * FOV); // 거리 1에서 1단위 길이의 픽셀 수
    const WALL_H = 1.6, EYE = WALL_H / 2;

    // 천장/바닥
    g.fillStyle = "#050506"; g.fillRect(0, 0, RW, RH);
    const fg = g.createLinearGradient(0, horizon, 0, RH);
    fg.addColorStop(0, "#0a0a0a"); fg.addColorStop(0.35, `rgba(${40 * flick | 0},${38 * flick | 0},${34 * flick | 0},1)`); fg.addColorStop(1, `rgba(${70 * flick | 0},${64 * flick | 0},${56 * flick | 0},1)`);
    g.fillStyle = fg; g.fillRect(0, horizon, RW, RH - horizon);
    // 바닥 손전등 웅덩이
    const pool = g.createRadialGradient(RW / 2, RH * 0.95, RW * 0.05, RW / 2, RH * 0.95, RW * 0.55);
    pool.addColorStop(0, `rgba(255,240,200,${0.22 * flick})`); pool.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = pool; g.fillRect(0, horizon, RW, RH - horizon);
    // 바닥 타일 느낌 (가로선)
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 1; i < 30; i++) { const y = horizon + K * WALL_H / 2 / i; if (y > RH) continue; g.fillRect(0, y, RW, 1); }

    // 벽
    for (let x = 0; x < RW; x++) {
      const camX = 2 * x / RW - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mx = Math.floor(p.x), my = Math.floor(p.y);
      const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
      let sx, sy, sdx, sdy;
      if (rdx < 0) { sx = -1; sdx = (p.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - p.x) * ddx; }
      if (rdy < 0) { sy = -1; sdy = (p.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - p.y) * ddy; }
      let side = 0, hit = false, guard = 0;
      while (!hit && guard++ < 120) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (isWall(mx, my)) hit = true;
      }
      const perp = side === 0 ? (sdx - ddx) : (sdy - ddy);
      zbuf[x] = perp;
      const lineH = K * WALL_H / Math.max(0.0001, perp);
      const top = horizon - K * (WALL_H - EYE) / Math.max(0.0001, perp);
      let wallX = side === 0 ? p.y + perp * rdy : p.x + perp * rdx; wallX -= Math.floor(wallX);
      const tx = texFor(mx, my, st);
      const tw = tx.width, th = tx.height;
      let texX = Math.floor(wallX * tw);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = tw - texX - 1;
      g.drawImage(tx, texX, 0, 1, th, x, top, 1, lineH);
      let b = brightness(camX, perp, flick) * (side ? 0.72 : 1);
      g.fillStyle = `rgba(0,0,0,${1 - b})`; g.fillRect(x, top, 1, lineH);
    }

    // 스프라이트
    const sprites = [];
    if (st.monster && st.monster.state !== "sleep") sprites.push({ kind: "monster", x: st.monster.x, y: st.monster.y });
    for (const o of st.others) if (!o.esc && !o.hid) sprites.push({ kind: o.down ? "mate_down" : "mate", x: o.x, y: o.y, name: o.name, rev: o.rev });
    for (const s of sprites) { const dx = s.x - p.x, dy = s.y - p.y; s.d2 = dx * dx + dy * dy; }
    sprites.sort((a, b) => b.d2 - a.d2);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const s of sprites) {
      const dx = s.x - p.x, dy = s.y - p.y;
      const trX = invDet * (dirY * dx - dirX * dy);
      const trY = invDet * (-planeY * dx + planeX * dy);
      if (trY <= 0.15) continue;
      const scrX = (RW / 2) * (1 + trX / trY);
      let img, scale, yoff;
      if (s.kind === "monster") { const f = Math.floor(st.now / (st.monster.speed > 0.2 ? 140 : 420)) % 4; img = Assets.spr.monster[f]; scale = 2.5; yoff = 0; }
      else if (s.kind === "mate") { img = Assets.spr.mate; scale = 1.5; yoff = 0; }
      else { img = Assets.spr.mate_down; scale = 0.9; yoff = 0; }
      const sh = (K / trY) * scale;
      const sw = sh * img.width / img.height;
      const bottom = horizon + K * EYE / trY; // 바닥 접점
      const top = bottom - sh + yoff;
      const x0 = Math.floor(scrX - sw / 2), x1 = Math.ceil(scrX + sw / 2);
      const camX = trX / trY;
      const b = brightness(camX, trY, flick);
      if (b < 0.03 && s.kind !== "monster") continue;
      for (let x = Math.max(0, x0); x < Math.min(RW, x1); x++) {
        if (trY >= zbuf[x]) continue;
        const texX = Math.floor((x - x0) / (x1 - x0) * img.width);
        g.drawImage(img, texX, 0, 1, img.height, x, top, 1, sh);
      }
      // 어둡게 (스프라이트 영역만) — 클리핑으로
      if (b < 0.98) {
        g.save(); g.beginPath();
        for (let x = Math.max(0, x0); x < Math.min(RW, x1); x++) if (trY < zbuf[x]) g.rect(x, top, 1, sh);
        g.clip(); g.globalCompositeOperation = "source-atop"; g.fillStyle = `rgba(0,0,0,${1 - b})`; g.fillRect(0, 0, RW, RH); g.restore();
      }
      // 괴물: 어둠 속에서도 눈은 보인다
      if (s.kind === "monster" && trY > 5 && Math.abs(camX) < 1.1) {
        const ex = scrX, ey = top + sh * 0.1;
        const a = 0.4 + 0.5 * Math.sin(st.now / 250) ** 2;
        g.fillStyle = `rgba(230,230,255,${a})`; g.fillRect(ex - sw * 0.07, ey, Math.max(1, sw * 0.02), Math.max(1, sw * 0.02)); g.fillRect(ex + sw * 0.05, ey, Math.max(1, sw * 0.02), Math.max(1, sw * 0.02));
      }
      if (s.name && trY < 6 && b > 0.1) { g.fillStyle = `rgba(255,255,255,${0.8 * b})`; g.font = `${Math.max(7, 10 * RW / 320)}px sans-serif`; g.textAlign = "center"; g.fillText(s.name, scrX, Math.max(8, top - 3)); if (s.rev > 0) { g.fillStyle = "#222"; g.fillRect(scrX - 15, top - 14, 30, 3); g.fillStyle = "#9bff7a"; g.fillRect(scrX - 15, top - 14, 30 * Math.min(1, s.rev / 3), 3); } }
    }

    // 좌우 가장자리 어둠 (손전등 원뿔)
    const side = g.createLinearGradient(0, 0, RW, 0);
    side.addColorStop(0, "rgba(0,0,0,0.92)"); side.addColorStop(0.22, `rgba(0,0,0,${0.55 - flick * 0.2})`); side.addColorStop(0.5, "rgba(0,0,0,0)"); side.addColorStop(0.78, `rgba(0,0,0,${0.55 - flick * 0.2})`); side.addColorStop(1, "rgba(0,0,0,0.92)");
    g.fillStyle = side; g.fillRect(0, 0, RW, RH);
    const vert = g.createLinearGradient(0, 0, 0, RH);
    vert.addColorStop(0, "rgba(0,0,0,0.85)"); vert.addColorStop(0.35, "rgba(0,0,0,0)"); vert.addColorStop(1, "rgba(0,0,0,0.2)");
    g.fillStyle = vert; g.fillRect(0, 0, RW, RH);

    // 손전등 든 손
    if (!st.downed) drawHand(g, RW, RH, st, flick);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, W, H);
  }
  function brightness(camX, dist, flick) {
    const cone = Math.max(0.05, 1 - camX * camX * 0.85);
    const fog = Math.min(1, 1.7 / (0.5 + dist * 0.5));
    return Math.max(0, Math.min(1, cone * fog * flick));
  }
  function drawHand(g, RW, RH, st, flick) {
    const bob = Math.sin(st.now / 180) * (st.moving ? 3 : 0.6) * RW / 320;
    const bx = RW * 0.72 + Math.cos(st.now / 360) * (st.moving ? 2 : 0), by = RH * 0.86 + bob;
    g.save(); g.translate(bx, by); g.rotate(-0.25);
    // 팔
    g.fillStyle = "#14151a"; g.beginPath(); g.moveTo(-RW * 0.05, RH * 0.3); g.lineTo(RW * 0.14, RH * 0.3); g.lineTo(RW * 0.08, -RH * 0.02); g.lineTo(-RW * 0.02, 0); g.closePath(); g.fill();
    // 손
    g.fillStyle = "#b9a48e"; g.beginPath(); g.ellipse(RW * 0.03, 0, RW * 0.05, RH * 0.05, 0.2, 0, 7); g.fill();
    g.fillStyle = "#9d8974"; for (let i = 0; i < 4; i++) g.fillRect(-RW * 0.01 + i * RW * 0.018, -RH * 0.04, RW * 0.014, RH * 0.05);
    // 손전등
    g.fillStyle = "#3a3c42"; g.fillRect(-RW * 0.02, -RH * 0.12, RW * 0.045, RH * 0.14);
    g.fillStyle = "#55585f"; g.fillRect(-RW * 0.03, -RH * 0.17, RW * 0.065, RH * 0.06);
    g.fillStyle = `rgba(255,246,210,${0.75 * flick})`; g.fillRect(-RW * 0.03, -RH * 0.175, RW * 0.065, RH * 0.012);
    g.restore();
  }
  return { render, setup };
})();
