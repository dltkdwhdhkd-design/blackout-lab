// 1인칭 레이캐스팅 렌더러
window.Fps = (function () {
  let buf, bctx, RW = 320, RH = 180, zbuf = null, tmp = null, tctx = null;
  const FOV = 0.72; // 카메라 평면 반폭 (약 72°)

  function setup(W, H) {
    RW = Math.min(420, Math.max(240, Math.floor(W / 2.6)));
    RH = Math.round(RW * H / W);
    if (!buf) { buf = document.createElement("canvas"); bctx = buf.getContext("2d"); }
    buf.width = RW; buf.height = RH; zbuf = new Float32Array(RW);
    bctx.imageSmoothingEnabled = false;
  }

  const TEX_BY_ROOM = { lab: "wall", hall: "hall", contain: "contain", power: "power" };
  function texFor(tx, ty, hx, hy, rdx, rdy, st) {
    const t = MapUtil.tile(tx, ty);
    const T = Assets.tex;
    if (t === "L") return (st.gore && T.locker_blood && (tx * 13 + ty * 7) % 5 === 0) ? T.locker_blood : T.locker;
    if (t === "E") { const k = st.exitOpen ? "exit_open" : "exit_closed"; return (st.gore && T[k + "_blood"]) || T[k]; }
    const room = MapUtil.roomAt(hx - rdx * 0.03, hy - rdy * 0.03);
    let key = room ? (TEX_BY_ROOM[room.tex] || "wall") : "wall";
    if (st.gore && T[key + "_blood"] && ((tx * 31 + ty * 17) % 23 === 0 || (room && room.id === "contain1" && (tx * 7 + ty) % 4 === 0))) key += "_blood";
    return T[key] || T.wall;
  }
  function isWall(tx, ty) { const t = MapUtil.tile(tx, ty); return t === "#" || t === "L" || t === "E"; }
  const BODIES = (window.INTRO ? INTRO.bodies : []).map(b => ({ x: b[0], y: b[1], k: b[2] }));

  // st: {pos:{x,y,a}, fuses, fmask, exitOpen, flicker, monster:{x,y,state,speed}, others:[...], now, downed}
  function render(ctx, W, H, st) {
    if (!buf || buf.width !== Math.min(420, Math.max(240, Math.floor(W / 2.6)))) setup(W, H);
    const g = bctx;
    const p = st.pos;
    const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    const planeX = -dirY * FOV, planeY = dirX * FOV;
    const flick = st.flicker;
    const pitch = st.pitch || 0; // 세로 흔들림(픽셀)
    const horizon = RH / 2 + pitch + (st.look || 0) * RH;
    const K = RW / (2 * FOV); // 거리 1에서 1단위 길이의 픽셀 수
    const WALL_H = 1.6, EYE = WALL_H / 2;

    // 천장/바닥
    const amb = st.ambient || 0;
    g.fillStyle = amb ? `rgb(${60 * amb | 0},${62 * amb | 0},${60 * amb | 0})` : "#050506"; g.fillRect(0, 0, RW, RH);
    const fg = g.createLinearGradient(0, horizon, 0, RH);
    const fl = Math.max(flick * 0.6, amb, (st.glow || 0) * 0.5);
    fg.addColorStop(0, amb ? `rgb(${50 * amb | 0},${50 * amb | 0},${48 * amb | 0})` : "#0a0a0a"); fg.addColorStop(0.35, `rgb(${70 * fl | 0},${68 * fl | 0},${62 * fl | 0})`); fg.addColorStop(1, `rgb(${110 * fl | 0},${104 * fl | 0},${94 * fl | 0})`);
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
      while (!hit && guard++ < 200) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (isWall(mx, my)) hit = true;
      }
      const perp = side === 0 ? (sdx - ddx) : (sdy - ddy);
      zbuf[x] = perp;
      const lineH = K * WALL_H / Math.max(0.0001, perp);
      const top = horizon - K * (WALL_H - EYE) / Math.max(0.0001, perp);
      let wallX = side === 0 ? p.y + perp * rdy : p.x + perp * rdx; wallX -= Math.floor(wallX);
      const tx = texFor(mx, my, p.x + perp * rdx, p.y + perp * rdy, rdx, rdy, st);
      const tw = tx.width, th = tx.height;
      let texX = Math.floor(wallX * tw);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = tw - texX - 1;
      g.drawImage(tx, texX, 0, 1, th, x, top, 1, lineH);
      let b = brightness(camX, perp, flick, st.ambient, st.glow) * (side ? 0.72 : 1);
      g.fillStyle = `rgba(0,0,0,${1 - b})`; g.fillRect(x, top, 1, lineH);
    }

    // 스프라이트
    const sprites = [];
    if (st.monster && st.monster.state !== "sleep") sprites.push({ kind: "monster", x: st.monster.x, y: st.monster.y });
    for (const o of st.others) if (!o.esc && !o.hid) sprites.push({ kind: o.down ? "mate_down" : "mate", x: o.x, y: o.y, name: o.name, rev: o.rev, light: o.light });
    for (const f of st.fuses) sprites.push({ kind: ((st.fmask >> f.id) & 1) ? "console_off" : "console_on", x: f.x + 0.5, y: f.y + 0.5 });
    const bp = MapUtil.find("B")[0]; sprites.push({ kind: st.exitOpen ? "generator_on" : "generator", x: bp.x + 0.5, y: bp.y + 0.5 });
    if (st.gore) for (const bd of BODIES) sprites.push({ kind: bd.k, x: bd.x, y: bd.y });
    if (st.extra) for (const e of st.extra) sprites.push(e);
    for (const s of sprites) { const dx = s.x - p.x, dy = s.y - p.y; s.d2 = dx * dx + dy * dy; }
    sprites.sort((a, b) => b.d2 - a.d2);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const s of sprites) {
      const dx = s.x - p.x, dy = s.y - p.y;
      const trX = invDet * (dirY * dx - dirX * dy);
      const trY = invDet * (-planeY * dx + planeX * dy);
      if (trY <= 0.15) continue;
      const scrX = (RW / 2) * (1 + trX / trY);
      let img, scale, yoff = 0;
      // 크기(벽 높이 1.6 기준). 쓰러진 인물 그림은 아래 40%에만 있어서 크게 잡는다
      const SC = { mate: 1.4, mate_down: 2.2, console_on: 1.35, console_off: 1.35, generator: 1.45, generator_on: 1.45, body: 2.2, body2: 2.2, researcher: 1.4, researcher_run: 1.4 };
      if (s.kind === "monster") {
        let f;
        if (s.frame !== undefined) f = s.frame;
        else if (st.monster.speed > 0.2) f = [0, 1, 0, 2][Math.floor(st.now / (st.monster.state === "chase" ? 110 : 200)) % 4];
        else f = Math.floor(st.now / 700) % 6 === 5 ? 3 : 0;
        if (st.monster.state === "chase" && s.d2 < 16 && Math.floor(st.now / 90) % 7 === 0) f = 3; // 가까이서 고개가 홱
        img = Assets.spr.monster[f]; scale = 2.4;
      }
      else { img = Assets.spr[s.kind]; scale = s.scale || SC[s.kind] || 1; }
      if (!img) continue;
      const sh = (K / trY) * scale;
      const sw = sh * img.width / img.height;
      const bottom = horizon + K * EYE / trY; // 바닥 접점
      const top = bottom - sh + yoff;
      const x0 = Math.floor(scrX - sw / 2), x1 = Math.ceil(scrX + sw / 2);
      const camX = trX / trY;
      let b = brightness(camX, trY, flick, st.ambient, st.glow);
      if (s.kind === "mate" && s.light) b = Math.max(b, 0.55 / (1 + trY * 0.12)); // 팀원 손전등은 멀리서도 보인다
      if (s.kind === "console_on" || s.kind === "generator_on") b = Math.max(b, 0.35 / (1 + trY * 0.15)); // 화면 빛이 스스로 난다
      if (b < 0.03 && s.kind !== "monster") continue;
      // 보이는 부분만 임시 캔버스에 그린 뒤 그 픽셀만 어둡게 해서 붙인다 (배경까지 칠하지 않도록)
      const cx0 = Math.max(0, x0), cx1 = Math.min(RW, x1);
      const vy0 = Math.max(0, Math.floor(top)), vy1 = Math.min(RH, Math.ceil(top + sh));
      if (cx1 <= cx0 || vy1 <= vy0) continue;
      const tw = cx1 - cx0, th = vy1 - vy0;
      if (!tmp) { tmp = document.createElement("canvas"); tctx = tmp.getContext("2d"); }
      if (tmp.width < tw || tmp.height < th) { tmp.width = Math.max(tmp.width, tw); tmp.height = Math.max(tmp.height, th); tctx.imageSmoothingEnabled = false; }
      tctx.globalCompositeOperation = "source-over"; tctx.clearRect(0, 0, tw, th);
      const sy0 = (vy0 - top) / sh * img.height, shh = th / sh * img.height;
      let any = false;
      for (let x = cx0; x < cx1; x++) {
        if (trY >= zbuf[x]) continue;
        const texX = Math.min(img.width - 1, Math.floor((x - x0) / (x1 - x0) * img.width));
        tctx.drawImage(img, texX, sy0, 1, shh, x - cx0, 0, 1, th);
        any = true;
      }
      if (!any) continue;
      if (b < 0.98) { tctx.globalCompositeOperation = "source-atop"; tctx.fillStyle = `rgba(0,0,0,${1 - b})`; tctx.fillRect(0, 0, tw, th); }
      g.drawImage(tmp, 0, 0, tw, th, cx0, vy0, tw, th);
      // 괴물: 어둠 속에서도 눈은 보인다
      if (s.kind === "monster" && trY > 5 && Math.abs(camX) < 1.1) {
        const ex = scrX, ey = top + sh * 0.1;
        const a = 0.4 + 0.5 * Math.sin(st.now / 250) ** 2;
        g.fillStyle = `rgba(230,230,255,${a})`; g.fillRect(ex - sw * 0.07, ey, Math.max(1, sw * 0.02), Math.max(1, sw * 0.02)); g.fillRect(ex + sw * 0.05, ey, Math.max(1, sw * 0.02), Math.max(1, sw * 0.02));
      }
      if (s.name && trY < 6 && b > 0.1) { g.fillStyle = `rgba(255,255,255,${0.8 * b})`; g.font = `${Math.max(7, 10 * RW / 320)}px sans-serif`; g.textAlign = "center"; g.fillText(s.name, scrX, Math.max(8, top - 3)); if (s.rev > 0) { g.fillStyle = "#222"; g.fillRect(scrX - 15, top - 14, 30, 3); g.fillStyle = "#9bff7a"; g.fillRect(scrX - 15, top - 14, 30 * Math.min(1, s.rev / 3), 3); } }
    }

    // 좌우 가장자리 어둠 (손전등 원뿔)
    const k = 1 - amb;
    const side = g.createLinearGradient(0, 0, RW, 0);
    side.addColorStop(0, `rgba(0,0,0,${0.92 * k})`); side.addColorStop(0.22, `rgba(0,0,0,${(0.55 - flick * 0.2) * k})`); side.addColorStop(0.5, "rgba(0,0,0,0)"); side.addColorStop(0.78, `rgba(0,0,0,${(0.55 - flick * 0.2) * k})`); side.addColorStop(1, `rgba(0,0,0,${0.92 * k})`);
    g.fillStyle = side; g.fillRect(0, 0, RW, RH);
    const vert = g.createLinearGradient(0, 0, 0, RH);
    vert.addColorStop(0, `rgba(0,0,0,${0.85 * k})`); vert.addColorStop(0.35, "rgba(0,0,0,0)"); vert.addColorStop(1, `rgba(0,0,0,${0.2 * k})`);
    g.fillStyle = vert; g.fillRect(0, 0, RW, RH);

    // 손전등 든 손
    if (!st.downed && !st.noHand) drawHand(g, RW, RH, st, flick);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, W, H);
  }
  function brightness(camX, dist, flick, ambient, glow) {
    const cone = Math.max(0.05, 1 - camX * camX * 0.85);
    const fog = Math.min(1, 1.7 / (0.5 + dist * 0.5));
    let b = cone * fog * flick;
    if (glow) b = Math.max(b, glow / (1 + dist * dist * 0.55)); // 손전등을 끄면 바로 앞만 겨우 보인다
    if (ambient) b = Math.max(b, ambient * Math.min(1, 4 / (1 + dist * 0.35)));
    return Math.max(0, Math.min(1, b));
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
