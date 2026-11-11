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
    if (room && window.ROOM_WALL && ROOM_WALL[room.baseId || room.id] && T[ROOM_WALL[room.baseId || room.id]]) return T[ROOM_WALL[room.baseId || room.id]];
    let key = room ? (TEX_BY_ROOM[room.tex] || "wall") : "wall";
    if (st.gore && T[key + "_blood"] && ((tx * 31 + ty * 17) % 23 === 0 || (room && room.id === "contain1" && (tx * 7 + ty) % 4 === 0))) key += "_blood";
    return T[key] || T.wall;
  }
  function isWall(tx, ty) { const t = MapUtil.tile(tx, ty); return t === "#" || t === "L" || t === "E"; }
  let bodiesFor = null, BODIES = [];
  function bodies() { if (bodiesFor !== window.INTRO) { bodiesFor = window.INTRO; BODIES = (window.INTRO ? INTRO.bodies : []).map(b => ({ x: b[0], y: b[1], k: b[2] })); } return BODIES; }

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
    const spot = flick > 0.01 && !amb;               // 손전등 빛 모드: 원형 광원 + 거리 감쇠
    const tv = st.turn || 0, bobP = st.moving ? st.now / 180 : st.now / 900;
    const beamX = RW / 2 - Math.max(-1, Math.min(1, tv * 0.25)) * RW * 0.05 + Math.cos(bobP * 0.5) * (st.moving ? 2.5 : 0.8) * RW / 320;
    const beamY = horizon - RH * 0.035 + Math.sin(bobP) * (st.moving ? 3 : 0.8) * RW / 320;
    const beamR = RW * 0.62;
    g.fillStyle = amb ? `rgb(${60 * amb | 0},${62 * amb | 0},${60 * amb | 0})` : "#050506"; g.fillRect(0, 0, RW, RH);
    const fg = g.createLinearGradient(0, horizon, 0, RH);
    const fl = spot ? 1 : Math.max(flick * 0.6, amb, (st.glow || 0) * 0.5);
    fg.addColorStop(0, amb ? `rgb(${50 * amb | 0},${50 * amb | 0},${48 * amb | 0})` : "#0a0a0a"); fg.addColorStop(0.35, `rgb(${70 * fl | 0},${68 * fl | 0},${62 * fl | 0})`); fg.addColorStop(1, `rgb(${110 * fl | 0},${104 * fl | 0},${94 * fl | 0})`);
    g.fillStyle = fg; g.fillRect(0, horizon, RW, RH - horizon);
    // 바닥 손전등 웅덩이
    const pool = g.createRadialGradient(RW / 2, RH * 0.95, RW * 0.05, RW / 2, RH * 0.95, RW * 0.55);
    pool.addColorStop(0, `rgba(255,240,200,${(spot ? 0.08 : 0.22) * flick})`); pool.addColorStop(1, "rgba(255,240,200,0)");
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
      let b = (spot ? atten(perp) : brightness(camX, perp, flick, st.ambient, st.glow)) * (side ? 0.74 : 1);
      g.fillStyle = `rgba(0,0,0,${1 - b})`; g.fillRect(x, top, 1, lineH);
    }

    if (spot) applyBeam(g, beamX, beamY, beamR, flick);

    // 스프라이트
    const sprites = [];
    for(const m of st.monsters || (st.monster?[st.monster]:[])) if(!["sleep","dormant"].includes(m.state)) sprites.push({kind:"monster",x:m.x,y:m.y,monster:m});
    for(const stair of MapUtil.stairs) if(stair.floor===MapUtil.floorAt(p.x,p.y)) sprites.push({kind:"stairs",x:stair.x+.5,y:stair.y+.5,stair,scale:2.0,lit:.6});
    for (const o of st.others) if (!o.esc && !o.hid) sprites.push({ kind: o.down ? "mate_down" : "mate", x: o.x, y: o.y, name: o.name, rev: o.rev, light: o.light });
    // 셀이 꽂힌 장비: 방마다 다른 장비 그림. 셀이 남아 있으면 홈이 푸르게 빛나고 초록 등, 꺼내면 빈 홈에 빨간 등
    for (const f of st.fuses) {
      const empty = (st.fmask >> f.id) & 1, dk = window.DEVICE_KEY && DEVICE_KEY[f.room];
      if (dk && Assets.spr[dk]) { sprites.push({ kind: empty ? dk + "_e" : dk, x: f.x + 0.5, y: f.y + 0.5, scale: 1.45, lit: empty ? 0.12 : 0.3 }); continue; }
      else sprites.push({ kind: empty ? "console_off" : "console_on", x: f.x + 0.5, y: f.y + 0.5 });
      if (!empty) sprites.push({ kind: "it_cell", x: f.x + 0.5, y: f.y + 0.5, lift: 1.33 + 0.03 * Math.sin(st.now / 380 + f.id), scale: 0.22, glow: 0.75 });
    }
    // 방 소품 (가까운 것만)
    if (window.PROPS) for (const pr of MapUtil.props) { const dx = pr.x + 0.5 - p.x, dy = pr.y + 0.5 - p.y; if (dx * dx + dy * dy > 225) continue; sprites.push({ kind: PROPS[pr.ch].key, x: pr.x + 0.5, y: pr.y + 0.5, scale: PROPS[pr.ch].h }); }
    // 떨어진 셀, 구급상자
    if (st.drops) for (const d of st.drops) sprites.push({ kind: "it_cell", x: d[0], y: d[1], scale: 0.32, glow: 0.7 });
    if (st.meds) for (const m of st.meds) sprites.push({ kind: "it_medkit", x: m.x, y: m.y, scale: 0.3 });
    const bp = MapUtil.find("B")[0]; sprites.push({ kind: st.exitOpen ? "generator_on" : "generator", x: bp.x + 0.5, y: bp.y + 0.5 });
    if (st.gore) for (const bd of bodies()) sprites.push({ kind: bd.k, x: bd.x, y: bd.y });
    if (st.extra) for (const e of st.extra) sprites.push(e);
    for (const s of sprites) { const dx = s.x - p.x, dy = s.y - p.y; s.d2 = dx * dx + dy * dy; }
    sprites.sort((a, b) => b.d2 - a.d2);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const s of sprites) {
      if(!MapUtil.sameFloor(p,s))continue;
      const dx = s.x - p.x, dy = s.y - p.y;
      const trX = invDet * (dirY * dx - dirX * dy);
      const trY = invDet * (-planeY * dx + planeX * dy);
      if (trY <= 0.15) continue;
      const scrX = (RW / 2) * (1 + trX / trY);
      let img, scale, yoff = 0;
      // 크기(벽 높이 1.6 기준). 쓰러진 인물 그림은 아래 40%에만 있어서 크게 잡는다
      const SC = { mate: 1.4, mate_down: 2.2, console_on: 1.35, console_off: 1.35, generator: 1.45, generator_on: 1.45, body: 2.2, body2: 2.2, researcher: 1.4, researcher_run: 1.4 };
      if (s.kind === "monster") {
        const monster=s.monster || st.monster;
        let f;
        if (s.frame !== undefined) f = s.frame;
        else if (monster.speed > 0.2) f = [0, 1, 0, 2][Math.floor(st.now / (monster.state === "chase" ? 110 : 200)) % 4];
        else f = Math.floor(st.now / 700) % 6 === 5 ? 3 : 0;
        if (monster.state === "chase" && s.d2 < 16 && Math.floor(st.now / 90) % 7 === 0) f = 3; // 가까이서 고개가 홱
        img = Assets.spr.monster[f]; scale = 2.4;
      }
      else if(s.kind==="stairs"){img=stairArt(s.stair);scale=s.scale;}
      else { img = Assets.spr[s.kind]; scale = s.scale || SC[s.kind] || 1; }
      if (!img) continue;
      const sh = (K / trY) * scale;
      const sw = sh * img.width / img.height;
      const bottom = horizon + K * (EYE - (s.lift || 0)) / trY; // 바닥 접점 (떠 있는 물건은 lift 만큼 위)
      const top = bottom - sh + yoff;
      const x0 = Math.floor(scrX - sw / 2), x1 = Math.ceil(scrX + sw / 2);
      const camX = trX / trY;
      let b = spot ? atten(trY) * beamAt(scrX, Math.max(0, Math.min(RH, (top + bottom) / 2 + sh * 0.12)), beamX, beamY, beamR) * flick
                   : brightness(camX, trY, flick, st.ambient, st.glow);
      if (s.kind === "mate" && s.light) b = Math.max(b, 0.55 / (1 + trY * 0.12)); // 팀원 손전등은 멀리서도 보인다
      if (s.kind === "console_on" || s.kind === "generator_on") b = Math.max(b, 0.35 / (1 + trY * 0.15)); // 화면 빛이 스스로 난다
      if (s.glow) b = Math.max(b, s.glow / (1 + trY * 0.08));   // 스스로 빛나는 물건(에너지 셀)
      if (s.kind === "p_cctv" || s.kind === "p_rack" || s.kind === "p_vending") b = Math.max(b, 0.16 / (1 + trY * 0.15));
      if (s.lit) b = Math.max(b, s.lit / (1 + trY * 0.15));   // 장비 화면·표시등은 어둠 속에서도 희미하게 보인다
      if (s.dim) b *= 0.55;
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

    if (spot) {
      // 빛이 닿은 면이 가까울수록 중심이 하얗게 번진다
      const zc = zbuf[Math.max(0, Math.min(RW - 1, Math.round(beamX)))] || 10;
      const near = Math.max(0, Math.min(1, 1.5 / zc));
      const hot = g.createRadialGradient(beamX, beamY, 0, beamX, beamY, beamR * (0.22 + near * 0.18));
      hot.addColorStop(0, `rgba(255,236,200,${(0.07 + near * 0.16) * flick})`); hot.addColorStop(1, "rgba(255,236,200,0)");
      g.globalCompositeOperation = "lighter"; g.fillStyle = hot; g.fillRect(0, 0, RW, RH); g.globalCompositeOperation = "source-over";
    }
    // 좌우 가장자리 어둠 (손전등이 없을 때)
    const k = spot ? 0 : 1 - amb;
    const side = g.createLinearGradient(0, 0, RW, 0);
    side.addColorStop(0, `rgba(0,0,0,${0.92 * k})`); side.addColorStop(0.22, `rgba(0,0,0,${(0.55 - flick * 0.2) * k})`); side.addColorStop(0.5, "rgba(0,0,0,0)"); side.addColorStop(0.78, `rgba(0,0,0,${(0.55 - flick * 0.2) * k})`); side.addColorStop(1, `rgba(0,0,0,${0.92 * k})`);
    g.fillStyle = side; g.fillRect(0, 0, RW, RH);
    const vert = g.createLinearGradient(0, 0, 0, RH);
    vert.addColorStop(0, `rgba(0,0,0,${0.85 * k})`); vert.addColorStop(0.35, "rgba(0,0,0,0)"); vert.addColorStop(1, `rgba(0,0,0,${0.2 * k})`);
    g.fillStyle = vert; g.fillRect(0, 0, RW, RH);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, W, H);
    if (spot) drawDust(ctx, W, H, beamX * W / RW, beamY * H / RH, beamR * W / RW, flick, st.now);
    // 손전등 든 손 (고해상도)
    if (!st.downed && !st.noHand) Hand.draw(ctx, W, H, st, flick);
  }

  const stairImages = new Map();
  function stairArt(stair) {
    if(stairImages.has(stair.id))return stairImages.get(stair.id);
    const c=document.createElement("canvas");c.width=160;c.height=200;const g=c.getContext("2d");
    g.fillStyle="#171f22";g.fillRect(15,15,130,185);g.fillStyle="#070d10";g.fillRect(29,48,102,152);
    // 낡은 철제 계단과 난간. 기존 연구소의 절차적 소품과 같은 방식으로 그린다.
    for(let i=0;i<8;i++){const y=88+i*14,x=52-i*4,w=56+i*8;g.fillStyle=i%2?"#49514f":"#626b66";g.fillRect(x,y,w,7);g.fillStyle="#202a2a";g.fillRect(x,y+7,w,7);g.fillStyle="#b9a363";g.fillRect(x,y,w,2);}
    g.strokeStyle="#87988f";g.lineWidth=3;g.beginPath();g.moveTo(24,174);g.lineTo(53,65);g.lineTo(109,65);g.lineTo(136,174);g.stroke();
    for(let i=0;i<5;i++){g.beginPath();g.moveTo(24+i*6,174-i*23);g.lineTo(24+i*6,197-i*14);g.moveTo(136-i*6,174-i*23);g.lineTo(136-i*6,197-i*14);g.stroke();}
    g.fillStyle="#194536";g.fillRect(26,20,108,34);g.strokeStyle="#84d9b7";g.lineWidth=1;g.strokeRect(26,20,108,34);
    g.fillStyle="#d3ffe8";g.textAlign="center";g.font="bold 21px sans-serif";g.fillText(`${stair.to.floor}F ${stair.floor===1?"↑":"↓"}  ${stair.id.endsWith('0')?'A':'B'}`,80,44);
    g.fillStyle="rgba(0,0,0,.25)";for(let i=0;i<30;i++)g.fillRect(16+(i*43)%127,60+(i*29)%136,3,2);
    stairImages.set(stair.id,c);return c;
  }
  // ---------- 손전등 빛 ----------
  // 원형 빛: 밝은 중심(핫스팟) → 테두리 → 퍼지는 빛 → 어둠. 화면 곱하기로 씌운다.
  const BEAM = [[0, 1.0], [0.16, 0.97], [0.3, 0.84], [0.38, 0.55], [0.5, 0.3], [0.68, 0.14], [0.86, 0.06], [1, 0.025]];
  function beamCurve(r) {
    if (r >= 1) return BEAM[BEAM.length - 1][1];
    for (let i = 1; i < BEAM.length; i++) if (r <= BEAM[i][0]) { const [r0, v0] = BEAM[i - 1], [r1, v1] = BEAM[i]; return v0 + (v1 - v0) * (r - r0) / (r1 - r0); }
    return BEAM[BEAM.length - 1][1];
  }
  function beamAt(x, y, cx, cy, R) { return beamCurve(Math.hypot(x - cx, (y - cy) * 1.08) / R); }
  function applyBeam(g, cx, cy, R, flick) {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    for (const [r, v] of BEAM) {
      const k = v * flick;   // 따뜻한 백열 색
      gr.addColorStop(r, `rgb(${Math.min(255, 255 * k) | 0},${Math.min(255, 243 * k) | 0},${Math.min(255, 220 * k) | 0})`);
    }
    g.save(); g.globalCompositeOperation = "multiply"; g.fillStyle = gr; g.fillRect(0, 0, RW, RH); g.restore();
  }
  // 거리 감쇠: 가까운 곳은 환하고 멀어질수록 빛이 약해진다
  function atten(d) { return 1 / (1 + (d / 5.2) * (d / 5.2)); }
  // 빛줄기 속 먼지
  const dust = Array.from({ length: 46 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02 + 0.004 }));
  let dustT = 0;
  function drawDust(ctx, W, H, cx, cy, R, flick, now) {
    const dt = Math.min(0.05, (now - dustT) / 1000 || 0); dustT = now;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const d of dust) {
      d.x += d.vx * dt * 6; d.y += d.vy * dt * 6;
      if (d.x < -1 || d.x > 1 || d.y < -1 || d.y > 1) { d.x = Math.random() * 2 - 1; d.y = -1; d.z = Math.random(); }
      const rr = Math.hypot(d.x, d.y); if (rr > 0.6) continue;
      const a = (1 - rr / 0.6) * 0.35 * flick * (0.5 + d.z * 0.5);
      const sz = 1 + d.z * 1.6;
      ctx.fillStyle = `rgba(255,240,210,${a})`;
      ctx.fillRect(cx + d.x * R * 0.55, cy + d.y * R * 0.45, sz, sz);
    }
    ctx.restore();
  }
  function brightness(camX, dist, flick, ambient, glow) {
    const cone = Math.max(0.05, 1 - camX * camX * 0.85);
    const fog = Math.min(1, 1.7 / (0.5 + dist * 0.5));
    let b = cone * fog * flick;
    if (glow) b = Math.max(b, glow / (1 + dist * dist * 0.55)); // 손전등을 끄면 바로 앞만 겨우 보인다
    if (ambient) b = Math.max(b, ambient * Math.min(1, 4 / (1 + dist * 0.35)));
    return Math.max(0, Math.min(1, b));
  }
  return { render, setup };
})();
