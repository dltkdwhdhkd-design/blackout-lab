// 호스트 쪽 시뮬레이션 — 팀마다 독립된 세계(괴물·퓨즈·소음)를 돌린다
window.Sim = (function () {
  const PLAYER_SPEED = 3.0;
  const INTRO_LEN = 15;
  const DEFAULTS = { timeLimit: 1200, monsterCount: 2, safeTime: 75, monsterSpeed: 1.0, requiredFuses: 9, teamSize: 4, scare: 2, intro: 1, mapMode: 1 };

  function createWorld(team, settings) {
    const mf = MapUtil.find("M")[0];
    const m0 = window.INTRO ? { x: INTRO.mstart[0] - 0.5, y: INTRO.mstart[1] - 0.5 } : mf;
    const world = {
      introT: settings.intro ? INTRO_LEN : 0,
      team, settings,
      players: new Map(),
      monster: { x: m0.x + 0.5, y: m0.y + 0.5, state: "sleep", path: [], target: null, targetId: null, lastSeen: null, timer: 0, perc: 0, repath: 0, speed: 0, a: 0, loseLos: 0 },
      fuses: MapUtil.fuses(),
      breaker: { stage: 0, fixed: false, busy: null, busyT: 0 },
      exitOpen: false, noise: 0, time: settings.timeLimit, elapsed: 0,
      phase: "play", usedQ: {}, wrongs: [], events: [], escaped: 0, result: null,
      wokeAnnounced: false,
      inserted: 0, drops: [], dropSeq: 0,                                   // 발전기에 넣은 셀, 바닥에 떨어진 셀
      medkits: (window.MEDKITS || []).map((m, i) => ({ id: i, x: m.x, y: m.y, taken: false })),
      cctv: { until: 0, cool: 0, busy: null, busyT: 0 },
    };
    world.monsters = [world.monster];
    if (settings.monsterCount !== 1) {
      const room = ROOMS.find(r => r.floor === 2 && r.baseId === "contain1");
      const entry = MapUtil.stairs.find(s => s.floor === 2);
      let x = entry ? entry.x + 0.5 : m0.x + 0.5, y = entry ? entry.y + 0.5 : m0.y + 0.5;
      if (room) outer: for (let ty=room.y0;ty<=room.y1;ty++) for(let tx=room.x0;tx<=room.x1;tx++) if(!MapUtil.solid(tx,ty)){x=tx+0.5;y=ty+0.5;break outer;}
      world.monsters.push({...world.monster,x,y,state:"dormant",path:[],target:null,targetId:null});
    }
    return world;
  }

  function addPlayer(w, id, name) {
    const spawns = MapUtil.find("S");
    const s = spawns[w.players.size % spawns.length];
    w.players.set(id, { id, name, x: s.x + 0.5, y: s.y + 0.5, a: 0, down: false, downT: 0, hid: null, hidT: 0, seenHide: false, escaped: false, rev: 0, revT: 0, lastPos: -9, caught: 0, light: true, carry: 0, medkit: false, travelRev: 0, stairAt: -9 });
  }

  // 이번 판에 안 나온 문제 → 그중에서도 최근 판들(교사 기기에 기록)에 안 나온 문제를 먼저
  function pickQuestion(w, unit) {
    const bank = QUESTION_BANK[unit]; if (!bank) return -1;
    const used = w.usedQ[unit] || (w.usedQ[unit] = []);
    let pool = bank.items.map((_, i) => i).filter(i => !used.includes(i));
    if (!pool.length) { used.length = 0; pool = bank.items.map((_, i) => i); }
    if (w.avoid && w.avoid.size) { const fresh = pool.filter(i => !w.avoid.has(unit + ":" + i)); if (fresh.length) pool = fresh; }
    const qi = pool[Math.floor(Math.random() * pool.length)];
    used.push(qi);
    return qi;
  }
  // 보기 순서 섞기: perm[화면 위치] = 원래 보기 번호
  function shuffledPerm(n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const ALL_UNITS = () => Object.keys(QUESTION_BANK);

  function emit(w, ev) { w.events.push(ev); }

  // 클라이언트 메시지 처리
  function handle(w, from, m) {
    const p = w.players.get(from);
    if (!p) return;
    switch (m.t) {
      case "pos":
        if (p.down || p.escaped || (m.rev || 0) !== p.travelRev || !Number.isFinite(m.x) || !Number.isFinite(m.y) || !MapUtil.sameFloor(p,m)) break;
        if (Math.hypot(m.x - p.x, m.y - p.y) > 0.02) p.lastPos = w.elapsed; // 실제로 움직였을 때만 '발소리'
        p.x = m.x; p.y = m.y; p.a = m.a;
        if (m.l !== undefined) p.light = !!m.l;
        break;
      case "stairs": {
        const stair = MapUtil.stairs.find(s => s.id === m.id);
        if (!stair || w.phase !== "play" || w.introT > 0 || p.down || p.escaped || p.hid || (m.rev || 0) !== p.travelRev || w.elapsed-p.stairAt < 1) break;
        if (stair.floor !== MapUtil.floorAt(p.x,p.y) || Math.hypot(p.x-stair.x-0.5,p.y-stair.y-0.5) > 1.65 || !MapUtil.los(p.x,p.y,stair.x+0.5,stair.y+0.5)) break;
        clearQuestion(w,from); p.x=stair.to.x; p.y=stair.to.y; p.travelRev++; p.stairAt=w.elapsed; p.lastPos=w.elapsed;
        emit(w,{k:"stairs",id:from,name:p.name,floor:stair.to.floor});
        break;
      }
      case "hide": {
        if (p.down || p.escaped) break;
        if (!p.hid) p.hidePrev = { x: p.x, y: p.y, a: p.a };
        p.hid = { x: m.x, y: m.y }; p.hidT = w.elapsed;
        if (m.l !== undefined) p.light = !!m.l;
        // 숨는 모습을 '실제로 본' 경우만 들킨다: 평소 시야 규칙과 똑같이(손전등 켬 12칸, 끔이면 정면 6칸·등 뒤 2.5칸)
        p.seenHide = w.monsters.some(mo => mo.state !== "sleep" && mo.state !== "dormant" && mo.state !== "feed" && canSee(mo, p));
        break;
      }
      case "unhide": leaveHiding(w, p); break;
      case "q": {
        if (p.down || p.escaped || w.phase !== "play") break;
        if (m.fuse === -1) {
          const b = w.breaker;
          if (b.fixed) break;
          if (p.carry > 0) { w.inserted += p.carry; emit(w, { k: "insert", id: from, by: p.name, n: p.carry, total: w.inserted, need: w.settings.requiredFuses }); p.carry = 0; break; }
          if (b.cool && w.elapsed < b.cool) { emit(w, { k: "cool", id: from, left: Math.ceil(b.cool - w.elapsed) }); break; }
          if (!requiredMet(w)) { emit(w, { k: "locked", id: from, need: w.settings.requiredFuses - w.inserted }); break; }
          if (b.busy && b.busy !== from && w.elapsed - b.busyT < 30) break;
          const unit = b.stage === 0 ? "intro" : ALL_UNITS()[Math.floor(Math.random() * ALL_UNITS().length)];
          const qi = pickQuestion(w, unit);
          b.busy = from; b.busyT = w.elapsed; b.unit = unit; b.qi = qi; b.perm = shuffledPerm(QUESTION_BANK[unit].items[qi].c.length);
          emit(w, { k: "q", id: from, fuse: -1, unit, qi, perm: b.perm, stage: b.stage });
        } else if (m.fuse === -2) {
          // CCTV 관제석: 맞히면 20초 동안 팀 전체에 괴물·장비 위치가 보인다
          const c = w.cctv;
          if (w.elapsed < c.until) { emit(w, { k: "cctvon", id: from, left: Math.ceil(c.until - w.elapsed) }); break; }
          if (w.elapsed < c.cool) { emit(w, { k: "cool", id: from, left: Math.ceil(c.cool - w.elapsed) }); break; }
          if (c.busy && c.busy !== from && w.elapsed - c.busyT < 30) break;
          const unit = ALL_UNITS()[Math.floor(Math.random() * ALL_UNITS().length)];
          const qi = pickQuestion(w, unit);
          c.busy = from; c.busyT = w.elapsed; c.unit = unit; c.qi = qi; c.perm = shuffledPerm(QUESTION_BANK[unit].items[qi].c.length);
          emit(w, { k: "q", id: from, fuse: -2, unit, qi, perm: c.perm });
        } else {
          const f = w.fuses[m.fuse]; if (!f || f.fixed) break;
          if (p.carry >= 2) { emit(w, { k: "full", id: from }); break; }
          if (f.cool && w.elapsed < f.cool) { emit(w, { k: "cool", id: from, left: Math.ceil(f.cool - w.elapsed) }); break; }
          if (f.busy && f.busy !== from && w.elapsed - f.busyT < 30) break;
          const qi = pickQuestion(w, f.unit);
          f.busy = from; f.busyT = w.elapsed; f.qi = qi; f.perm = shuffledPerm(QUESTION_BANK[f.unit].items[qi].c.length);
          emit(w, { k: "q", id: from, fuse: f.id, unit: f.unit, qi, perm: f.perm });
        }
        break;
      }
      case "ans": {
        if (w.phase !== "play") break;
        let unit, qi, pos, target;
        if (m.fuse === -1) { const b = w.breaker; if (b.busy !== from || b.fixed) break; unit = b.unit; qi = b.qi; target = b; pos = MapUtil.find("B")[0]; }
        else if (m.fuse === -2) { const c = w.cctv; if (c.busy !== from) break; unit = c.unit; qi = c.qi; target = c; pos = { x: Math.floor(p.x), y: Math.floor(p.y) }; }
        else { const f = w.fuses[m.fuse]; if (!f || f.busy !== from || f.fixed) break; unit = f.unit; qi = f.qi; target = f; pos = f; }
        const item = QUESTION_BANK[unit] && QUESTION_BANK[unit].items[qi];
        // 학생은 화면 위치를 보낸다 → 원래 보기 번호로 바꿔서 채점 (시간 초과는 -1)
        const chosen = m.chosen >= 0 && target.perm ? target.perm[m.chosen] : m.chosen;
        m = { ...m, chosen };
        const ok = !!item && chosen === item.a;
        target.busy = null;
        if (ok) {
          if (m.fuse === -2) { target.until = w.elapsed + 20; target.cool = w.elapsed + 60; emit(w, { k: "cctv", id: from, by: p.name, secs: 20 }); break; }
          if (m.fuse === -1) {
            w.breaker.stage++;
            if (w.breaker.stage >= 1) { w.breaker.fixed = true; w.exitOpen = true; emit(w, { k: "exit" }); }
          } else { target.fixed = true; p.carry++; }
          emit(w, { k: "fuse", fuse: m.fuse, ok: true, by: p.name, id: from, stage: w.breaker.stage, carry: p.carry });
          
        } else {
          w.wrongs.push({ name: p.name, unit, qi, chosen: m.chosen });
          target.cool = w.elapsed + 15;
          emit(w, { k: "fuse", fuse: m.fuse, ok: false, by: p.name, id: from, qi, unit, chosen: m.chosen });
          alertMonster(w, pos.x + 0.5, pos.y + 0.5);
        }
        break;
      }
      case "rev": {
        const t = w.players.get(m.target);
        if (!t || !t.down || p.down || p.escaped) break;
        if (Math.hypot(t.x - p.x, t.y - p.y) > 1.6) break;
        t.revT = w.elapsed; t.reviver = from;
        break;
      }
      case "med": {   // 구급상자 줍기
        const mk = w.medkits[m.id];
        if (!mk || mk.taken || p.medkit || p.down || p.escaped) break;
        if (Math.hypot(mk.x - p.x, mk.y - p.y) > 1.6) break;
        mk.taken = true; p.medkit = true; emit(w, { k: "medkit", id: from, by: p.name });
        break;
      }
      case "cancelq": {
        if (m.fuse === -2) { if (w.cctv.busy === from) w.cctv.busy = null; break; }
        if (m.fuse === -1) { if (w.breaker.busy === from) w.breaker.busy = null; }
        else { const f = w.fuses[m.fuse]; if (f && f.busy === from) f.busy = null; }
        break;
      }
    }
  }

  function alertMonster(w, x, y) {
    let heard = false;
    for (const mo of w.monsters) {
      if (["sleep","dormant","feed","chase"].includes(mo.state)) continue;
      mo.state = "hunt"; mo.alerted = true; mo.target = { x, y }; mo.path = MapUtil.bfs(mo.x, mo.y, x, y) || []; mo.repath = 0; heard = true;
    }
    if (heard) emit(w, { k: "hunt" });
  }

  function randomRoomTarget(w) {
    const rooms = ROOMS.filter(r => r.id !== "exit");
    const weighted = [];
    for (const r of rooms) {
      let wgt = 1;
      if (w.fuses.some(f => f.room === r.id && !f.fixed)) wgt += 2;
      for (const p of w.players.values()) if (!p.down && !p.escaped && MapUtil.roomAt(p.x, p.y) === r) wgt += 2;
      for (let i = 0; i < wgt; i++) weighted.push(r);
    }
    const r = weighted[Math.floor(Math.random() * weighted.length)];
    for (let tries = 0; tries < 30; tries++) {
      const x = r.x0 + Math.floor(Math.random() * (r.x1 - r.x0 + 1));
      const y = r.y0 + Math.floor(Math.random() * (r.y1 - r.y0 + 1));
      if (!MapUtil.solid(x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
    return MapUtil.randomFloor();
  }

  function followPath(mo, speed, dt) {
    if (!mo.path.length) return true;
    const n = mo.path[0];
    if (!MapUtil.sameFloor(mo,n)) {
      const stair = MapUtil.stairAt(mo.x,mo.y);
      if (stair && Math.hypot(stair.to.x-n.x,stair.to.y-n.y)<0.1) { mo.x=n.x;mo.y=n.y;mo.path.shift();mo.speed=0;return false; }
      mo.path=[];return true;
    }
    const dx = n.x - mo.x, dy = n.y - mo.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) { mo.x = n.x; mo.y = n.y; mo.path.shift(); return mo.path.length === 0; }
    mo.x += dx / d * step; mo.y += dy / d * step; mo.a = Math.atan2(dy, dx);
    mo.speed = speed;
    return false;
  }

  function tickMonster(w, dt, mo) {
    if (mo.state === "dormant") return;
    const S = w.settings.monsterSpeed;
    const noiseBoost = 1;
    const ROAM = 2.1 * S, HUNT = 2.8 * S, CHASE = 3.3 * S;
    mo.speed = 0;
    if (mo.state === "sleep") {
      if (w.elapsed >= w.settings.safeTime) { mo.state = "roam"; mo.path = []; emit(w, { k: "wake" }); }
      return;
    }
    if (mo.state === "feed") { mo.timer -= dt; if (mo.timer <= 0) { mo.state = "roam"; mo.path = []; mo.target = null; } return; }

    // 지각
    mo.perc += dt;
    if (mo.perc >= 0.25) {
      mo.perc = 0;
      let best = null, bd = 99, lit = null, ld = 99;
      for (const p of w.players.values()) {
        if (p.down || p.escaped || !MapUtil.sameFloor(p,mo)) continue;
        const d = Math.hypot(p.x - mo.x, p.y - mo.y);
        if (p.hid) {
          // 숨는 걸 봤거나, 지금도 틈으로 불빛이 새고 있으면 바로 앞에서 끌어낸다
          if ((p.seenHide || p.light) && d < 1.3) { catchPlayer(w, p, mo); return; }
          // 사물함 안에서 손전등을 켜 두면 틈으로 빛이 샌다
          if (p.light && d < 10) { const spot = lockerFront(mo, p.hid); if (spot && d < ld) { ld = d; lit = { p, x: spot.x, y: spot.y, locker: true }; } }
          continue;
        }
        // 직접 보기: 손전등을 켠 사람은 멀리서도 보인다.
        // 끈 사람은 괴물이 그쪽을 보고 있으면 6칸, 등지고 있으면 2.5칸 안에서 보인다.
        const seeLine = d < 12 && MapUtil.los(mo.x, mo.y, p.x, p.y);
        let da = Math.abs(Math.atan2(p.y - mo.y, p.x - mo.x) - mo.a) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
        const facing = da < 0.9;
        const range = p.light ? 12 : (facing ? 6 : 2.5);
        if (seeLine && d < range && d < bd) { bd = d; best = p; p.sus = 0; continue; }
        // 어둠 속에서 시야 안에 오래 있으면 의심이 쌓여 결국 들킨다 (가까울수록, 정면일수록 빠르게)
        if (seeLine && !p.light && d < 9) {
          p.sus = (p.sus || 0) + 0.25 * (facing ? 1 : 0.45) * (1.6 - d / 9);
          if (p.sus >= 1 && d < bd) { bd = d; best = p; p.sus = 0; continue; }
        } else p.sus = Math.max(0, (p.sus || 0) - 0.06);
        // 손전등 빛이 벽에 비친 자리를 보면 그쪽으로 온다 (모퉁이 너머에서도)
        if (p.light && d < 16 && d < ld) {
          const spot = beamSpot(p);
          if (Math.hypot(spot.x - mo.x, spot.y - mo.y) < 13 && MapUtil.los(mo.x, mo.y, spot.x, spot.y)) { ld = d; lit = { p, x: p.x, y: p.y }; }
        }
      }
      if (!best && lit && mo.state !== "chase") {
        const fresh = mo.state !== "hunt" || mo.lightId !== lit.p.id;
        mo.repath -= 0.25;
        if (fresh || mo.repath <= 0) {
          mo.state = "hunt"; mo.target = { x: lit.x, y: lit.y }; mo.path = MapUtil.bfs(mo.x, mo.y, lit.x, lit.y) || mo.path; mo.repath = 1.0; mo.lightId = lit.p.id;
          if (fresh) emit(w, { k: "light", id: lit.p.id, locker: !!lit.locker });
        }
      }
      if (mo.state !== "hunt") mo.lightId = null;
      if (!best && mo.state === "roam") {
        for (const p of w.players.values()) {
          if (p.down || p.escaped || p.hid) continue;
          if (w.elapsed - p.lastPos < 0.3 && Math.hypot(p.x - mo.x, p.y - mo.y) < 5.5 && Math.random() < 0.5) {
            mo.state = "hunt"; mo.target = { x: p.x, y: p.y }; mo.path = MapUtil.bfs(mo.x, mo.y, p.x, p.y) || []; emit(w, { k: "hunt" }); break;
          }
        }
      }
      if (best) {
        if (mo.state !== "chase") emit(w, { k: "spotted", id: best.id });
        mo.state = "chase"; mo.targetId = best.id; mo.lastSeen = { x: best.x, y: best.y }; mo.loseLos = 0;
      } else if (mo.state === "chase" && (!w.players.get(mo.targetId) || MapUtil.sameFloor(mo,w.players.get(mo.targetId)))) {
        mo.loseLos += 0.25;
        if (mo.loseLos > 2.2) { mo.state = "search"; mo.target = mo.lastSeen; mo.path = MapUtil.bfs(mo.x, mo.y, mo.target.x, mo.target.y) || []; mo.timer = 3.5; }
      }
    }

    if (mo.state === "chase") {
      const t = w.players.get(mo.targetId);
      if (!t || t.down || t.escaped || t.hid) { mo.state = "search"; mo.target = mo.lastSeen || { x: mo.x, y: mo.y }; mo.path = MapUtil.bfs(mo.x, mo.y, mo.target.x, mo.target.y) || []; mo.timer = 3; return; }
      if (!MapUtil.sameFloor(mo,t)) {
        mo.repath -= dt;
        if (mo.repath <= 0 || !mo.path.length) { mo.path = MapUtil.bfs(mo.x,mo.y,t.x,t.y) || []; mo.repath=1; }
        followPath(mo,CHASE,dt); return;
      }
      const d = Math.hypot(t.x - mo.x, t.y - mo.y);
      if (d < 0.75) { catchPlayer(w, t, mo); return; }
      mo.repath -= dt;
      if (mo.repath <= 0 || !mo.path.length) { mo.path = MapUtil.bfs(mo.x, mo.y, t.x, t.y) || []; mo.repath = 0.4; }
      let moved = false;
      if (d < 1.6 && MapUtil.los(mo.x, mo.y, t.x, t.y)) {
        // 바로 앞이면 직진 — 모서리에 걸려 못 나아가면 길찾기로
        const dx = t.x - mo.x, dy = t.y - mo.y; const st = CHASE * dt;
        const nxt = MapUtil.move(mo.x, mo.y, dx / d * st, dy / d * st, 0.3, false);
        if (Math.hypot(nxt.x - mo.x, nxt.y - mo.y) > st * 0.4) { mo.x = nxt.x; mo.y = nxt.y; mo.a = Math.atan2(dy, dx); mo.speed = CHASE; moved = true; }
      }
      if (!moved) { if (!mo.path.length) mo.path = MapUtil.bfs(mo.x, mo.y, t.x, t.y) || []; followPath(mo, CHASE, dt); }
      return;
    }
    if (mo.state === "hunt") {
      if (followPath(mo, HUNT, dt)) { mo.state = "search"; mo.timer = 4; }
      return;
    }
    if (mo.state === "search") {
      if (mo.path.length) followPath(mo, HUNT * 0.8, dt);
      else { mo.timer -= dt; mo.a += dt * 1.5; if (mo.timer <= 0) { mo.state = "roam"; mo.path = []; } }
      return;
    }
    // roam — 넓은 건물에서 길을 잃지 않도록 가끔 누군가의 기척을 느낀다
    mo.sense = (mo.sense === undefined ? 35 : mo.sense) - dt;
    if (mo.sense <= 0) {
      mo.sense = 28 + Math.random() * 24;
      const cands = [...w.players.values()].filter(p => !p.down && !p.escaped && !p.hid);
      if (cands.length) {
        const p = cands[Math.floor(Math.random() * cands.length)];
        const path = MapUtil.bfs(mo.x, mo.y, p.x + (Math.random() - 0.5) * 4, p.y + (Math.random() - 0.5) * 4) || MapUtil.bfs(mo.x, mo.y, p.x, p.y);
        if (path) { mo.state = "hunt"; mo.path = path; emit(w, { k: "hunt" }); return; }
      }
    }
    if (!mo.path.length) { const t = randomRoomTarget(w); mo.path = MapUtil.bfs(mo.x, mo.y, t.x, t.y) || []; if (!mo.path.length) mo.path = []; }
    followPath(mo, ROAM, dt);
  }

  function canSee(mo, p) {
    if (!MapUtil.sameFloor(mo, p)) return false;
    const d = Math.hypot(p.x - mo.x, p.y - mo.y);
    if (d >= 12 || !MapUtil.los(mo.x, mo.y, p.x, p.y)) return false;
    let da = Math.abs(Math.atan2(p.y - mo.y, p.x - mo.x) - mo.a) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
    return d < (p.light ? 12 : (da < 0.9 ? 6 : 2.5));
  }
  // 손전등 빛이 닿는 곳(앞쪽 벽까지 최대 7칸)
  function beamSpot(p) {
    const cx = Math.cos(p.a), cy = Math.sin(p.a);
    let x = p.x, y = p.y;
    for (let t = 0.3; t < 7; t += 0.25) {
      const nx = p.x + cx * t, ny = p.y + cy * t;
      if (MapUtil.opaque(Math.floor(nx), Math.floor(ny))) break;
      x = nx; y = ny;
    }
    return { x, y };
  }
  // 괴물이 볼 수 있는 사물함 앞 칸
  function lockerFront(mo, hid) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = hid.x + dx, ny = hid.y + dy;
      if (MapUtil.solid(nx, ny)) continue;
      if (MapUtil.los(mo.x, mo.y, nx + 0.5, ny + 0.5)) return { x: nx + 0.5, y: ny + 0.5 };
    }
    return null;
  }

  function leaveHiding(w, p) {
    if (p.hid) {
      const prev = p.hidePrev;
      if (prev && !MapUtil.solidFor(Math.floor(prev.x), Math.floor(prev.y), w.exitOpen)) {
        p.x = prev.x; p.y = prev.y; p.a = prev.a;
      } else if (MapUtil.solidFor(Math.floor(p.x), Math.floor(p.y), w.exitOpen)) {
        // 이전 버전에서 사물함 내부 좌표를 보낸 경우에도 바깥 바닥으로 꺼낸다.
        const spots = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: p.hid.x + dx, y: p.hid.y + dy }));
        const s = spots.find(s => !MapUtil.solidFor(s.x, s.y, w.exitOpen)) || MapUtil.find("S")[0];
        p.x = s.x + 0.5; p.y = s.y + 0.5;
      }
    }
    p.hid = null; p.hidePrev = null; p.seenHide = false;
  }
  function clearQuestion(w, id) {
    for (const target of [...w.fuses, w.breaker, w.cctv]) if (target.busy === id) target.busy = null;
  }
  function resumeState(w, id) {
    const p = w.players.get(id);
    return p ? { x: p.x, y: p.y, a: p.a, hid: p.hid, hidePrev: p.hidePrev || null, light: p.light, travelRev: p.travelRev } : null;
  }
  function result(w) {
    return { k: "end", result: w.result, escaped: w.escaped, total: w.players.size, wrongs: w.wrongs, fixed: w.inserted };
  }
  function catchPlayer(w, p, mo) {
    if (p.down || p.escaped) return;
    leaveHiding(w, p);
    p.down = true; p.downT = w.elapsed; p.rev = 0; p.revT = -9; p.caught++;
    mo.state = "feed"; mo.timer = 3.5; mo.targetId = null;
    emit(w, { k: "caught", id: p.id, name: p.name });
    // 잡으면 들고 있던 셀을 그 자리에 떨어뜨린다 (팀원이 주울 수 있음)
    if (p.carry > 0) { w.drops.push({ id: ++w.dropSeq, x: p.x, y: p.y, n: p.carry }); emit(w, { k: "drop", id: p.id, name: p.name, n: p.carry }); p.carry = 0; }
    clearQuestion(w, p.id);
    checkEnd(w);
  }

  function checkEnd(w) {
    if (w.phase !== "play") return;
    const alive = [...w.players.values()].filter(p => !p.escaped);
    if (!w.players.size) return;
    if (alive.length === 0) { end(w, "escaped"); return; }
    // 구급상자를 가진 사람은 곧 혼자 일어나므로 전멸이 아니다
    if (alive.every(p => p.down && !p.medkit)) { end(w, w.escaped > 0 ? "partial" : "lost"); return; }
    if (w.time <= 0) { end(w, w.escaped > 0 ? "partial" : "timeout"); }
  }
  function end(w, result) {
    w.phase = "end"; w.result = result;
    emit(w, { k: "end", result, escaped: w.escaped, total: w.players.size, wrongs: w.wrongs, fixed: w.inserted });
  }

  function tick(w, dt) {
    if (w.phase !== "play") return;
    if (w.introT > 0) { w.introT -= dt; return; }
    w.elapsed += dt; w.time -= dt;
    w.noise = Math.max(0, w.noise - 4 * dt);
    // 구조 / 자연 회복
    for (const p of w.players.values()) {
      if (p.down) {
        if (w.elapsed - p.revT < 0.35) { p.rev += dt; if (p.rev >= 3) { p.down = false; p.rev = 0; emit(w, { k: "revived", id: p.id, by: p.reviver }); } }
        else p.rev = Math.max(0, p.rev - dt * 0.5);
        if (w.elapsed - p.downT > 45) { p.down = false; p.rev = 0; emit(w, { k: "revived", id: p.id, self: true }); }
        else if (p.medkit && w.elapsed - p.downT > 6) { p.down = false; p.rev = 0; p.medkit = false; emit(w, { k: "revived", id: p.id, self: true, med: true }); }
      } else if (!p.escaped && !p.hid && p.carry < 2 && w.drops.length) {
        // 떨어진 셀 위를 지나가면 줍는다
        for (const d of w.drops) { if (d.n <= 0 || Math.hypot(d.x - p.x, d.y - p.y) > 0.9) continue; const take = Math.min(d.n, 2 - p.carry); d.n -= take; p.carry += take; emit(w, { k: "pickup", id: p.id, name: p.name, n: take }); if (p.carry >= 2) break; }
        w.drops = w.drops.filter(d => d.n > 0);
      }
      if (!p.down && !p.escaped && w.exitOpen) {
        if (MapUtil.tile(Math.floor(p.x), Math.floor(p.y)) === "E") {
          p.escaped = true; w.escaped++; emit(w, { k: "escaped", id: p.id, name: p.name });
        }
      }
    }
    const second = w.monsters[1];
    if (second && second.state === "dormant" && w.fuses.filter(f=>f.fixed).length >= secondAt(w)) {
      // 회수한 셀 기준. 2층에서 플레이어 바로 앞을 피해 출현한다.
      for(let tries=0;tries<200;tries++) { const at=MapUtil.randomFloor(); if(MapUtil.floorAt(at.x,at.y)!==2)continue;
        if([...w.players.values()].some(p=>!p.down&&!p.escaped&&MapUtil.sameFloor(p,at)&&Math.hypot(p.x-at.x,p.y-at.y)<8))continue;
        second.x=at.x;second.y=at.y;break;
      }
      second.state="roam";second.sense=8;emit(w,{k:"wake2",floor:2,threshold:secondAt(w)});
    }
    for (const mo of w.monsters) { if(w.phase !== "play") break; tickMonster(w, dt, mo); }
    checkEnd(w);
  }

  function snapshot(w) {
    const mo = w.monster;
    let mask = 0; w.fuses.forEach(f => { if (f.fixed) mask |= (1 << f.id); });
    return {
      t: "st", team: w.team,
      ms: w.monsters.map(m=>[+m.x.toFixed(2),+m.y.toFixed(2),m.state,+m.a.toFixed(2),+m.speed.toFixed(1)]),
      second: w.monsters[1] ? (w.monsters[1].state === "dormant" ? 0 : 1) : -1,
      totalCells: w.fuses.length, thr: secondAt(w),
      m: [+mo.x.toFixed(2), +mo.y.toFixed(2), mo.state, +mo.a.toFixed(2), +mo.speed.toFixed(1)],
      p: [...w.players.values()].map(p => [p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.a.toFixed(2), p.down ? 1 : 0, p.hid ? 1 : 0, p.escaped ? 1 : 0, p.down ? +p.rev.toFixed(1) : 0, p.light ? 1 : 0, p.carry || 0, p.medkit ? 1 : 0, p.travelRev || 0]),
      f: mask, b: w.breaker.stage, e: w.exitOpen ? 1 : 0, n: Math.round(w.noise), tm: Math.max(0, Math.round(w.time)), ph: w.phase,
      ins: w.inserted, dr: w.drops.map(d => [+d.x.toFixed(2), +d.y.toFixed(2), d.n]), mk: w.medkits.reduce((a, m) => a | (m.taken ? 1 << m.id : 0), 0),
      cc: Math.max(0, Math.ceil(w.cctv.until - w.elapsed)), ccl: Math.max(0, Math.ceil(w.cctv.cool - w.elapsed)),
      req: w.settings.requiredFuses, safe: Math.max(0, Math.round(w.settings.safeTime - w.elapsed)), it: +Math.max(0, w.introT).toFixed(1),
      end: w.phase === "end" ? result(w) : undefined,
    };
  }

  // 두 번째 괴물이 깨는 셀 수: 필요 셀이 6개 이하면 2/3, 7개 이상이면 절반 (꺼낸 셀 기준)
  function secondAt(w) { const r = w.settings.requiredFuses; return r <= 6 ? Math.ceil(r * 2 / 3) : Math.ceil(r / 2); }
  function requiredMet(w) { return w.inserted >= w.settings.requiredFuses; }

  return { DEFAULTS, PLAYER_SPEED, createWorld, addPlayer, handle, tick, snapshot, requiredMet, resumeState, clearQuestion, result };
})();
