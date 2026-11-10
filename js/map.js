// 맵 정의: 밤의 과학관 1층
// # 벽  . 바닥  L 사물함(숨기)  F 퓨즈함  B 주배전반  E 탈출문  S 시작 위치  M 괴물 시작  = 복도 바닥(장식)
window.MAP_ROWS = [
  "################################################",
  "#......#...........#...........#.........#.....#",
  "#.L..F.#.F.......L.#.L...F.....#..F....L.#.F...#",
  "#......#...........#...........#.........#.....#",
  "#......#...........#...........#.........#.....#",
  "#......#...........#...........#.........#.....#",
  "#.F..L.#.....F...F.#.....F...L.#.L....F..#..L.F#",
  "#......#...........#...........#.........#.....#",
  "###.#####.#############.#############.#######.##",
  "#..............................................#",
  "#..............L...............L...............#",
  "#.S.S.S.S......................................#",
  "#.S.S..........L...............L...............#",
  "#..............................................#",
  "#######.################.##############.########",
  "#...........#...................#..............#",
  "#.L.........#.........L.........#.L............#",
  "#....B......#.........M.........#..............#",
  "#...........#.......L...........#..........L...#",
  "#############################################E##",
];
window.MAP_W = MAP_ROWS[0].length;
window.MAP_H = MAP_ROWS.length;

// 방 영역 (타일 좌표, 포함 범위) 과 단원
window.ROOMS = [
  { id: "phy",   name: "물리실",     x0: 1,  y0: 1,  x1: 6,  y1: 7,  units: ["force"] },
  { id: "chem",  name: "화학실",     x0: 8,  y0: 1,  x1: 18, y1: 7,  units: ["state", "gas"] },
  { id: "bio",   name: "생물실",     x0: 20, y0: 1,  x1: 30, y1: 7,  units: ["life"] },
  { id: "heat",  name: "열 실험실",  x0: 32, y0: 1,  x1: 40, y1: 7,  units: ["heat"] },
  { id: "earth", name: "지질 표본실",x0: 42, y0: 1,  x1: 46, y1: 7,  units: ["earth"] },
  { id: "hall",  name: "복도",       x0: 1,  y0: 9,  x1: 46, y1: 13, units: [] },
  { id: "power", name: "배전실",     x0: 1,  y0: 15, x1: 11, y1: 18, units: ["intro"] },
  { id: "store", name: "준비실",     x0: 13, y0: 15, x1: 31, y1: 18, units: [] },
  { id: "exit",  name: "출구",       x0: 33, y0: 15, x1: 46, y1: 18, units: [] },
];

window.MapUtil = (function () {
  const grid = MAP_ROWS.map(r => r.split(""));
  function tile(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "#";
    return grid[y][x];
  }
  function solid(x, y) {
    const t = tile(x, y);
    return t === "#" || t === "F" || t === "B" || t === "L";
  }
  // 탈출문은 열리기 전엔 벽처럼
  function solidFor(x, y, exitOpen) {
    const t = tile(x, y);
    if (t === "E") return !exitOpen;
    return solid(x, y);
  }
  function roomAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (const r of ROOMS) if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r;
    return null;
  }
  function find(ch) {
    const out = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (grid[y][x] === ch) out.push({ x, y });
    return out;
  }
  // 퓨즈함 목록: 방의 단원을 번갈아 배정
  function fuses() {
    const list = find("F");
    const counter = {};
    return list.map((p, i) => {
      const room = roomAt(p.x + 0.5, p.y + 0.5) || { id: "hall", units: ["intro"] };
      counter[room.id] = (counter[room.id] || 0);
      const unit = room.units[counter[room.id] % room.units.length];
      counter[room.id]++;
      return { id: i, x: p.x, y: p.y, unit, room: room.id, fixed: false };
    });
  }
  // BFS 경로 (타일 단위). 괴물용 — 사물함/퓨즈함 통과 불가, 탈출문 통과 불가
  function bfs(sx, sy, tx, ty) {
    sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
    if (solid(tx, ty) || tile(tx, ty) === "E") return null;
    const key = (x, y) => y * MAP_W + x;
    const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
    const q = [[sx, sy]];
    prev[key(sx, sy)] = key(sx, sy);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (solid(nx, ny) || tile(nx, ny) === "E") continue;
        if (prev[key(nx, ny)] !== -1) continue;
        prev[key(nx, ny)] = key(x, y);
        q.push([nx, ny]);
      }
    }
    if (prev[key(tx, ty)] === -1) return null;
    const path = [];
    let cur = key(tx, ty);
    while (cur !== key(sx, sy)) {
      path.push({ x: (cur % MAP_W) + 0.5, y: Math.floor(cur / MAP_W) + 0.5 });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }
  // 시야선: 두 점 사이 벽이 있는지
  function los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist * 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t, y = y0 + dy * t;
      if (solid(Math.floor(x), Math.floor(y))) return false;
    }
    return true;
  }
  // 원형 충돌 이동
  function move(px, py, vx, vy, r, exitOpen) {
    let nx = px + vx, ny = py;
    if (!hits(nx, ny, r, exitOpen)) px = nx;
    ny = py + vy;
    if (!hits(px, ny, r, exitOpen)) py = ny;
    return { x: px, y: py };
  }
  function hits(cx, cy, r, exitOpen) {
    const x0 = Math.floor(cx - r), x1 = Math.floor(cx + r);
    const y0 = Math.floor(cy - r), y1 = Math.floor(cy + r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!solidFor(x, y, exitOpen)) continue;
      const nx = Math.max(x, Math.min(cx, x + 1));
      const ny = Math.max(y, Math.min(cy, y + 1));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) return true;
    }
    return false;
  }
  const floorTiles = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (grid[y][x] === "." || grid[y][x] === "S" || grid[y][x] === "M") floorTiles.push({ x: x + 0.5, y: y + 0.5 });
  function randomFloor(rng) {
    return floorTiles[Math.floor((rng || Math.random)() * floorTiles.length)];
  }
  return { tile, solid, solidFor, roomAt, find, fuses, bfs, los, move, hits, randomFloor, grid };
})();
