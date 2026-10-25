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
      ] }) },
    { id: 'gate', name: '던전 입구', role: '던전 고르기', ...px(14, 3), x: 15 * T, go: () => Game.open('select') },
    { id: 'shop', name: '상인 엘린', role: '장비 팔기 · 아이템 사고팔기 · 장비 관리', sprite: 'elf_m', ...px(23, 3), x: 24 * T,
      go: () => Game.overlay({ type: 'choice', title: '상인 엘린', items: [
        // 2026-10-24 사용자: 장비 / 아이템으로 나눔
        { label: '장비 팔기', go: () => Game.overlay({ type: 'inv', mode: 'sell' }) },
        { label: '아이템 사고팔기', go: () => Game.overlay({ type: 'shopItems' }) },  // 장비 칸 + 가방(등급 보며 팔기), 대장장이 '장비 팔기'와 같은 창
        EQUIP_ITEM,
      ] }) },
    { id: 'jewel', name: '세공사 미라', role: '속성석 · 보석 합치기 · 관리', sprite: 'wizzard_f', ...px(2, 9), flip: false,
      go: () => Game.overlay({ type: 'choice', title: '세공사 미라', items: [
        { label: '속성석 · 보석 합치기', go: () => Game.overlay({ type: 'stones', mode: 'craft' }) },
        { label: '속성석 · 보석 관리', go: () => Game.overlay({ type: 'manage' }) },
        EQUIP_ITEM,
      ] }) },
    // 창고(2026-10-24 사용자): 유니크 컬렉션. 사람 대신 상자
    { id: 'vault', name: '창고', role: '유니크 컬렉션 · 부위별 달성률', prop: 'chest_full_open_anim_f0', ...px(27, 9), go: () => Game.overlay({ type: 'vault' }) },
  ];
  const TALK_R = 26;
  const TOWN_SPEED = 1.6;  // 마을에서는 던전보다 60% 빠르게 걷는다(2026-10-24 사용자)

  let lv = null, p = null, prof = null, time = 0, near = null;
  const cam = { x: 0, y: 0 };

  function build() {
    const tiles = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = MAP[y][x] === '.' ? 1 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    const def = { banner: 'wall_banner_yellow', wall: ['wall_banner_red', 'wall_banner_blue', 'wall_banner_green'], tint: '#d8c8b0' };
    const m = { def, W, H, tiles, at, rooms: [], columns: [], crates: new Set(), decor: { skulls: [] }, start: null };
    // 광장 기둥 넷 + 상점 · 대장장이 앞 상자(막히는 것)
    for (const c of [[9, 7], [20, 7], [9, 12], [20, 12]]) m.columns.push(c);
    for (const c of [[21, 2], [26, 2], [3, 2], [8, 2]]) { m.columns.push(c); m.crates.add(c.join()); }
    m.canvas = Dungeon.paint(m);
    m.painted = Gfx.ready();  // 그림 파일이 아직 안 읽혔으면 그릴 때 다시
    return m;
  }

  // 들어오기: fromGate = 던전 · 고르기에서 돌아올 때(입구 앞에서 시작)
  function enter(pr, fromGate) {
    prof = pr;
    if (!lv) lv = build();
    p = createPlayer(prof);
    const s = fromGate ? px(14, 5) : px(14, 13);
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
    { label: '함께하기 (온라인 협동)', go: () => Game.overlay({ type: 'coop' }) },  // 2026-10-25 사용자: 방 코드로 2명
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
    // 앞뒤(y) 정렬: 기둥 · 상자 · 사람
    const list = [];
    for (const c of lv.columns) {
      const x = c[0] * T + 8, y = (c[1] + 1) * T, crate = lv.crates.has(c.join());
      list.push({ y: crate ? y - 4 : y, draw: () => Gfx.spr(ctx, crate ? 'crate' : 'column', x, crate ? y - 2 : y) });
    }
    // 상점 진열: 상자 위 물약(상자보다 앞에 그린다)
    list.push({ y: 3 * T, draw: () => { Gfx.spr(ctx, 'flask_big_red', 21 * T + 8, 2 * T + 8); Gfx.spr(ctx, 'flask_big_blue', 26 * T + 8, 2 * T + 8); } });
    for (const s of STATIONS) if (s.prop) list.push({ y: s.y, draw: () => { Art.shadow(ctx, s.x, s.y, 7, 0, 1); Gfx.spr(ctx, s.prop, s.x, s.y); } });
    for (const s of STATIONS) if (s.sprite) list.push({ y: s.y, draw: () => {
      Art.shadow(ctx, s.x, s.y, 6, 0, 1);
      Gfx.spr(ctx, Gfx.anim(s.sprite + '_idle_anim', time + s.x * 0.01, 6), s.x, s.y, { flip: !!s.flip });
    } });
    list.push({ y: p.y, draw: () => { Art.shadow(ctx, p.x, p.y, 6, 0, 1); Art.player(ctx, p, time); } });
    const mate = Coop.townMate();  // 함께하기 친구(2026-10-25 사용자: 마을에서부터 같이 보이게)
    if (mate) list.push({ y: mate.y, draw: () => { Art.shadow(ctx, mate.x, mate.y, 6, 0, 1); Art.player(ctx, mate, time); } });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
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
    // 친구 머리 위 이름표
    if (mate) Gfx.text(ctx, '친구 · ' + clsOf(mate.prof).name + ' Lv.' + Net.mate.lv, sx(mate.x), sy(mate.y) - 62, 12, '#d8c0ff', 'center');
    // 아래 왼쪽: 마을 이름 · 캐릭터
    const by = 438;
    Gfx.panel(ctx, 12, by, 250, 66);
    Gfx.text(ctx, '지하 도시 벨록', 26, by + 26, 18, '#f0e0b8');
    Gfx.text(ctx, clsOf(prof).name + ' Lv.' + prof.lv, 250, by + 26, 15, '#e8dcc0', 'right');  // 마을 이름이 길어져(지하 도시 벨록) 오른쪽 끝에 맞춤
    Gfx.spr(ctx, 'coin_anim_f0', 34, by + 56, { scale: 2 });
    Gfx.text(ctx, prof.gold + 'G', 48, by + 54, 14, '#ffd34d');
    Gfx.text(ctx, '물약 ' + prof.potions, 140, by + 54, 14, '#ff9a9a');
    // 함께하기 방이 열려 있으면 그 위에 방 코드 · 친구(창을 닫아도 방은 그대로)
    if (Net.state !== 'off' && Net.state !== 'error') {
      const m = Net.mate, where = Coop.mateWhere();
      const s = Net.state === 'ready' ? '함께 · ' + clsOf(m).name + ' Lv.' + m.lv + (where ? ' · ' + where : Net.ping ? ' · ' + Net.ping + 'ms' : '')
        : Net.state === 'joining' ? '방 ' + Net.code + ' 들어가는 중' : '방 ' + Net.code + ' · 친구 기다리는 중';
      Gfx.panel(ctx, 12, by - 38, 250, 32, { border: '#b48cff' });
      Gfx.text(ctx, s, 26, by - 17, 13, '#e0d0ff');
    }
    const hint = '이동 ' + L('move') + ' · 말 걸기 ' + L('ok') + ' · 가방 ' + L('inv') + ' · 메뉴 ' + L('pause');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 512, 960, 28);
    Gfx.text(ctx, hint, 480, 531, 13, '#a89c98', 'center');
  }
  const L = a => Input.label(a);

  // 장비가 바뀌면 걷는 속도 등 다시
  function refresh() { if (p) p.stats = Items.playerStats(prof); }

  return { enter, update, draw, refresh, get player() { return p; }, get near() { return near; }, STATIONS };
})();
