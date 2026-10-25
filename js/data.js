// 화면 · 방 크기, 직업 · 몹 · 던전 · 아이템 수치. 손맛 · 밸런스 조정은 여기 숫자만 고치면 된다.
// 시간은 초, 거리는 게임 화면 픽셀(16 = 바닥 한 칸).
const VIEW_W = 480, VIEW_H = 270, SCALE = 2;  // 게임 화면은 480x270 을 2배로(캔버스 960x540)
const T = 16;
const HUD_H = 44;                              // 아래 체력 구슬 판 높이(게임 화면 픽셀)
const LIGHT_R = 120;                           // 플레이어 빛 반경(이 밖은 어둡다)
const WAKE_R = 130;                            // 몹이 깨어나는 거리(시야가 트였을 때)
const GRAVITY = 900;
const MAX_ATTACKERS = 3;  // 한꺼번에 덤비는 몹 수(2026-10-24 사용자 '너무 쉽다' → 2에서 3)
const BODY_R = 5;
const BAG_SIZE = 48;  // 2026-10-24 사용자: 32 → 48칸 (가로 12 × 세로 4)
const BAG_COLS = 12;

// ── 검사 ──
// 공격: startup(준비) → active(판정) → recovery(후딜). mult = 공격력 배수, reach = 앞쪽 거리 [가까운, 먼],
// arc = 정면에서 좌우로 맞는 각도(도), radius = 둘레 공격, swing = 칼 휘두르는 각도 [시작, 끝](바라보는 쪽 기준).
const CLASSES = {
  swordsman: {
    id: 'swordsman', name: '검사', sprite: 'hero',  // assets/dt/hero.png (0x72 엘프 남자 색 바꿈)
    weapons: ['light', 'heavy'],  // 낄 수 있는 무기 종류
    slotNames: { basic: '기본 공격', charge: '회전베기', wave: '검기', dash: '대시' },
    slotShort: { basic: '기본', charge: '회전', wave: '검기', dash: '대시' },
    icons: { basic: 'slash', charge: 'spin', wave: 'wave', dash: 'dash' },
    baseHp: 100, baseAtk: 4,  // × POWER(레벨) — 레벨 곡선
    speed: 82,
    // 기력(파란 구슬): 대시 · 특수기 · 차지 회전베기에 쓴다. 시간이 지나면 차오르고(쓴 직후 delay 초는 멈춤), 기본 공격을 맞히면 몹마다 onHit 만큼 찬다
    stamina: { base: 100, regen: 9, delay: 0.6, onHit: 4 },
    // 대시: 짧은 무적 이동. 대시 중(또는 끝난 직후 attackWindow 초)에 공격 = 대시 찌르기
    dodge: { time: 0.28, speed: 230, iframes: 0.24, cd: 0, attackWindow: 0.18, cost: 15 },
    potion: { heal: 0.4, cd: 1.0, max: 5 },  // 최대 체력의 40%
    combo: [
      { name: '베기', slot: 'basic', startup: 0.07, active: 0.08, recovery: 0.2, mult: 1.0, knock: 70, stun: 0.32, reach: [0, 24], arc: 70, lunge: 6, swing: [-110, 60] },
      { name: '되베기', slot: 'basic', startup: 0.06, active: 0.09, recovery: 0.22, mult: 1.15, knock: 80, stun: 0.34, reach: [0, 25], arc: 80, lunge: 6, swing: [70, -120] },
      { name: '찌르기', slot: 'basic', fin: true, startup: 0.12, active: 0.1, recovery: 0.36, mult: 1.8, knock: 200, stun: 0.55, reach: [0, 32], arc: 26, lunge: 16, thrust: true, heavy: true },
    ],
    // 특수기 = 섬광 검기: 휘두르면 앞으로 날아가며 꿰뚫는 검기(봉인의 숲 검의 특수와 같은 결, 쿨타임 5초)
    special: { id: 'wave', name: '섬광 검기', short: '검기', slot: 'wave', cd: 0.6, cost: 24,  // 기력 30 → 24(2026-10-25 사용자 '좀만 줄여')
      startup: 0.1, active: 0.06, recovery: 0.3, mult: 1.6, knock: 90, stun: 0.45, reach: [0, 22], arc: 60, swing: [-80, 80],
      wave: { speed: 260, range: 150, r: 12, scale: 1.35 } },  // 검기 크기(2026-10-24 사용자: 좀 더 크게) — 판정 9 → 12, 그림 1.35배
    // 대시 찌르기: 대시 → 공격. 앞으로 파고들며 꿰뚫는다(무적)
    // 대시 찌르기: 앞으로 무기 길이만큼만 찌른다(2026-10-24 사용자 '너무 잘 맞는다' → 반원 90° · 뒤 8px · 몸에 닿기만 해도 맞던 것 없앰)
    dashAttack: { name: '대시 찌르기', slot: 'dash', startup: 0.03, active: 0.16, recovery: 0.26, mult: 1.9, knock: 110, stun: 0.55, reach: [0, 30], arc: 28, noBody: true, dash: 64, iframes: true, thrust: true, heavy: true },
    // 회전베기(속성석 '차지' 칸): 따로 있는 버튼(키보드 V · 패드 B)을 누르면 바로 나간다(2026-10-24 사용자: 길게 눌러 모으기 없앰).
    // 콤보 · 특수기 후딜에서도 끊고 나갈 수 있다. move 는 예전 모으기용(안 씀)
    charge: { holdDelay: 0.22, time: 0.55, move: 0.45, cost: 20,
      def: { name: '회전베기', slot: 'charge', fin: true, startup: 0.05, active: 0.22, recovery: 0.32, mult: 2.4, knock: 160, stun: 0.6, radius: 44, spin: true, heavy: true, outward: true } },  // 범위 34 → 44(+30%, 2026-10-24 사용자)
  },
  // ── 마법사(2026-10-24 사용자: 두 번째 캐릭터) ── 봉인의 숲 지팡이(정령의 마법봉) 기술을 옮김. 능력치는 검사와 같고 공격력 = 주문력.
  // 기본 = 롯드 · 스태프 2연타(끝의 빛 구슬이 휩쓴다, 사거리 넓음) · 특수(Z) = 마력탄(가볍게 따라가는 빛 구슬, 처음 닿은 적에서 터짐, 기력으로 연사)
  // 차지 칸(V) = 마법진(겨눈 적 발밑 · 없으면 앞에 깔리고 0.5초 뒤 한 번 크게 터짐) · 대시 → 공격 = 마력 파동(둘레 밀쳐내기)
  mage: {
    id: 'mage', name: '마법사', sprite: 'wizzard_m', atkName: '주문력',
    weapons: ['wand', 'staff'],
    slotNames: { basic: '기본 공격', charge: '마법진', wave: '마력탄', dash: '대시' },
    slotShort: { basic: '기본', charge: '마법진', wave: '마력탄', dash: '대시' },
    icons: { basic: 'spark', charge: 'circle', wave: 'orb', dash: 'dash' },
    baseHp: 100, baseAtk: 4, speed: 82,
    // 기술로 싸우는 직업이라 기력이 넉넉하다(2026-10-24 사용자: 기력이 모자라다) — 최대 100 → 140, 회복 9 → 12
    stamina: { base: 140, regen: 12, delay: 0.6, onHit: 4 },
    dodge: { time: 0.28, speed: 230, iframes: 0.24, cd: 0, attackWindow: 0.18, cost: 15 },
    potion: { heal: 0.4, cd: 1.0, max: 5 },
    combo: [
      { name: '마력 휘두르기', slot: 'basic', startup: 0.07, active: 0.1, recovery: 0.22, mult: 0.9, knock: 120, stun: 0.3, reach: [0, 30], arc: 110, lunge: 5, swing: [-100, 70], orbTip: true },
      { name: '마력 내려치기', slot: 'basic', fin: true, startup: 0.08, active: 0.12, recovery: 0.34, mult: 1.4, knock: 220, stun: 0.5, reach: [0, 33], arc: 130, lunge: 6, swing: [80, -110], heavy: true, orbTip: true },
    ],
    special: { id: 'orb', name: '마력탄', short: '마력탄', slot: 'wave', cd: 0.15, cost: 3, startup: 0.06, active: 0.04, recovery: 0.16, mult: 1.6, knock: 60, stun: 0.3, thrust: true,
      orb: { speed: 240, range: 150, r: 6 } },
    dashAttack: { name: '마력 파동', slot: 'dash', startup: 0.04, active: 0.12, recovery: 0.3, mult: 1.1, knock: 300, stun: 0.55, radius: 40, pulse: true, iframes: true, heavy: true, thrust: true },
    charge: { holdDelay: 0.22, time: 0.55, move: 0.45, cost: 15,
      def: { name: '마법진', slot: 'charge', fin: true, startup: 0.12, active: 0.05, recovery: 0.3, mult: 3.4, knock: 220, stun: 0.7, thrust: true, heavy: true,
        circle: { range: 120, ahead: 56, r: 42, delay: 0.5 } } },
  },
};
const clsOf = prof => CLASSES[(prof && prof.cls) || 'swordsman'];
// 능력치 이름: 마법사는 공격력을 주문력으로 부른다
const statName = (k, prof) => (k === 'atk' && clsOf(prof).atkName) || STATS[k].name;

// 무기 종류(2026-10-24 사용자: 경량 · 중량 둘로만, 공격 속도 2원화): 속도(동작 빠르기 배수) · 사거리 더하기 · 피해 배수 · 밀어내기 배수 · 각도 배수
// 중량 무기는 기본 공격력이 경량의 약 1.3배라 초당 피해는 비슷하고, 한 방 · 밀어내기가 세다
const WEAPON_KINDS = {
  none: { name: '맨손', speed: 1.1, reach: -8, dmg: 0.8, knock: 0.6, arc: 0.8 },
  light: { name: '경량', speed: 1.15, reach: 0, dmg: 1, knock: 0.9, arc: 1 },
  heavy: { name: '중량', speed: 0.88, reach: 0, dmg: 1, knock: 1.4, arc: 1.1 },
  wand: { name: '경량', speed: 1.15, reach: 0, dmg: 1, knock: 0.9, arc: 1 },   // 마법사 롯드
  staff: { name: '중량', speed: 0.88, reach: 0, dmg: 1, knock: 1.4, arc: 1.1 },  // 마법사 스태프
};

// ── 몹 ── atk.lunge = 공격하며 튀어나가는 속도, ranged = 멀리서 쏨(shot: 탄 속도 · 피해)
// poise = 연달아 이만큼 경직되면 버티고 반격, superArmor = 공격 준비 중 약한 공격에 안 끊김
const ENEMIES = {
  skelet: { name: '해골', sprite: 'skelet', idle: true, hp: 30, speed: 44, range: 18, poise: 4, exp: 6, gold: [2, 5],
    atk: { windup: 0.5, active: 0.1, recovery: 0.6, dmg: 8, knock: 110, reach: [0, 18], arc: 70, lunge: 120 } },
  tiny_zombie: { name: '꼬마 좀비', sprite: 'tiny_zombie', idle: true, hp: 24, speed: 32, range: 16, poise: 4, exp: 4, gold: [1, 4],
    atk: { windup: 0.6, active: 0.1, recovery: 0.6, dmg: 7, knock: 90, reach: [0, 16], arc: 70, lunge: 110 } },
  goblin: { name: '고블린', sprite: 'goblin', idle: true, hp: 18, speed: 70, range: 16, poise: 3, exp: 5, gold: [3, 7],
    atk: { windup: 0.35, active: 0.08, recovery: 0.5, dmg: 5, knock: 80, reach: [0, 16], arc: 70, lunge: 150 } },
  zombie: { name: '좀비', sprite: 'zombie', idle: false, hp: 42, speed: 28, range: 17, poise: 5, exp: 8, gold: [2, 6],
    atk: { windup: 0.7, active: 0.12, recovery: 0.7, dmg: 11, knock: 130, reach: [0, 18], arc: 70, lunge: 100 } },
  orc_warrior: { name: '오크 전사', sprite: 'orc_warrior', idle: true, hp: 55, speed: 46, range: 18, poise: 4, exp: 12, gold: [4, 9],
    atk: { windup: 0.55, active: 0.1, recovery: 0.6, dmg: 12, knock: 130, reach: [0, 20], arc: 70, lunge: 130 } },
  masked_orc: { name: '가면 오크', sprite: 'masked_orc', idle: true, hp: 75, speed: 38, range: 19, poise: 5, superArmor: true, exp: 16, gold: [5, 11],
    atk: { windup: 0.8, active: 0.12, recovery: 0.8, dmg: 17, knock: 170, reach: [0, 22], arc: 75, lunge: 120 } },
  orc_shaman: { name: '오크 주술사', sprite: 'orc_shaman', idle: true, hp: 34, speed: 36, range: 80, poise: 3, exp: 12, gold: [5, 10],
    ranged: true, atk: { windup: 0.7, active: 0.05, recovery: 0.9, dmg: 10, knock: 90, shot: 110, color: '#7dff6a' } },
  chort: { name: '초르트', sprite: 'chort', idle: true, hp: 40, speed: 60, range: 17, poise: 4, exp: 11, gold: [4, 9],
    atk: { windup: 0.4, active: 0.08, recovery: 0.55, dmg: 10, knock: 110, reach: [0, 18], arc: 70, lunge: 150 } },
  imp: { name: '임프', sprite: 'imp', idle: true, hp: 22, speed: 64, range: 70, poise: 3, exp: 8, gold: [3, 8],
    ranged: true, atk: { windup: 0.5, active: 0.05, recovery: 0.8, dmg: 8, knock: 80, shot: 130, color: '#ff8a3a' } },
  // 늪
  muddy: { name: '진흙 덩이', sprite: 'muddy', idle: false, hp: 34, speed: 30, range: 16, poise: 4, exp: 7, gold: [2, 6],
    atk: { windup: 0.6, active: 0.1, recovery: 0.6, dmg: 9, knock: 110, reach: [0, 17], arc: 70, lunge: 110 } },
  swampy: { name: '늪 덩이', sprite: 'swampy', idle: false, hp: 28, speed: 32, range: 72, poise: 3, exp: 8, gold: [2, 7],
    ranged: true, atk: { windup: 0.65, active: 0.05, recovery: 0.9, dmg: 8, knock: 80, shot: 105, color: '#8adf5a' } },
  slug: { name: '거대 민달팽이', sprite: 'slug', idle: false, hp: 55, speed: 22, range: 17, poise: 6, exp: 10, gold: [3, 8],
    atk: { windup: 0.75, active: 0.12, recovery: 0.8, dmg: 13, knock: 140, reach: [0, 19], arc: 75, lunge: 90 } },
  tiny_slug: { name: '새끼 민달팽이', sprite: 'tiny_slug', idle: false, hp: 14, speed: 62, range: 15, poise: 2, exp: 3, gold: [1, 3],
    atk: { windup: 0.35, active: 0.08, recovery: 0.5, dmg: 5, knock: 70, reach: [0, 15], arc: 70, lunge: 150 } },
  // 묘지 · 얼음 동굴
  necromancer: { name: '네크로맨서', sprite: 'necromancer', idle: false, hp: 36, speed: 34, range: 82, poise: 3, exp: 14, gold: [5, 11],
    ranged: true, atk: { windup: 0.7, active: 0.05, recovery: 0.9, dmg: 11, knock: 90, shot: 115, color: '#b07aff' } },
  wogol: { name: '워골', sprite: 'wogol', idle: true, hp: 46, speed: 52, range: 18, poise: 4, exp: 11, gold: [4, 9],
    atk: { windup: 0.45, active: 0.1, recovery: 0.55, dmg: 11, knock: 120, reach: [0, 19], arc: 70, lunge: 140 } },
  ice_zombie: { name: '얼음 좀비', sprite: 'ice_zombie', idle: false, hp: 60, speed: 30, range: 18, poise: 5, exp: 12, gold: [4, 9], chillHit: true,
    atk: { windup: 0.7, active: 0.12, recovery: 0.75, dmg: 13, knock: 130, reach: [0, 19], arc: 70, lunge: 100 } },
  // 역병 하수도 · 타락한 기사단 · 비늘 신전 · 심연 (2026-10-24 던전 4개 추가 — 0x72 의 남은 몸들: 호박 · 의사 · 기사 · 드워프 · 엘프 · 마법사 · 도마뱀 · 천사)
  pumpkin_dude: { name: '호박 머리', sprite: 'pumpkin_dude', idle: true, hp: 48, speed: 58, range: 17, poise: 4, exp: 14, gold: [5, 11],
    atk: { windup: 0.45, active: 0.1, recovery: 0.55, dmg: 12, knock: 120, reach: [0, 18], arc: 70, lunge: 150 } },
  // 몸: 0x72 의사(doc)가 짱구 같고(2026-10-25 사용자), 마녀(wizzard_f)는 우리 마법사와 같은 모습 → 두건 쓴 네크로맨서 몸에 병든 초록 → 역병 사제
  doc: { name: '역병 사제', sprite: 'necromancer', tint: '#6ad040', tintAlpha: 0.45, idle: false, hp: 40, speed: 38, range: 84, poise: 3, exp: 15, gold: [6, 12],
    ranged: true, atk: { windup: 0.6, active: 0.05, recovery: 0.85, dmg: 12, knock: 90, shot: 120, color: '#c8e05a' } },
  knight_f: { name: '타락한 기사', sprite: 'knight_f', idle: true, hp: 85, speed: 42, range: 20, poise: 6, superArmor: true, exp: 20, gold: [7, 14],
    atk: { windup: 0.7, active: 0.12, recovery: 0.7, dmg: 18, knock: 170, reach: [0, 22], arc: 80, lunge: 130 } },
  dwarf_m: { name: '광전사 드워프', sprite: 'dwarf_m', idle: true, hp: 70, speed: 50, range: 18, poise: 5, exp: 17, gold: [6, 13],
    atk: { windup: 0.4, active: 0.1, recovery: 0.5, dmg: 15, knock: 140, reach: [0, 19], arc: 75, lunge: 160 } },
  elf_f: { name: '그림자 궁수', sprite: 'elf_f', idle: true, hp: 42, speed: 56, range: 96, poise: 3, exp: 16, gold: [6, 13],
    ranged: true, atk: { windup: 0.55, active: 0.05, recovery: 0.75, dmg: 13, knock: 90, shot: 150, color: '#d8e0ff' } },
  // 몸: 예전엔 우리 마법사와 같은 wizzard_m 이라 헷갈림(2026-10-25 사용자) → 두건 쓴 네크로맨서 몸에 핏빛을 입힘, 탄도 핏빛
  wizzard_m: { name: '흑마법사', sprite: 'necromancer', tint: '#c03050', tintAlpha: 0.45, idle: false, hp: 45, speed: 36, range: 90, poise: 3, exp: 18, gold: [7, 14],
    ranged: true, atk: { windup: 0.75, active: 0.05, recovery: 0.9, dmg: 16, knock: 100, shot: 115, color: '#ff4a6a' } },
  lizard_m: { name: '도마뱀 전사', sprite: 'lizard_m', idle: true, hp: 80, speed: 54, range: 19, poise: 5, exp: 19, gold: [7, 14],
    atk: { windup: 0.45, active: 0.1, recovery: 0.55, dmg: 17, knock: 150, reach: [0, 20], arc: 75, lunge: 165 } },
  lizard_f: { name: '도마뱀 주술사', sprite: 'lizard_f', idle: true, hp: 50, speed: 44, range: 86, poise: 3, exp: 18, gold: [7, 14],
    ranged: true, atk: { windup: 0.6, active: 0.05, recovery: 0.85, dmg: 15, knock: 90, shot: 125, color: '#5ae0b0' } },
  angel: { name: '타락 천사', sprite: 'angel', idle: true, hp: 55, speed: 66, range: 90, poise: 3, exp: 22, gold: [8, 16],
    ranged: true, atk: { windup: 0.5, active: 0.05, recovery: 0.7, dmg: 17, knock: 100, shot: 160, color: '#fff0a0' } },
  // 보스(같은 몸에 색을 입혀 던전마다 다르게: tint)
  big_zombie: { name: '썩은 거인', sprite: 'big_zombie', idle: true, boss: true, hp: 420, speed: 30, range: 22, superArmor: true, launchMul: 0.25, exp: 120, gold: [60, 100], r: 11,
    atk: { windup: 0.7, active: 0.12, recovery: 0.8, dmg: 14, knock: 160, reach: [0, 26], arc: 80, lunge: 140 },
    slam: { windup: 0.9, radius: 40, dmg: 18 }, charge: { windup: 0.7, speed: 210, time: 0.65, dmg: 14 }, summon: 'tiny_zombie' },
  ogre_swamp: { name: '늪의 오우거', sprite: 'ogre', idle: true, boss: true, tint: '#4a9a3a', hp: 450, speed: 32, range: 22, superArmor: true, launchMul: 0.25, exp: 180, gold: [80, 130], r: 11,
    atk: { windup: 0.65, active: 0.12, recovery: 0.8, dmg: 15, knock: 160, reach: [0, 26], arc: 80, lunge: 140 },
    slam: { windup: 0.9, radius: 42, dmg: 19 }, charge: { windup: 0.7, speed: 215, time: 0.65, dmg: 15 }, fan: { windup: 0.75, count: 5, dmg: 10, speed: 100, color: '#8adf5a' }, summon: 'tiny_slug' },
  zombie_lord: { name: '묘지 군주', sprite: 'big_zombie', idle: true, boss: true, tint: '#7a4ab0', hp: 520, speed: 32, range: 22, superArmor: true, launchMul: 0.2, exp: 260, gold: [110, 170], r: 11,
    atk: { windup: 0.6, active: 0.12, recovery: 0.75, dmg: 16, knock: 165, reach: [0, 26], arc: 80, lunge: 145 },
    slam: { windup: 0.85, radius: 44, dmg: 20 }, charge: { windup: 0.65, speed: 225, time: 0.6, dmg: 16 }, fan: { windup: 0.7, count: 7, dmg: 11, speed: 110, color: '#b07aff' }, summon: 'skelet' },
  ogre_frost: { name: '서리 오우거', sprite: 'ogre', idle: true, boss: true, tint: '#6ab8ff', hp: 560, speed: 34, range: 22, superArmor: true, launchMul: 0.2, exp: 340, gold: [140, 210], r: 11, chillHit: true,
    atk: { windup: 0.6, active: 0.12, recovery: 0.7, dmg: 17, knock: 170, reach: [0, 26], arc: 80, lunge: 150 },
    slam: { windup: 0.85, radius: 46, dmg: 21 }, charge: { windup: 0.6, speed: 235, time: 0.6, dmg: 17 }, fan: { windup: 0.7, count: 7, dmg: 12, speed: 115, color: '#9fe0ff' }, summon: 'ice_zombie' },
  ogre_blood: { name: '피의 대족장', sprite: 'ogre', idle: true, boss: true, tint: '#c03a2a', hp: 620, speed: 38, range: 22, superArmor: true, launchMul: 0.2, exp: 420, gold: [170, 250], r: 11,
    atk: { windup: 0.55, active: 0.12, recovery: 0.65, dmg: 18, knock: 175, reach: [0, 27], arc: 85, lunge: 160 },
    slam: { windup: 0.8, radius: 46, dmg: 22 }, charge: { windup: 0.55, speed: 250, time: 0.6, dmg: 18 }, summon: 'orc_warrior' },
  big_demon: { name: '불꽃 악마', sprite: 'big_demon', idle: true, boss: true, hp: 700, speed: 36, range: 22, superArmor: true, launchMul: 0.2, exp: 520, gold: [220, 320], r: 11,
    atk: { windup: 0.6, active: 0.12, recovery: 0.7, dmg: 20, knock: 170, reach: [0, 26], arc: 80, lunge: 150 },
    slam: { windup: 0.85, radius: 44, dmg: 24 }, charge: { windup: 0.6, speed: 240, time: 0.6, dmg: 19 }, fan: { windup: 0.7, count: 7, dmg: 13, speed: 120, color: '#ff6a2a' }, summon: 'imp' },
  plague_giant: { name: '역병 거인', sprite: 'big_zombie', idle: true, boss: true, tint: '#a8c040', hp: 780, speed: 34, range: 22, superArmor: true, launchMul: 0.2, exp: 620, gold: [260, 380], r: 11,
    atk: { windup: 0.55, active: 0.12, recovery: 0.65, dmg: 21, knock: 175, reach: [0, 27], arc: 85, lunge: 155 },
    slam: { windup: 0.8, radius: 46, dmg: 25 }, charge: { windup: 0.55, speed: 245, time: 0.6, dmg: 20 }, fan: { windup: 0.65, count: 9, dmg: 14, speed: 120, color: '#c8e05a' }, summon: 'pumpkin_dude' },
  iron_ogre: { name: '검은 기사단장', sprite: 'ogre', idle: true, boss: true, tint: '#5a6488', hp: 860, speed: 40, range: 22, superArmor: true, launchMul: 0.15, exp: 720, gold: [300, 430], r: 11,
    atk: { windup: 0.5, active: 0.12, recovery: 0.6, dmg: 22, knock: 180, reach: [0, 28], arc: 85, lunge: 165 },
    slam: { windup: 0.75, radius: 48, dmg: 26 }, charge: { windup: 0.5, speed: 260, time: 0.6, dmg: 21 }, summon: 'knight_f' },
  scale_lord: { name: '비늘 군주', sprite: 'big_demon', idle: true, boss: true, tint: '#40b090', hp: 950, speed: 38, range: 22, superArmor: true, launchMul: 0.15, exp: 830, gold: [340, 480], r: 11,
    atk: { windup: 0.55, active: 0.12, recovery: 0.65, dmg: 23, knock: 175, reach: [0, 27], arc: 85, lunge: 160 },
    slam: { windup: 0.8, radius: 48, dmg: 27 }, charge: { windup: 0.55, speed: 250, time: 0.6, dmg: 22 }, fan: { windup: 0.65, count: 9, dmg: 15, speed: 125, color: '#5ae0b0' }, summon: 'lizard_m' },
  abyss_lord: { name: '심연의 군주', sprite: 'big_demon', idle: true, boss: true, tint: '#8a4ad8', hp: 1100, speed: 40, range: 22, superArmor: true, launchMul: 0.1, exp: 1000, gold: [400, 600], r: 12,
    atk: { windup: 0.5, active: 0.12, recovery: 0.6, dmg: 25, knock: 185, reach: [0, 28], arc: 90, lunge: 170 },
    slam: { windup: 0.75, radius: 50, dmg: 29 }, charge: { windup: 0.5, speed: 265, time: 0.6, dmg: 24 }, fan: { windup: 0.6, count: 11, dmg: 16, speed: 130, color: '#c06aff' }, summon: 'angel' },
};

// ── 던전 컨셉 몬스터(2026-10-24): 기존 몸에 색을 입힌 새 몬스터 ──
Object.assign(ENEMIES, {
  skel_archer: { name: '해골 궁수', sprite: 'skelet', idle: true, tint: '#d8c8a0', speed: 40, range: 86, poise: 3, ranged: true,
    atk: { windup: 0.6, active: 0.05, recovery: 0.85, knock: 80, shot: 140, color: '#e8e0c8' } },
  wraith: { name: '망령', sprite: 'tiny_zombie', idle: true, tint: '#c8d8ff', speed: 72, range: 16, poise: 2,
    atk: { windup: 0.3, active: 0.08, recovery: 0.45, knock: 70, reach: [0, 16], arc: 70, lunge: 170 } },
  frost_skel: { name: '서리 해골', sprite: 'skelet', idle: true, tint: '#7fc8ff', speed: 46, range: 18, poise: 4, chillHit: true,
    atk: { windup: 0.5, active: 0.1, recovery: 0.6, knock: 110, reach: [0, 18], arc: 70, lunge: 120 } },
  yeti: { name: '설인', sprite: 'wogol', idle: true, tint: '#e8f4ff', speed: 40, range: 19, poise: 6, superArmor: true, chillHit: true,
    atk: { windup: 0.75, active: 0.12, recovery: 0.75, knock: 170, reach: [0, 21], arc: 80, lunge: 110 } },
  ice_imp: { name: '얼음 임프', sprite: 'imp', idle: true, tint: '#7fd8ff', speed: 60, range: 80, poise: 3, ranged: true, chillHit: true,
    atk: { windup: 0.55, active: 0.05, recovery: 0.8, knock: 80, shot: 125, color: '#bfefff' } },
  lava_blob: { name: '용암 덩이', sprite: 'muddy', idle: false, tint: '#ff5a1a', speed: 34, range: 16, poise: 4, deathBlast: true,
    atk: { windup: 0.6, active: 0.1, recovery: 0.6, knock: 110, reach: [0, 17], arc: 70, lunge: 110 } },
  fire_skel: { name: '불꽃 해골', sprite: 'skelet', idle: true, tint: '#ff7a3a', speed: 54, range: 18, poise: 4,
    atk: { windup: 0.4, active: 0.1, recovery: 0.5, knock: 120, reach: [0, 18], arc: 70, lunge: 150 } },
  temple_guard: { name: '신전 수호자', sprite: 'masked_orc', idle: true, tint: '#40b0a0', speed: 36, range: 20, poise: 6, superArmor: true,
    atk: { windup: 0.8, active: 0.12, recovery: 0.8, knock: 180, reach: [0, 22], arc: 80, lunge: 120 } },
  abyss_chort: { name: '심연 초르트', sprite: 'chort', idle: true, tint: '#a060e0', speed: 66, range: 17, poise: 4,
    atk: { windup: 0.35, active: 0.08, recovery: 0.5, knock: 110, reach: [0, 18], arc: 70, lunge: 165 } },
  void_imp: { name: '공허 임프', sprite: 'imp', idle: true, tint: '#b080ff', speed: 62, range: 86, poise: 3, ranged: true,
    atk: { windup: 0.5, active: 0.05, recovery: 0.75, knock: 90, shot: 145, color: '#c06aff' } },
});

// ── 몬스터 역할(2026-10-24 사용자: 능력치는 권장 레벨에 맞게) ──
// 체력 · 공격력 · 경험치 · 골드는 몬스터 종류가 아니라 역할로 정하고, 던전 권장 레벨 배율(ENEMY_SCALE)을 곱한다.
// → 어떤 몬스터를 어느 던전에 옮겨 놓아도 그 던전 레벨에 맞는 세기. 생김새 · 속도 · 사거리 · 공격 모양은 몬스터마다 그대로.
const ROLES = {
  grunt: { name: '졸개', hp: 32, dmg: 9, exp: 10, gold: [3, 7] },
  fast: { name: '날쌘', hp: 22, dmg: 7, exp: 8, gold: [2, 6] },
  tank: { name: '단단한', hp: 70, dmg: 15, exp: 16, gold: [5, 10] },
  ranged: { name: '원거리', hp: 28, dmg: 10, exp: 11, gold: [3, 8] },
  caster: { name: '마법', hp: 36, dmg: 12, exp: 13, gold: [4, 9] },
};
const ENEMY_ROLE = {
  skelet: 'grunt', tiny_zombie: 'fast', goblin: 'fast', zombie: 'tank', orc_warrior: 'grunt', masked_orc: 'tank', orc_shaman: 'caster',
  chort: 'fast', imp: 'ranged', muddy: 'grunt', swampy: 'ranged', slug: 'tank', tiny_slug: 'fast', necromancer: 'caster', wogol: 'grunt',
  ice_zombie: 'tank', pumpkin_dude: 'fast', doc: 'caster', knight_f: 'tank', dwarf_m: 'grunt', elf_f: 'ranged', wizzard_m: 'caster',
  lizard_m: 'grunt', lizard_f: 'caster', angel: 'ranged',
  skel_archer: 'ranged', wraith: 'fast', frost_skel: 'grunt', yeti: 'tank', ice_imp: 'ranged', lava_blob: 'grunt', fire_skel: 'fast',
  temple_guard: 'tank', abyss_chort: 'fast', void_imp: 'ranged',
};
for (const k in ENEMY_ROLE) {
  const d = ENEMIES[k], r = ROLES[ENEMY_ROLE[k]];
  d.role = ENEMY_ROLE[k]; d.hp = r.hp; d.atk.dmg = r.dmg; d.exp = r.exp; d.gold = r.gold;
}
// 보스도 같은 바탕 + 던전 레벨 곡선(예전엔 보스마다 체력 · 공격력이 따로였다)
for (const k in ENEMIES) {
  const d = ENEMIES[k];
  if (!d.boss) continue;
  d.hp = 450; d.atk.dmg = 15; d.exp = 150; d.gold = [60, 100];
  if (d.slam) d.slam.dmg = 19;
  if (d.charge) d.charge.dmg = 15;
  if (d.fan) d.fan.dmg = 10;
}

// ── 함정(던전 컨셉): 웅덩이 = 위에 있는 동안(0.5초마다 최대 체력의 dot) · 느려짐 / 가시 = 주기적으로 솟아 한 번 찌름(최대 체력의 dmg) ──
// 대시 무적 중에는 안 다친다(뛰어넘기). 몬스터는 안 다친다.
const HAZARDS = {
  poison: { name: '독 웅덩이', color: '#7dcf3a', pool: true, slow: true, dot: 0.025 },
  water: { name: '물웅덩이', color: '#4a8ad8', pool: true, slow: true },
  lava: { name: '용암', color: '#ff5a1a', pool: true, dot: 0.045 },
  void: { name: '공허 웅덩이', color: '#8a3ad8', pool: true, dot: 0.04 },
  spikes: { name: '가시 함정', spike: true, dmg: 0.12 },
  icespike: { name: '얼음 가시', spike: true, dmg: 0.1, chill: true, tint: '#7fd8ff' },
};
const SPIKE_CYCLE = 2.4, SPIKE_UP = 0.7, SPIKE_WARN = 0.35;  // 가시: 주기 · 솟아 있는 시간 · 솟기 전 예고

// ── 정예 · 고유 몹(디아블로식) ──
// 정예 무리: 같은 몹 3~5마리, 파란 이름, 특수 능력 하나를 함께 가진다. 고유 몹: 금색 이름 우두머리 + 졸개, 특수 능력 둘.
// ── 세기 곡선(2026-10-24 사용자: 던전 10레벨 간격, 수십 배 어려워지게) ──
// 레벨마다 6% 곱으로 세진다: Lv.10 ×1.7 · 20 ×3 · 30 ×5.4 · 40 ×9.7 · 50 ×17 · 60 ×31 · 90 ×178.
// 몬스터(체력 · 공격력) · 장비 능력치 · 캐릭터 기본 능력치 · 경험치 · 골드가 모두 이 곡선을 따른다 → 그 레벨 장비를 갖추면 맞설 수 있다
const POWER = lv => Math.pow(1.06, Math.max(0, lv - 1));
// 몹: 체력 = 역할 체력 × hp × POWER(던전 레벨), 공격력 = 역할 공격력 × dmg × POWER. 방어 = 무기 피해를 ENEMY_CUT 만큼 깎는다(속성 지속 피해는 무시)
const ENEMY_SCALE = { hp: 4, dmg: 3, bossDef: 1.3 };  // 2026-10-24 사용자 '한참 더 어렵게' → 체력 1.5→4 · 공격력 1.35→3
// 몹만 더 세지는 곡선(2026-10-24 사용자: Lv.49 던전이 5배는 더 어렵게, 초반은 완만하게):
// 체력 × RAMP, 공격력 × RAMP^0.6. Lv.10 ×1.35 · 20 ×1.95 · 30 ×2.7 · 40 ×3.7 · 49 ×5 · 60 ×7.2 · 90 ×20(공격력은 49에서 ×2.6)
const ENEMY_RAMP = lv => Math.pow(5, (Math.max(1, lv) - 1) / 48);
const RAMP_DMG = 0.6;
// 초반 몹 약하게(2026-10-24 사용자: "맨 처음 만들었을 때 느낌으로") — Lv.30 까지. 처음 만든 때의 몹(체력 · 공격 ×1, 몹 방어 없음, 한꺼번에 2마리)에 가깝게 시작해서
// 천천히(1.5 제곱) 지금 세기로 올라간다. t = 0(Lv.1) → 1(Lv.30). 체력 ×0.27 · 공격 ×0.33 · 몹 방어 0 에서 시작
const earlyT = lv => (lv >= 30 ? 1 : Math.pow((Math.max(1, lv) - 1) / 29, 1.5));
const EARLY_EASE = lv => 0.27 + 0.73 * earlyT(lv);      // 체력
const EARLY_EASE_DMG = lv => 0.33 + 0.67 * earlyT(lv);  // 공격력
const maxAttackers = lv => (lv < 20 ? 2 : MAX_ATTACKERS);  // 초반은 한꺼번에 2마리
const ENEMY_CUT = lv => Math.min(0.5, 0.07 + 0.0045 * (lv - 1));
const ELITE = { hp: 1.7, dmg: 1.25, def: 1.3, chance: 0.25 };
const UNIQUE = { hp: 4, dmg: 1.5, def: 1.5, scale: 1.3, chance: 0.12, max: 2 };
const AFFIXES = {
  fast: { name: '빠른' },          // 이동 1.5배 · 공격 준비 0.7배
  tough: { name: '단단한' },       // 체력 1.5배 · 경직에 잘 안 갇힘
  fire: { name: '화염 강화' },     // 죽으면 잠시 뒤 불꽃 폭발(피해야 함)
  frost: { name: '냉기 강화' },    // 맞으면 2초 동안 느려짐
};
const UNIQUE_NAMES = ['썩은손 그롬', '뼈칼 모르가', '울음의 사제', '검은 이빨', '피눈 바락', '무덤지기 오스', '녹슨 망령', '굶주린 카즈'];
const NAME_COLOR = { elite: '#7fa8ff', unique: '#e8c060', boss: '#ff7a5a' };

// ── 던전 ── lv = 권장 레벨(몹 강해짐), ilvl = 떨어지는 장비 단계, rooms = 한 층의 방 수(보스방 포함), needs = 먼저 깨야 하는 던전
// tint = 던전 그림에 곱해 입히는 색(같은 0x72 벽돌을 던전마다 다른 분위기로), wall = 벽 앞면에 가끔 넣는 꾸밈
// 던파식 컨셉 던전(2026-10-24 사용자): 던전마다 풍경 · 함정 · 그곳 몬스터. lv = 권장 · 입장 레벨(10레벨 간격, 레벨이 모자라면 못 들어감),
// ilvl = 떨어지는 장비 레벨 범위 — 권장 레벨 ~ +4(착용 레벨은 권장 레벨과 같은 10 단위). cols = 넓은 방에 기둥 넣을 확률, skulls = 바닥 해골 배수,
// crates = 방마다 상자(관 · 바리케이드) 수, hazard = 함정 종류(HAZARDS), ease = 그 던전 몹 체력 · 공격(hp · dmg) · 보스 체력 · 공격(bhp · bdmg) 배율(모든 난이도)
// ease 규칙(2026-10-25 사용자): 다음 던전 보통 = 앞 던전 영웅의 약 1.1배(몹 · 보스 각각, 체력 ÷ (1 − 방어) · 공격을 던전 레벨 곡선 POWER 로 나눠 비교). 성당은 그대로
const DUNGEONS = [
  { id: 'chapel', name: '무너진 성당', lv: 1, ilvl: [1, 5], rooms: 9, pool: ['skelet', 'tiny_zombie', 'zombie', 'skel_archer'], boss: 'big_zombie',
    desc: '마을 밑 버려진 성당. 해골과 좀비가 떠돈다.', banner: 'wall_banner_red', wall: ['wall_hole_1', 'wall_hole_2'], cols: 0.7, skulls: 1.5 },
  { id: 'swamp', name: '독안개 늪', lv: 10, ilvl: [10, 14], rooms: 10, pool: ['muddy', 'swampy', 'slug', 'tiny_slug'], boss: 'ogre_swamp', ease: { hp: 0.87, dmg: 0.88, bhp: 0.87, bdmg: 0.88 },
    desc: '물에 잠긴 지하. 독 웅덩이를 밟으면 독에 걸리고 느려진다.', banner: 'wall_banner_green', wall: ['wall_goo', 'wall_goo'], tint: '#8fc070', needs: 'chapel', cols: 0.2, skulls: 0.5, hazard: 'poison' },
  { id: 'crypt', name: '지하 묘지', lv: 20, ilvl: [20, 24], rooms: 11, pool: ['skelet', 'zombie', 'necromancer', 'wraith'], boss: 'zombie_lord', ease: { hp: 0.59, dmg: 0.64, bhp: 0.6, bdmg: 0.67 },
    desc: '해골이 쌓인 무덤 미로. 가시 함정과 네크로맨서를 조심하라.', banner: 'wall_banner_yellow', wall: ['wall_hole_1', 'wall_hole_2'], tint: '#a090d0', needs: 'swamp', cols: 0.5, skulls: 4, crates: 2, hazard: 'spikes' },
  { id: 'ice', name: '얼어붙은 동굴', lv: 30, ilvl: [30, 34], rooms: 11, pool: ['ice_zombie', 'frost_skel', 'yeti', 'ice_imp'], boss: 'ogre_frost', ease: { hp: 0.34, dmg: 0.45, bhp: 0.41, bdmg: 0.54 },
    desc: '모든 것이 얼어붙은 동굴. 얼음 가시와 냉기 공격에 맞으면 느려진다.', banner: 'wall_banner_blue', wall: ['wall_fountain_mid_blue_anim_f0'], tint: '#8cb4f0', needs: 'crypt', cols: 0.4, skulls: 0.5, hazard: 'icespike' },
  { id: 'fort', name: '오크 요새', lv: 40, ilvl: [40, 44], rooms: 12, pool: ['orc_warrior', 'masked_orc', 'orc_shaman', 'goblin'], boss: 'ogre_blood', ease: { hp: 0.5, dmg: 0.6, bhp: 0.48, bdmg: 0.63 },
    desc: '나무 바리케이드와 가시 함정으로 지키는 오크 요새.', banner: 'wall_banner_yellow', wall: ['wall_banner_red'], tint: '#e0a878', needs: 'ice', cols: 0.3, skulls: 1, crates: 4, hazard: 'spikes' },
  { id: 'hell', name: '용암 지옥', lv: 50, ilvl: [50, 54], rooms: 12, pool: ['chort', 'imp', 'lava_blob', 'fire_skel'], boss: 'big_demon', ease: { hp: 0.91, dmg: 0.91, bhp: 0.55, bdmg: 0.74 },
    desc: '용암이 흐르는 불꽃 악마의 둥지. 용암을 밟으면 화상.', banner: 'wall_banner_red', wall: ['wall_fountain_mid_red_anim_f0'], tint: '#ff7a58', needs: 'fort', cols: 0.3, skulls: 2, hazard: 'lava' },
  // 2026-10-24 사용자 '던전 더 만들어줘' → 4개 추가(권장 Lv.19 · 22 · 25 · 28)
  { id: 'plague', name: '역병 하수도', lv: 60, ilvl: [60, 64], rooms: 12, pool: ['doc', 'pumpkin_dude', 'zombie', 'swampy'], boss: 'plague_giant', ease: { hp: 0.72, dmg: 0.8, bhp: 0.63, bdmg: 0.87 },
    desc: '병든 오수가 흐르는 하수도. 독 웅덩이와 역병 사제의 독침.', banner: 'wall_banner_green', wall: ['wall_goo'], tint: '#b8c870', needs: 'hell', cols: 0.2, skulls: 1, crates: 1, hazard: 'poison' },
  { id: 'order', name: '타락한 기사단 성채', lv: 70, ilvl: [70, 74], rooms: 13, pool: ['knight_f', 'dwarf_m', 'elf_f', 'wizzard_m'], boss: 'iron_ogre', ease: { hp: 0.79, dmg: 0.89, bhp: 0.71, bdmg: 1.02 },
    desc: '심연에 무릎 꿇은 기사단. 기둥 늘어선 성채에 가시 함정.', banner: 'wall_banner_blue', wall: ['wall_banner_yellow', 'wall_hole_1'], tint: '#a0a8c8', needs: 'plague', cols: 0.9, skulls: 0.5, crates: 1, hazard: 'spikes' },
  { id: 'temple', name: '비늘 신전', lv: 80, ilvl: [80, 84], rooms: 13, pool: ['lizard_m', 'lizard_f', 'slug', 'temple_guard'], boss: 'scale_lord', ease: { hp: 0.74, dmg: 0.94, bhp: 0.79, bdmg: 1.19 },
    desc: '물에 잠긴 도마뱀 일족의 신전. 물웅덩이에서는 느려진다.', banner: 'wall_banner_green', wall: ['wall_fountain_mid_blue_anim_f0'], tint: '#70c8a8', needs: 'order', cols: 0.8, skulls: 0.3, hazard: 'water' },
  { id: 'abyss', name: '심연의 문', lv: 90, ilvl: [90, 94], rooms: 14, pool: ['angel', 'abyss_chort', 'void_imp', 'wizzard_m'], boss: 'abyss_lord', ease: { hp: 1.57, dmg: 1.44, bhp: 0.86, bdmg: 1.39 },
    desc: '모든 것이 시작된 곳. 공허 웅덩이가 몸을 갉아먹는다.', banner: 'wall_banner_red', wall: ['wall_fountain_mid_red_anim_f0', 'wall_hole_2'], tint: '#a080e0', needs: 'temple', cols: 0.3, skulls: 2, hazard: 'void' },
];

// ── 아이템 ──
const SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'amulet', 'ring'];
const SLOT_NAMES = { weapon: '무기', helmet: '투구', armor: '갑옷', gloves: '장갑', boots: '신발', amulet: '목걸이', ring: '반지' };
// 장비는 기본 능력치만(랜덤 옵션 없음, 2026-10-24 사용자 '단순화'). 등급이 높을수록 기본 능력치가 조금 세고(mult) 보석 칸이 늘어난다.
// 더 센 차이는 보석으로 갈라진다.
const RARITY = [
  { name: '일반', color: '#d8d4cc', mult: 1, sockets: 0 },
  { name: '매직', color: '#6fa8ff', mult: 1.15, sockets: 1 },
  { name: '레어', color: '#ffd34d', mult: 1.3, sockets: 1 },  // 2026-10-24 사용자: 보석 칸은 장비마다 하나까지
  { name: '유니크', color: '#ff9a3a', mult: 1.4, sockets: 1 },  // 보스 · 고유 몹만, 고정 이름 + 특수 효과
];
// ── 유니크(주황, 2026-10-24) ── 봉인의 숲 특수 축복 하나씩. 기본 아이템은 단계에 맞춰 고르고 이름 · 효과만 고정.
const UNIQUES = {
  echo: { slot: 'weapon', name: '메아리', fx: '잔상 일격', desc: '마무리 타격(검사 3타 · 마법사 2타)을 잔상이 2번 더 친다' },
  leaf: { slot: 'armor', name: '숲지기의 갑주', fx: '잎사귀 방패', desc: '12초마다 피해 1번을 막는다' },
  skin: { slot: 'helmet', name: '돌거북 투구', fx: '굳은 피부', desc: '받는 피해 -12%' },
  ambush: { slot: 'gloves', name: '그림자 손', fx: '기습', desc: '옆 · 뒤 · 경직된 적에게 피해 +30%' },
  dashguard: { slot: 'boots', name: '바람걸음', fx: '잔상 보호막', desc: '대시 뒤 1초간 받는 피해 -40%' },
  breath: { slot: 'amulet', name: '끝없는 숨결', fx: '끝없는 숨결', desc: '기력 회복 속도 +40%' },  // 2026-10-24 사용자: 두 번째 기회 대신
  vamp: { slot: 'ring', name: '피의 서약', fx: '흡혈 칼날', desc: '처치할 때마다 체력 2% 회복' },
};
// 유니크 고유 이름: 착용 레벨 단계(재질 0 낡은 … 9 태초)마다 다른 이름(2026-10-25 사용자). 효과(fx)는 같고 이름만 바뀐다.
// 무기는 무기 종류마다(검 · 망치 · 롯드 · 스태프) 따로
const UNIQUE_NAMES_BY_TIER = {
  echo: {
    light: ['메아리', '되울림', '잔향의 검', '룬 메아리', '용울음', '심연 반향', '검은 잔영', '성화 울림검', '별의 메아리', '태초의 울림'],
    heavy: ['쿵쿵이', '되치기 망치', '천둥 메아리', '룬 울림망치', '용골 분쇄자', '심연 공명', '흑요 진동', '성화 낙진', '별부수개', '태초의 고동'],
    wand: ['속삭임', '메아리 막대', '잔향 롯드', '룬 속삭임', '용의 숨결봉', '심연의 목소리', '흑요 메아리', '성화 지휘봉', '별빛 속삭임', '태초의 말씀'],
    staff: ['울림 지팡이', '되뇌는 지팡이', '잔향 지팡이', '룬 공명장', '용의 포효', '심연 합창', '흑요 공명', '성화 성가', '별의 합창', '태초의 노래'],
  },
  skin: ['돌거북 투구', '바위 껍질', '강철 등딱지', '룬 거북 투구', '용비늘 관', '심연 거북관', '흑요 껍데기', '성화 수호관', '별거북 투구', '태초의 등껍질'],
  leaf: ['숲지기의 갑주', '떡갈나무 갑옷', '강철 잎새 갑주', '룬 덩굴 갑주', '용림 갑주', '심연 가시나무', '흑요 수풀', '성화 세계수', '별잎 갑주', '태초의 숲'],
  ambush: ['그림자 손', '쥐도둑 장갑', '어스름 손', '룬 그림자 손', '용발톱 손', '심연의 손', '흑요 그림자', '성화 암살자 손', '별그림자 손', '태초의 어둠'],
  dashguard: ['바람걸음', '산들 장화', '돌풍 장화', '룬 바람걸음', '용날개 장화', '심연 질풍', '흑요 회오리', '성화 열풍', '별바람 걸음', '태초의 바람'],
  breath: ['끝없는 숨결', '깊은 숨 목걸이', '고요한 들숨', '룬 숨결', '용의 숨', '심연의 호흡', '흑요 고동', '성화 숨결', '별의 숨결', '태초의 호흡'],
  vamp: ['피의 서약', '핏방울 반지', '붉은 맹세', '룬 혈약', '용피 반지', '심연 혈맹', '흑요 피', '성화 피의 맹세', '별피 서약', '태초의 피'],
};
// u = UNIQUES 키, kind = 무기 종류(무기만), tier = 재질 단계
const uniqueName = (u, kind, tier) => {
  const n = UNIQUE_NAMES_BY_TIER[u], list = Array.isArray(n) ? n : n && (n[kind] || n.light);
  return (list && list[Math.min(tier, list.length - 1)]) || UNIQUES[u].name;
};
// 창고 컬렉션(2026-10-24 사용자): 부위 갈래(무기는 경량 · 중량 따로) × 재질 단계(없음 · 10 · 20 … 90) 칸에 유니크를 하나씩 넣어 모은다
// 무기 줄 이름은 무기 이름 그대로(2026-10-24 사용자: 경량 · 중량 대신 검 · 망치 / 롯드 · 스태프)
const VAULT_CATS = [{ id: 'weapon_light', slot: 'weapon', cls: 'swordsman', name: '검' }, { id: 'weapon_heavy', slot: 'weapon', cls: 'swordsman', name: '망치' },
  { id: 'weapon_wand', slot: 'weapon', cls: 'mage', name: '롯드' }, { id: 'weapon_staff', slot: 'weapon', cls: 'mage', name: '스태프' },
  ...SLOTS.filter(s => s !== 'weapon').map(s => ({ id: s, slot: s, name: SLOT_NAMES[s] }))];
VAULT_CATS.forEach(c => { c.uniq = Object.keys(UNIQUES).find(u => UNIQUES[u].slot === c.slot); });
const vaultCat = it => (it.slot === 'weapon' ? 'weapon_' + (Items.base(it).kind || 'light') : it.slot);
const vaultKey = it => vaultCat(it) + ':' + tierOf(it.ilvl);
// 골드 줍는 양 배율(2026-10-24 사용자: 골드가 너무 모자라다 → 조금 올림)
const GOLD_MUL = 1.3;
// ── 난이도(2026-10-24 사용자: 던파식, 던전마다 3단계. 처음 모험 ×2 · ×1.5 / 영웅 ×4 · ×2.2 는 너무 어려워서 낮춤) ──
// hp · dmg = 몹 체력 · 공격 배율, rare = 노랑 이상 확률 배율, uniq = 유니크 확률 배율,
// (장비 레벨은 안 올린다 — 같은 착용 레벨 · 등급이면 능력치가 같다, 2026-10-24 사용자), stoneFavor · stoneSpill = 속성석 · 보석 큰 쪽이 잘 나옴 · 한 단계 위 아주 가끔 = 속성석 · 보석 크기 +, gold · exp = 골드 · 경험치 배율
const DIFFS = [
  { name: '보통', color: '#c8b8a0', hp: 1, dmg: 1, rare: 1, uniq: 1, stoneFavor: 0, stoneSpill: 0, gold: 1, exp: 1 },
  { name: '모험', color: '#6fa8ff', hp: 1.3, dmg: 1.15, rare: 2, uniq: 1.5, stoneFavor: 0.3, stoneSpill: 0.02, gold: 1.2, exp: 1.2 },
  { name: '영웅', color: '#ff9a3a', hp: 1.6, dmg: 1.3, rare: 3, uniq: 2, stoneFavor: 0.6, stoneSpill: 0.05, gold: 1.5, exp: 1.5 },  // 2026-10-25 사용자 '영웅 좀 낮춰' ×3 · ×1.8 → 2.4 · 1.5 → 1.9 · 1.35, 그 뒤 사용자가 정함: 체력 1 · 1.3 · 1.6, 공격 1 · 1.15 · 1.3. 보상 그대로
];
const RUN = { diff: 0 };  // 지금 던전 런의 난이도
// 그 던전에서 보스를 잡은 가장 높은 난이도(-1 = 아직). 예전 저장의 cleared 는 보통으로 친다
const diffCleared = (prof, id) => (prof.clearedDiff && prof.clearedDiff[id] !== undefined ? prof.clearedDiff[id] : prof.cleared[id] ? 0 : -1);
const diffOpen = (prof, id, k) => k === 0 || diffCleared(prof, id) >= k - 1;  // 아래 난이도 보스를 잡으면 열림
const diffIlvl = (def, k) => def.ilvl.slice();  // 난이도와 상관없이 같은 장비 레벨
// 장비 능력치 기준 레벨: 착용 레벨 10 단위 + 2(같은 착용 레벨 · 같은 등급이면 능력치가 다 같다).
// +2 = 예전 떨어지던 장비 레벨(권장 ~ +4)의 평균이라 전체 세기는 그대로
const bandLvl = i => tierOf(i) * 10 + 2;
// 내 레벨보다 낮은 던전(2026-10-24 사용자): 착용 레벨 단계(10 단위)로 본다. 내 단계와 바로 아래 단계 던전은 그대로,
// 그보다 아래면 한 단계마다 경험치 -30%(최소 ×0.1) · 유니크 +50%(최대 ×3). 예: Lv.63(60 단계) — 60 · 50 던전 그대로, 40 던전 ×0.7 · ×1.5, 30 ×0.4 · ×2, 20 ×0.1 · ×2.5, 10 이하 ×0.1 · ×3
const lowGap = (plv, dlv) => Math.max(0, Math.floor(plv / 10) - Math.floor(dlv / 10) - 1);
const lowExp = (plv, dlv) => Math.max(0.1, 1 - lowGap(plv, dlv) * 0.3);
const lowUniq = (plv, dlv) => Math.min(3, 1 + lowGap(plv, dlv) * 0.5);
// 타임어택(2026-10-24 사용자): 던전에 들어간 뒤 보스를 쓰러뜨릴 때까지 걸린 시간(창을 연 동안은 멈춤). 던전 · 난이도마다 최고 기록
const fmtTime = sec => { const m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const timeKey = (id, diff) => id + ':' + diff;
const UNIQUE_DROP = { boss: 0.1, unique: 0.03 };  // 보스 10% · 고유 몹 3%(2026-10-24 사용자: 보통 30% 는 너무 크다). 모험 · 영웅은 DIFFS.uniq 배
const UNIQUE_FX = { echoMult: 0.5, echoHits: 2, leafCd: 12, skin: 0.88, ambush: 1.3, dashguard: 0.6, dashguardT: 1, secondHp: 0.4, vamp: 0.02, breath: 40 };
// ── 장비 이름 · 능력치 규칙(2026-10-24 사용자: 무한히 늘리기 쉽게) ──
// 이름 = [등급 접두사] [착용 레벨 재질] [부위 이름]. 예: 찬란한 강철 갑옷(레어 · Lv.10 갑옷). 유니크는 고유 이름(바탕은 같은 규칙).
// 재질은 착용 레벨(없음 · 5 · 10 · 15 · 20 · 25)마다 하나 — 더 높은 던전이 생기면 GEAR_TIERS 에 한 줄 더하면 된다.
// 능력치는 장비 단계(ilvl) 공식(curve) × 0.85~1.15 무작위 × 등급 배율. 부위 규칙(사용자): 무기 공격력(경량 · 중량) · 투구 방어력+체력 ·
//   갑옷 방어력(+기력 · 기력 회복은 등급 고정) · 신발 방어력(+대시는 등급 고정) · 장갑 방어력+공격력 · 목걸이 체력(+공격 속도는 등급 고정) ·
//   반지(이동 속도 · 치명타 모두 등급 고정). 중량 무기는 공격력이 경량의 1.3배, 대신 느리다(WEAPON_KINDS)
// 재질 = 장비의 착용 레벨 10 단위(던전과 상관없이). 더 높은 장비가 생기면 한 줄 더하면 된다
const GEAR_TIERS = [
  // 재질 색(2026-10-24 사용자: 무기를 레벨마다 색으로 구분) — 이웃한 단계끼리 헷갈리지 않게 색상을 크게 벌림
  { mat: '낡은', tint: '#8a5a3a' },    // Lv.1~9 갈색
  { mat: '쇠', tint: '#8a929e' },      // Lv.10~19 회색
  { mat: '강철', tint: '#4a78d0' },    // Lv.20~29 파랑
  { mat: '룬', tint: '#28c8c0' },      // Lv.30~39 청록
  { mat: '용린', tint: '#4cc040' },    // Lv.40~49 초록
  { mat: '심연', tint: '#9040e0' },    // Lv.50~59 보라
  { mat: '흑요석', tint: '#2a2234' },  // Lv.60~69 검정
  { mat: '성화', tint: '#ff5a20' },    // Lv.70~79 주황빨강
  { mat: '별빛', tint: '#f4f6ff' },    // Lv.80~89 흰빛
  { mat: '태초', tint: '#ffc018' },    // Lv.90~ 금색
];
// 롯드 그림: 마법 지팡이 그림의 윗부분(머리 + 짧은 자루)만 잘라 쓴다 — 스태프와 같은 머리, 길이만 짧게
FRAMES.weapon_rod = [FRAMES.weapon_red_magic_staff[0], FRAMES.weapon_red_magic_staff[1], 8, 18];
const tierOf = ilvl => Math.min(GEAR_TIERS.length - 1, Math.floor(ilvl / 10));
const lightAtk = i => 6 * POWER(i);
const GEAR_FORMS = {
  weapon: [
    // 2026-10-24 사용자: 아이콘 통일 — 경량은 검, 중량은 망치 하나씩(재질 색만 다르게, 방어구처럼)
    // 그림은 캐릭터 키에 맞는 크기(2026-10-24 사용자 '무기 쥔 모습이 어색' → 기사검 29px · 큰 망치 37px 에서 21 · 24px 로)
    { kind: 'light', noun: '검', icon: 'weapon_regular_sword', curve: { atk: lightAtk } },
    { kind: 'heavy', noun: '망치', icon: 'weapon_hammer', curve: { atk: i => lightAtk(i) * 1.3 } },
    // 마법사 무기(2026-10-24): 경량 롯드(짧은 막대) · 중량 스태프(긴 지팡이) — 색이 아니라 길이로 구분(사용자), 검 · 망치와 같은 세기
    { kind: 'wand', noun: '롯드', icon: 'weapon_rod', curve: { atk: lightAtk } },
    { kind: 'staff', noun: '스태프', icon: 'weapon_red_magic_staff', curve: { atk: i => lightAtk(i) * 1.3 } },
  ],
  helmet: [{ noun: '투구', icon: 'helmet', curve: { def: i => 1.5 * POWER(i), hp: i => 7 * POWER(i) } }],
  armor: [{ noun: '갑옷', icon: 'armor', curve: { def: i => 2.7 * POWER(i) } }],
  gloves: [{ noun: '장갑', icon: 'gloves', curve: { def: i => 1.1 * POWER(i), atk: i => 1 * POWER(i) } }],
  boots: [{ noun: '장화', icon: 'boots', curve: { def: i => 1.4 * POWER(i) } }],
  amulet: [{ noun: '목걸이', icon: 'amulet', curve: { hp: i => 12 * POWER(i) } }],
  ring: [{ noun: '반지', icon: 'ring', curve: { hp: i => 12 * POWER(i) } }],  // 2026-10-24 사용자: 반지도 기본 체력(목걸이와 같은 곡선 · 등급 배율)
};
// 기본 아이템 목록(부위 · 종류 · 재질마다 하나): id = 부위[_종류]_재질번호
const BASES = [];
for (const slot in GEAR_FORMS) for (const f of GEAR_FORMS[slot]) GEAR_TIERS.forEach((t, ti) => BASES.push({
  id: slot + (f.kind ? '_' + f.kind : '') + '_' + ti, slot, kind: f.kind, tier: ti,
  name: t.mat + ' ' + (Array.isArray(f.noun) ? f.noun[ti] : f.noun),
  icon: f.icon, tint: t.tint, curve: f.curve,
}));
const RARITY_PREFIX = ['', '정교한', '찬란한'];  // 일반(없음) · 매직 · 레어. 유니크는 고유 이름
const itemName = (b, rarity) => (RARITY_PREFIX[rarity] ? RARITY_PREFIX[rarity] + ' ' : '') + b.name;
// 예전 저장의 중량 무기 기본 아이템(이름 규칙 전) — 옮길 때 경량 · 중량 가르기
const OLD_HEAVY = ['axe', 'hammer', 'waraxe', 'big_hammer', 'mace', 'spiked_baton', 'double_axe', 'anime_sword', 'cleaver', 'throwing_axe'];
// 등급 고정 옵션: 착용 레벨(단계)로는 안 커지고 등급(일반 · 매직 · 레어 · 유니크)으로만 차이 난다
const RARITY_FIXED = {
  armor: { stamina: [5, 10, 15, 20], spRegen: [18, 22, 26, 30] },  // 기력 회복 속도 %(2026-10-24 사용자: 유니크 30% 기준, 낮은 등급도 너무 낮지 않게)
  boots: { dashCost: [10, 15, 20, 25] },  // 대시 기력 감소 %(2026-10-24 사용자: 대시 횟수 · 쿨타임 대신, 등급으로만)
  amulet: { aspd: [3, 6, 9, 12] },
  ring: { move: [3, 5, 7, 10], crit: [2, 4, 6, 8] },
};
// 착용 레벨(2026-10-24 사용자): 없음 · 5 · 10 · 15 · 20 · 25 — 장비 단계로 정한다. 그 던전 권장 레벨이면 낄 수 있게
// 단계 1~6 없음 · 7~9 Lv.5 · 10~12 Lv.10 · 13~16 Lv.15 · 17~19 Lv.20 · 20~ Lv.25
// 착용 레벨: 없음 · 10 · 20 · 30 … 10 단위(2026-10-24 사용자). 장비 레벨 1~9 = 없음, 10~19 = Lv.10 … (재질과 같은 단위)
const reqLevel = ilvl => Math.floor(ilvl / 10) * 10;

// ── 대장장이 주문서 (2026-10-24 사용자 개편) ──
// 강화 칸 없음. 어떤 장비든 +10 까지 바를 수 있고, 실패하면 주문서만 사라진다(장비 · 강화는 그대로).
// 강화 주문서는 하나뿐(2026-10-24 사용자: 방어구 · 장신구는 부위가 많아 모자라서) — 어느 부위에나 바르고, 오르는 능력치는 바른 부위에 따라
// (무기 · 장신구 공격력, 방어구 방어력). 2026-10-24 사용자: 성공률 대폭 낮춤 — 축복받은 강화 주문서 5%(예전 30% 자리) · 강화 주문서 3%(예전 20% 자리),
// 예전 10% 주문서는 없앰. 오르는 양은 예전 그 자리 그대로(3% 쪽이 한 번에 더 많이 오른다).
// 계승 주문서: 강화(+N · 오른 능력치)를 같은 부위 새 장비로 옮길 때 1장 쓴다(복구 주문서 대신).
// 주문서 = { g: 'any' | 'inherit', r: 0 = 축복받은 · 1 = 보통 }
const ENCHANT_MAX = 10;
const SCROLL_GROUPS = {
  // gain = 한 번 성공할 때 오르는 양(× 장비 레벨 곡선). 2026-10-25 사용자: 축복받은 · 보통은 확률만 다르고 오르는 양은 같게,
  // 무기 · 목걸이 · 반지를 모두 +10 하면 공격력(대미지) 약 4배(예전 축복 1 · 보통 3 은 3.4배 · 8배, 2배(0.42)는 '말도 안 되게 어렵다' → 4배)
  weapon: { name: '무기', stat: 'atk', slots: ['weapon'], gain: 1.26 },
  // 방어구는 4부위라 주문서가 많이 드는데 효과가 가장 작았다 → 1.5배(2026-10-24 사용자). Lv.40 한 벌 +10: 축복받은 받는 피해 -38% → -48%, 보통 -56% → -65%
  armor: { name: '방어구', stat: 'def', slots: ['helmet', 'armor', 'gloves', 'boots'], gain: 1.89 },  // 무기의 1.5배(예전 비율 그대로)
  // 장신구도 무기와 똑같이 공격력(2026-10-24 사용자: 무기 · 장신구 = 공격, 방어구 = 방어로 정리. 예전엔 최대 체력 5 · 12)
  acc: { name: '장신구', stat: 'atk', slots: ['amulet', 'ring'], gain: 1.26 },
};
const SCROLL_ORDER = ['any', 'inherit'];
// 성공률은 지금 강화 단계마다 다르게(2026-10-25 사용자: 10% · 5% 로 똑같으니 너무 어렵다). ENCHANT_RATE[지금 +N] = 강화 주문서(보통) 성공률 %,
// 축복받은 강화 주문서는 거기에 +3%. 2026-10-25 사용자: 처음 50% · +9→10 은 10% 로 다시 — 그 사이는 단계마다 같은 비율로 줄게(×0.84).
// 보통으로 +10 까지 평균 약 51장, 축복받은 약 43장(그 전 표 60 … 3%: 98 · 65장)
const ENCHANT_RATE = [50, 42, 35, 29, 24, 20, 17, 14, 12, 10];
const BLESS_BONUS = 3;
const enchantRate = (s, ups) => ENCHANT_RATE[Math.min(ups || 0, ENCHANT_MAX - 1)] + (s.r === 0 ? BLESS_BONUS : 0);
const SCROLL_NAMES = ['축복받은 강화 주문서', '강화 주문서'];
const SCROLL_COLORS = ['#ffe08a', '#7dff8a'];
const SCROLL_DROP = [0.65, 0.35];  // 떨어질 때 축복받은 · 보통 비율
// 주문서가 떨어질 확률(2026-10-25 사용자: 너무 쌓인다). 처음 일반 4% · 정예 10% · 고유 1장 · 작은 상자 30% · 보스 2장(한 판 약 6 · 12장)
// → 절반쯤(1.5% · 4% · 50% · 15% · 1장) → '좀만 더' → 지금(한 판 약 3 · 4.5장). 보스 보물 상자 1장은 그대로
const SCROLL_DROP_RATE = { normal: 0.01, elite: 0.028, unique: 0.35, chest: 0.1, boss: 1 };
const INHERIT_CHANCE = 0.06;            // 주문서가 떨어질 때 계승 주문서일 확률
const scrollKey = s => s.g + ':' + (s.r || 0);
const scrollGroupOf = slot => Object.keys(SCROLL_GROUPS).find(g => SCROLL_GROUPS[g].slots.includes(slot));
const scrollName = s => s.g === 'inherit' ? '계승 주문서' : SCROLL_NAMES[s.r];  // 이름 뒤 확률은 뺌(2026-10-24 사용자) — 성공률은 대장장이 설명 줄에
const scrollColor = s => s.g === 'inherit' ? '#ff8ae0' : SCROLL_COLORS[s.r];
// slot 을 주면 그 부위에 발랐을 때 오르는 것만. ilvl 을 주면 그 장비에 실제로 오르는 양(장비 레벨 곡선, items.js enchant 와 같은 식). ups = 그 장비 지금 +N
// 그 부위 · 장비 레벨에 한 번 성공할 때 오르는 양(주문서 종류와 상관없음)
const enchGain = (slot, ilvl) => Math.max(1, Math.round(SCROLL_GROUPS[scrollGroupOf(slot)].gain * POWER(ilvl)));
const scrollGain = (s, slot, ilvl) => STATS[SCROLL_GROUPS[scrollGroupOf(slot)].stat].name + ' +' + enchGain(slot, ilvl || 1);
const scrollText = (s, slot, ilvl, ups) => s.g === 'inherit' ? '강화(+N)를 같은 부위 새 장비로 옮길 때 1장 쓴다 (대장장이에서 Z)'
  : slot ? '+' + (ups || 0) + ' → +' + ((ups || 0) + 1) + ' 성공 ' + enchantRate(s, ups) + '% · ' + SLOT_NAMES[slot] + '에 바르면 ' + scrollGain(s, slot, ilvl)
  : '성공 ' + enchantRate(s, 0) + '%(+0) ~ ' + enchantRate(s, ENCHANT_MAX - 1) + '%(+' + (ENCHANT_MAX - 1) + ') · ' + Object.values(SCROLL_GROUPS).map(g => g.name + ' ' + STATS[g.stat].name).join(' · ');


// 능력치 이름 · 표시 방법. 랜덤 옵션 값 = [최소, 최대] × (1 + 0.35 × (단계 - 1))
const STATS = {
  atk: { name: '공격력', fmt: v => '+' + v + ' 공격력', roll: [1, 3], prefix: '날카로운' },
  def: { name: '방어력', fmt: v => '+' + v + ' 방어력', roll: [1, 3], prefix: '단단한' },
  hp: { name: '최대 체력', fmt: v => '+' + v + ' 최대 체력', roll: [5, 12], prefix: '튼튼한' },
  crit: { name: '치명타 확률', fmt: v => '+' + v + '% 치명타 확률', roll: [1, 3], prefix: '예리한', pct: true },
  critDmg: { name: '치명타 피해', fmt: v => '+' + v + '% 치명타 피해', roll: [8, 20], prefix: '잔혹한', pct: true },
  aspd: { name: '공격 속도', fmt: v => '+' + v + '% 공격 속도', roll: [3, 7], prefix: '재빠른', pct: true, cap: 30 },
  move: { name: '이동 속도', fmt: v => '+' + v + '% 이동 속도', roll: [3, 6], prefix: '날랜', pct: true, cap: 25 },
  gold: { name: '골드 획득', fmt: v => '+' + v + '% 골드 획득', roll: [5, 15], prefix: '탐욕의', pct: true },
  life: { name: '처치 시 체력', fmt: v => '처치 시 체력 +' + v, roll: [1, 3], prefix: '흡혈의' },
  stamina: { name: '최대 기력', fmt: v => '+' + v + ' 최대 기력', roll: [6, 14], prefix: '끈기의' },
  dmg: { name: '피해', fmt: v => '+' + v + '% 피해', pct: true },
  spRegen: { name: '기력 회복', fmt: v => '+' + v + '% 기력 회복', pct: true },
  dashCost: { name: '대시 기력', fmt: v => '대시 기력 -' + v + '%', pct: true },
};

// ── 속성석 (봉인의 숲 속성 축복을 장비로) ──
// 무기에 칸 3개(기본 공격 · 차지 · 검기), 칸마다 속성석 하나. 그 칸 기술에 속성 힘이 붙고 이펙트가 속성 색이 된다(없으면 흰색).
// 크기가 클수록 power 배로 세진다. 같은 크기 3개 = 한 단계 큰 돌(세공사).
const ELEMENTS = {
  fire: { name: '불', stone: '화염석', color: '#ff7a3c' },
  frost: { name: '얼음', stone: '빙결석', color: '#7fd8ff' },
  thunder: { name: '번개', stone: '뇌전석', color: '#ffe14a' },
  poison: { name: '독', stone: '맹독석', color: '#9be15d' },
};
const EL_ORDER = ['fire', 'frost', 'thunder', 'poison'];
const STONE_SIZES = [
  { name: '조각', power: 1 }, { name: '작은', power: 1.6 }, { name: '보통', power: 2.3 }, { name: '큰', power: 3.1 }, { name: '완전한', power: 4 },
  // 2026-10-24 사용자: 빛나는은 빼고 최고 단계를 한 칸 낮춤(예전 빛나는 세기 = 전설, 전설의 세기 = 태초). 전설 · 태초는 오로라 테두리
  { name: '전설', power: 5 }, { name: '태초', power: 6.2 },
];
// ── 보석 (봉인의 숲 검 · 방어 축복을 장비 보석으로, 2026-10-24) ──
// 장비의 보석 칸(일반 0 · 매직 이상 1칸)에 낀다. 크기는 속성석과 같은 단계, 효과 = 기본값 × 크기 power(반올림).
// 주머니 · 합치기 · 줍기는 속성석과 같은 길로 다루려고 ELEMENTS 에도 넣는다(EL_ORDER 에는 없다).
const GEMS = {
  // slots = 끼울 수 있는 부위(2026-10-24 사용자: 공격은 무기 · 장신구 3칸, 방어는 방어구 4칸 — 부위 수 균형)
  might: { name: '공격', stone: '공격 보석', color: '#ff5a78', shape: 'jewel', stats: { dmg: 4, crit: 1, critDmg: 5 }, slots: ['weapon', 'amulet', 'ring'], where: '무기 · 목걸이 · 반지' },
  guard: { name: '방어', stone: '방어 보석', color: '#5ab8ff', shape: 'jewel', stats: { def: 2, hp: 8, stamina: 3 }, slots: ['helmet', 'armor', 'gloves', 'boots'], where: '투구 · 갑옷 · 장갑 · 신발' },
};
Object.assign(ELEMENTS, GEMS);
const GEM_ORDER = ['might', 'guard'];
const gemFits = (g, slot) => GEMS[g.el].slots.includes(slot);
const GEM_CHANCE = 0.4;  // 속성석이 떨어질 때 대신 보석일 확률
// 보석이 떨어질 때 공격 · 방어 비율(2026-10-25 사용자: 방어 보석이 잘 안 나온다). 예전 50 : 50 — 방어는 4부위 · 공격은 3부위라 방어를 조금 더
const GEM_WEIGHT = { might: 0.4, guard: 0.6 };
const gemStats = g => { const o = {}, k = STONE_SIZES[g.size].power; for (const s in GEMS[g.el].stats) o[s] = Math.round(GEMS[g.el].stats[s] * k); return o; };
const gemText = g => { const st = gemStats(g); return Object.keys(st).map(s => STATS[s].name + ' +' + st[s] + (STATS[s].pct ? '%' : '')).join(' · '); };
const STONE_SLOTS = ['basic', 'charge', 'wave', 'dash'];  // 대시도 기술 하나로(2026-10-24 사용자)
const STONE_SLOT_NAMES = { basic: '기본 공격', charge: '회전베기', wave: '검기', dash: '대시' };
const STONE_SLOT_SHORT = { basic: '기본', charge: '회전', wave: '검기', dash: '대시' };
const stoneName = s => (s.size === 0 ? ELEMENTS[s.el].stone + ' 조각' : STONE_SIZES[s.size].name + ' ' + ELEMENTS[s.el].stone);
// 합성 비용(골드): 합치는 돌의 크기에 따라. 2026-10-24 사용자 '골드 쓸 데가 없다' → 약 6배로 올림
// (던전 한 판 중반 기준 골드 약 1500 + 장비 판매 약 1500). 보통 하나 = 조각 9개 + 약 2700G
// 조각→작은 300 · 작은→보통 900 · 보통→큰 2500 · 큰→완전한 6000 · 완전한→전설 15000 · 전설→태초 35000
const COMBINE_COSTS = [300, 900, 2500, 6000, 15000, 35000];
const COMBINE_COST = size => COMBINE_COSTS[size] || 0;
// 상태이상 기본 수치
const FREEZE_AT = 4;          // 냉기가 이만큼 쌓이면 빙결(보스는 균열)
const SHOCK_VULN = 0.2;       // 감전된 적이 받는 피해 +20% (+ 크기마다 5%)
const CRACK_VULN = 0.25;      // 보스 얼음 균열: 받는 피해 +25%
const FROZEN_VULN = 0.3;      // 빙결된 적이 받는 피해 +30%
const POISON_MAX = 12;
// 속성석 크기별로 열리는 능력(2026-10-24 사용자: 봉인의 숲 속성 축복의 부과 능력을 속성석 성장으로)
// 보통(2)부터 = 그 칸 기술에 부과 능력, 완전한(4)부터 = 속성 패시브(어느 칸에 끼워도), 전설(5)부터 = 패시브 둘째
const EL_UNLOCK = { slot: 2, p1: 4, p2: 5 };
const EL_ABIL = {
  fire: {
    basic: ['화염구 베기', '휘두를 때마다 화염구가 날아가 처음 닿은 적 자리에서 터진다'],
    charge: ['불길 고리', '회전베기 자리에 불길이 2.5초 남는다'],
    wave: ['작열 검기', '검기에 맞은 적 자리에서 불꽃이 터진다'],
    dash: ['화염 폭주', '대시가 끝난 자리에서 불꽃이 터진다'],
    p1: ['연쇄 폭발', '화상 중에 쓰러진 적이 터져 둘레에 피해 · 화상'],
    p2: ['불씨', '화상이 5초로 길어지고 30% 세진다'],
  },
  frost: {
    basic: ['얼음 파편 베기', '휘두를 때마다 얼음 파편 2개가 적을 꿰뚫고 날아간다'],
    charge: ['얼음 장판', '회전베기 자리가 3초 얼어붙어 위의 적에게 냉기'],
    wave: ['얼음 길', '검기가 지나간 길이 얼어붙어 냉기'],
    dash: ['얼음 결정', '대시가 끝난 자리에서 냉기가 터진다'],
    p1: ['파쇄', '얼어붙은 적을 때리면 얼음이 깨지며 큰 피해 + 둘레 냉기'],
    p2: ['한기', '냉기 · 빙결 상태인 적이 주는 피해 -30%'],
  },
  thunder: {
    basic: ['연쇄 번개 베기', '모든 기본 공격에서 번개가 튄다'],
    charge: ['뇌운', '회전베기 1초 뒤 낙뢰가 한 번 더 떨어진다'],
    wave: ['벼락 검기', '검기에 맞은 적마다 벼락'],
    dash: ['번개 질주', '대시로 스친 적 모두에게 번개 피해 · 감전'],
    p1: ['날벼락', '적을 때릴 때 10% 확률로 하늘에서 벼락'],
    p2: ['고전압', '감전된 적이 받는 피해가 15% 더 늘어난다'],
  },
  poison: {
    basic: ['독 분사 베기', '휘두를 때마다 앞으로 독을 뿜는다'],
    charge: ['독 터뜨리기', '회전베기가 쌓인 독을 한꺼번에 터뜨린다'],
    wave: ['독침 검기', '검기에 맞으면 독 3중첩'],
    dash: ['독안개 돌진', '대시가 끝난 자리에 독안개(3초)'],
    p1: ['독 폭발', '독이 가득 차면 터져 둘레에 피해 · 독을 퍼뜨린다'],
    p2: ['맹독', '독 최대 중첩 +6, 독 피해 +25%'],
  },
};
// 마법사 칸 능력 이름 · 설명(2026-10-24 사용자: 마법진 · 마력탄에 맞게). 없는 칸(대시 · 패시브)은 검사 것 그대로
const EL_ABIL_MAGE = {
  fire: { basic: ['화염구', '휘두를 때마다 화염구가 날아가 처음 닿은 적 자리에서 터진다'], charge: ['화염 마법진', '마법진이 터진 자리에 불길이 2.5초 남는다'], wave: ['작열 마력탄', '마력탄이 맞은 적 자리에서 불꽃이 터진다'] },
  frost: { basic: ['얼음 파편', '휘두를 때마다 얼음 파편 2개가 적을 꿰뚫고 날아간다'], charge: ['서리 마법진', '마법진이 터진 자리가 3초 얼어붙어 위의 적에게 냉기'], wave: ['서리 구슬', '마력탄이 터질 때 얼음 폭발이 넓어지고 둘레에 냉기 2'] },
  thunder: { basic: ['연쇄 번개', '모든 기본 공격에서 번개가 튄다'], charge: ['뇌운 마법진', '마법진이 터지고 1초 뒤 낙뢰가 한 번 더 떨어진다'], wave: ['벼락 구슬', '마력탄에 맞은 적마다 벼락'] },
  poison: { basic: ['독 분사', '휘두를 때마다 앞으로 독을 뿜는다'], charge: ['독 터뜨리기', '마법진이 쌓인 독을 한꺼번에 터뜨린다'], wave: ['독침 구슬', '마력탄에 맞으면 독 3중첩'] },
};
// 칸 능력 [이름, 설명]: 직업에 맞게
const elAbil = (el, slot, prof) => (clsOf(prof).id === 'mage' && EL_ABIL_MAGE[el][slot]) || EL_ABIL[el][slot];
// 속성석 세트 효과(2026-10-24 사용자): 칸 4개가 모두 보통(3단계) 이상일 때. 세기 sc = 가장 낮은 돌의 power ÷ 보통 power(보통 1 → 태초 약 2.7)
// 같은 속성 4개 = 공명, 두 속성 2개씩 = 듀오. 그 밖의 조합(3:1 · 1:1:1:1 · 2:1:1)은 없음
const SET_MIN = 2;
const SET_RES = {
  fire: { name: '업화', desc: sc => '화상 피해 +' + Math.round(50 * sc) + '% · 화상 걸린 적이 쓰러지면 늘 터짐' },
  frost: { name: '절대영도', desc: sc => '냉기 1 더 · 빙결 시간 +' + Math.round(50 * sc) + '% · 빙결된 적이 받는 피해 +' + Math.round(20 * sc) + '%' },
  thunder: { name: '뇌신', desc: sc => '감전된 적에게 3초마다 낙뢰(공격력의 ' + Math.round(50 * sc) + '%) · 연쇄 번개 2번 더' },
  poison: { name: '역병', desc: sc => '독 최대 중첩 +6 · 독 걸린 적이 쓰러지면 둘레로 독이 옮음(' + Math.round(4 * sc) + '중첩)' },
};
const SET_DUO = {
  'fire+frost': { name: '증기 폭발', desc: sc => '화상 · 냉기가 함께 걸리면 증기 폭발(둘레에 공격력의 ' + Math.round(120 * sc) + '%, 두 상태 풀림)' },
  'fire+thunder': { name: '과부하', desc: sc => '감전된 적이 화상을 입으면(또는 반대) 폭발(공격력의 ' + Math.round(80 * sc) + '%) + 크게 밀려남' },
  'fire+poison': { name: '독연', desc: sc => '독 걸린 적이 화상을 입으면 독안개가 터짐(쌓인 독 피해 ' + (2 * sc).toFixed(1) + '배 + 둘레 독)' },
  'frost+thunder': { name: '초전도', desc: sc => '냉기 · 빙결된 적이 감전되면 받는 피해 +' + Math.round(25 * sc) + '% 더' },
  'frost+poison': { name: '서리독', desc: sc => '독 걸린 적에게 냉기 2배 · 빙결되면 쌓인 독이 한 번에 터짐(' + (3 * sc).toFixed(1) + '배)' },
  'poison+thunder': { name: '신경독', desc: sc => '감전된 적에게 독 2배 · 감전 1초 더' },
};
// 떨어지는 크기(2026-10-25 사용자가 정함): 조각(1) · 작은(2) · 보통(3)까지만 떨어지고, 큰(4) 이상은 세공사 합치기로만(STONE_DROP_CAP).
// 던전 레벨이 오를수록 보통(3)이 늘고 조각(1)이 줄어 Lv.80 부터는 조각이 안 나온다. 던전마다 보통 난이도의 [조각, 작은, 보통] 확률.
// 모험 · 영웅은 크기를 올리지 않고 큰 쪽이 잘 나오게(DIFFS.stoneFavor), 그 던전 최대보다 한 단계 위는 아주 가끔만(DIFFS.stoneSpill — 이제 성당에서만)
const STONE_DROP_CAP = 2;
const STONE_DROP = {
  chapel: [0.90, 0.10, 0], swamp: [0.78, 0.20, 0.02], crypt: [0.64, 0.30, 0.06], ice: [0.50, 0.39, 0.11], fort: [0.37, 0.46, 0.17],
  hell: [0.25, 0.51, 0.24], plague: [0.14, 0.54, 0.32], order: [0.05, 0.55, 0.40], temple: [0, 0.52, 0.48], abyss: [0, 0.42, 0.58],
};
const STONE_BOSS_BOOST = 0.8;  // 보스 · 큰 상자: 큰 쪽이 더 잘 나온다(크기 한도는 같음)

// 레벨업에 필요한 경험치
// 다음 레벨까지 경험치: 같은 레벨 몹 경험치(역할 × POWER)로 치면 Lv.1 은 약 18마리, Lv.40 은 약 135마리(던전 두 판쯤) — 천천히 오르게
const expToNext = lv => Math.round((150 + 30 * lv) * POWER(lv));
const POTION_PRICE = 25;
// 상점: 가장 작은(조각) 속성석 · 보석도 판다(2026-10-24 사용자). 조각 3개 + 합성 300G = 작은 돌 하나
const SHARD_PRICE = 150;
const SHARD_SELL = 50;  // 조각(1단계) 속성석 · 보석 팔 때(2026-10-24 사용자: 1단계만 팔 수 있게)
const INHERIT_PRICE = 3000;  // 계승 주문서도 판다(복구 주문서 자리, 2026-10-24 사용자)
