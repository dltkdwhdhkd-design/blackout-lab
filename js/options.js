// 설정: 소리, 감도, 진동 — 이 기기 브라우저에 저장
window.Options = (function () {
  const DEF = { vol: 0.9, amb: 1.0, mouseSens: 1.0, touchSens: 1.0, invertY: false, vib: true, quality: "auto" };
  const KEY = "blackoutlab.options.v1";
  let v = { ...DEF }, open = false, onClose = null;
  try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); for (const k in DEF) if (k in s) v[k] = s[k]; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function get(k) { return v[k]; }
  function apply() { if (window.Horror) { Horror.setVolume(v.vol); Horror.setAmbient(v.amb); } }
  function enableSound(repair = false) {
    if (!window.Horror) return;
    if (!(v.vol > 0)) { v.vol = DEF.vol; save(); }
    Horror.setMuted(false); apply();
    if (repair) Horror.restart();
    const result = Horror.testTone();
    if (open) bind();
    return result;
  }
  const $ = id => document.getElementById(id);
  function bind() {
    const sliders = [["opt-vol", "vol", x => Math.round(x * 100) + "%"], ["opt-amb", "amb", x => Math.round(x * 100) + "%"],
      ["opt-mouse", "mouseSens", x => x.toFixed(1) + "×"], ["opt-touch", "touchSens", x => x.toFixed(1) + "×"]];
    for (const [id, k, fmt] of sliders) {
      const el = $(id); el.value = v[k]; $(id + "-v").textContent = fmt(v[k]);
      el.oninput = () => { v[k] = +el.value; $(id + "-v").textContent = fmt(v[k]); apply(); save(); };
    }
    $("opt-invert").checked = v.invertY; $("opt-invert").onchange = () => { v.invertY = $("opt-invert").checked; save(); };
    $("opt-vib").checked = v.vib; $("opt-vib").onchange = () => { v.vib = $("opt-vib").checked; save(); if (v.vib) Horror.vibrate(60); };
    $("opt-quality").value = v.quality; $("opt-quality").onchange = () => { v.quality = $("opt-quality").value; save(); };
    $("opt-test").onclick = () => enableSound();
    $("opt-repair").onclick = () => enableSound(true);
    $("opt-sound-preview").onclick = async () => {
      if (!(v.vol > 0)) { v.vol = DEF.vol; save(); }
      Horror.setMuted(false); apply();
      $("opt-sound-status").textContent = "소리 준비 중…";
      const ok = await Horror.preview($("opt-sound-kind").value);
      $("opt-sound-status").textContent = ok ? "미리듣기를 재생했습니다." : "소리를 불러오지 못했습니다. 잠시 후 다시 눌러 주세요.";
    };
    $("opt-reset").onclick = () => { v = { ...DEF }; save(); bind(); apply(); };
    $("opt-close").onclick = close;
  }
  function show(cb) {
    onClose = cb || null; open = true;
    if (document.pointerLockElement) document.exitPointerLock();
    bind(); $("options").style.display = "flex";
  }
  function close() { Horror.stopPreview(); open = false; $("options").style.display = "none"; if (onClose) onClose(); }
  return { get, apply, show, close, enableSound, get isOpen() { return open; } };
})();
