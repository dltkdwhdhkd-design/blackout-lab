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
  const myId = Math.random().toString(36).slice(2, 10);
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
    const k = m.f + ":" + m.s;
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
    BROKERS.forEach((url, i) => {
      try {
        const c = mqtt.connect(url, { clientId: "bl_" + myId + "_" + i, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000, clean: true });
        c.on("connect", () => { subscribe(c); status(); });
        c.on("message", (t, payload) => handleRaw(payload.toString()));
        c.on("close", status); c.on("error", () => {});
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
    if (myTeam === t) return;
    for (const c of clients) if (c && c.connected && myTeam >= 0) c.unsubscribe(PREFIX + code + "/t" + myTeam);
    myTeam = t;
    for (const c of clients) if (c && c.connected && t >= 0) c.subscribe(PREFIX + code + "/t" + t);
  }

  function pack(d) { return JSON.stringify({ f: myId, s: ++seq, d }); }

  function publish(topic, str) {
    for (const c of clients) if (c && c.connected) { try { c.publish(topic, str, { qos: 0 }); } catch (e) {} }
  }

  // PeerJS
  function setupPeer() {
    if (typeof Peer === "undefined") return;
    try {
      if (isHost) {
        peer = new Peer("blackoutlab-" + code, { debug: 0 });
        peer.on("connection", conn => {
          conn.on("open", () => { peerConns.set(conn.peer, conn); status(); });
          conn.on("data", d => handleRaw(d));
          conn.on("close", () => { peerConns.delete(conn.peer); status(); });
        });
        peer.on("error", () => {});
      } else {
        peer = new Peer(undefined, { debug: 0 });
        peer.on("open", () => {
          hostConn = peer.connect("blackoutlab-" + code, { reliable: false });
          hostConn.on("open", status);
          hostConn.on("data", d => handleRaw(d));
          hostConn.on("close", () => { hostConn = null; status(); });
          hostConn.on("error", () => {});
        });
        peer.on("error", () => {});
      }
    } catch (e) {}
  }

  // 공개 API
  function host(roomCode) {
    isHost = true; code = roomCode;
    connectBrokers(); setupPeer(); status();
  }
  function join(roomCode) {
    isHost = false; code = roomCode;
    connectBrokers(); setupPeer(); status();
  }
  function startLocal(hostHandler) {
    // 같은 페이지 안에서 호스트 로직과 직접 연결 (연습 모드)
    local = { toHost: hostHandler };
    status();
  }
  // 호스트가 보냄. team === undefined → 전체
  function sendToClients(d, team) {
    if (local) { if (local.toClient) local.toClient(d); return; }
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
    const str = pack(d);
    if (hostConn && hostConn.open) { try { hostConn.send(str); } catch (e) {} }
    publish(PREFIX + code + "/c", str);
  }
  function setLocalClient(fn) { if (local) local.toClient = fn; }

  return {
    id: myId, host, join, startLocal, setLocalClient, sendToClients, sendToHost, setTeam, tagPeerTeam,
    onMessage(fn) { onMsg = fn; }, onStatus(fn) { onStatus = fn; },
    get code() { return code; }, get isHost() { return isHost; },
  };
})();
