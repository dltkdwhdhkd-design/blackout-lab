// 판마다 새 연구동을 만드는 생성기. 같은 번호(시드)면 어느 기기에서든 똑같은 지도가 나온다.
// 뼈대: 위에서부터 격리동 / 실험동·중앙동(순서 무작위) / 설비동, 그 사이 가로 복도 3개, 양옆 세로 복도.
// 무작위: 각 줄의 방 순서·크기, 방 안 가구, 문 위치, 막힌 복도, 단말기·사물함·발전기·출구 위치, 좌우·상하 뒤집기.
window.MapGen = (function () {
  function rng(seed) { let a = (seed >>> 0) || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const CONTAIN = { id: "contain1", name: "격리실 A", tex: "contain", units: [], kind: "intro" };
  const WING = [
    { id: "contain2", name: "격리실 B", tex: "contain", units: [], kind: "cell" },
    { id: "monitor", name: "CCTV실", tex: "lab", units: ["intro"], kind: "desks", cells: 1 },
    { id: "server", name: "서버실", tex: "power", units: ["intro"], kind: "racks", cells: 1 },
    { id: "archive", name: "기록 보관실", tex: "lab", units: [], kind: "shelves" },
    { id: "medical", name: "의무실", tex: "lab", units: ["life"], kind: "beds", cells: 1 },
  ];
  const LABS = [
    { id: "phy", name: "물리 실험실", tex: "lab", units: ["force"], kind: "benches", cells: 2 },
    { id: "chem", name: "화학 분석실", tex: "lab", units: ["state", "gas"], kind: "hoods", cells: 2 },
    { id: "bio", name: "생물 배양실", tex: "lab", units: ["life"], kind: "benches", cells: 2 },
    { id: "heat", name: "열 실험실", tex: "lab", units: ["heat"], kind: "desks", cells: 2 },
    { id: "earth", name: "지질 시료실", tex: "lab", units: ["earth"], kind: "shelves", cells: 2 },
  ];
  const CENTER = [
    { id: "lobby", name: "중앙 홀", tex: "hall", units: [], kind: "pillars", spawn: true, weight: 1.7 },
    { id: "meeting", name: "회의실", tex: "lab", units: [], kind: "table" },
    { id: "office", name: "사무실", tex: "lab", units: [], kind: "desks" },
    { id: "lounge", name: "휴게실", tex: "hall", units: [], kind: "tables" },
  ];
  const FACIL = [
    { id: "power", name: "비상 발전기실", tex: "power", units: ["intro"], kind: "machines", generator: true },
    { id: "mech", name: "기계·환기실", tex: "power", units: [], kind: "machines" },
    { id: "changing", name: "탈의실", tex: "hall", units: [], kind: "rows" },
    { id: "cafeteria", name: "구내식당", tex: "lab", units: [], kind: "tables" },
    { id: "store", name: "자재 창고", tex: "power", units: [], kind: "shelves" },
    { id: "exit", name: "보안 출구", tex: "hall", units: [], kind: "checkpoint", exit: true },
  ];

  function generate(seed) {
    for (let k = 0; k < 40; k++) { const r = attempt((seed * 7919 + k * 104729) >>> 0); if (r) { r.seed = seed; return r; } }
    return null;
  }

  function attempt(seed) {
    const R = rng(seed);
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const pick = a => a[Math.floor(R() * a.length)];
    const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const W = 84;
    const hA = ri(8, 10), hB = ri(8, 11), hC = ri(8, 11), hD = ri(9, 12);
    const H = hA + hB + hC + hD + 14;
    const g = Array.from({ length: H }, () => Array(W).fill("#"));
    const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
    const carve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) g[y][x] = "."; };
    const protect = new Set(); const K = (x, y) => y * W + x;
    const isFloor = (x, y) => g[y] && (g[y][x] === "." || g[y][x] === "S" || g[y][x] === "M");

    // ---- 줄(band)과 복도 ----
    const yN = hA + 2, yM = hA + hB + 6, yS = hA + hB + hC + 10;
    const bands = [
      { y0: 1, y1: hA, up: null, down: hA + 1 },
      { y0: hA + 5, y1: hA + 4 + hB, up: hA + 4, down: hA + hB + 5 },
      { y0: hA + hB + 9, y1: hA + hB + 8 + hC, up: hA + hB + 8, down: hA + hB + hC + 9 },
      { y0: hA + hB + hC + 13, y1: H - 2, up: hA + hB + hC + 12, down: null },
    ];
    for (const y of [yN, yM, yS]) carve(1, y, W - 2, y + 1);
    carve(1, 1, 2, H - 2); carve(W - 3, 1, W - 2, H - 2);
    // 세로 복도 일부를 막아 길을 바꾼다 (가로 복도로는 항상 이어져 있음)
    for (const b of bands) for (const xs of [[1, 2], [W - 3, W - 2]]) if (R() < 0.3) for (let y = b.y0; y <= b.y1; y++) for (const x of xs) g[y][x] = "#";

    // ---- 방 배치 ----
    const mid = R() < 0.5 ? [LABS, CENTER] : [CENTER, LABS];
    const groups = [[CONTAIN, ...shuffle(WING)], shuffle(mid[0]), shuffle(mid[1]), shuffle(FACIL)];
    const rooms = [];
    groups.forEach((list, bi) => {
      const b = bands[bi];
      let xStart = 4, items = list;
      if (bi === 0) { rooms.push({ ...CONTAIN, x0: 4, x1: 13, y0: b.y0, y1: b.y1, band: bi, doors: [] }); xStart = 15; items = list.slice(1); }
      const total = 79 - xStart + 1 - (items.length - 1);
      const wts = items.map(r => (r.weight || 1) * (0.75 + R() * 0.6));
      const sum = wts.reduce((a, c) => a + c, 0);
      let ws = wts.map(w => Math.max(7, Math.floor(total * w / sum)));
      let diff = total - ws.reduce((a, c) => a + c, 0), i = 0;
      while (diff !== 0 && i < 500) { const j = i % ws.length; if (diff > 0) { ws[j]++; diff--; } else if (ws[j] > 7) { ws[j]--; diff++; } i++; }
      let x = xStart;
      items.forEach((r, k) => { rooms.push({ ...r, x0: x, x1: x + ws[k] - 1, y0: b.y0, y1: b.y1, band: bi, doors: [] }); x += ws[k] + 1; });
    });
    for (const r of rooms) carve(r.x0, r.y0, r.x1, r.y1);
    const roomOf = (x, y) => rooms.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);

    // ---- 문 ----
    function door(r, x, y, ex, ey) { g[y][x] = "."; r.doors.push({ x, y }); protect.add(K(x, y)); protect.add(K(ex, ey)); }
    const contain = rooms[0];
    const doorX = ri(7, 9);
    door(contain, doorX, hA + 1, doorX, hA);
    const slot1 = rooms[1], r3DoorX = Math.min(slot1.x1 - 1, Math.max(slot1.x0 + 1, doorX + 8));
    door(slot1, r3DoorX, hA + 1, r3DoorX, hA);
    protect.add(K(r3DoorX, hA - 1));   // 인트로: 세 번째 연구원이 뛰어드는 자리
    for (const r of rooms) {
      if (r === contain) continue;
      const b = bands[r.band];
      const sides = shuffle([b.up, b.down].filter(v => v !== null));
      sides.forEach((wy, si) => {
        if (r === slot1 && wy === hA + 1) return;
        if (si > 0 && R() > 0.7) return;
        const n = (r.x1 - r.x0 >= 13 && R() < 0.45) ? 2 : 1;
        for (let k = 0; k < n; k++) { const x = ri(r.x0 + 1, r.x1 - 1); door(r, x, wy, x, wy === b.up ? r.y0 : r.y1); }
      });
    }
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i], c = rooms[i + 1];
      if (a.band !== c.band || a === contain || R() > 0.35) continue;
      const y = ri(a.y0 + 1, a.y1 - 1); door(a, a.x1 + 1, y, a.x1, y); c.doors.push({ x: a.x1 + 1, y }); protect.add(K(c.x0, y));
    }
    for (const r of rooms) {
      if (r === contain) continue;
      if (r.x0 === 4 && R() < 0.4) { const y = ri(r.y0 + 1, r.y1 - 1); if (g[y][2] === ".") door(r, 3, y, 4, y); }
      if (r.x1 === 79 && R() < 0.4) { const y = ri(r.y0 + 1, r.y1 - 1); if (g[y][W - 3] === ".") door(r, 80, y, 79, y); }
    }

    // ---- 방 안 연결 검사 ----
    function roomConnected(r) {
      let start = null, total = 0;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (isFloor(x, y)) { total++; if (!start && protect.has(K(x, y))) start = [x, y]; }
      if (!start) return false;
      const seen = new Set([K(start[0], start[1])]), q = [start];
      for (let qi = 0; qi < q.length; qi++) {
        const [x, y] = q[qi];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < r.x0 || nx > r.x1 || ny < r.y0 || ny > r.y1) continue; const k = K(nx, ny); if (seen.has(k) || !isFloor(nx, ny)) continue; seen.add(k); q.push([nx, ny]); }
      }
      return seen.size === total;
    }
    function tryBlock(r, x0, y0, x1, y1, ch = "#") {
      x0 = Math.max(r.x0, x0); y0 = Math.max(r.y0, y0); x1 = Math.min(r.x1, x1); y1 = Math.min(r.y1, y1);
      if (x1 < x0 || y1 < y0) return false;
      const changed = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (protect.has(K(x, y)) || !isFloor(x, y)) { for (const [cx, cy] of changed) g[cy][cx] = "."; return false; } changed.push([x, y]); g[y][x] = ch; }
      if (!roomConnected(r)) { for (const [cx, cy] of changed) g[cy][cx] = "."; return false; }
      return true;
    }
    const protectRect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) protect.add(K(x, y)); };
    const wallNear = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] === "#");
    const nearDoor = (r, x, y) => r.doors.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 2);
    function placeAgainstWall(r, ch, minGap, others) {
      for (let tries = 0; tries < 120; tries++) {
        const x = ri(r.x0, r.x1), y = ri(r.y0, r.y1);
        if (!isFloor(x, y) || protect.has(K(x, y)) || !wallNear(x, y) || nearDoor(r, x, y)) continue;
        if (others && others.some(o => Math.abs(o.x - x) + Math.abs(o.y - y) < (tries < 80 ? minGap : 2))) continue;
        if (tryBlock(r, x, y, x, y, ch)) return { x, y };
      }
      return null;
    }

    // ---- 특수 위치 먼저 ----
    // 격리실 A: 괴물 셀 (인트로)
    const cellTop = 2, cellBot = hA - 3;
    for (let y = cellTop; y <= cellBot; y++) for (let x = doorX - 2; x <= doorX + 3; x++) g[y][x] = (y === cellTop || y === cellBot || x === doorX - 2 || x === doorX + 3) ? "#" : ".";
    g[cellBot][doorX] = "."; g[cellTop + 1][doorX] = "M";
    protectRect(doorX - 1, cellBot, doorX, hA);
    const lobby = rooms.find(r => r.spawn);
    const lcx = Math.floor((lobby.x0 + lobby.x1) / 2), lcy = Math.floor((lobby.y0 + lobby.y1) / 2);
    protectRect(lcx - 4, lcy - 1, lcx + 4, lcy + 2);
    // 보안 출구: 바깥 벽(아래)에 문
    const exitR = rooms.find(r => r.exit);
    const ex = ri(exitR.x0 + 1, exitR.x1 - 1);
    g[H - 1][ex] = "E"; protectRect(ex, H - 3, ex, H - 2);
    // 인트로 복도 구간에는 사물함을 두지 않는다
    const introX0 = doorX - 1, introX1 = doorX + 16;

    // ---- 방 안 가구: 방마다 콘셉트에 맞는 소품 (props.js 글자) ----
    const PROP_OF = { phy: "p", chem: "b", bio: "u", heat: "h", earth: "k", monitor: "c", server: "r", archive: "a", medical: "d",
      meeting: "t", office: "o", lounge: "z", lobby: "q", power: "x", mech: "x", store: "s", cafeteria: "e", changing: "L" };
    for (const r of rooms) {
      const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1, P = PROP_OF[r.id] || "#";
      switch (r.kind) {
        case "benches": { for (let y = r.y0 + 2; y <= r.y1 - 2; y += ri(3, 4)) { const gap = ri(r.x0 + 2, r.x1 - 2); tryBlock(r, r.x0 + 2, y, gap - 1, y, P); tryBlock(r, gap + 2, y, r.x1 - 2, y, P); } break; }
        case "hoods": { for (let x = r.x0 + 1; x <= r.x1 - 1; x += ri(3, 4)) tryBlock(r, x, R() < 0.5 ? r.y0 : r.y1, x, R() < 0.5 ? r.y0 : r.y1, "f"); for (let y = r.y0 + 3; y <= r.y1 - 3; y += 4) { const x0 = ri(r.x0 + 2, r.x0 + 4); tryBlock(r, x0, y, Math.min(r.x1 - 3, x0 + ri(2, 5)), y, "b"); } break; }
        case "desks": { for (let y = r.y0 + 2; y <= r.y1 - 2; y += 3) for (let x = r.x0 + 2; x <= r.x1 - 3; x += ri(4, 6)) tryBlock(r, x, y, x + ri(1, 2), y, P); break; }
        case "racks": case "shelves": { let flip = R() < 0.5; for (let x = r.x0 + 2; x <= r.x1 - 2; x += ri(3, 4)) { if (flip) tryBlock(r, x, r.y0, x, r.y1 - 2, P); else tryBlock(r, x, r.y0 + 2, x, r.y1, P); flip = !flip; } break; }
        case "beds": { for (let x = r.x0 + 1; x <= r.x1 - 3; x += ri(3, 4)) { tryBlock(r, x, r.y0 + 1, x, r.y0 + 2, "d"); tryBlock(r, x, r.y1 - 2, x, r.y1 - 1, "d"); } for (let k = 0; k < 2; k++) placeAgainstWall(r, "m", 3, null); break; }
        case "pillars": { const sx = ri(5, 7); for (let y = r.y0 + 2; y <= r.y1 - 2; y += ri(4, 5)) for (let x = r.x0 + 3; x <= r.x1 - 3; x += sx) tryBlock(r, x, y, x, y); if (R() < 0.8) tryBlock(r, lcx - 2, lcy - 3, lcx + 2, lcy - 3, "q"); break; }
        case "table": { const tw = Math.max(2, Math.min(6, w - ri(6, 8))), th = Math.max(1, Math.min(3, h - ri(6, 7))); const tx = r.x0 + Math.floor((w - tw) / 2), ty = r.y0 + Math.floor((h - th) / 2); tryBlock(r, tx, ty, tx + tw - 1, ty + th - 1, "t"); break; }
        case "tables": { for (let y = r.y0 + 2; y <= r.y1 - 2; y += ri(3, 4)) for (let x = r.x0 + 2; x <= r.x1 - 3; x += ri(3, 5)) tryBlock(r, x, y, x + (R() < 0.5 ? 0 : 1), y, P); if (r.id === "lounge") for (let k = 0; k < 2; k++) placeAgainstWall(r, "v", 3, null); break; }
        case "machines": { const n = ri(3, 5); for (let k = 0; k < n * 4 && k < 50; k++) { const bw = ri(1, 2), bh = ri(1, 2), x = ri(r.x0 + 1, r.x1 - bw), y = ri(r.y0 + 1, r.y1 - bh); tryBlock(r, x, y, x + bw - 1, y + bh - 1, "x"); } break; }
        case "rows": { for (let x = r.x0 + 2; x <= r.x1 - 2; x += 3) { const gapTop = R() < 0.5; tryBlock(r, x, r.y0 + (gapTop ? 2 : 0), x, r.y1 - (gapTop ? 0 : 2), "L"); } break; }
        case "checkpoint": { const y = r.y0 + Math.floor(h / 2); const gx = ri(r.x0 + 2, r.x1 - 2); tryBlock(r, r.x0, y, gx - 2, y); tryBlock(r, gx + 2, y, r.x1, y); tryBlock(r, gx - 1, y, gx - 1, y, "g"); tryBlock(r, gx + 1, y, gx + 1, y, "g"); break; }
        case "cell": { const cx = ri(r.x0 + 1, Math.max(r.x0 + 1, r.x1 - 6)), cy = r.y0 + 1; if (w >= 8 && h >= 7) { tryBlock(r, cx, cy, cx + 5, cy) && tryBlock(r, cx, cy + 1, cx, cy + 3) && tryBlock(r, cx + 5, cy + 1, cx + 5, cy + 3) && tryBlock(r, cx + 1, cy + 3, cx + 2, cy + 3) && tryBlock(r, cx + 4, cy + 3, cx + 4, cy + 3); } break; }
      }
    }
    // CCTV실엔 CCTV 관제석이 꼭 하나 이상
    { const mon = rooms.find(r => r.id === "monitor"); if (mon && !g.slice(mon.y0, mon.y1 + 1).some(row => row.slice(mon.x0, mon.x1 + 1).includes("c"))) if (!placeAgainstWall(mon, "c", 0, null)) return null; }

    // ---- 단말기(에너지 셀) 14개 ----
    const cellRooms = rooms.filter(r => r.cells);
    const extra = pick(rooms.filter(r => r.band !== 0 && LABS.some(l => l.id === r.id)));
    const allF = [];
    for (const r of cellRooms) {
      const n = r.cells + (r === extra ? 1 : 0), mine = [];
      for (let k = 0; k < n; k++) { const p = placeAgainstWall(r, "F", 4, mine); if (!p) return null; mine.push(p); allF.push(p); }
    }
    if (allF.length !== 14) return null;
    // 발전기
    const powerR = rooms.find(r => r.generator);
    if (!placeAgainstWall(powerR, "B", 0, null)) return null;
    // 사물함: 방마다 1~3개
    for (const r of rooms) { if (r === contain) continue; const n = ri(1, 3), mine = []; for (let k = 0; k < n; k++) { const p = placeAgainstWall(r, "L", 3, mine); if (p) mine.push(p); } }
    // 복도 사물함
    for (const y of [yN, yM, yS]) {
      for (let k = 0; k < 7; k++) {
        const x = ri(4, W - 5), top = R() < 0.5, yy = top ? y : y + 1, wy = top ? y - 1 : y + 2;
        if (y === yN && x >= introX0 && x <= introX1) continue;
        if (g[wy][x] !== "#" || g[yy][x] !== "." || protect.has(K(x, yy))) continue;
        if ([-1, 0, 1].some(dx => g[wy][x + dx] === "." )) continue;           // 문 앞 피하기
        if (g[yy][x - 1] === "L" || g[yy][x + 1] === "L") continue;
        g[yy][x] = "L";
      }
    }
    // 시작 위치
    const spawn = [[-2, 0], [0, 0], [2, 0], [-2, 1], [0, 1], [2, 1]];
    for (const [dx, dy] of spawn) { if (!isFloor(lcx + dx, lcy + dy)) return null; g[lcy + dy][lcx + dx] = "S"; }

    // ---- 전체 연결 검사: 시작점에서 모든 바닥, 단말기, 발전기, 출구, 괴물 셀에 닿는지 ----
    const start = [lcx, lcy];
    const seen = new Set([K(start[0], start[1])]), q = [start];
    const pass = (x, y) => g[y] && (".SME".includes(g[y][x]));
    for (let qi = 0; qi < q.length; qi++) { const [x, y] = q[qi]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!g[ny] || nx < 0 || nx >= W) continue; const k = K(nx, ny); if (seen.has(k) || !pass(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if ((c === "." || c === "M" || c === "E") && !seen.has(K(x, y))) return null;
      if ((c === "F" || c === "B") && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(K(x + dx, y + dy)))) return null;
    }

    // ---- 구급상자 자리: 의무실 바닥 두 곳 ----
    const meds = [];
    { const med = rooms.find(r => r.id === "medical"); for (let t = 0; t < 200 && meds.length < 2; t++) { const x = ri(med.x0, med.x1), y = ri(med.y0, med.y1); if (g[y][x] === "." && !protect.has(K(x, y)) && !meds.some(m => Math.abs(m[0] - x) + Math.abs(m[1] - y) < 3)) meds.push([x + 0.5, y + 0.5]); } if (meds.length < 2) return null; }

    // ---- 인트로 좌표 (뒤집기 전 기준) ----
    const yNw = hA + 1;
    const intro = {
      cam: [doorX + 13.5, yN + 0.8], look: [doorX + 0.5, yN - 0.24],
      cell: [doorX + 0.5, cellTop + 1.3], cellDoor: [doorX + 0.5, cellBot + 0.5], door: [doorX + 0.5, yNw + 0.2],
      r1: [doorX + 1.5, yN + 0.6], r2: [doorX + 5.5, yN + 1.2], r3: [doorX + 9, yN + 1.5], r3end: [r3DoorX + 0.5, hA - 0.4],
      kill1: [doorX + 1.5, yN + 0.8], kill2: [doorX + 8.5, yN + 0.8], m1: [doorX + 1.3, yN + 0.4], m2: [doorX + 8, yN + 0.9],
      mstart: [doorX + 7.5, yN + 0.5], lunge: [doorX + 11.5, yN + 0.8], bodies: [],
    };
    intro.bodies.push([...intro.kill1, "body"], [...intro.kill2, "body2"]);
    const bodyRooms = shuffle(rooms.filter(r => !r.spawn && !r.exit && r !== contain)).slice(0, 4);
    for (const r of bodyRooms) { for (let t = 0; t < 30; t++) { const x = ri(r.x0, r.x1), y = ri(r.y0, r.y1); if (g[y][x] === "." && !protect.has(K(x, y))) { intro.bodies.push([x + 0.5, y + 0.5, R() < 0.5 ? "body" : "body2"]); break; } } }

    // ---- 좌우·상하 뒤집기 ----
    const fx = R() < 0.5, fy = R() < 0.5;
    const tx = x => fx ? W - 1 - x : x, ty = y => fy ? H - 1 - y : y;      // 칸
    const cx = x => fx ? W - x : x, cy = y => fy ? H - y : y;              // 연속 좌표
    const rows = [];
    for (let y = 0; y < H; y++) { let s = ""; for (let x = 0; x < W; x++) s += g[ty(y)][tx(x)]; rows.push(s); }
    const outRooms = rooms.map(r => ({ id: r.id, name: r.name, x0: Math.min(tx(r.x0), tx(r.x1)), y0: Math.min(ty(r.y0), ty(r.y1)), x1: Math.max(tx(r.x0), tx(r.x1)), y1: Math.max(ty(r.y0), ty(r.y1)), units: r.units, tex: r.tex }));
    const halls = [["hallW", "서쪽 통로", 1, 1, 2, H - 2], ["hallE", "동쪽 통로", W - 3, 1, W - 2, H - 2], ["hallN", "북쪽 복도", 1, yN, W - 2, yN + 1], ["hallM", "중앙 복도", 1, yM, W - 2, yM + 1], ["hallS", "남쪽 복도", 1, yS, W - 2, yS + 1]];
    const names = { hallW: fx ? "동쪽 통로" : "서쪽 통로", hallE: fx ? "서쪽 통로" : "동쪽 통로", hallN: fy ? "남쪽 복도" : "북쪽 복도", hallM: "중앙 복도", hallS: fy ? "북쪽 복도" : "남쪽 복도" };
    for (const [id, , x0, y0, x1, y1] of halls) outRooms.push({ id, name: names[id], x0: Math.min(tx(x0), tx(x1)), y0: Math.min(ty(y0), ty(y1)), x1: Math.max(tx(x0), tx(x1)), y1: Math.max(ty(y0), ty(y1)), units: [], tex: "hall" });
    const T = p => [cx(p[0]), cy(p[1])];
    const out = {};
    for (const k in intro) out[k] = k === "bodies" ? intro.bodies.map(b => [...T(b), b[2]]) : T(intro[k]);
    out.camA = Math.atan2(out.look[1] - out.cam[1], out.look[0] - out.cam[0]);
    return { rows, rooms: outRooms, intro: out, meds: meds.map(T) };
  }
  return { generate };
})();
