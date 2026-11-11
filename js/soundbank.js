// Licensed, recorded horror effects. Sources: audio/CREDITS.md. Hosted with the game.
window.SoundBank = (function () {
  const names = ['capture','scream_a','scream_b','monster_snarl','monster_step_a','monster_step_b','monster_growl','monster_breath','impact','wake','pursuit_loop'];
  const raw = new Map(), buffers = new Map(), voices = new Set(), emitters = new Map();
  let ctx = null, output = null, loading = Promise.resolve(), generation = 0, tensionVoice = null;
  async function bytes(name) {
    if (raw.has(name)) return raw.get(name);
    const pending = (async () => {
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 10000);
      try {
        const res = await fetch(`audio/${name}.mp3?v=20261112-recorded2`, { signal: abort.signal, cache: 'force-cache' });
        if (!res.ok) throw Error('Sound unavailable');
        return await res.arrayBuffer();
      } finally { clearTimeout(timer); }
    })();
    raw.set(name, pending);
    try { return await pending; } catch (e) { raw.delete(name); return null; }
  }
  function detach() {
    generation++; stopAll();
    for (const e of emitters.values()) { e.g.disconnect(); e.filter.disconnect(); e.pan && e.pan.disconnect(); }
    emitters.clear(); buffers.clear(); ctx = output = null;
  }
  function attach(context, destination) {
    detach(); ctx = context; output = destination;
    const token = generation; let index = 0;
    const worker = async () => {
      while (index < names.length && token === generation) {
        const name = names[index++];
        try {
          const data = await bytes(name); if (!data || token !== generation) continue;
          const buffer = await context.decodeAudioData(data.slice(0));
          if (token === generation) buffers.set(name, buffer);
        } catch (e) { /* Existing procedural effects remain available if a file fails. */ }
      }
    };
    loading = Promise.all([worker(), worker(), worker()]);
    return loading;
  }
  function emitter(id, {gain = 0, pan = 0, cutoff = 8000} = {}) {
    if (!ctx) return;
    let e = emitters.get(id);
    if (!e) {
      const g = ctx.createGain(), filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      g.gain.value = 0; g.connect(filter); if (p) { filter.connect(p); p.connect(output); } else filter.connect(output);
      e = {g,filter,pan:p}; emitters.set(id,e);
    }
    const t = ctx.currentTime;
    e.g.gain.setTargetAtTime(Math.max(0,Math.min(1,gain)),t,.09);
    e.filter.frequency.setTargetAtTime(cutoff,t,.12);
    if(e.pan)e.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,pan)),t,.08);
    return e;
  }
  function play(name, {gain = .5, pan = 0, rate = 1, at = 0, emitter: id = null, channel = 'effect', loop = false} = {}) {
    if (!ctx || ctx.state !== 'running' || !buffers.has(name)) return null;
    if (voices.size >= 20) { const old = [...voices].find(v=>!v.loop); if (old) old.stop(); else return null; }
    const src=ctx.createBufferSource(), g=ctx.createGain();
    src.buffer=buffers.get(name);src.loop=loop;src.playbackRate.value=Math.max(.6,Math.min(1.5,rate));g.gain.value=gain;
    let p=null;src.connect(g);
    if(id!==null){const e=emitters.get(id)||emitter(id);g.connect(e.g);}
    else if(ctx.createStereoPanner){p=ctx.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(output);}else g.connect(output);
    const voice={src,g,loop,channel,emitter:id,stop(){try{src.stop();}catch(e){}cleanup();}};
    function cleanup(){voices.delete(voice);src.disconnect();g.disconnect();if(p)p.disconnect();if(tensionVoice===voice)tensionVoice=null;}
    src.onended=cleanup;voices.add(voice);src.start(ctx.currentTime+Math.max(0,at));return voice;
  }
  function tension(amount) {
    if (!ctx || ctx.state !== 'running') return;
    amount=Math.max(0,Math.min(.18,amount));
    if(amount>.001&&!tensionVoice)tensionVoice=play('pursuit_loop',{gain:0,loop:true,channel:'scene'});
    if(tensionVoice)tensionVoice.g.gain.setTargetAtTime(amount,ctx.currentTime,.45);
  }
  function stopChannel(channel) { for(const v of [...voices])if(v.channel===channel)v.stop(); }
  function stopAll() { for(const v of [...voices])v.stop(); tensionVoice=null; }
  function silenceEmitters(active) {
    for(const [id,e] of emitters)if(!active.has(id))e.g.gain.setTargetAtTime(0,ctx.currentTime,.08);
  }
  return {attach,detach,play,emitter,tension,silenceEmitters,stopChannel,stopAll,
    ready:()=>loading,has:name=>buffers.has(name),get loaded(){return buffers.size;}};
})();
