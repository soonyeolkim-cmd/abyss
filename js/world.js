// 던전 한 번 들어갔다 나오기(런) — 디아블로식: 이어진 넓은 층을 카메라가 따라가며 탐험한다.
// 몹은 방마다 무리로 자고 있다가 깨어나고(정예 · 고유 몹 포함), 가장 큰 방에 보스가 있다. 보스를 잡으면 상자 + 계단.
const World = (() => {
  let lv = null, p = null, prof = null, dIdx = 0;
  let enemies = [], shots = [], pshots = [], fx = [], texts = [], fields = [];  // shots = 몹 탄, pshots = 플레이어 검기
  let hitstopT = 0, shakeT = 0, time = 0, storyT = 0;  // storyT = 보스를 쓰러뜨리고 이야기가 나올 때까지
  let comboN = 0, comboT = 0, msg = null, msgT = 0, bagFullT = 0;
  let run = null, ended = null, bossAwake = false;
  let flow = null, flowT = 0, lastTile = -1;
  const cam = { x: 0, y: 0 };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dlv = () => lv.def.lv;
  const packAdd = () => Math.min(dIdx, 5);  // 뒤 던전일수록 무리가 크다(용암 지옥 +5 에서 멈춤)

  // 씨앗으로 정해지는 무작위(파티: 방장과 손님이 같은 씨앗이면 같은 층 · 같은 몹 배치). fn 동안만 Math.random 을 바꿔 둔다
  function seeded(seed, fn) {
    const orig = Math.random;
    let s = seed >>> 0;
    Math.random = () => {  // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { return fn(); } finally { Math.random = orig; }
  }
  let partySeed = 0;  // 파티로 들어온 던전이면 그 씨앗(혼자면 0)

  // ── 파티 같이 싸우기(3단계, 2026-10-25) ──
  // 방장: 몹 · 탄 · 장판 · 속성석 효과를 모두 계산한다. 손님 몸 rp(remote) = 손님 장비로 만든 플레이어 — 손님이 보낸 위치 · 동작으로 움직이고
  //   손님 공격도 방장 쪽에서 rp 로 다시 휘둘러 맞힌다(속성석 효과가 똑같이). 몹은 가까운 사람을 노리고, rp 가 맞으면 손님에게 알린다(손님 쪽에서 무적 · 피해 계산).
  // 손님(mirror): 몹 계산을 안 하고 방장이 1초 20번 보내는 몹 · 탄 · 장판(snap)을 따라 그린다. 자기 이동 · 대시 · 동작은 바로, 맞히기는 방장이.
  //   몹이 쓰러질 때마다 방장이 알려 주면(kill) 손님 쪽에서 자기 경험치 · 전리품을 굴린다(전리품은 각자 따로 보임).
  // actor = 지금 계산 중인 쪽(rp 이면 화면 흔들림 · 히트스톱은 방장 화면 대신 손님에게)
  let rp = null, mirror = false, actor = null, nextId = 1, flow2 = null;
  const byId = new Map();
  function addEnemy(e) { e.id = nextId++; byId.set(e.id, e); enemies.push(e); return e; }
  const actorRemote = () => !!(actor && actor.remote);
  // 방장 → 손님 효과 알림(손님 가까이에서 생긴 것만)
  function emit(ev, x, y) {
    if (!rp || mirror) return;
    if (x !== undefined && (Math.abs(x - rp.x) > 360 || Math.abs(y - rp.y) > 240)) return;
    Coop.queue(ev);
  }

  function start(def, profile, diff = 0, seed = 0) {
    RUN.diff = diff;
    RUN.ease = def.ease || null;  // 던전마다 몹 세기 낮춤(역병 하수도 2026-10-25)
    RUN.party = seed ? PARTY_HP : 1;  // 파티면 몹 · 보스 체력 ×1.6(★ 규칙)
    partySeed = seed;
    mirror = !!seed && Net.role === 'guest';
    actor = null; nextId = 1; byId.clear(); flow2 = null;
    lv = seed ? seeded(seed, () => Dungeon.generate(def)) : Dungeon.generate(def);
    lv.ilvlR = diffIlvl(def, diff);  // 난이도에 따른 장비 레벨 범위
    dIdx = DUNGEONS.indexOf(def);
    prof = profile;
    p = createPlayer(prof);
    p.x = lv.start.cx * T + 8; p.y = lv.start.cy * T + 12;
    run = { gold: 0, exp: 0, items: [], kills: 0, levelUps: 0, dungeon: def, diff };
    Game.setRun(run);
    ended = null; bossAwake = false;
    enemies = []; shots = []; pshots = []; fx = []; texts = []; fields = [];
    Elements.reset();
    hitstopT = 0; shakeT = 0; time = 0; storyT = 0; comboN = 0; flow = null; flowT = 0; lastTile = -1;
    if (seed) seeded(seed + 7, () => { populate(); placeHazards(); });
    else { populate(); placeHazards(); }
    // 방장: 손님 몸(손님이 보낸 장비로). 처음 자리는 내 옆, 손님 위치가 오면 그리로
    rp = seed && Net.role === 'host' ? Coop.remotePlayer() : null;
    if (rp) { rp.x = p.x + 14; rp.y = p.y; }
    msg = def.name + (diff ? ' · ' + DIFFS[diff].name : ''); msgT = 2.4;
  }
  // 방장: 손님이 던전을 나감 · 끊김 → 손님 몸을 뺀다(몹은 나만 노린다)
  function dropRemote() { rp = null; flow2 = null; }
  // 손님: 방장이 던전을 나감 · 끊김 → 이제부터 몹을 내 기기에서 계산(혼자 계속)
  function takeover() {
    if (!mirror) return;
    mirror = false;
    shots = []; pshots = []; fields = [];
    for (const e of enemies) {
      if (e.burn && !e.burn.dps) e.burn = null;
      if (e.poison && !e.poison.per) e.poison = null;
      e.kx = e.kx || 0; e.ky = e.ky || 0; e.vz = e.vz || 0; delete e.tx; delete e.ty;
    }
  }

  // ── 몹 · 상자 배치 ──
  function populate() {
    const def = lv.def;
    let uniques = 0;
    const usedNames = new Set();
    for (const r of lv.rooms) {
      if (r === lv.start) continue;
      if (r.boss) {
        const b = createEnemy(def.boss, r.cx * T + 8, (r.y + 3) * T, dlv(), { awake: false });
        b.name = ENEMIES[def.boss].name;
        addEnemy(b);
        continue;
      }
      const packs = r.w * r.h > 110 ? 2 : 1;
      for (let k = 0; k < packs; k++) {
        const type = pick(def.pool), center = Dungeon.spotIn(lv, r);
        const pack = { members: [] };
        const roll = Math.random();
        if (roll < UNIQUE.chance && uniques < UNIQUE.max) {
          // 고유 몹: 금색 이름 우두머리 + 졸개
          uniques++;
          let name = pick(UNIQUE_NAMES);
          while (usedNames.has(name)) name = pick(UNIQUE_NAMES);
          usedNames.add(name);
          const keys = Object.keys(AFFIXES), aff = [];
          while (aff.length < 2) { const a = pick(keys); if (!aff.includes(a)) aff.push(a); }
          addPack(pack, createEnemy(type, center.x, center.y, dlv(), { unique: name, affixes: aff, pack }));
          for (let m = 0; m < 3 + packAdd(); m++) addPack(pack, createEnemy(type, center.x + rnd(-24, 24), center.y + rnd(-18, 18), dlv(), { pack }));
        } else if (roll < UNIQUE.chance + ELITE.chance) {
          // 정예 무리: 파란 이름, 특수 능력 하나를 함께
          const aff = [pick(Object.keys(AFFIXES))];
          for (let m = 0; m < 3 + rnd(0, 1) + packAdd(); m++) addPack(pack, createEnemy(type, center.x + rnd(-24, 24), center.y + rnd(-18, 18), dlv(), { elite: true, affixes: aff, pack }));
        } else {
          // 보통 무리: 섞어서 3~5마리
          for (let m = 0; m < 3 + rnd(0, 2) + packAdd(); m++) addPack(pack, createEnemy(m === 0 ? type : pick(def.pool), center.x + rnd(-28, 28), center.y + rnd(-20, 20), dlv(), { pack }));
        }
      }
    }
    // 바닥 · 벽에 끼인 몹은 가까운 빈 자리로
    for (const e of enemies) if (!Dungeon.walkable(lv, e.x, e.y, e.r)) { const r = Dungeon.roomAt(lv, e.x, e.y) || lv.rooms[0]; const s = Dungeon.spotIn(lv, r); e.x = s.x; e.y = s.y; }
    // 보물 상자: 샛길 방(막다른 방)마다 하나 + 큰길 방 하나
    const mains = lv.rooms.filter(r => r.main && r !== lv.start && !r.boss);
    const chestRooms = [...lv.rooms.filter(r => r.branch), mains[rnd(0, mains.length - 1)]].filter(Boolean);
    for (const r of chestRooms) {
      const s = Dungeon.spotIn(lv, r);
      lv.chests.push({ x: s.x, y: s.y, open: false, t: 0, big: false });
    }
  }
  function addPack(pack, e) { pack.members.push(e); addEnemy(e); }

  // ── 함정(던전 컨셉, HAZARDS): 시작방 · 보스방을 뺀 방마다 1~2군데. 웅덩이 = 칸 덩어리, 가시 = 2x2 또는 3칸 줄 ──
  function placeHazards() {
    lv.haz = new Map();
    const type = lv.def.hazard;
    if (!type) return;
    const H = HAZARDS[type], W = lv.W;
    const free = (x, y) => lv.at(x, y) === 1 && !lv.columns.some(c => c[0] === x && c[1] === y)
      && !lv.chests.some(c => Math.abs(c.x - (x * T + 8)) < 20 && Math.abs(c.y - (y * T + 8)) < 20);
    for (const r of lv.rooms) {
      if (r === lv.start || r.boss) continue;
      for (let k = rnd(1, 2); k > 0; k--) {
        const cx = rnd(r.x + 2, r.x + r.w - 3), cy = rnd(r.y + 2, r.y + r.h - 3), phase = Math.random() * SPIKE_CYCLE;
        let tiles = [[cx, cy]];
        if (H.pool) {
          for (let n = rnd(4, 8), tries = 0; tiles.length < n && tries < 40; tries++) {
            const [bx, by] = tiles[rnd(0, tiles.length - 1)], d = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd(0, 3)];
            const nx = bx + d[0], ny = by + d[1];
            if (nx > r.x && nx < r.x + r.w - 1 && ny > r.y && ny < r.y + r.h - 1 && !tiles.some(t => t[0] === nx && t[1] === ny)) tiles.push([nx, ny]);
          }
        } else tiles = Math.random() < 0.5 ? [[cx, cy], [cx + 1, cy], [cx, cy + 1], [cx + 1, cy + 1]] : [[cx - 1, cy], [cx, cy], [cx + 1, cy]];
        for (const [x, y] of tiles) if (free(x, y)) lv.haz.set(y * W + x, { type, phase, x, y });
      }
    }
  }
  const spikeState = h => { const u = (time + h.phase) % SPIKE_CYCLE; return u < SPIKE_UP ? 'up' : u > SPIKE_CYCLE - SPIKE_WARN ? 'warn' : 'down'; };
  // 함정 밟기: 웅덩이 = 0.5초마다 · 느려짐, 가시 = 솟을 때 한 번(같은 가시 다시 찔리려면 다음 주기)
  let hazT = 0;
  function updateHazards(dt) {
    hazT -= dt;
    if (!lv.haz || !lv.haz.size || p.dead) return;
    const h = lv.haz.get(Math.floor(p.y / T) * lv.W + Math.floor(p.x / T));
    if (!h) return;
    const H = HAZARDS[h.type];
    if (H.pool) {
      if (H.slow) p.slowT = Math.max(p.slowT || 0, 0.15);
      if (H.dot && hazT <= 0) { hazT = 0.5; hazardDamage(p, p.maxHp * H.dot, H.color); }
    } else if (spikeState(h) === 'up' && !(p.spikeCd > time)) {
      p.spikeCd = time + SPIKE_UP + 0.05;
      if (hurtPlayer(p, { x: p.x, y: p.y + 1 }, p.maxHp * H.dmg, 60) === 'hit' && H.chill) p.slowT = 1.5;
    }
  }
  // 함정 그리기(보이는 것만): 웅덩이 = 반투명 색 + 꿈틀대는 점, 가시 = 0x72 가시(얼음 가시는 파랗게)
  function drawHazards(ctx) {
    if (!lv.haz || !lv.haz.size) return;
    for (const h of lv.haz.values()) {
      const x = h.x * T, y = h.y * T;
      if (!inView(x + 8, y + 8, 20)) continue;
      const H = HAZARDS[h.type];
      if (H.pool) {
        ctx.fillStyle = H.color; ctx.globalAlpha = 0.38;
        ctx.fillRect(x, y, T, T);
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < 2; i++) {
          const a = time * (h.type === 'lava' ? 2.5 : 1.2) + i * 2.6 + h.x * 1.7 + h.y;
          ctx.fillRect(Math.round(x + 8 + Math.cos(a) * 5), Math.round(y + 8 + Math.sin(a * 1.3) * 5), 1, 1);
        }
        ctx.globalAlpha = 1;
      } else {
        const st = spikeState(h), f = st === 'up' ? 3 : st === 'warn' ? 1 : 0;
        Gfx.spr(ctx, 'floor_spikes_anim_f' + f, x, y, { topLeft: true, tint: H.tint });
      }
    }
  }

  // 무리째 깨우기
  function wake(e) {
    const list = e.pack ? e.pack.members : [e];
    let any = false;
    for (const m of list) if (!m.awake && !m.dying) { m.awake = true; any = true; }
    if (any) Sfx.wake();
  }

  // 칸 길찾기: 플레이어 칸에서 퍼진 거리표(0.3초마다)를 따라 한 칸씩 가까워진다
  function flowDir(e) {
    const tg = e.tgt || p, fl = tg === rp && flow2 ? flow2 : flow;  // 파티: 손님을 노리는 몹은 손님 쪽 거리표
    if (!fl) return null;
    const W = lv.W, tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
    const here = fl[ty * W + tx];
    if (here < 0) return null;
    let best = null, bd = here;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy, v = fl[ny * W + nx];
      if (v < 0 || v >= bd) continue;
      if (dx && dy && (lv.at(tx + dx, ty) !== 1 || lv.at(tx, ty + dy) !== 1)) continue;  // 모서리 끼임 방지
      bd = v; best = [nx, ny];
    }
    if (!best) return unit(tg.x - e.x, tg.y - e.y, e.fv);
    return unit(best[0] * T + 8 - e.x, best[1] * T + 10 - e.y, e.fv);
  }

  const alive = e => !e.dying && e.state !== 'dead';

  function update(dt) {
    time += dt;
    for (const f of fx) f.t += dt;
    fx = fx.filter(f => f.t < f.life);
    for (const t of texts) { t.t += dt; t.z += dt * 18; }
    texts = texts.filter(t => t.t < t.life);
    shakeT = Math.max(0, shakeT - dt * 14);
    msgT -= dt; bagFullT -= dt;
    if (hitstopT > 0) { hitstopT -= dt; return; }
    if (storyT > 0 && (storyT -= dt) <= 0) Story.trigger('down', lv.def);  // 보스가 쓰러지는 모습을 보고 나서 이야기

    // 탐험한 칸 표시(자동 지도) · 길찾기 거리표
    const tile = Math.floor(p.y / T) * lv.W + Math.floor(p.x / T);
    if (tile !== lastTile) {
      lastTile = tile;
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), R = 8;
      for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) {
        if (x < 0 || y < 0 || x >= lv.W || y >= lv.H || (x - tx) ** 2 + (y - ty) ** 2 > R * R) continue;
        lv.explored[y * lv.W + x] = 1;
      }
      lv.mapDirty = true;  // 자동 지도 다시 그리기(hud.js)
    }
    if (mirror) {  // 파티 손님: 몹 · 탄 · 장판은 방장이 보낸 대로, 내 몸 · 함정 · 전리품 · 상자만 여기서
      Coop.applySnaps();
      updatePlayer(p, dt, lv, true);
      mirrorStep(dt);
      enemies = enemies.filter(e => { const gone = e.state === 'dead' && e.t > (e.def.boss ? 1.6 : 1.2); if (gone) byId.delete(e.id); return !gone; });
      updateHazards(dt);
      updateDrops(dt);
      updateChests(dt);
    } else {
    flowT -= dt;
    if (flowT <= 0) {
      flowT = 0.3; flow = Dungeon.bfs(lv, Math.floor(p.x / T), Math.floor(p.y / T), 45);
      flow2 = rp ? Dungeon.bfs(lv, Math.floor(rp.x / T), Math.floor(rp.y / T), 45) : null;
    }

    actor = p; updatePlayer(p, dt, lv, true); actor = null;
    if (rp) { actor = rp; rp.sp = rp.maxSp; updatePlayer(rp, dt, lv, true); actor = null; }  // 손님 몸: 기력은 손님 쪽에서 셈
    // 몹마다 노릴 사람 = 가까운 살아 있는 사람(파티면 나 · 손님 중)
    const near = e => { if (!rp || rp.dead) return p; if (p.dead) return rp; return Math.hypot(rp.x - e.x, rp.y - e.y) < Math.hypot(p.x - e.x, p.y - e.y) ? rp : p; };
    for (const e of enemies) e.tgt = near(e);
    if (rp) { assignRoles(enemies.filter(e => e.tgt === p), p); assignRoles(enemies.filter(e => e.tgt === rp), rp); }
    else assignRoles(enemies, p);
    for (const e of enemies) {
      // 멀리서 자는 몹은 상태이상만 흐르게(아무것도 안 한다)
      const t = e.tgt;
      if (!e.awake && Math.abs(e.x - t.x) > 360 && Math.abs(e.y - t.y) > 260) continue;
      updateEnemy(e, dt, lv, t);
    }
    separateEnemies(enemies, lv, p, rp);
    enemies = enemies.filter(e => { const gone = e.state === 'dead' && e.t > (e.def.boss ? 1.6 : 1.2); if (gone) byId.delete(e.id); return !gone; });
    updateShots(dt);
    updatePlayerShots(dt);
    updateFields(dt);
    updateHazards(dt);
    Elements.step(dt);  // 뇌운 · 연쇄 폭발처럼 잠깐 뒤에 터지는 것
    updateDrops(dt);
    updateChests(dt);
    }

    comboT -= dt;
    if (comboT <= 0) comboN = 0;

    // 보스방에 들어서면 보스가 깨어난다(파티면 둘 중 누구든)
    if (!bossAwake && (Dungeon.roomAt(lv, p.x, p.y) === lv.boss || (rp && Dungeon.roomAt(lv, rp.x, rp.y) === lv.boss))) {
      bossAwake = true;
      const b = enemies.find(e => e.rank === 'boss');
      if (b) { b.awake = true; b.spawnT = 0.8; msg = b.name; msgT = 2.2; Sfx.roar(); shake(4); Story.trigger('boss', lv.def); }
    }
    // 계단: 밟으면 물어본다(실수로 나가지 않게). 내려섰다가 다시 밟으면 또 묻는다
    if (lv.stairs && !p.dead) {
      const d = Math.hypot(p.x - lv.stairs.x, p.y - lv.stairs.y);
      if (d < 12 && !lv.stairs.asked) {
        lv.stairs.asked = true;
        // 파티(4단계): 방장이 오르면 파티원도 같이 마을로, 손님은 혼자 먼저 갈 수 있다
        const party = Coop.inParty(), host = !!rp;
        Game.overlay({ type: 'confirm', defaultYes: true,
          text: party ? (host ? '파티원과 같이 마을로 돌아갈까요?' : '혼자 먼저 마을로 돌아갈까요?') : '계단을 올라 마을로 돌아갈까요?',
          sub: party ? (host ? '친구도 같이 계단을 올라 결과 화면으로 가요' : '방장이 계단을 오르면 같이 나가요') : undefined,
          yes: () => { Sfx.stairs(); if (party && host) Coop.leaveTogether(); finish('clear'); } });
      }
      if (d > 22) lv.stairs.asked = false;
    }
    Coop.reviveTick(dt);  // 파티: 쓰러진 친구 옆에서 공격 버튼을 누르고 있으면 살리기
    if (p.downed) { msg = '쓰러졌다 — 친구가 살려 줄 때까지 기다려요'; msgT = 0.5; }
    if (p.dead && p.deadT > 1.6 && !ended && !(p.downed && Coop.mateUp())) finish('dead');  // 파티: 친구도 쓰러지거나 나가면 실패
  }

  // 손님: 방장이 보낸 자리로 몹을 부드럽게 옮기고, 탄 · 검기 · 장판은 다음 소식까지 그대로 날아가게
  function mirrorStep(dt) {
    const f = 1 - Math.exp(-dt * 15);
    for (const e of enemies) {
      if (e.tx !== undefined) {
        const d = Math.hypot(e.tx - e.x, e.ty - e.y);
        if (d > 48) { e.x = e.tx; e.y = e.ty; } else { e.x += (e.tx - e.x) * f; e.y += (e.ty - e.y) * f; }
      }
      if (e.moving) e.walkT += dt;
      if (e.state === 'dead') e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      Elements.tick(e, dt);  // 상태이상 알갱이만(피해는 방장이)
    }
    for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; }
    for (const s of pshots) { s.x += s.vx * dt; s.y += s.vy * dt; s.t = (s.t || 0) + dt; }
    for (const fd of fields) fd.t += dt;
  }
  // 손님: 방장 소식(snap) 적용 — 몹 [id, x, y, z, hp, maxHp, 상태, t, windupT, fx, fy, flash, 깃발, 냉기, 독, 종류, spawnT, 돌진 x, 돌진 y]
  const F_AWAKE = 1, F_DYING = 2, F_MOVING = 4, F_BURN = 8, F_SHOCK = 16, F_CRACK = 32, F_CUT = 64;
  function applySnap(m) {
    for (const a of m.e) {
      let e = byId.get(a[0]);
      if (!e) {  // 방장 쪽에서 새로 나온 몹(보스가 부른 졸개 등)
        e = createEnemy(a[15], a[1], a[2], dlv(), { awake: true });
        e.id = a[0]; byId.set(e.id, e); enemies.push(e);
      }
      e.tx = a[1]; e.ty = a[2]; e.z = a[3]; e.hp = a[4]; e.maxHp = a[5]; e.state = a[6]; e.t = a[7]; e.windupT = a[8];
      e.fv = { x: a[9], y: a[10] }; e.flash = a[11];
      const fl = a[12];
      e.awake = !!(fl & F_AWAKE); e.dying = !!(fl & F_DYING); e.moving = !!(fl & F_MOVING);
      e.burn = fl & F_BURN ? { t: 9, tick: 9, dps: 0 } : null;
      e.shockT = fl & F_SHOCK ? 1 : 0; e.crackT = fl & F_CRACK ? 1 : 0; e.cutT = fl & F_CUT ? 1 : 0;
      e.chill = a[13]; e.poison = a[14] ? { n: a[14], t: 9, tick: 9, per: 0 } : null;
      e.spawnT = a[16]; e.chargeV = a[17] !== undefined ? { x: a[17], y: a[18] } : null;
    }
    shots = m.sh.map(s => ({ x: s[0], y: s[1], vx: s[2], vy: s[3], r: s[4], color: s[5] }));
    pshots = m.ps.map(s => Object.assign(s, { hit: new Set(), def: { wave: { scale: s.sc || 1 } } }));
    fields = m.fd;
    for (const ev of m.ev) replay(ev);
  }
  // 손님: 방장 쪽에서 생긴 효과를 내 화면에
  function replay(ev) {
    const k = ev[0];
    if (k === 'sp') sparks(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]);
    else if (k === 'im') impact(ev[1], ev[2], ev[3], ev[4]);
    else if (k === 'du') dust(ev[1], ev[2], ev[3]);
    else if (k === 'tx') { text(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]); if (ev[7]) Sfx.hit(!!ev[6]); }  // 내가 친 피해면 타격음
    else if (k === 'fx') {
      const f = ev[1];
      if (f.follow === 'mate') f.follow = Coop.runMate() || { x: f.x || 0, y: f.y || 0 };
      else if (f.follow === 'at') f.follow = { x: f.ax, y: f.ay };
      fx.push(f);
    }
    else if (k === 'sh') shake(ev[1]);
    else if (k === 'hs') hitstopT = Math.max(hitstopT, ev[1]);
  }
  // 방장: 손님에게 보낼 소식(손님 둘레 몹 · 탄 · 검기 · 장판)
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  function prim(o) {  // 숫자 · 글 · 참거짓만(함수 · 몹 · 플레이어 참조는 빼고)
    const r = {};
    for (const k in o) { const v = o[k], t = typeof v; if (t === 'number') r[k] = r2(v); else if (t === 'string' || t === 'boolean') r[k] = v; }
    return r;
  }
  function snapshot() {
    const near = o => Math.abs(o.x - rp.x) < 420 && Math.abs(o.y - rp.y) < 300;
    const e = [];
    for (const m of enemies) {
      if (!near(m) && m.rank !== 'boss') continue;
      const fl = (m.awake ? F_AWAKE : 0) | (m.dying ? F_DYING : 0) | (m.moving ? F_MOVING : 0) | (m.burn ? F_BURN : 0) | (m.shockT > 0 ? F_SHOCK : 0) | (m.crackT > 0 ? F_CRACK : 0) | (m.cutT > 0 ? F_CUT : 0);
      const a = [m.id, r1(m.x), r1(m.y), r1(m.z || 0), Math.round(m.hp), m.maxHp, m.state, r2(m.t), r2(m.windupT || 0), r2(m.fv.x), r2(m.fv.y), r2(m.flash), fl, m.chill || 0, m.poison ? m.poison.n : 0, m.type, r2(m.spawnT || 0)];
      if (m.chargeV) a.push(r2(m.chargeV.x), r2(m.chargeV.y));
      e.push(a);
    }
    const sh = shots.filter(near).map(s => [r1(s.x), r1(s.y), r1(s.vx), r1(s.vy), s.r, s.color]);
    const ps = pshots.filter(near).map(s => Object.assign(prim(s), { stone: !!s.stone, sc: s.def && s.def.wave && s.def.wave.scale || 1 }));
    const fd = fields.filter(near).map(prim);
    return { t: 'snap', e, sh, ps, fd };
  }

  // 계단 자리: 보스방 안에서 보스가 쓰러진 곳(전리품 · 상자가 흩어지는 곳)에서 가장 먼 빈 칸(2026-10-24 사용자: 낙템 줍다 계단 밟지 않게)
  function stairsSpot(b) {
    const r = lv.boss;
    let best = { x: b.x, y: b.y - 30 }, bd = -1;
    for (let ty = r.y + 1; ty < r.y + r.h - 1; ty++) for (let tx = r.x + 1; tx < r.x + r.w - 1; tx++) {
      const x = tx * T + 8, y = ty * T + 8;
      if (!Dungeon.walkable(lv, x, y, 12)) continue;
      const d = Math.hypot(x - b.x, y - b.y);
      if (d > bd) { bd = d; best = { x, y }; }
    }
    return best;
  }

  function bossCleared(b) {
    storyT = 1.6;
    p.safe = true;  // 보스를 잡은 순간부터 이 던전 끝까지 무적(남은 탄 · 죽을 때 폭발 · 함정)
    lv.chests.push({ x: b.x, y: b.y + 18, open: false, t: 0, big: true });
    lv.stairs = stairsSpot(b);
    msg = '보스를 쓰러뜨렸다!'; msgT = 2.5;
    prof.cleared[lv.def.id] = true;
    if (!prof.clearedDiff) prof.clearedDiff = {};
    prof.clearedDiff[lv.def.id] = Math.max(diffCleared(prof, lv.def.id), RUN.diff);  // 다음 난이도가 열린다
    // 타임어택: 보스를 쓰러뜨린 시간 = 기록. 던전 · 난이도마다 최고 기록을 남긴다
    run.clearTime = time;
    if (!prof.bestTimes) prof.bestTimes = {};
    const tk = timeKey(lv.def.id, RUN.diff);
    run.bestPrev = prof.bestTimes[tk];
    if (!run.bestPrev || time < run.bestPrev) { prof.bestTimes[tk] = time; run.newRecord = true; }
  }

  function finish(kind) {
    ended = kind;
    if (kind === 'dead') {
      const lost = Math.floor(prof.gold * 0.1);
      prof.gold -= lost;
      run.lostGold = lost;
    }
    Game.endRun(run, kind);
  }

  // ── 탄 ──
  function updateShots(dt) {
    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (!Dungeon.walkable(lv, s.x, s.y + 4, 1)) s.life = 0;
      for (const t of rp ? [p, rp] : [p]) {  // 파티: 손님 몸에 맞으면 손님에게 알린다(hurtPlayer)
        if (s.life > 0 && !t.dead && Math.hypot(t.x - s.x, (t.y - 8) - s.y) < s.r + BODY_R + 2) {
          if (hurtPlayer(t, s, s.dmg, s.knock) !== 'miss') { s.life = 0; sparks(s.x, s.y + 8, 8, 5, s.color); if (s.chill) t.slowT = 2; }  // 얼음 임프 탄: 느려짐
        }
      }
    }
    shots = shots.filter(s => s.life > 0);
  }

  // 플레이어 검기: 몹을 꿰뚫으며(한 마리에 한 번) 날아가고, 벽이나 사거리 끝에서 사라진다
  function updatePlayerShots(dt) {
    for (const s of pshots) {
      const p = s.owner || World.player;  // 쏜 사람(파티: 손님 몸 rp 일 수도)
      actor = p;
      // 마력탄: 앞쪽(±1 rad) 100 안의 가장 가까운 적 쪽으로 천천히 돈다(초당 4 rad)
      if (s.homing) {
        const sp = Math.hypot(s.vx, s.vy), a = Math.atan2(s.vy, s.vx);
        let best = null, bd = 100;
        for (const e of enemies) {
          if (e.dying || e.state === 'dead' || e.spawnT > 0 || s.hit.has(e)) continue;
          const d = Math.hypot(e.x - s.x, e.y - s.y), ea = Math.atan2(e.y - s.y, e.x - s.x);
          let da = ea - a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          if (d < bd && Math.abs(da) < 1) { bd = d; best = da; }
        }
        if (best !== null) { const na = a + Math.max(-4 * dt, Math.min(4 * dt, best)); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; }
      }
      const step = Math.hypot(s.vx, s.vy) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.left -= step; s.t += dt;
      s.trail = (s.trail || 0) + step;
      if (s.trail >= 14 && !s.ball) { s.trail = 0; Elements.waveTrail(s, p); }  // 검기 칸 속성석: 불길 · 독 꼬리
      if (s.left <= 0 || !Dungeon.walkable(lv, s.x, s.y, 1)) { if (s.onEnd) s.onEnd(s); else Elements.waveEnd(s, p); s.gone = true; continue; }
      let landed = false;
      for (const e of enemies) {
        if (s.hit.has(e) || (e.z || 0) > AIR_REACH || Math.hypot(e.x - s.x, e.y - s.y) > s.r + e.r) continue;
        if (hitEnemy(e, s.def, p)) { s.hit.add(e); landed = true; if (s.onHitE) s.onHitE(e); }
      }
      if (landed) hitstop(0.04);
      if (landed && s.once) { s.gone = true; if (s.onEnd) s.onEnd(s); }  // 화염구: 처음 닿은 적 자리에서 터진다
    }
    actor = null;
    pshots = pshots.filter(s => !s.gone);
  }

  // 장판: 0.5초마다 안에 있는 몹에게 속성 효과
  function updateFields(dt) {
    for (const f of fields) {
      const p = f.p || World.player;  // 깐 사람(파티: 손님 몸 rp 일 수도)
      actor = p;
      f.t += dt; f.tick -= dt;
      if (f.tick <= 0) { f.tick += 0.5; Elements.fieldTick(f); }
      // 마법진: delay 뒤 한 번 크게 터진다(마법진 칸 속성석은 그 자리에서 둘레 효과)
      if (f.magic && !f.done && f.t >= f.delay) {
        f.done = true;
        let landed = false;
        for (const e of enemies) {
          if (e.dying || e.state === 'dead' || Math.hypot(e.x - f.x, (e.y - f.y) * 1.4) > f.r + e.r) continue;
          if (hitEnemy(e, f.def, p)) landed = true;
        }
        addFx({ type: 'burst', x: f.x, y: f.y, r: f.r * 1.1, col: f.col, t: 0, life: 0.4 });
        sparks(f.x, f.y - 6, 16, 18, f.col);
        Elements.chargeBurst(Object.assign(Object.create(p), { x: f.x, y: f.y }));
        Sfx.blast(); shake(4);
        if (landed) hitstop(0.07);
      }
      // 화염 강화 몹의 죽음 폭발: 예고 뒤 한 번 터진다
      if (f.blast && !f.done && f.t >= f.delay) {
        f.done = true;
        actor = null;
        addFx({ type: 'burst', x: f.x, y: f.y, r: f.r, col: ELEMENTS.fire.color, t: 0, life: 0.35 });
        Sfx.blast(); shake(3);
        for (const t of rp ? [World.player, rp] : [World.player]) if (!t.dead && Math.hypot(t.x - f.x, (t.y - f.y) * 1.4) < f.r + BODY_R) hurtPlayer(t, f, f.dmg, 160);
      }
    }
    actor = null;
    fields = fields.filter(f => f.t < f.life);
  }

  // 속성석 굴리기: 이 던전의 크기 확률대로
  // 속성석 · 보석 굴리기: 던전 표(STONE_DROP)에서. boost = 보스 · 큰 상자(큰 쪽이 더 잘). 난이도는 큰 쪽 가중치 · 한 단계 위 아주 가끔
  function rollStone(boost = 0) {
    const gem = Math.random() < GEM_CHANCE;  // 가끔은 속성석 대신 보석
    const el = gem ? (Math.random() < GEM_WEIGHT.might ? 'might' : 'guard') : EL_ORDER[rnd(0, EL_ORDER.length - 1)];  // 보석은 공격 40 · 방어 60
    const base = STONE_DROP[lv.def.id] || STONE_DROP.chapel, D = DIFFS[RUN.diff];
    const top = base.reduce((m, p, i) => (p > 0 ? i : m), 0), cap = Math.min(STONE_DROP_CAP, top + (D.stoneSpill ? 1 : 0));
    const f = 1 + D.stoneFavor + boost, w = [];
    for (let i = 0; i <= cap; i++) w[i] = (base[i] || 0) * Math.pow(f, i);
    if (cap > top) w[cap] = base[top] * D.stoneSpill * (1 + boost);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), size = 0;
    for (let i = 0; i <= cap; i++) { if (r < w[i]) { size = i; break; } r -= w[i]; }
    return { el, size };
  }
  // 주문서 굴리기: 가끔 복구 주문서, 아니면 무기 · 방어구 · 장신구 중 하나(성공률 높은 게 잘 나옴)
  function rollScroll() {
    if (Math.random() < INHERIT_CHANCE) return { g: 'inherit', r: 0 };
    let x = Math.random(), r = 0;
    while (r < SCROLL_DROP.length - 1 && x >= SCROLL_DROP[r]) { x -= SCROLL_DROP[r]; r++; }
    return { g: 'any', r };
  }

  // ── 드롭 · 줍기 ──
  function loot(x, y, o) {
    const toss = (d) => {
      const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 50;
      Object.assign(d, { x, y, z: 4, vz: 90 + Math.random() * 50, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, landed: false });
      lv.drops.push(d);
    };
    if (o.gold) {
      const pieces = Math.min(6, Math.max(1, Math.round(o.gold / 6)));
      for (let k = 0; k < pieces; k++) toss({ kind: 'gold', amount: Math.max(1, Math.round(o.gold / pieces)) });
    }
    for (const it of o.items || []) toss({ kind: 'item', item: it });
    for (const st of o.stones || []) toss({ kind: 'stone', stone: st });
    for (const sc of o.scrolls || []) toss({ kind: 'scroll', scroll: sc });
  }

  function goldRoll(range, mul = 1) {
    return Math.round(rnd(range[0], range[1]) * mul * GOLD_MUL * DIFFS[RUN.diff].gold * POWER(dlv()) * (1 + p.stats.gold / 100));
  }
  const ilvl = () => rnd(lv.ilvlR[0], lv.ilvlR[1]);
  const mk = (il, o) => Items.make(il, Object.assign({ rare: DIFFS[RUN.diff].rare }, o));  // 난이도만큼 좋은 등급이 잘 나온다

  function updateDrops(dt) {
    for (const d of lv.drops) {
      d.t += dt;
      if (d.z > 0 || d.vz > 0) {
        d.z += d.vz * dt; d.vz -= 500 * dt;
        if (d.z <= 0) {
          d.z = 0; d.vz = Math.abs(d.vz) > 60 ? -d.vz * 0.35 : 0;
          if (!d.landed) { d.landed = true; if (d.kind === 'item') Sfx.drop(d.item.rarity); else if (d.kind === 'stone' || d.kind === 'scroll') Sfx.stone(); }
        }
        const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
        if (Dungeon.walkable(lv, nx, ny, 3)) { d.x = nx; d.y = ny; } else { d.vx *= -0.5; d.vy *= -0.5; }
        d.vx *= Math.exp(-3 * dt); d.vy *= Math.exp(-3 * dt);
      }
      if (d.t < 0.35 || p.dead) continue;
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (d.kind === 'gold') {
        if (dist < 34) { const k = Math.min(1, dt * 10); d.x += (p.x - d.x) * k; d.y += (p.y - d.y) * k; }
        if (dist < 8) { prof.gold += d.amount; run.gold += d.amount; d.gone = true; Sfx.gold(); text(p.x, p.y, 30, '+' + d.amount + 'G', '#ffd34d'); }
      } else if (dist < 11) {
        if (d.kind === 'stone') {
          Elements.add(prof, d.stone); d.gone = true;  // 속성석은 가방 대신 주머니로(칸을 안 차지한다)
          run.stones = (run.stones || 0) + 1;
          Sfx.stone();
          text(p.x, p.y, 34, stoneName(d.stone), ELEMENTS[d.stone.el].color);
        } else if (d.kind === 'scroll') {
          Items.addScroll(prof, d.scroll); d.gone = true;  // 주문서도 주머니로
          run.scrolls = (run.scrolls || 0) + 1;
          Sfx.pickup();
          text(p.x, p.y, 34, scrollName(d.scroll), scrollColor(d.scroll));
        } else {
          const slot = prof.bag.indexOf(null);
          if (slot >= 0) {
            prof.bag[slot] = d.item; d.gone = true;
            run.items.push(d.item);
            Sfx.pickup();
            text(p.x, p.y, 34, Items.nameOf(d.item), RARITY[d.item.rarity].color);
          } else if (Items.isJunk(prof, d.item)) {
            // 가방이 가득 차면 낀 것보다 약한 장비는 줍는 순간 골드로(흰 · 파랑만 — 노랑 이상 · 강화 · 못 끼는 것은 빼고)
            const g = d.item.value;
            prof.gold += g; run.gold += g; d.gone = true;
            run.autoSold = (run.autoSold || 0) + 1;
            Sfx.gold();
            text(p.x, p.y, 34, '+' + g + 'G (자동 판매)', '#ffd34d');
          } else if (bagFullT <= 0) { bagFullT = 2; text(p.x, p.y, 34, '가방이 가득 찼다', '#ff8a6a'); }
        }
      }
    }
    lv.drops = lv.drops.filter(d => !d.gone);
  }

  function updateChests(dt) {
    for (const c of lv.chests) {
      if (!c.open && !p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 16) {
        c.open = true;
        Sfx.chest();
        const items = [];
        // 장비 수 줄임(2026-10-24 사용자): 보물 상자 1개(좋은 등급 잘 나옴) · 작은 상자 60% 확률로 1개
        if (c.big || Math.random() < 0.6) items.push(mk(c.big ? lv.ilvlR[1] : ilvl(), { boost: c.big ? 0.8 : 0.4 }));
        const stones = c.big ? [rollStone(STONE_BOSS_BOOST)] : Math.random() < 0.5 ? [rollStone()] : [];
        const scrolls = c.big || Math.random() < SCROLL_DROP_RATE.chest ? [rollScroll()] : [];
        loot(c.x, c.y - 4, { gold: goldRoll(c.big ? [40, 70] : [15, 30]), items, stones, scrolls });
        text(c.x, c.y, 24, c.big ? '보물 상자!' : '상자', '#ffd36a');
      }
      if (c.open) c.t += dt;
    }
  }

  // ── 몹이 쓰러짐 ──
  function onKill(e) {
    Elements.onDeath(e);  // 연쇄 폭발(화염 패시브)
    if (rp) Coop.hostKill(e);  // 파티: 손님도 자기 경험치 · 전리품을 굴린다
    const d = e.def;
    // 화염 강화: 죽은 자리에 잠시 뒤 불꽃 폭발(예고 원)
    if ((e.affixes && e.affixes.includes('fire')) || d.deathBlast) fields.push({ blast: true, x: e.x, y: e.y, r: 26, el: 'fire', t: 0, tick: 99, delay: 0.8, life: 1.1, dmg: 14 * e.dmgMul });
    reward(e);
    if (d.boss) {
      // 보스가 쓰러지면 보스방 · 그 둘레의 적도 함께 쓰러진다(전리품 없이)
      let fell = 0;
      for (const m of enemies) {
        if (m === e || m.dying || m.state === 'dead') continue;
        if (Dungeon.roomAt(lv, m.x, m.y) !== lv.boss && Math.hypot(m.x - e.x, m.y - e.y) > 260) continue;
        m.dying = true; m.hp = 0; m.state = 'air'; m.vz = 90; m.flash = 0.2;
        dust(m.x, m.y, 6);
        fell++;
      }
      if (fell) text(e.x, e.y, e.h + 20, '주변의 적이 모두 쓰러졌다', '#ffd36a', true);
    }
  }
  // 손님: 방장이 몹 처치를 알림 → 내 경험치 · 전리품(내 화면에만 떨어진다)
  function remoteKill(id) {
    const e = byId.get(id);
    if (!e || e.rewarded) return;
    e.dying = true;
    reward(e);
  }
  // 처치 보상: 경험치 · 회복 · 전리품(보스면 상자 · 계단 · 기록까지)
  function reward(e) {
    const d = e.def;
    e.rewarded = true;
    run.kills++;
    Sfx.kill();
    const rankExp = e.rank === 'unique' ? 5 : e.rank === 'elite' ? 2 : 1;
    gainExp(Math.round(d.exp * rankExp * POWER(dlv()) * DIFFS[RUN.diff].exp * lowExp(prof.lv, dlv())));  // 낮은 던전은 경험치 줄어듦  // 역할 경험치 × 던전 레벨 곡선
    if (p.stats.life) p.hp = Math.min(p.maxHp, p.hp + p.stats.life);
    if (p.stats.fx.vamp) p.hp = Math.min(p.maxHp, p.hp + Math.max(2, Math.round(p.maxHp * UNIQUE_FX.vamp)));  // 유니크 흡혈 칼날
    if (d.boss) {
      const bossItems = [mk(lv.ilvlR[1], { boost: 0.8 })];
      if (Math.random() < UNIQUE_DROP.boss * DIFFS[RUN.diff].uniq * lowUniq(prof.lv, dlv())) bossItems.push(Items.makeUnique(lv.ilvlR[1]));
      loot(e.x, e.y, { gold: goldRoll(d.gold), items: bossItems, stones: [rollStone(STONE_BOSS_BOOST), rollStone(STONE_BOSS_BOOST)], scrolls: Array.from({ length: SCROLL_DROP_RATE.boss }, rollScroll) });
      shake(5);
      bossCleared(e);
      return;
    }
    if (e.rank === 'unique') {
      const uItems = [mk(lv.ilvlR[1], { boost: 0.6 })];
      if (Math.random() < UNIQUE_DROP.unique * DIFFS[RUN.diff].uniq * lowUniq(prof.lv, dlv())) uItems.push(Items.makeUnique(lv.ilvlR[1]));
      loot(e.x, e.y, { gold: goldRoll(d.gold, 4), items: uItems, stones: [rollStone()], scrolls: Math.random() < SCROLL_DROP_RATE.unique ? [rollScroll()] : [] });
      return;
    }
    const elite = e.rank === 'elite';
    const items = Math.random() < (elite ? 0.2 : 0.06) ? [mk(ilvl(), { boost: elite ? 0.3 : 0 })] : [];  // 일반 6% · 정예 20% (예전 13% · 40%)
    const stones = Math.random() < (elite ? 0.15 : 0.07) ? [rollStone()] : [];
    const scrolls = Math.random() < (elite ? SCROLL_DROP_RATE.elite : SCROLL_DROP_RATE.normal) ? [rollScroll()] : [];
    loot(e.x, e.y, { gold: Math.random() < 0.75 ? goldRoll(d.gold, elite ? 2 : 1) : 0, items, stones, scrolls });
  }

  function gainExp(n) {
    if (prof.lv >= LV_MAX) { prof.exp = 0; return; }  // 만렙이면 경험치는 더 안 쌓인다
    prof.exp += n; run.exp += n;
    while (prof.lv < LV_MAX && prof.exp >= expToNext(prof.lv)) {
      prof.exp -= expToNext(prof.lv);
      prof.lv++;
      run.levelUps++;
      refreshStats(p);
      p.hp = p.maxHp;
      Sfx.levelUp();
      text(p.x, p.y, 44, '레벨 업!  Lv.' + prof.lv, '#7dff8a', true);
      msg = '레벨 업! Lv.' + prof.lv + (prof.lv >= LV_MAX ? ' (만렙)' : ''); msgT = 1.6;
    }
    if (prof.lv >= LV_MAX) prof.exp = 0;
  }

  // ── 효과 ──
  // big = 타격 불꽃(2026-10-25 사용자 '타격감'): 2px 조각이 더 멀리 튀고 더 오래(0.3~0.55초) 떨어진다
  function sparks(x, y, z, n, col, big) {
    emit(['sp', r1(x), r1(y), r1(z), n, col, big ? 1 : 0], x, y);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (big ? 60 : 40) + Math.random() * (big ? 110 : 80);
      fx.push({ type: 'spark', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: (big ? 60 : 40) + Math.random() * (big ? 90 : 70), t: 0,
        life: big ? 0.3 + Math.random() * 0.25 : 0.18 + Math.random() * 0.15, col, s: big && Math.random() < 0.6 ? 2 : 1 });
    }
  }
  // 맞은 자리 번쩍임: 흰 4각 빛이 커지며 사라진다(약 0.1초)
  function impact(x, y, z, r) { emit(['im', r1(x), r1(y), r1(z), r], x, y); fx.push({ type: 'impact', x, y, z, r, rot: Math.random() * 0.8, t: 0, life: 0.11 }); }
  function dust(x, y, n) {
    emit(['du', r1(x), r1(y), n], x, y);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      fx.push({ type: 'dust', x: x + Math.cos(a) * 5, y: y + Math.sin(a) * 3, z: 0, vx: Math.cos(a) * 20, vy: Math.sin(a) * 12, vz: 10 + Math.random() * 15, t: 0, life: 0.4 + Math.random() * 0.2 });
    }
  }
  function text(x, y, z, s, col, big) {
    emit(['tx', r1(x), r1(y), r1(z), s, col, big ? 1 : 0, actorRemote() ? 1 : 0], x, y);  // 마지막 = 손님이 친 것(손님 쪽 타격음)
    texts.push({ x: x + (Math.random() - 0.5) * 4, y, z, s, col, t: 0, life: big ? 1.4 : 0.8, big });
  }
  function number(x, y, z, n, col, big) { text(x, y, z, String(n), col, big); }
  // 화면 흔들림 · 히트스톱: 손님 몸(rp)이 친 것은 방장 화면 대신 손님 화면에서, 몹 · 함정이 낸 흔들림은 둘 다
  function shake(s) {
    if (actorRemote()) { emit(['sh', s]); return; }
    if (!actor) emit(['sh', s]);
    shakeT = Math.max(shakeT, s);
  }
  function hitstop(t) {
    if (actorRemote()) { emit(['hs', t]); return; }
    hitstopT = Math.max(hitstopT, t);
  }
  // 효과 그림 더하기(파티 방장: 손님에게도). 손님 자기 동작 그림(고리 · 잔상)은 손님 쪽에서 바로 그리므로 안 보낸다
  function addFx(f) {
    fx.push(f);
    if (!rp || mirror || f.follow === rp) return;
    const c = prim(f);
    if (f.fv) c.fv = { x: r2(f.fv.x), y: r2(f.fv.y) };
    if (f.follow) { if (f.follow === p) c.follow = 'mate'; else { c.follow = 'at'; c.ax = r1(f.follow.x); c.ay = r1(f.follow.y); } }
    const x = f.x !== undefined ? f.x : f.x0 !== undefined ? f.x0 : f.follow ? f.follow.x : rp.x, y = f.y !== undefined ? f.y : f.y0 !== undefined ? f.y0 : f.follow ? f.follow.y : rp.y;
    emit(['fx', c], x, y);
  }

  // ── 그리기 ──
  const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VIEW_W + m && y > cam.y - m && y < cam.y + VIEW_H + m;
  function draw(ctx) {
    const viewH = VIEW_H - HUD_H;
    cam.x = Math.round(Math.max(0, Math.min(lv.W * T - VIEW_W, p.x - VIEW_W / 2)));
    cam.y = Math.round(Math.max(0, Math.min(lv.H * T - viewH, p.y - 10 - viewH / 2)));
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-cam.x + Math.round((Math.random() - 0.5) * shakeT * 2), -cam.y + Math.round((Math.random() - 0.5) * shakeT * 2));
    ctx.drawImage(lv.canvas, cam.x, cam.y, VIEW_W, VIEW_H, cam.x, cam.y, VIEW_W, VIEW_H);
    drawHazards(ctx);
    if (lv.stairs) Art.stairs(ctx, lv.stairs, time);
    for (const f of fields) if (inView(f.x, f.y)) Art.field(ctx, f, time);
    for (const d of lv.drops) if (inView(d.x, d.y)) Art.drop(ctx, d, time);
    // 앞뒤(y) 정렬: 기둥 · 상자 · 캐릭터
    const list = [];
    for (const c of lv.columns) {
      const x = c[0] * T + 8, y = (c[1] + 1) * T, crate = lv.crates && lv.crates.has(c.join());  // 상자(관 · 바리케이드)
      if (inView(x, y, 60)) list.push({ y, draw: () => Gfx.spr(ctx, crate ? 'crate' : 'column', x, crate ? y - 2 : y) });
    }
    for (const c of lv.chests) if (inView(c.x, c.y)) list.push({ y: c.y, draw: () => Art.chest(ctx, c) });
    const vis = enemies.filter(e => inView(e.x, e.y));
    for (const e of vis) list.push({ y: e.y, draw: () => Art.enemy(ctx, e, time, p) });
    list.push({ y: p.y, draw: () => Art.player(ctx, p, time) });
    const mate = rp || Coop.runMate();  // 파티 친구(방장 화면 = 손님 몸 rp 그대로 · 손님 화면 = 방장이 보낸 위치)
    if (mate && inView(mate.x, mate.y)) list.push({ y: mate.y, draw: () => { Art.shadow(ctx, mate.x, mate.y, 6, 0, 1); Art.player(ctx, mate, time); } });
    list.sort((a, b) => a.y - b.y);
    for (const e of vis) { Art.aura(ctx, e, time); Art.shadow(ctx, e.x, e.y, e.r + 2, e.z, e.spawnT > 0 ? 0.4 : 1); }
    Art.shadow(ctx, p.x, p.y, 6, 0, 1);
    for (const it of list) it.draw();
    for (const s of shots) Art.shot(ctx, s, time);
    for (const s of pshots) Art.wave(ctx, s);
    Art.fx(ctx, fx);
    Art.darkness(ctx, p.x, p.y - 10, cam);
    // 어둠 위에: 빛 안의 체력 막대 · 이름표 · 바닥 아이템 이름
    for (const e of vis) if (Math.hypot(e.x - p.x, e.y - p.y) < LIGHT_R + 30) { Art.enemyBar(ctx, e); Art.nameTag(ctx, e); }
    for (const d of lv.drops) if (d.kind === 'item' && Math.hypot(d.x - p.x, d.y - p.y) < LIGHT_R + 60) Art.dropLabel(ctx, d);
    for (const t of texts) Art.floatText(ctx, t);
    if (mate && inView(mate.x, mate.y)) {  // 친구 이름표는 어둠 위에(어디 있는지 보이게)
      ctx.font = 'bold 6px ' + Gfx.FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
      ctx.fillText('친구', mate.x + 0.5, mate.y - 25.5); ctx.fillStyle = '#d8c0ff'; ctx.fillText('친구', mate.x, mate.y - 26); ctx.textAlign = 'left';
    }
    // 쓰러진 친구: 머리 위 살리기 고리(누르고 있는 만큼 차오름) · 옆에 가면 안내
    const rv = Coop.reviveInfo();
    if (rv && inView(rv.m.x, rv.m.y)) {
      const x = rv.m.x, y = rv.m.y - 16;
      ctx.save();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
      if (rv.k > 0) { ctx.strokeStyle = '#7dff8a'; ctx.beginPath(); ctx.arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rv.k); ctx.stroke(); }
      ctx.font = 'bold 6px ' + Gfx.FONT; ctx.textAlign = 'center';
      const s = rv.near ? (rv.k > 0 ? '살리는 중' : Input.label('attack') + ' 길게 눌러 살리기') : '쓰러짐 — 옆으로 가서 살리기';
      ctx.fillStyle = '#000'; ctx.fillText(s, x + 0.5, y - 10.5); ctx.fillStyle = rv.near ? '#7dff8a' : '#ff9a8a'; ctx.fillText(s, x, y - 11);
      ctx.restore();
    }
    ctx.restore();
    Hud.draw(ctx);
  }

  return {
    start, update, draw, wake, flowDir, cam,
    get player() { return p; },
    get level() { return lv; },
    get prof() { return prof; },
    get time() { return time; },
    get run() { return run; },
    get partySeed() { return partySeed; },
    get msg() { return msgT > 0 ? { s: msg, t: msgT } : null; },
    get comboInfo() { return comboN >= 2 ? { n: comboN, t: comboT } : null; },
    enemies: () => enemies,
    attackers: () => enemies.filter(e => e.state === 'windup' || e.state === 'attack').length,
    shoot: s => shots.push(s),
    // 파티 손님은 검기 · 장판을 직접 만들지 않는다(방장 쪽 손님 몸이 만들어 보내 준다). owner = 쏜 사람
    playerShot: s => { if (!mirror) pshots.push(Object.assign({ t: 0, owner: actor || p }, s)); },
    field: f => { if (!mirror) fields.push(Object.assign({ t: 0, tick: 0.2 }, f)); },
    magicActive: () => fields.some(f => f.magic && !f.done),  // 아직 안 터진 마법진이 있나
    // 상태이상 알갱이(몸에서 피어오름)
    ember: (e, col) => fx.push({ type: 'spark', x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y, z: e.z + Math.random() * e.h, vx: 0, vy: 0, vz: 30, t: 0, life: 0.4, col }),
    summon: (type, boss, n) => {
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2;
        const e = createEnemy(type, boss.x + Math.cos(a) * 30, boss.y + Math.sin(a) * 20, dlv(), { awake: true, spawn: true });
        e.spawnT += k * 0.1;
        addEnemy(e);
        dust(e.x, e.y, 5);
      }
    },
    fx: addFx,
    text, number, sparks, impact, dust, onKill, shake, hitstop,
    // 파티(3단계)
    applySnap, remoteKill, snapshot, dropRemote, takeover,
    as: (a, fn) => { const k = actor; actor = a; try { fn(); } finally { actor = k; } },  // a 가 하는 일로 계산(파티 방장: 손님 몸 동작)
    inputLock: false,  // 파티 던전에서 창을 연 동안: 던전은 흐르고 내 몸은 입력 없음(player.js moveInput)
    get remote() { return rp; }, get mirror() { return mirror; }, get actor() { return actor; },
    combo: () => { comboN++; comboT = 1.8; },
    playerDied: () => { p.hp = 0; p.dead = true; p.state = 'dead'; p.act = null; p.deadT = 0; shakeT = 4; },
    // 파티 쓰러짐(4단계): 누운 채 기다린다 — 친구가 옆에서 공격 버튼을 2초 누르면 일어남, 둘 다 쓰러지면 실패
    playerDown: () => { p.hp = 0; p.dead = true; p.downed = true; p.state = 'dead'; p.act = null; p.charge = 0; p.deadT = 0; shakeT = 4; text(p.x, p.y, 40, '쓰러짐!', '#ff6a5a', true); },
    revive: () => {
      if (!p.downed) return;
      p.dead = false; p.downed = false; p.hp = Math.round(p.maxHp * REVIVE_HP); p.state = 'idle'; p.iframes = 2; p.deadT = 0;
      text(p.x, p.y, 40, '일어났다!', '#7dff8a', true); sparks(p.x, p.y, 14, 14, '#7dff8a'); Sfx.levelUp();
    },
    finishParty: kind => { if (!ended) { if (p.downed) { p.dead = false; p.downed = false; p.hp = 1; } finish(kind); } },  // 방장과 같이 계단으로
  };
})();
