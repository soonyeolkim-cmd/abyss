// 마을(2026-10-24 사용자: 메뉴가 아니라 걸어 다니는 실제 마을): 0x72 벽돌로 만든 성벽 안 광장.
// 위쪽 벽에 움푹 들어간 자리 셋(대장장이 · 던전 입구 · 상점), 왼쪽에 세공사(감정사는 2026-10-24 없앰). 가까이 가서 X(패드 A)로 말을 건다.
// 싸움은 없다 — 걷기만. 가방 · 속성석 · 보석 관리 · 설정은 Esc(메뉴) · I(가방).
const Town = (() => {
  // 2026-10-24 사용자 '마을 좀만 작게': 34x22 → 30x17 칸(화면 한 장 크기)
  const MAP = [
    '##############################',
    '##############################',
    '###......####....####......###',
    '###......####....####......###',
  ];
  for (let i = 0; i < 11; i++) MAP.push('#' + '.'.repeat(28) + '#');
  MAP.push('##############################', '##############################');
  const W = MAP[0].length, H = MAP.length;

  // 말 걸 수 있는 곳: x, y = 발밑(픽셀). sprite 없으면 사람이 아닌 곳(던전 입구)
  // NPC 고르기 창에 함께 넣는 '장비 관리'(2026-10-24 사용자: 대장장이 · 상인에게도)
  const EQUIP_ITEM = { label: '장비 관리', go: () => Game.overlay({ type: 'inv', mode: 'equip' }) };
  const px = (tx, ty) => ({ x: tx * T + 8, y: ty * T + 12 });
  const STATIONS = [
    { id: 'smith', name: '대장장이 브론', role: '주문서 강화 · 강화 옮기기 · 장비 팔기 · 관리', sprite: 'dwarf_f', ...px(5, 3), x: 6 * T,
      go: () => Game.overlay({ type: 'choice', title: '대장장이 브론', items: [
        { label: '주문서 강화 · 강화 옮기기', go: () => Game.overlay({ type: 'smith' }) },
        { label: '장비 팔기', go: () => Game.overlay({ type: 'inv', mode: 'sell' }) },
        EQUIP_ITEM,
        { label: '강화 이야기 듣기', go: () => Story.talkNpc('smith') },  // 2026-10-25 사용자: 기존 NPC도 대화로 설명
      ] }) },
    { id: 'gate', name: '던전 입구', role: '던전 고르기', ...px(14, 3), x: 15 * T, go: () => { if (!Coop.guestBlocked()) Game.open('select'); } },  // 파티 손님은 방장이 고른다
    { id: 'shop', name: '상인 엘린', role: '장비 팔기 · 아이템 사고팔기 · 관리', sprite: 'elf_m', ...px(23, 3), x: 24 * T,
      go: () => Game.overlay({ type: 'choice', title: '상인 엘린', items: [
        // 2026-10-24 사용자: 장비 / 아이템으로 나눔
        { label: '장비 팔기', go: () => Game.overlay({ type: 'inv', mode: 'sell' }) },
        { label: '아이템 사고팔기', go: () => Game.overlay({ type: 'shopItems' }) },  // 장비 칸 + 가방(등급 보며 팔기), 대장장이 '장비 팔기'와 같은 창
        EQUIP_ITEM,
        { label: '가게 이야기 듣기', go: () => Story.talkNpc('shop') },
      ] }) },
    // 도박꾼 단지(2026-10-25 사용자: 항아리는 도박꾼 NPC 를 따로, 항아리를 뒤집어쓴 도트) — 가운데 아래 빈 곳(2026-10-25 사용자, 처음 대장장이 아래 → 상점 아래 → 여기),
    // 양옆 항아리 더미(JAR_PILE) · 위에 '대박 기원' 현수막 · 항아리에 부적 · 가끔 뽑기를 꼬드기는 속삭임(GAMBLER_LINES)
    { id: 'gambler', name: '도박꾼 단지', role: '장비 항아리 (부위 골라 뽑기)', sprite: 'gambler', ...px(14, 12), x: 15 * T, flip: false,
      go: () => Game.overlay({ type: 'choice', title: '도박꾼 단지', items: [
        { label: '항아리 깨기 (장비 뽑기)', go: () => Game.overlay({ type: 'jar' }) },
        EQUIP_ITEM,
        { label: '항아리 이야기 듣기', go: () => Story.talkNpc('gambler') },
      ] }) },
    { id: 'jewel', name: '세공사 미라', role: '속성석 · 보석 합치기 · 관리', sprite: 'wizzard_f', ...px(2, 9), flip: false,
      go: () => Game.overlay({ type: 'choice', title: '세공사 미라', items: [
        { label: '속성석 · 보석 합치기', go: () => Game.overlay({ type: 'stones', mode: 'craft' }) },
        { label: '속성석 · 보석 관리', go: () => Game.overlay({ type: 'manage' }) },
        EQUIP_ITEM,
        { label: '속성석 · 보석 이야기 듣기', go: () => Story.talkNpc('jewel') },
      ] }) },
    // 창고(2026-10-24 사용자): 유니크 컬렉션. 사람 대신 상자
    { id: 'vault', name: '창고', role: '유니크 컬렉션 · 부위별 달성률', prop: 'chest_full_open_anim_f0', ...px(27, 9), go: () => Game.overlay({ type: 'vault' }) },
    // 파수꾼 카엘(2026-10-25 사용자: 카엘이 마을에 있었으면) — 던전 입구 왼쪽을 지킨다. 몸 = 검사 몸 + 갈색 두건 · 흰 수염 · 망토(assets/dt/kael.png)
    { id: 'kael', name: '파수꾼 카엘', role: '조언 · 이야기 다시 보기', sprite: 'kael', ...px(12, 6), flip: false,
      go: () => Game.overlay({ type: 'choice', title: '파수꾼 카엘', items: [
        { label: '이야기 듣기', go: () => Story.talkNpc('kael') },
        { label: '처음 이야기 다시 보기', go: () => Story.replay() },
      ] }) },
    // 늙은 광부 오르반(2026-10-25 사용자: 여기는 지하 도시이고 바깥은 위험하다는 사람) — 오른쪽 아래 무너진 옛 갱도 입구 옆(왼쪽 아래는 마을 패널이 가림)
    { id: 'miner', name: '늙은 광부 오르반', role: '지하 도시 이야기', sprite: 'miner', ...px(23, 13), flip: false, go: () => Story.talkNpc('miner') },
  ];
  const SHAFT = [26, 13];  // 무너진 옛 갱도 입구(광부 옆, 상자 둘 사이)
  const JAR_PILE = [[13, 12, 1], [16, 12, 0.8], [17, 12, 0.65]];  // 도박꾼 양옆 항아리(칸 x, y, 크기) — 막히는 칸, 그림은 Jar.jarArt
  const BANNER = { x0: 13 * T + 2, x1: 17 * T - 2, y: 8 * T + 4, h: 15 };  // 현수막(게임 좌표): 양 끝 기둥 · 붉은 천
  const GAMBLER_LINES = ['오늘은 왠지 유니크 각인데…', '한 번만 더? 크흐흐', '깨 보기 전엔 아무도 몰라~', '유니크 3%! 오늘은 너다', '방금 누가 유니크 떴다던데?', '꽝도 추억이지, 크흐흐'];
  const TALK_R = 26;
  const TOWN_SPEED = 1.6;  // 마을에서는 던전보다 60% 빠르게 걷는다(2026-10-24 사용자)

  let lv = null, p = null, prof = null, time = 0, near = null;
  const cam = { x: 0, y: 0 };

  function build() {
    const tiles = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = MAP[y][x] === '.' ? 1 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    // 깃발은 던전 입구 양옆 벽에만(2026-10-25 사용자: 위쪽 벽에 무작위로 붙은 깃발이 이상함) — 입구 구멍 바로 옆 칸(12, 3) · (17, 3)
    const def = { plain: true, banners: [[12, 3, 'wall_banner_red'], [17, 3, 'wall_banner_red']], tint: '#d8c8b0' };
    const m = { def, W, H, tiles, at, rooms: [], columns: [], crates: new Set(), decor: { skulls: [] }, start: null };
    // 광장 기둥 넷 + 상점 · 대장장이 앞 상자(막히는 것)
    for (const c of [[9, 7], [20, 7], [9, 12], [20, 12]]) m.columns.push(c);
    for (const c of [[21, 2], [26, 2], [3, 2], [8, 2]]) { m.columns.push(c); m.crates.add(c.join()); }
    // 꾸미기(2026-10-25 사용자: 마을을 예쁘게 · 창고 주변): 창고 양옆 상자 더미 · 무너진 옛 갱도(구멍 + 막아 둔 상자)
    for (const c of [[28, 7], [28, 11], [25, 13], [27, 13]]) { m.columns.push(c); m.crates.add(c.join()); }
    m.columns.push(SHAFT); m.hidden = new Set([SHAFT.join()]);  // 구멍: 막히지만 기둥 그림은 안 그림(바닥에 따로)
    for (const [x, y] of JAR_PILE) { m.columns.push([x, y]); m.hidden.add(x + ',' + y); }  // 항아리: 막히고 그림은 따로
    m.canvas = Dungeon.paint(m);
    m.painted = Gfx.ready();  // 그림 파일이 아직 안 읽혔으면 그릴 때 다시
    return m;
  }

  // 들어오기: fromGate = 던전 · 고르기에서 돌아올 때(입구 앞에서 시작)
  function enter(pr, fromGate) {
    prof = pr;
    if (!lv) lv = build();
    p = createPlayer(prof);
    const s = fromGate ? px(14, 5) : px(14, 7);  // 아래 가운데는 도박꾼 가판(현수막)이라 광장 위쪽에서
    p.x = 15 * T; p.y = s.y; p.fv = { x: 0, y: fromGate ? 1 : -1 };
    if (prof.story && prof.story.openingAgain) { delete prof.story.openingAgain; Save.write(prof); Story.replay(); }  // 예전 캐릭터: 오프닝 한 번
    else if (fromGate) Story.townArrive();  // 보스를 쓰러뜨리고 돌아왔으면 카엘이 한마디
  }

  function update(dt) {
    time += dt;
    if (Input.wasPressed('pause')) { Game.overlay({ type: 'choice', title: '마을 메뉴', items: TOWN_MENU() }); return; }
    if (Input.wasPressed('inv')) { Game.overlay({ type: 'inv', mode: 'equip' }); return; }
    const m = moveInput();
    if (m) {
      const sp = p.cls.speed * (1 + p.stats.move / 100) * TOWN_SPEED;
      Dungeon.move(lv, p, m.x * sp * dt, m.y * sp * dt, BODY_R);
      p.fv = unit(m.x, m.y, p.fv);
      p.state = 'walk'; p.walkT += dt;
    } else p.state = 'idle';
    // 가장 가까운 말 걸 곳
    near = null;
    let bd = TALK_R;
    for (const s of STATIONS) { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; near = s; } }
    if (near && (Input.wasPressed('ok') || Input.wasPressed('attack'))) { Sfx.pickup(); near.go(); }
  }

  const TOWN_MENU = () => [
    { label: '파티 (온라인 협동)', go: () => Game.overlay({ type: 'coop' }) },  // 2026-10-25 사용자: 방 코드로 2명
    { label: '장비 스테이터스', go: () => Game.overlay({ type: 'inv', mode: 'equip' }) },
    { label: '속성석 · 보석 관리', go: () => Game.overlay({ type: 'manage' }) },
    { label: '설정 · 조작', go: () => Game.overlay({ type: 'settings' }) },
    { label: '이야기 다시 보기', go: () => Story.replay() },  // 오프닝 · 카엘의 인사(2026-10-25)
    { label: '캐릭터 선택 화면으로', go: () => Game.toTitle() },  // 지우기 · 코드는 캐릭터 선택 화면에서(2026-10-24)
  ];

  function draw(ctx) {
    if (!lv.painted && Gfx.ready()) { lv.canvas = Dungeon.paint(lv); lv.painted = true; }
    const viewH = VIEW_H;
    cam.x = Math.round(Math.max(0, Math.min(W * T - VIEW_W, p.x - VIEW_W / 2)));
    cam.y = Math.round(Math.max(0, Math.min(H * T - viewH, p.y - 10 - viewH / 2)));
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(lv.canvas, 0, 0);
    // 분수(벽 앞면 둘) · 던전 입구 계단
    for (const fx of [10.5, 18.5]) {  // 입구 양옆 벽 가운데
      Gfx.spr(ctx, 'wall_fountain_top_1', fx * T, 2 * T, { topLeft: true });
      Gfx.spr(ctx, Gfx.anim('wall_fountain_mid_blue_anim', time, 6, 3), fx * T, 3 * T, { topLeft: true });
      Gfx.spr(ctx, Gfx.anim('wall_fountain_basin_blue_anim', time, 6, 3), fx * T, 4 * T, { topLeft: true });
    }
    Gfx.spr(ctx, 'floor_stairs', 14 * T, 2 * T, { topLeft: true });
    Gfx.spr(ctx, 'floor_stairs', 15 * T, 2 * T, { topLeft: true });
    drawFloorDecor(ctx);
    // 앞뒤(y) 정렬: 기둥 · 상자 · 사람
    const list = [];
    for (const c of lv.columns) {
      if (lv.hidden && lv.hidden.has(c.join())) continue;  // 막기만 하는 칸(옛 갱도 구멍)
      const x = c[0] * T + 8, y = (c[1] + 1) * T, crate = lv.crates.has(c.join());
      list.push({ y: crate ? y - 4 : y, draw: () => Gfx.spr(ctx, crate ? 'crate' : 'column', x, crate ? y - 2 : y) });
    }
    // 상점 진열: 상자 위 물약(상자보다 앞에 그린다)
    list.push({ y: 3 * T, draw: () => { Gfx.spr(ctx, 'flask_big_red', 21 * T + 8, 2 * T + 8); Gfx.spr(ctx, 'flask_big_blue', 26 * T + 8, 2 * T + 8); } });
    // 창고 진열: 상자 위 금빛 · 초록 물약, 오른쪽 벽에 기대 놓은 이름난 무기 셋(유니크 컬렉션 느낌)
    list.push({ y: 8 * T, draw: () => Gfx.spr(ctx, 'flask_big_yellow', 28 * T + 8, 7 * T + 8) });
    list.push({ y: 12 * T, draw: () => Gfx.spr(ctx, 'flask_big_green', 28 * T + 8, 11 * T + 8) });
    list.push({ y: 9 * T + 6, draw: () => {
      [['weapon_golden_sword', -0.18], ['weapon_red_gem_sword', -0.06], ['weapon_lavish_sword', 0.06]].forEach(([w, r], i) =>
        Gfx.spr(ctx, w, 28 * T + 4 + i * 4, 10 * T + 4, { rot: r }));
    } });
    for (const [x, y, k] of JAR_PILE) list.push({ y: (y + 1) * T - 2, draw: () => {
      const s = Math.round(17 * k), jx = Math.round(x * T + 8 - s / 2), jy = (y + 1) * T - 1 - s;
      Art.shadow(ctx, x * T + 8, (y + 1) * T - 2, 6 * k, 0, 1);
      ctx.drawImage(Jar.jarArt(), jx, jy, s, s);
      // 노란 부적(붉은 글씨 자국) — 바람에 살랑
      const fx = jx + Math.round(s * 0.55), fy = jy + Math.round(s * 0.42), sw = Math.round(Math.sin(time * 2.4 + x) * 0.6);
      ctx.fillStyle = '#f0d860'; ctx.fillRect(fx + sw, fy, 3, 6);
      ctx.fillStyle = '#c02020'; ctx.fillRect(fx + sw + 1, fy + 1, 1, 1); ctx.fillRect(fx + sw, fy + 3, 3, 1); ctx.fillRect(fx + sw + 1, fy + 4, 1, 1);
    } });
    // 현수막: 양 끝 나무 기둥(바닥까지) + 붉은 천 · 금 테두리(글자는 아래 화면 좌표에서)
    list.push({ y: 12 * T + 2, draw: () => {
      const { x0, x1, y, h } = BANNER, sag = Math.sin(time * 1.6) * 0.6;
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(x0 - 2, y - 3, 2, 13 * T - y + 3); ctx.fillRect(x1, y - 3, 2, 13 * T - y + 3);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(x0 - 2, y - 3, 1, 13 * T - y + 3); ctx.fillRect(x1, y - 3, 1, 13 * T - y + 3);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x0 - 3, y - 4, 4, 2); ctx.fillRect(x1 - 1, y - 4, 4, 2);  // 기둥 머리 금 장식
      ctx.fillStyle = '#7a1418'; ctx.fillRect(x0, Math.round(y + sag), x1 - x0, h);
      ctx.fillStyle = '#b02028'; ctx.fillRect(x0, Math.round(y + sag) + 1, x1 - x0, h - 3);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x0, Math.round(y + sag) + 1, x1 - x0, 1); ctx.fillRect(x0, Math.round(y + sag) + h - 2, x1 - x0, 1);
      ctx.fillStyle = '#5a0c10'; for (let fx = x0 + 2; fx < x1; fx += 4) ctx.fillRect(fx, Math.round(y + sag) + h, 2, 1);  // 술
    } });
    for (const s of STATIONS) if (s.prop) list.push({ y: s.y, draw: () => { Art.shadow(ctx, s.x, s.y, 7, 0, 1); Gfx.spr(ctx, s.prop, s.x, s.y); } });
    for (const s of STATIONS) if (s.sprite) list.push({ y: s.y, draw: () => {
      Art.shadow(ctx, s.x, s.y, 6, 0, 1);
      Gfx.spr(ctx, Gfx.anim(s.sprite + '_idle_anim', time + s.x * 0.01, 6), s.x, s.y, { flip: !!s.flip });
    } });
    list.push({ y: p.y, draw: () => { Art.shadow(ctx, p.x, p.y, 6, 0, 1); Art.player(ctx, p, time); } });
    const mates = Coop.townMates();  // 파티원(2026-10-25 사용자: 마을에서부터 같이 보이게, 최대 3명)
    for (const m of mates) list.push({ y: m.y, draw: () => { Art.shadow(ctx, m.x, m.y, 6, 0, 1); Art.player(ctx, m, time); } });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    // 창고 둘레 따뜻한 빛(보물이 있는 곳 느낌, 살짝 일렁임)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gx = 27 * T + 8, gy = 9 * T + 6, gr = 46 + Math.sin(time * 2) * 2;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, 'rgba(255,196,90,0.22)'); g.addColorStop(1, 'rgba(255,196,90,0)');
    ctx.fillStyle = g; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    ctx.restore();
    ctx.restore();
    // 둘레를 살짝 어둡게
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 300);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // ── 글자(960x540 화면 좌표) ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = x => (x - cam.x) * SCALE, sy = y => (y - cam.y) * SCALE;
    for (const s of STATIONS) {
      const on = s === near, hy = sy(s.y) - (s.sprite ? 62 : 44);
      Gfx.text(ctx, s.name, sx(s.x), hy, on ? 15 : 12, on ? '#ffd36a' : '#e8dcc0', 'center');
      if (on) {
        Gfx.text(ctx, s.role, sx(s.x), hy + 18, 11, '#c8b8a0', 'center');
        const k = L('ok') + ' 말 걸기';
        ctx.font = 'bold 13px ' + Gfx.FONT;
        const w = ctx.measureText(k).width + 16;
        Gfx.panel(ctx, sx(s.x) - w / 2, hy - 44, w, 24, { border: '#ffd36a' });
        Gfx.text(ctx, k, sx(s.x), hy - 27, 13, '#ffd36a', 'center');
      }
    }
    // 도박꾼 현수막 글 · 속삭임(말 걸 만큼 가까우면 '말 걸기'가 그 자리라 안 띄움): 7초마다 한 줄, 4초 보이고 흐려진다
    const bn = BANNER, bcx = sx((bn.x0 + bn.x1) / 2), pulse = 0.5 + 0.5 * Math.sin(time * 3);
    Gfx.text(ctx, '★ 대박 기원 ★', bcx, sy(bn.y + Math.sin(time * 1.6) * 0.6) + 20, 13, 'rgb(255,' + Math.round(208 + 30 * pulse) + ',' + Math.round(90 + 60 * pulse) + ')', 'center');
    const gb = STATIONS.find(s => s.id === 'gambler');
    if (near !== gb) {
      const ph = time % 7, ga = ph < 0.4 ? ph / 0.4 : ph > 3.6 ? Math.max(0, (4 - ph) / 0.4) : 1;
      if (ph < 4) {
        const line = GAMBLER_LINES[Math.floor(time / 7) % GAMBLER_LINES.length], gx = sx(gb.x), gy = sy(gb.y) - 92;
        ctx.save(); ctx.globalAlpha = ga;
        ctx.font = 'bold 12px ' + Gfx.FONT;
        const w = ctx.measureText(line).width + 18;
        Gfx.panel(ctx, gx - w / 2, gy - 17, w, 24, { border: '#e8a050', bg: '#2a1a24' });
        ctx.fillStyle = '#e8a050'; ctx.beginPath(); ctx.moveTo(gx - 5, gy + 7); ctx.lineTo(gx + 5, gy + 7); ctx.lineTo(gx, gy + 13); ctx.fill();
        Gfx.text(ctx, line, gx, gy, 12, '#ffe0b0', 'center');
        ctx.restore();
      }
    }
    // 파티원 머리 위 이름표(파티 순서 색)
    for (const m of mates) Gfx.text(ctx, clsOf(m.prof).name + ' Lv.' + (m.lv || '?'), sx(m.x), sy(m.y) - 62, 12, Coop.colorOf(m.pid), 'center');
    Coop.drawBubbles(ctx, p, sx, sy);  // 파티 말풍선: 강화 · 합치기 · 유니크(내 머리 위 · 파티원 머리 위)
    // 아래 왼쪽: 마을 이름 · 캐릭터
    const by = 438;
    Gfx.panel(ctx, 12, by, 250, 66);
    Gfx.text(ctx, '지하 도시 벨록', 26, by + 26, 18, '#f0e0b8');
    Gfx.text(ctx, clsOf(prof).name + ' Lv.' + prof.lv, 250, by + 26, 15, '#e8dcc0', 'right');  // 마을 이름이 길어져(지하 도시 벨록) 오른쪽 끝에 맞춤
    Gfx.spr(ctx, 'coin_anim_f0', 34, by + 56, { scale: 2 });
    Gfx.text(ctx, prof.gold + 'G', 48, by + 54, 14, '#ffd34d');
    Gfx.text(ctx, '물약 ' + prof.potions, 140, by + 54, 14, '#ff9a9a');
    // 파티 방이 열려 있으면 그 위에 파티원 한 줄씩(창을 닫아도 방은 그대로)
    const lines = Coop.panelLines();
    if (lines.length) {
      const ph = 14 + lines.length * 20, py = by - 6 - ph;
      Gfx.panel(ctx, 12, py, 250, ph, { border: '#b48cff' });
      lines.forEach((l, i) => Gfx.text(ctx, l.s, 26, py + 22 + i * 20, 13, l.col));
    }
    const hint = '이동 ' + L('move') + ' · 말 걸기 ' + L('ok') + ' · 가방 ' + L('inv') + ' · 메뉴 ' + L('pause');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 512, 960, 28);
    Gfx.text(ctx, hint, 480, 531, 13, '#a89c98', 'center');
  }
  const L = a => Input.label(a);

  // 바닥 꾸미기(사람 아래): 창고 앞 붉은 양탄자(금 테두리 · 마름모 무늬) · 흩어진 금화, 옛 갱도 구멍 + 둘레 돌 부스러기
  function drawFloorDecor(ctx) {
    // 양탄자: 창고 칸 둘레 4 x 3 칸(25~28, 8~10)
    const x0 = 25 * T + 3, y0 = 8 * T + 4, w = 4 * T - 6, h = 3 * T - 6;
    ctx.fillStyle = '#4a1a1e'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#c8962e'; ctx.fillRect(x0 + 2, y0 + 2, w - 4, 1); ctx.fillRect(x0 + 2, y0 + h - 3, w - 4, 1); ctx.fillRect(x0 + 2, y0 + 2, 1, h - 4); ctx.fillRect(x0 + w - 3, y0 + 2, 1, h - 4);
    ctx.fillStyle = '#6e2a2e'; ctx.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
    ctx.fillStyle = '#a8742a';  // 마름모 무늬 셋
    for (let k = 0; k < 3; k++) {
      const cx = x0 + w * (k + 1) / 4, cy = y0 + h / 2;
      for (let d = 0; d < 5; d++) { ctx.fillRect(Math.round(cx - d), Math.round(cy - 5 + d), 1, 1); ctx.fillRect(Math.round(cx + d), Math.round(cy - 5 + d), 1, 1); ctx.fillRect(Math.round(cx - d), Math.round(cy + 5 - d), 1, 1); ctx.fillRect(Math.round(cx + d), Math.round(cy + 5 - d), 1, 1); }
    }
    ctx.fillStyle = '#2e1012'; for (let x = x0 + 1; x < x0 + w; x += 3) { ctx.fillRect(x, y0 - 1, 1, 1); ctx.fillRect(x, y0 + h, 1, 1); }  // 술 장식
    // 흩어진 금화(빙글)
    for (const [cx, cy, o] of [[25.6, 10.4, 0], [26.3, 10.7, 0.3], [27.9, 10.5, 0.6], [25.4, 8.6, 0.9]]) Gfx.spr(ctx, Gfx.anim('coin_anim', time + o, 8), cx * T, cy * T);
    // 옛 갱도: 구멍 + 둘레 돌 부스러기
    Gfx.spr(ctx, 'hole', SHAFT[0] * T, SHAFT[1] * T, { topLeft: true });
    ctx.fillStyle = '#6a5e58';
    for (const [dx, dy] of [[-3, 14], [2, 15], [15, 13], [18, 2], [-2, 3], [9, 17], [13, 16]]) ctx.fillRect(SHAFT[0] * T + dx, SHAFT[1] * T + dy, 2, 1);
  }

  // 장비가 바뀌면 걷는 속도 등 다시
  function refresh() { if (p) p.stats = Items.playerStats(prof); }

  return { enter, update, draw, refresh, get player() { return p; }, get near() { return near; }, STATIONS };
})();
