// 두 층은 서로 막힌 좌표 영역에 두고 계단만 경로로 연결한다.
// 기존 충돌·셀·재접속 좌표 체계를 유지하면서 같은 시드로 같은 건물을 만든다.
window.Building = (() => {
  const UPPER_NAMES = {
    contain1: '봉인 실험실', contain2: '냉동 격리실', monitor: '상층 관제실', server: '데이터 보관실',
    archive: '폐기 기록실', medical: '응급 처치실', phy: '진동 실험실', chem: '기체 분석실',
    bio: '조직 배양실', heat: '저온 실험실', earth: '광물 보관실', lobby: '상층 대기 홀',
    meeting: '검체 회의실', office: '연구 책임자실', lounge: '폐쇄 휴게실', power: '보조 전력실',
    mech: '환기 제어실', changing: '방호복 보관실', cafeteria: '휴게 식당', store: '시약 창고', exit: '봉쇄 구역'
  };
  let cached = null;
  function expand(lower) {
    if (lower.floors) return lower;
    const seed = lower.seed || 0;
    if (cached && cached.seed === seed) return cached;
    const upper = MapGen.generate(((seed + 17389) * 17) % 999983 + 1);
    if (!upper) throw new Error('상층 지도를 만들지 못했습니다.');
    const grids = [lower, upper].map(m => m.rows.map(row => row.split('')));
    const W = lower.rows[0].length, gap = 6, offset = lower.rows.length + gap;
    // 총 14개의 셀을 두 층에 7개씩 나눈다. 기본 목표 9개는 양쪽 층을 탐색해야 한다.
    const wanted = [['phy','chem','bio','heat','earth','server','medical'], ['phy','chem','bio','heat','earth','monitor','server']];
    for (let fi = 0; fi < 2; fi++) {
      const g = grids[fi], m = [lower,upper][fi], kept = new Set();
      for (const id of wanted[fi]) {
        const room = m.rooms.find(r => r.id === id); if (!room) continue;
        let found = false;
        for (let y = room.y0; y <= room.y1 && !found; y++) for (let x = room.x0; x <= room.x1; x++) {
          if (g[y][x] === 'F') { kept.add(x+','+y); found = true; break; }
        }
      }
      for (let y = 0; y < g.length; y++) for (let x = 0; x < W; x++) {
        if (g[y][x] === 'F' && !kept.has(x+','+y)) g[y][x] = '.';
        if (fi === 1) { if ('SM'.includes(g[y][x])) g[y][x] = '.'; else if (g[y][x] === 'B') g[y][x] = 'x'; else if (g[y][x] === 'E') g[y][x] = '#'; }
      }
    }
    // 통로의 가운데 빈 칸: 두 계단이 멀리 떨어져 추격 중 우회할 수 있다.
    function landing(g, east) {
      const candidates = [];
      for (let y = 2; y < g.length-2; y++) for (let x = 1; x < W-1; x++) {
        if (g[y][x] !== '.' || (east ? x < W-4 : x > 3)) continue;
        if (g[y-1][x] !== '.' || g[y+1][x] !== '.') continue;
        candidates.push({x,y,score:Math.abs(y-g.length/2)*3+Math.abs(x-(east?W-3:2))});
      }
      candidates.sort((a,b)=>a.score-b.score);
      if (!candidates.length) throw new Error('계단 연결 공간이 없습니다.');
      return {x:candidates[0].x,y:candidates[0].y};
    }
    const stairs = [];
    for (const [i,label] of ['서쪽 계단 A','동쪽 계단 B'].entries()) {
      const a = landing(grids[0],i===1), b = landing(grids[1],i===1);
      grids[0][a.y][a.x] = 'U'; grids[1][b.y][b.x] = 'D';
      stairs.push({id:'up-'+i,label,floor:1,x:a.x,y:a.y,to:{floor:2,x:b.x+0.5,y:b.y+offset+0.5}});
      stairs.push({id:'down-'+i,label,floor:2,x:b.x,y:b.y+offset,to:{floor:1,x:a.x+0.5,y:a.y+0.5}});
    }
    const rooms = lower.rooms.map(r=>({...r,floor:1,baseId:r.id})).concat(upper.rooms.map(r=>({...r,id:'f2_'+r.id,baseId:r.id,floor:2,name:UPPER_NAMES[r.id]||r.name,y0:r.y0+offset,y1:r.y1+offset,units:r.id==='chem'?['gas','state']:r.units})));
    function meds(m,g,dy) {
      if(m.meds) return m.meds.map(([x,y])=>[x,y+dy]);
      const room=m.rooms.find(r=>r.id==='medical'), out=[];
      for(let y=room.y0+1;y<room.y1&&out.length<2;y+=3)for(let x=room.x0+1;x<room.x1&&out.length<2;x+=5)if(g[y][x]==='.')out.push([x+0.5,y+dy+0.5]);
      return out;
    }
    cached = {seed,rows:[...grids[0].map(r=>r.join('')),...Array(gap).fill('#'.repeat(W)),...grids[1].map(r=>r.join(''))],rooms,stairs,
      floors:[{id:1,name:'1층 · 격리·설비동',y0:0,y1:grids[0].length-1},{id:2,name:'2층 · 실험·보관동',y0:offset,y1:offset+grids[1].length-1}],
      intro:{...lower.intro,bodies:[...lower.intro.bodies,...upper.intro.bodies.map(([x,y,k])=>[x,y+offset,k])]},
      meds:[...meds(lower,grids[0],0),...meds(upper,grids[1],offset)]};
    return cached;
  }
  return {expand};
})();
MapUtil.load(null);
