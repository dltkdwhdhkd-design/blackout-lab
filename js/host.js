// 교사 관제 화면 — 팀별 세계를 미니맵으로 (TV에 띄우기)
window.HostView = (function () {
  let cv, ctx, worlds = [], names = {}, log = [];
  const teamColors = ["#7ec8ff", "#ffd27e", "#9dff8a", "#ff9ad5", "#c9a6ff", "#ffb48a", "#8affd9", "#ff8a8a"];

  function init(ws, nm) {
    worlds = ws; names = nm; log = [];
    cv = document.getElementById("host-canvas"); ctx = cv.getContext("2d");
    document.getElementById("host-log").innerHTML = "";
  }
  function addLog(team, text) {
    log.unshift(`<div><b style="color:${teamColors[team % 8]}">${team + 1}팀</b> ${text}</div>`);
    if (log.length > 40) log.length = 40;
    document.getElementById("host-log").innerHTML = log.join("");
  }
  function render() {
    if (!cv) return;
    const Wd = cv.clientWidth, Hd = cv.clientHeight;
    if (Wd < 50 || Hd < 50) return;
    if (cv.width !== Wd || cv.height !== Hd) { cv.width = Wd; cv.height = Hd; }
    ctx.fillStyle = "#07080a"; ctx.fillRect(0, 0, Wd, Hd);
    const n = Math.max(1, worlds.length);
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const cw = Wd / cols, ch = Hd / rows;
    worlds.forEach((w, i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      drawWorld(w, cx + 8, cy + 26, cw - 16, ch - 34, i);
    });
  }
  function drawWorld(w, x, y, wd, ht, idx) {
    const T = Math.min(wd / MAP_W, ht / MAP_H);
    const ox = x + (wd - T * MAP_W) / 2, oy = y + (ht - T * MAP_H) / 2;
    // 헤더
    ctx.fillStyle = teamColors[idx % 8]; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    const fixed = w.fuses.filter(f => f.fixed).length;
    const alive = [...w.players.values()];
    const status = w.introT > 0 ? "시작 연출 중" : w.phase === "end" ? ({ escaped: "전원 탈출", partial: "일부 탈출", lost: "전멸", timeout: "시간 초과" })[w.result] : `${fmt(w.time)} · 발전기 ${w.inserted}/${w.settings.requiredFuses} · 꺼낸 셀 ${fixed}${w.cctv && w.elapsed < w.cctv.until ? " · CCTV" : ""}${w.exitOpen ? " · 출구 열림" : ""}`;
    ctx.fillText(`${idx + 1}팀  ${status}`, x, y - 8);
    ctx.fillStyle = "#aaa"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(alive.map(p => (p.escaped ? "✓" : p.down ? "✕" : "●") + p.name).join("  "), x + wd, y - 8);
    // 맵
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      const t = MapUtil.tile(tx, ty);
      const rm = MapUtil.roomAt(tx + 0.5, ty + 0.5) || {}; ctx.fillStyle = t === "#" ? "#262a31" : rm.tex === "hall" ? "#3b4049" : rm.tex === "contain" ? "#4a3a3a" : rm.tex === "power" ? "#3a3f38" : "#4a4238";
      if (t === "E") ctx.fillStyle = w.exitOpen ? "#2e8b3a" : "#7a2020";
      if (t === "L") ctx.fillStyle = "#33404f";
      if (window.PROPS && PROPS[t]) ctx.fillStyle = PROPS[t].tall ? "#4d4a44" : "#5a5650";
      ctx.fillRect(ox + tx * T, oy + ty * T, T, T);
    }
    for (const f of w.fuses) { ctx.fillStyle = f.fixed ? "#58ff7a" : "#ff4040"; ctx.fillRect(ox + f.x * T + T * 0.2, oy + f.y * T + T * 0.2, T * 0.6, T * 0.6); }
    const b = MapUtil.find("B")[0]; ctx.fillStyle = w.exitOpen ? "#58ff7a" : "#ffb020"; ctx.fillRect(ox + b.x * T, oy + b.y * T, T, T);
    // 방 이름
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = `${Math.max(8, T * 1.3)}px sans-serif`; ctx.textAlign = "center";
    for (const r of ROOMS) if (!r.id.startsWith("hall")) ctx.fillText(r.name, ox + (r.x0 + r.x1 + 1) / 2 * T, oy + (r.y0 + r.y1 + 1) / 2 * T + T * 1.5);
    // 플레이어
    let i = 0;
    for (const p of w.players.values()) {
      if (p.escaped) { i++; continue; }
      ctx.fillStyle = p.down ? "#ff6060" : ["#7ec8ff", "#ffd27e", "#9dff8a", "#ff9ad5", "#c9a6ff", "#ffb48a"][i % 6];
      ctx.beginPath(); ctx.arc(ox + p.x * T, oy + p.y * T, T * 0.45, 0, 7); ctx.fill();
      if (p.hid) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(); }
      if (p.light && !p.down) { ctx.strokeStyle = "rgba(255,230,140,0.8)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ox + p.x * T, oy + p.y * T); ctx.lineTo(ox + (p.x + Math.cos(p.a) * 3) * T, oy + (p.y + Math.sin(p.a) * 3) * T); ctx.stroke(); }
      ctx.fillStyle = "#fff"; ctx.font = `${Math.max(8, T * 0.9)}px sans-serif`; ctx.fillText(p.name + (p.carry ? " ◆".repeat(p.carry) : "") + (p.medkit ? " ✚" : ""), ox + p.x * T, oy + p.y * T - T * 0.7);
      i++;
    }
    for (const d of w.drops || []) { ctx.fillStyle = "#7ff6ff"; ctx.beginPath(); ctx.arc(ox + d.x * T, oy + d.y * T, T * 0.5, 0, 7); ctx.fill(); }
    // 괴물
    const m = w.monster;
    if (m.state !== "sleep") {
      ctx.fillStyle = m.state === "chase" ? "#ff2020" : "#b05aff";
      ctx.beginPath(); ctx.moveTo(ox + m.x * T, oy + m.y * T - T * 0.8); ctx.lineTo(ox + m.x * T + T * 0.6, oy + m.y * T + T * 0.5); ctx.lineTo(ox + m.x * T - T * 0.6, oy + m.y * T + T * 0.5); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `${Math.max(8, T * 0.9)}px sans-serif`;
      ctx.fillText(({ roam: "배회", hunt: "추적", chase: "추격!", search: "수색", feed: "…" })[m.state] || "", ox + m.x * T, oy + m.y * T + T * 1.4);
    } else { ctx.fillStyle = "#777"; ctx.font = `${Math.max(8, T * 0.9)}px sans-serif`; ctx.fillText(`${Math.max(0, Math.ceil(w.settings.safeTime - w.elapsed))}초 뒤 깨어남`, ox + m.x * T, oy + m.y * T); }
  }
  function fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

  // 결과 화면 HTML
  function results(ws) {
    let html = "";
    ws.forEach((w, i) => {
      const fixed = w.fuses.filter(f => f.fixed).length;
      const res = ({ escaped: "전원 탈출", partial: "일부 탈출", lost: "전멸", timeout: "시간 초과" })[w.result] || "진행 중";
      html += `<section class="res-team"><h3 style="color:${teamColors[i % 8]}">${i + 1}팀 — ${res}</h3>
        <p>탈출 ${w.escaped}/${w.players.size}명 · 발전기에 넣은 셀 ${w.inserted}/${w.settings.requiredFuses} (꺼낸 셀 ${fixed}) · 오답 ${w.wrongs.length}개 · 잡힌 횟수 ${[...w.players.values()].reduce((a, p) => a + p.caught, 0)}</p>`;
      if (w.wrongs.length) {
        html += `<table><tr><th>학생</th><th>단원</th><th>문제</th><th>고른 답</th><th>정답 · 해설</th></tr>`;
        for (const wr of w.wrongs) {
          const it = QUESTION_BANK[wr.unit].items[wr.qi];
          html += `<tr><td>${wr.name}</td><td>${QUESTION_BANK[wr.unit].name}</td><td>${it.q}</td><td class="bad">${wr.chosen >= 0 ? it.c[wr.chosen] : "시간 초과"}</td><td><b>${it.c[it.a]}</b><br><small>${it.e}</small></td></tr>`;
        }
        html += `</table>`;
      } else html += `<p>오답 없음.</p>`;
      html += `</section>`;
    });
    return html;
  }
  return { init, render, addLog, results };
})();
