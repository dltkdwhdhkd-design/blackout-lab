// 화면 흐름과 호스트 게임 로직
(function () {
  const $ = id => document.getElementById(id);
  const screens = ["title", "host-lobby", "client-lobby", "game", "host-console", "end"];
  function show(id) { for (const s of screens) $("s-" + s).style.display = s === id ? "" : "none"; }

  // ---------------- 호스트 게임 ----------------
  const HostGame = {
    players: new Map(), worlds: [], settings: { ...Sim.DEFAULTS }, started: false, timer: null, acc: 0, lastTick: 0, snapAcc: 0,
    onMsg(d, from) {
      if (d.t === "join") {
        if (!this.players.has(from)) {
          this.players.set(from, { id: from, name: String(d.name || "?").slice(0, 8), team: -1 });
          if (this.started) {
            // 늦게 들어온 학생: 가장 적은 팀에
            let best = 0; this.worlds.forEach((w, i) => { if (w.players.size < this.worlds[best].players.size) best = i; });
            if (!this.worlds.length) { this.worlds.push(Sim.createWorld(0, this.settings)); HostView.init(this.worlds, this.names()); }
            const p = this.players.get(from); p.team = best; Sim.addPlayer(this.worlds[best], from, p.name);
            this.sendGo();
          } else this.assignTeams();
        }
        if (!this.started) this.broadcastLobby(); else this.sendGo();
        return;
      }
      const p = this.players.get(from); if (!p || !this.started) return;
      const w = this.worlds[p.team]; if (w) Sim.handle(w, from, d);
    },
    names() { const o = {}; for (const p of this.players.values()) o[p.id] = p.name; return o; },
    assignTeams(shuffle) {
      const list = [...this.players.values()];
      if (shuffle) list.sort(() => Math.random() - 0.5);
      list.forEach((p, i) => p.team = Math.floor(i / this.settings.teamSize));
    },
    lobbyMsg() { return { t: "lobby", players: [...this.players.values()].map(p => [p.id, p.name, p.team]), settings: this.settings }; },
    broadcastLobby() { Net.sendToClients(this.lobbyMsg()); renderHostLobby(); },
    start() {
      this.started = true;
      const nTeams = Math.max(1, ...[...this.players.values()].map(p => p.team + 1));
      this.worlds = [];
      for (let i = 0; i < nTeams; i++) this.worlds.push(Sim.createWorld(i, this.settings));
      for (const p of this.players.values()) Sim.addPlayer(this.worlds[p.team], p.id, p.name);
      HostView.init(this.worlds, this.names());
      this.sendGo();
      this.lastTick = performance.now();
      this.timer = setInterval(() => this.loop(), 50);
    },
    sendGo() {
      Net.sendToClients({ t: "go", settings: this.settings, players: [...this.players.values()].map(p => [p.id, p.name, p.team]) });
    },
    loop() {
      const now = performance.now(); let dt = (now - this.lastTick) / 1000; this.lastTick = now;
      if (dt > 1) dt = 0.05; // 탭이 숨겨졌다 돌아옴
      for (const w of this.worlds) {
        Sim.tick(w, dt);
        for (const e of w.events) {
          Net.sendToClients({ t: "ev", team: w.team, ...e }, w.team);
          logEvent(w, e);
        }
        w.events.length = 0;
      }
      this.snapAcc += dt;
      if (this.snapAcc >= 0.1) { this.snapAcc = 0; for (const w of this.worlds) Net.sendToClients(Sim.snapshot(w), w.team); }
      HostView.render();
      if (this.worlds.length && this.worlds.every(w => w.phase === "end")) $("btn-host-end").textContent = "결과 보기";
    },
    end() {
      clearInterval(this.timer);
      for (const w of this.worlds) if (w.phase === "play") { w.phase = "end"; w.result = w.escaped > 0 ? "partial" : "timeout"; Net.sendToClients({ t: "ev", team: w.team, k: "end", result: w.result, escaped: w.escaped, total: w.players.size, wrongs: w.wrongs, fixed: w.fuses.filter(f => f.fixed).length }, w.team); }
      $("end-body").innerHTML = HostView.results(this.worlds);
      $("end-title").textContent = "결과 — 오답 해설";
      show("end");
    },
  };
  function logEvent(w, e) {
    const nm = id => (HostGame.players.get(id) || {}).name || "?";
    const txt = ({ hunt: "괴물이 기척을 쫓는 중", wake: "괴물이 움직이기 시작했다", caught: `${e.name} 잡힘`, revived: `${nm(e.id)} 회복${e.self ? "(스스로)" : ""}`, exit: "발전기 가동 — 출구 열림", escaped: `${e.name} 탈출`, end: `종료: ${e.result}`, spotted: `${nm(e.id)} 발견됨`, fuse: e.ok ? `${e.by} ${e.fuse === -1 ? "발전기 가동" : "에너지 셀 확보"}` : `${e.by} 오답 — 경보` })[e.k];
    if (txt) HostView.addLog(w.team, txt);
  }

  function renderHostLobby() {
    const byTeam = {};
    for (const p of HostGame.players.values()) (byTeam[p.team] = byTeam[p.team] || []).push(p.name);
    const keys = Object.keys(byTeam).sort((a, b) => a - b);
    $("lobby-teams").innerHTML = keys.length ? keys.map(k => `<div class="team"><b>${+k + 1}팀</b> ${byTeam[k].join(", ")}</div>`).join("") : `<div class="muted">학생들이 접속하면 여기에 보입니다.</div>`;
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
  $("btn-student").onclick = () => { show("client-lobby"); $("inp-name").focus(); };
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
    const map = { "set-time": ["timeLimit", 60], "set-safe": ["safeTime", 1], "set-speed": ["monsterSpeed", 1], "set-req": ["requiredFuses", 1], "set-team": ["teamSize", 1], "set-scare": ["scare", 1], "set-intro": ["intro", 1] };
    for (const id in map) {
      const el = $(id); const [key, mul] = map[id];
      el.value = HostGame.settings[key] / mul;
      el.oninput = () => { HostGame.settings[key] = +el.value * mul; if (key === "teamSize") { HostGame.assignTeams(); renderHostLobby(); } $(id + "-v") && ($(id + "-v").textContent = el.value); };
      $(id + "-v") && ($(id + "-v").textContent = el.value);
    }
  }
  $("btn-shuffle").onclick = () => { HostGame.assignTeams(true); HostGame.broadcastLobby(); };
  $("btn-start").onclick = () => {
    if (!HostGame.players.size) { alert("접속한 학생이 없습니다."); return; }
    HostGame.start(); show("host-console");
    $("console-code").textContent = Net.code;
  };
  $("btn-host-end").onclick = () => { if (confirm("게임을 끝내고 결과를 볼까요?")) HostGame.end(); };
  $("btn-end-back").onclick = () => location.reload();

  // ---------------- 화면: 학생 ----------------
  let myTeam = -1, joined = false, gameStarted = false, lobbyInfo = null;
  $("btn-join").onclick = () => {
    const name = $("inp-name").value.trim(), code = $("inp-code").value.trim();
    if (!name || code.length !== 4) { $("join-msg").textContent = "별명과 4자리 방 코드를 입력하세요."; return; }
    Horror.init();
    Net.join(code);
    Net.onMessage(d => clientRecv(d));
    $("btn-join").disabled = true; $("join-msg").textContent = "방을 찾는 중…";
    const tryJoin = () => { if (!joined) { Net.sendToHost({ t: "join", name }); setTimeout(tryJoin, 2000); } };
    setTimeout(tryJoin, 800);
  };
  Net.onStatus(s => {
    const t = s.local ? "" : `연결 ${s.brokers}/3${s.peers ? " · 직접 연결" : ""}`;
    $("net-status").textContent = t; $("console-net").textContent = t;
  });

  function clientRecv(d) {
    if (d.t === "lobby") {
      const mine = d.players.find(p => p[0] === Net.id);
      if (mine) { joined = true; myTeam = mine[2]; Net.setTeam(myTeam); }
      lobbyInfo = d;
      const mates = d.players.filter(p => p[2] === myTeam).map(p => p[1]);
      $("join-msg").innerHTML = mine ? `<b>${myTeam + 1}팀</b> — ${mates.join(", ")}<br><span class="muted">선생님이 시작하면 바로 시작됩니다. 소리를 켜 두세요.</span>` : "입장 중…";
      return;
    }
    if (d.t === "go") {
      const mine = d.players.find(p => p[0] === Net.id);
      if (!mine) return;
      joined = true;
      if (gameStarted) return;
      gameStarted = true; myTeam = mine[2]; Net.setTeam(myTeam);
      const names = {}; d.players.forEach(p => names[p[0]] = p[1]);
      const idx = d.players.filter(p => p[2] === myTeam).findIndex(p => p[0] === Net.id);
      show("game");
      Client.start({ id: Net.id, team: myTeam, settings: d.settings, names, spawnIndex: idx, onEnd: clientEnd });
      return;
    }
    Client.onMessage(d);
  }
  function clientEnd(e) {
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
  $("btn-mute").onclick = () => { const m = $("btn-mute").classList.toggle("muted"); Horror.setMuted(m); $("btn-mute").textContent = m ? "🔇" : "🔊"; };

  // 모달 취소
  $("modal-cancel").onclick = () => Client.cancelModal();

  // 타이틀 깜빡임
  show("title");
  setInterval(() => { $("title-h1").style.opacity = Math.random() < 0.12 ? 0.2 + Math.random() * 0.5 : 1; }, 120);
})();
