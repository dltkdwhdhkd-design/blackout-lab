"""art/higgsfield.json 에 적힌 그림 주소(Higgsfield 결과)를 받아 img/ 에 넣고 assets.js 의 PROVIDED 에 이름을 더한다.
GitHub Actions(fetch-art.yml)가 돌린다. 형식: {"dev_phy": "https://...png", ...}"""
import io, json, re, sys, urllib.request
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
spec = json.loads((root / "art/higgsfield.json").read_text(encoding="utf-8"))
done = []
for name, url in spec.items():
    if not re.fullmatch(r"[a-z0-9_]+", name) or not url.startswith("https://"):
        print("건너뜀", name); continue
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=60).read()
        im = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as e:
        print("실패", name, e); continue
    wall = name.startswith("room_")
    limit = 256 if wall else 640              # 게임 화면은 낮은 해상도라 이 정도면 충분
    im.thumbnail((limit, limit), Image.LANCZOS)
    if wall: im = im.convert("RGB").convert("RGBA")
    out = im.quantize(colors=200, method=Image.Quantize.FASTOCTREE)   # 용량 줄이기(투명 유지)
    out.save(root / "img" / f"{name}.png", optimize=True)
    done.append(name); print("받음", name, im.size)

p = root / "js/assets.js"; s = p.read_text(encoding="utf-8")
m = re.search(r"const PROVIDED = \[(.*?)\];", s, re.S)
have = set(re.findall(r'"([a-z0-9_]+)"', m.group(1)))
add = [n for n in done if n not in have]
if add:
    s = s[:m.end(1)] + ", " + ", ".join(f'"{n}"' for n in add) + s[m.end(1):]
    p.write_text(s, encoding="utf-8")
print("추가된 이름", add)
if not done: sys.exit(1)
