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
    // 던전 입구(2026-10-25 사용자: 도박꾼과 자리 바꿈) — 아래 가운데 내려가는 계단, 양옆 깃대(GATE_POLES)
    { id: 'gate', name: '던전 입구', role: '던전 고르기', ...px(14, 14), x: 15 * T, go: () => { if (!Coop.guestBlocked()) Game.open('select'); } },  // 파티 손님은 방장이 고른다
    { id: 'shop', name: '상인 엘린', role: '장비 팔기 · 아이템 사고팔기 · 관리', sprite: 'elf_m', ...px(23, 3), x: 24 * T,
      go: () => Game.overlay({ type: 'choice', title: '상인 엘린', items: [
        // 2026-10-24 사용자: 장비 / 아이템으로 나눔
        { label: '장비 팔기', go: () => Game.overlay({ type: 'inv', mode: 'sell' }) },
        { label: '아이템 사고팔기', go: () => Game.overlay({ type: 'shopItems' }) },  // 장비 칸 + 가방(등급 보며 팔기), 대장장이 '장비 팔기'와 같은 창
        EQUIP_ITEM,
        { label: '가게 이야기 듣기', go: () => Story.talkNpc('shop') },
      ] }) },
    // 도박꾼 단지(2026-10-25 사용자: 항아리는 도박꾼 NPC 를 따로, 항아리를 뒤집어쓴 도트) — 위쪽 가운데 움푹한 자리(예전 던전 입구, 사용자: 입구와 자리 바꿈),
    // 양옆 항아리 더미(JAR_PILE) · 양옆 벽에 세로 현수막 '대박' · '기원'(VBANNERS) · 항아리에 부적 · 가끔 뽑기를 꼬드기는 속삭임(GAMBLER_LINES)
    { id: 'gambler', name: '도박꾼 단지', role: '장비 항아리 뽑기', sprite: 'gambler', ...px(14, 3), x: 15 * T, flip: false,
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
    // 파수꾼 카엘(2026-10-25 사용자: 카엘이 마을에 있었으면) — 광장 분수 바로 위(사용자: 우물 위쪽으로). 몸 = 검사 몸 + 갈색 두건 · 흰 수염 · 망토(assets/dt/kael.png)
    { id: 'kael', name: '파수꾼 카엘', role: '조언 · 이야기 다시 보기', sprite: 'kael', ...px(14, 7), x: 15 * T, flip: false,
      go: () => Game.overlay({ type: 'choice', title: '파수꾼 카엘', items: [
        { label: '이야기 듣기', go: () => Story.talkNpc('kael') },
        { label: '처음 이야기 다시 보기', go: () => Story.replay() },
      ] }) },
    // 늙은 광부 오르반(2026-10-25 사용자: 여기는 지하 도시이고 바깥은 위험하다는 사람) — 오른쪽 아래 무너진 옛 갱도 입구 옆(왼쪽 아래는 마을 패널이 가림)
    { id: 'miner', name: '늙은 광부 오르반', role: '지하 도시 이야기', sprite: 'miner', ...px(23, 13), flip: false, go: () => Story.talkNpc('miner') },
    // 오르반의 광차(2026-10-25 사용자: 마을 사이 이동 = 광차 타기, 엔딩 뒤에 열림) — 벨록은 오르반 옆 수레, 실베인은 광산 마당 수레(Silvane.POS.cart)
    { id: 'cart', name: '광차', role: '왕의 갱도를 따라 실베인으로', x: 21 * T + 8, y: 14 * T - 3, go: () => rideCart() },
  ];
  const SHAFT = [26, 13];  // 무너진 옛 갱도 입구(광부 옆, 상자 둘 사이)
  const JAR_PILE = [[13, 3, 1], [16, 3, 0.85]];  // 도박꾼 양옆 항아리(칸 x, y, 크기) — 막히는 칸, 그림은 Jar.jarArt
  const VBANNERS = [[12, '대박'], [17, '기원']];  // 도박꾼 자리 양옆 벽 앞면(칸 x, 3)의 세로 현수막 + 글자 둘
  const GATE_POLES = [12, 17];  // 던전 입구 계단(14 · 15, 14) 양옆 깃대(칸 x, 14) — 막히는 칸
  const FOUNTAIN = { x: 15 * T, y: 10 * T, tiles: [[14, 9], [15, 9], [14, 10], [15, 10]] };  // 광장 기둥 넷 가운데 작은 분수(가운데 x · 바닥 y)
  const ANVIL = { x: 7 * T - 2, y: 3 * T - 2 };  // 브론 뒤 모루(가운데 x · 바닥 y)
  // 미라 아래 세공품 진열(2026-10-25 사용자: 더 예쁘게): 떠 있는 보석 받침대 (1,11) · 쪼갠 정동석 (3,11)
  const GEM_STAND = [1, 11], GEODE = [3, 11];
  const CART = [21, 13];  // 오르반 왼쪽 광석 수레(광차) + 짧은 철길 · 기대 둔 곡괭이
  const GAMBLER_LINES = ['오늘은 왠지 유니크 각인데…', '한 번만 더? 크흐흐', '깨 보기 전엔 아무도 몰라~', '유니크 ' + Math.round(JAR.uniq * 100) + '%! 오늘은 너다', '방금 누가 유니크 떴다던데?', '꽝도 추억이지, 크흐흐'];
  // 오르반 혼잣말(2026-10-25 사용자: 오르반도 개성) — 곰방대 문 투덜이 늙은 광부
  const MINER_LINES = ['에헴… 내가 젊었을 땐 말이야…', '후우… 담배 맛이 예전 같지 않구먼', '콜록콜록! 갱도 먼지는 평생 가', '이 수레엔 은이 반이라네, 허허', '저 구멍에서 또 긁는 소리가…', '곡괭이는 배신 안 한다네'];
  const WHISPERS = [
    { id: 'gambler', lines: GAMBLER_LINES, period: 7, off: 0, edge: '#e8a050', bg: '#2a1a24', col: '#ffe0b0' },
    { id: 'miner', lines: MINER_LINES, period: 9, off: 4.5, edge: '#a8946a', bg: '#221c14', col: '#e8dcc0' },
  ];
  const TALK_R = 26;
  const TOWN_SPEED = 1.6;  // 마을에서는 던전보다 60% 빠르게 걷는다(2026-10-24 사용자)

  let lv = null, p = null, prof = null, time = 0, near = null;
  const cam = { x: 0, y: 0 };
  // 마을 지도 둘(2026-10-25 사용자: 다음 마을 실베인): belloc = 지하 도시 벨록, silvane = 땅 위 광산 도시 실베인(js/silvane.js).
  // NPC 는 같은 사람들, 서는 자리만 지도마다(벨록 자리는 STATIONS 에 적힌 것, 실베인 자리는 Silvane.POS).
  // 오가기 = 오르반의 광차(엔딩을 본 뒤 = story['abyss:town']). 마지막에 있던 마을은 prof.where 에 저장 — 켜면 거기서
  let where = 'belloc';
  const maps = {}, HOME = {};
  for (const s of STATIONS) HOME[s.id] = { x: s.x, y: s.y, flip: s.flip, role: s.role };
  const mapOf = w => maps[w] || (maps[w] = w === 'belloc' ? build() : Silvane.build());
  const silvaneOpen = pr => !!(pr && pr.story && pr.story['abyss:town']);
  function place(w) {
    where = w; lv = mapOf(w);
    for (const s of STATIONS) Object.assign(s, w === 'belloc' ? HOME[s.id] : Silvane.POS[s.id]);
  }
  // 다른 마을로 가기: 그 마을 시작 자리로(광차가 도착한 곳)
  function travel(w) {
    place(w);
    spawn();
    prof.where = w; Save.write(prof);
    Sfx.stairs();
    Game.toast(w === 'silvane' ? '광산 도시 실베인' : '지하 도시 벨록');
    Net.refresh();
  }
  // 광차 타기: 엔딩 전이면 오르반이 말림, 뒤면 갱도를 달리는 장면(ride) → 다른 마을
  function rideCart() {
    if (!silvaneOpen(prof)) { Story.talkNpc('cartLocked'); return; }
    Game.overlay({ type: 'ride', to: where === 'belloc' ? 'silvane' : 'belloc', t: 0, last: performance.now(), clack: 0 });
    Sfx.cartGo();
  }
  // 광차 장면(2.8초, 확인 · 뒤로 = 건너뛰기): 어두운 갱도 · 다가오는 나무 버팀목과 등불 · 철길 · 앞에 내가 탄 수레.
  // 위로(실베인) = 끝에서 햇빛이 쏟아져 하얗게, 아래로(벨록) = 점점 어두워져 까맣게 → 마을에서 그 색이 걷히며 나타남(fade)
  const RIDE_T = 2.8;
  let fade = null;  // { col: 'rgb', t } 도착한 마을에서 걷히는 빛 · 어둠
  function rideUpdate(o) {
    const now = performance.now(), dt = Math.min(0.1, (now - o.last) / 1000);
    o.last = now; o.t += dt;
    if ((o.clack -= dt) <= 0) { o.clack = 0.22; Sfx.rail(); }
    if (o.t >= RIDE_T || Input.wasPressed('ok') || Input.wasPressed('back') || Input.wasPressed('pause')) {
      Game.closeOverlay();
      fade = { col: o.to === 'silvane' ? '255,250,235' : '0,0,0', t: 0.7 };
      travel(o.to);
    }
  }
  function rideDraw(ctx, o) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    UI.zone(0, 0, 960, 540, { key: 'ok', now: true });  // 화면 누르면 건너뛰기
    const t = o.t, k = Math.min(1, t / RIDE_T), up = o.to === 'silvane', vx = 480, vy = 220, shake = Math.round(Math.sin(t * 43) * 2);
    ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, 960, 540);
    const g = ctx.createRadialGradient(vx, vy, 0, vx, vy, 520);  // 바위 벽(가운데로 갈수록 어둡게)
    g.addColorStop(0, '#050403'); g.addColorStop(0.5, '#1e1812'); g.addColorStop(1, '#3a2e24');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
    // 철길 · 침목(앞으로 흘러옴)
    ctx.strokeStyle = '#8a92a0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vx - 4, vy + 6); ctx.lineTo(300, 540); ctx.moveTo(vx + 4, vy + 6); ctx.lineTo(660, 540); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const d = ((i + t * 6) % 12) / 12, e = d * d, y = vy + 6 + e * 334, hw = 6 + e * 230;
      ctx.fillStyle = 'rgba(106,74,42,' + (0.3 + d * 0.7) + ')'; ctx.fillRect(vx - hw, y, hw * 2, 2 + e * 12);
    }
    // 나무 버팀목(가까워지며 커짐) + 왼쪽 기둥 등불
    for (let i = 0; i < 7; i++) {
      const d = ((i + t * 2.4) % 7) / 7, e = Math.pow(d, 2.2), w = 30 + e * 1500, h = w * 0.62, th = Math.max(2, w * 0.05);
      const x0 = vx - w / 2, y0 = vy - h * 0.55, a = 0.25 + d * 0.75;
      ctx.fillStyle = 'rgba(90,60,34,' + a + ')';
      ctx.fillRect(x0, y0, th, h); ctx.fillRect(x0 + w - th, y0, th, h); ctx.fillRect(x0, y0, w, th);
      ctx.fillStyle = 'rgba(140,100,60,' + a * 0.6 + ')'; ctx.fillRect(x0, y0, th * 0.35, h); ctx.fillRect(x0, y0, w, th * 0.3);
      if (i % 2 === 0) {
        const lx = x0 + th * 1.6, ly = y0 + h * 0.35, r = 6 + e * 60;
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 3);
        lg.addColorStop(0, 'rgba(255,200,110,' + 0.5 * a + ')'); lg.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = lg; ctx.fillRect(lx - r * 3, ly - r * 3, r * 6, r * 6);
        ctx.fillStyle = 'rgba(255,230,150,' + a + ')'; ctx.fillRect(lx - r * 0.3, ly - r * 0.4, r * 0.6, r * 0.8);
      }
    }
    // 끝의 빛(위로 = 점점 커지는 햇빛)
    if (up) {
      const r = 20 + k * k * 700, lg = ctx.createRadialGradient(vx, vy, 0, vx, vy, r);
      lg.addColorStop(0, 'rgba(255,250,230,' + (0.6 + 0.4 * k) + ')'); lg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, 960, 540);
    }
    // 내가 탄 수레(앞) + 머리 · 어깨
    const cy = 452 + shake;
    Gfx.spr(ctx, clsOf(prof).sprite + '_idle_anim_f0', 480, cy + 40, { scale: 7 });
    ctx.fillStyle = '#16181e'; ctx.fillRect(300, cy - 6, 360, 110);
    ctx.fillStyle = '#5a5e68'; ctx.fillRect(310, cy + 4, 340, 100);
    ctx.fillStyle = '#8a92a0'; ctx.fillRect(300, cy - 6, 360, 8);
    ctx.fillStyle = '#3a3e48'; ctx.fillRect(310, cy + 40, 340, 6); ctx.fillRect(420, cy + 4, 6, 100); ctx.fillRect(534, cy + 4, 6, 100);
    ctx.fillStyle = '#c8962e'; for (const x of [326, 404, 556, 634]) { ctx.fillRect(x, cy + 16, 6, 6); ctx.fillRect(x, cy + 68, 6, 6); }
    // 글 · 끝 무렵 하얗게(위) / 까맣게(아래)
    Gfx.text(ctx, '왕의 갱도 — ' + (up ? '광산 도시 실베인으로' : '지하 도시 벨록으로'), 480, 60, 20, up ? '#ffe8a0' : '#c8b8a0', 'center');
    Gfx.text(ctx, '건너뛰기 ' + L('ok'), 940, 528, 12, '#8a7e88', 'right');
    const endA = Math.max(0, (k - 0.75) / 0.25);
    if (endA > 0) { ctx.fillStyle = 'rgba(' + (up ? '255,250,235' : '0,0,0') + ',' + endA + ')'; ctx.fillRect(0, 0, 960, 540); }
  }
  function spawn() {
    const s = where === 'belloc' ? { x: 15 * T, y: px(14, 12).y } : Silvane.SPAWN;  // 벨록: 아래 입구 바로 위(분수 아래) — 광장 위쪽은 카엘 자리
    p.x = s.x; p.y = s.y; p.fv = { x: 0, y: where === 'belloc' ? -1 : 1 };
  }

  function build() {
    const tiles = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = MAP[y][x] === '.' ? 1 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    // 벽 깃발 없음: 붉은 깃발은 던전 입구(아래 가운데) 양옆 깃대로 옮김(2026-10-25 사용자), 위 가운데 양옆 벽은 도박꾼 세로 현수막
    const def = { plain: true, banners: [], tint: '#d8c8b0' };
    const m = { def, W, H, tiles, at, rooms: [], columns: [], crates: new Set(), decor: { skulls: [] }, start: null };
    // 광장 기둥 넷 + 상점 · 대장장이 앞 상자(막히는 것)
    for (const c of [[9, 7], [20, 7], [9, 12], [20, 12]]) m.columns.push(c);
    for (const c of [[21, 2], [26, 2], [3, 2], [8, 2]]) { m.columns.push(c); m.crates.add(c.join()); }
    // 꾸미기(2026-10-25 사용자: 마을을 예쁘게 · 창고 주변): 창고 양옆 상자 더미 · 무너진 옛 갱도(구멍 + 막아 둔 상자)
    for (const c of [[28, 7], [28, 11], [25, 13], [27, 13]]) { m.columns.push(c); m.crates.add(c.join()); }
    m.columns.push(SHAFT); m.hidden = new Set([SHAFT.join()]);  // 구멍: 막히지만 기둥 그림은 안 그림(바닥에 따로)
    // 막히고 그림은 따로 그리는 칸: 항아리 · 입구 깃대 · 분수 · 모루 · 수정
    const block = c => { m.columns.push(c); m.hidden.add(c.join()); };
    for (const [x, y] of JAR_PILE) block([x, y]);
    for (const x of GATE_POLES) block([x, 14]);
    for (const c of FOUNTAIN.tiles) block(c);
    block([7, 2]);
    block(GEM_STAND); block(GEODE); block(CART);
    m.canvas = Dungeon.paint(m);
    m.painted = Gfx.ready();  // 그림 파일이 아직 안 읽혔으면 그릴 때 다시
    return m;
  }

  // 들어오기: fromGate = 던전 · 고르기에서 돌아올 때(입구 앞에서 시작)
  function enter(pr, fromGate) {
    prof = pr;
    if (!fromGate || !lv) place(silvaneOpen(prof) && prof.where === 'silvane' ? 'silvane' : 'belloc');  // 켤 때 = 마지막에 있던 마을, 던전에서 오면 있던 마을 그대로
    p = createPlayer(prof);
    spawn();
    if (prof.story && prof.story.openingAgain) { delete prof.story.openingAgain; Save.write(prof); Story.replay(); }  // 예전 캐릭터: 오프닝 한 번
    else if (fromGate) Story.townArrive();  // 보스를 쓰러뜨리고 돌아왔으면 카엘이 한마디
  }

  function update(dt) {
    time += dt;
    if (fade && (fade.t -= dt) <= 0) fade = null;
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
    if (!lv.painted && Gfx.ready()) { lv.canvas = where === 'belloc' ? Dungeon.paint(lv) : Silvane.paint(lv); lv.painted = true; }
    const viewH = VIEW_H;
    cam.x = Math.round(Math.max(0, Math.min(lv.W * T - VIEW_W, p.x - VIEW_W / 2)));
    cam.y = Math.round(Math.max(0, Math.min(lv.H * T - viewH, p.y - 10 - viewH / 2)));
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(lv.canvas, 0, 0);
    const list = [];  // 앞뒤(y) 정렬해서 그릴 것
    if (where === 'belloc') bellocWorld(ctx, list); else Silvane.world(ctx, list, time);
    // 오르반: 곰방대 연기(위로 흔들리며 흐려지는 회색 덩이) · 안전모 등불의 따뜻한 빛(일렁임) — 맨 위에
    list.push({ y: 1e6, draw: () => drawMinerFx(ctx, STATIONS.find(s => s.id === 'miner')) });
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
    if (where === 'belloc') {
      // 창고 둘레 따뜻한 빛(보물이 있는 곳 느낌, 살짝 일렁임)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gx = 27 * T + 8, gy = 9 * T + 6, gr = 46 + Math.sin(time * 2) * 2;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, 'rgba(255,196,90,0.22)'); g.addColorStop(1, 'rgba(255,196,90,0)');
      ctx.fillStyle = g; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      ctx.restore();
    } else Silvane.front(ctx, time, cam);
    ctx.restore();
    // 둘레를 살짝 어둡게(지하 벨록만 — 땅 위 실베인은 밝게)
    if (where === 'belloc') {
      const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 300);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // ── 글자(960x540 화면 좌표) ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = x => (x - cam.x) * SCALE, sy = y => (y - cam.y) * SCALE;
    drawLabels(ctx, sx, sy, mates);
    if (fade) { ctx.fillStyle = 'rgba(' + fade.col + ',' + Math.min(1, fade.t / 0.7) + ')'; ctx.fillRect(0, 0, 960, 540); }  // 광차로 도착: 빛 · 어둠이 걷힘
  }

  // 지하 도시 벨록의 바닥 · 벽 장식과 앞뒤 정렬 물건(지도 그림 위, 사람과 섞어 그림)
  function bellocWorld(ctx, list) {
    // 벽 분수 둘(위 가운데 자리 양옆 벽) · 도박꾼 세로 현수막 · 던전 입구 계단(아래 가운데)
    for (const fx of [10.5, 18.5]) {
      Gfx.spr(ctx, 'wall_fountain_top_1', fx * T, 2 * T, { topLeft: true });
      Gfx.spr(ctx, Gfx.anim('wall_fountain_mid_blue_anim', time, 6, 3), fx * T, 3 * T, { topLeft: true });
      Gfx.spr(ctx, Gfx.anim('wall_fountain_basin_blue_anim', time, 6, 3), fx * T, 4 * T, { topLeft: true });
    }
    for (const [bx] of VBANNERS) {  // 붉은 천 · 금 테두리 · 위 막대 · 아래 제비꼬리(글자는 화면 좌표에서)
      const x0 = bx * T + 2, y0 = 2 * T + 7, w = 12, h = 22, sw = Math.round(Math.sin(time * 1.4 + bx) * 0.5);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, 2);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x0 - 3, y0 - 2, 1, 2); ctx.fillRect(x0 + w + 2, y0 - 2, 1, 2);
      ctx.fillStyle = '#7a1418'; ctx.fillRect(x0 + sw, y0, w, h);
      ctx.fillStyle = '#b02028'; ctx.fillRect(x0 + sw + 1, y0, w - 2, h - 1);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x0 + sw + 1, y0 + 1, w - 2, 1); ctx.fillRect(x0 + sw + 1, y0 + h - 2, w - 2, 1);
      ctx.fillStyle = '#7a1418'; for (let i = 0; i < 3; i++) ctx.fillRect(x0 + sw + w / 2 - 3 + i, y0 + h + i - 1, 6 - i * 2, 1);  // 꼬리
    }
    Gfx.spr(ctx, 'floor_stairs', 14 * T, 14 * T, { topLeft: true });
    Gfx.spr(ctx, 'floor_stairs', 15 * T, 14 * T, { topLeft: true });
    drawFloorDecor(ctx);
    // 앞뒤(y) 정렬: 기둥 · 상자
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
    // 던전 입구 양옆 깃대: 나무 기둥 + 붉은 깃발(예전 벽 깃발 그림) + 금 꼭지
    for (const gx of GATE_POLES) list.push({ y: 15 * T - 2, draw: () => {
      const x = gx * T + 7;
      Art.shadow(ctx, x + 1, 15 * T - 2, 4, 0, 1);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(x, 12 * T + 4, 2, 3 * T - 6);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(x, 12 * T + 4, 1, 3 * T - 6);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 1, 12 * T + 2, 4, 2);
      Gfx.spr(ctx, 'wall_banner_red', gx * T, 12 * T + 5, { topLeft: true });
    } });
    // 광장 가운데 작은 분수 · 브론 뒤 모루 · 미라 둘레(작업대 · 수정)
    list.push({ y: FOUNTAIN.y + 14, draw: () => drawFountain(ctx) });
    list.push({ y: ANVIL.y, draw: () => drawAnvil(ctx) });
    list.push({ y: 9 * T + 6, draw: () => drawGemTable(ctx) });
    list.push({ y: (GEM_STAND[1] + 1) * T - 2, draw: () => drawGemStand(ctx, GEM_STAND[0] * T + 8, (GEM_STAND[1] + 1) * T - 3) });
    list.push({ y: (GEODE[1] + 1) * T - 2, draw: () => drawGeode(ctx, GEODE[0] * T + 8, (GEODE[1] + 1) * T - 3) });
    list.push({ y: (CART[1] + 1) * T - 2, draw: () => drawCart(ctx, CART[0] * T + 8, (CART[1] + 1) * T - 3) });
  }

  // 글자(960x540 화면 좌표): 이름표 · 말 걸기 · 현수막 글 · 혼잣말 · 파티 · 아래 왼쪽 패널 · 안내
  function drawLabels(ctx, sx, sy, mates) {
    const labelY = s => sy(s.y) - (s.sprite ? 62 : 44);
    for (const s of STATIONS) {
      const on = s === near, hy = labelY(s);
      // 말 걸 곳의 '말 걸기' · 설명이 옆 이름표를 덮지 않게, 가까운 이웃 이름표는 그동안 숨김(벨록 광차 ↔ 오르반)
      if (near && !on && Math.abs(sx(s.x) - sx(near.x)) < 130 && Math.abs(hy - labelY(near)) < 60) continue;
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
    // 도박꾼 세로 현수막 글(금빛으로 일렁임) · 속삭임(말 걸 만큼 가까우면 '말 걸기'가 그 자리라 안 띄움): 7초마다 한 줄, 4초 보이고 흐려진다
    const pulse = 0.5 + 0.5 * Math.sin(time * 3), bcol = 'rgb(255,' + Math.round(208 + 30 * pulse) + ',' + Math.round(90 + 60 * pulse) + ')';
    if (where === 'silvane') Silvane.labels(ctx, sx, sy, time);
    else for (const [bx, word] of VBANNERS) [...word].forEach((ch, i) => Gfx.text(ctx, ch, sx(bx * T + 8 + Math.round(Math.sin(time * 1.4 + bx) * 0.5)), sy(2 * T + 7) + 19 + i * 16, 13, bcol, 'center'));
    // 혼잣말 말풍선(도박꾼 · 광부): period 초마다 한 줄, 4초 보이고 흐려짐. 둘이 엇갈려 뜨게 off 로 밀어 둠
    for (const wh of WHISPERS) {
      const st = STATIONS.find(s => s.id === wh.id);
      if (near === st) continue;
      const tt = time + wh.off, ph = tt % wh.period, ga = ph < 0.4 ? ph / 0.4 : ph > 3.6 ? Math.max(0, (4 - ph) / 0.4) : 1;
      if (ph >= 4) continue;
      const line = wh.lines[Math.floor(tt / wh.period) % wh.lines.length], gx = sx(st.x), gy = sy(st.y) - 92;
      ctx.save(); ctx.globalAlpha = ga;
      ctx.font = 'bold 12px ' + Gfx.FONT;
      const w = ctx.measureText(line).width + 18;
      Gfx.panel(ctx, gx - w / 2, gy - 17, w, 24, { border: wh.edge, bg: wh.bg });
      ctx.fillStyle = wh.edge; ctx.beginPath(); ctx.moveTo(gx - 5, gy + 7); ctx.lineTo(gx + 5, gy + 7); ctx.lineTo(gx, gy + 13); ctx.fill();
      Gfx.text(ctx, line, gx, gy, 12, wh.col, 'center');
      ctx.restore();
    }
    // 파티원 머리 위 이름표(파티 순서 색)
    for (const m of mates) Gfx.text(ctx, clsOf(m.prof).name + ' Lv.' + (m.lv || '?'), sx(m.x), sy(m.y) - 62, 12, Coop.colorOf(m.pid), 'center');
    Coop.drawBubbles(ctx, p, sx, sy);  // 파티 말풍선: 강화 · 합치기 · 유니크(내 머리 위 · 파티원 머리 위)
    // 아래 왼쪽: 마을 이름 · 캐릭터
    const by = 438;
    Gfx.panel(ctx, 12, by, 250, 66);
    Gfx.text(ctx, where === 'belloc' ? '지하 도시 벨록' : '광산 도시 실베인', 26, by + 26, 18, '#f0e0b8');
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
    // 미라 발밑 세공 마법진(도는 점 고리 둘 · 보랏빛) · 던전 입구 계단에서 새는 심연 빛
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mx = 2 * T + 8, my = 9 * T + 11;
    for (const [rx, ry, n, sp, a] of [[14, 6, 18, 0.5, 0.55], [8, 3.5, 10, -0.8, 0.45]]) {
      ctx.fillStyle = 'rgba(160,130,255,' + (a + 0.15 * Math.sin(time * 2)) + ')';
      for (let i = 0; i < n; i++) { const an = time * sp + i / n * Math.PI * 2; ctx.fillRect(Math.round(mx + Math.cos(an) * rx), Math.round(my + Math.sin(an) * ry), 1, 1); }
    }
    const sg = ctx.createRadialGradient(15 * T, 14 * T + 9, 0, 15 * T, 14 * T + 9, 26);
    sg.addColorStop(0, 'rgba(150,80,255,' + (0.28 + 0.08 * Math.sin(time * 2.2)) + ')'); sg.addColorStop(1, 'rgba(150,80,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(15 * T - 26, 14 * T - 17, 52, 52);
    ctx.restore();
    // 옛 갱도: 구멍 + 둘레 돌 부스러기
    Gfx.spr(ctx, 'hole', SHAFT[0] * T, SHAFT[1] * T, { topLeft: true });
    ctx.fillStyle = '#6a5e58';
    for (const [dx, dy] of [[-3, 14], [2, 15], [15, 13], [18, 2], [-2, 3], [9, 17], [13, 16]]) ctx.fillRect(SHAFT[0] * T + dx, SHAFT[1] * T + dy, 2, 1);
  }

  // ── 마을 장식 그림(2026-10-25 사용자: 브론 뒤 모루 · 미라 둘레 장식 · 광장 가운데 작은 분수) — 모두 게임 좌표 칸 그림 ──
  // 채운 타원(픽셀 줄 단위)
  function ell(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++) { const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)); ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), Math.round(hw * 2), 1); }
  }
  // 작은 분수: 돌 수반(앞면 두께) · 물 · 퍼지는 물결 · 가운데 기둥 위 작은 그릇 · 양옆으로 떨어지는 물방울 · 위로 솟는 물줄기
  function drawFountain(ctx) {
    const cx = FOUNTAIN.x, cy = FOUNTAIN.y + 2;
    Art.shadow(ctx, cx, cy + 9, 17, 0, 1);
    ell(ctx, cx, cy + 4, 16, 9, '#2a2422'); ell(ctx, cx, cy, 16, 9, '#2a2422');
    ell(ctx, cx, cy + 4, 15, 8, '#5e5650'); ell(ctx, cx, cy, 15, 8, '#9a9088');
    ell(ctx, cx, cy, 12, 5, '#2e5a9a'); ell(ctx, cx, cy + 1, 11, 4, '#3a78c8');
    ctx.fillStyle = '#7ab8f0';  // 물결: 가운데서 퍼지는 고리 둘
    for (let k = 0; k < 2; k++) {
      const u = (time * 0.7 + k * 0.5) % 1, rx = 3 + u * 8, ry = 1.2 + u * 3;
      ctx.globalAlpha = 1 - u;
      for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(an) * rx), Math.round(cy + 1 + Math.sin(an) * ry), 1, 1); }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2422'; ctx.fillRect(cx - 3, cy - 13, 6, 14);  // 기둥
    ctx.fillStyle = '#8a8078'; ctx.fillRect(cx - 2, cy - 12, 4, 13);
    ctx.fillStyle = '#b0a89e'; ctx.fillRect(cx - 2, cy - 12, 1, 13);
    ell(ctx, cx, cy - 13, 6, 2, '#2a2422'); ell(ctx, cx, cy - 13, 5, 1, '#9a9088'); ctx.fillStyle = '#7ab8f0'; ctx.fillRect(cx - 3, cy - 14, 6, 1);
    ctx.fillStyle = '#d8f0ff';
    const jet = 3 + Math.round(Math.sin(time * 9) * 1.5);  // 위로 솟는 물줄기
    ctx.fillRect(cx - 1, cy - 14 - jet, 2, jet); ctx.fillRect(cx, cy - 16 - jet, 1, 1);
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {  // 그릇 가장자리에서 수반으로 떨어지는 물방울
      const u = (time * 1.3 + k / 3) % 1;
      ctx.fillRect(Math.round(cx + side * (5 + u * 6)), Math.round(cy - 13 + u * 12 - Math.sin(u * Math.PI) * 3), 1, 1 + (u > 0.8 ? 0 : 1));
    }
  }
  // 모루: 쇠 받침 · 허리 · 넓은 윗면 + 왼쪽 뿔, 위에 달군 쇳덩이(빛) · 기대 둔 망치 · 가끔 튀는 불티(브론이 두드리는 것처럼)
  function drawAnvil(ctx) {
    const x = ANVIL.x, y = ANVIL.y;
    Art.shadow(ctx, x, y, 9, 0, 1);
    ctx.fillStyle = '#16181e';
    ctx.fillRect(x - 7, y - 5, 14, 6); ctx.fillRect(x - 4, y - 9, 8, 5); ctx.fillRect(x - 10, y - 13, 20, 5); ctx.fillRect(x - 14, y - 12, 5, 3);
    ctx.fillStyle = '#3a3e48'; ctx.fillRect(x - 6, y - 4, 12, 4);
    ctx.fillStyle = '#2e3138'; ctx.fillRect(x - 3, y - 8, 6, 4);
    ctx.fillStyle = '#4a4e58'; ctx.fillRect(x - 9, y - 12, 18, 3); ctx.fillRect(x - 13, y - 11, 4, 1);
    ctx.fillStyle = '#9aa2b0'; ctx.fillRect(x - 9, y - 12, 18, 1); ctx.fillRect(x - 13, y - 11, 4, 1);
    const glow = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.fillStyle = '#c84a1a'; ctx.fillRect(x - 3, y - 15, 7, 3);
    ctx.fillStyle = '#ff9a3a'; ctx.fillRect(x - 2, y - 15, 5, 2);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - 1, y - 15, 2, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 14, 0, x, y - 14, 14);
    g.addColorStop(0, 'rgba(255,140,50,' + 0.35 * glow + ')'); g.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 14, y - 28, 28, 28);
    const ph = time % 1.3;  // 불티
    if (ph < 0.4) for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45, sp = 22 + (i % 3) * 8;
      ctx.fillStyle = i % 2 ? '#ffd36a' : '#ff8a30';
      ctx.fillRect(Math.round(x + Math.cos(a) * sp * ph), Math.round(y - 15 + Math.sin(a) * sp * ph + 60 * ph * ph), 1, 1);
    }
    ctx.restore();
    Gfx.spr(ctx, 'weapon_hammer', x + 13, y + 1, { rot: 0.35 });
  }
  // 미라의 작업대: 나무 상판 · 다리, 위에 속성석 셋(불 · 얼음 · 번개 색, 하나씩 반짝)
  function drawGemTable(ctx) {
    const x0 = 3 * T + 2, y0 = 8 * T + 10;
    Art.shadow(ctx, x0 + 7, y0 + 12, 9, 0, 1);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x0 - 1, y0 - 1, 16, 6);
    ctx.fillStyle = '#4a2e1a'; ctx.fillRect(x0 + 1, y0 + 4, 2, 8); ctx.fillRect(x0 + 11, y0 + 4, 2, 8);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(x0, y0 + 2, 14, 2);
    ctx.fillStyle = '#8a5a32'; ctx.fillRect(x0, y0, 14, 2);
    ctx.fillStyle = '#b07a48'; ctx.fillRect(x0, y0, 14, 1);
    ['#ff6a4a', '#6ad8ff', '#ffe060'].forEach((c, i) => {
      const gx = x0 + 3 + i * 4, gy = y0 - 3;
      ctx.fillStyle = '#1a1018'; ctx.fillRect(gx - 1, gy - 1, 3, 4); ctx.fillRect(gx - 2, gy, 5, 2);
      ctx.fillStyle = c; ctx.fillRect(gx, gy - 1, 1, 3); ctx.fillRect(gx - 1, gy, 3, 1);
      if (Math.floor(time * 1.5) % 3 === i) { ctx.fillStyle = '#ffffff'; ctx.fillRect(gx, gy - 1, 1, 1); ctx.fillRect(gx, gy - 4, 1, 2); ctx.fillRect(gx - 2, gy - 3, 1, 1); ctx.fillRect(gx + 2, gy - 3, 1, 1); }
    });
  }
  const glowAt = (ctx, x, y, r, rgb, a) => {  // 밝게 더하는 둥근 빛
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + Math.max(0, a) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };
  const pix = (ctx, x0, y0, rows, pal) => rows.forEach((row, r) => [...row].forEach((ch, c) => { if (pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x0 + c, y0 + r, 1, 1); } }));
  // 떠 있는 보석 받침대: 금 테 두른 돌 받침 위로 깎은 보석이 둥실(색이 보라 → 분홍 → 하늘로 천천히 바뀜) · 아래로 내리는 빛 · 둘레를 도는 반짝이
  const GEM_ROWS = ['..ooooo..', '.oLWLMLo.', 'oLLMMMDDo', 'oMMMMMDDo', '.oMMMDDo.', '..oMMDo..', '...oDo...', '....o....'];
  const GEM_HUES = [['#e0c0ff', '#b070ff', '#6a30b0', '180,120,255'], ['#ffc8e8', '#ff70c0', '#a03070', '255,120,200'], ['#c8f4ff', '#6ad8ff', '#2a80b0', '110,210,255']];
  function drawGemStand(ctx, cx, by) {
    Art.shadow(ctx, cx, by + 1, 7, 0, 1);
    const O = '#2a2422', S = '#8a8078', L = '#b0a89e', D = '#5e5650';
    ctx.fillStyle = O; ctx.fillRect(cx - 7, by - 4, 14, 5); ctx.fillRect(cx - 4, by - 13, 8, 10); ctx.fillRect(cx - 6, by - 16, 12, 4);
    ctx.fillStyle = D; ctx.fillRect(cx - 6, by - 3, 12, 3);
    ctx.fillStyle = S; ctx.fillRect(cx - 6, by - 3, 12, 1); ctx.fillRect(cx - 3, by - 12, 6, 9);
    ctx.fillStyle = L; ctx.fillRect(cx - 3, by - 12, 1, 9);
    ctx.fillStyle = S; ctx.fillRect(cx - 5, by - 15, 10, 2);
    ctx.fillStyle = '#c8962e'; ctx.fillRect(cx - 5, by - 14, 10, 1);
    const k = Math.floor(time / 4) % 3, [l, m, d, rgb] = GEM_HUES[k], bob = Math.round(Math.sin(time * 2) * 1.5), gy = by - 28 + bob;
    glowAt(ctx, cx, gy + 4, 14, rgb, 0.4 + 0.1 * Math.sin(time * 3));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(' + rgb + ',0.16)'; ctx.fillRect(cx - 2, gy + 8, 4, by - 16 - gy - 8); ctx.restore();
    pix(ctx, cx - 4, gy, GEM_ROWS, { o: '#1a1030', L: l, M: m, D: d, W: Math.sin(time * 4) > 0.3 ? '#ffffff' : l });
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {  // 반짝이 셋
      const an = time * 1.5 + i * 2.1, tw = Math.max(0, Math.sin(time * 5 + i * 1.7));
      const sx = Math.round(cx + Math.cos(an) * 9), sy = Math.round(gy + 4 + Math.sin(an) * 4);
      ctx.fillRect(sx, sy, 1, 1); if (tw > 0.6) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
    }
  }
  // 쪼갠 정동석: 거친 돌 껍데기 안에 하늘빛 결정이 빽빽(은은한 빛) · 옆에 떨어진 결정 조각 둘
  function drawGeode(ctx, cx, by) {
    const cy = by - 7;
    glowAt(ctx, cx, cy, 20, '110,210,255', 0.38 + 0.12 * Math.sin(time * 2.2));
    Art.shadow(ctx, cx, by + 1, 10, 0, 1);
    // 껍데기(아래쪽이 두꺼운 앞면) → 결정 층 셋(바깥 하늘 · 밝은 하늘 · 빛나는 가운데)
    ell(ctx, cx, cy + 1, 11, 7, '#2a2422'); ell(ctx, cx, cy + 1, 10, 6, '#4e423c'); ell(ctx, cx, cy, 10, 6, '#2a2422');
    ell(ctx, cx, cy, 9, 5, '#8a7a6e'); ell(ctx, cx - 1, cy - 1, 8, 3, '#a8988a');
    ell(ctx, cx, cy, 7, 4, '#2a80b0'); ell(ctx, cx, cy, 6, 3, '#6ad8ff'); ell(ctx, cx, cy, 4, 2, '#a8ecff'); ell(ctx, cx, cy, 2, 1, '#e8fcff');
    ctx.fillStyle = '#2a80b0';  // 결정 면 사이 금(가운데로 모이는 선)
    for (const [dx, dy] of [[-5, 0], [-4, -2], [-1, -3], [2, -3], [4, -2], [5, 1], [3, 2], [-3, 2]]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    [[-3, -1], [2, 1], [0, -2], [4, 0]].forEach(([dx, dy], i) => {  // 반짝
      if (Math.sin(time * 3.5 + i * 1.6) > 0.6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + dx, cy + dy, 1, 1); }
    });
    for (const [dx, dy] of [[13, 0], [-13, -1]]) {  // 떨어진 조각
      ctx.fillStyle = '#1a1030'; ctx.fillRect(cx + dx - 1, by + dy - 3, 3, 4);
      ctx.fillStyle = '#6ad8ff'; ctx.fillRect(cx + dx, by + dy - 3, 1, 3); ctx.fillStyle = '#c8f4ff'; ctx.fillRect(cx + dx, by + dy - 3, 1, 1);
    }
  }
  // 광석 수레(광차): 짧은 철길(침목) 위 쇠 수레 · 바퀴 둘 · 가득 실은 광석(은 · 금 · 푸른 알갱이가 반짝) · 오른쪽에 기대 둔 곡괭이
  function drawCart(ctx, cx, by) {
    ctx.fillStyle = '#4a2e1a'; for (let x = cx - 16; x <= cx + 14; x += 5) ctx.fillRect(x, by - 4, 2, 6);  // 침목
    ctx.fillStyle = '#7a7e88'; ctx.fillRect(cx - 18, by - 3, 36, 1); ctx.fillRect(cx - 18, by + 1, 36, 1);  // 철길
    Art.shadow(ctx, cx, by, 9, 0, 1);
    ctx.fillStyle = '#16181e'; ctx.fillRect(cx - 9, by - 15, 18, 3); ctx.fillRect(cx - 8, by - 12, 16, 8);
    ctx.fillStyle = '#5a5e68'; ctx.fillRect(cx - 7, by - 12, 14, 7);
    ctx.fillStyle = '#3a3e48'; ctx.fillRect(cx - 7, by - 9, 14, 1); ctx.fillRect(cx - 2, by - 12, 1, 7); ctx.fillRect(cx + 3, by - 12, 1, 7);
    ctx.fillStyle = '#8a92a0'; ctx.fillRect(cx - 8, by - 14, 16, 1);
    ctx.fillStyle = '#c8962e'; ctx.fillRect(cx - 6, by - 11, 1, 1); ctx.fillRect(cx + 5, by - 11, 1, 1); ctx.fillRect(cx - 6, by - 7, 1, 1); ctx.fillRect(cx + 5, by - 7, 1, 1);  // 못
    for (const wx of [cx - 5, cx + 4]) { ctx.fillStyle = '#16181e'; ctx.fillRect(wx - 2, by - 5, 4, 4); ctx.fillStyle = '#4a4e58'; ctx.fillRect(wx - 1, by - 4, 2, 2); }
    // 실은 광석: 둥근 덩이 몇 개 + 반짝이는 알갱이
    for (const [dx, dy, r, c] of [[-5, -16, 3, '#6a5e58'], [0, -17, 4, '#7a6e66'], [5, -16, 3, '#8a7e76'], [-2, -19, 2, '#9a8e84'], [3, -19, 2, '#7a6e66']]) ell(ctx, cx + dx, by + dy, r, Math.max(1, r - 1), c);
    [[-4, -17, '#e8f0ff'], [1, -19, '#ffd36a'], [5, -17, '#6ab8ff'], [-1, -15, '#ffd36a']].forEach(([dx, dy, c], i) => {
      ctx.fillStyle = Math.sin(time * 3 + i * 1.9) > 0.2 ? c : '#5e5650'; ctx.fillRect(cx + dx, by + dy, 1, 1);
    });
    // 곡괭이: 자루 + 쇠 머리(위에 걸침)
    ctx.fillStyle = '#5a3a22'; for (let i = 0; i < 14; i++) ctx.fillRect(Math.round(cx + 10 + i * 0.3), by - i, 1, 1);
    ctx.fillStyle = '#2a2422'; ctx.fillRect(cx + 9, by - 17, 9, 3);
    ctx.fillStyle = '#9aa2b0'; ctx.fillRect(cx + 10, by - 16, 7, 1); ctx.fillRect(cx + 9, by - 15, 1, 1); ctx.fillRect(cx + 17, by - 15, 1, 1);
  }
  // 오르반 곰방대 연기 · 안전모 등불 빛(곰방대 대통 · 등불은 assets/dt/miner.png 에 그려져 있고, 여기선 그 자리에 연기 · 빛만)
  function drawMinerFx(ctx, s) {
    glowAt(ctx, s.x + 6, s.y - 19, 18, '255,215,130', 0.22 + 0.06 * Math.sin(time * 7) + 0.04 * Math.sin(time * 13));
    glowAt(ctx, s.x + 6, s.y - 12, 4, '255,140,50', 0.5 + 0.3 * Math.sin(time * 2.5));  // 대통 불씨(빨아들일 때 밝아짐)
    for (let k = 0; k < 4; k++) {
      const u = (time * 0.45 + k / 4) % 1, r = 1 + u * 2.2;
      ctx.fillStyle = 'rgba(200,200,205,' + (0.55 * (1 - u)) + ')';
      ctx.beginPath(); ctx.arc(s.x + 6 + u * 4 + Math.sin(u * 7 + k) * 1.5, s.y - 13 - u * 18, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 장비가 바뀌면 걷는 속도 등 다시
  function refresh() { if (p) p.stats = Items.playerStats(prof); }

  return { enter, update, draw, refresh, travel, rideUpdate, rideDraw, get where() { return where; }, get player() { return p; }, get near() { return near; }, STATIONS };
})();
