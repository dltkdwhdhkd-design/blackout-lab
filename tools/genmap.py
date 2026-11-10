# 지하 격리 연구동 맵 생성기 — 실행하면 js/map.js 의 MAP_ROWS / ROOMS / INTRO 를 다시 쓴다
import json, re
from collections import deque
W, H = 84, 56
g = [['#'] * W for _ in range(H)]
rooms = []
def carve(x0, y0, x1, y1, ch='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = ch
def wall(x0, y0, x1, y1): carve(x0, y0, x1, y1, '#')
def put(x, y, ch): g[y][x] = ch
def room(id, name, x0, y0, x1, y1, units, tex):
    carve(x0, y0, x1, y1); rooms.append(dict(id=id, name=name, x0=x0, y0=y0, x1=x1, y1=y1, units=units, tex=tex))
def door(x, y): put(x, y, '.')

# ---------- 복도 ----------
room('hallW', '서쪽 통로', 1, 1, 2, 54, [], 'hall')
room('hallE', '동쪽 통로', 81, 1, 82, 54, [], 'hall')
room('hallN', '북쪽 복도', 3, 12, 80, 13, [], 'hall')
room('hallM', '중앙 복도', 3, 26, 80, 27, [], 'hall')
room('hallS', '남쪽 복도', 3, 40, 80, 41, [], 'hall')

# ---------- A 띠 (y 1-10): 격리동 ----------
room('contain1', '격리실 A', 4, 1, 13, 10, [], 'contain')
wall(6, 3, 11, 7); carve(7, 4, 10, 6); door(8, 7); put(8, 4, 'M')          # 격리 셀 (문 아래쪽)
room('contain2', '격리실 B', 15, 1, 24, 10, [], 'contain')
wall(17, 3, 22, 7); carve(18, 4, 21, 6); door(22, 5)                        # 빈 셀
room('monitor', '관찰 제어실', 26, 1, 41, 10, ['intro'], 'lab')
wall(28, 4, 39, 4); door(33, 4); wall(28, 7, 39, 7); door(34, 7)            # 모니터 책상 두 줄
room('server', '서버실', 43, 1, 54, 10, ['intro'], 'power')
for x in (45, 48, 51): wall(x, 2, x, 5);
for x in (46, 49, 52): wall(x, 7, x, 9)
room('archive', '기록 보관실', 56, 1, 67, 10, [], 'lab')
for x in (58, 61, 64): wall(x, 2, x, 6)
room('medical', '의무실', 69, 1, 79, 10, ['life'], 'lab')
wall(71, 3, 73, 3); wall(76, 3, 78, 3); wall(71, 7, 73, 7); wall(76, 7, 78, 7)   # 침대
# A 띠 문: 위 통로(서/동) 와 북쪽 복도
door(3, 6); door(80, 6)                      # 서/동 통로 ↔ 격리실A / 의무실
for x in (8, 19, 30, 39, 48, 61, 74): door(x, 11)
door(14, 5); door(25, 6); door(42, 8); door(55, 5); door(68, 8)   # 옆방 연결

# ---------- B 띠 (y 15-24): 실험실 ----------
room('phy', '물리 실험실', 4, 15, 18, 24, ['force'], 'lab')
wall(7, 17, 15, 17); door(11, 17); wall(7, 21, 15, 21); door(10, 21)
room('chem', '화학 분석실', 20, 15, 36, 24, ['state', 'gas'], 'lab')
wall(23, 16, 24, 20); wall(32, 16, 33, 20); wall(26, 22, 30, 22)
room('bio', '생물 배양실', 38, 15, 56, 24, ['life'], 'lab')
for x in (41, 45, 49, 53): wall(x, 16, x, 20)
wall(40, 22, 54, 22); door(47, 22)
room('heat', '열 실험실', 58, 15, 69, 24, ['heat'], 'lab')
wall(60, 17, 62, 17); wall(65, 17, 67, 17); wall(60, 21, 62, 21); wall(65, 21, 67, 21)
room('earth', '지질 시료실', 71, 15, 79, 24, ['earth'], 'lab')
wall(73, 17, 73, 22); wall(77, 17, 77, 22)
door(3, 20); door(80, 19)
for x in (6, 16, 28, 34, 44, 52, 63, 75): door(x, 14)
for x in (9, 24, 40, 50, 66, 73): door(x, 25)
door(19, 19); door(37, 18); door(57, 20); door(70, 22)

# ---------- C 띠 (y 29-38): 중앙 홀·사무 ----------
room('lobby', '중앙 홀', 4, 29, 33, 38, [], 'hall')
for x in (9, 16, 23, 30):
    for y in (31, 36): put(x, y, '#')
wall(13, 33, 20, 33)                           # 안내 데스크
room('meeting', '회의실', 35, 29, 46, 38, [], 'lab')
wall(38, 32, 43, 35)                           # 큰 탁자
room('office', '사무실', 48, 29, 63, 38, [], 'lab')
for x in (51, 55, 59):
    wall(x, 31, x, 32); wall(x, 35, x, 36)
room('lounge', '휴게실', 65, 29, 79, 38, [], 'hall')
wall(68, 31, 69, 32); wall(73, 31, 74, 32); wall(68, 35, 69, 36); wall(73, 35, 74, 36)
door(3, 33); door(80, 33)
for x in (6, 18, 29, 41, 56, 72): door(x, 28)
for x in (12, 26, 38, 60, 70): door(x, 39)
door(34, 34); door(47, 36); door(64, 31)

# ---------- D 띠 (y 43-54): 설비 ----------
room('power', '비상 발전기실', 4, 43, 17, 54, ['intro'], 'power')
wall(7, 46, 13, 46); wall(7, 50, 13, 50); put(5, 53, 'B')
room('mech', '기계·환기실', 19, 43, 30, 54, [], 'power')
wall(21, 45, 23, 47); wall(26, 45, 28, 47); wall(21, 50, 23, 52); wall(26, 50, 28, 52)
room('changing', '탈의실', 32, 43, 41, 54, [], 'hall')
wall(34, 45, 34, 52); wall(38, 45, 38, 52)
room('cafeteria', '구내식당', 43, 43, 60, 54, [], 'lab')
for x in (46, 51, 56):
    for y in (46, 50): wall(x, y, x + 1, y)
room('store', '자재 창고', 62, 43, 70, 54, [], 'power')
wall(64, 45, 64, 48); wall(67, 47, 67, 52)
room('exit', '보안 출구', 72, 43, 79, 54, [], 'hall')
wall(74, 48, 77, 48); door(75, 48)
put(76, 55, 'E')
door(3, 48); door(80, 50)
for x in (10, 24, 36, 51, 66, 76): door(x, 42)
door(18, 52); door(31, 44); door(42, 53); door(61, 47); door(71, 45)

# ---------- 시작 위치: 중앙 홀 ----------
for i, (x, y) in enumerate([(17, 35), (19, 35), (21, 35), (17, 37), (19, 37), (21, 37)]): put(x, y, 'S')

# ---------- 단말기 F ----------
F = [(5, 16), (17, 23),                      # 물리
     (21, 23), (28, 16), (35, 23),           # 화학
     (39, 24), (55, 16),                     # 생물
     (59, 24), (68, 16),                     # 열
     (72, 24), (78, 16),                     # 지질
     (27, 9), (53, 2), (78, 9)]              # 제어실, 서버실, 의무실
for x, y in F:
    assert g[y][x] == '.', (x, y, g[y][x]); put(x, y, 'F')

# ---------- 사물함 L: 방 모서리와 복도 ----------
def try_L(x, y):
    if g[y][x] == '.' and sum(1 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if g[y+dy][x+dx] == '#') >= 1: put(x, y, 'L')
for r in rooms:
    if r['id'].startswith('hall'): continue
    for (x, y) in ((r['x0'], r['y0']), (r['x1'], r['y1'])):
        if (x, y) not in F: try_L(x, y)
for x in range(8, 79, 18): try_L(x, 12); try_L(x + 6, 27); try_L(x + 12, 41)
for y in range(6, 54, 16): try_L(1, y); try_L(82, y + 8)

rows = [''.join(r) for r in g]
assert all(len(r) == W for r in rows)
start = next((x, y) for y in range(H) for x in range(W) if g[y][x] == 'S')
seen = {start}; q = deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x+dx, y+dy
        if 0 <= nx < W and 0 <= ny < H and g[ny][nx] in '.SMFBE' and (nx, ny) not in seen:
            seen.add((nx, ny)); q.append((nx, ny))
must = [(x, y) for y in range(H) for x in range(W) if g[y][x] in 'MFBE']
missing = [p for p in must if p not in seen]
assert not missing, missing
floor_total = sum(r.count('.') + r.count('S') for r in rows)
unreach = floor_total - sum(1 for p in seen if g[p[1]][p[0]] in '.S')
print('\n'.join(rows)); print('fuses', sum(r.count('F') for r in rows), 'lockers', sum(r.count('L') for r in rows), 'unreachable floor', unreach)

# 인트로 연출 좌표: 북쪽 복도에서 격리실 A 문(8,11)을 바라봄
intro = dict(cam=[21.5, 12.8], camA=3.22, door=[8.5, 11.0],
             r1=[9.5, 12.6], r2=[13.5, 13.2], kill1=[9.5, 12.8], kill2=[16.5, 12.8],
             mstart=[15.5, 12.5],
             bodies=[[9.5, 12.8, 'body'], [16.5, 12.8, 'body2'], [30.5, 8.5, 'body2'], [46.5, 33.5, 'body'], [75.5, 46.5, 'body2'], [2.0, 20.5, 'body']])
for bx, by, _ in intro['bodies']: assert g[int(by)][int(bx)] in '.S', (bx, by)

src = open('js/map.js').read()
rows_js = 'window.MAP_ROWS = [\n' + ''.join(f'  "{r}",\n' for r in rows) + '];'
src = re.sub(r'window\.MAP_ROWS = \[.*?\];', rows_js, src, flags=re.S)
rooms_js = 'window.ROOMS = [\n' + ''.join('  ' + json.dumps(r, ensure_ascii=False) + ',\n' for r in rooms) + '];'
src = re.sub(r'window\.ROOMS = \[.*?\];', rooms_js, src, flags=re.S)
intro_js = 'window.INTRO = ' + json.dumps(intro) + ';'
if 'window.INTRO' in src: src = re.sub(r'window\.INTRO = .*?;', intro_js, src)
else: src = src.replace('window.MapUtil', intro_js + '\n\nwindow.MapUtil', 1)
open('js/map.js', 'w').write(src)
