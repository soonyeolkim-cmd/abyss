// 전투 판정 · 피해 · 효과. 위치는 방 안 픽셀, z = 높이(뜬 정도).
const AIR_REACH = 60;  // 이 높이까지 뜬 몹은 맞는다

function unit(dx, dy, fallback) {
  const l = Math.hypot(dx, dy);
  return l > 0.001 ? { x: dx / l, y: dy / l } : fallback;
}

// 바닥에 깔리는 범위(둘레 공격 · 폭발 · 장판 · 마법진 · 보스 내려찍기)는 그림과 같은 납작한 타원(세로 = 가로 × GROUND_Y)으로 판정한다
// (2026-10-26 사용자: 이펙트 범위 = 판정 범위 — 예전엔 판정이 동그라미라 그림 바로 아래 · 위 적도 맞았다)
const GROUND_Y = 0.6;
const groundDist = (dx, dy) => Math.hypot(dx, dy / GROUND_Y);

// 공격 범위: 바라보는 쪽 부채꼴(거리 reach · 각도 arc) 또는 둘레(radius). tr = 맞는 쪽 몸 반지름
function inHitbox(o, face, def, t, tr) {
  if ((t.z || 0) > AIR_REACH) return false;
  const dx = t.x - o.x, dy = t.y - o.y;
  const dist = Math.hypot(dx, dy);
  if (def.radius) return groundDist(dx, dy) <= def.radius + tr;
  const along = dx * face.x + dy * face.y;
  if (along < def.reach[0] - tr || along > def.reach[1] + tr) return false;
  // noBody(대시 찌르기): 칼날 줄 — 앞으로 reach 만큼, 칼날 줄에서 몸 반지름 + 5px 안쪽만
  if (def.noBody) return Math.abs(dx * face.y - dy * face.x) <= tr + 5;
  if (dist < tr + 4) return true;
  return along / dist >= Math.cos(def.arc * Math.PI / 180);
}

// 공격 준비 앞부분은 끊을 수 있고, '!'가 뜨는 뒷부분부터는 약한 공격으로 못 끊는다
const COMMIT = 0.6;
function committed(e) {
  return (e.state === 'windup' && e.t < e.windupT * COMMIT) || e.state === 'attack';
}

// 플레이어 공격이 몹에 맞음. 맞았으면 true
function hitEnemy(e, def, p, w) {
  if (World.mirror) return false;  // 파티 손님: 맞히기는 방장 쪽 내 몸이 한다(world.js)
  if (e.dying || e.state === 'dead' || e.state === 'getup' || e.spawnT > 0) return false;
  if (e.ri !== undefined && World.roomOf(p) !== e.ri) return false;  // 방 하나 = 맵 하나: 다른 방 몹은 안 맞는다
  if (e.state === 'down') {
    if (e.otgUsed) return false;  // 쓰러진 몹은 추가타 한 번만
    e.otgUsed = true;
  }
  const ed = e.def, st = p.stats, wk = WEAPON_KINDS[st.kind];
  if (!e.awake) World.wake(e);  // 자다가 맞으면 무리째 깨어난다
  const toE = unit(e.x - p.x, e.y - p.y, p.fv);
  const dir = def.outward ? toE : unit(toE.x + p.fv.x, toE.y + p.fv.y, p.fv);
  const stag = e.state === 'stagger' ? 1.5 : 1;
  const crit = def.crit || Math.random() * 100 < st.crit;  // 암살자 돌진 베기 = 언제나 치명타
  let dmg = st.atk * def.mult * wk.dmg * stag * Elements.vuln(e) * (1 + (st.dmg || 0) / 100) * (0.9 + Math.random() * 0.2);
  if (crit) dmg *= 1 + st.critDmg / 100;
  // 유니크 기습: 적의 옆 · 등 뒤, 또는 경직 · 빙결 · 쓰러진 적
  if (st.fx && st.fx.ambush) {
    const tp = unit(p.x - e.x, p.y - e.y, e.fv);
    if (e.fv.x * tp.x + e.fv.y * tp.y < 0.3 || e.state === 'stagger' || e.state === 'frozen' || e.state === 'down') dmg *= UNIQUE_FX.ambush;
  }
  // 암살자 등 뒤 공격(2026-10-25): 몹이 보는 쪽 반대편에서 치면 +backstab
  if (p.cls && p.cls.backstab) { const tp = unit(p.x - e.x, p.y - e.y, e.fv); if (def.back || e.fv.x * tp.x + e.fv.y * tp.y < -0.3) dmg *= 1 + p.cls.backstab; }  // 백스탭(back)은 적이 돌아봐도 등 뒤로 친다
  dmg *= 1 - (e.armorCut || 0);  // 몹 방어(던전 레벨이 높을수록 많이 깎는다)
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.flash = 0.1;
  const knock = def.knock * wk.knock * (ed.boss ? 0.25 : 1);
  const heavy = def.heavy || crit;
  const armored = e.state === 'frozen' ||  // 얼어 있으면 맞아도 그대로(띄우기만 깬다)
    (!heavy && ((ed.superArmor && (e.state === 'windup' || e.state === 'attack' || e.state === 'charge')) || e.armorT > 0 || committed(e)));

  if (e.state === 'air' || e.state === 'down') {
    e.juggle++;
    const pop = def.launch ? def.launch * (ed.launchMul || 1) : 140;
    e.vz = Math.max(e.vz, pop * Math.max(0.15, 1 - 0.2 * e.juggle));
    e.kx = dir.x * knock * 0.35; e.ky = dir.y * knock * 0.35;
    e.state = 'air';
  } else if (def.launch && !ed.boss) {
    e.state = 'air'; e.juggle = 0;
    e.vz = def.launch * (ed.launchMul || 1);
    e.kx = dir.x * knock; e.ky = dir.y * knock;
  } else if (!armored && !ed.boss) {
    e.chain = (e.state === 'hurt' ? e.chain : 0) + 1;
    if (e.poise && e.chain >= e.poise) {
      // 연타를 계속 맞으면 버티고 바로 반격(막기 · 회피로 받아야 함)
      e.chain = 0;
      e.state = 'windup'; e.windupT = e.t = (ed.atk.windup || 0.5) * 0.7;
      e.armorT = e.t + 0.15;
      e.fv = { x: -toE.x, y: -toE.y };
      e.kx = dir.x * knock * 0.3; e.ky = dir.y * knock * 0.3;
      World.text(e.x, e.y, 26, '버팀!', '#ff8a6a');
    } else {
      e.state = 'hurt'; e.t = def.stun;
      e.kx = dir.x * knock; e.ky = dir.y * knock;
    }
  } else {
    e.kx += dir.x * knock * 0.4; e.ky += dir.y * knock * 0.4;
  }
  if (e.hp <= 0) {
    e.dying = true;
    if (ed.boss) { e.state = 'dead'; e.t = 0; }
    else { e.state = 'air'; e.vz = Math.max(e.vz, 130); e.kx = dir.x * Math.max(90, knock); e.ky = dir.y * Math.max(90, knock); }
    World.onKill(e);
  }
  // 검사 검기: 베인 상처(2026-10-25) — 4초 동안 받는 피해 +25%
  if (def.id === 'wave') { if (!(e.cutT > 0) && !e.dying) World.text(e.x, e.y, e.h + 10, '베인 상처', '#ff8a7a'); e.cutT = WAVE_CUT.t; }
  Elements.onHit(e, def, p);  // 그 기술 칸에 끼운 속성석 효과
  if (def.slot === 'basic') p.sp = Math.min(p.maxSp, p.sp + p.cls.stamina.onHit);  // 기본 공격이 맞으면 기력이 찬다
  World.combo();
  Sfx.hit(crit);
  // 타격감(2026-10-25 사용자: 봉인의 숲보다 약하다): 맞을 때마다 작은 화면 흔들림 · 큰 불꽃 · 흰 번쩍임 · 패드 진동, 치명타는 조금 더 멈춤
  const hx = e.x - toE.x * 4, hy = e.y - toE.y * 4, hz = (e.z || 0) + e.h * 0.5;
  World.sparks(hx, hy, hz, crit ? 8 : heavy ? 6 : 4, '#ffffff', true);
  World.sparks(hx, hy, hz, crit ? 8 : heavy ? 5 : 3, crit ? '#ffd34d' : '#ffe9a8', true);
  World.impact(hx, hy, hz, crit ? 14 : heavy ? 11 : 8);
  World.shake(crit ? 3 : heavy ? 2.5 : 1.5);
  if (crit) World.hitstop(0.07);
  if (!p.remote) Input.rumble(crit || heavy ? 0.5 : 0.25, crit || heavy ? 90 : 50);
  World.number(e.x, e.y, (e.z || 0) + e.h + 4, dmg, crit ? '#ffd34d' : stag > 1 ? '#7fe3ff' : '#ffffff', crit);
  return true;
}

// 몹 공격이 플레이어에 닿음. 결과: 'hit' · 'miss'(대시 무적 등). src = 공격한 몹(탄이면 탄)
// p.safe = 보스를 쓰러뜨린 뒤 무적(2026-10-25 사용자: 보스 잡고 남은 탄 · 폭발에 죽는 일 없게)
function hurtPlayer(p, src, dmgRaw, knock) {
  if (p.remote) return Coop.remoteHurt(p, src, dmgRaw, knock);  // 파티 방장: 손님 몸이 맞음 → 손님 기기에서 무적 · 피해 계산
  if (p.dead || p.safe || p.iframes > 0) return 'miss';
  const fx = p.stats.fx || {};
  // 유니크 잎사귀 방패: 준비돼 있으면 한 번 막는다
  if (fx.leaf && !(p.leafT > 0)) {
    p.leafT = UNIQUE_FX.leafCd; p.iframes = 0.4;
    World.text(p.x, p.y, 34, '잎사귀 방패', '#7dff8a');
    World.sparks(p.x, p.y, 10, 10, '#7dff8a');
    Sfx.stone();
    return 'miss';
  }
  const push = unit(p.x - src.x, p.y - src.y, { x: -p.fv.x, y: -p.fv.y });
  const K = 50 * POWER(p.prof.lv);  // 방어력 기준도 레벨 곡선(그 레벨 장비 방어력이면 비슷한 비율로 깎인다)
  let dmgBase = dmgRaw * K / (K + p.stats.def);
  if (fx.skin) dmgBase *= UNIQUE_FX.skin;                          // 굳은 피부
  if (fx.dashguard && p.guardT > 0) dmgBase *= UNIQUE_FX.dashguard;  // 잔상 보호막
  if (src && (src.chill > 0 || src.state === 'frozen') && Elements.has(p.prof, 'frost', 'p2')) dmgBase *= 0.7;  // 한기(빙결석 전설부터)
  if (p.hidden) endHide(p, '들켰다!');  // 숨은 중에 맞으면 드러남
  const dmg = Math.max(1, Math.round(dmgBase));
  p.hp -= dmg;
  p.state = 'hurt'; p.t = 0.3; p.act = null; p.charge = 0;  // 맞으면 모으던 기가 흩어진다
  p.kx = push.x * knock; p.ky = push.y * knock;
  p.iframes = 0.5;
  p.flash = 0.12;
  World.shake(2);
  Sfx.hurt();
  World.number(p.x, p.y, 30, dmg, '#ff6a5a');
  if (p.hp <= 0) downOrRevive(p);
  return 'hit';
}

// 체력이 0 이하: 유니크 두 번째 기회(던전마다 한 번)가 있으면 일어나고, 아니면 쓰러진다
function downOrRevive(p) {
  if ((p.stats.fx || {}).second && !p.revived) {
    p.revived = true; p.hp = Math.round(p.maxHp * UNIQUE_FX.secondHp); p.iframes = 2;
    World.text(p.x, p.y, 40, '두 번째 기회!', '#ff9a3a');
    World.sparks(p.x, p.y, 16, 14, '#ff9a3a');
    Sfx.levelUp();
  } else if (Coop.mateUp()) World.playerDown();  // 파티: 친구가 살아 있으면 쓰러져서 기다린다(친구가 살려 줌, 4단계)
  else World.playerDied();
}

// 함정 웅덩이 피해: 경직 없이 체력만(대시 무적 중엔 안 다침)
function hazardDamage(p, dmg, col) {
  if (p.dead || p.safe || p.iframes > 0) return;
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg; p.flash = 0.06;
  World.number(p.x, p.y, 30, dmg, col);
  if (p.hp <= 0) downOrRevive(p);
}
