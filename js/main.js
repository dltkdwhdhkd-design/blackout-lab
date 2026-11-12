// 화면 흐름과 호스트 게임 로직
(function () {
  const $ = id => document.getElementById(id);
  const screens = ["title", "host-lobby", "client-lobby", "game", "host-console", "end"];
  function show(id) { for (const s of screens) $("s-" + s).style.display = s === id ? "" : "none"; }

  // ---------------- 호스트 게임 ----------------
  const HostGame = {
    players: new Map(), worlds: [], settings: { ...Sim.DEFAULTS }, started: false, timer: null, acc: 0, lastTick: 0, snapAcc: 0,
    onMsg(d, from) {
      if (!d || typeof d !== "object") return;
      if (d.t === "join") {
        if (d.roomId && d.roomId !== Net.id) {
          Net.sendToClients({ t: "join-error", to: from, requestId: d.requestId, reason: "이전 방이 종료되었습니다. 현재 방 코드를 확인하고 새로 입장하세요." }); return;
        }
        if (!this.players.has(from)) {
          if (this.started && this.worlds.every(w => w.phase === "end")) {
            Net.sendToClients({ t: "join-error", to: from, requestId: d.requestId, reason: "이미 끝난 게임입니다. 선생님이 새 방을 만들면 입장하세요." }); return;
          }
          this.players.set(from, { id: from, name: String(d.name || "?").slice(0, 8), team: -1 });
          if (this.started) {
            // 늦게 들어온 학생: 가장 적은 팀에
            let best = 0; this.worlds.forEach((w, i) => { if (w.players.size < this.worlds[best].players.size) best = i; });
            if (!this.worlds.length) { const w0 = Sim.createWorld(0, this.settings); w0.seed = MapUtil.seed; w0.mapState = MapUtil.state(); this.worlds.push(w0); HostView.init(this.worlds, this.names()); }
            const p = this.players.get(from); p.team = best; MapUtil.use(this.worlds[best].mapState); Sim.addPlayer(this.worlds[best], from, p.name);
            Net.sendToClients({ t: "roster", players: this.lobbyMsg().players });
          } else this.assignTeams();
        }
        if (!this.started) this.broadcastLobby();
        else {
          const p = this.players.get(from), w = this.worlds[p.team];
          if (d.requestId && p.resumeRequest !== d.requestId) { Sim.clearQuestion(w, from); p.resumeRequest = d.requestId; }
          this.sendGo(from, d.requestId);
        }
        return;
      }
      const p = this.players.get(from); if (!p || !this.started) return;
      const w = this.worlds[p.team]; if (w) { MapUtil.use(w.mapState); Sim.handle(w, from, d); }
    },
    names() { const o = {}; for (const p of this.players.values()) o[p.id] = p.name; return o; },
    assignTeams(all) {
      // all: 팀 인원 설정을 바꿨을 때 전원 다시 나눔. 아니면 새로 들어온 학생만 자리가 남는 팀에 넣는다(선생님이 옮긴 팀은 그대로).
      const list = [...this.players.values()], size = this.settings.teamSize;
      if (all) {
        if (all === "shuffle") {   // 팀 섞기: 무작위로 섞은 뒤 팀 인원대로 나눈다 (이전과 같은 배정이면 한 번 더)
          const before = list.map(p => p.team).join();
          for (let k = 0; k < 5; k++) {
            for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
            list.forEach((p, i) => p.team = Math.floor(i / size));
            if (list.length < 2 || [...this.players.values()].map(p => p.team).join() !== before) break;
          }
          return;
        }
        list.forEach((p, i) => p.team = Math.floor(i / size)); return;
      }
      for (const p of list) {
        if (p.team >= 0) continue;
        let t = 0; while (list.filter(q => q.team === t).length >= size) t++;
        p.team = t;
      }
    },
    moveTeam(id, team) {
      const p = this.players.get(id); if (!p || this.started) return;
      p.team = Math.max(0, team); this.broadcastLobby();
    },
    forceOut(id) {
      const p = this.players.get(id); if (!p) return; const w = this.worlds[p.team]; if (!w) return;
      MapUtil.use(w.mapState); if (Sim.forceOut(w, id)) HostView.addLog(p.team, `${p.name} 사물함에서 꺼냄(선생님)`);
      renderHiddenPanel(true);
    },
    // 대기실에서 내보내기: 목록에서 빼고 그 학생 화면을 입장 화면으로 돌려보낸다(다시 들어오는 건 가능)
    kick(id) {
      const p = this.players.get(id); if (!p || this.started) return;
      this.players.delete(id);
      Net.sendToClients({ t: "kicked", to: id });
      this.broadcastLobby();
    },
    compactTeams() { // 빈 팀 번호를 당겨서 1팀부터 차례로
      const used = [...new Set([...this.players.values()].map(p => p.team))].sort((a, b) => a - b);
      for (const p of this.players.values()) p.team = used.indexOf(p.team);
    },
    lobbyMsg() { return { t: "lobby", roomId: Net.id, players: [...this.players.values()].map(p => [p.id, p.name, p.team]), settings: this.settings }; },
    broadcastLobby() { Net.sendToClients(this.lobbyMsg()); renderHostLobby(); },
    start() {
      this.started = true;
      // 지도: 0 기본 지도 고정 / 1 매판 새로(모든 팀 같은 지도) / 2 매판 새로·팀마다 다른 지도
      window.BL_REQ = this.settings.requiredFuses;   // 1층 장비 수가 필요 셀 수에 따라 달라진다
      const newSeed = () => { let sd, m = null; while (!m) { sd = 1 + Math.floor(Math.random() * 999998); m = MapGen.generate(sd); } MapUtil.load(m); return sd; };
      this.compactTeams();
      const nTeams = Math.max(1, ...[...this.players.values()].map(p => p.team + 1));
      this.worlds = [];
      let recent = []; try { recent = JSON.parse(localStorage.getItem("blackoutlab.recentQ") || "[]"); } catch (e) {}
      let shared = null;
      for (let i = 0; i < nTeams; i++) {
        let sd;
        if (this.settings.mapMode === 0) { sd = 0; if (!shared) { MapUtil.load(null); shared = MapUtil.state(); } else MapUtil.use(shared); }
        else if (this.settings.mapMode === 1) { if (!shared) { sd = newSeed(); shared = MapUtil.state(); } else { sd = shared.seed; MapUtil.use(shared); } }
        else sd = newSeed();
        const ms = this.settings.mapMode === 2 ? MapUtil.state() : shared;
        const w = Sim.createWorld(i, this.settings); w.avoid = new Set(recent); w.seed = sd; w.mapState = ms; this.worlds.push(w);
      }
      this.settings.seed = this.worlds[0].seed;
      for (const p of this.players.values()) { MapUtil.use(this.worlds[p.team].mapState); Sim.addPlayer(this.worlds[p.team], p.id, p.name); }
      const cm = document.getElementById("console-map"); if (cm) cm.textContent = this.worlds.map((w, i) => (this.worlds.length > 1 ? `${i + 1}팀 ` : "") + (w.seed ? "#" + w.seed : "기본")).join(" · ");
      HostView.init(this.worlds, this.names());
      this.sendGo();
      this.lastTick = performance.now();
      this.timer = setInterval(() => this.loop(), 50);
    },
    sendGo(to, requestId, move) {
      const players = this.lobbyMsg().players;
      for (const p of this.players.values()) {
        if (to && p.id !== to) continue;
        const w = this.worlds[p.team]; MapUtil.use(w.mapState);
        // /h로 보내므로 팀 구독이 아직 끝나지 않은 재접속도 첫 상태를 받는다.
        Net.sendToClients({ t: "go", to: p.id, requestId, move: !!move, roomId: Net.id, settings: { ...this.settings, seed: w.seed }, players, snapshot: Sim.snapshot(w), playerState: Sim.resumeState(w, p.id) });
      }
    },
    loop() {
      const now = performance.now(); let dt = (now - this.lastTick) / 1000; this.lastTick = now;
      if (dt > 1) dt = 0.05; // 탭이 숨겨졌다 돌아옴
      for (const w of this.worlds) {
        MapUtil.use(w.mapState);
        Sim.tick(w, dt);
        for (const e of w.events) {
          if (e.k === "q") rememberQ(e.unit + ":" + e.qi);
          Net.sendToClients({ t: "ev", team: w.team, ...e }, w.team);
          logEvent(w, e);
        }
        w.events.length = 0;
      }
      this.snapAcc += dt;
      if (this.snapAcc >= 0.1) { this.snapAcc = 0; for (const w of this.worlds) { MapUtil.use(w.mapState); Net.sendToClients(Sim.snapshot(w), w.team); } }
      HostView.render(); renderHiddenPanel();
      if (this.worlds.length && this.worlds.every(w => w.phase === "end")) $("btn-host-end").textContent = "결과 보기";
    },
    end() {
      clearInterval(this.timer);
      for (const w of this.worlds) if (w.phase === "play") { w.phase = "end"; w.result = w.escaped > 0 ? "partial" : "timeout"; Net.sendToClients({ t: "ev", team: w.team, ...Sim.result(w) }, w.team); }
      $("end-body").innerHTML = HostView.results(this.worlds);
      $("end-title").textContent = "결과 — 오답 해설";
      show("end");
    },
  };
  window.__host = HostGame; // 자동 시험용
  // 최근에 나온 문제 (교사 기기에 저장, 최근 160개) — 다음 판에서 먼저 피한다
  let recentQ = null;
  function rememberQ(k) {
    try {
      if (!recentQ) recentQ = JSON.parse(localStorage.getItem("blackoutlab.recentQ") || "[]");
      const i = recentQ.indexOf(k); if (i >= 0) recentQ.splice(i, 1);
      recentQ.push(k); if (recentQ.length > 160) recentQ.splice(0, recentQ.length - 160);
      localStorage.setItem("blackoutlab.recentQ", JSON.stringify(recentQ));
    } catch (e) {}
  }
  function logEvent(w, e) {
    const nm = id => (HostGame.players.get(id) || {}).name || "?";
    const txt = ({ wake2: "셀 절반 회수 — 2층에서 두 번째 개체 출현", stairs: `${e.name} ${e.floor}층으로 이동`, hunt: "괴물이 기척을 쫓는 중", wake: "괴물이 움직이기 시작했다", caught: `${e.name} 잡힘`, revived: `${nm(e.id)} 회복${e.self ? "(스스로)" : ""}`, exit: "발전기 가동 — 출구 열림", escaped: `${e.name} 탈출`, end: `종료: ${e.result}`, spotted: `${nm(e.id)} 발견됨`, fuse: e.ok ? `${e.by} ${e.fuse === -1 ? "발전기 가동" : "에너지 셀 확보"}` : `${e.by} 오답 — 경보` })[e.k];
    if (txt) HostView.addLog(w.team, txt);
  }

  // 관제 화면: 사물함에 숨은 학생 목록 → 꺼내기
  let hiddenHtml = "";
  function renderHiddenPanel(force) {
    const box = $("hidden-panel"); if (!box || box.style.display === "none") return;
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const list = []; HostGame.worlds.forEach((w, t) => { for (const p of w.players.values()) if (p.hid) list.push({ t, p, sec: Math.floor(w.elapsed - (p.hidT || 0)) }); });
    const html = `<div class="hp-head"><b>사물함에 숨은 학생</b> <button id="btn-hide-all"${list.length ? "" : " disabled"}>모두 꺼내기</button> <button id="btn-hide-close">닫기</button></div>` +
      (list.length ? list.map(({ t, p, sec }) => `<div class="hp-row"><span>${t + 1}팀 <b>${esc(p.name)}</b> · ${sec}초째</span><button data-out="${esc(p.id)}">꺼내기</button></div>`).join("") : `<div class="muted small">지금 숨어 있는 학생이 없습니다.</div>`);
    if (!force && html === hiddenHtml) return; hiddenHtml = html; box.innerHTML = html;
    box.querySelectorAll("button[data-out]").forEach(b => { b.onclick = () => HostGame.forceOut(b.dataset.out); });
    $("btn-hide-all").onclick = () => { for (const w of HostGame.worlds) for (const p of w.players.values()) if (p.hid) HostGame.forceOut(p.id); };
    $("btn-hide-close").onclick = () => { box.style.display = "none"; };
  }
  window.addEventListener("DOMContentLoaded", () => {
    const b = $("btn-hidden"); if (b) b.onclick = () => { const box = $("hidden-panel"); box.style.display = box.style.display === "none" ? "" : "none"; renderHiddenPanel(true); };
  });
  function updateSecondHint() {
    const h = $("second-hint"); if (!h) return; const r = HostGame.settings.requiredFuses || 9;
    const at = r <= 6 ? Math.ceil(r * 2 / 3) : Math.ceil(r / 2);
    h.textContent = HostGame.settings.monsterCount === 1 ? "괴물은 1마리입니다. 발전기와 탈출구는 1층에 있습니다." : `두 번째 개체는 셀 ${at}개를 꺼내면 2층에서 출현합니다. 1층에는 장비 ${Math.max(1, Math.floor(r / 2))}개뿐이라 나머지는 2층에서 가져와야 합니다.`;
  }
  let lastLobbyHtml = null;
  function renderHostLobby() {
    const byTeam = {};
    for (const p of HostGame.players.values()) (byTeam[p.team] = byTeam[p.team] || []).push(p);
    const keys = Object.keys(byTeam).sort((a, b) => a - b);
    const nT = keys.length ? Math.max(...keys.map(Number)) + 1 : 1;
    const opt = (cur) => Array.from({ length: nT + 1 }, (_, t) => `<option value="${t}"${t === cur ? " selected" : ""}>${t < nT ? t + 1 + "팀" : "새 팀"}</option>`).join("");
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const html = keys.length ? keys.map(k => `<div class="team"><b>${+k + 1}팀</b> <span class="muted">${byTeam[k].length}명</span><div class="team-list">${byTeam[k].map(p => `<div class="mem"><span class="nm">${esc(p.name)}</span> <select data-id="${esc(p.id)}" title="팀 옮기기">${opt(+k)}</select><button class="kick" data-kick="${esc(p.id)}" title="내보내기">내보내기</button></div>`).join("")}</div></div>`).join("") : `<div class="muted">학생들이 접속하면 여기에 보입니다.</div>`;
    if (html === lastLobbyHtml) { $("lobby-count").textContent = HostGame.players.size + "명"; return; }  // 고르는 중에 목록이 다시 그려져 닫히지 않게
    lastLobbyHtml = html; $("lobby-teams").innerHTML = html;
    $("lobby-teams").querySelectorAll("select[data-id]").forEach(sel => { sel.onchange = () => HostGame.moveTeam(sel.dataset.id, +sel.value); });
    $("lobby-teams").querySelectorAll("button[data-kick]").forEach(bt => { bt.onclick = () => { const p = HostGame.players.get(bt.dataset.kick); if (p && confirm(`${p.name} 학생을 내보낼까요?`)) HostGame.kick(bt.dataset.kick); }; });
    $("lobby-count").textContent = HostGame.players.size + "명";
  }

  // ---------------- 화면: 타이틀 ----------------
  $("btn-teacher").onclick = () => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    Net.host(code);
    Net.onMessage((d, from) => HostGame.onMsg(d, from));
    $("lobby-code").textContent = code;
    $("lobby-url").textContent = location.href.split("#")[0].split("?")[0];
    bindSettings();
    show("host-lobby");
    setInterval(() => { if (!HostGame.started) HostGame.broadcastLobby(); }, 1500);
  };
  $("btn-student").onclick = () => { fillSavedSession(); show("client-lobby"); $("inp-name").focus(); };
  $("btn-solo").onclick = () => {
    Horror.init();
    // 같은 페이지에서 호스트와 클라이언트를 함께
    Net.startLocal((d, from) => HostGame.onMsg(d, from));
    Net.setLocalClient(d => clientRecv(d));
    HostGame.settings = { ...Sim.DEFAULTS, teamSize: 1, safeTime: 30, requiredFuses: 5, timeLimit: 600 };
    Net.onMessage(() => {});
    Net.sendToHost({ t: "join", name: "나" });
    HostGame.start();
    $("s-host-console").style.display = "none";
  };

  function bindSettings() {
    const map = { "set-time": ["timeLimit", 60], "set-safe": ["safeTime", 1], "set-speed": ["monsterSpeed", 1], "set-monsters": ["monsterCount", 1], "set-req": ["requiredFuses", 1], "set-team": ["teamSize", 1], "set-scare": ["scare", 1], "set-intro": ["intro", 1], "set-map": ["mapMode", 1] };
    for (const id in map) {
      const el = $(id); const [key, mul] = map[id];
      el.value = HostGame.settings[key] / mul;
      el.oninput = () => { HostGame.settings[key] = +el.value * mul; updateSecondHint(); if (key === "teamSize") { HostGame.assignTeams(true); HostGame.broadcastLobby(); } $(id + "-v") && ($(id + "-v").textContent = el.value); };
      $(id + "-v") && ($(id + "-v").textContent = el.value);
    }
    updateSecondHint();
  }
  $("btn-shuffle").onclick = () => { HostGame.assignTeams("shuffle"); HostGame.broadcastLobby(); };
  $("btn-start").onclick = () => {
    if (!HostGame.players.size) { alert("접속한 학생이 없습니다."); return; }
    HostGame.start(); show("host-console");
    $("console-code").textContent = Net.code;
  };
  $("btn-host-end").onclick = () => { if (confirm("게임을 끝내고 결과를 볼까요?")) HostGame.end(); };
  $("btn-end-back").onclick = () => location.reload();

  // ---------------- 화면: 학생 ----------------
  let myTeam = -1, joined = false, gameStarted = false, lobbyInfo = null;
  const SESSION_KEY = "blackoutlab.session.v1";
  let activeSession = null, joinTimer = null, lastHostAt = 0, lastJoinAt = 0, syncRequest = null, recovering = false, ending = false;
  function readSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (s && /^\d{4}$/.test(s.code) && typeof s.name === "string" && s.name.length > 0 && s.name.length <= 8 && typeof s.id === "string" && s.id.length >= 8 && s.id.length <= 80 && Number.isFinite(s.savedAt) && Date.now() - s.savedAt < 12 * 60 * 60 * 1000) return s;
    } catch (e) {}
    return null;
  }
  function saveSession() {
    if (!activeSession) return;
    activeSession.savedAt = Date.now();
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)); } catch (e) {}
  }
  function forgetSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function fillSavedSession() {
    const s = readSession(); if (s) { $("inp-name").value = s.name; $("inp-code").value = s.code; }
    $("btn-resume").style.display = s ? "" : "none";
    if (s) $("btn-resume").textContent = `이전 게임 이어하기 · ${s.name} (${s.code})`;
  }
  function reconnectNotice(visible) {
    $("reconnect").style.display = visible && gameStarted ? "flex" : "none";
  }
  function sendJoin() {
    if (!activeSession || ending || document.hidden) return;
    if (!syncRequest) syncRequest = Net.newId();
    lastJoinAt = Date.now();
    Net.sendToHost({ t: "join", name: activeSession.name, roomId: activeSession.roomId, requestId: syncRequest });
  }
  function recover() {
    if (!activeSession || ending) return;
    if (!recovering) { recovering = true; syncRequest = Net.newId(); Client.setConnectionLost(true); }
    reconnectNotice(true);
    if (!gameStarted) $("join-msg").textContent = "연결을 다시 확인하는 중… 방 코드와 선생님 화면을 확인하세요.";
    Net.reconnect(); sendJoin();
  }
  function watchConnection() {
    if (!activeSession || ending || document.hidden) return;
    if (joined && Date.now() - lastHostAt > 4000 && !recovering) recover();
    if ((!joined || recovering) && Date.now() - lastJoinAt >= 2000) sendJoin();
    if (!joined && Date.now() - lastHostAt > 10000) $("join-msg").textContent = "방을 찾는 중… 방 코드와 선생님 화면을 확인하세요. 아래에서 취소 후 다시 입력할 수 있습니다.";
  }
  function cancelJoin() {
    clearInterval(joinTimer); joinTimer = null; activeSession = null; syncRequest = null;
    Client.stop(); Net.disconnect(); joined = false; gameStarted = false; recovering = false; myTeam = -1;
    reconnectNotice(false); $("btn-join").disabled = false;
    $("inp-name").disabled = $("inp-code").disabled = false;
    $("btn-join-cancel").style.display = "none"; $("join-msg").textContent = "";
    show("client-lobby"); fillSavedSession();
  }
  function joinGame() {
    const name = $("inp-name").value.trim(), code = $("inp-code").value.trim();
    if (!name || !/^\d{4}$/.test(code)) { $("join-msg").textContent = "별명과 4자리 방 코드를 입력하세요."; return; }
    const saved = readSession();
    activeSession = saved && saved.code === code && saved.name === name ? saved : { id: Net.newId(), code, name, roomId: null };
    saveSession();
    joined = false; gameStarted = false; recovering = false; ending = false; myTeam = -1; syncRequest = Net.newId();
    lastHostAt = Date.now(); lastJoinAt = 0;
    Horror.init();
    Net.onMessage((d, from) => clientRecv(d, from));
    Net.join(code, activeSession.id);
    $("btn-join").disabled = true; $("join-msg").textContent = "방을 찾는 중…";
    $("inp-name").disabled = $("inp-code").disabled = true; $("btn-join-cancel").style.display = "";
    clearInterval(joinTimer); joinTimer = setInterval(watchConnection, 1000); sendJoin();
  }
  $("btn-join").onclick = joinGame;
  $("btn-resume").onclick = () => { fillSavedSession(); show("client-lobby"); joinGame(); };
  $("btn-join-cancel").onclick = cancelJoin;
  $("btn-reconnect").onclick = recover;
  $("btn-reconnect-back").onclick = cancelJoin;
  window.addEventListener("online", recover);
  window.addEventListener("offline", recover);
  document.addEventListener("visibilitychange", () => {
    if (!activeSession || ending) return;
    if (document.hidden) { recovering = true; syncRequest = Net.newId(); Client.setConnectionLost(true); }
    else recover();
  });
  Net.onStatus(s => {
    const t = s.local ? "" : `연결 ${s.brokers}/3${s.peers ? " · 직접 연결" : ""}`;
    $("net-status").textContent = t; $("console-net").textContent = t;
  });

  function clientRecv(d, from) {
    if (!d || ending || (d.to && d.to !== Net.id)) return;
    if (d.t === "kicked") {
      if (gameStarted) return;
      forgetSession(); cancelJoin(); show("join"); $("join-msg").textContent = "선생님이 대기실에서 내보냈습니다. 이름을 확인하고 다시 들어오세요."; return;
    }
    if (d.t === "join-error" && activeSession && d.requestId === syncRequest) {
      const message = d.reason; forgetSession(); cancelJoin(); $("join-msg").textContent = message; return;
    }
    if (activeSession && activeSession.roomId && from !== activeSession.roomId) return;
    if (d.t === "lobby") {
      if (gameStarted) return;
      const mine = d.players.find(p => p[0] === Net.id);
      if (mine) {
        joined = true; myTeam = mine[2]; Net.setTeam(myTeam); lastHostAt = Date.now(); recovering = false; syncRequest = null;
        if (activeSession && !activeSession.roomId) { activeSession.roomId = from || d.roomId; saveSession(); }
      }
      lobbyInfo = d;
      const mates = d.players.filter(p => p[2] === myTeam).map(p => p[1]);
      $("join-msg").innerHTML = mine ? `<b>${myTeam + 1}팀</b> — ${mates.join(", ")}<br><span class="muted">선생님이 시작하면 바로 시작됩니다. 소리를 켜 두세요.</span>` : "입장 중…";
      return;
    }
    if (d.t === "go") {
      const mine = d.players.find(p => p[0] === Net.id);
      if (!mine) return;
      if (syncRequest && d.requestId && d.requestId !== syncRequest) return;
      const names = {}; d.players.forEach(p => names[p[0]] = p[1]);
      Client.setNames(names);
      if (gameStarted && !syncRequest && !recovering && !d.move) return;
      if (d.move && gameStarted) { myTeam = mine[2]; Net.setTeam(myTeam); Client.setTeam(myTeam); Client.restore(d.snapshot, d.playerState); lastHostAt = Date.now(); return; }
      joined = true; lastHostAt = Date.now(); myTeam = mine[2]; Net.setTeam(myTeam);
      if (activeSession && !activeSession.roomId) { activeSession.roomId = from || d.roomId; saveSession(); }
      if (!d.snapshot || !d.playerState) {
        $("join-msg").textContent = "선생님 화면을 새로고침한 뒤 방을 다시 만들어 주세요."; return;
      }
      const idx = d.players.filter(p => p[2] === myTeam).findIndex(p => p[0] === Net.id);
      const reqChanged = window.BL_REQ !== d.settings.requiredFuses; window.BL_REQ = d.settings.requiredFuses;
      if (!d.settings.seed) MapUtil.load(null); else if (reqChanged || MapUtil.seed !== d.settings.seed) MapUtil.load(MapGen.generate(d.settings.seed));
      show("game");
      const wasStarted = gameStarted; gameStarted = true; recovering = false; syncRequest = null; reconnectNotice(false);
      if (wasStarted) Client.restore(d.snapshot, d.playerState);
      else Client.start({ id: Net.id, team: myTeam, settings: d.settings, names, spawnIndex: idx, onEnd: clientEnd, snapshot: d.snapshot, playerState: d.playerState });
      return;
    }
    if (d.t === "roster") { const names = {}; d.players.forEach(p => names[p[0]] = p[1]); Client.setNames(names); return; }
    if (d.t === "st" && d.team === myTeam && d.p.some(p => p[0] === Net.id)) lastHostAt = Date.now();
    if (recovering) return; // 최신 위치를 받기 전에는 예전 좌표를 호스트에 덮어쓰지 않는다.
    Client.onMessage(d);
  }
  function clientEnd(e) {
    if (ending) return; ending = true;
    clearInterval(joinTimer); joinTimer = null; activeSession = null; forgetSession(); reconnectNotice(false);
    setTimeout(() => {
      Client.stop();
      const res = ({ escaped: "전원 탈출 성공", partial: "일부만 탈출", lost: "아무도 나오지 못했다", timeout: "시간이 다 됐다" })[e.result];
      $("end-title").textContent = res;
      let html = `<p class="big">탈출 ${e.escaped}/${e.total}명 · 에너지 셀 ${e.fixed}개</p>`;
      if (e.wrongs && e.wrongs.length) {
        html += `<h3>틀린 문제</h3><table><tr><th>학생</th><th>문제</th><th>고른 답</th><th>정답 · 해설</th></tr>`;
        for (const wr of e.wrongs) { const it = QUESTION_BANK[wr.unit].items[wr.qi]; html += `<tr><td>${wr.name}</td><td>${it.q}</td><td class="bad">${wr.chosen >= 0 ? it.c[wr.chosen] : "시간 초과"}</td><td><b>${it.c[it.a]}</b><br><small>${it.e}</small></td></tr>`; }
        html += `</table>`;
      }
      $("end-body").innerHTML = html;
      show("end");
    }, 2500);
  }
  $("btn-options-title").onclick = () => Options.show();
  $("btn-options").onclick = () => Options.show();
  $("btn-options").addEventListener("pointerdown", e => e.stopPropagation());

  // 패드·폰: 두 번 탭 확대, 두 손가락 확대, 길게 눌러 확대경·메뉴 막기 (이동하면서 시점 돌리면 손가락 둘을 쓰므로 필수)
  const isField = t => t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", e => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", e => { if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  // 버튼은 CSS(touch-action)로 이미 두 번 탭 확대가 꺼져 있으므로 막지 않는다 — 막으면 빠른 연속 탭(단말기 → 보기)이 씹힌다
  document.addEventListener("touchend", e => { const t = Date.now(); const btn = e.target && e.target.closest && e.target.closest("button, label, a"); if (t - lastTouchEnd < 350 && !isField(e.target) && !btn) e.preventDefault(); lastTouchEnd = t; }, { passive: false });
  document.addEventListener("contextmenu", e => { if (!isField(e.target)) e.preventDefault(); });

  $("btn-lobby-audio").onclick = () => Options.enableSound();
  let muteAction = "enable";
  $("btn-mute").onclick = () => { if (muteAction === "enable") Options.enableSound(); else Horror.setMuted(true); };
  Horror.onStatus(s => {
    const off = s.muted || s.volume === 0, ready = s.state === "running";
    muteAction = off || !ready ? "enable" : "mute";
    $("btn-mute").textContent = off ? "🔇 켜기" : ready ? "🔊" : "🔈 켜기";
    $("btn-mute").title = muteAction === "enable" ? "소리 켜기 · 시험" : "소리 끄기";
    const message = off ? "게임 소리가 꺼져 있습니다. 소리 켜기를 눌러 주세요." : ready ? "소리 재생 준비됨 · 시험음을 들어 보세요." : s.state === "idle" ? "입장 전에 소리가 들리는지 확인해 주세요." : "소리가 멈춰 있습니다. 소리 켜기를 눌러 주세요.";
    $("lobby-audio-status").textContent = message;
    $("opt-audio-status").textContent = message;
  });

  // 모달 취소
  $("modal-cancel").onclick = () => Client.cancelModal();

  // 타이틀 깜빡임
  fillSavedSession();
  show("title");
  setInterval(() => { $("title-h1").style.opacity = Math.random() < 0.12 ? 0.2 + Math.random() * 0.5 : 1; }, 120);
})();
