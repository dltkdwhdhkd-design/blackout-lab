"""Build licensed recordings for BLACKOUT LAB. See audio/CREDITS.md.
Requires Python, NumPy, SciPy, ffmpeg and libarchive. No voice/noise synthesis.
Source downloads are cached locally and verified with SHA-256.
"""
from pathlib import Path
from urllib.request import urlopen
import ctypes as C
import ctypes.util
import hashlib, json, subprocess, tempfile, zipfile
import numpy as np
from scipy import signal
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'audio'
CACHE=ROOT/'.openai'/'audio-sources'
SR=44100
SOURCES=[
 ('horror.zip','https://opengameart.org/sites/default/files/Horror%20Sound%20Library.zip','b14cdd3403013696a7dc85ed0f782aa3359a731aacb017c15d7cd9544f98fb31'),
 ('metal_steps.7z','https://opengameart.org/sites/default/files/metal_steps_48k24b.7z','3df6f81f669dd2f5bf83b8dab46cd0942bd86e7d33cc4409f1ba8470a9df488d')]

def download():
 CACHE.mkdir(parents=True,exist_ok=True)
 for name,url,digest in SOURCES:
  path=CACHE/name
  if not path.exists():
   print('Downloading',name,flush=True)
   with urlopen(url,timeout=90) as response: data=response.read()
   if hashlib.sha256(data).hexdigest()!=digest: raise ValueError('Source checksum changed: '+name)
   path.write_bytes(data)
  if hashlib.sha256(path.read_bytes()).hexdigest()!=digest: raise ValueError('Invalid cache: '+name)

def extract_steps(directory):
 library=ctypes.util.find_library('archive')
 if not library: raise RuntimeError('Install libarchive to extract the CC0 footsteps.')
 a=C.CDLL(library); a.archive_read_new.restype=C.c_void_p
 for name,args,result in [
  ('archive_read_support_format_7zip',[C.c_void_p],C.c_int),
  ('archive_read_support_filter_all',[C.c_void_p],C.c_int),
  ('archive_read_open_filename',[C.c_void_p,C.c_char_p,C.c_size_t],C.c_int),
  ('archive_read_next_header',[C.c_void_p,C.POINTER(C.c_void_p)],C.c_int),
  ('archive_entry_pathname',[C.c_void_p],C.c_char_p),
  ('archive_read_data',[C.c_void_p,C.c_void_p,C.c_size_t],C.c_ssize_t),
  ('archive_read_free',[C.c_void_p],C.c_int)]:
  fn=getattr(a,name);fn.argtypes=args;fn.restype=result
 h=a.archive_read_new()
 try:
  a.archive_read_support_filter_all(h);a.archive_read_support_format_7zip(h)
  if a.archive_read_open_filename(h,str(CACHE/'metal_steps.7z').encode(),10240)!=0: raise RuntimeError('Cannot open archive')
  entry=C.c_void_p();buf=C.create_string_buffer(65536)
  while True:
   status=a.archive_read_next_header(h,C.byref(entry))
   if status==1: break
   if status!=0: raise RuntimeError('Invalid archive entry')
   name=a.archive_entry_pathname(entry).decode();chunks=[]
   while True:
    n=a.archive_read_data(h,buf,len(buf))
    if n==0: break
    if n<0: raise RuntimeError('Corrupt archive')
    chunks.append(buf.raw[:n])
   if name.endswith('.wav'): (directory/Path(name).name).write_bytes(b''.join(chunks))
 finally: a.archive_read_free(h)

def norm(x,peak=.82): return x*peak/max(1e-9,float(np.max(abs(x))))
def fades(x,attack=.003,release=.06):
 x=x.copy();a=min(len(x),round(attack*SR));b=min(len(x),round(release*SR))
 if a: x[:a]*=np.linspace(0,1,a)
 if b: x[-b:]*=np.linspace(1,0,b)
 return x

def decode(path):
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(SR),'-'])
 return np.frombuffer(raw,dtype=np.float32).copy()

def room(x,wet=.12):
 # Short quiet reflections preserve the recorded voice and footstep transients.
 out=np.pad(x,(0,round(.32*SR)))
 for delay,gain in [(.037,1),(.079,.62),(.137,.32),(.229,.15)]:
  start=round(delay*SR);out[start:start+len(x)]+=x*gain*wet
 return fades(out,.002,.05)

def mix(parts):
 out=np.zeros(max(round(at*SR)+len(x) for at,x,g in parts))
 for at,x,g in parts:
  start=round(at*SR);out[start:start+len(x)]+=x*g
 return fades(out)

def main():
 download();OUT.mkdir(exist_ok=True)
 with tempfile.TemporaryDirectory() as tmp:
  source=Path(tmp)
  with zipfile.ZipFile(CACHE/'horror.zip') as z:
   for name in z.namelist():
    if name.startswith('Horror Sound Library/Wav/') and name.endswith('.wav'):
     (source/Path(name).name).write_bytes(z.read(name))
  extract_steps(source)
  def clip(name,rate=1):
   x=decode(source/name)
   if rate!=1: x=signal.resample_poly(x,100,round(rate*100))
   x=signal.sosfilt(signal.butter(2,38,'highpass',fs=SR,output='sos'),x)
   return fades(norm(x),.003,.035)
  growl=clip('Monster_00.wav');snarl=clip('Monster_01.wav')
  a=room(clip('Scream_Male_00.wav'),.10);b=room(clip('Scream_Male_01.wav'),.10)
  hit=room(clip('Bonecrack_00.wav'),.10);loop=clip('Evil_Machine_Loop_00.wav')
  size=round(.15*SR);ramp=np.linspace(0,1,size)
  loop=np.r_[loop[-size:]*(1-ramp)+loop[:size]*ramp,loop[size:-size]]
  clips={
   'monster_growl':(growl,['Monster_00.wav']),
   'monster_snarl':(snarl,['Monster_01.wav']),
   'monster_breath':(room(clip('Breath_Scared_06.wav',.80),.08),['Breath_Scared_06.wav']),
   'monster_step_a':(room(clip('metal_steps_24.wav',.86),.16),['metal_steps_24.wav']),
   'monster_step_b':(room(clip('metal_steps_25.wav',.86),.16),['metal_steps_25.wav']),
   'scream_a':(a,['Scream_Male_00.wav']),
   'scream_b':(b,['Scream_Male_01.wav']),
   'impact':(hit,['Bonecrack_00.wav']),
   'pursuit_loop':(loop,['Evil_Machine_Loop_00.wav']),
   'capture':(mix([(0,snarl,.66),(.045,hit,.42),(.16,b,.88)]),['Monster_01.wav','Bonecrack_00.wav','Scream_Male_01.wav']),
   'wake':(clip('Monster_03.wav'),['Monster_03.wav'])}
  manifest=[]
  for name,(data,originals) in clips.items():
   # Linear gain only, without tanh distortion or flattened voice dynamics.
   data=norm(data,.78 if name=='pursuit_loop' else .82)
   wav=source/(name+'.wav');mp3=OUT/(name+'.mp3')
   wavfile.write(wav,SR,(data*32767).astype(np.int16))
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','128k','-ar',str(SR),'-map_metadata','-1',str(mp3)],check=True)
   pcm=decode(mp3);peak=float(max(abs(pcm)));rms=float(np.sqrt(np.mean(pcm**2)))
   assert np.isfinite(pcm).all() and peak<.98 and rms>.015,name
   manifest.append({'name':name,'seconds':round(len(pcm)/SR,3),'bytes':mp3.stat().st_size,'peak':round(peak,4),'rms':round(rms,4),'sourceFiles':originals,'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()})
  (OUT/'manifest.json').write_text(json.dumps({'version':'20261112-recorded2','sampleRate':SR,'bitrate':128000,'origin':'Licensed game-ready recordings and sound design; see CREDITS.md.','credits':'credits.html','sources':[{'archive':n,'url':u,'sha256':s} for n,u,s in SOURCES],'clips':manifest},indent=2)+'\n')
  print(json.dumps(manifest,indent=2));print('TOTAL BYTES',sum(x['bytes'] for x in manifest))
if __name__=='__main__': main()
