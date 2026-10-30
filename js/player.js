// 플레이어(검사). 상태: idle · walk · act(공격/기술) · dodge(대시) · hurt · dead
// 버튼 5개: 기본 공격(3타) · 대시(→ 공격 = 대시 찌르기) · 회전베기(누르면 바로, 2026-10-24 사용자: 길게 누르는 차지는 게임 중 사실상 못 써서) · 특수기(섬광 검기) · 물약
// fv = 바라보는 방향(길이 1). 무기 종류 · 공격 속도에 따라 동작이 빨라지거나 느려진다.
function createPlayer(prof) {
  const C = clsOf(prof);  // 검사 · 마법사
  const stats = Items.playerStats(prof);
  return {
    cls: C, prof, stats, x: 0, y: 0, z: 0, kx: 0, ky: 0, fv: { x: 0, y: 1 },
    hp: stats.hp, maxHp: stats.hp, sp: stats.sp, maxSp: stats.sp, spDelay: 0, spWarnT: 0,
    state: 'idle', t: 0, act: null, walkT: 0,
    buffer: null, bufferT: 0,
    iframes: 0, dodgeCd: 0, dodgeV: { x: 0, y: 1 }, dashAtkT: 0,
    specialCd: 0, potionCd: 0, flash: 0, dead: false, deadT: 0,
    holdT: 0, charge: 0,
  };
}

// 장비를 바꾸면 능력치 다시 계산(체력 비율 유지)
function refreshStats(p) {
  const k = p.hp / p.maxHp;
  p.stats = Items.playerStats(p.prof);
  p.maxHp = p.stats.hp;
  p.hp = Math.max(1, Math.round(p.maxHp * k));
  p.maxSp = p.stats.sp;
  p.sp = Math.min(p.sp, p.maxSp);
}

// 대시에 드는 기력(신발 '대시 기력 -%' 만큼 줄어듦)
const dashCost = p => Math.round(p.cls.dodge.cost * (1 - (p.stats.dashCost || 0) / 100));

// 기력 쓰기: 모자라면 '기력 부족'을 띄우고 false
function spend(p, n) {
  if (p.sp < n) {
    if (p.spWarnT <= 0) { World.text(p.x, p.y, 40, '기력 부족', '#7fb8ff'); p.spWarnT = 0.8; }
    return false;
  }
  p.sp -= n;
  p.spDelay = p.cls.stamina.delay;
  return true;
}

// p = 누구의 입력인가: 파티 방장 쪽 손님 몸(remote)은 손님이 보낸 스틱 값, 내 몸은 키보드 · 패드 · 터치(창이 열려 있으면 없음)
function moveInput(p) {
  if (p && p.remote) return p.rmove || null;
  if (World.inputLock) return null;
  const m = Input.move();
  if (!m.x && !m.y) return null;
  const l = Math.hypot(m.x, m.y);
  const k = Math.min(1, l) / l;
  return { x: m.x * k, y: m.y * k };
}

// 입력은 화면 프레임마다 받아 둔다(경직 · 히트스톱 중에도 다음 동작이 씹히지 않게)
function bufferPlayerInput(p) {
  for (const a of ['attack', 'dodge', 'charge', 'special']) {
    if (a === 'attack' && Coop.canRevive()) continue;  // 파티: 쓰러진 친구 옆에서는 공격 버튼 = 살리기(누르고 있기)
    if (Input.wasPressed(a)) { p.buffer = a; p.bufferT = 0.2; }
  }
  if (Input.wasPressed('potion')) p.potionReq = 0.2;  // 물약은 동작과 따로: 공격 · 대시 · 경직 중에도 바로 마신다
}
// 무기 특성(2026-10-26 사용자: 직업마다 무기 2종 차별화) — data.js WEAPON_KINDS 의 trait · 고친 값. 없으면 직업 기본값
const weaponKindOf = prof => (prof && prof.equip && prof.equip.weapon ? Items.base(prof.equip.weapon).kind : 'none');
const wkOf = p => WEAPON_KINDS[(p.stats && p.stats.kind) || weaponKindOf(p.prof)] || WEAPON_KINDS.none;
// 기력: which = 'charge' | 'special'(HUD · 설정 조작표도 이것으로)
function costOf(prof, which) {
  const C = clsOf(prof), wk = WEAPON_KINDS[weaponKindOf(prof)] || WEAPON_KINDS.none;
  if (which === 'charge') return C.charge.hide && wk.hideCost !== undefined ? wk.hideCost : C.charge.cost;
  return wk.specialCost !== undefined ? wk.specialCost : C.special.cost;
}
const specialCdOf = p => { const wk = wkOf(p); return wk.specialCd !== undefined ? wk.specialCd : p.cls.special.cd; };
// 콤보 목록: 검(경량)은 4연타(combo4, 2026-10-30) · 그 밖은 직업 기본
const comboOf = (C, wk) => (wk && wk.combo4 && C.combo4) || C.combo;
// 콤보 idx 번 기술: 마지막 타는 무기 특성 finisher 로 바뀔 수 있다(망치 = 내려찍기)
function comboDef(C, idx, wk) {
  const list = comboOf(C, wk);
  if (idx === list.length - 1 && wk && wk.finisher && C[wk.finisher]) return C[wk.finisher];
  return list[idx] || list[0];
}
// 무기별 기술(2026-10-30 사용자 A안): 망치 = 회전베기 자리 대지 강타 · 검기 자리 지진파(WEAPON_KINDS chargeDef · specialDef)
const chargeDefOf = (C, wk) => (wk && wk.chargeDef && C[wk.chargeDef]) || C.charge.def;
const specialDefOf = (C, wk) => (wk && wk.specialDef && C[wk.specialDef]) || C.special;
const dashDefOf = (C, wk) => (wk && wk.dashDef && C[wk.dashDef]) || C.dashAttack;  // 대시 → 공격: 망치 대지 충격 · 싸이 물러나며 표창 · 롯드 순간 파동 · 스태프 수호 파동
// 칸 짧은 이름(HUD · 터치 버튼 · 장비 창): 망치는 회전 → 강타 · 검기 → 지진파
function slotShortOf(prof, slot) {
  const C = clsOf(prof), wk = WEAPON_KINDS[weaponKindOf(prof)] || {};
  if (slot === 'charge' && wk.chargeDef && C[wk.chargeDef]) return C[wk.chargeDef].short;
  if (slot === 'wave' && wk.specialDef && C[wk.specialDef]) return C[wk.specialDef].short;
  return C.slotShort[slot];
}

// 동작 이름 → 기술(파티: 손님이 보낸 동작을 방장 쪽 손님 몸이 할 때). body = 그 몸(무기 특성)
function actDef(C, kind, idx, body) {
  if (kind === 'combo') return comboDef(C, idx, body ? wkOf(body) : null);
  if (kind === 'dashAtk') return dashDefOf(C, body ? wkOf(body) : null);
  if (kind === 'charge') return chargeDefOf(C, body ? wkOf(body) : null);
  if (kind === 'special') return specialDefOf(C, body ? wkOf(body) : null);
  if (kind === 'stab') return C.stab || null;         // 암살자 백스탭
  return null;
}

// ── 암살자: 그림자 숨기(2026-10-25) ── p.hidden = { t } — 몹이 나를 놓친다(world.js 목표 고르기)
function startHide(p) {
  p.hidden = { t: 0 };
  World.text(p.x, p.y, 34, '그림자 숨기', '#b9a0ff');
  World.sparks(p.x, p.y, 10, 10, '#6a4aa0');
  Sfx.dash();
}
function endHide(p, why) {
  if (!p.hidden) return;
  p.hidden = null;
  if (why) World.text(p.x, p.y, 34, why, '#b9a0ff');
}
function updateHide(p, dt) {
  const h = p.hidden, H = p.cls.charge.hide;
  const was = h.t;
  h.t += dt;
  if (was < H.ready && h.t >= H.ready && !p.remote) World.sparks(p.x, p.y, 14, 6, '#b9a0ff');  // 백스탭 준비됨
  if (H.drain) { p.sp = Math.max(0, p.sp - H.drain * dt); p.spDelay = p.cls.stamina.delay; }  // 지금은 0 — 숨는 동안 기력이 안 빠진다(2026-10-25 사용자)
  if (h.t >= H.max || (H.drain && p.sp <= 0)) endHide(p, '모습이 드러났다');
}
// 백스탭 자리: range px 안(벽 너머 제외) 가장 가까운 적의 등 뒤(그 적이 보는 쪽 반대). 등 뒤가 벽이면 옆으로 돌려 본다. 없으면 null
function behindSpot(p, range) {
  const lv = World.level;
  let tgt = null, bd = range;
  for (const e of World.enemies()) {
    if (e.dying || e.state === 'dead' || e.spawnT > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && Dungeon.los(lv, p.x, p.y - 4, e.x, e.y - 4)) { bd = d; tgt = e; }
  }
  if (!tgt) return null;
  const back = tgt.r + 9, base = Math.atan2(-(tgt.fv ? tgt.fv.y : 0), -(tgt.fv ? tgt.fv.x : 1));
  for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
    const x = tgt.x + Math.cos(base + da) * back, y = tgt.y + Math.sin(base + da) * back;
    if (Dungeon.walkable(lv, x, y, BODY_R)) return { tgt, x, y };
  }
  return null;
}
// 숨은 중 X 나 V(2026-10-25 사용자: 아무거나 눌러도): 바로 옆(stab.blink) 적이 있으면 백스탭, 없으면 표창 던지기 — 기력은 숨을 때 이미 씀
function hiddenStrike(p) {
  const C = p.cls;
  if (p.hidden.t < C.charge.hide.ready) return false;  // 숨은 지 ready 초 전에는 안 나감(연타 막기)
  endHide(p);
  const at = behindSpot(p, C.stab.blink);
  if (at) { p.fv = unit(at.tgt.x - p.x, at.tgt.y - p.y, p.fv); startAct(p, C.stab, 'stab', 0, { aimed: true, fly: [at.x, at.y], tgt: at.tgt }); }
  else startAct(p, C.charge.def, 'charge', 0);
  if (!p.remote) Input.rumble(0.5, 90);
  return true;
}
// 돌진 베기(암살자 특수): max px 안(벽 너머 제외) 가장 가까운 적 — 방향키를 누르고 있으면 그쪽 ±75° 안에서 — 을 향해 직선으로 베고 지나간다.
// 적이 없으면 보는(누른) 쪽으로 dash px. 싸이는 피해 +20%. 지나가는 동안 + 도착 뒤 safe 초 무적
function startRush(p) {
  const R = p.cls.special, wk = wkOf(p), m = moveInput(p), want = m ? unit(m.x, m.y, p.fv) : null, lv = World.level;
  let tgt = null, bd = R.max;
  for (const e of World.enemies()) {
    if (e.dying || e.state === 'dead' || e.spawnT > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d >= bd || d < 0.001 || (want && (dx * want.x + dy * want.y) / d < Math.cos(75 * Math.PI / 180))) continue;
    if (Dungeon.los(lv, p.x, p.y - 4, e.x, e.y - 4)) { bd = d; tgt = e; }
  }
  if (tgt) p.fv = unit(tgt.x - p.x, tgt.y - p.y, p.fv);
  else if (want) p.fv = want;
  const len = tgt ? Math.max(R.min, Math.min(R.max, Math.hypot(tgt.x - p.x, tgt.y - p.y) + tgt.r + R.past)) : R.dash;
  const def = wk.rush ? Object.assign({}, R, { mult: R.mult * (1 + wk.rush) }) : R;  // 싸이: 돌진 베기 피해 +20%
  startAct(p, def, 'special', 0, { len, aimed: true });
  p.iframes = p.act.s + p.act.a + R.safe;
  World.sparks(p.x, p.y, 10, 14, '#ffffff', true);
  Sfx.dash();
  if (!p.remote) Input.rumble(0.5, 100);
}

function updatePlayer(p, dt, room, gates) {
  const C = p.cls;
  p.specialCd = Math.max(0, p.specialCd - dt);
  p.rushChainT = Math.max(0, (p.rushChainT || 0) - dt);
  p.wardT = Math.max(0, (p.wardT || 0) - dt);  // 스태프 수호 파동 보호막
  p.spWarnT -= dt;
  p.spDelay -= dt;
  if (p.spDelay <= 0 && !p.dead) p.sp = Math.min(p.maxSp, p.sp + C.stamina.regen * (1 + p.stats.spRegen / 100) * dt);  // 기력 회복(갑옷 '기력 회복 속도'만큼 빠르게)
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.dashAtkT = Math.max(0, p.dashAtkT - dt);
  p.potionCd = Math.max(0, p.potionCd - dt);
  p.leafT = Math.max(0, (p.leafT || 0) - dt);    // 유니크 잎사귀 방패 다시 생기기까지
  p.guardT = Math.max(0, (p.guardT || 0) - dt);  // 유니크 잔상 보호막 남은 시간
  if (p.echo) updateEcho(p, dt);
  if (p.hidden && !p.dead && !p.remote) updateHide(p, dt);  // 방장 쪽 손님 몸은 손님이 보낸 숨기 상태만(길 · 기력은 손님 기기에서)
  p.slowT = Math.max(0, (p.slowT || 0) - dt);  // 냉기 강화 몹에게 맞으면 느려짐
  p.markT = Math.max(0, (p.markT || 0) - dt);  // 레이드 공허 표식: 받는 피해 증가(combat.js)
  p.iframes = Math.max(0, p.iframes - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.bufferT -= dt;
  if (p.bufferT <= 0) p.buffer = null;

  if (p.kx || p.ky) {
    Dungeon.move(room, p, p.kx * dt, p.ky * dt, BODY_R, false);
    const f = Math.exp(-8 * dt);
    p.kx *= f; p.ky *= f;
    if (Math.hypot(p.kx, p.ky) < 3) { p.kx = 0; p.ky = 0; }
  }
  if (p.dead) { p.deadT += dt; return; }
  if (p.potionReq > 0) { p.potionReq = drinkPotion(p) ? 0 : p.potionReq - dt; }


  switch (p.state) {
    case 'hurt':
      p.t -= dt;
      if (p.t <= 0) p.state = 'idle';
      break;
    case 'stun':  // 레이드 돌진 짓밟기: 아무것도 못 함(머리 위 별은 art.js)
      p.t -= dt; p.buffer = null;
      if (p.t <= 0) p.state = 'idle';
      break;
    case 'dodge':
      // 대시 중에 공격 = 대시 찌르기
      if (p.buffer === 'attack') { p.buffer = null; Elements.dashEnd(p); startAct(p, dashDefOf(C, wkOf(p)), 'dashAtk', 0); break; }
      p.t -= dt;
      if (p.blink) {  // 롯드: 대시 = 순간이동 — 첫 프레임에 한 번에(벽에서 멈춤), 떠난 자리 · 닿은 자리에 반짝임 + 지나간 길 그림
        const x0 = p.x, y0 = p.y, n = 8, step = p.blink / n;
        for (let i = 0; i < n; i++) Dungeon.move(room, p, p.dodgeV.x * step, p.dodgeV.y * step, BODY_R, gates);
        World.sparks(x0, y0, 10, 10, '#c9b8ff', true); World.sparks(p.x, p.y, 10, 12, '#ffffff', true);
        World.fx({ type: 'shadowpath', pts: [[x0, y0]], follow: p, w: 6, t: 0, life: 0.25, col: '#c9b8ff' });
        Elements.dashMove(p, p.blink); p.blink = 0;
      } else if (!p.blinked) {
      Dungeon.move(room, p, p.dodgeV.x * C.dodge.speed * dt, p.dodgeV.y * C.dodge.speed * dt, BODY_R, gates);
      Elements.dashMove(p, C.dodge.speed * dt);  // 대시 칸 속성석: 지나간 길
      }
      if (p.t <= 0) { p.state = 'idle'; p.blinked = false; p.dashAtkT = C.dodge.attackWindow; Elements.dashEnd(p); }
      break;
    case 'act':
      updateAct(p, dt, room);
      break;
  }
  if (p.state === 'idle' || p.state === 'walk') freeControl(p, dt, room, gates);
}

function freeControl(p, dt, room, gates) {
  if (p.buffer && tryStart(p, p.buffer)) return;
  const m = moveInput(p);
  if (m) {
    const sp = p.cls.speed * (1 + p.stats.move / 100) * (p.charge > 0 ? p.cls.charge.move : 1) * (p.slowT > 0 ? 0.6 : 1) * (p.hidden ? wkOf(p).hideMove || p.cls.charge.hide.move : 1);  // 카타르: 숨은 동안 빠르게
    Dungeon.move(room, p, m.x * sp * dt, m.y * sp * dt, BODY_R, gates);
    p.fv = unit(m.x, m.y, p.fv);
    p.state = 'walk';
    p.walkT += dt;
  } else p.state = 'idle';
}

function tryStart(p, b) {
  const C = p.cls;
  p.buffer = null;
  if (b === 'attack') {
    if (p.hidden) return hiddenStrike(p);  // 암살자: 숨은 중 공격 = 백스탭 · 표창
    if (p.dashAtkT > 0) { p.dashAtkT = 0; startAct(p, dashDefOf(C, wkOf(p)), 'dashAtk', 0); }  // 대시 끝난 직후도 대시 찌르기
    else startAct(p, comboDef(C, 0, wkOf(p)), 'combo', 0);
    return true;
  }
  if (b === 'dodge') {
    // 쿨타임 없음(2026-10-24 사용자: 기력이 있으니까) — 대시가 끝나면 기력만 있으면 바로 또
    if (p.dodgeCd > 0 || !spend(p, dashCost(p))) return false;
    const m = moveInput(p);
    startDodge(p, m ? unit(m.x, m.y, p.fv) : { x: p.fv.x, y: p.fv.y });
    return true;
  }
  if (b === 'charge' && C.charge.hide && !wkOf(p).chargeDef) {  // (싸이는 숨기 대신 칼날 폭풍 — 아래 일반 차지)  // 암살자: 숨기 → 다시 누르면 바로 옆 적에게 백스탭, 없으면 표창(기력은 숨을 때만)
    if (p.hidden) return hiddenStrike(p);
    if (!spend(p, costOf(p.prof, 'charge'))) return false;
    startHide(p);
    return true;
  }
  if (b === 'charge') {  // 회전베기 · 마법진: 누르면 바로(기력 cost)
    // 마법진은 한 번에 하나만(2026-10-24 사용자) — 깔린 것이 터지기 전에는 못 깐다(기력도 안 씀)
    if (C.charge.def.circle && World.magicActive()) { if (p.spWarnT <= 0) { World.text(p.x, p.y, 40, '마법진이 이미 있어요', '#c9b8ff'); p.spWarnT = 0.6; } return false; }
    if (!spend(p, costOf(p.prof, 'charge'))) return false;
    startAct(p, chargeDefOf(C, wkOf(p)), 'charge', 0);
    if (!p.remote) Input.rumble(0.35, 60);
    return true;
  }
  if (b === 'special') {
    const wk = wkOf(p), chain = C.special.rush && wk.rushChain && p.rushChainT > 0;  // 싸이: 돌진 베기 뒤 잠깐 동안 한 번 더(기력 · 쿨타임 없이, 한 번만)
    if (!chain && (p.specialCd > 0 || !spend(p, costOf(p.prof, 'special')))) return false;
    if (!chain) p.specialCd = specialCdOf(p);
    endHide(p);
    if (C.special.rush) {  // 암살자 돌진 베기
      startRush(p);
      p.rushChainT = !chain && wk.rushChain ? p.act.s + p.act.a + p.act.r + wk.rushChain : 0;
      if (chain) World.text(p.x, p.y, 40, '연속 돌진!', '#c8c8d8');
    } else startAct(p, specialDefOf(C, wk), 'special', 0);
    return true;
  }
  return false;
}

// 대시 시작(dir 쪽으로). 파티 방장 쪽 손님 몸도 손님이 보낸 방향으로 이걸 부른다
function startDodge(p, dir) {
  const C = p.cls;
  p.dodgeV = dir;
  p.fv = p.dodgeV;
  p.state = 'dodge'; p.act = null;
  p.t = C.dodge.time;
  const bd = wkOf(p).blinkDodge;  // 롯드: 대시 = 순간이동(짧게 머문 뒤 바로 대시 공격 가능)
  if (bd) { p.blink = bd; p.blinked = true; p.t = 0.1; }
  p.iframes = C.dodge.iframes;
  p.dodgeCd = C.dodge.time;  // 지금 대시가 끝날 때까지만 막는다
  p.guardT = C.dodge.time + UNIQUE_FX.dashguardT;
  p.charge = 0;
  Elements.dashStart(p);  // 대시 칸 속성석
  Sfx.dash();
  if (World.mirror && p === World.player) Coop.sendAct({ k: 'dodge', x: p.x, y: p.y, fx: dir.x, fy: dir.y });  // 파티 손님: 방장 쪽 내 몸도 대시
}

function updateEcho(p, dt) {
  const ec = p.echo;
  ec.t += dt;
  if (ec.t < 0.12 * (ec.n + 1)) return;
  ec.n++;
  for (const e of ec.targets) {
    if (e.dying || e.state === 'dead') continue;
    if (hitEnemy(e, ec.def, p)) World.sparks(e.x, e.y - e.h * 0.5, 6, 8, '#ffe8a0');
  }
  if (ec.n >= UNIQUE_FX.echoHits) p.echo = null;
}

function drinkPotion(p) {
  const prof = p.prof, C = p.cls;
  if (prof.potions <= 0 || p.potionCd > 0 || p.hp >= p.maxHp) return false;
  prof.potions--;
  p.potionCd = C.potion.cd;
  const heal = Math.min(Math.round(p.maxHp * C.potion.heal), p.maxHp - p.hp);
  p.hp += heal;
  Sfx.potion();
  World.text(p.x, p.y, 34, '+' + heal, '#7dff8a');
  return true;
}

// 자동 조준(2026-10-24 사용자: 자동 전진은 빼고 조준은 넣기): 공격을 시작할 때 가까운 몹 쪽으로 몸을 돌린다.
// 방향을 안 누르면 둘레(사거리 + AIM_EXTRA) 안 가장 가까운 몹, 누르고 있으면 그 방향 ±75° 안에서 가장 가까운 몹
const AIM_EXTRA = 40;
function aimAt(p, reach) {
  const m = moveInput(p);
  const want = m ? unit(m.x, m.y, p.fv) : p.fv;
  let best = null, bestD = 1e9;
  for (const e of World.enemies()) {
    if (e.dying || e.state === 'dead' || e.spawnT > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > reach + AIM_EXTRA || d < 0.001) continue;
    if (m && (dx * want.x + dy * want.y) / d < Math.cos(75 * Math.PI / 180)) continue;
    if (d < bestD) { bestD = d; best = { x: dx / d, y: dy / d }; }
  }
  p.fv = best || want;
}

// 마법사 마력 숨결: 기본 칸 속성석 크기(조각 1 ~ 태초 7)마다 길이 +5% · 반각 +2°(태초 = 길이 +35% · 폭 +14° 양쪽)
function breathOf(p, hd) {
  const st = Elements.socket(p.prof, 'basic'), n = st ? st.size + 1 : 0;
  hd.reach = [hd.reach[0], hd.reach[1] * (1 + 0.05 * n) * (wkOf(p).breath || 1)];  // 스태프(광역): 숨결 길이 +15%
  hd.arc += 2 * n;
}

// o = { len: 돌진 베기 거리, aimed: 이미 방향을 정함, fly: 백스탭으로 날아갈 자리 [x, y], tgt: 백스탭 대상 } — len · fly 는 파티 손님이면 방장 쪽 몸에도 같이 보낸다
function startAct(p, def, kind, idx, o = {}) {
  const wk = wkOf(p);
  // 카타르(암습): 숨은 뒤 첫 공격(백스탭 · 표창)은 언제나 치명타
  if (wk.ambush && (kind === 'stab' || (kind === 'charge' && def.knives))) def = Object.assign({}, def, { crit: true });
  if (kind === 'stab' && wk.stabMul) def = Object.assign({}, def, { mult: def.mult * wk.stabMul });  // 카타르: 백스탭 더 세게
  // 롯드 · 스태프: 마력탄 빠르기 · 사거리
  if (def.orb && wk.orb) def = Object.assign({}, def, { orb: Object.assign({}, def.orb, wk.orb) });
  const sp = wk.speed * (1 + p.stats.aspd / 100);
  // 무기에 맞춘 판정
  const hd = Object.assign({}, def);
  if (def.reach) hd.reach = [def.reach[0], def.reach[1] + wk.reach];
  // 전기 칼날(2026-10-29): 기본 칸에 보통 이상 뇌전석이면 기본 공격 길이 × THUNDER.blade — 칼 궤적 · 찌르기 그림도 hd.reach 를 따라 같이 길어진다(이펙트 범위 = 판정 범위)
  if (hd.reach && def.slot === 'basic' && Elements.blade(p.prof)) hd.reach = [hd.reach[0], hd.reach[1] * THUNDER.blade];
  if (def.arc) hd.arc = Math.min(170, def.arc * wk.arc);
  if (def.radius) hd.radius = def.radius + wk.reach * 0.5;
  if (def.breath) breathOf(p, hd);
  // 검사 회전베기(차지 칸 둘레 공격): 차지 칸 속성석 크기(조각 1 ~ 태초 7)마다 반지름 +5%(태초 44 → 약 59, 2026-10-26 사용자) — 고리 그림도 hd.radius 를 따름
  if (def.spin && def.slot === 'charge') { const st = Elements.socket(p.prof, 'charge'); if (st) hd.radius *= 1 + 0.05 * (st.size + 1); }
  // 망치 대지 강타: 회전베기처럼 차지 칸 속성석 크기마다 넓게 — 충격파 그림도 hd.area 를 따름
  if (def.area && def.slot === 'charge') { const st = Elements.socket(p.prof, 'charge'); hd.area = { ahead: def.area.ahead, r: def.area.r * (st ? 1 + 0.05 * (st.size + 1) : 1) }; }
  if (kind !== 'dashAtk' && !o.aimed) aimAt(p, def.circle ? def.circle.range : def.orb ? def.orb.range * 0.7 : def.wave ? def.wave.range * 0.6 : def.quake ? def.quake.range * 0.6 : def.knives ? def.knives.range * 0.8 : def.area ? def.area.ahead + def.area.r : def.radius || hd.reach[1]);  // 대시 찌르기는 대시한 방향 그대로 · 검기는 멀리까지
  p.state = 'act';
  p.act = {
    def, hd, kind, idx, time: 0, hit: new Set(), wave: -1, fxDone: false, x0: p.x, y0: p.y,
    push: !!moveInput(p),  // 방향키를 누른 채 공격하면 그쪽으로 내딛는다(중립이면 제자리)
    s: def.startup / sp, a: def.active / sp, r: def.recovery / sp,
    len: o.len, fly: o.fly ? { x0: p.x, y0: p.y, x1: o.fly[0], y1: o.fly[1], tgt: o.tgt || null } : null,
  };
  if (def.iframes) p.iframes = p.act.s + p.act.a + 0.05;
  if (def.orb) Sfx.cast();  // 마력탄: 마법 소리(2026-10-25)
  else if (def.heavy || def.spin) Sfx.heavySwing(); else Sfx.swing();
  // 파티 손님: 방장 쪽 내 몸도 같은 동작을(맞히기 · 속성석 효과는 거기서)
  if (World.mirror && p === World.player) Coop.sendAct({ k: kind, i: idx, x: p.x, y: p.y, fx: p.fv.x, fy: p.fv.y, push: p.act.push ? 1 : 0,
    len: o.len, fly: o.fly && o.fly.map(Math.round) });
}

function updateAct(p, dt, room) {
  const C = p.cls, a = p.act, d = a.def;
  a.time += dt;
  const tA = a.s, tB = a.s + a.a, tEnd = tB + a.r;
  // 백스탭: 준비 동안 대상 등 뒤로 날아간다(벽 · 몸 무시 — 자리는 미리 걸을 수 있는 곳으로 골라 둠), 도착하면 대상을 본다
  if (a.fly && !a.fly.done) {
    const f = a.fly, k = Math.min(1, a.time / Math.max(0.001, a.s));
    p.x = f.x0 + (f.x1 - f.x0) * k; p.y = f.y0 + (f.y1 - f.y0) * k;
    if (k >= 1) { f.done = true; if (f.tgt && !f.tgt.dying) p.fv = unit(f.tgt.x - p.x, f.tgt.y - p.y, p.fv); World.sparks(p.x, p.y - 8, 12, 14, '#b9a0ff', true); }
  }
  // 롯드: 마력탄을 쏘는 동안에도 걸을 수 있다(느리게, 보는 쪽은 그대로)
  if (d.orb && wkOf(p).castMove) { const m = moveInput(p); if (m) { const sp = p.cls.speed * (1 + p.stats.move / 100) * wkOf(p).castMove; Dungeon.move(room, p, m.x * sp * dt, m.y * sp * dt, BODY_R, false); } }
  // 싸이 물러나며 표창: 기술 동안 뒤로 빠진다
  if (d.backstep && a.time < tB) Dungeon.move(room, p, -p.fv.x * d.backstep / tB * dt, -p.fv.y * d.backstep / tB * dt, BODY_R, false);
  if (a.time < tB) {
    let v = 0;
    if (d.dash) { if (a.time >= tA) v = (a.len || d.dash) / a.a; }  // 돌진 베기는 그 적까지 거리(a.len)
    // 기본 공격 내딛기(lunge): 방향키를 누르고 있을 때만(2026-10-24 사용자: 중립이면 제자리, 누르면 그쪽으로 전진)
    else if (d.lunge && a.push) v = d.lunge / tB;
    if (v) Dungeon.move(room, p, p.fv.x * v * dt, p.fv.y * v * dt, BODY_R, false);
  }
  if (!a.fxDone && a.time >= tA) {
    a.fxDone = true;
    if (d.dash) World.fx({ type: 'streak', x0: a.x0, y0: a.y0, follow: p, t: 0, life: 0.25 });
    if (d.area) {  // 망치 내려찍기: 판정 타원 그대로 충격파(art.js nova) + 흙먼지
      const ar = a.hd.area, st = Elements.socket(p.prof, d.slot), x = p.x + p.fv.x * ar.ahead, y = p.y + p.fv.y * ar.ahead;
      World.fx({ type: 'nova', x, y, r: ar.r, col: st ? ELEMENTS[st.el].color : '#e8dcc0', el: st ? st.el : '', tier: Elements.tier(st), ss: Elements.ss(st, p.prof), bare: true, seed: Math.random() * 1000, t: 0, life: 0.4 });
      World.fx({ type: 'shock', x, y, r: ar.r, t: 0, life: 0.3 });
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; World.fx({ type: 'dust', x: x + Math.cos(an) * ar.r * 0.6, y: y + Math.sin(an) * ar.r * 0.6 * GROUND_Y, vx: Math.cos(an) * 20, vy: Math.sin(an) * 10, vz: 12, t: 0, life: 0.4 }); }
      World.shake(3);
    }
    // 망치(분쇄): 기본 공격마다 앞 바닥 작은 충격파 — 판정 타원 = 그림(nova · shock), 칼에 맞은 적도 충격파에 한 번 더(속성석 효과는 칼만)
    const sh = wkOf(p).shockHit;
    if (sh && a.kind === 'combo' && !d.area) {
      const x = p.x + p.fv.x * sh.ahead, y = p.y + p.fv.y * sh.ahead;
      World.fx({ type: 'nova', x, y, r: sh.r, col: '#e8dcc0', el: '', tier: 0, ss: 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.3 });
      World.fx({ type: 'shock', x, y, r: sh.r, t: 0, life: 0.25 });
      const sd = { name: '충격파', mult: d.mult * sh.mult, knock: 60, stun: 0.2 };
      for (const e of World.enemies()) if (groundDist(e.x - x, e.y - y) <= sh.r + e.r && (e.z || 0) <= AIR_REACH) hitEnemy(e, sd, p);
    }
    // 찌르기 · 띠 판정(noBody: 대시 찌르기 · 돌진 베기)은 판정 모양 그대로 찌르는 빛(art.js fx 'thrust'), 백스탭은 판정 부채꼴 그대로 큰 베기(fx 'sweep').
    // 그 칸 속성석 색 · 단계(2026-10-26 이펙트 범위 = 판정 범위)
    if (((d.thrust || d.noBody) && a.hd.reach) || a.kind === 'stab') {
      const st = Elements.socket(p.prof, d.slot || 'none'), o = { follow: p, a: Math.atan2(p.fv.y, p.fv.x), R: a.hd.reach[1], t: 0,
        col: st ? ELEMENTS[st.el].color : a.kind === 'stab' ? '#b9a0ff' : '#dfe6ff', tier: Elements.tier(st), el: st ? st.el : '', ss: Elements.ss(st, p.prof) };
      if (a.kind === 'stab') World.fx(Object.assign(o, { type: 'sweep', arc: a.hd.arc, life: a.a + 0.16 }));
      else World.fx(Object.assign(o, { type: 'thrust', arc: d.noBody ? 0 : a.hd.arc, band: d.noBody ? 10 : 0, life: a.a + 0.1 }));
    }
    if (d.spin) {  // 그림 단계 · 속성: 그 칸 속성석(art.js fx 'ring')
      const st = Elements.socket(p.prof, d.slot || 'none');
      World.fx({ type: 'ring', follow: p, r: a.hd.radius, t: 0, life: 0.3, col: Elements.color(p.prof, d.slot || 'none'), tier: Elements.tier(st), el: st ? st.el : '', ss: Elements.ss(st, p.prof) });
    }
    if (a.kind === 'charge' && !d.circle && !d.knives) Elements.chargeBurst(p, d.spin ? a.hd.radius : a.hd.area ? a.hd.area.r : 0);  // 회전베기 · 대지 강타: 속성 범위 = 베기 · 충격파 범위
    if (a.kind === 'stab') Elements.chargeBurst(p);  // 백스탭도 차지 칸 속성석 폭발(대상 등 뒤 자리에서)
    if (a.fly) World.fx({ type: 'shadowpath', pts: [[a.fly.x0, a.fly.y0]], follow: p, w: 8, t: 0, life: 0.3, col: '#b9a0ff' });  // 날아온 길  // 회전베기 칸 속성석: 둘레 폭발(마법진은 터질 때 그 자리에서)
    if (d.pulse) World.fx({ type: 'pulse', x: p.x, y: p.y, r: a.hd.radius, t: 0, life: 0.3, col: Elements.color(p.prof, 'dash') });
    if (d.ward) { p.wardT = d.ward.t; p.wardCut = d.ward.cut; World.text(p.x, p.y, 40, '보호막', '#9ad8ff'); }  // 스태프 수호 파동: 받는 피해 -cut(art.js 몸 둘레 빛 막)
    // 마력탄: 가볍게 따라가는 빛 구슬, 처음 닿은 적에서 터진다(마력탄 칸 속성석 색).
    // 그림 단계 tier(2026-10-26 사용자: 속성석 레벨에 따라 멋져지게, 구간마다): 0 = 없음 · 조각 · 작은 / 1 = 보통 · 큰 / 2 = 완전한 / 3 = 전설 · 태초(art.js orb)
    if (d.orb) {
      const st = Elements.socket(p.prof, 'wave'), tier = Elements.tier(st), wk = wkOf(p), vol = wk.orbVolley;
      // 롯드: 세 발을 조금씩 벌려 한꺼번에(한 발 배율은 줄임) · 스태프: 느리고 큰 운석(meteor — 맞은 자리에서 크게 터짐, orbBurst)
      const n = vol ? vol.n : 1, a0 = Math.atan2(p.fv.y, p.fv.x);
      for (let i = 0; i < n; i++) {
      const mid = i === (n - 1) >> 1, od = vol ? Object.assign({}, d, { mult: d.mult * vol.mult, noEl: !mid }) : d;  // 속성석 효과는 가운데 한 발만
      const ang = a0 + (i - (n - 1) / 2) * (vol ? vol.spread : 0) * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang);
      World.playerShot({ x: p.x + ux * 8, y: p.y + uy * 8, vx: ux * d.orb.speed, vy: uy * d.orb.speed, left: d.orb.range, r: d.orb.r,
        ball: true, orb: true, once: true, homing: true, def: od, hit: new Set(), stone: st, col: st ? ELEMENTS[st.el].color : wk.meteor ? '#ff9a5a' : '#b39cff', meteor: !!wk.meteor,
        tier, el: st ? st.el : '', ss: Elements.ss(st, p.prof),
        onEnd: s => {
          World.sparks(s.x, s.y - 8, 8, 10 + tier * 6, s.col, tier >= 2);
          const ob = wkOf(p).orbBurst;  // 스태프(광역): 맞은 자리에서 작게 터진다(바닥 타원 r — 그림 = 판정)
          if (ob && s.hit.size) {
            World.fx({ type: 'nova', x: s.x, y: s.y, r: ob.r, col: s.col, el: s.el || '', tier, ss: s.ss || 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.35 });
            const bd = { name: wk.meteor ? '운석' : '마력 폭발', mult: d.mult * ob.mult, knock: wk.meteor ? 140 : 50, stun: wk.meteor ? 0.45 : 0.2 };
            for (const e of World.enemies()) if (!s.hit.has(e) && groundDist(e.x - s.x, e.y - s.y) <= ob.r + e.r) hitEnemy(e, bd, p);
          }
          if (tier) World.fx({ type: 'pulse', x: s.x, y: s.y, r: 12 + tier * 5, t: 0, life: 0.25 + tier * 0.05, col: s.col });
          if (!od.noEl) Elements.waveEnd(s, p);
        } });
      }
    }
    // 표창 던지기(암살자): 단검 n 개를 부채꼴로, 단검마다 처음 닿은 적에서 사라진다. 차지 칸 속성석 폭발은 처음 맞은 자리에서 한 번
    if (d.knives) {
      const K = d.knives, a0 = Math.atan2(p.fv.y, p.fv.x), burst = { done: false };
      for (let i = 0; i < K.n; i++) {
        const ang = a0 + (i - (K.n - 1) / 2) * K.spread * Math.PI / 180;
        World.playerShot({ x: p.x + Math.cos(ang) * 8, y: p.y + Math.sin(ang) * 8, vx: Math.cos(ang) * K.speed, vy: Math.sin(ang) * K.speed, left: K.range, r: K.r,
          ball: true, knife: true, once: true, def: d, hit: new Set(),
          onEnd: s => {
            World.sparks(s.x, s.y - 8, 4, 8, '#e8ecf4');
            if (s.hit.size && !burst.done && d.slot === 'charge') { burst.done = true; Elements.chargeBurst(Object.assign(Object.create(p), { x: s.x, y: s.y })); }  // 차지 칸 표창만(싸이 대시 표창은 대시 칸 효과)
          } });
      }
    }
    // 마법진: 겨눈 적 발밑(사거리 안) · 없으면 앞에 깔고, 잠시 뒤 터진다(world.js updateFields)
    if (d.circle) {
      const c = d.circle, tgt = World.enemies().filter(e => !e.dying && e.state !== 'dead' && !(e.spawnT > 0) && Math.hypot(e.x - p.x, e.y - p.y) <= c.range)
        .sort((u, v) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y))
        .find(e => ((e.x - p.x) * p.fv.x + (e.y - p.y) * p.fv.y) >= 0);
      const st = Elements.socket(p.prof, 'charge');  // 그림 단계 · 속성(art.js magicCircle · fx 'nova')
      const mf = { magic: true, x: tgt ? tgt.x : p.x + p.fv.x * c.ahead, y: tgt ? tgt.y : p.y + p.fv.y * c.ahead, r: wkOf(p).circleR || c.r, delay: c.delay, life: c.delay + 0.4,  // 스태프(광역): 반지름 59(1.4배)
        def: d, p, col: st ? ELEMENTS[st.el].color : '#b39cff', tier: Elements.tier(st), el: st ? st.el : '', ss: Elements.ss(st, p.prof) };
      if (d.trio) {  // 롯드 삼중 마법진: 작은 마법진 셋이 바라보는 쪽으로 step 씩 줄지어 gap 초씩 차례로 터진다
        for (let i = 0; i < d.trio.n; i++) World.field(Object.assign({}, mf, { x: mf.x + p.fv.x * d.trio.step * i, y: mf.y + p.fv.y * d.trio.step * i, delay: c.delay + d.trio.gap * i, life: c.delay + d.trio.gap * i + 0.4 }));
      } else World.field(mf);
      const tw = wkOf(p).circleTwice;  // 스태프: 같은 자리에서 한 번 더 터짐(그림도 다시 — 마법진이 다시 그려진다)
      if (tw) World.field(Object.assign({}, mf, { delay: c.delay + tw.delay, life: c.delay + tw.delay + 0.4, def: Object.assign({}, d, { mult: d.mult * tw.mult }) }));
    }
    // 마법사 마력 숨결: 지팡이 앞으로 퍼지는 부채꼴 빛(기본 칸 속성석 색). 칸 능력은 맞을 때(Elements.breathHit)
    if (d.breath) {  // 그림 단계 · 속성: 기본 칸 속성석(art.js fx 'breath')
      const st = Elements.socket(p.prof, 'basic');
      World.fx({ type: 'breath', follow: p, a: Math.atan2(p.fv.y, p.fv.x), R: a.hd.reach[1], arc: a.hd.arc, big: !!d.fin, seed: Math.random() * 1000, t: 0, life: a.a + 0.3,
        col: st ? ELEMENTS[st.el].color : '#c9b8ff', tier: Elements.tier(st), el: st ? st.el : '', ss: Elements.ss(st, p.prof) });
    }
    else if (d.slot === 'basic') Elements.basicSwing(p, d);   // 기본 칸 속성석(보통부터): 화염구 · 얼음 파편 · 독 분사
    // 검기: 앞으로 날아가며 꿰뚫는다. 가까이서 칼에 맞은 몹은 검기에 또 맞지 않게 같은 목록을 쓴다
    // 검(연격): 검기 두 줄(양옆으로 gap 씩, 한 줄 배율은 줄임 — 줄마다 따로 맞음)
    const tw2 = wkOf(p).twinWave;
    if (d.wave) for (const off of tw2 ? [-tw2.gap, tw2.gap] : [0]) World.playerShot({ x: p.x + p.fv.x * 8 - p.fv.y * off, y: p.y + p.fv.y * 8 + p.fv.x * off, vx: p.fv.x * d.wave.speed, vy: p.fv.y * d.wave.speed,
      left: d.wave.range, r: d.wave.r, def: tw2 ? Object.assign({}, d, { mult: d.mult * tw2.mult, noEl: off > 0 }) : d,  // 두 줄 중 한 줄만 속성석 효과
      hit: tw2 ? new Set(a.hit) : a.hit, stone: Elements.socket(p.prof, 'wave'), col: Elements.color(p.prof, 'wave') });
    // 망치 지진파: 땅을 타고 가며 꿰뚫는다(ground = 바닥 타원 판정, art.js quake 그림과 같은 크기)
    if (d.quake) World.playerShot({ x: p.x + p.fv.x * 10, y: p.y + p.fv.y * 10, vx: p.fv.x * d.quake.speed, vy: p.fv.y * d.quake.speed,
      left: d.quake.range, r: d.quake.r, quake: true, ground: true, def: d, hit: a.hit, stone: Elements.socket(p.prof, 'wave'), col: Elements.color(p.prof, 'wave', '#c8a878') });
  }
  if (a.time >= tA && a.time < tB) {
    if (d.hits) {
      const w = Math.floor((a.time - tA) / (a.a / d.hits));
      if (w !== a.wave) { a.wave = w; a.hit.clear(); }
    }
    let landed = false;
    for (const e of World.enemies()) {
      if (!a.hd.reach && !a.hd.radius && !a.hd.area) break;  // 마력탄 · 마법진 · 표창: 몸 판정 없음
      if (a.hit.has(e) || !inHitbox(p, p.fv, a.hd, e, e.r)) continue;
      if (d.breath && !Dungeon.los(World.level, p.x, p.y - 4, e.x, e.y - 4)) continue;  // 숨결은 벽 너머로 안 닿는다
      if (hitEnemy(e, d, p)) { a.hit.add(e); landed = true; if (d.breath) Elements.breathHit(e, d, p); }
    }
    // 유니크 잔상 일격: 3타째가 맞으면 잔상이 같은 적을 더 친다
    if (landed && d.fin && p.stats.fx.echo && !p.echo) p.echo = { t: 0, n: 0, targets: [...a.hit], def: Object.assign({}, d, { mult: d.mult * UNIQUE_FX.echoMult, knock: 30, stun: 0.2, heavy: false }) };
    if (landed) {
      World.hitstop(d.heavy ? 0.08 : 0.045);
      if (d.heavy) World.shake(2);
    }
  }
  // 후딜에서 다음 콤보 · 특수기 · 대시로 끊을 수 있다
  if (a.time >= tB) {
    const b = p.buffer;
    if (b === 'attack' && a.kind === 'combo' && a.idx < comboOf(C, wkOf(p)).length - 1) {
      p.buffer = null;
      startAct(p, comboDef(C, a.idx + 1, wkOf(p)), 'combo', a.idx + 1);
      return;
    }
    if (b && b !== 'attack' && tryStart(p, b)) return;
  }
  if (a.time >= tEnd) { p.state = 'idle'; p.act = null; }
}
