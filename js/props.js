// 방 소품 정의 — 지도 글자 → 그림, 크기(벽 높이 1.6 기준), 시야를 가리는지
// 그림 파일: img/<key>.png 가 있으면 그걸 쓰고, 없으면 assets.js 가 코드로 그린다
window.PROPS = {
  b: { key: "p_bench", name: "실험대", h: 1.0, tall: false },
  p: { key: "p_physbench", name: "역학 실험대", h: 1.05, tall: false },
  u: { key: "p_microscope", name: "현미경대", h: 1.0, tall: false },
  h: { key: "p_hotplate", name: "가열 실험대", h: 1.0, tall: false },
  f: { key: "p_hood", name: "흄후드", h: 1.6, tall: true },
  k: { key: "p_rockshelf", name: "암석 표본장", h: 1.55, tall: true },
  r: { key: "p_rack", name: "서버 랙", h: 1.6, tall: true },
  c: { key: "p_cctv", name: "CCTV 관제석", h: 1.15, tall: false },
  d: { key: "p_bed", name: "병상", h: 0.95, tall: false },
  m: { key: "p_medcab", name: "약품장", h: 1.5, tall: true },
  a: { key: "p_bookshelf", name: "서류 선반", h: 1.55, tall: true },
  o: { key: "p_desk", name: "사무 책상", h: 1.05, tall: false },
  t: { key: "p_meeting", name: "회의 탁자", h: 0.95, tall: false },
  e: { key: "p_cafe", name: "식탁", h: 0.9, tall: false },
  q: { key: "p_reception", name: "안내 데스크", h: 1.0, tall: false },
  x: { key: "p_machine", name: "기계 설비", h: 1.55, tall: true },
  s: { key: "p_shelf", name: "자재 선반", h: 1.55, tall: true },
  g: { key: "p_gate", name: "보안 게이트", h: 1.1, tall: false },
  v: { key: "p_vending", name: "자판기", h: 1.5, tall: true },
  z: { key: "p_sofa", name: "소파", h: 0.8, tall: false },
};
window.PROP_CHARS = Object.keys(PROPS).join("");
window.PROP_TALL = Object.keys(PROPS).filter(k => PROPS[k].tall).join("");
// 방마다 에너지 셀이 꽂힌 장비 그림 (없으면 기본 단말기 그림)
window.DEVICE_KEY = { phy: "dev_phy", chem: "dev_chem", bio: "dev_bio", heat: "dev_heat", earth: "dev_earth", server: "dev_server", monitor: "dev_monitor", medical: "dev_medical" };
window.DEVICE_NAME = { phy: "전원 공급 장치", chem: "시약 냉장고", bio: "배양기", heat: "항온 가열 장치", earth: "암석 시료 분석기", server: "무정전 전원 장치", monitor: "비상 전원함", medical: "의료 장비 카트" };
// 방 벽 그림 (없으면 방 종류별 기본 벽)
window.ROOM_WALL = { monitor: "room_monitor", server: "room_server", archive: "room_archive", medical: "room_medical" };
