# 그림 교체 안내 (ChatGPT 등으로 뽑아 넣기)

기본 그림은 전부 코드가 즉석에서 그립니다. 아래 이름으로 PNG를 만들어 보내 주면 `img/`에 넣고 `js/assets.js`의 `PROVIDED` 목록에 이름을 추가해 바꿉니다.

**완료 (2026-11-11 반영):**
- 괴물 4장(`monster_0`~`3`), 잡혔을 때 얼굴(`scare`)
- 연구원·쓰러진 연구원·팀원·단말기·발전기 10장, 벽·사물함·출구 문 14장(피 묻은 버전 포함)
- 방 장비 8장, 가구 20장, 셀·구급상자, 방 벽 4장 (34장, ChatGPT). 장비의 셀을 꺼낸 상태(`dev_*_e`)는 셀의 청록 빛을 지워서 자동으로 만들었습니다.

지금은 모든 그림이 교사 제공 그림으로 바뀌어 있습니다. 아래 문구는 다시 뽑을 때 참고용입니다.

## 괴물 (가장 효과 큼)
- 파일: `img/monster_0.png` ~ `img/monster_3.png` (4프레임, 없는 번호는 기본 그림)
- 규격: 세로로 긴 투명 배경 PNG, 가로 1 : 세로 2.25 비율 (예: 400×900). 발바닥이 그림 맨 아래에 닿게.
- 요청 문구 예:
  > 투명 배경, 정면에서 본 전신, 키가 비정상적으로 크고 마른 인간형 괴물. 어두운 회색 피부, 구부정하게 앞으로 숙인 등, 바닥까지 끌리는 긴 팔과 창백한 손가락, 거꾸로 꺾인 다리. 작고 창백한 머리가 한쪽으로 기울어져 있고 눈구멍은 텅 비어 검다. 입은 턱이 빠진 것처럼 아래로 길게 찢어져 있다. 피나 내장 없이 윤곽만으로 무섭게. 90년대 1인칭 게임 스프라이트 느낌, 약간 픽셀화된 질감, 조명은 정면 아래에서 손전등으로 비춘 것처럼. 4장: 서 있음 / 왼발 앞 / 오른발 앞 / 고개를 홱 돌려 정면을 봄.

## 잡혔을 때 얼굴
- 파일: `img/scare.png` (투명 또는 검은 배경, 가로 1 : 세로 1.3 정도)
- 요청 문구: 위 괴물의 얼굴 클로즈업, 화면을 꽉 채우도록, 입을 최대한 벌림, 흑백에 가까운 색, 거친 질감.

## 팀원
- 파일: `img/mate.png` (서 있는 모습, 가로 1 : 세로 2, 손전등을 든 중학생, 후드 집업), `img/mate_down.png` (쓰러진 모습, 가로 1 : 세로 2, 아래쪽에 누워 있음)

## 연구동 소품 (선택)
- `img/console_on.png` / `img/console_off.png`: 실험실 단말기(셀이 꽂혀 있는 상태 / 빠진 상태). 투명 배경, 바닥에 서 있는 기계, 가로 1 : 세로 1.6.
- `img/generator.png` / `img/generator_on.png`: 비상 발전기(정지 / 가동). 투명 배경, 가로 1.4 : 세로 1.
- `img/researcher.png` / `img/researcher_run.png`: 흰 가운 연구원(서 있음 / 겁에 질려 도망). 투명 배경, 가로 1 : 세로 2.
- `img/body.png` / `img/body2.png`: 바닥에 쓰러진 연구원과 핏자국(좌우 반대 두 장). 투명 배경, 가로 1 : 세로 2, 그림 아래쪽에 누워 있게.

## 손과 손전등 (선택)
- 파일: `img/hand_on.png`(손전등 켜짐), `img/hand_off.png`(꺼짐). 투명 배경, 가로 1.3 : 세로 1 (예: 1300×1000). 화면 오른쪽 아래에 맞춰 붙습니다.
- 요청 문구:
  > 1인칭 시점, 오른팔을 앞으로 쭉 뻗어 검은 금속 손전등을 쥔 모습. 소매는 짙은 남색 후드 집업이고 화면 오른쪽 아래 모서리에서 시작해 앞으로 뻗는다. 손전등은 화면 가운데 쪽을 향해 원근으로 작아지고, 헤드 끝이 하얗게 빛난다(꺼짐 버전은 빛 없음). 어두운 지하 연구소, 손전등 빛이 손등에 약하게 반사된 조명. 앞서 만든 그림들과 같은 화풍, 배경은 완전히 투명하게.

## 벽 텍스처 (선택)
- `img/wall.png`(실험실 흰 타일) `img/hall.png`(복도 패널) `img/contain.png`(격리실 콘크리트) `img/power.png`(설비실 금속) `img/locker.png` `img/exit_closed.png` `img/exit_open.png`, 피 묻은 버전은 이름 뒤에 `_blood`
- 규격: 정사각형(128×128 또는 256×256), 이음새 없이 반복되는 타일. 벽 한 칸에 한 장이 세로로 1.6배 늘어나 붙습니다.

## 방 장비·가구
지금은 교사 제공 그림이 들어가 있고, 파일이 없으면 `js/propart.js`가 그린 기본 그림이 나옵니다. 다시 뽑을 때는 아래 이름으로 PNG를 넣으면 `js/assets.js`의 `PROVIDED`에 이름을 추가해 바꿉니다. 모두 **투명 배경, 정면, 물건 아래쪽이 그림 맨 아래에 닿게**.

공통 앞부분(그대로 붙이고 끝에 물건 설명만 바꿈):
> Single game prop sprite for a dark 1990s-style first-person horror game set in an abandoned underground science research facility. Painterly digital art with a slightly rough pixel-grain texture, muted desaturated colors, cold teal-grey and dirty beige tones, lit only from the front by a flashlight so the edges fall into darkness. Straight front view at eye level, the whole object visible and centered, its base touching the bottom edge of the image. Isolated object on a fully transparent background, no floor, no wall, no cast shadow, no text, no labels, no people. The object: ...

**셀이 꽂힌 장비 (세로 3:4)** — 가운데쯤에 푸르게 빛나는 원통형 에너지 셀이 꽂힌 홈이 보이게. 빈 상태는 게임이 어둡게 처리합니다.
| 파일 | 방 | 물건 |
|---|---|---|
| `dev_phy` | 물리 실험실 | 계기판 바늘 두 개와 손잡이가 달린 회색 전원 공급 장치, 위에 구리 코일 |
| `dev_chem` | 화학 분석실 | 유리문 안에 시약병이 줄지어 있는 흰 시약 냉장고, 아래 칸에 셀 홈 |
| `dev_bio` | 생물 배양실 | 둥근 창 안이 초록빛으로 빛나고 페트리 접시가 쌓인 스테인리스 배양기 |
| `dev_heat` | 열 실험실 | 창 안의 열선이 주황빛으로 달아오른 검은 항온 가열 장치 |
| `dev_earth` | 지질 시료실 | 유리 돔 안에 암석 시료, 옆에 파형이 뜬 작은 화면이 달린 베이지 분석기 |
| `dev_server` | 서버실 | LED 막대가 켜진 검은 무정전 전원 장치 |
| `dev_monitor` | 관찰 제어실 | 노란 경고 줄무늬와 번개 표지, 빨간 레버가 달린 비상 전원함 |
| `dev_medical` | 의무실 | 심전도 모니터를 올린 흰 의료 카트, 바퀴와 서랍 |

**가구** — 가로형(3:2): `p_bench`(유리 기구가 놓인 실험대) `p_physbench`(스탠드·용수철·빗면이 놓인 물리 실험대) `p_microscope`(현미경 두 대가 놓인 흰 실험대) `p_hotplate`(가열판과 비커) `p_cctv`(CCTV 모니터 6대가 놓인 관제 책상) `p_bed`(얼룩진 병상) `p_desk`(구형 모니터 사무 책상) `p_meeting`(의자가 딸린 회의 탁자) `p_cafe`(식판이 엎어진 식탁) `p_gate`(보안 게이트) `p_reception`(안내 데스크) `p_sofa`(낡은 소파). 세로형(2:3): `p_hood`(흄 후드) `p_rockshelf`(암석 시료 선반) `p_rack`(서버 랙) `p_medcab`(유리 약품장) `p_bookshelf`(서류 책장) `p_machine`(배관이 달린 기계 설비) `p_shelf`(상자가 쌓인 철제 선반) `p_vending`(깨진 자판기).

**아이템 (1:1)**: `it_cell`(빛나는 에너지 셀 하나), `it_medkit`(흰 구급상자).

**방 벽 (정사각형, 이음새 없이 반복, 불투명)**: `room_monitor`(CCTV 모니터가 격자로 박힌 벽) `room_server`(서버 LED 패널 벽) `room_archive`(서류 책장 벽) `room_medical`(청록 타일 의무실 벽).
