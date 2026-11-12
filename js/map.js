// 맵 정의: 밤의 과학관 1층
// # 벽  . 바닥  L 사물함(숨기)  F 퓨즈함  B 주배전반  E 탈출문  S 시작 위치  M 괴물 시작  = 복도 바닥(장식)
window.MAP_ROWS = [
  "####################################################################################",
  "#..#L.........#L.........#L...............#L...........#L...........#L..........#..#",
  "#..#..........#..........#................#..#..#..#.F.#..#..#..#...#...........#..#",
  "#..#..######..#..######..#................#..#..#..#...#..#..#..#...#..###..###.#..#",
  "#..#..#.M..#..#..#....#..#..#####.######..#..#..#..#...#..#..#..#...#...........#..#",
  "#..#..#....#.....#.......#................#..#..#..#......#..#..#...#...........#..#",
  "#L....#....#..#..#....#...................#............#..#..#..#...#..............#",
  "#..#..##.###..#..######..#..######.#####..#...#..#..#..#............#..###..###.#..#",
  "#..#..........#..........#....................#..#..#..#........................#..#",
  "#..#..........#..........#.F..............#...#..#..#..#............#.........F.#..#",
  "#..#.........L#.........L#...............L#...........L#...........L#..........L#..#",
  "#..#####.##########.##########.########.########.############.############.######..#",
  "#.........................L.................L.................L....................#",
  "#..................................................................................#",
  "#..###.#########.###########.#####.#########.#######.##########.###########.#####.L#",
  "#..#L..............#L................#L..................#L...........#L........#..#",
  "#..#.F.............#...##...F...##...#...#...#...#...#.F.#..........F.#.......F.#..#",
  "#..#...####.####...#...##.......##...#...#...#...#...#...#..###..###..#..#...#..#..#",
  "#..#...............#...##.......##.......#...#...#...#...#............#..#...#..#..#",
  "#..#...................##.......##...#...#...#...#...#...#............#..#...#.....#",
  "#..................#...##.......##...#...#...#...#...#................#..#...#..#..#",
  "#..#...###.#####...#.................#...................#..###..###..#..#...#..#..#",
  "#L.#...............#......#####......#..#######.#######..#...............#...#..#..#",
  "#..#.............F.#.F.............F.#...................#............#.........#..#",
  "#..#..............L#................L#.F................L#.F.........L#.F......L#..#",
  "#..######.##############.###############.#########.###############.######.#######..#",
  "#..................................................................................#",
  "#.............L.................L.................L.................L..............#",
  "#..###.###########.##########.###########.##############.###############.########..#",
  "#..#L.............................#L...........#L...............#L..............#..#",
  "#..#..............................#............#................#...............#.L#",
  "#..#.....#......#......#......#...#............#...#...#...#........##...##.....#..#",
  "#..#..............................#...######...#...#...#...#....#...##...##.....#..#",
  "#............########.............#...######...#................#..................#",
  "#..#..................................######...#................#...............#..#",
  "#..#.............S.S.S............#...######...#...#...#...#....#...##...##.....#..#",
  "#..#.....#......#......#......#...#................#...#...#....#...##...##.....#..#",
  "#..#.............S.S.S............#............#................#...............#..#",
  "#L.#.............................L#...........L#...............L#..............L#..#",
  "#..#########.#############.###########.#####################.#########.##########..#",
  "#..................................................................................#",
  "#...................L.................L.................L.................L........#",
  "#..#######.#############.###########.##############.##############.#########.####..#",
  "#..#L.............#L...........#L.........#L.................#L........#L.......#..#",
  "#..#..............#.......................#..................#.........#........#..#",
  "#..#..............#..###..###..#..#...#...#..................#..#...............#..#",
  "#..#...#######....#..###..###..#..#...#...#...##...##...##...#..#......#........#.L#",
  "#..#..............#..###..###..#..#...#...#.....................#..#...#........#..#",
  "#.................#............#..#...#...#..................#..#..#...#..#.##..#..#",
  "#..#..............#............#..#...#...#..................#.....#...#........#..#",
  "#..#...#######....#..###..###..#..#...#...#...##...##...##...#.....#...#...........#",
  "#..#..............#..###..###..#..#...#...#..................#.....#...#........#..#",
  "#..#.................###..###..#..#...#...#..................#.....#...#........#..#",
  "#..#.B............#............#.............................#.........#........#..#",
  "#..#.............L#...........L#.........L#.................L#........L#.......L#..#",
  "############################################################################E#######",
];
window.MAP_W = MAP_ROWS[0].length;
window.MAP_H = MAP_ROWS.length;

// 방 영역 (타일 좌표, 포함 범위) 과 단원
window.ROOMS = [
  {"id": "hallW", "name": "서쪽 통로", "x0": 1, "y0": 1, "x1": 2, "y1": 54, "units": [], "tex": "hall"},
  {"id": "hallE", "name": "동쪽 통로", "x0": 81, "y0": 1, "x1": 82, "y1": 54, "units": [], "tex": "hall"},
  {"id": "hallN", "name": "북쪽 복도", "x0": 3, "y0": 12, "x1": 80, "y1": 13, "units": [], "tex": "hall"},
  {"id": "hallM", "name": "중앙 복도", "x0": 3, "y0": 26, "x1": 80, "y1": 27, "units": [], "tex": "hall"},
  {"id": "hallS", "name": "남쪽 복도", "x0": 3, "y0": 40, "x1": 80, "y1": 41, "units": [], "tex": "hall"},
  {"id": "contain1", "name": "격리실 A", "x0": 4, "y0": 1, "x1": 13, "y1": 10, "units": [], "tex": "contain"},
  {"id": "contain2", "name": "격리실 B", "x0": 15, "y0": 1, "x1": 24, "y1": 10, "units": [], "tex": "contain"},
  {"id": "monitor", "name": "CCTV실", "x0": 26, "y0": 1, "x1": 41, "y1": 10, "units": ["intro"], "tex": "lab"},
  {"id": "server", "name": "서버실", "x0": 43, "y0": 1, "x1": 54, "y1": 10, "units": ["intro"], "tex": "power"},
  {"id": "archive", "name": "기록 보관실", "x0": 56, "y0": 1, "x1": 67, "y1": 10, "units": [], "tex": "lab"},
  {"id": "medical", "name": "의무실", "x0": 69, "y0": 1, "x1": 79, "y1": 10, "units": ["life"], "tex": "lab"},
  {"id": "phy", "name": "물리 실험실", "x0": 4, "y0": 15, "x1": 18, "y1": 24, "units": ["force"], "tex": "lab"},
  {"id": "chem", "name": "화학 분석실", "x0": 20, "y0": 15, "x1": 36, "y1": 24, "units": ["state", "gas"], "tex": "lab"},
  {"id": "bio", "name": "생물 배양실", "x0": 38, "y0": 15, "x1": 56, "y1": 24, "units": ["life"], "tex": "lab"},
  {"id": "heat", "name": "열 실험실", "x0": 58, "y0": 15, "x1": 69, "y1": 24, "units": ["heat"], "tex": "lab"},
  {"id": "earth", "name": "지질 시료실", "x0": 71, "y0": 15, "x1": 79, "y1": 24, "units": ["earth"], "tex": "lab"},
  {"id": "lobby", "name": "중앙 홀", "x0": 4, "y0": 29, "x1": 33, "y1": 38, "units": [], "tex": "hall"},
  {"id": "meeting", "name": "회의실", "x0": 35, "y0": 29, "x1": 46, "y1": 38, "units": [], "tex": "lab"},
  {"id": "office", "name": "사무실", "x0": 48, "y0": 29, "x1": 63, "y1": 38, "units": [], "tex": "lab"},
  {"id": "lounge", "name": "휴게실", "x0": 65, "y0": 29, "x1": 79, "y1": 38, "units": [], "tex": "hall"},
  {"id": "power", "name": "비상 발전기실", "x0": 4, "y0": 43, "x1": 17, "y1": 54, "units": ["intro"], "tex": "power"},
  {"id": "mech", "name": "기계·환기실", "x0": 19, "y0": 43, "x1": 30, "y1": 54, "units": [], "tex": "power"},
  {"id": "changing", "name": "탈의실", "x0": 32, "y0": 43, "x1": 41, "y1": 54, "units": [], "tex": "hall"},
  {"id": "cafeteria", "name": "구내식당", "x0": 43, "y0": 43, "x1": 60, "y1": 54, "units": [], "tex": "lab"},
  {"id": "store", "name": "자재 창고", "x0": 62, "y0": 43, "x1": 70, "y1": 54, "units": [], "tex": "power"},
  {"id": "exit", "name": "보안 출구", "x0": 72, "y0": 43, "x1": 79, "y1": 54, "units": [], "tex": "hall"},
];

window.INTRO = {"cam": [21.5, 12.8], "camA": 3.22, "cell": [8.5, 5.2], "cellDoor": [8.5, 7.5], "r3": [17.0, 13.5], "r3end": [19.5, 9.6], "m1": [9.3, 12.4], "m2": [16.0, 12.9], "lunge": [19.5, 12.8], "door": [8.5, 11.0], "r1": [9.5, 12.6], "r2": [13.5, 13.2], "kill1": [9.5, 12.8], "kill2": [16.5, 12.8], "mstart": [15.5, 12.5], "bodies": [[9.5, 12.8, "body"], [16.5, 12.8, "body2"], [30.5, 8.5, "body2"], [46.5, 33.5, "body"], [75.5, 46.5, "body2"], [2.0, 20.5, "body"]]};

window.MapUtil = (function () {
  let grid = MAP_ROWS.map(r => r.split(""));
  function tile(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "#";
    return grid[y][x];
  }
  function solid(x, y) {
    const t = tile(x, y);
    return t === "#" || t === "F" || t === "B" || t === "L" || isProp(t);
  }
  // 방 소품(props.js): 모두 지나갈 수 없고, 키 큰 것만 시야를 가린다
  function isProp(t) { return !!(window.PROPS && PROPS[t]); }
  function isTall(t) { return !!(window.PROPS && PROPS[t] && PROPS[t].tall); }
  // 탈출문은 열리기 전엔 벽처럼
  function solidFor(x, y, exitOpen) {
    const t = tile(x, y);
    if (t === "E") return !exitOpen;
    return solid(x, y);
  }
  function roomAt(x, y) { return roomIndex[Math.floor(y) * MAP_W + Math.floor(x)] || null; }
  function floorAt(x, y) { return floors.find(f => y >= f.y0 && y < f.y1 + 1)?.id || 0; }
  function sameFloor(a, b) { return floorAt(a.x, a.y) === floorAt(b.x, b.y); }
  function floorInfo(id) { return floors.find(f => f.id === id) || floors[0]; }
  function stairAt(x, y) { return stairIndex.get(Math.floor(y) * MAP_W + Math.floor(x)); }
  function nearStair(x, y) { return stairs.find(s => s.floor === floorAt(x,y) && Math.hypot(s.x+0.5-x,s.y+0.5-y) < 1.45 && los(x,y,s.x+0.5,s.y+0.5)); }

  function find(ch) { return tileIndex[ch] || []; }
  // 퓨즈함 목록: 방의 단원을 번갈아 배정
  function fuses() {
    const list = find("F");
    const counter = {};
    return list.map((p, i) => {
      const room = roomAt(p.x + 0.5, p.y + 0.5) || { id: "hall1", units: ["intro"] };
      counter[room.id] = (counter[room.id] || 0);
      const units = room.units.length ? room.units : ["intro"];
      const unit = units[counter[room.id] % units.length];
      counter[room.id]++;
      return { id: i, x: p.x, y: p.y, unit, room: room.baseId || room.id, fixed: false };
    });
  }
  // BFS 경로 (타일 단위). 괴물용 — 사물함/퓨즈함 통과 불가, 탈출문 통과 불가
  function bfs(sx, sy, tx, ty) {
    sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
    if (solid(tx, ty) || tile(tx, ty) === "E") return null;
    const key = (x, y) => y * MAP_W + x;
    const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
    const q = [[sx, sy]]; let qi = 0;
    prev[key(sx, sy)] = key(sx, sy);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (qi < q.length) {
      const [x, y] = q[qi++];
      if (x === tx && y === ty) break;
      const step = dirs.map(([dx,dy]) => [x+dx,y+dy]);
      const stair = stairAt(x,y); if (stair) step.push([Math.floor(stair.to.x),Math.floor(stair.to.y)]);
      for (const [nx, ny] of step) {
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
  // 시야선: 두 점 사이 벽(또는 사물함)이 있는지 — 단말기·발전기는 시야를 막지 않음
  function opaque(x, y) { const t = tile(x, y); return t === "#" || t === "L" || t === "E" || isTall(t); }
  function los(x0, y0, x1, y1) {
    if (floorAt(x0,y0) !== floorAt(x1,y1)) return false;
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist * 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t, y = y0 + dy * t;
      if (opaque(Math.floor(x), Math.floor(y))) return false;
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
  let floorTiles = [];
  function indexFloor() { floorTiles = []; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (grid[y][x] === "." || grid[y][x] === "S" || grid[y][x] === "M") floorTiles.push({ x: x + 0.5, y: y + 0.5 }); }
  indexFloor();
  // 판마다 새 지도로 교체 (MapGen 결과)
  let seed = 0;
  const CLASSIC = { rows: MAP_ROWS, rooms: ROOMS, intro: INTRO, seed: 0 };
  let floors = [{id:1,name:"1층",y0:0,y1:MAP_H-1}], stairs = [], stairIndex = new Map(), tileIndex = {}, roomIndex = [];
  function load(m) {
    cur = null;
    if (!m) m = CLASSIC;
    if (window.Building) m = Building.expand(m);
    window.MAP_ROWS = m.rows; window.MAP_W = m.rows[0].length; window.MAP_H = m.rows.length;
    window.ROOMS = m.rooms; window.INTRO = m.intro;
    grid = m.rows.map(r => r.split("")); seed = m.seed || 0;
    floors = m.floors || [{id:1,name:"1층",y0:0,y1:MAP_H-1}]; stairs = m.stairs || [];
    stairIndex = new Map(stairs.map(s=>[s.y*MAP_W+s.x,s]));
    tileIndex = {}; roomIndex = [];
    for (let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) (tileIndex[grid[y][x]] ||= []).push({x,y});
    // 먼저 정의된 방 우선순위를 유지하며 렌더링 때 반복 탐색을 없앤다.
    for (const r of ROOMS) for(let y=r.y0;y<=r.y1;y++) for(let x=r.x0;x<=r.x1;x++) if(!roomIndex[y*MAP_W+x])roomIndex[y*MAP_W+x]=r;
    indexFloor();
    indexProps();
    // 구급상자 자리: 지도에 없으면(기본 지도) 의무실 바닥에서 두 곳
    if (m.meds) window.MEDKITS = m.meds.map(a => ({ x: a[0], y: a[1] }));
    else { const r = ROOMS.find(r => r.id === "medical"); const out = []; if (r) for (let y = r.y0 + 1; y <= r.y1 - 1 && out.length < 2; y += 3) for (let x = r.x0 + 1; x <= r.x1 - 1 && out.length < 2; x += 5) if (grid[y][x] === ".") out.push({ x: x + 0.5, y: y + 0.5 }); window.MEDKITS = out; }
    return true;
  }
  let propList = [];
  function indexProps() { propList = []; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isProp(grid[y][x])) propList.push({ x, y, ch: grid[y][x] }); }
  function randomFloor(rng) {
    return floorTiles[Math.floor((rng || Math.random)() * floorTiles.length)];
  }
  // 팀마다 다른 지도: 불러 둔 지도 상태를 통째로 저장했다가 순간 교체한다 (교사 기기에서 팀별 계산 전에)
  let cur = null;
  function state() { cur = { rows: window.MAP_ROWS, W: MAP_W, H: MAP_H, rooms: ROOMS, intro: INTRO, meds: window.MEDKITS, grid, seed, floors, stairs, stairIndex, tileIndex, roomIndex, floorTiles, propList }; return cur; }
  function use(st) {
    if (!st || st === cur) return; cur = st;
    window.MAP_ROWS = st.rows; window.MAP_W = st.W; window.MAP_H = st.H; window.ROOMS = st.rooms; window.INTRO = st.intro; window.MEDKITS = st.meds;
    grid = st.grid; seed = st.seed; floors = st.floors; stairs = st.stairs; stairIndex = st.stairIndex; tileIndex = st.tileIndex; roomIndex = st.roomIndex; floorTiles = st.floorTiles; propList = st.propList;
  }
  load(null);
  return { state, use, floorAt, sameFloor, floorInfo, stairAt, nearStair, get floors() { return floors; }, get stairs() { return stairs; }, tile, solid, solidFor, opaque, roomAt, find, fuses, bfs, los, move, hits, randomFloor, load, isProp, get props() { return propList; }, get grid() { return grid; }, get seed() { return seed; } };
})();
