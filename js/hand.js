// 1인칭 손과 손전등 — 팔을 앞으로 뻗어 손전등을 내민 모습을 원근으로 그린다.
// 팔(소매)은 화면 오른쪽 아래에서 시작해 앞으로 뻗고, 손전등 헤드는 빛이 비치는 화면 가운데를 향해 작아진다.
// 화면 크기가 바뀔 때만 한 번 그려 두고, 매 프레임 흔들림·밝기·불빛만 더한다.
// img/hand_on.png, img/hand_off.png 를 넣으면 그 그림을 쓴다 (docs/art-requests.md)
window.Hand = (function () {
  let cache = null, key = "", box = null, tmp = null, tctx = null, geo = null;
  let swayX = 0, swayY = 0;

  function geometry(W, H) {
    const S = Math.min(W * 0.9, H * 0.85, Math.max(W, H) * 0.52);
    const VP = { x: W * 0.5, y: H * 0.465 };                 // 소실점 = 빛이 비치는 곳
    const D = { x: S * 0.70, y: S * 0.64 };                   // 깊이 1에서 소실점까지의 거리
    const R0 = S * 0.105;                                     // 깊이 1에서 손전등 반지름
    const z = t => 1.6 + 1.7 * t;                             // t: 0 = 주먹 뒤, 1 = 헤드
    const P = t => ({ x: VP.x + D.x / z(t), y: VP.y + D.y / z(t) });
    const ax = { x: -D.x, y: -D.y }; const al = Math.hypot(ax.x, ax.y); ax.x /= al; ax.y /= al;   // 화면에서 앞쪽 방향
    const nv = { x: -ax.y, y: ax.x };                          // 축에 수직
    const up = nv.y < 0 ? nv : { x: -nv.x, y: -nv.y };          // 화면 위쪽에 가까운 쪽
    const ang = Math.atan2(nv.y, nv.x);
    return { S, VP, D, R0, z, P, ax, nv, up, ang };
  }

  function build(W, H) {
    const G = geometry(W, H); geo = G;
    const { S, R0, z, P, ax, up, ang } = G;
    const rad = t => { const r = R0 / z(t); return t > 0.84 ? r * 1.28 : t > 0.8 ? r * (1 + (t - 0.8) / 0.04 * 0.28) : r; };
    const at = (t, off) => { const p = P(t); return { x: p.x + up.x * off, y: p.y + up.y * off }; };
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    const ell = (t, rx, ratio, stroke, lw) => { const p = P(t); g.save(); g.translate(p.x, p.y); g.rotate(ang); g.beginPath(); g.ellipse(0, 0, rx, rx * ratio, 0, Math.PI, Math.PI * 2); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); g.restore(); };
    const body = (t0, t1, rf, steps = 10) => { g.beginPath(); for (let i = 0; i <= steps; i++) { const t = t0 + (t1 - t0) * i / steps, p = at(t, rf(t)); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } for (let i = steps; i >= 0; i--) { const t = t0 + (t1 - t0) * i / steps, p = at(t, -rf(t)); g.lineTo(p.x, p.y); } g.closePath(); };
    const sideGrad = (t, r, stops) => { const a = at(t, r), b = at(t, -r); const gr = g.createLinearGradient(a.x, a.y, b.x, b.y); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; };
    const METAL = [[0, "#9aa1ac"], [0.07, "#454953"], [0.3, "#25272d"], [0.62, "#15161a"], [0.9, "#0b0c0e"], [1, "#2a2c33"]];
    const lw1 = Math.max(1, S * 0.004);

    // ── 손전등 몸통: 주먹 뒤에서 헤드까지 (원근으로 가늘어짐) ──
    body(-0.06, 0.8, rad); g.fillStyle = sideGrad(0.4, rad(0.4), METAL); g.fill();
    g.save(); body(0.3, 0.62, rad); g.clip();   // 미끄럼 방지 홈
    for (let t = 0.3; t < 0.62; t += 0.014) { const a = at(t, rad(t)), b = at(t + 0.025, -rad(t)); g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = Math.max(1, rad(t) * 0.07); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    g.restore();
    ell(0.3, rad(0.3), 0.55, "rgba(160,166,178,0.45)", lw1);
    ell(0.62, rad(0.62), 0.55, "rgba(160,166,178,0.45)", lw1);
    body(0.8, 1.0, rad, 4); g.fillStyle = sideGrad(0.92, rad(0.92), METAL); g.fill();   // 헤드
    ell(0.8, rad(0.8), 0.55, "rgba(175,180,190,0.5)", lw1);
    ell(0.86, rad(0.86), 0.55, "rgba(175,180,190,0.6)", lw1 * 1.2);
    { const p = P(1), r = rad(1);                // 베젤: 앞을 향해 있어 뒤쪽 테두리만 보인다
      g.save(); g.translate(p.x, p.y); g.rotate(ang);
      const bz = g.createLinearGradient(0, -r * 0.55, 0, r * 0.55); bz.addColorStop(0, "#c3c9d2"); bz.addColorStop(0.5, "#5f646d"); bz.addColorStop(1, "#24272c");
      g.fillStyle = bz; g.beginPath(); g.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0e0f12"; g.beginPath(); g.ellipse(0, 0, r * 0.78, r * 0.42, 0, 0, Math.PI * 2); g.fill();
      g.restore(); }
    { const a = at(-0.02, rad(-0.02) * 0.6), b = at(0.97, rad(0.97) * 0.6); g.strokeStyle = "rgba(210,220,235,0.2)"; g.lineWidth = Math.max(1.5, S * 0.008); g.lineCap = "round"; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }

    // ── 주먹: 손등이 위로, 손가락은 몸통 아래로 감싸고, 엄지는 아래쪽 옆을 따라 앞으로 ──
    const rb = rad;
    for (let i = 0; i < 4; i++) {               // 아래로 감싼 손가락 끝이 살짝 비어져 나옴
      const t = 0.05 + i * 0.062, r = rb(t);
      const a = at(t, -r * 0.2), b = at(t + 0.01, -r * 1.32), fr = r * 0.42;
      g.save(); g.translate(a.x, a.y); g.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      const gr = g.createLinearGradient(0, -fr, 0, fr); gr.addColorStop(0, "#b58f74"); gr.addColorStop(0.5, "#8c6a55"); gr.addColorStop(1, "#4d362b");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -fr); g.lineTo(l, -fr); g.arc(l, 0, fr, -Math.PI / 2, Math.PI / 2); g.lineTo(0, fr); g.closePath(); g.fill();
      g.strokeStyle = "rgba(40,26,20,0.6)"; g.lineWidth = Math.max(1, fr * 0.12); g.stroke();
      g.restore();
    }
    { const T0 = 0.0, T1 = 0.31;                // 손등 덩어리
      const top = [], bot = [];
      for (let i = 0; i <= 12; i++) { const t = T0 + (T1 - T0) * i / 12, r = rb(t), k = Math.sin(Math.PI * Math.min(1, (t - T0) / (T1 - T0) * 1.05)) ** 0.6;
        top.push(at(t, r * (1.0 + 0.75 * k))); bot.push(at(t, -r * (0.55 + 0.25 * k))); }
      g.beginPath(); g.moveTo(top[0].x, top[0].y); for (const p of top) g.lineTo(p.x, p.y);
      const f = P(T1 + 0.015); g.quadraticCurveTo(f.x + ax.x * rb(T1) * 0.6, f.y + ax.y * rb(T1) * 0.6, bot[12].x, bot[12].y);
      for (let i = 12; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
      g.closePath();
      const a = at(0.18, rb(0.18) * 1.8), b = at(0.18, -rb(0.18) * 0.8);
      const gr = g.createLinearGradient(a.x, a.y, b.x, b.y); gr.addColorStop(0, "#5f4537"); gr.addColorStop(0.3, "#a27c62"); gr.addColorStop(0.62, "#c4a085"); gr.addColorStop(1, "#7a5b48");
      g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(45,30,22,0.55)"; g.lineWidth = lw1; g.stroke();
      for (let i = 0; i < 4; i++) {             // 마디
        const t = T1 - 0.03 - i * 0.004, off = rb(t) * (1.45 - i * 0.42), p = at(t, off), rr = rb(t) * 0.32;
        const kg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr); kg.addColorStop(0, "rgba(235,210,190,0.55)"); kg.addColorStop(1, "rgba(235,210,190,0)"); g.fillStyle = kg; g.beginPath(); g.arc(p.x, p.y, rr, 0, 7); g.fill();
        if (i < 3) { const q0 = at(t - 0.01, off - rb(t) * 0.2), q1 = at(t - 0.09, off - rb(t) * 0.28); g.strokeStyle = "rgba(60,40,30,0.35)"; g.lineWidth = Math.max(1, S * 0.003); g.beginPath(); g.moveTo(q0.x, q0.y); g.lineTo(q1.x, q1.y); g.stroke(); }
      }
      for (const o of [0.5, 0.9, 1.3]) { const p0 = at(0.03, rb(0.03) * o), p1 = at(0.24, rb(0.24) * (o + 0.1)); g.strokeStyle = "rgba(230,205,185,0.12)"; g.lineWidth = lw1; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); }
    }
    { const a = at(0.14, -rb(0.14) * 0.5), b = at(0.36, -rb(0.36) * 0.3), fr = rb(0.26) * 0.36;   // 엄지
      g.save(); g.translate(a.x, a.y); g.rotate(Math.atan2(b.y - a.y, b.x - a.x)); const l = Math.hypot(b.x - a.x, b.y - a.y);
      const gr = g.createLinearGradient(0, -fr, 0, fr); gr.addColorStop(0, "#d0ac90"); gr.addColorStop(0.5, "#a5806a"); gr.addColorStop(1, "#5e4334");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -fr * 1.2); g.lineTo(l, -fr * 0.85); g.arc(l, 0, fr * 0.85, -Math.PI / 2, Math.PI / 2); g.lineTo(0, fr * 1.2); g.closePath(); g.fill();
      g.strokeStyle = "rgba(45,30,22,0.55)"; g.lineWidth = lw1; g.stroke();
      g.fillStyle = "rgba(240,220,205,0.7)"; g.beginPath(); g.ellipse(l - fr * 0.15, -fr * 0.15, fr * 0.55, fr * 0.4, 0, 0, 7); g.fill();
      g.restore(); }

    // ── 소매: 화면 오른쪽 아래에서 손목까지 앞으로 뻗은 팔 ──
    { const tw = 0.03, rArm = t => S * 0.17 / z(t), T0 = -0.9;
      g.beginPath();
      for (let i = 0; i <= 14; i++) { const t = T0 + (tw - T0) * i / 14, p = P(t); const q = { x: p.x + up.x * rArm(t) * 1.05, y: p.y + up.y * rArm(t) * 1.05 }; i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
      for (let i = 14; i >= 0; i--) { const t = T0 + (tw - T0) * i / 14, p = P(t); g.lineTo(p.x - up.x * rArm(t), p.y - up.y * rArm(t)); }
      g.closePath();
      const a = at(-0.3, rArm(-0.3)), b = at(-0.3, -rArm(-0.3));
      const gr = g.createLinearGradient(a.x, a.y, b.x, b.y); gr.addColorStop(0, "#151821"); gr.addColorStop(0.28, "#30364a"); gr.addColorStop(0.6, "#232838"); gr.addColorStop(1, "#0b0d13");
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      const cuff0 = tw - 0.09;
      for (let o = -1; o <= 1.02; o += 0.09) { const p0 = P(cuff0), p1 = P(tw), r0 = rArm(cuff0), r1 = rArm(tw);
        g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = lw1; g.beginPath(); g.moveTo(p0.x + up.x * r0 * o, p0.y + up.y * r0 * o); g.lineTo(p1.x + up.x * r1 * o, p1.y + up.y * r1 * o); g.stroke(); }
      g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = Math.max(2, S * 0.012); g.lineCap = "round";
      for (const [t0, o0, t1, o1] of [[-0.45, 0.6, -0.15, -0.1], [-0.6, -0.5, -0.25, -0.75], [-0.3, 0.9, -0.08, 0.35]]) { const p = P(t0), q = P(t1); g.beginPath(); g.moveTo(p.x + up.x * rArm(t0) * o0, p.y + up.y * rArm(t0) * o0); g.quadraticCurveTo((p.x + q.x) / 2 + up.x * rArm(t0) * 0.15, (p.y + q.y) / 2 + up.y * rArm(t0) * 0.15, q.x + up.x * rArm(t1) * o1, q.y + up.y * rArm(t1) * o1); g.stroke(); }
      g.strokeStyle = "rgba(130,140,175,0.13)"; g.lineWidth = Math.max(2, S * 0.008);
      { const p = P(-0.5), q = P(-0.05); g.beginPath(); g.moveTo(p.x + up.x * rArm(-0.5) * 0.75, p.y + up.y * rArm(-0.5) * 0.75); g.lineTo(q.x + up.x * rArm(-0.05) * 0.7, q.y + up.y * rArm(-0.05) * 0.7); g.stroke(); }
      g.restore();
    }

    // 그림체에 맞춘 거친 질감 (그린 영역만)
    const hp = P(1);
    const bx = Math.max(0, Math.floor(hp.x - S * 0.12)), by = Math.max(0, Math.floor(hp.y - S * 0.12));
    box = { x: bx, y: by, w: Math.max(1, W - bx), h: Math.max(1, H - by) };
    const id = g.getImageData(box.x, box.y, box.w, box.h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const nz = (Math.random() - 0.5) * 20; d[i] = Math.max(0, Math.min(255, d[i] + nz)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + nz)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + nz)); }
    g.putImageData(id, box.x, box.y);
    return c;
  }

  function draw(ctx, W, H, st, flick) {
    const img = flick > 0.05 ? (Assets.spr.hand_on || null) : (Assets.spr.hand_off || null);
    const k = W + "x" + H;
    if (key !== k) { cache = img ? null : build(W, H); geo = geometry(W, H); key = img ? "" : k; }
    const S = geo.S;
    // 흔들림: 걸을 때 위아래·좌우, 고개를 돌리면 반대쪽으로 살짝 늦게 따라옴, 위아래로 볼 때 같이 움직임
    const tv = Math.max(-3, Math.min(3, st.turn || 0));
    const walk = st.moving;
    const tx = -tv * S * 0.03 + (walk ? Math.cos(st.now / 360) * S * 0.012 : 0);
    const ty = (walk ? Math.abs(Math.sin(st.now / 180)) * S * 0.02 : Math.sin(st.now / 900) * S * 0.006) + (st.look || 0) * S * 0.18;
    swayX += (tx - swayX) * 0.18; swayY += (ty - swayY) * 0.25;
    const bright = 0.26 + 0.42 * flick + (st.glow ? 0.04 : 0);
    if (img) {   // 교체 그림: 화면 오른쪽 아래에 맞춤
      const w = Math.min(W * 0.62, H * 1.0), h = w * img.height / img.width;
      ctx.drawImage(img, W - w + swayX, H - h + swayY, w, h);
      return;
    }
    if (!tmp) { tmp = document.createElement("canvas"); tctx = tmp.getContext("2d"); }
    if (tmp.width !== box.w || tmp.height !== box.h) { tmp.width = box.w; tmp.height = box.h; }
    tctx.globalCompositeOperation = "source-over"; tctx.clearRect(0, 0, box.w, box.h);
    tctx.drawImage(cache, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    tctx.globalCompositeOperation = "source-atop"; tctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - bright)})`; tctx.fillRect(0, 0, box.w, box.h);
    ctx.drawImage(tmp, box.x + swayX, box.y + swayY);
    if (flick > 0.02) {   // 헤드에서 앞으로 터져 나오는 빛
      const h = geo.P(1), hx = h.x + swayX, hy = h.y + swayY, r = geo.R0 / geo.z(1) * 1.28;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const fx = hx + geo.ax.x * r * 0.6, fy = hy + geo.ax.y * r * 0.6;
      const gl = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 4.5);
      gl.addColorStop(0, `rgba(255,246,222,${0.7 * flick})`); gl.addColorStop(0.25, `rgba(255,232,195,${0.25 * flick})`); gl.addColorStop(1, "rgba(255,232,195,0)");
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(fx, fy, r * 4.5, 0, 7); ctx.fill();
      ctx.translate(hx, hy); ctx.rotate(geo.ang);
      ctx.strokeStyle = `rgba(255,250,230,${0.9 * flick})`; ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.5, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  return { draw };
})();
