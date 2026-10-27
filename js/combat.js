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
  if (def.area) return groundDist(t.x - (o.x + face.x * def.area.ahead), t.y - (o.y + face.y * def.area.ahead)) <= def.area.r + tr;  // 망치 내려찍기: 앞 바닥 타원
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
  if (e.dying || e.state === 'dead' || e.state === 'getup' || e.spawnT > 0 || untouchable(e)) return false;  // untouchable = 땅속 촉수 · 사라진 순간이동자
  if (e.ri !== undefined && World.roomOf(p) !== e.ri) return false;  // 방 하나 = 맵 하나: 다른 방 몹은 안 맞는다
  if (e.def.part === 'orb') return Raid.reflect(e);  // 레이드 공허 구슬: 어떤 공격이든 보스 쪽으로 되받아친다(피해 없음)
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
  // 끝없는 심연: 방패병 앞에서 친 공격은 튕김(경직 없음) · 보호막 사제 둘레 몹은 덜 다침 — 둘 다 청록 불꽃 · 글로 알림(자주 뜨지 않게)
  const blocked = shieldBlocks(e, p, def), warded = e.wardT > 0;
  if (blocked) dmg *= SHIELD.cut;
  if (warded) dmg *= WARD.cut;
  if ((blocked || warded) && !(e.tingT > World.time)) {
    e.tingT = World.time + 0.5;
    World.text(e.x, e.y, e.h + 8, blocked ? '팅!' : '보호막', blocked ? '#ece0cc' : '#5fe0d0');
  }
  // 레이드 보스: 껍질 '팅'(×0) · 보호막 · 단계 바뀌는 중(0) · 심장이 드러나면 더 크게(js/raid.js cut)
  const rc = ed.raid ? Raid.cut(e) : null;
  if (rc) {
    dmg *= rc[0];
    if (rc[1] && !(e.tingT > World.time)) { e.tingT = World.time + 0.5; World.text(e.x, e.y, e.h + 8, rc[1], '#ece0cc'); }
  }
  dmg = rc && !rc[0] ? 0 : Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  if (ed.raid) Raid.clamp(e);  // 한 번에 다음 단계를 건너뛰지 않게
  if (ed.dummy) Practice.add(dmg, def.slot || def.name, crit);  // 연습장 딜 측정(기술 칸, 칸이 없는 속성석 탄은 이름 — 화염구 등)
  e.flash = 0.1;
  const knock = def.knock * wk.knock * (ed.boss ? 0.25 : ed.rooted ? 0 : blocked ? 0.3 : 1);  // 촉수는 밀리지 않음
  const heavy = !blocked && (def.heavy || crit || wk.crush);  // 망치(분쇄): 모든 공격이 준비 중인 적도 끊는다(방패에 막히면 못 끊음)
  const armored = blocked || e.state === 'frozen' ||  // 얼어 있으면 맞아도 그대로(띄우기만 깬다)
    (!heavy && ((ed.superArmor && (e.state === 'windup' || e.state === 'attack' || e.state === 'charge')) || e.armorT > 0 || committed(e)));

  if (ed.rooted) {
    // 땅에 박힌 몹(촉수): 띄우기 · 경직 · 밀림 없이 피해만
  } else if (e.state === 'air' || e.state === 'down') {
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
    if (ed.boss || ed.rooted) { e.state = 'dead'; e.t = 0; }
    else { e.state = 'air'; e.vz = Math.max(e.vz, 130); e.kx = dir.x * Math.max(90, knock); e.ky = dir.y * Math.max(90, knock); }
    World.onKill(e);
  }
  // 검사 검기: 베인 상처(2026-10-25) — 4초 동안 받는 피해 +25%
  if (def.id === 'wave') { if (!(e.cutT > 0) && !e.dying) World.text(e.x, e.y, e.h + 10, '베인 상처', '#ff8a7a'); e.cutT = WAVE_CUT.t; }
  if (!blocked) Elements.onHit(e, def, p);  // 그 기술 칸에 끼운 속성석 효과(방패에 막히면 안 터짐)
  if (def.slot === 'basic') p.sp = Math.min(p.maxSp, p.sp + (wk.onHitSp || p.cls.stamina.onHit));  // 기본 공격이 맞으면 기력이 찬다(검 연계: 더)
  // 싸이(제압): 교차 베기 · 돌진 베기에 맞은 적은 잠시 무장해제 — 주는 피해가 준다(hurtPlayer)
  if (wk.disarm && !e.dying && (def.rush || (def.fin && def.slot === 'basic'))) {
    if (!(e.disarmT > 0)) World.text(e.x, e.y, e.h + 16, '무장해제', '#c8c8d8');
    e.disarmT = wk.disarm.t; e.disarmCut = wk.disarm.cut;
  }
  World.combo();
  Sfx.hit(crit);
  // 타격감(2026-10-25 사용자: 봉인의 숲보다 약하다): 맞을 때마다 작은 화면 흔들림 · 큰 불꽃 · 흰 번쩍임 · 패드 진동, 치명타는 조금 더 멈춤
  const hx = e.x - toE.x * 4, hy = e.y - toE.y * 4, hz = (e.z || 0) + e.h * 0.5;
  World.sparks(hx, hy, hz, crit ? 8 : heavy ? 6 : 4, '#ffffff', true);
  World.sparks(hx, hy, hz, crit ? 8 : heavy ? 5 : 3, blocked ? '#ece0cc' : warded ? '#5fe0d0' : crit ? '#ffd34d' : '#ffe9a8', true);
  World.impact(hx, hy, hz, crit ? 14 : heavy ? 11 : 8);
  World.shake(crit ? 3 : heavy ? 2.5 : 1.5);
  if (crit) World.hitstop(0.07);
  if (!p.remote) Input.rumble(crit || heavy ? 0.5 : 0.25, crit || heavy ? 90 : 50);
  if (dmg) World.number(e.x, e.y, (e.z || 0) + e.h + 4, dmg, crit ? '#ffd34d' : rc && rc[0] > 1 ? '#5fe0d0' : stag > 1 ? '#7fe3ff' : '#ffffff', crit || (rc && rc[0] > 1));
  return true;
}

// 몹 공격이 플레이어에 닿음. 결과: 'hit' · 'miss'(대시 무적 등). src = 공격한 몹(탄이면 탄)
// p.safe = 보스를 쓰러뜨린 뒤 무적(2026-10-25 사용자: 보스 잡고 남은 탄 · 폭발에 죽는 일 없게)
function hurtPlayer(p, src, dmgRaw, knock) {
  if (src && src.disarmT > 0) dmgRaw *= 1 - (src.disarmCut || 0);  // 싸이 무장해제된 몹(탄은 쏠 때 몹 상태를 물려받음)
  if (p.remote) return Coop.remoteHurt(p, src, dmgRaw, knock);  // 파티 방장: 손님 몸이 맞음 → 손님 기기에서 무적 · 피해 계산
  if (src && src.pct) return after(p, src, pctHurt(p, src));
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
  if (p.markT > 0) dmgBase *= RAID_RULE.markMul;  // 레이드 공허 표식
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
  return after(p, src, 'hit');
}
// 맞은 뒤 레이드 벌: src.stun = 그 초만큼 기절(돌진 짓밟기) · src.mark = 그 초만큼 공허 표식(받는 피해 ×markMul)
function after(p, src, r) {
  if (r !== 'hit' || !src || p.dead) return r;
  if (src.stun) { p.state = 'stun'; p.t = src.stun; p.act = null; p.charge = 0; World.text(p.x, p.y, 40, '기절!', '#ffd36a'); }
  if (src.mark) { p.markT = src.mark; World.text(p.x, p.y, 48, '공허 표식!', '#c06aff'); }
  return r;
}

// 최대 체력의 pct 만큼(방어 · 잎사귀 방패 무시) — 레이드 벌. src.unavoid 면 대시 무적도 무시(수정 폭발), 아니면 대시로 피함(구슬 · 파동)
function pctHurt(p, src) {
  if (p.dead || p.safe || (!src.unavoid && p.iframes > 0)) return 'miss';
  const dmg = Math.max(1, Math.round(p.maxHp * src.pct * (p.markT > 0 ? RAID_RULE.markMul : 1)));
  if (p.hidden) endHide(p, '들켰다!');
  p.hp -= dmg;
  p.state = 'hurt'; p.t = 0.3; p.act = null; p.charge = 0;
  p.iframes = 0.5; p.flash = 0.12;
  World.shake(5);
  Sfx.hurt();
  World.number(p.x, p.y, 30, dmg, '#c06aff');
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
