const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = p => fs.readFileSync(path.join(root, p), 'utf8');
const noop = () => {};
function runtime({failOnce = false, rejectResume = false, blocked = false, options = false, bank = false, failedAsset = false} = {}) {
  const contexts = [], timers = new Map(), handlers = {}, windowHandlers = {}, nodes = new Map();
  let tid = 0;
  function param() { return {value: 0, setValueAtTime(v){this.value=v}, exponentialRampToValueAtTime(v){this.value=v}, linearRampToValueAtTime(v){this.value=v}, setTargetAtTime(v){this.value=v}}; }
  class Context {
    constructor() {
      if (failOnce) { failOnce=false; throw Error('audio device busy'); }
      Object.assign(this, {state:'suspended', currentTime:1, sampleRate:1000, destination:{}, resumes:0, closes:0, sounds:[], gains:[]});
      contexts.push(this);
    }
    resume() {
      this.resumes++;
      if (rejectResume) return Promise.reject(Error('gesture required'));
      if (blocked) return Promise.resolve();
      this.state='running'; this.onstatechange?.(); return Promise.resolve();
    }
    close() { this.closes++; this.state='closed'; return Promise.resolve(); }
    node(type) { const context=this; return {type, gain:param(),frequency:param(),detune:param(),Q:param(),pan:param(),playbackRate:param(),connect(dest){this.destination=dest},disconnect(){this.disconnected=true},start(at){context.sounds.push({type,at,frequency:this.frequency.value,node:this})},stop:noop}; }
    decodeAudioData(data) { return Promise.resolve({duration:2,asset:data.name||"decoded"}); }
    createGain() { const n=this.node('gain');this.gains.push(n);return n; }
    createOscillator() { return this.node('oscillator'); }
    createBiquadFilter() { return this.node('filter'); }
    createStereoPanner() { return this.node('pan'); }
    createBufferSource() { return this.node('buffer'); }
    createWaveShaper() { return this.node('shape'); }
    createBuffer(ch,n) { return {getChannelData:()=>new Float32Array(n)}; }
  }
  for (const [,id] of source('index.html').matchAll(/id="([^"]+)"/g)) nodes.set(id,{style:{},value:'',textContent:'',checked:false});
  const s = {console,Math,Map,Set,Float32Array,Promise,AbortController,AudioContext:Context,navigator:{},
    fetch:async url=>({ok:!failedAsset,arrayBuffer:async()=>new ArrayBuffer(32)}),
    setTimeout(f,ms){const id=++tid;timers.set(id,{f,ms});return id},clearTimeout:id=>timers.delete(id),
    document:{hidden:false,addEventListener(n,f,opts){(handlers[n]||=[]).push({f,opts})},getElementById:id=>nodes.get(id)},
    addEventListener(n,f){(windowHandlers[n]||=[]).push(f)},localStorage:{getItem:()=>null,setItem:noop}};
  s.window=s;vm.createContext(s);if(bank)vm.runInContext(source('js/soundbank.js'),s);vm.runInContext(source('js/audio.js'),s);
  if(options)vm.runInContext(source('js/options.js'),s);
  return {s,contexts,timers,nodes,setBlocked(v){blocked=v},setReject(v){rejectResume=v},emit(n,e={}){for(const {f}of handlers[n]||[])f(e)},emitWindow(n){for(const f of windowHandlers[n]||[])f()},handlers};
}
test('entry initializes and resumes audio synchronously inside the button gesture', async()=>{
  const r=runtime();const p=r.s.Horror.init();assert.equal(r.contexts[0].resumes,1);assert.equal(await p,true);assert.equal(r.s.Horror.ready,true);
  await r.s.Horror.init();assert.equal(r.contexts.length,1);assert.equal(r.timers.size,3);
});
test('blocked autoplay stays visible as suspended, then a control touch unlocks audio', async()=>{
  const r=runtime({blocked:true});const statuses=[];r.s.Horror.onStatus(s=>statuses.push(s.state));assert.equal(await r.s.Horror.init(),false);assert.equal(r.s.Horror.ready,false);
  r.setBlocked(false);r.emit('touchend');await Promise.resolve();assert.equal(r.s.Horror.ready,true);assert.ok(statuses.includes('suspended'));assert.equal(statuses.at(-1),'running');assert.equal(r.handlers.touchend[0].opts.capture,true);
});
test('Safari interrupted audio resumes on return, including solo mode without a network session', async()=>{
  const r=runtime();await r.s.Horror.init();const c=r.contexts[0];c.state='interrupted';r.emit('visibilitychange');await Promise.resolve();assert.equal(c.state,'running');
  c.state='interrupted';r.emitWindow('pageshow');await Promise.resolve();assert.equal(c.state,'running');
});
test('a rejected resume is handled and retried on the next keyboard gesture', async()=>{
  const r=runtime({rejectResume:true});assert.equal(await r.s.Horror.init(),false);assert.equal(await r.s.Horror.resume(),false);r.setReject(false);r.emit('keydown');await Promise.resolve();assert.equal(r.s.Horror.ready,true);
});
test('a failed constructor does not permanently mark audio as initialized', async()=>{
  const r=runtime({failOnce:true});assert.equal(await r.s.Horror.init(),false);assert.equal(r.s.Horror.status().state,'error');assert.equal(await r.s.Horror.init(),true);assert.equal(r.contexts.length,1);
});
test('closed context is recreated; repair closes old graph and keeps only one timer set', async()=>{
  const r=runtime();await r.s.Horror.init();const first=r.contexts[0];first.state='closed';await r.s.Horror.init();assert.equal(r.contexts.length,2);assert.equal(r.timers.size,3);
  const old=r.contexts[1];await r.s.Horror.restart();assert.equal(old.closes,1);assert.equal(old.gains[0].disconnected,true);assert.equal(r.timers.size,3);assert.equal(r.s.Horror.ready,true);
});
test('background retry preserves intentional mute and a zero volume setting', async()=>{
  const r=runtime();await r.s.Horror.init();r.s.Horror.setVolume(0);r.s.Horror.setMuted(true);r.contexts[0].state='interrupted';r.emitWindow('focus');await Promise.resolve();assert.equal(r.s.Horror.status().muted,true);assert.equal(r.s.Horror.status().volume,0);
});
test('sound button is excluded from generic gesture recovery so enabling cannot immediately mute it', async()=>{
  const r=runtime({blocked:true});await r.s.Horror.init();const c=r.contexts[0],before=c.resumes;r.setBlocked(false);r.emit('pointerdown',{target:{closest:()=>true}});r.emit('click',{target:{closest:()=>true}});assert.equal(c.resumes,before);
});
test('explicit sound test unmutes, restores zero volume, and plays two audible pitches', async()=>{
  const r=runtime({options:true});r.s.Options.show();const slider=r.nodes.get('opt-vol');slider.value='0';slider.oninput();r.s.Horror.setMuted(true);
  assert.equal(await r.s.Options.enableSound(),true);assert.equal(r.s.Horror.status().muted,false);assert.equal(r.s.Options.get('vol'),0.9);
  const sounds=r.contexts[0].sounds.filter(s=>s.frequency===440||s.frequency===660);assert.deepEqual(sounds.map(s=>s.frequency),[440,660]);
  await r.s.Options.enableSound(true);assert.equal(r.contexts.length,2);assert.equal(r.contexts[0].closes,1);
});
test('resuming a stale context cannot play a delayed test over a replacement context', async()=>{
  const r=runtime({blocked:true});const pending=r.s.Horror.testTone();await r.s.Horror.restart();assert.equal(await pending,false);
});

test('sound bank loads all original clips and plays capture from a decoded buffer',async()=>{
  const r=runtime({bank:true});await r.s.Horror.init();await r.s.SoundBank.ready();assert.equal(r.s.SoundBank.loaded,11);
  const c=r.contexts[0],before=c.sounds.length;r.s.Horror.screech();const newSounds=c.sounds.slice(before);assert.equal(newSounds.length,1);assert.equal(newSounds[0].type,'buffer');assert.ok(newSounds[0].node.buffer);
});
test('two monsters have independent directional footsteps and stop when inactive',async()=>{
  const r=runtime({bank:true});await r.s.Horror.init();await r.s.SoundBank.ready();const c=r.contexts[0];
  r.s.Horror.updateScene([{id:0,dist:3,pan:-.8,speed:3,state:'chase',sees:true},{id:1,dist:8,pan:.7,speed:2,state:'roam',sees:false}]);
  const before=c.sounds.length;[...r.timers.values()].find(t=>t.ms===90).f();
  const steps=c.sounds.slice(before);assert.equal(steps.length,2);assert.notEqual(steps[0].node.destination.destination,steps[1].node.destination.destination);
  r.s.Horror.silenceScene();const count=c.sounds.length;[...r.timers.values()].find(t=>t.ms===90).f();assert.equal(c.sounds.length,count);
});
test('researcher attack layers a human-style scream, monster snarl and timed impact',async()=>{
  const r=runtime({bank:true});await r.s.Horror.init();await r.s.SoundBank.ready();const c=r.contexts[0],before=c.sounds.length;
  r.s.Horror.introAttack(1,.5);const layers=c.sounds.slice(before);assert.equal(layers.length,3);assert.deepEqual(layers.map(x=>x.at),[1,1.12,1.08]);
  r.s.Horror.introEnd();assert.ok(layers.every(x=>x.node.disconnected));
});
test('missing samples preserve procedural effects and never block sound recovery',async()=>{
  const r=runtime({bank:true,failedAsset:true});await r.s.Horror.init();await r.s.SoundBank.ready();assert.equal(r.s.SoundBank.loaded,0);
  const c=r.contexts[0],before=c.sounds.length;r.s.Horror.screech();assert.ok(c.sounds.length>before);assert.equal(await r.s.Horror.resume(),true);
});
test('sound repair closes old sampled voices and restores bank on the new context',async()=>{
  const r=runtime({bank:true});await r.s.Horror.init();await r.s.SoundBank.ready();const old=r.s.SoundBank.play('monster_growl');
  await r.s.Horror.restart();await r.s.SoundBank.ready();assert.equal(old.src.disconnected,true);assert.equal(r.s.SoundBank.loaded,11);assert.ok(r.s.SoundBank.play('scream_a'));
});
test('closing effect preview cancels sounds scheduled for later',async()=>{
  const r=runtime({bank:true});await r.s.Horror.init();await r.s.SoundBank.ready();const c=r.contexts[0],before=c.sounds.length;
  assert.equal(await r.s.Horror.preview('approach'),true);const batch=c.sounds.slice(before);assert.equal(batch.length,8);assert.ok(batch.some(s=>s.at>3));r.s.Horror.stopPreview();assert.ok(batch.every(s=>s.node.disconnected));
});
