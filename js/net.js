// 연결: 공개 MQTT 중계 3곳 동시 사용 + PeerJS 직접 연결 예비. 서버/가입/키 불필요.
// 호스트 → 전체: topic .../h   호스트 → 팀 n: .../t<n>   클라이언트 → 호스트: .../c
window.Net = (function () {
  const BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081",
  ];
  const PREFIX = "blackoutlab/v2/";
  if (window.__TEST_BROKERS) { BROKERS.length = 0; BROKERS.push(...window.__TEST_BROKERS); }
  const newId = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  let myId = newId(), wireId = newId(), generation = 0, peerTimer = null;
  let code = null, isHost = false, seq = 0;
  const clients = [];
  const seen = new Map(); // dedupe key -> time
  let onMsg = () => {};
  let onStatus = () => {};
  let myTeam = -1;
  let peer = null; const peerConns = new Map(); let hostConn = null;
  let local = null; // 오프라인 연습용 루프백

  function status() {
    const n = clients.filter(c => c && c.connected).length;
    const p = isHost ? peerConns.size : (hostConn && hostConn.open ? 1 : 0);
    onStatus({ brokers: n, peers: p, local: !!local });
  }

  function dedupe(m) {
    // 같은 플레이어가 새로고침해도 새 연결의 첫 메시지가 중복으로 버려지지 않는다.
    const k = m.f + ":" + (m.u || "") + ":" + m.s;
    const now = Date.now();
    if (seen.has(k)) return true;
    seen.set(k, now);
    if (seen.size > 4000) for (const [kk, t] of seen) if (now - t > 20000) seen.delete(kk);
    return false;
  }

  function handleRaw(str) {
    let m; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || m.f === myId) return;
    if (dedupe(m)) return;
    onMsg(m.d, m.f);
  }

  function connectBrokers() {
    if (typeof mqtt === "undefined") return;
    const gen = generation;
    BROKERS.forEach((url, i) => {
      try {
        const c = mqtt.connect(url, { clientId: "bl_" + wireId + "_" + i, keepalive: 15, reconnectPeriod: 3000, connectTimeout: 8000, clean: true, queueQoSZero: false });
        c.on("connect", () => { if (gen === generation) { subscribe(c); status(); } });
        c.on("message", (t, payload) => { if (gen === generation) handleRaw(payload.toString()); });
        c.on("close", () => { if (gen === generation) status(); }); c.on("error", () => {});
        clients[i] = c;
      } catch (e) {}
    });
  }
  function subscribe(c) {
    if (isHost) c.subscribe(PREFIX + code + "/c");
    else {
      c.subscribe(PREFIX + code + "/h");
      if (myTeam >= 0) c.subscribe(PREFIX + code + "/t" + myTeam);
    }
  }
  function setTeam(t) {
    if (isHost) { myTeam = t; return; }   // 같이 하는 교사: 구독은 호스트 것 그대로
    if (myTeam === t) return;
    for (const c of clients) if (c && c.connected && myTeam >= 0) c.unsubscribe(PREFIX + code + "/t" + myTeam);
    myTeam = t;
    for (const c of clients) if (c && c.connected && t >= 0) c.subscribe(PREFIX + code + "/t" + t);
  }

  function pack(d) { return JSON.stringify({ f: myId, u: wireId, s: ++seq, d }); }

  function publish(topic, str) {
    for (const c of clients) if (c && c.connected) { try { c.publish(topic, str, { qos: 0 }); } catch (e) {} }
  }

  // PeerJS
  function setupPeer() {
    if (typeof Peer === "undefined") return;
    const gen = generation;
    try {
      const p = peer = new Peer(isHost ? "blackoutlab-" + code : undefined, { debug: 0 });
      p.on("open", () => { if (gen === generation && peer === p) { if (!isHost) connectHostPeer(); status(); } });
      p.on("connection", conn => {
        if (gen !== generation || !isHost) { conn.close(); return; }
        conn.on("open", () => { if (gen === generation) { peerConns.set(conn.peer, conn); status(); } });
        conn.on("data", d => { if (gen === generation) handleRaw(d); });
        conn.on("close", () => { if (gen === generation && peerConns.get(conn.peer) === conn) { peerConns.delete(conn.peer); status(); } });
        conn.on("error", () => {});
      });
      p.on("disconnected", () => { if (gen === generation) status(); });
      p.on("error", () => {}); // MQTT가 살아 있으면 게임은 계속된다.
    } catch (e) {}
  }
  function connectHostPeer() {
    if (isHost || !peer || peer.destroyed || !peer.open) return;
    if (hostConn && (hostConn.open || Date.now() - hostConn._openedAt < 10000)) return;
    if (hostConn) { const old = hostConn; hostConn = null; try { old.close(); } catch (e) {} }
    const gen = generation, conn = hostConn = peer.connect("blackoutlab-" + code, { reliable: false });
    conn._openedAt = Date.now();
    conn.on("open", () => { if (gen === generation && hostConn === conn) status(); });
    conn.on("data", d => { if (gen === generation && hostConn === conn) handleRaw(d); });
    const lost = () => { if (gen === generation && hostConn === conn) { hostConn = null; status(); } };
    conn.on("close", lost); conn.on("error", lost);
  }
  function reconnect() {
    if (!code || local) return;
    for (const c of clients) if (c && !c.connected && !c.reconnecting) { try { c.reconnect(); } catch (e) {} }
    try {
      if (!peer || peer.destroyed) setupPeer();
      else if (peer.disconnected) peer.reconnect();
      else connectHostPeer();
    } catch (e) {}
    status();
  }
  function disconnect() {
    generation++; clearInterval(peerTimer); peerTimer = null;
    const oldClients = clients.splice(0), oldPeer = peer;
    peer = null; hostConn = null; peerConns.clear();
    local = null; hostPlayer = null; code = null; myTeam = -1; seen.clear(); seq = 0; wireId = newId();
    for (const c of oldClients) { try { c.end(true); } catch (e) {} }
    if (oldPeer) { try { oldPeer.destroy(); } catch (e) {} }
  }

  // 공개 API
  function host(roomCode) {
    disconnect(); myId = newId(); isHost = true; code = roomCode;
    connectBrokers(); setupPeer(); status();
    peerTimer = setInterval(reconnect, 4000);
  }
  function join(roomCode, playerId) {
    disconnect(); myId = playerId || newId(); isHost = false; code = roomCode;
    connectBrokers(); setupPeer(); status();
    peerTimer = setInterval(reconnect, 4000);
  }
  function startLocal(hostHandler) {
    // 같은 페이지 안에서 호스트 로직과 직접 연결 (연습 모드)
    disconnect(); myId = newId(); isHost = false;
    local = { toHost: hostHandler };
    status();
  }
  // 호스트가 보냄. team === undefined → 전체
  // 교사도 같은 페이지에서 플레이: 네트워크 호스트 + 이 페이지 안의 학생 한 명
  let hostPlayer = null;
  function addHostPlayer(toClient) { hostPlayer = toClient; }
  function sendToClients(d, team) {
    if (local) { if (local.toClient) local.toClient(d); return; }
    if (hostPlayer) { const hp = hostPlayer; queueMicrotask(() => hp(d, myId)); }
    const str = pack(d);
    publish(PREFIX + code + (team === undefined ? "/h" : "/t" + team), str);
    for (const [, conn] of peerConns) {
      if (!conn.open) continue;
      if (team !== undefined && conn._team !== undefined && conn._team !== team) continue;
      try { conn.send(str); } catch (e) {}
    }
  }
  function tagPeerTeam(peerFrom, team) {
    // PeerJS 연결에 팀 표시(선택 사항) — 메시지 from id와 peer id가 다르므로 모두에게 보내는 쪽을 택함
  }
  // 클라이언트가 호스트에 보냄
  function sendToHost(d) {
    if (local) { local.toHost(d, myId); return; }
    if (isHost && hostPlayer) { const fn = onMsg; queueMicrotask(() => fn && fn(d, myId)); return; }
    const str = pack(d);
    if (hostConn && hostConn.open) { try { hostConn.send(str); } catch (e) {} }
    publish(PREFIX + code + "/c", str);
  }
  function setLocalClient(fn) { if (local) local.toClient = fn; }

  return {
    newId, host, join, reconnect, disconnect, startLocal, setLocalClient, addHostPlayer, sendToClients, sendToHost, setTeam, tagPeerTeam,
    onMessage(fn) { onMsg = fn; }, onStatus(fn) { onStatus = fn; },
    get id() { return myId; }, get code() { return code; }, get isHost() { return isHost; },
  };
})();
