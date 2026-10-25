// 던전 한 번 들어갔다 나오기(런) — 디아블로식: 이어진 넓은 층을 카메라가 따라가며 탐험한다.
// 몹은 방마다 무리로 자고 있다가 깨어나고(정예 · 고유 몹 포함), 가장 큰 방에 보스가 있다. 보스를 잡으면 상자 + 계단.
const World = (() => {
  let lv = null, p = null, prof = null, dIdx = 0;
  let enemies = [], shots = [], pshots = [], fx = [], texts = [], fields = [];  // shots = 몹 탄, pshots = 플레이어 검기
  let hitstopT = 0, shakeT = 0, time = 0;
  let comboN = 0, comboT = 0, msg = null, msgT = 0, bagFullT = 0;
  let run = null, ended = null, bossAwake = false;
  let flow = null, flowT = 0, lastTile = -1;
  const cam = { x: 0, y: 0 };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dlv = () => lv.def.lv;
  const packAdd = () => Math.min(dIdx, 5);  // 뒤 던전일수록 무리가 크다(용암 지옥 +5 에서 멈춤)

  function start(def, profile, diff = 0) {
    RUN.diff = diff;
    RUN.ease = def.ease || null;  // 던전마다 몹 세기 낮춤(역병 하수도 2026-10-25)
    lv = Dungeon.generate(def);
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
    hitstopT = 0; shakeT = 0; time = 0; comboN = 0; flow = null; flowT = 0; lastTile = -1;
    populate();
    placeHazards();
    msg = def.name + (diff ? ' · ' + DIFFS[diff].name : ''); msgT = 2.4;
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
        enemies.push(b);
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
  function addPack(pack, e) { pack.members.push(e); enemies.push(e); }

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
    if (!flow) return null;
    const W = lv.W, tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
    const here = flow[ty * W + tx];
    if (here < 0) return null;
    let best = null, bd = here;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy, v = flow[ny * W + nx];
      if (v < 0 || v >= bd) continue;
      if (dx && dy && (lv.at(tx + dx, ty) !== 1 || lv.at(tx, ty + dy) !== 1)) continue;  // 모서리 끼임 방지
      bd = v; best = [nx, ny];
    }
    if (!best) return unit(p.x - e.x, p.y - e.y, e.fv);
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

    // 탐험한 칸 표시(자동 지도) · 길찾기 거리표
    const tile = Math.floor(p.y / T) * lv.W + Math.floor(p.x / T);
    if (tile !== lastTile) {
      lastTile = tile;
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), R = 8;
      for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) {
        if (x < 0 || y < 0 || x >= lv.W || y >= lv.H || (x - tx) ** 2 + (y - ty) ** 2 > R * R) continue;
        lv.explored[y * lv.W + x] = 1;
      }
    }
    flowT -= dt;
    if (flowT <= 0) { flowT = 0.3; flow = Dungeon.bfs(lv, Math.floor(p.x / T), Math.floor(p.y / T), 45); }

    updatePlayer(p, dt, lv, true);
    assignRoles(enemies, p);
    for (const e of enemies) {
      // 멀리서 자는 몹은 상태이상만 흐르게(아무것도 안 한다)
      if (!e.awake && Math.abs(e.x - p.x) > 360 && Math.abs(e.y - p.y) > 260) continue;
      updateEnemy(e, dt, lv, p);
    }
    separateEnemies(enemies, lv, p);
    enemies = enemies.filter(e => !(e.state === 'dead' && e.t > (e.def.boss ? 1.6 : 1.2)));
    updateShots(dt);
    updatePlayerShots(dt);
    updateFields(dt);
    updateHazards(dt);
    Elements.step(dt);  // 뇌운 · 연쇄 폭발처럼 잠깐 뒤에 터지는 것
    updateDrops(dt);
    updateChests(dt);

    comboT -= dt;
    if (comboT <= 0) comboN = 0;

    // 보스방에 들어서면 보스가 깨어난다
    if (!bossAwake && Dungeon.roomAt(lv, p.x, p.y) === lv.boss) {
      bossAwake = true;
      const b = enemies.find(e => e.rank === 'boss');
      if (b) { b.awake = true; b.spawnT = 0.8; msg = b.name; msgT = 2.2; Sfx.roar(); shake(4); }
    }
    // 계단: 밟으면 물어본다(실수로 나가지 않게). 내려섰다가 다시 밟으면 또 묻는다
    if (lv.stairs && !p.dead) {
      const d = Math.hypot(p.x - lv.stairs.x, p.y - lv.stairs.y);
      if (d < 12 && !lv.stairs.asked) {
        lv.stairs.asked = true;
        Game.overlay({ type: 'confirm', text: '계단을 올라 마을로 돌아갈까요?', defaultYes: true, yes: () => { Sfx.stairs(); finish('clear'); } });
      }
      if (d > 22) lv.stairs.asked = false;
    }
    if (p.dead && p.deadT > 1.6 && !ended) finish('dead');
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
      if (s.life > 0 && !p.dead && Math.hypot(p.x - s.x, (p.y - 8) - s.y) < s.r + BODY_R + 2) {
        if (hurtPlayer(p, s, s.dmg, s.knock) !== 'miss') { s.life = 0; sparks(s.x, s.y + 8, 8, 5, s.color); if (s.chill) p.slowT = 2; }  // 얼음 임프 탄: 느려짐
      }
    }
    shots = shots.filter(s => s.life > 0);
  }

  // 플레이어 검기: 몹을 꿰뚫으며(한 마리에 한 번) 날아가고, 벽이나 사거리 끝에서 사라진다
  function updatePlayerShots(dt) {
    for (const s of pshots) {
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
      if (landed) hitstopT = Math.max(hitstopT, 0.04);
      if (landed && s.once) { s.gone = true; if (s.onEnd) s.onEnd(s); }  // 화염구: 처음 닿은 적 자리에서 터진다
    }
    pshots = pshots.filter(s => !s.gone);
  }

  // 장판: 0.5초마다 안에 있는 몹에게 속성 효과
  function updateFields(dt) {
    for (const f of fields) {
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
        fx.push({ type: 'burst', x: f.x, y: f.y, r: f.r * 1.1, col: f.col, t: 0, life: 0.4 });
        sparks(f.x, f.y - 6, 16, 18, f.col);
        Elements.chargeBurst(Object.assign(Object.create(p), { x: f.x, y: f.y }));
        Sfx.blast(); shake(4);
        if (landed) hitstopT = Math.max(hitstopT, 0.07);
      }
      // 화염 강화 몹의 죽음 폭발: 예고 뒤 한 번 터진다
      if (f.blast && !f.done && f.t >= f.delay) {
        f.done = true;
        fx.push({ type: 'burst', x: f.x, y: f.y, r: f.r, col: ELEMENTS.fire.color, t: 0, life: 0.35 });
        Sfx.blast(); shake(3);
        if (Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) < f.r + BODY_R) hurtPlayer(p, f, f.dmg, 160);
      }
    }
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
        const scrolls = c.big || Math.random() < 0.3 ? [rollScroll()] : [];
        loot(c.x, c.y - 4, { gold: goldRoll(c.big ? [40, 70] : [15, 30]), items, stones, scrolls });
        text(c.x, c.y, 24, c.big ? '보물 상자!' : '상자', '#ffd36a');
      }
      if (c.open) c.t += dt;
    }
  }

  // ── 몹이 쓰러짐 ──
  function onKill(e) {
    Elements.onDeath(e);  // 연쇄 폭발(화염 패시브)
    const d = e.def;
    run.kills++;
    Sfx.kill();
    const rankExp = e.rank === 'unique' ? 5 : e.rank === 'elite' ? 2 : 1;
    gainExp(Math.round(d.exp * rankExp * POWER(dlv()) * DIFFS[RUN.diff].exp * lowExp(prof.lv, dlv())));  // 낮은 던전은 경험치 줄어듦  // 역할 경험치 × 던전 레벨 곡선
    if (p.stats.life) p.hp = Math.min(p.maxHp, p.hp + p.stats.life);
    if (p.stats.fx.vamp) p.hp = Math.min(p.maxHp, p.hp + Math.max(2, Math.round(p.maxHp * UNIQUE_FX.vamp)));  // 유니크 흡혈 칼날
    // 화염 강화: 죽은 자리에 잠시 뒤 불꽃 폭발(예고 원)
    if ((e.affixes && e.affixes.includes('fire')) || d.deathBlast) fields.push({ blast: true, x: e.x, y: e.y, r: 26, el: 'fire', t: 0, tick: 99, delay: 0.8, life: 1.1, dmg: 14 * e.dmgMul });
    if (d.boss) {
      const bossItems = [mk(lv.ilvlR[1], { boost: 0.8 })];
      if (Math.random() < UNIQUE_DROP.boss * DIFFS[RUN.diff].uniq * lowUniq(prof.lv, dlv())) bossItems.push(Items.makeUnique(lv.ilvlR[1]));
      loot(e.x, e.y, { gold: goldRoll(d.gold), items: bossItems, stones: [rollStone(STONE_BOSS_BOOST), rollStone(STONE_BOSS_BOOST)], scrolls: [rollScroll(), rollScroll()] });
      shake(5);
      bossCleared(e);
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
      return;
    }
    if (e.rank === 'unique') {
      const uItems = [mk(lv.ilvlR[1], { boost: 0.6 })];
      if (Math.random() < UNIQUE_DROP.unique * DIFFS[RUN.diff].uniq * lowUniq(prof.lv, dlv())) uItems.push(Items.makeUnique(lv.ilvlR[1]));
      loot(e.x, e.y, { gold: goldRoll(d.gold, 4), items: uItems, stones: [rollStone()], scrolls: [rollScroll()] });
      return;
    }
    const elite = e.rank === 'elite';
    const items = Math.random() < (elite ? 0.2 : 0.06) ? [mk(ilvl(), { boost: elite ? 0.3 : 0 })] : [];  // 일반 6% · 정예 20% (예전 13% · 40%)
    const stones = Math.random() < (elite ? 0.15 : 0.07) ? [rollStone()] : [];
    const scrolls = Math.random() < (elite ? 0.1 : 0.04) ? [rollScroll()] : [];
    loot(e.x, e.y, { gold: Math.random() < 0.75 ? goldRoll(d.gold, elite ? 2 : 1) : 0, items, stones, scrolls });
  }

  function gainExp(n) {
    prof.exp += n; run.exp += n;
    while (prof.exp >= expToNext(prof.lv)) {
      prof.exp -= expToNext(prof.lv);
      prof.lv++;
      run.levelUps++;
      refreshStats(p);
      p.hp = p.maxHp;
      Sfx.levelUp();
      text(p.x, p.y, 44, '레벨 업!  Lv.' + prof.lv, '#7dff8a', true);
      msg = '레벨 업! Lv.' + prof.lv; msgT = 1.6;
    }
  }

  // ── 효과 ──
  // big = 타격 불꽃(2026-10-25 사용자 '타격감'): 2px 조각이 더 멀리 튀고 더 오래(0.3~0.55초) 떨어진다
  function sparks(x, y, z, n, col, big) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (big ? 60 : 40) + Math.random() * (big ? 110 : 80);
      fx.push({ type: 'spark', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: (big ? 60 : 40) + Math.random() * (big ? 90 : 70), t: 0,
        life: big ? 0.3 + Math.random() * 0.25 : 0.18 + Math.random() * 0.15, col, s: big && Math.random() < 0.6 ? 2 : 1 });
    }
  }
  // 맞은 자리 번쩍임: 흰 4각 빛이 커지며 사라진다(약 0.1초)
  function impact(x, y, z, r) { fx.push({ type: 'impact', x, y, z, r, rot: Math.random() * 0.8, t: 0, life: 0.11 }); }
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      fx.push({ type: 'dust', x: x + Math.cos(a) * 5, y: y + Math.sin(a) * 3, z: 0, vx: Math.cos(a) * 20, vy: Math.sin(a) * 12, vz: 10 + Math.random() * 15, t: 0, life: 0.4 + Math.random() * 0.2 });
    }
  }
  function text(x, y, z, s, col, big) { texts.push({ x: x + (Math.random() - 0.5) * 4, y, z, s, col, t: 0, life: big ? 1.4 : 0.8, big }); }
  function number(x, y, z, n, col, big) { text(x, y, z, String(n), col, big); }
  function shake(s) { shakeT = Math.max(shakeT, s); }

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
    get msg() { return msgT > 0 ? { s: msg, t: msgT } : null; },
    get comboInfo() { return comboN >= 2 ? { n: comboN, t: comboT } : null; },
    enemies: () => enemies,
    attackers: () => enemies.filter(e => e.state === 'windup' || e.state === 'attack').length,
    shoot: s => shots.push(s),
    playerShot: s => pshots.push(Object.assign({ t: 0 }, s)),
    field: f => fields.push(Object.assign({ t: 0, tick: 0.2 }, f)),
    magicActive: () => fields.some(f => f.magic && !f.done),  // 아직 안 터진 마법진이 있나
    // 상태이상 알갱이(몸에서 피어오름)
    ember: (e, col) => fx.push({ type: 'spark', x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y, z: e.z + Math.random() * e.h, vx: 0, vy: 0, vz: 30, t: 0, life: 0.4, col }),
    summon: (type, boss, n) => {
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2;
        const e = createEnemy(type, boss.x + Math.cos(a) * 30, boss.y + Math.sin(a) * 20, dlv(), { awake: true, spawn: true });
        e.spawnT += k * 0.1;
        enemies.push(e);
        dust(e.x, e.y, 5);
      }
    },
    fx: f => fx.push(f),
    text, number, sparks, impact, dust, onKill, shake,
    hitstop: t => { hitstopT = Math.max(hitstopT, t); },
    combo: () => { comboN++; comboT = 1.8; },
    playerDied: () => { p.hp = 0; p.dead = true; p.state = 'dead'; p.act = null; p.deadT = 0; shakeT = 4; },
  };
})();
