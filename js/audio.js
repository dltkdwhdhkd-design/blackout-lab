// 공포 사운드 — 오리지널 음원 + Web Audio 공간 믹싱, 합성음 예비 경로
window.Horror = (function () {
  let ctx = null, master = null, started = false;
  let drone = null, droneGain = null, hbTimer = null, hbRate = 55, hbGain = null;
  let scene = [], voiceState = new Map(), previewSerial = 0, lastStinger = -99;
  let proximity = 0; // 0~1 괴물 근접도
  let whisperTimer = null, stepTimer = null, stepRate = 0, stepVol = 0, stepPan = 0;
  let muted = false;
  let wanted = false, failed = false;
  const listeners = new Set();

  function status() { return { state: failed ? "error" : (ctx ? ctx.state : "idle"), muted, volume: vol }; }
  function notify() { const s = status(); for (const fn of listeners) fn(s); }
  function onStatus(fn) { listeners.add(fn); fn(status()); return () => listeners.delete(fn); }
  function dispose() {
    clearTimeout(hbTimer); clearTimeout(whisperTimer); clearTimeout(stepTimer);
    hbTimer = whisperTimer = stepTimer = null;
    if (window.SoundBank) SoundBank.detach();
    scene = []; voiceState.clear(); previewSerial++;
    const old = ctx;
    ctx = null; started = false; sirenNodes = null;
    if (old) {
      old.onstatechange = null;
      try { if (master) master.disconnect(); } catch (e) {}
      try { Promise.resolve(old.close()).catch(() => {}); } catch (e) {}
    }
    master = drone = droneGain = hbGain = null;
  }

  function init() {
    wanted = true;
    if (started && ctx.state !== "closed") return resume();
    if (ctx) dispose();
    try {
      // 지원하는 Safari에서는 게임 음향을 미디어 재생으로 등록한다.
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.onstatechange = notify;
      master = ctx.createGain(); master.gain.value = muted ? 0 : vol; if (ctx.createDynamicsCompressor) {
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.knee.value = 12;
        limiter.ratio.value = 8; limiter.attack.value = .003; limiter.release.value = .22;
        master.connect(limiter); limiter.connect(ctx.destination);
      } else master.connect(ctx.destination);
      if (window.SoundBank) SoundBank.attach(ctx, master);
      startDrone(); startHeartbeat(); startWhispers(); startSteps(); startRoomTone();
      started = true; failed = false;
      if (window.Options) Options.apply();
      // 입장 버튼을 누른 바로 그 이벤트 안에서 재생을 요청한다.
      return resume();
    } catch (e) {
      dispose(); failed = true; notify(); return Promise.resolve(false);
    }
  }
  function resume() {
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === "closed") return init();
    const current = ctx;
    try {
      // Safari의 interrupted도 suspended와 함께 복구한다.
      const pending = current.state === "running" ? Promise.resolve() : current.resume();
      notify();
      return Promise.resolve(pending).then(() => {
        if (ctx !== current) return false;
        notify(); return current.state === "running";
      }, () => { if (ctx === current) notify(); return false; });
    } catch (e) { notify(); return Promise.resolve(false); }
  }
  function restart() { dispose(); return init(); }
  function testTone() {
    const pending = init(), current = ctx;
    return pending.then(ok => {
      if (!ok || ctx !== current || muted || vol === 0) return false;
      const t = now();
      // 작은 휴대폰 스피커에서도 확인하기 쉬운 두 음. 놀라는 효과음은 쓰지 않는다.
      [440, 660].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), at = t + i * 0.24;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.16, at + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.22);
      });
      return true;
    });
  }
  // 터치 컨트롤의 preventDefault/stopPropagation보다 먼저 재시도한다.
  function gesture(e) {
    // 소리 버튼은 자신의 클릭 처리에서 켠다. 이 단계에서 먼저 켜면 클릭이 끄기로 바뀐다.
    if (e && e.target && e.target.closest && e.target.closest("#btn-mute")) return;
    if (wanted && (!ctx || ctx.state !== "running")) init();
  }
  for (const event of ["pointerdown", "touchend", "click", "keydown"]) document.addEventListener(event, gesture, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) gesture(); });
  window.addEventListener("pageshow", gesture);
  window.addEventListener("focus", gesture);
  function now() { return ctx.currentTime; }

  function noiseBuffer(sec) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // 낮게 울리는 배경 드론
  function startDrone() {
    droneGain = ctx.createGain(); droneGain.gain.value = 0.10; droneGain.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 180; lp.connect(droneGain);
    [38, 38.7, 57, 76.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "sawtooth" : "triangle"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i < 2 ? 0.5 : 0.18;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 1.2; lfo.connect(lg); lg.connect(o.detune);
      lfo.start();
      o.connect(g); g.connect(lp); o.start();
    });
    drone = lp;
  }
  // 전기 없는 건물의 공기 소리 (대역 잡음)
  function startRoomTone() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 400; bp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.012;
    src.connect(bp); bp.connect(g); g.connect(master); src.start();
  }
  // 심장박동 — 근접도에 따라 빨라지고 커짐
  function startHeartbeat() {
    hbGain = ctx.createGain(); hbGain.gain.value = 0.0; hbGain.connect(master);
    const beat = () => {
      const t = now();
      if (ctx.state === "running") { thump(t, 0.9); thump(t + 0.18, 0.6); }
      const bpm = 52 + proximity * 110;
      hbTimer = setTimeout(beat, 60000 / bpm);
    };
    beat();
  }
  function thump(t, amp) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.14);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(hbGain); o.start(t); o.stop(t + 0.2);
  }
  // 속삭임 — 어둠 속에서 드물게
  function startWhispers() {
    const sched = () => {
      whisperTimer = setTimeout(() => { if (ctx.state === "running" && Math.random() < 0.6) whisper(); sched(); }, 9000 + Math.random() * 16000);
    };
    sched();
  }
  function whisper() {
    if (!ctx || ctx.state !== "running") return;
    const t = now(), dur = 1.6 + Math.random() * 1.4;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 6;
    bp.frequency.setValueAtTime(900 + Math.random() * 600, t);
    for (let i = 0; i < 8; i++) bp.frequency.linearRampToValueAtTime(600 + Math.random() * 1800, t + dur * (i + 1) / 8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 6; i++) { g.gain.linearRampToValueAtTime(Math.random() * 0.05, t + dur * (i + 0.5) / 6); g.gain.linearRampToValueAtTime(0.004, t + dur * (i + 1) / 6); }
    g.gain.linearRampToValueAtTime(0, t + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = Math.random() * 2 - 1; g.connect(pan); pan.connect(master); } else g.connect(master);
    src.start(t); src.stop(t + dur);
  }
  // 괴물 발소리 — 거리와 방향
  function startSteps() {
    const tick = () => {
      if (ctx.state === "running") sceneTick();
      stepTimer = setTimeout(tick, 90);
    };
    tick();
  }
  function sample(name, options) { return window.SoundBank && SoundBank.play(name, options); }
  function updateScene(actors) {
    if(!ctx)return;
    scene = actors;
    const ids = new Set();
    let pressure = 0;
    for (const a of actors) {
      ids.add(a.id);
      const near = Math.max(0,1-a.dist/18);
      a.gain = near ** 1.5 * (a.sees ? 1 : .42);
      if (!voiceState.has(a.id)) voiceState.set(a.id,{step:0,voice:now()+.4,foot:0});
      if (window.SoundBank) SoundBank.emitter(a.id,{gain:a.gain,pan:a.pan,cutoff:a.sees?7600:950});
      pressure = Math.max(pressure,near*(a.state==="chase"?.13:.045));
    }
    for (const id of voiceState.keys()) if (!ids.has(id)) voiceState.delete(id);
    if (window.SoundBank) { SoundBank.silenceEmitters(ids); SoundBank.tension(pressure*amb); }
  }
  function sceneTick() {
    const t=now();
    for (const a of scene) {
      if(a.dist>18)continue;
      const st=voiceState.get(a.id);if(!st)continue;
      if(a.speed>.2&&t>=st.step){
        const name=(st.foot++%2)?"monster_step_b":"monster_step_a";
        if(!sample(name,{emitter:a.id,gain:.6,rate:.92+Math.random()*.14,channel:"scene"})){
          stepVol=a.gain*.38;stepPan=a.pan;step();
        }
        st.step=t+Math.max(.26,.75-a.speed*.12)*( .9+Math.random()*.2);
      }
      if(a.dist<16&&t>=st.voice){
        const name=a.state==="chase"?"monster_snarl":(Math.random()<.55?"monster_breath":"monster_growl");
        if(!sample(name,{emitter:a.id,gain:name==="monster_breath"?.3:.47,rate:.94+Math.random()*.12,channel:"scene"})) breath();
        st.voice=t+(a.state==="chase"?2.6:5.2)+Math.random()*2.4;
      }
    }
  }
  function silenceScene() {
    scene=[];voiceState.clear();
    if(window.SoundBank){SoundBank.stopChannel("scene");SoundBank.silenceEmitters(new Set());}
    if(ctx){proximity=0;hbGain.gain.setTargetAtTime(0,now(),.2);droneGain.gain.setTargetAtTime(.04*amb,now(),.4);}
  }
  function monsterCry(kind="wake", pan=0) {
    if(!ctx||ctx.state!=="running")return;
    if(kind==="spotted"&&now()-lastStinger<3)return;
    if(kind==="spotted")lastStinger=now();
    if(!sample(kind==="spotted"?"monster_snarl":"wake",{gain:kind==="spotted"?.6:.48,pan,channel:"effect"}))scrape();
  }
  function researcherScream(variant=0,pan=0,gain=.65,channel="intro") {
    if(!ctx||ctx.state!=="running")return;
    if(!sample(variant%2?"scream_b":"scream_a",{gain,pan,channel}))scrape();
  }
  function introAttack(variant,pan) {
    researcherScream(variant,pan,.7);
    sample("monster_snarl",{gain:.33,pan,at:.12,channel:"intro"});
    if(!sample("impact",{gain:.4,pan,at:.08,channel:"intro"}))bang();
  }
  function introEnd() { if(window.SoundBank)SoundBank.stopChannel("intro"); }
  function stopPreview() { previewSerial++; if(window.SoundBank)SoundBank.stopChannel("preview"); }
  function preview(kind) {
    const pending=init(), token=++previewSerial;
    return pending.then(async ok=>{
      if(!ok)return false;
      const current=ctx;
      if(window.SoundBank)await SoundBank.ready();
      if(ctx!==current||token!==previewSerial)return false;
      if(window.SoundBank)SoundBank.stopChannel("preview");
      const play=(name,o={})=>sample(name,{gain:.55,...o,channel:"preview"});
      if(kind==="approach"){
        for(let i=0;i<6;i++)play(i%2?"monster_step_b":"monster_step_a",{gain:.08+i*.075,pan:-.8+i*.32,at:i*.47,rate:.92+i*.025});
        play("monster_breath",{gain:.24,pan:.35,at:1.2});
        return !!play("monster_growl",{gain:.42,pan:.55,at:2.4});
      }
      return !!play(kind==="researcher"?"scream_b":kind==="capture"?"capture":"monster_growl");
    });
  }
  function step() {
    const t = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.25);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220 + Math.random() * 80;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(stepVol * 1.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const og = ctx.createGain(); og.gain.setValueAtTime(stepVol * 0.9, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(lp); lp.connect(g); o.connect(og);
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, stepPan)); g.connect(pan); og.connect(pan); pan.connect(master); } else { g.connect(master); og.connect(master); }
    src.start(t); src.stop(t + 0.25); o.start(t); o.stop(t + 0.22);
  }
  // 상태 업데이트: 괴물 거리(타일), 상대 x, 속도(타일/초), 보이는지
  function update(dist, relX, speed, sees) {
    if (!ctx) return;
    const p = Math.max(0, Math.min(1, 1 - dist / 12));
    proximity = proximity * 0.85 + p * 0.15;
    hbGain.gain.setTargetAtTime((0.12 + proximity * 0.9) * amb, now(), 0.3);
    droneGain.gain.setTargetAtTime((0.08 + proximity * 0.22) * amb, now(), 0.5);
    drone.frequency.setTargetAtTime(160 + proximity * 500, now(), 0.5);
    stepRate = speed > 0.2 ? Math.min(6, 1.5 + speed * 0.9) : 0;
    stepVol = dist < 14 ? Math.pow(1 - dist / 14, 1.6) * 0.5 * (sees ? 1 : 0.55) : 0;
    stepPan = relX / Math.max(1, dist);
  }
  // 오답: 경보 + 유리 떨림
  function wrong() {
    if (!ctx) return; const t = now();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 110;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.26); g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.26 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.26 + 0.2);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t + i * 0.26); o.stop(t + i * 0.26 + 0.22);
    }
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.2);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(hp); hp.connect(g); g.connect(master); src.start(t + 0.05);
  }
  // 정답: 릴레이 딸깍 + 전기 웅웅
  function right() {
    if (!ctx) return; const t = now();
    const click = ctx.createBufferSource(); click.buffer = noiseBuffer(0.05);
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.5, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    click.connect(cg); cg.connect(master); click.start(t);
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 60;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 0.08); g.gain.exponentialRampToValueAtTime(0.12, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t + 0.08); o.stop(t + 1.7);
  }
  // 잡힘: 비명 같은 쇳소리 + 폭발적 잡음
  function screech() {
    if (!ctx) return;
    silenceScene();
    if(sample("capture",{gain:.78,channel:"capture"}))return;
    const t = now();
    const dist = ctx.createWaveShaper(); const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
    dist.curve = curve;
    const dg = ctx.createGain(); dg.gain.value = 0.8; dist.connect(dg); dg.connect(master);
    [1, 1.5, 2.37].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(1400 * m, t); o.frequency.exponentialRampToValueAtTime(220 * m, t + 1.1);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 / (i + 1), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const lg = ctx.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + 1.3);
      o.connect(g); g.connect(dist); o.start(t); o.stop(t + 1.3);
    });
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    src.connect(g); g.connect(master); src.start(t);
    const boom = ctx.createOscillator(); boom.frequency.setValueAtTime(80, t); boom.frequency.exponentialRampToValueAtTime(25, t + 1.5);
    const bg = ctx.createGain(); bg.gain.setValueAtTime(1, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    boom.connect(bg); bg.connect(master); boom.start(t); boom.stop(t + 1.6);
  }
  // 긁는 소리 — 벽 너머
  function scrape() {
    if (!ctx) return; const t = now(), dur = 0.9;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 12; bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }
  // 문 쾅
  function bang() {
    if (!ctx) return; const t = now();
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.3);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(ng); ng.connect(master); src.start(t);
  }
  // 숨 참는 소리(사물함)
  function breath() {
    if (!ctx) return; const t = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.2);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.5); g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
  }
  // 탈출 성공: 전등 켜지는 소리
  function lightsOn() {
    if (!ctx) return; const t = now();
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 120;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(4000, t + 1.5);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 2.6);
    droneGain.gain.setTargetAtTime(0.0, t, 1); hbGain.gain.setTargetAtTime(0, t, 1);
  }
  // 경보 사이렌 (켜기/끄기)
  let sirenNodes = null;
  function siren(on) {
    if (!ctx) return;
    if (!on) { if (sirenNodes) { const nodes = sirenNodes, t = now(); nodes.g.gain.setTargetAtTime(0, t, 0.3); setTimeout(() => { try { nodes.o.stop(); nodes.lfo.stop(); } catch (e) {} }, 800); sirenNodes = null; } return; }
    if (sirenNodes) return;
    const o = ctx.createOscillator(); o.type = "square"; const g = ctx.createGain(); g.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200;
    const lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = 1.1; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(o.frequency);
    o.frequency.value = 620; o.connect(lp); lp.connect(g); g.connect(master); o.start(); lfo.start();
    g.gain.setTargetAtTime(0.09, now(), 0.2);
    sirenNodes = { o, g, lfo };
  }
  // 전등 폭발: 퍽 + 유리 파편
  function shatter() {
    if (!ctx) return; const t = now();
    const pop = ctx.createOscillator(); pop.frequency.setValueAtTime(220, t); pop.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const pg = ctx.createGain(); pg.gain.setValueAtTime(0.8, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); pop.connect(pg); pg.connect(master); pop.start(t); pop.stop(t + 0.3);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.0);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(hp); hp.connect(g); g.connect(master); src.start(t + 0.02);
    for (let i = 0; i < 6; i++) { const o = ctx.createOscillator(); o.frequency.value = 2500 + Math.random() * 4000; const og = ctx.createGain(); const tt = t + 0.05 + Math.random() * 0.5; og.gain.setValueAtTime(0.0001, tt); og.gain.exponentialRampToValueAtTime(0.08, tt + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.12); o.connect(og); og.connect(master); o.start(tt); o.stop(tt + 0.15); }
  }
  // 전기 스파크 지직
  function spark() {
    if (!ctx) return; const t = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.3);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4000; bp.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); for (let i = 0; i < 5; i++) { g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.05 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.04); }
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
  }
  // 손전등 딸깍
  function click() {
    if (!ctx) return; const t = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.04);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500;
    src.connect(hp); hp.connect(g); g.connect(master); src.start(t);
  }
  let vol = 0.9, amb = 1;
  function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : vol, now(), 0.05); notify(); }
  function setVolume(x) { vol = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.9; if (master && !muted) master.gain.setTargetAtTime(vol, now(), 0.05); notify(); }
  function setAmbient(x) { amb = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1; }
  function vibrate(p) { try { if (window.Options && !Options.get("vib")) return; if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  return { init, resume, restart, testTone, status, onStatus, update, updateScene, silenceScene, monsterCry, researcherScream, introAttack, introEnd, preview, stopPreview, wrong, right, screech, scrape, bang, breath, lightsOn, whisper, siren, shatter, spark, click, setMuted, setVolume, setAmbient, vibrate, get ready() { return started && ctx.state === "running"; } };
})();
