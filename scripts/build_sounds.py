"""Original BLACKOUT LAB effects. Rebuild with Python + NumPy/SciPy + ffmpeg.
No recordings or third-party samples. Formant voices, foley and designed impacts.
"""
from pathlib import Path
import json, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audio'
SR = 32000
rng = np.random.default_rng(71112026)

def timeline(d): return np.arange(round(d*SR))/SR
def norm(x, peak=1): return x * (peak/(np.max(np.abs(x))+1e-9))
def filt(x, hz, kind='lowpass', order=2):
    return signal.sosfilt(signal.butter(order,hz,btype=kind,fs=SR,output='sos'),x)
def contour(t, points): return np.interp(t,*zip(*points))
def fades(x, attack=.008, release=.08):
    x=x.copy(); a=min(len(x),round(attack*SR)); b=min(len(x),round(release*SR))
    x[:a]*=np.linspace(0,1,a)**1.3; x[-b:]*=np.linspace(1,0,b)**1.5; return x

def voice(d, pitch, formants, rough=.25):
    t=timeline(d)
    jitter=filt(rng.normal(size=len(t)),38); jitter=norm(jitter)
    f0=contour(t,pitch)*(1+.018*np.sin(2*np.pi*5.7*t)+.042*jitter)
    phase=np.cumsum(f0)/SR*2*np.pi
    source=sum(np.sin(h*phase+.06*np.sin(2*np.pi*(31+h*.3)*t))/(h**1.15) for h in range(1,39))
    source*=1-rough+rough*(.5+.5*np.sin(phase/2+.6*np.sin(2*np.pi*9*t)))
    air=filt(rng.normal(size=len(t)),[300,6500],'bandpass')
    source=np.tanh(source*1.1)+.13*air
    voiced=np.zeros(len(t))
    for freq,bw,amp in formants:
        b,a=signal.iirpeak(freq,freq/bw,fs=SR)
        voiced+=amp*signal.lfilter(b,a,source)
    voiced=norm(voiced)*(.86+.14*np.sin(2*np.pi*(10+rough*30)*t))
    return fades(voiced,.055,.24)

def echo(x, tail=.45, wet=.22):
    out=np.pad(x,(0,round(tail*SR)))
    for delay,g in [(0.027,.6),(.061,.42),(.113,.28),(.187,.18),(.293,.1)]:
        n=round(delay*SR); out[n:n+len(x)]+=filt(x,3600)*g*wet
    return fades(out,.004,.1)

def scream(high=False):
    d=1.75 if high else 1.55; t=timeline(d)
    pts=[(0,180),(.09,330),(.25,610),(.65,540),(1.0,380),(1.2,420),(d,170)] if high else [(0,135),(.1,275),(.28,440),(.7,390),(1.1,300),(d,120)]
    f=[(870,180,1),(1390,260,.75),(2950,450,.4)] if high else [(760,190,1),(1180,220,.7),(2450,380,.35)]
    y=voice(d,pts,f,.38)
    env=contour(t,[(0,0),(.04,.35),(.12,1),(.7,.9),(1.05,.6),(d-.2,.25),(d,0)])
    # A broken exhalation, involuntary pitch break, and breath at the end.
    y*=env*(1-.3*np.exp(-((t-.94)/.035)**2))
    y+=.10*filt(rng.normal(size=len(t)),[700,4200],'bandpass')*env
    return echo(y,wet=.32)

def growl(snarl=False):
    d=1.1 if snarl else 2.9; t=timeline(d)
    p=[(0,55),(.13,128),(.4,92),(d,42)] if snarl else [(0,42),(.5,61),(1.2,48),(2.0,75),(d,36)]
    y=voice(d,p,[(280,110,1),(690,210,.72),(1730,480,.42)],.8)
    phase=np.cumsum(contour(t,p))/SR*2*np.pi
    sub=np.sin(phase/2)*(.5+.5*np.sin(2*np.pi*13*t)**2)
    rasp=filt(rng.normal(size=len(t)),[500,2600],'bandpass')*(.5+.5*np.sin(2*np.pi*34*t))
    env=contour(t,[(0,0),(.08 if snarl else .35,1),(d*.65,.8),(d,0)])
    return echo(np.tanh(y*1.8)*.65*env+.22*sub*env+.12*rasp*env,wet=.4)

def breath():
    t=timeline(3.4); n=rng.normal(size=len(t))
    air=filt(n,[180,2300],'bandpass'); throat=filt(n,[340,800],'bandpass')
    env=np.exp(-((t-.8)/.5)**2)+.85*np.exp(-((t-2.3)/.62)**2)
    y=air*.3+throat*(.7+.3*np.sin(2*np.pi*28*t))
    return echo(norm(y)*env,wet=.18)

def foot(variant=0):
    t=timeline(.65); phase=2*np.pi*np.cumsum(45+90*np.exp(-t*34))/SR
    weight=.7*np.sin(phase)*np.exp(-t*15)+.23*np.sin(phase*2.4)*np.exp(-t*30)
    crack=filt(rng.normal(size=len(t)),[400,4000],'bandpass')*np.exp(-t*48)*.3
    drag=filt(rng.normal(size=len(t)),[230,1500],'bandpass')*.27*np.exp(-((t-.13-variant*.04)/.07)**2)
    chain=sum(np.sin(2*np.pi*f*t)*np.exp(-t*(22+i*4)) for i,f in enumerate([930,1477,2190]))*.022
    return echo(fades(weight+crack+drag+chain,.002,.16),tail=.32,wet=.27)

def impact():
    t=timeline(1.3)
    y=np.sin(2*np.pi*np.cumsum(32+105*np.exp(-t*22))/SR)*np.exp(-t*7)
    y+=filt(rng.normal(size=len(t)),[120,4300],'bandpass')*np.exp(-t*26)*.65
    return echo(fades(y,.002,.15),tail=.5,wet=.3)

def bed():
    t=timeline(6.4); n=len(t)
    # Disordered bowed-metal harmonics and low pressure, no pitched melody.
    y=sum(np.sin(2*np.pi*f*t+.3*np.sin(2*np.pi*(.17+i*.13)*t))/(1+i*.5) for i,f in enumerate([41,57.3,82.8,123.7,187.1]))*.13
    pulse=(.45+.55*np.sin(2*np.pi*1.25*t)**8)
    y+=filt(rng.normal(size=n),[80,430],'bandpass')*.6*pulse
    y+=filt(rng.normal(size=n),[1400,2100],'bandpass')*.07*(.5+.5*np.sin(2*np.pi*.62*t))
    # Crossfade the endpoints for a seamless pressure loop.
    size=round(.4*SR); x=np.linspace(0,1,size)
    join=y[-size:]*(1-x)+y[:size]*x
    return np.r_[join,y[size:-size]]

def mix(parts,duration):
    out=np.zeros(round(duration*SR))
    for at,x,g in parts:
        n=round(at*SR); length=min(len(x),len(out)-n);out[n:n+length]+=x[:length]*g
    return out

OUT.mkdir(exist_ok=True)
a,b=scream(),scream(True); gr,sn=growl(),growl(True); hit=impact()
clips={'monster_growl':gr,'monster_snarl':sn,'monster_breath':breath(),
       'monster_step_a':foot(),'monster_step_b':foot(1),'scream_a':a,'scream_b':b,
       'impact':hit,'pursuit_loop':bed()}
clips['capture']=mix([(0,sn,.55),(.045,hit,.62),(.13,b,.7),(.73,gr,.3)],3.6)
clips['wake']=mix([(0,gr,.6),(.08,hit,.38),(.48,sn,.35)],3.4)
manifest=[]
with tempfile.TemporaryDirectory() as tmp:
    for name,data in clips.items():
        data=filt(data,45,'highpass')
        data=np.tanh(norm(data)*1.25)
        data=norm(data,.82)
        if name!='pursuit_loop':data=fades(data,.003,.1)
        wav=Path(tmp)/(name+'.wav');mp3=OUT/(name+'.mp3')
        wavfile.write(wav,SR,(data*32767).astype(np.int16))
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','80k','-ar',str(SR),'-map_metadata','-1',str(mp3)],check=True)
        decoded=subprocess.check_output(['ffmpeg','-v','error','-i',str(mp3),'-f','f32le','-ac','1','-ar',str(SR),'-'])
        pcm=np.frombuffer(decoded,dtype=np.float32)
        assert np.isfinite(pcm).all() and np.max(abs(pcm))<.99
        assert np.sqrt(np.mean(pcm**2))>.025
        manifest.append({'name':name,'seconds':round(len(pcm)/SR,3),'bytes':mp3.stat().st_size,'peak':round(float(np.max(abs(pcm))),4)})
(OUT/'manifest.json').write_text(json.dumps({'sampleRate':SR,'origin':'Original synthesized sound design; no third-party recordings.','clips':manifest},indent=2)+'\n')
print(json.dumps(manifest,indent=2))
print('TOTAL BYTES',sum(x['bytes'] for x in manifest))
