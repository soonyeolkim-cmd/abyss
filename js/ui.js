// 메뉴 화면: 마을 · 던전 고르기 · 가방/장비 · 상점 · 일시정지 · 확인 · 결과. 모두 960x540 좌표에서 그린다.
// 조작: 방향 = 고르기, 선택(키보드 X/Enter · 패드 A), 취소(키보드 Z/Esc · 패드 B).
const UI = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  // 판 번호: index.html 스크립트 주소의 ?v=
  const VER = (() => { const s = [...document.scripts].find(s => s.src.includes('?v=')); return s ? s.src.split('?v=')[1] : ''; })();
  // 고른 줄 표시(2026-10-24 사용자: 커서만 움직이고 글자는 제자리): 가운데 글은 그대로 두고 왼쪽에 ▶ 만 따로 그린다
  function centerItem(ctx, label, x, y, size, col, on, curCol) {
    T_(ctx, label, x, y, size, col, 'center');
    if (!on) return;
    ctx.font = 'bold ' + size + 'px ' + Gfx.FONT;
    T_(ctx, '▶', x - ctx.measureText(label).width / 2 - 8, y, size * 0.8, curCol || col, 'right');
  }
  // 폰 터치로 메뉴 고르기(2026-10-25 사용자: 커서 옮기고 X 를 눌러야 해서 불편). 그릴 때 누를 곳을 적어 두고, 터치(touch.js)한 자리를 찾는다.
  // z = { pick 그 줄 · 칸 고르기, on 이미 골라져 있었나(그러면 한 번 더 누른 것 = 선택), now 누르자마자 선택, key 누를 동작(기본 ok, null = 고르기만) }
  // 끼기 · 팔기 · 사기처럼 바로 일이 생기는 칸은 한 번 = 고르기(설명 보기), 한 번 더 = 선택. 메뉴 줄은 한 번에.
  // '한 번 더' = 같은 칸을 손가락으로 연달아 누른 것만(창을 열자마자 커서가 있던 칸을 눌러 바로 끼거나 팔지 않게)
  let zones = [], tapAt = null, lastKey = null;
  const zone = (x, y, w, h, z) => { z.x = x; z.y = y; z.w = w; z.h = h; zones.push(z); };
  function tapLayer() { zones = []; }
  function tap(x, y) { tapAt = { x, y }; }
  function resolveTap() {
    if (!tapAt) return;
    const { x, y } = tapAt;
    tapAt = null;
    for (let i = zones.length - 1; i >= 0; i--) {  // 나중에 그린 것(위에 겹친 것)부터
      const z = zones[i];
      if (x < z.x || y < z.y || x > z.x + z.w || y > z.y + z.h) continue;
      const key = Game.scene + Game.overlays.length + ':' + z.x + ',' + z.y, again = lastKey === key;
      lastKey = key;
      const was = z.on ? z.on() && again : true;
      if (z.pick) z.pick();
      const act = 'key' in z ? z.key : 'ok';
      if (act && (z.now || was)) Input.tapAction(act);
      return;
    }
    lastKey = null;  // 빈 곳을 누르면 처음부터
  }
  // 너비 maxW 안에 들게: 글자를 9px 까지 줄이고, 그래도 길면 끝을 … 로
  function fitText(ctx, s, x, y, size, maxW, col) {
    let sz = size;
    const w = () => { ctx.font = 'bold ' + sz + 'px ' + Gfx.FONT; return ctx.measureText(s).width; };
    while (sz > 9 && w() > maxW) sz--;
    while (s.length > 1 && w() > maxW) s = s.slice(0, -2) + '…';
    T_(ctx, s, x, y, sz, col);
  }
  const menuNav = (sel, n) => {
    if (Input.nav('up')) sel = (sel + n - 1) % n;
    if (Input.nav('down')) sel = (sel + 1) % n;
    return sel;
  };
  function backdrop(ctx, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 540);
    g.addColorStop(0, '#120c12'); g.addColorStop(1, '#05030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
    // 바닥 타일을 흐리게 깔아 분위기
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < 540; y += 32) for (let x = 0; x < 960; x += 32) Gfx.spr(ctx, 'floor_1', x, y, { topLeft: true, scale: 2 });
    ctx.restore();
    const v = ctx.createRadialGradient(480, 270, 120, 480, 270, 560);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, 960, 540);
  }
  function menuList(ctx, items, sel, x, y, w, rowH) {
    items.forEach((it, i) => {
      const yy = y + i * rowH, on = i === sel;
      if (on) { ctx.fillStyle = 'rgba(255,211,106,0.12)'; ctx.fillRect(x, yy - rowH + 12, w, rowH - 4); }
      if (on) T_(ctx, '▶', x + 12, yy, 15, '#ffd36a');
      T_(ctx, it.label, x + 32, yy, 18, it.off ? '#5a5058' : on ? '#ffd36a' : '#e8e0d0');
      if (on && it.off) T_(ctx, it.off, x + 200, yy, 11, '#8a7e88');
    });
  }
  // ── 캐릭터 선택(2026-10-24 사용자): 칸 3개 — 이어하기 · 새로 만들기 · 지우기 · 코드로 내보내기 / 불러오기 ──
  const title = {
    sel: 0, slots: [],
    open() { this.slots = []; for (let n = 0; n < Save.SLOTS_N; n++) this.slots.push(Save.load(n)); this.sel = Math.min(this.sel, Save.SLOTS_N - 1); },
    update() {
      const N = Save.SLOTS_N;
      if (Input.nav('left')) this.sel = (this.sel + N - 1) % N;
      if (Input.nav('right')) this.sel = (this.sel + 1) % N;
      if (!Input.wasPressed('ok')) return;
      const n = this.sel, p = this.slots[n], name = '캐릭터 ' + (n + 1);
      if (p) Game.overlay({ type: 'choice', title: name + ' · ' + clsOf(p).name + ' Lv.' + p.lv, items: [
        { label: '이어하기', go: () => Game.startSlot(n) },
        { label: '코드로 내보내기', go: () => this.exportCode(n) },
        { label: '캐릭터 지우기', go: () => Game.overlay({ type: 'confirm', danger: true, text: name + '(' + clsOf(p).name + ' Lv.' + p.lv + ')를 지울까요?', sub: '지우면 되돌릴 수 없어요 — 남기려면 먼저 코드로 내보내 두세요',
          yes: () => { Save.wipe(n); this.open(); Game.toast(name + '를 지웠어요'); } }) },
      ] });
      else Game.overlay({ type: 'choice', title: name + ' · 빈 칸', items: [
        { label: '새로 만들기 — 검사', go: () => Game.startSlot(n, true, 'swordsman') },
        { label: '새로 만들기 — 마법사', go: () => Game.startSlot(n, true, 'mage') },
        { label: '코드로 불러오기', go: () => this.importCode(n) },
      ] });
    },
    // 코드 내보내기: 클립보드에 복사(안 되면 복사할 수 있게 창에 띄움)
    exportCode(n) {
      const code = Save.exportCode(n);
      if (!code) { Game.toast('내보낼 기록이 없어요'); return; }
      const show = () => { window.prompt('이 코드를 복사해 두세요 (Ctrl+C). 캐릭터 선택 화면의 빈 칸 → 코드로 불러오기에 붙여 넣으면 이어할 수 있어요.', code); Input.clear(); };
      try {
        navigator.clipboard.writeText(code).then(() => Game.toast('코드를 복사했어요 (' + code.length + '자) — 메모장 등에 붙여 넣어 두세요'), show);
      } catch (e) { show(); }
    },
    importCode(n) {
      const code = window.prompt('이어할 코드를 붙여 넣으세요 (Ctrl+V)', '');
      Input.clear();
      if (!code) return;
      const r = Save.importCode(n, code);
      if (r === true) { this.open(); Game.toast('캐릭터 ' + (n + 1) + '에 불러왔어요 — 이어하기를 눌러 시작하세요'); }
      else Game.toast(r);
    },
    draw(ctx, time) {
      backdrop(ctx, time);
      T_(ctx, '심연으로', 480, 76, 34, '#f0e0b8', 'center');  // 게임 이름(2026-10-24 사용자)
      T_(ctx, '캐릭터 선택', 480, 108, 16, '#9a8e96', 'center');
      for (let n = 0; n < Save.SLOTS_N; n++) {
        const x = 60 + n * 290, y = 134, w = 260, h = 320, on = this.sel === n, p = this.slots[n];
        zone(x, y, w, h, { pick: () => { this.sel = n; }, now: true });
        Gfx.panel(ctx, x, y, w, h, { border: on ? '#ffd36a' : '#5a4650' });
        T_(ctx, '캐릭터 ' + (n + 1), x + w / 2, y + 34, 16, on ? '#ffd36a' : '#c8b8a0', 'center');
        if (p) {
          const g = ctx.createRadialGradient(x + w / 2, y + 150, 10, x + w / 2, y + 150, 110);
          g.addColorStop(0, 'rgba(255,220,150,' + (on ? 0.14 : 0.06) + ')'); g.addColorStop(1, 'rgba(255,220,150,0)');
          ctx.fillStyle = g; ctx.fillRect(x, y + 40, w, 220);
          Art.avatar(ctx, p, x + w / 2 - 6, y + 210, 4, on ? time : 0);
          T_(ctx, clsOf(p).name + ' Lv.' + p.lv, x + w / 2, y + 250, 20, '#f0e0b8', 'center');
          T_(ctx, '골드 ' + p.gold + 'G · 깬 던전 ' + Object.keys(p.cleared || {}).length + '/' + DUNGEONS.length, x + w / 2, y + 278, 13, '#9a8e96', 'center');
          if (p.equip.weapon) T_(ctx, Items.nameOf(p.equip.weapon), x + w / 2, y + 300, 12, RARITY[p.equip.weapon.rarity].color, 'center');
        } else {
          T_(ctx, '+', x + w / 2, y + 170, 48, on ? '#ffd36a' : '#5a4650', 'center');
          T_(ctx, '새 캐릭터', x + w / 2, y + 210, 16, on ? '#ffd36a' : '#8a7e88', 'center');
          T_(ctx, '또는 코드로 불러오기', x + w / 2, y + 234, 12, '#6a6068', 'center');
        }
      }
      T_(ctx, '고르기 ←→ · 선택 ' + L('ok'), 480, 500, 14, '#8a7e88', 'center');
      // 폰이 예전 파일을 붙잡고 있는지 · 패드를 알아보는지 보려고(2026-10-25: 안드로이드에서 패드를 써도 가상패드가 안 숨겨짐)
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      const IN = { key: '키보드', pad: '패드', touch: '터치' };
      T_(ctx, (VER ? '판 ' + VER + ' · ' : '') + '패드 ' + (pads.length ? pads.map(g => g.id.slice(0, 28) + (g.mapping === 'standard' ? '' : ' (비표준)')).join(', ') : '안 보임') + ' · 마지막 입력 ' + (IN[Input.device] || Input.device),
        950, 532, 11, '#5a5058', 'right');
    },
  };

  // ── 던전 고르기 ──
  // 난이도(2026-10-24): 고른 던전 줄에서 ←→ 로 보통 · 모험 · 영웅. 아래 난이도 보스를 잡아야 열린다
  const select = {
    sel: 0, diff: 0,
    update(prof) {
      this.sel = menuNav(this.sel, DUNGEONS.length);
      const d = DUNGEONS[this.sel];
      if (Input.nav('left')) this.diff = Math.max(0, this.diff - 1);
      if (Input.nav('right')) this.diff = Math.min(DIFFS.length - 1, this.diff + 1);
      if (Input.wasPressed('back')) { Game.open('town'); return; }
      if (Input.wasPressed('ok')) {
        if (d.needs && !prof.cleared[d.needs]) Game.toast('먼저 ' + DUNGEONS.find(x => x.id === d.needs).name + ' 보스를 쓰러뜨려야 해요');
        else if (prof.lv < d.lv) Game.toast('Lv.' + d.lv + '부터 들어갈 수 있어요 (지금 Lv.' + prof.lv + ')');
        else if (!diffOpen(prof, d.id, this.diff)) Game.toast(DIFFS[this.diff].name + '은 이 던전 ' + DIFFS[this.diff - 1].name + ' 보스를 쓰러뜨리면 열려요');
        else Game.startRun(d, this.diff);
      }
    },
    draw(ctx, prof, time) {
      backdrop(ctx, time);
      T_(ctx, '던전 고르기', 60, 58, 30, '#f0e0b8');
      // 고른 던전이 내 레벨보다 한참 낮으면: 경험치 · 유니크 배율
      const sd = DUNGEONS[this.sel], gap = lowGap(prof.lv, sd.lv);
      if (gap > 0) T_(ctx, '내 레벨보다 낮은 던전 — 경험치 ×' + lowExp(prof.lv, sd.lv).toFixed(1) + ' · 유니크 ×' + lowUniq(prof.lv, sd.lv).toFixed(1), 900, 58, 13, '#ffb86a', 'right');
      else T_(ctx, '앞 던전 보스를 쓰러뜨리고 입장 레벨이 되면 열려요', 900, 58, 13, '#8a7e88', 'right');
      // 6개씩 보이고, 고른 줄을 따라 내려간다(던전 10개)
      // 보이는 창은 고른 줄이 끝에 닿을 때만 한 줄씩 움직인다(터치로 누른 줄이 손가락 밑에서 달아나지 않게)
      const VISD = 6;
      let top = this.top || 0;
      if (this.sel < top + 1) top = this.sel - 1;
      if (this.sel > top + VISD - 2) top = this.sel - VISD + 2;
      top = this.top = Math.max(0, Math.min(DUNGEONS.length - VISD, top));
      if (top > 0) T_(ctx, '▲', 930, 100, 14, '#8a7e88', 'right');
      if (top + VISD < DUNGEONS.length) T_(ctx, '▼', 930, 500, 14, '#8a7e88', 'right');
      DUNGEONS.forEach((d, i) => {
        if (i < top || i >= top + VISD) return;
        const y = 76 + (i - top) * 72, on = i === this.sel;
        zone(60, y, 840, 64, { on: () => this.sel === i, pick: () => { this.sel = i; } });
        const lowLv = prof.lv < d.lv, lockd = (d.needs && !prof.cleared[d.needs]) || lowLv;
        Gfx.panel(ctx, 60, y, 840, 64, { border: on ? '#ffd36a' : '#5a4650', bg: d.tint && !lockd ? '#1a1418' : undefined });
        // 던전 분위기 색 띠
        if (d.tint) { ctx.fillStyle = lockd ? '#2a2228' : d.tint; ctx.fillRect(62, y + 2, 6, 60); }
        ctx.imageSmoothingEnabled = false;
        const boss = ENEMIES[d.boss];
        Gfx.spr(ctx, Gfx.anim(boss.sprite + '_idle_anim', time, 6), 112, y + 60, { scale: 1.5, alpha: lockd ? 0.3 : 1, tint: boss.tint });
        const dc = diffCleared(prof, d.id);  // 깬 난이도: 이름 뒤에 그 색 ✔
        T_(ctx, (i + 1) + '. ' + d.name, 160, y + 28, 20, lockd ? '#5a5058' : on ? '#ffd36a' : '#f0e0b8');
        if (dc >= 0) { ctx.font = 'bold 20px ' + Gfx.FONT; T_(ctx, '✔', 172 + ctx.measureText((i + 1) + '. ' + d.name).width, y + 28, 18, DIFFS[dc].color); }
        // 고른 줄: 난이도 탭(잠긴 것은 흐리게)
        if (on && !lockd) DIFFS.forEach((df, k) => {
          const tx = 664 + k * 74, open = diffOpen(prof, d.id, k), cur = this.diff === k;
          zone(tx, y + 34, 68, 28, { on: () => this.diff === k, pick: () => { this.diff = k; } });
          ctx.fillStyle = cur ? 'rgba(255,211,106,0.18)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(tx, y + 38, 68, 20);
          ctx.strokeStyle = cur ? df.color : '#4a3a40'; ctx.lineWidth = cur ? 2 : 1; ctx.strokeRect(tx + 0.5, y + 38.5, 67, 19);
          T_(ctx, df.name, tx + 34, y + 53, 12, !open ? '#5a5058' : cur ? df.color : '#9a8e96', 'center');
        });
        // 떨어지는 장비의 착용 레벨 범위(장비 단계 → 착용 레벨)
        const r0 = reqLevel(d.ilvl[0]), r1 = reqLevel(d.ilvl[1]), rl = r => r ? 'Lv.' + r : 'Lv 제한 없음';
        const gear = r0 === r1 ? rl(r0) : rl(r0) + ' ~ ' + rl(r1);
        T_(ctx, '입장 Lv.' + d.lv + ' · 보스 ' + boss.name + ' · 나오는 장비 ' + gear, 880, y + 28, 13, lockd ? '#5a5058' : '#c8b8a0', 'right');
        const why = d.needs && !prof.cleared[d.needs] ? DUNGEONS.find(x => x.id === d.needs).name + ' 보스를 쓰러뜨리면 열려요' : 'Lv.' + d.lv + '부터 들어갈 수 있어요 (지금 Lv.' + prof.lv + ')';
        T_(ctx, lockd ? '잠김 — ' + why : d.desc, 162, y + 52, 13, lockd ? '#8a6060' : '#9a8e96');
      });
      // 고른 난이도 설명
      const df = DIFFS[this.diff];
      const bt = prof.bestTimes && prof.bestTimes[timeKey(DUNGEONS[this.sel].id, this.diff)];
      if (bt) T_(ctx, '최고 기록 ' + fmtTime(bt), 930, 535, 11, '#ffd36a', 'right');
      T_(ctx, df.name + (this.diff ? ' — 몹 체력 ×' + df.hp + ' · 공격 ×' + df.dmg + ' · 노랑 이상 ×' + df.rare + ' · 유니크 ×' + df.uniq + (df.stoneFavor ? ' · 큰 속성석 · 보석이 더 잘' : '') + ' · 골드 · 경험치 ×' + df.gold : ' — 기본 난이도'), 480, 516, 13, df.color, 'center');
      T_(ctx, '던전 ↑↓ · 난이도 ←→ · 들어가기 ' + L('ok') + ' · 돌아가기 ' + L('back'), 480, 535, 11, '#6a6068', 'center');
    },
  };

  // ── 가방 · 장비 / 상점 ──
  // 장비 칸(56) 왼쪽 위 좌표: 끼는 자리대로 아바타 둘레에(2026-10-24 사용자) — 투구 머리 위 · 신발 발 아래 · 목걸이 목 옆 ·
  // 무기 칼 든 쪽 · 반지 그 아래 · 갑옷 · 장갑 반대쪽. 방향키는 그쪽에 있는 가장 가까운 칸으로 간다
  // 2026-10-24 사용자 다시 배열: 왼쪽 줄 방어구(투구 · 갑옷 · 장갑 · 신발, 머리부터 발까지), 오른쪽 줄 목걸이 · 무기(손 높이) · 반지, 가운데 아바타 + 아래 속성석 4칸
  const EQUIP_POS = { helmet: [44, 80], armor: [44, 146], gloves: [44, 212], boots: [44, 278], amulet: [288, 80], weapon: [288, 179], ring: [288, 278] };
  const BAG_TO_EQUIP = ['amulet', 'weapon', 'ring', 'ring'];  // 가방 줄에서 ← 로 들어올 때
  function equipStep(cur, dx, dy) {
    const [cx, cy] = EQUIP_POS[cur];
    let best = null, bs = 1e9;
    for (const s in EQUIP_POS) {
      if (s === cur) continue;
      const x = EQUIP_POS[s][0] - cx, y = EQUIP_POS[s][1] - cy, along = x * dx + y * dy;
      if (along <= 0) continue;
      const sc = along + 2 * Math.abs(x * dy + y * dx);  // 옆으로 벗어난 만큼 덜 고른다
      if (sc < bs) { bs = sc; best = s; }
    }
    return best;
  }
  // 가방 위 버튼: 일괄 착용(가방 · 상점) · 일괄 판매(상점). 가방 맨 윗줄에서 위로 가면 고를 수 있다
  const INV_BTNS = {
    equip: [{ label: '좋은 것 일괄 착용', go: prof => bulkEquip(prof) }],
    shop: [{ label: '좋은 것 일괄 착용', go: prof => bulkEquip(prof) }],  // 상점 '사기'(2026-10-24 사용자: 사기 · 팔기 나눔) — 파는 건 '팔기'(sell)에서
    // 대장장이 '장비 팔기'(2026-10-24 사용자): 왼쪽은 낀 장비, 가방 장비를 고르면 판다
    sell: [{ label: '좋은 것 일괄 착용', go: prof => bulkEquip(prof) }, { label: '약한 장비 일괄 판매', sell: true, go: prof => bulkSell(prof) }],
  };
  // 장비를 벗을 때 낀 보석도 뺄지 묻는다(2026-10-24 사용자) — 예 = 주머니로, 아니요 = 장비에 그대로
  function askGemsOff(prof, item) {
    const gs = (item.gems || []).filter(Boolean);
    if (!gs.length) return;
    Game.overlay({ type: 'confirm', defaultYes: true, text: '벗은 ' + item.name + '에 낀 보석도 뺄까요?', sub: '뺀 보석은 주머니로 돌아가요: ' + gs.map(stoneName).join(' · '),
      yes: () => { item.gems.forEach((g, i) => { if (g) { Elements.add(prof, g); item.gems[i] = null; } }); Game.toast('보석을 주머니로 뺐어요'); Game.changed(); } });
  }
  function bulkEquip(prof) {
    const n = Items.equipBest(prof);
    Game.toast(n ? '더 좋은 장비 ' + n + '개로 바꿔 꼈어요' : '이미 가장 좋은 장비를 끼고 있어요');
    if (n) Game.changed();
  }
  function bulkSell(prof) {
    const idx = Items.junk(prof);
    if (!idx.length) { Game.toast('팔 장비가 없어요 (낀 것보다 약한 장비만 팔아요)'); return; }
    const gold = idx.reduce((a, i) => a + prof.bag[i].value, 0);
    Game.overlay({ type: 'confirm', text: '낀 것보다 약한 장비 ' + idx.length + '개를 팔까요? (+' + gold + 'G)', sub: '노랑 · 주황 · 강화된 것 · 못 끼는 것 · 더 좋은 것은 절대 안 팔아요 · 보석은 주머니로',
      yes: () => { const r = Items.sellAll(prof, idx); Game.toast(idx.length + '개 판매 +' + r.gold + 'G' + (r.gems ? ' · 보석 ' + r.gems + '개는 주머니로' : '')); Game.changed(); } });
  }
  // 상점 물건: 물약 + 가장 작은(조각) 속성석 · 보석
  // 상점 물건 하나 사기(장비 창 '사기' · 아이템 사고팔기 창 공용)
  function buyGood(prof, g) {
    if (g.scroll) {
      if (prof.gold < INHERIT_PRICE) { Game.toast('골드가 모자라요 (' + INHERIT_PRICE + 'G)'); return; }
      prof.gold -= INHERIT_PRICE; Items.addScroll(prof, g.scroll);
      Game.toast('계승 주문서를 샀어요 (-' + INHERIT_PRICE + 'G) · 가진 개수 ' + prof.scrolls[scrollKey(g.scroll)]);
    } else if (!g.potion) {
      if (prof.gold < SHARD_PRICE) { Game.toast('골드가 모자라요 (' + SHARD_PRICE + 'G)'); return; }
      prof.gold -= SHARD_PRICE; Elements.add(prof, { el: g.el, size: 0 });
      Game.toast(stoneName(g) + '을 샀어요 (-' + SHARD_PRICE + 'G) · 가진 개수 ' + prof.stones[Elements.key(g)]);
    } else {
      if (prof.potions >= clsOf(prof).potion.max) { Game.toast('물약은 ' + clsOf(prof).potion.max + '개까지 들 수 있어요'); return; }
      if (prof.gold < POTION_PRICE) { Game.toast('골드가 모자라요'); return; }
      prof.gold -= POTION_PRICE; prof.potions++; Game.toast('물약을 샀어요 (-' + POTION_PRICE + 'G)');
    }
    Sfx.gold();
    Game.changed();
  }
  const goodName = g => (g.potion ? '체력 물약' : g.scroll ? scrollName(g.scroll) : stoneName(g));
  const goodPrice = g => (g.potion ? POTION_PRICE : g.scroll ? INHERIT_PRICE : SHARD_PRICE);
  const SHOP_GOODS = () => [{ potion: true }, ...[...EL_ORDER, ...GEM_ORDER].map(el => ({ el, size: 0 })), { scroll: { g: 'inherit', r: 0 } }];
  const inv = {
    zone: 'bag', r: 0, c: 0, idx: 0, btn: 0, shop: 0,
    open(mode) { this.zone = mode === 'shop' ? 'shop' : 'bag'; this.idx = 0; this.eslot = 'weapon'; this.shop = 0; },
    selected(prof) {
      if (this.zone === 'bag') return { item: prof.bag[this.idx], from: 'bag' };
      if (this.zone === 'equip') { const s = this.eslot; return { item: prof.equip[s], from: 'equip', slot: s }; }
      if (this.zone === 'btn') return { item: null, from: 'btn' };
      return { item: null, from: 'shop', good: SHOP_GOODS()[this.shop] };
    },
    update(o, prof) {
      if (Input.wasPressed('back') || Input.wasPressed('inv')) { Game.closeOverlay(); return; }
      if (Input.wasPressed('special')) { bulkEquip(prof); return; }  // 단축키: 특수기 버튼 = 일괄 착용
      this.navigate(o.mode);
      if (!Input.wasPressed('ok')) return;
      if (this.zone === 'btn') { INV_BTNS[o.mode][this.btn].go(prof); return; }
      const sel = this.selected(prof);
      if (sel.from === 'shop' && sel.good.scroll) {  // 계승 주문서 사기
        if (prof.gold < INHERIT_PRICE) { Game.toast('골드가 모자라요 (' + INHERIT_PRICE + 'G)'); return; }
        prof.gold -= INHERIT_PRICE;
        Items.addScroll(prof, sel.good.scroll);
        Game.toast('계승 주문서를 샀어요 (-' + INHERIT_PRICE + 'G) · 가진 개수 ' + prof.scrolls[scrollKey(sel.good.scroll)]);
        Game.changed();
        return;
      }
      if (sel.from === 'shop' && !sel.good.potion) {  // 조각 속성석 · 보석 사기
        const g = sel.good;
        if (prof.gold < SHARD_PRICE) { Game.toast('골드가 모자라요 (' + SHARD_PRICE + 'G)'); return; }
        prof.gold -= SHARD_PRICE;
        Elements.add(prof, { el: g.el, size: 0 });
        Game.toast(stoneName(g) + '을 샀어요 (-' + SHARD_PRICE + 'G) · 가진 개수 ' + prof.stones[Elements.key(g)]);
        Game.changed();
        return;
      }
      if (sel.from === 'shop') {
        if (prof.potions >= CLASSES.swordsman.potion.max) Game.toast('물약은 ' + CLASSES.swordsman.potion.max + '개까지 들 수 있어요');
        else if (prof.gold < POTION_PRICE) Game.toast('골드가 모자라요');
        else { prof.gold -= POTION_PRICE; prof.potions++; Game.toast('물약을 샀어요 (-' + POTION_PRICE + 'G)'); Game.changed(); }
        return;
      }
      if (!sel.item) return;
      if (o.mode === 'shop' && sel.from !== 'shop') { Game.toast('여기서는 사기만 해요 — 팔려면 상인 엘린의 「팔기」'); return; }  // 가방은 보기만
      if (o.mode === 'sell' && sel.from === 'bag') {
        if (sel.from === 'bag') {
          const it = sel.item, idx = this.idx;
          const sell = () => {
            if (prof.bag[idx] !== it) return;
            prof.gold += it.value; prof.bag[idx] = null;
            const back = (it.gems || []).filter(Boolean);  // 낀 보석은 주머니로 돌아온다
            for (const g of back) Elements.add(prof, g);
            Game.toast(Items.nameOf(it) + ' 판매 +' + it.value + 'G' + (back.length ? ' · 보석 ' + back.length + '개는 주머니로' : ''));
            Game.changed();
          };
          // 보석이 낀 장비 · 강화된 장비 · 유니크는 한 번 더 묻는다(2026-10-24 사용자)
          const gemsIn = (it.gems || []).filter(Boolean);
          if (gemsIn.length) Game.overlay({ type: 'confirm', danger: !!(it.ups || it.uniq), text: '보석을 빼고 ' + Items.nameOf(it) + '을(를) 팔까요? (+' + it.value + 'G)',
            sub: '낀 보석 ' + gemsIn.map(stoneName).join(' · ') + '은(는) 주머니로 돌아가요' + (it.ups ? ' · +' + it.ups + ' 강화는 사라져요' : it.uniq ? ' · 유니크예요' : ''), yes: sell });
          else if (it.ups || it.uniq) Game.overlay({ type: 'confirm', danger: true, text: (it.ups ? '+' + it.ups + ' 강화된 ' : '유니크 ') + it.name + '을(를) 팔까요? (+' + it.value + 'G)',
            sub: it.ups ? '강화는 계승 주문서로 다른 장비에 옮길 수 있어요' : prof.vault[vaultKey(it)] ? '유니크 특수 효과: ' + UNIQUES[it.uniq].fx : '창고 컬렉션에 아직 없는 유니크예요 — 창고에 넣을 수 있어요', yes: sell });
          else sell();
        }
        return;
      }
      if (sel.from === 'bag') {
        const it = sel.item, old = prof.equip[it.slot];
        if (!Items.classOk(prof, it)) { Game.toast(clsOf(prof).name + '는 ' + clsOf(prof).weapons.map(k => GEAR_FORMS.weapon.find(f => f.kind === k).noun).join(' · ') + '만 낄 수 있어요'); return; }
        if (!Items.canWear(prof, it)) { Game.toast('Lv.' + Items.req(it) + '부터 낄 수 있어요 (지금 Lv.' + prof.lv + ')'); return; }
        prof.equip[it.slot] = it;
        prof.bag[this.idx] = old;
        Game.toast(it.name + ' 장착');
        Game.changed();
        if (old) askGemsOff(prof, old);  // 바꿔 끼워 벗겨진 장비에 보석이 있으면 뺄지 묻는다
        return;
      } else {
        const empty = prof.bag.indexOf(null);
        if (empty < 0) { Game.toast('가방이 가득 찼어요'); return; }
        prof.bag[empty] = sel.item; prof.equip[sel.slot] = null;
        Game.toast(sel.item.name + ' 벗음');
        Game.changed();
        askGemsOff(prof, sel.item);
        return;
      }
    },
    navigate(mode) {
      if (this.zone === 'bag') {
        const row = Math.floor(this.idx / BAG_COLS), col = this.idx % BAG_COLS;
        if (Input.nav('left')) {
          if (col > 0) this.idx--;
          else if (mode === 'shop') this.zone = 'shop';
          else { this.zone = 'equip'; this.eslot = BAG_TO_EQUIP[Math.min(3, row)]; }
        }
        if (Input.nav('right') && col < BAG_COLS - 1) this.idx++;
        if (Input.nav('up')) { if (row > 0) this.idx -= BAG_COLS; else { this.zone = 'btn'; this.btn = Math.min(INV_BTNS[mode].length - 1, col >= 6 ? 1 : 0); } }
        if (Input.nav('down') && row < BAG_SIZE / BAG_COLS - 1) this.idx += BAG_COLS;
      } else if (this.zone === 'btn') {
        const n = INV_BTNS[mode].length;
        if (Input.nav('left')) { if (this.btn > 0) this.btn--; }
        if (Input.nav('right') && this.btn < n - 1) this.btn++;
        if (Input.nav('down')) { this.zone = 'bag'; this.idx = this.btn ? 6 : 2; }
      } else if (this.zone === 'equip') {
        const go = (dx, dy) => { const n = equipStep(this.eslot, dx, dy); if (n) this.eslot = n; return !!n; };
        if (Input.nav('left')) go(-1, 0);
        if (Input.nav('up')) go(0, -1);
        if (Input.nav('down')) go(0, 1);
        if (Input.nav('right') && !go(1, 0)) {  // 오른쪽 끝에서 → 는 가방(높이가 비슷한 줄)
          this.zone = 'bag';
          this.idx = Math.max(0, Math.min(3, Math.round((EQUIP_POS[this.eslot][1] - 104) / 76))) * BAG_COLS;
        }
      } else {  // 상점 목록
        const n = SHOP_GOODS().length;
        if (Input.nav('up')) this.shop = (this.shop + n - 1) % n;
        if (Input.nav('down')) this.shop = (this.shop + 1) % n;
        if (Input.nav('right')) { this.zone = 'bag'; this.idx = 0; }
      }
    },
    draw(ctx, o, prof, time) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
      const sel = this.selected(prof);
      // 왼쪽: 장비 또는 상점
      Gfx.panel(ctx, 24, 24, 340, 470);
      if (o.mode === 'shop') {
        T_(ctx, '상점 — 사기', 44, 62, 24, '#f0e0b8');
        // 파는 물건: 물약 + 조각 속성석 4 + 조각 보석 2
        ctx.imageSmoothingEnabled = false;
        SHOP_GOODS().forEach((g, i) => {
          const y = 78 + i * 44, on = this.zone === 'shop' && this.shop === i;
          zone(40, y, 308, 40, { on: () => this.zone === 'shop' && this.shop === i, pick: () => { this.zone = 'shop'; this.shop = i; } });
          Gfx.panel(ctx, 40, y, 308, 40, { border: on ? '#ffd36a' : '#3a2e36', bg: '#1d151b' });
          if (g.potion) Gfx.spr(ctx, 'flask_big_red', 64, y + 35, { scale: 1.8 });
          else if (g.scroll) Gfx.scrollIcon(ctx, g.scroll, 64, y + 21, 24);
          else Gfx.stoneIcon(ctx, g, 64, y + 20, 26);
          const name = g.potion ? '체력 물약' : g.scroll ? scrollName(g.scroll) : stoneName(g);
          const price = g.potion ? POTION_PRICE : g.scroll ? INHERIT_PRICE : SHARD_PRICE;
          const have = g.potion ? prof.potions + '/' + CLASSES.swordsman.potion.max : g.scroll ? (prof.scrolls[scrollKey(g.scroll)] || 0) + '장' : (prof.stones[Elements.key(g)] || 0) + '개';
          T_(ctx, name, 88, y + 27, 15, on ? '#ffd36a' : g.potion ? '#f0e0b8' : g.scroll ? scrollColor(g.scroll) : ELEMENTS[g.el].color);
          T_(ctx, price + 'G · ' + have, 336, y + 27, 12, '#9a8e96', 'right');
        });
        T_(ctx, '가방은 보기만(등급 · 비교) · 팔기는 「팔기」에서', 44, 446, 12, '#9a8e96');
        T_(ctx, '골드 ' + prof.gold + 'G', 44, 478, 20, '#ffd34d');
      } else {
        T_(ctx, o.mode === 'sell' ? '장비 팔기' : '장비 스테이터스', 44, 62, 24, '#f0e0b8');
        if (o.mode === 'sell') T_(ctx, '골드 ' + prof.gold + 'G', 344, 62, 16, '#ffd34d', 'right');  // 위 오른쪽은 버튼 둘이라 골드는 여기
        else T_(ctx, clsOf(prof).name + ' Lv.' + prof.lv, 344, 62, 15, '#c8b8a0', 'right');
        // 가운데 아바타: 은은한 받침 빛 + 큰 캐릭터
        const ax = 194, ay = 262;
        const glow = ctx.createRadialGradient(ax, ay - 50, 10, ax, ay - 50, 110);
        glow.addColorStop(0, 'rgba(255,220,150,0.10)'); glow.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = glow; ctx.fillRect(ax - 110, ay - 160, 220, 220);
        Art.avatar(ctx, prof, ax, ay, 4, time);
        // 아바타 아래: 속성석 4칸(칸 이름 · 낀 돌, 직업마다 기술 이름)
        STONE_SLOTS.forEach((slot, i) => {
          const bx = 117 + i * 40, by = 286, st = prof.sockets[slot], col = st ? ELEMENTS[st.el].color : null;
          ctx.fillStyle = 'rgba(24,18,22,0.95)'; ctx.fillRect(bx, by, 34, 34);
          ctx.strokeStyle = col || '#3a2e36'; ctx.lineWidth = col ? 2 : 1; ctx.strokeRect(bx + 1, by + 1, 32, 32);
          if (st) Gfx.stoneIcon(ctx, st, bx + 17, by + 18, 24);
          T_(ctx, clsOf(prof).slotShort[slot], bx + 17, by + 46, 10, col || '#6a6068', 'center');
        });
        const sb = Elements.setBonus(prof);  // 속성석 세트 효과
        if (sb) T_(ctx, '◆ ' + sb.name + ' — ' + sb.desc, 194, 352, 10, '#ffd36a', 'center');
        // 장비 칸(56): 끼는 자리대로
        for (const slot of SLOTS) {
          const [x, y] = EQUIP_POS[slot];
          zone(x, y, 56, 56, { on: () => this.zone === 'equip' && this.eslot === slot, pick: () => { this.zone = 'equip'; this.eslot = slot; } });
          cell(ctx, x, y, 56, prof.equip[slot], this.zone === 'equip' && this.eslot === slot, SLOT_NAMES[slot], prof.lv);
        }
        const s = Items.playerStats(prof);
        const rows = [['체력', s.hp], [statName('atk', prof), s.atk], ['방어력', s.def], ['최대 기력', s.sp], ['기력 회복', '+' + s.spRegen + '%'], ['치명타', s.crit + '%'], ['치명 피해', '+' + s.critDmg + '%'],
          ['공격 속도', '+' + s.aspd + '%'], ['이동 속도', '+' + s.move + '%'], ['피해', '+' + s.dmg + '%'], ['대시 기력', '-' + s.dashCost + '%']];
        rows.forEach(([k, v], i) => {
          const x = 44 + (i % 2) * 160, y = 372 + Math.floor(i / 2) * 20;
          T_(ctx, k, x, y, 13, '#9a8e96');
          T_(ctx, String(v), x + 140, y, 13, '#f0e8dc', 'right');
        });
      }
      // 오른쪽 위: 가방
      Gfx.panel(ctx, 380, 24, 556, 300);
      const used = prof.bag.filter(Boolean).length;
      T_(ctx, '가방 ' + used + '/' + BAG_SIZE, 400, 58, 20, '#f0e0b8');
      if (o.mode === 'equip') T_(ctx, '골드 ' + prof.gold + 'G', 916, 58, 16, '#ffd34d', 'right');  // 상점 · 팔기는 왼쪽에 골드
      INV_BTNS[o.mode].forEach((b, i) => {
        const x = 520 + i * 158, on = this.zone === 'btn' && this.btn === i;
        zone(x, 36, 150, 32, { pick: () => { this.zone = 'btn'; this.btn = i; }, now: true });
        ctx.fillStyle = on ? 'rgba(255,211,106,0.18)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(x, 38, 150, 28);
        ctx.strokeStyle = on ? '#ffd36a' : '#5a4650'; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(x + 0.5, 38.5, 149, 27);
        T_(ctx, b.label, x + 75, 57, 13, on ? '#ffd36a' : '#e8e0d0', 'center');
      });
      for (let i = 0; i < BAG_SIZE; i++) {
        const x = 400 + (i % BAG_COLS) * 44, y = 80 + Math.floor(i / BAG_COLS) * 46;
        zone(x - 2, y - 3, 44, 46, { on: () => this.zone === 'bag' && this.idx === i, pick: () => { this.zone = 'bag'; this.idx = i; } });
        cell(ctx, x, y, 40, prof.bag[i], this.zone === 'bag' && this.idx === i, null, prof.lv);
      }
      T_(ctx, '가방이 가득 차면 낀 것보다 못한 장비는 주울 때 골드로 바뀌어요', 400, 300, 12, '#7a7078');
      // 오른쪽 아래: 설명 + 비교
      Gfx.panel(ctx, 380, 334, 556, 160);
      if (sel.item) {
        const lines = Items.describe(sel.item, prof);
        let y = 364;
        lines.forEach((ln, i) => {
          if (y > 482) return;
          T_(ctx, ln.t, 400, y, ln.big ? 18 : 13, ln.c);
          y += ln.big ? 24 : 18;
        });
        if (sel.from === 'bag') {  // 낀 것과 비교(사기 · 팔기 창에서도 무엇을 팔아도 되는지 보이게)
          const cur = prof.equip[sel.item.slot];
          const diff = Items.compare(sel.item, cur);
          T_(ctx, cur ? '낀 것과 비교' : '빈 칸에 낀다', 690, 364, 14, '#c8b8a0');
          diff.slice(0, 7).forEach(({ k, d }, i) => {
            T_(ctx, (d > 0 ? '▲ ' : '▼ ') + statName(k, prof) + ' ' + (d > 0 ? '+' : '') + d + (STATS[k].pct ? '%' : ''), 690, 386 + i * 18, 13, d > 0 ? '#7dff8a' : '#ff7a6a');
          });
        }
      } else if (sel.from === 'shop') {
        const g = sel.good;
        if (g.potion) T_(ctx, '체력 물약: 최대 체력의 40%를 바로 회복', 400, 370, 14, '#c8b8a0');
        else if (g.scroll) {
          T_(ctx, '계승 주문서 — ' + INHERIT_PRICE + 'G', 400, 370, 16, scrollColor(g.scroll));
          T_(ctx, '강화(+N)를 같은 부위 새 장비로 옮길 때 1장 써요', 400, 394, 13, '#c8b8a0');
          T_(ctx, '대장장이에서 강화된 장비를 고르고 ' + L('special') + ' = 강화 옮기기', 400, 416, 13, '#9a8e96');
        }
        else {
          T_(ctx, stoneName(g) + ' — ' + SHARD_PRICE + 'G', 400, 370, 16, ELEMENTS[g.el].color);
          T_(ctx, GEMS[g.el] ? gemText(g) + ' (' + GEMS[g.el].where + ')' : '무기 속성석 칸에 끼우면 그 기술에 ' + ELEMENTS[g.el].name + ' 속성이 붙어요', 400, 394, 13, '#c8b8a0');
          T_(ctx, '세공사에서 같은 것 3개를 합치면 한 단계 큰 것이 돼요', 400, 416, 13, '#9a8e96');
        }
      } else if (sel.from === 'btn') {
        const sell = INV_BTNS[o.mode][this.btn].sell;
        T_(ctx, sell ? '같은 칸에 낀 것보다 못한 장비를 한꺼번에 팔아요' : '칸마다 가방과 낀 것 중 가장 좋은 장비를 껴요', 400, 370, 14, '#c8b8a0');
        T_(ctx, sell ? '흰 · 파랑만 팔아요 — 노랑 · 주황 · 강화된 것 · 못 끼는 것 · 더 좋은 것은 남겨요' : '지금 낄 수 있는 것 중 능력치 점수가 가장 높은 것 (색 · 보석 칸 · 유니크 효과 포함)', 400, 394, 13, '#9a8e96');
      } else {  // 고른 칸이 비었을 때: 이 판이 무엇인지 알려 준다(2026-10-24 사용자 '빈칸은 무슨 의미?')
        T_(ctx, '아이템 설명', 400, 370, 15, '#8a7e88');
        T_(ctx, '가방이나 장비 칸에서 아이템을 고르면 능력치 · 보석 · 낀 것과 비교가 여기에 나와요', 400, 396, 13, '#6a6068');
      }
      const hint = this.zone === 'btn' ? '누르기 ' + L('ok') : o.mode === 'shop' ? (sel.from === 'shop' ? '구매 ' : '보기만 · 구매는 왼쪽 ') + L('ok') : o.mode === 'sell' && sel.from === 'bag' ? '판매 ' + L('ok') : (sel.from === 'equip' ? '벗기 ' : '끼기 ') + L('ok');
      hintBar(ctx, hint + ' · 일괄 착용 ' + L('special') + ' · 맨 윗줄에서 ↑ = 버튼 · 닫기 ' + L('back') + ' / ' + L('inv'));
    },
  };
  function cell(ctx, x, y, s, item, on, label, plv) {
    ctx.fillStyle = 'rgba(40,30,36,0.95)'; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = item ? RARITY[item.rarity].color : '#3a2e36';
    ctx.lineWidth = item && item.rarity ? 2 : 1;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    if (on) { ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3; ctx.strokeRect(x - 2, y - 2, s + 4, s + 4); }
    if (item) Gfx.icon(ctx, item, x + s / 2, y + s / 2, s * 0.7);
    // 레벨이 모자라 못 끼는 장비: 붉게 덮고 착용 레벨
    if (item && plv !== undefined && plv < Items.req(item)) {
      ctx.fillStyle = 'rgba(150,20,20,0.35)'; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      T_(ctx, 'Lv' + Items.req(item), x + 3, y + s - 4, 10, '#ff8a7a');
    }
    // 강화 단계(왼쪽 위)
    if (item && item.ups) T_(ctx, '+' + item.ups, x + 4, y + 13, 11, '#ffd36a');
    // 보석 칸: 오른쪽 아래 작은 네모(낀 보석 색)
    if (item && item.gems) item.gems.forEach((g, i) => {
      const q = Math.max(5, Math.round(s / 10)), gx = x + s - 4 - (i + 1) * (q + 2), gy = y + s - 4 - q;
      ctx.fillStyle = g ? ELEMENTS[g.el].color : '#1a1216'; ctx.fillRect(gx, gy, q, q);
      ctx.strokeStyle = '#8a7e88'; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, q - 1, q - 1);
      // 낀 보석 크기 단계 숫자(1~7, 완전한 5부터 금색) — 네모 왼쪽에 작게(2026-10-24 사용자)
      if (g && s >= 32) T_(ctx, String(g.size + 1), gx - 1, gy + q, Math.max(9, Math.round(s / 6)), g.size >= 4 ? '#ffd36a' : '#ffffff', 'right');
    });
    else if (label) T_(ctx, label, x + s / 2, y + s / 2 + 5, 13, '#5a5058', 'center');
  }

  // 주머니 목록(오른쪽 판): rows 에 { empty } 가 있으면 '칸 비우기' 줄. 줄이 넘치면 고른 줄이 보이게 내려 보여 준다.
  const VIS = 14;
  // fits(r) 를 주면 false 인 줄은 흐리게(그 칸에 못 끼는 것)
  // tapRow(i) = 그 줄을 눌렀을 때 누를 곳 설정(zone 의 z)
  function pouch(ctx, title, rows, picking, pick, emptyMsg, fits, tapRow) {
    Gfx.panel(ctx, 488, 24, 448, 470);
    if (title) T_(ctx, title, 508, 64, 20, '#f0e0b8');
    if (!rows.some(r => !r.empty)) T_(ctx, emptyMsg, 508, rows.length ? 136 : 100, 13, '#6a6068');
    const top = rows.length > VIS ? Math.max(0, Math.min(rows.length - VIS, (picking ? pick : 0) - VIS + 2)) : 0;
    if (top > 0) T_(ctx, '▲', 912, 64, 12, '#8a7e88', 'right');
    if (top + VIS < rows.length) T_(ctx, '▼', 912, 84 + VIS * 26 + 14, 12, '#8a7e88', 'right');
    rows.forEach((r, i) => {
      if (i < top || i >= top + VIS) return;
      const y = 84 + (i - top) * 26;
      const on = picking && pick === i;
      if (tapRow) zone(500, y, 424, 26, tapRow(i));
      if (on) { ctx.fillStyle = 'rgba(255,211,106,0.14)'; ctx.fillRect(500, y, 424, 24); }
      if (r.empty) { if (on) T_(ctx, '▶', 512, y + 18, 12, '#ffd36a'); T_(ctx, '칸 비우기', 528, y + 18, 14, on ? '#ffd36a' : '#9a8e96'); return; }
      const no = fits && !fits(r);
      if (no) ctx.globalAlpha = 0.35;
      Gfx.stoneIcon(ctx, r, 526, y + 11, 20);
      ctx.globalAlpha = 1;
      T_(ctx, stoneName(r), 546, y + 18, 14, on ? '#ffd36a' : no ? '#5a5058' : ELEMENTS[r.el].color);
      if (no) T_(ctx, GEMS[r.el].where + ' 전용', 870, y + 18, 11, '#6a6068', 'right');
      T_(ctx, '×' + r.n, 912, y + 18, 14, '#e8e0d0', 'right');
    });
  }
  function hintBar(ctx, hint) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 496, 960, 44);  // 뒤 화면 안내 글이 비치지 않게
    T_(ctx, hint, 480, 522, 13, '#8a7e88', 'center');
  }
  // 주머니에서 하나 꺼내 칸에 끼우고, 칸에 있던 것은 주머니로. pick 0 = 칸 비우기
  function swapIn(prof, list, pick, cur, put, label) {
    if (pick === 0) {
      if (cur) { Elements.add(prof, cur); put(null); Sfx.pickup(); Game.toast(stoneName(cur) + ' 뺌'); }
    } else {
      const st = list[pick - 1];
      Elements.take(prof, st);
      if (cur) Elements.add(prof, cur);
      put({ el: st.el, size: st.size });
      Sfx.stone();  // 끼울 때 맑은 소리
      Game.toast(label + ' ' + stoneName(st));
    }
    Game.changed();
  }

  // ── 속성석: 관리(socket, 끼우기 · 빼기) · 세공사 합치기(craft, 속성석 · 보석 탭) ──
  const CRAFT_TABS = [{ name: '속성석', order: EL_ORDER }, { name: '보석', order: GEM_ORDER }];
  const stones = {
    zone: 'slot', slot: 0, pick: 0, tab: 0,
    open(mode) { this.zone = mode === 'craft' ? 'list' : 'slot'; this.slot = 0; this.pick = 0; },
    list(o, prof) { return Elements.stacks(prof, o.mode === 'craft' ? CRAFT_TABS[this.tab].order : EL_ORDER); },
    update(o, prof) {
      const list = this.list(o, prof);
      if (o.mode === 'craft') {
        if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
        if (Input.nav('left') || Input.nav('right')) { this.tab = 1 - this.tab; this.pick = 0; return; }  // 탭 바꾸기
        this.pick = list.length ? menuNav(Math.min(this.pick, list.length - 1), list.length) : 0;
        if (!Input.wasPressed('ok') || !list.length) return;
        const st = list[this.pick], cost = COMBINE_COST(st.size);
        if (st.size >= STONE_SIZES.length - 1) { Sfx.deny(); Game.toast('가장 큰 크기예요'); }
        else if (st.n < 3) { Sfx.deny(); Game.toast('같은 크기 3개가 있어야 합칠 수 있어요'); }
        else if (prof.gold < cost) { Sfx.deny(); Game.toast('골드가 모자라요 (' + cost + 'G)'); }
        else {
          for (let i = 0; i < 3; i++) Elements.take(prof, st);
          const big = { el: st.el, size: st.size + 1 };
          Elements.add(prof, big);
          prof.gold -= cost;
          Sfx.combine(big.size);
          Game.toast(stoneName(big) + ' 완성! (-' + cost + 'G)');
          Game.changed();
        }
        return;
      }
      if (this.zone === 'slot') {
        if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
        this.slot = menuNav(this.slot, STONE_SLOTS.length);
        if (Input.wasPressed('ok')) { this.zone = 'pick'; this.pick = 0; }
        return;
      }
      // 고르기: 0 = 칸 비우기, 1~ = 주머니의 돌
      if (Input.wasPressed('back') || Input.nav('left')) { this.zone = 'slot'; return; }
      this.pick = menuNav(Math.min(this.pick, list.length), list.length + 1);
      if (!Input.wasPressed('ok')) return;
      const slot = STONE_SLOTS[this.slot];
      swapIn(prof, list, this.pick, prof.sockets[slot], v => { prof.sockets[slot] = v; }, clsOf(prof).slotNames[slot] + ' 칸에');
      this.zone = 'slot';
    },
    draw(ctx, o, prof) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
      const list = this.list(o, prof);
      // 왼쪽: 무기 칸 3개(끼우기) 또는 세공사 설명(합치기)
      Gfx.panel(ctx, 24, 24, 450, 470);
      if (o.mode === 'craft') {
        T_(ctx, '세공사', 44, 64, 24, '#f0e0b8');
        T_(ctx, '같은 종류 · 같은 크기 3개를 합쳐 한 단계 크게', 44, 94, 14, '#c8b8a0');
        T_(ctx, '크기: ' + STONE_SIZES.map(s => s.name).join(' → '), 44, 118, 13, '#9a8e96');
        const st = list[this.pick];
        if (st) {
          const can = st.size < STONE_SIZES.length - 1, gem = !!GEMS[st.el];
          Gfx.stoneIcon(ctx, st, 110, 182, 60);
          T_(ctx, stoneName(st) + ' ×3', 110, 244, 15, ELEMENTS[st.el].color, 'center');
          if (can) {
            T_(ctx, '→', 220, 192, 30, '#c8b8a0', 'center');
            const big = { el: st.el, size: st.size + 1 };
            Gfx.stoneIcon(ctx, big, 330, 182, 60);
            T_(ctx, stoneName(big), 330, 244, 15, ELEMENTS[st.el].color, 'center');
            const cost = COMBINE_COST(st.size), poor = prof.gold < cost;
            T_(ctx, '비용 ' + cost + 'G' + (poor ? ' (골드 부족)' : '') + ' · 가진 개수 ' + st.n + (st.n >= 3 ? '' : ' (3개 필요)'), 44, 284, 14, st.n >= 3 && !poor ? '#7dff8a' : '#ff8a6a');
            if (gem) { T_(ctx, '지금: ' + gemText(st), 44, 310, 13, '#c8b8a0'); T_(ctx, '합치면: ' + gemText(big), 44, 332, 13, '#7dff8a'); }
            else T_(ctx, '세기 ×' + STONE_SIZES[st.size].power + ' → ×' + STONE_SIZES[st.size + 1].power, 44, 308, 14, '#c8b8a0');
          } else {
            T_(ctx, '가장 큰 크기예요', 44, 284, 14, '#c8b8a0');
            if (gem) T_(ctx, gemText(st), 44, 310, 13, '#c8b8a0');
          }
        }
        // 속성석: 크기별로 열리는 능력(✓ 지금 열림 · 노랑 = 합치면 열림 · 회색 = 아직)
        if (st && !GEMS[st.el]) {
          const ab = { basic: elAbil(st.el, 'basic', prof), charge: elAbil(st.el, 'charge', prof), wave: elAbil(st.el, 'wave', prof), dash: elAbil(st.el, 'dash', prof), p1: EL_ABIL[st.el].p1, p2: EL_ABIL[st.el].p2 },
            next = Math.min(STONE_SIZES.length - 1, st.size + 1);
          const row = (y, tier, head, desc) => {
            const need = EL_UNLOCK[tier], now = st.size >= need, soon = !now && next >= need;
            T_(ctx, (now ? '✓ ' : soon ? '합치면 열림 ▶ ' : '· ') + head, 44, y, 13, now ? '#7dff8a' : soon ? '#ffd36a' : '#8a7e88');
            if (desc) T_(ctx, desc, 58, y + 18, 12, now || soon ? '#c8b8a0' : '#6a6068');
          };
          row(340, 'slot', '보통부터 칸 능력', ab.basic[0] + ', ' + ab.charge[0] + ', ' + ab.wave[0] + ', ' + ab.dash[0]);
          row(384, 'p1', '완전한부터 패시브: ' + ab.p1[0], ab.p1[1]);
          row(428, 'p2', '전설부터 패시브: ' + ab.p2[0], ab.p2[1]);
        }
        T_(ctx, '골드 ' + prof.gold + 'G', 44, 486, 15, '#ffd34d');
      } else {
        if (!o.tabbed) T_(ctx, '속성석 관리', 44, 64, 24, '#f0e0b8');
        if (!prof.equip.weapon) T_(ctx, '무기를 끼지 않아서 속성석이 잠들어 있어요', 44, 90, 13, '#ff8a6a');
        else {
          const ps = Elements.passives(prof), sb = Elements.setBonus(prof);
          // 패시브 · 세트를 한 줄에 같이 쓰면 패시브가 길 때 겹쳐서(2026-10-25 사용자) 두 줄로, 넘치면 글자를 줄인다
          fitText(ctx, '속성 패시브: ' + (ps.length ? ps.join(' · ') : '없음 — 완전한 크기부터 열려요'), 44, 88, 12, 410, ps.length ? '#7dff8a' : '#8a7e88');
          fitText(ctx, sb ? '세트 ◆ ' + sb.name + ' — ' + sb.desc : '세트 없음(4칸 모두 보통 이상: 같은 속성 4 · 두 속성 2 + 2)', 44, 103, 11, 410, sb ? '#ffd36a' : '#6a6068');
        }
        // 칸 4개(기본 · 회전 · 검기 · 대시): 칸 이름 · 돌 이름 한 줄, 아래 설명 3줄
        STONE_SLOTS.forEach((slot, i) => {
          const y = 110 + i * 95, on = this.slot === i, s = prof.sockets[slot];
          zone(40, y, 418, 88, { pick: () => { this.zone = 'slot'; this.slot = i; }, now: true });  // 누르면 바로 주머니에서 고르기
          Gfx.panel(ctx, 40, y, 418, 88, { border: on ? '#ffd36a' : '#3a2e36', bg: '#1d151b' });
          ctx.fillStyle = 'rgba(40,30,36,0.95)'; ctx.fillRect(52, y + 17, 54, 54);
          if (s) Gfx.stoneIcon(ctx, s, 79, y + 44, 44);
          T_(ctx, clsOf(prof).slotNames[slot], 120, y + 24, 15, on ? '#ffd36a' : '#f0e0b8');
          T_(ctx, s ? stoneName(s) : '비어 있음', 446, y + 24, 14, s ? ELEMENTS[s.el].color : '#5a5058', 'right');
          if (s) Elements.describe(s, slot, prof).forEach((ln, k) => T_(ctx, ln, 120, y + 44 + k * 16, 12, k === 2 ? (ln[0] === '✦' ? '#7dff8a' : '#8a7e88') : '#c8b8a0'));
          else T_(ctx, '속성석을 끼우면 이 기술에 속성 힘이 붙어요', 120, y + 46, 12, '#6a6068');
        });
      }
      // 오른쪽: 주머니
      const craft = o.mode === 'craft';
      const what = craft ? CRAFT_TABS[this.tab].name : '속성석';
      pouch(ctx, craft ? '' : '속성석 주머니', craft ? list : [{ empty: true }, ...list],
        craft || this.zone === 'pick', this.pick, what + '이 없어요 — 던전에서 몹 · 상자 · 보스가 떨어뜨려요', null,
        i => (craft ? { on: () => this.pick === i, pick: () => { this.pick = i; } }
          : { on: () => this.zone === 'pick' && this.pick === i, pick: () => { this.zone = 'pick'; this.pick = i; } }));
      if (craft) CRAFT_TABS.forEach((t, i) => {  // 탭: 속성석 | 보석
        const x = 500 + i * 118, on = this.tab === i;
        zone(x, 36, 110, 38, { pick: () => { if (this.tab !== i) { this.tab = i; this.pick = 0; } }, key: null });
        ctx.fillStyle = on ? 'rgba(255,211,106,0.16)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x, 38, 110, 34);
        ctx.strokeStyle = on ? '#ffd36a' : '#4a3a40'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, 39, 108, 32);
        T_(ctx, t.name, x + 55, 62, 17, on ? '#ffd36a' : '#8a7e88', 'center');
      });
      if (craft) T_(ctx, '←→ 탭 바꾸기', 746, 61, 12, '#8a7e88');
      hintBar(ctx, craft ? '탭 바꾸기 ←→ · 합치기 ' + L('ok') + ' · 닫기 ' + L('back')
        : this.zone === 'slot' ? '칸 고르기 ↑↓ · 바꾸기 ' + L('ok') + ' · 닫기 ' + L('back') : '돌 고르기 ↑↓ · 끼우기 ' + L('ok') + ' · 돌아가기 ' + L('back'));
    },
  };

  // ── 보석 관리: 낀 장비의 보석 칸(매직 이상 1칸) ↔ 보석 주머니 ──
  const gems = {
    zone: 'slot', slot: 0, pick: 0,
    open() { this.zone = 'slot'; this.slot = 0; this.pick = 0; },
    rows(prof) {
      const out = [];
      for (const s of SLOTS) { const it = prof.equip[s]; if (it && it.gems) it.gems.forEach((g, i) => out.push({ slot: s, item: it, i })); }
      return out;
    },
    update(o, prof) {
      const rows = this.rows(prof), list = Elements.stacks(prof, GEM_ORDER);
      if (this.zone === 'slot') {
        if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
        if (!rows.length) return;
        this.slot = menuNav(Math.min(this.slot, rows.length - 1), rows.length);
        if (Input.wasPressed('ok')) { this.zone = 'pick'; this.pick = 0; }
        return;
      }
      if (Input.wasPressed('back') || Input.nav('left')) { this.zone = 'slot'; return; }
      this.pick = menuNav(Math.min(this.pick, list.length), list.length + 1);
      if (!Input.wasPressed('ok')) return;
      const r = rows[this.slot], st = this.pick > 0 && list[this.pick - 1];
      if (st && !gemFits(st, r.slot)) { Game.toast(GEMS[st.el].stone + '은(는) ' + GEMS[st.el].where + '에만 끼울 수 있어요'); return; }
      swapIn(prof, list, this.pick, r.item.gems[r.i], v => { r.item.gems[r.i] = v; }, SLOT_NAMES[r.slot] + '에');
      this.zone = 'slot';
    },
    draw(ctx, o, prof) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
      const rows = this.rows(prof), list = Elements.stacks(prof, GEM_ORDER);
      Gfx.panel(ctx, 24, 24, 450, 470);
      if (!o.tabbed) T_(ctx, '보석 관리', 44, 64, 24, '#f0e0b8');
      T_(ctx, '매직 이상 장비에 1칸 · 공격 = 무기 · 장신구, 방어 = 방어구', 44, 446, 12, '#9a8e96');
      if (!rows.length) {
        T_(ctx, '보석 칸이 있는 장비를 끼고 있지 않아요', 44, 110, 15, '#ff8a6a');
        T_(ctx, '매직(파랑) 이상 장비를 끼면 칸이 생겨요', 44, 134, 13, '#9a8e96');
      }
      ctx.imageSmoothingEnabled = false;
      rows.forEach((r, i) => {
        const y = 84 + i * 26, on = this.slot === i, g = r.item.gems[r.i];
        zone(36, y, 426, 26, { pick: () => { this.zone = 'slot'; this.slot = i; }, now: true });
        if (on) { ctx.fillStyle = 'rgba(255,211,106,0.14)'; ctx.fillRect(36, y, 426, 25); }
        if (r.i === 0) Gfx.icon(ctx, r.item, 56, y + 12, 22);
        T_(ctx, SLOT_NAMES[r.slot] + (r.item.gems.length > 1 ? ' ' + (r.i + 1) : ''), 76, y + 18, 14, on ? '#ffd36a' : RARITY[r.item.rarity].color);
        if (g) { Gfx.stoneIcon(ctx, g, 176, y + 12, 20); T_(ctx, stoneName(g), 194, y + 18, 14, ELEMENTS[g.el].color); }
        else T_(ctx, '◇ 비어 있음', 168, y + 18, 14, '#5a5058');
      });
      const cur = rows[this.slot];
      if (cur) {
        T_(ctx, cur.item.name, 44, 462, 13, RARITY[cur.item.rarity].color);
        const g = cur.item.gems[cur.i];
        T_(ctx, g ? gemText(g) : '빈 칸 — 오른쪽 주머니에서 보석을 골라 끼워요', 44, 478, 13, g ? '#c8b8a0' : '#6a6068');
      }
      const picking = this.zone === 'pick';
      pouch(ctx, '보석 주머니', [{ empty: true }, ...list], picking, this.pick, '보석이 없어요 — 던전에서 떨어져요', cur ? g => gemFits(g, cur.slot) : null,
        i => ({ on: () => this.zone === 'pick' && this.pick === i, pick: () => { if (rows.length) { this.zone = 'pick'; this.pick = i; } } }));
      const sel = picking && list[this.pick - 1];
      if (sel) T_(ctx, gemText(sel), 508, 482, 13, '#c8b8a0');
      hintBar(ctx, this.zone === 'slot' ? '칸 고르기 ↑↓ · 바꾸기 ' + L('ok') + ' · 닫기 ' + L('back') : '보석 고르기 ↑↓ · 끼우기 ' + L('ok') + ' · 돌아가기 ' + L('back'));
    },
  };

  // ── 속성석 · 보석 관리 한 창(2026-10-24 사용자): 위 탭 속성석 | 보석, 칸 고르기에서 ←→ = 탭 바꾸기 ──
  const MANAGE_TABS = ['속성석', '보석'];
  const manage = {
    tab: 0,
    open(tab) { this.tab = tab || 0; stones.open('socket'); gems.open(); },
    sub() { return this.tab ? gems : stones; },
    update(o, prof) {
      const sub = this.sub();
      if (sub.zone === 'slot' && (Input.nav('left') || Input.nav('right'))) { this.tab = 1 - this.tab; this.sub().open('socket'); return; }
      sub.update({ mode: 'socket', tabbed: true }, prof);
    },
    draw(ctx, o, prof) {
      const sub = this.sub();
      sub.draw(ctx, { mode: 'socket', tabbed: true }, prof);
      MANAGE_TABS.forEach((name, i) => {
        const x = 40 + i * 118, on = this.tab === i;
        zone(x, 34, 110, 38, { pick: () => { if (this.tab !== i) { this.tab = i; this.sub().open('socket'); } }, key: null });
        ctx.fillStyle = on ? 'rgba(255,211,106,0.16)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x, 36, 110, 34);
        ctx.strokeStyle = on ? '#ffd36a' : '#4a3a40'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, 37, 108, 32);
        T_(ctx, name + ' 관리', x + 55, 60, 16, on ? '#ffd36a' : '#8a7e88', 'center');
      });
      T_(ctx, '←→ 탭 바꾸기', 454, 59, 12, '#8a7e88', 'right');
      if (sub.zone === 'slot') hintBar(ctx, '탭 바꾸기 ←→ · 칸 고르기 ↑↓ · 바꾸기 ' + L('ok') + ' · 닫기 ' + L('back'));
    },
  };

  // 세로 목록(줄이 넘치면 고른 줄을 따라 내려감). drawRow(i, y, on)
  function listView(ctx, x, w, n, sel, active, drawRow, tapRow) {
    const top = n > VIS ? Math.max(0, Math.min(n - VIS, sel - VIS + 2)) : 0;
    if (top > 0) T_(ctx, '▲', x + w - 12, 80, 11, '#8a7e88', 'right');  // 제목 줄 글과 안 겹치게 목록 바로 위
    if (top + VIS < n) T_(ctx, '▼', x + w - 12, 84 + VIS * 26 + 14, 12, '#8a7e88', 'right');
    for (let i = top; i < Math.min(n, top + VIS); i++) {
      const y = 84 + (i - top) * 26, on = sel === i;
      if (tapRow) zone(x + 12, y, w - 24, 26, tapRow(i));
      if (on) { ctx.fillStyle = active ? 'rgba(255,211,106,0.14)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 12, y, w - 24, 24); }
      drawRow(i, y, on && active);
    }
  }
  // 낀 장비 + 가방 아이템
  const allItems = prof => [...SLOTS.filter(s => prof.equip[s]).map(s => ({ item: prof.equip[s], slot: s })), ...prof.bag.filter(Boolean).map(item => ({ item }))];
  function itemRow(ctx, r, y, on, right) {
    ctx.imageSmoothingEnabled = false;
    Gfx.icon(ctx, r.item, 52, y + 12, 20);
    T_(ctx, Items.nameOf(r.item), 70, y + 18, 14, on ? '#ffd36a' : RARITY[r.item.rarity].color);
    T_(ctx, (r.slot ? '낀 것 · ' : '') + right, 454, y + 18, 12, '#9a8e96', 'right');
  }
  const statLine = item => { const t = Items.total(item); return Object.keys(t).map(k => STATS[k].name + ' ' + t[k] + (STATS[k].pct ? '%' : '')).join(' · '); };

  // ── 대장장이: 주문서 바르기 · 강화 옮기기(특수기 버튼) ──
  // 옮길 곳 후보: 같은 부위의 다른 장비(낀 것 + 가방)
  const moveTargets = (rows, src) => rows.filter(r => r.item !== src && r.item.slot === src.slot);
  // '#rrggbb' + 투명도 → rgba 글
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)) + ')'; };
  // 강화 연출(2026-10-24 사용자): 시도 중(망치질 · 빛이 모임 · 막대가 참) → 성공(금빛 폭발) / 실패(잿빛 연기 · 흔들림).
  // 결과는 주문서를 바를 때 이미 정해지고(저장도 바로), 연출 동안은 입력을 잠근다. 프레임 단위(60fps)
  const FORGE_TRY = 90, FORGE_LOCK = 36, FORGE_AUTO = 170;  // 시도 1.5초 · 결과 0.6초 뒤부터 닫기 가능 · 2.8초면 저절로 닫힘
  const smith = {
    zone: 'item', sel: 0, pick: 0, anim: null,
    open() { this.zone = 'item'; this.sel = 0; this.pick = 0; this.anim = null; },
    update(o, prof) {
      if (this.anim) {
        const a = this.anim;
        a.t++;
        if (a.t === 1) Sfx.forgeStart();
        if (a.t < FORGE_TRY && a.t % 18 === 0) Sfx.forgeTap(a.t / 18);
        if (a.t === FORGE_TRY) { if (a.ok) Sfx.forgeOk(); else Sfx.forgeFail(); }
        const r = a.t - FORGE_TRY;
        if ((r >= FORGE_LOCK && (Input.wasPressed('ok') || Input.wasPressed('back'))) || r >= FORGE_AUTO) { this.anim = null; Input.clear(); }
        return;
      }
      const rows = allItems(prof), list = Items.scrollStacks(prof);
      if (this.zone === 'move') { this.updateMove(prof, rows); return; }
      if (this.zone === 'item') {
        if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
        if (!rows.length) return;
        this.sel = menuNav(Math.min(this.sel, rows.length - 1), rows.length);
        if (Input.wasPressed('special')) {
          // 강화된 장비(+N)에서 누르면 → 받을 장비 고르기. 강화 안 된 장비에서 누르면 → 같은 부위의 강화된 장비에서 이리로 받기
          // (2026-10-24 사용자 '투구에서 투구로 안 된다': 받을 쪽을 고른 채 눌러도 되게)
          const cur = rows[this.sel].item;
          if (!(prof.scrolls['inherit:0'] > 0)) { Game.toast('계승 주문서가 있어야 옮길 수 있어요 — 상점 ' + INHERIT_PRICE + 'G · 던전에서 가끔'); return; }
          if (cur.ups) {
            if (!moveTargets(rows, cur).length) { Game.toast('옮길 ' + SLOT_NAMES[cur.slot] + '이 없어요 — 같은 부위 장비가 가방에 있어야 해요'); return; }
            this.moveSrc = cur; this.zone = 'move'; this.pick = 0;
            return;
          }
          const srcs = rows.filter(r => r.item !== cur && r.item.slot === cur.slot && r.item.ups).sort((a, b) => b.item.ups - a.item.ups);
          if (!srcs.length) { Game.toast('옮겨 올 강화가 없어요 — 같은 부위에 강화된(+N) ' + SLOT_NAMES[cur.slot] + '이 있어야 해요'); return; }
          this.moveSrc = srcs[0].item; this.zone = 'move';
          this.pick = Math.max(0, moveTargets(rows, this.moveSrc).findIndex(r => r.item === cur));  // 받을 장비 = 지금 고른 것
          Game.toast(Items.nameOf(this.moveSrc) + '의 강화를 옮겨요 — 받을 장비 확인 ' + L('ok'));
          return;
        }
        if (Input.wasPressed('ok') || Input.nav('right')) {
          if (!list.length) Game.toast('주문서가 없어요 — 던전에서 몹 · 상자 · 보스가 떨어뜨려요');
          else { this.zone = 'scroll'; this.pick = 0; }
        }
        return;
      }
      if (Input.wasPressed('back') || Input.nav('left') || !list.length) { this.zone = 'item'; return; }
      this.pick = menuNav(Math.min(this.pick, list.length - 1), list.length);
      if (!Input.wasPressed('ok')) return;
      const it = rows[this.sel].item, s = list[this.pick];
      const why = Items.canEnchant(it, s);
      if (why) { Game.toast(why); return; }
      Items.takeScroll(prof, s);
      const stat = SCROLL_GROUPS[scrollGroupOf(it.slot)].stat, had = (it.ench || {})[stat] || 0;
      const before = it.ups || 0, res = Items.enchant(it, s);
      // 연출용 불꽃 · 연기 조각(미리 정해 둔다)
      const parts = [];
      for (let i = 0; i < 40; i++) parts.push({ a: Math.random() * Math.PI * 2, v: 0.5 + Math.random(), r: 1 + Math.random() * 2.5, d: Math.random() });
      this.anim = { t: 0, it, s, ok: res === 'ok', before, gain: res === 'ok' ? STATS[stat].name + ' +' + (it.ench[stat] - had) : '', parts };  // 실제로 오른 양(장비 레벨 곡선 반영)
      Game.changed();
    },
    updateMove(prof, rows) {
      const src = this.moveSrc && rows.some(r => r.item === this.moveSrc) ? this.moveSrc : null;
      const tg = src ? moveTargets(rows, src) : [];
      if (Input.wasPressed('back') || Input.nav('left') || !tg.length) { this.zone = 'item'; return; }
      this.pick = menuNav(Math.min(this.pick, tg.length - 1), tg.length);
      if (!Input.wasPressed('ok')) return;
      const to = tg[this.pick].item, inh = { g: 'inherit', r: 0 };
      const why = Items.canTransfer(src, to);
      if (why) { Game.toast(why); return; }
      if (!Items.takeScroll(prof, inh)) { Game.toast('계승 주문서가 없어요'); return; }
      const n = src.ups;
      Items.transfer(src, to);
      Sfx.forgeOk();
      Game.toast('+' + n + ' 강화를 ' + to.name + '(으)로 옮겼어요 (계승 주문서 -1)');
      // 옛 장비에 보석이 있으면 빼서 주머니로 넣을지 묻는다(2026-10-24 사용자)
      if ((src.gems || []).some(Boolean)) Game.overlay({ type: 'confirm', defaultYes: true, text: '옛 장비 ' + src.name + '에 낀 보석도 뺄까요?',
        sub: '뺀 보석은 주머니로 돌아가요: ' + src.gems.filter(Boolean).map(stoneName).join(' · '),
        yes: () => { src.gems.forEach((g, i) => { if (g) { Elements.add(prof, g); src.gems[i] = null; } }); Game.toast('보석을 주머니로 뺐어요'); Game.changed(); } });
      this.zone = 'item';
      this.sel = Math.max(0, allItems(prof).findIndex(r => r.item === to));
      Game.changed();
    },
    // 강화 연출 그리기(대장장이 창 위에 덮어서)
    drawForge(ctx) {
      const a = this.anim, cx = 480, cy = 236, col = scrollColor(a.s), t = a.t;
      zone(0, 0, 960, 540, { now: true });  // 아무 데나 누르면 닫기(잠긴 동안은 안 닫힘)
      ctx.save();
      // 시도 중에는 뒤 목록(이미 바뀐 +N)이 안 보이게 거의 가린다
      ctx.fillStyle = t < FORGE_TRY ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, 960, 540);
      const oldName = (a.before ? '+' + a.before + ' ' : '') + a.it.name;
      if (t < FORGE_TRY) {
        // ── 시도 중: 빛이 모이고, 망치질마다 번쩍 + 불똥, 장비가 떨린다 ──
        const k = t / FORGE_TRY, hit = (t % 18) / 18, flash = hit < 0.25 ? 1 - hit / 0.25 : 0;
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70 + 50 * k);
        glow.addColorStop(0, 'rgba(255,240,200,' + (0.25 + 0.35 * k + 0.3 * flash) + ')');
        glow.addColorStop(0.5, hexA(col, 0.18 + 0.25 * k));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(cx - 140, cy - 140, 280, 280);
        // 안쪽으로 빨려 드는 빛 알갱이
        a.parts.forEach(q => {
          const ph = (q.d + t / 50 * q.v) % 1, rr = 120 * (1 - ph);
          ctx.fillStyle = hexA(col, 0.9 * ph);
          ctx.fillRect(Math.round(cx + Math.cos(q.a) * rr), Math.round(cy + Math.sin(q.a) * rr * 0.8), 2 + q.r * ph, 2 + q.r * ph);
        });
        // 망치질 불똥
        if (flash > 0) a.parts.slice(0, 12).forEach(q => {
          const rr = 30 + 40 * (1 - flash);
          ctx.fillStyle = 'rgba(255,220,140,' + flash + ')';
          ctx.fillRect(Math.round(cx + Math.cos(q.a + t) * rr), Math.round(cy - 10 + Math.sin(q.a + t) * rr * 0.6), 3, 3);
        });
        ctx.globalCompositeOperation = 'source-over';
        const sh = (Math.random() - 0.5) * (2 + 4 * k) * (flash + 0.3);
        ctx.imageSmoothingEnabled = false;
        Gfx.icon(ctx, a.it, cx + sh, cy + sh * 0.5, 96);
        T_(ctx, '강화 중' + '.'.repeat(1 + Math.floor(t / 15) % 3), cx, 352, 24, '#f0e0b8', 'center');
        T_(ctx, scrollName(a.s) + ' · ' + oldName, cx, 380, 14, '#9a8e96', 'center');
        ctx.fillStyle = '#1a1216'; ctx.fillRect(cx - 120, 398, 240, 10);
        ctx.fillStyle = col; ctx.fillRect(cx - 120, 398, Math.round(240 * k), 10);
        ctx.strokeStyle = '#4a3a44'; ctx.lineWidth = 1; ctx.strokeRect(cx - 119.5, 398.5, 239, 9);
      } else if (a.ok) {
        // ── 성공: 금빛 햇살 · 터지는 불꽃 · 장비가 커졌다 돌아온다 ──
        const r = t - FORGE_TRY, e = Math.min(1, r / 24);
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(cx, cy);
        ctx.rotate(r * 0.01);
        for (let i = 0; i < 12; i++) {
          ctx.rotate(Math.PI / 6);
          ctx.fillStyle = 'rgba(255,211,106,' + (0.16 * (1 - Math.min(1, r / 160)) + 0.05) + ')';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -220); ctx.lineTo(14, -220); ctx.closePath(); ctx.fill();
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130);
        g.addColorStop(0, 'rgba(255,245,200,' + (0.9 - 0.5 * e) + ')'); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - 140, cy - 140, 280, 280);
        a.parts.forEach(q => {
          const rr = 20 + 220 * q.v * (1 - Math.pow(1 - Math.min(1, r / 60), 2)), al = Math.max(0, 1 - r / (70 + 60 * q.d));
          ctx.fillStyle = q.d < 0.5 ? 'rgba(255,211,106,' + al + ')' : hexA(col, al);
          ctx.fillRect(Math.round(cx + Math.cos(q.a) * rr), Math.round(cy + Math.sin(q.a) * rr * 0.8 + r * r * 0.004), 2 + q.r, 2 + q.r);
        });
        ctx.globalCompositeOperation = 'source-over';
        const sc = 96 * (1 + 0.25 * Math.max(0, 1 - r / 20));
        ctx.imageSmoothingEnabled = false;
        Gfx.icon(ctx, a.it, cx, cy, sc);
        T_(ctx, '강화 성공!', cx, 360, 34 + Math.round(6 * Math.max(0, 1 - r / 12)), '#ffd36a', 'center');
        T_(ctx, Items.nameOf(a.it) + '  (+' + a.before + ' → +' + a.it.ups + ')', cx, 392, 16, RARITY[a.it.rarity].color, 'center');
        T_(ctx, a.gain, cx, 416, 14, '#7dff8a', 'center');
      } else {
        // ── 실패: 잿빛 연기 · 흔들림 · 금 간 빛 ──
        const r = t - FORGE_TRY, shake = Math.max(0, 1 - r / 24) * 8;
        const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
        a.parts.forEach(q => {
          const rr = 10 + 90 * q.v * Math.min(1, r / 50), al = Math.max(0, 0.5 - r / (140 + 80 * q.d));
          ctx.fillStyle = 'rgba(110,100,110,' + al + ')';
          const sz = 6 + q.r * 5 * Math.min(1, r / 30);
          ctx.beginPath(); ctx.arc(cx + Math.cos(q.a) * rr, cy + Math.sin(q.a) * rr * 0.6 - r * 0.4 * q.v, sz, 0, Math.PI * 2); ctx.fill();
        });
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.75;
        Gfx.icon(ctx, a.it, cx + sx, cy + sy, 96);
        ctx.globalAlpha = 1;
        // 금 간 빛(잠깐)
        if (r < 30) {
          ctx.strokeStyle = 'rgba(255,90,70,' + (1 - r / 30) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx - 30 + sx, cy - 34); ctx.lineTo(cx - 6 + sx, cy - 4); ctx.lineTo(cx - 14 + sx, cy + 6); ctx.lineTo(cx + 18 + sx, cy + 36); ctx.stroke();
        }
        T_(ctx, '강화 실패', cx + sx, 360, 32, '#ff7a6a', 'center');
        T_(ctx, '주문서만 사라졌어요 · ' + oldName + ' 그대로', cx, 392, 15, '#9a8e96', 'center');
      }
      if (t - FORGE_TRY >= FORGE_LOCK) T_(ctx, '닫기 ' + L('ok') + ' / ' + L('back'), cx, 470, 13, '#8a7e88', 'center');
      ctx.restore();
    },
    draw(ctx, o, prof) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
      const rows = allItems(prof), list = Items.scrollStacks(prof), cur = rows[Math.min(this.sel, rows.length - 1)];
      Gfx.panel(ctx, 24, 24, 450, 470);
      T_(ctx, '대장장이', 44, 64, 24, '#f0e0b8');
      if (this.anim) { this.drawMain(ctx, prof, rows, list, cur); this.drawForge(ctx); return; }
      this.drawMain(ctx, prof, rows, list, cur);
    },
    drawMain(ctx, prof, rows, list, cur) {
      if (this.zone === 'move' && this.moveSrc) { this.drawMove(ctx, prof, rows, this.moveSrc); return; }
      T_(ctx, '최대 +' + ENCHANT_MAX + ' · 실패하면 주문서만 사라져요', 454, 64, 12, '#9a8e96', 'right');
      if (!rows.length) T_(ctx, '장비가 없어요', 44, 110, 15, '#6a6068');
      listView(ctx, 24, 450, rows.length, this.sel, this.zone === 'item', (i, y, on) => {
        const it = rows[i].item;
        itemRow(ctx, rows[i], y, on, '+' + (it.ups || 0) + ' / ' + ENCHANT_MAX);
      }, i => ({ on: () => this.zone === 'item' && this.sel === i, pick: () => { this.zone = 'item'; this.sel = i; } }));
      if (cur) {
        const it = cur.item;
        T_(ctx, statLine(it), 44, 462, 13, '#c8b8a0');
        T_(ctx, '강화 +' + (it.ups || 0) + ' / ' + ENCHANT_MAX + (it.ups ? ' · ' + Object.keys(it.ench || {}).map(k => STATS[k].name + ' +' + it.ench[k]).join(' · ') : ''), 44, 482, 13, '#9a8e96');
      }
      // 오른쪽: 주문서 주머니(고른 장비에 바를 수 있는 것만 밝게)
      Gfx.panel(ctx, 488, 24, 448, 470);
      T_(ctx, '주문서 주머니', 508, 64, 20, '#f0e0b8');
      if (!list.length) T_(ctx, '주문서가 없어요 — 던전에서 몹 · 상자 · 보스가 떨어뜨려요', 508, 100, 13, '#6a6068');
      const picking = this.zone === 'scroll';
      listView(ctx, 488, 448, list.length, this.pick, picking, (i, y, on) => {
        const s = list[i], ok = cur && !Items.canEnchant(cur.item, s);
        Gfx.scrollIcon(ctx, s, 526, y + 12, 20);
        T_(ctx, scrollName(s), 546, y + 18, 14, on ? '#ffd36a' : ok ? scrollColor(s) : '#5a5058');
        if (cur && s.g === 'any') T_(ctx, scrollGain(s, cur.item.slot, cur.item.ilvl), 862, y + 18, 12, ok ? '#9a8e96' : '#5a5058', 'right');  // 고른 장비에 오르는 것
        T_(ctx, '×' + s.n, 912, y + 18, 14, ok ? '#e8e0d0' : '#5a5058', 'right');
      }, i => ({ on: () => this.zone === 'scroll' && this.pick === i, pick: () => { this.zone = 'scroll'; this.pick = i; } }));
      const s = picking && list[this.pick];
      if (s) {
        T_(ctx, scrollText(s, cur && cur.item.slot, cur && cur.item.ilvl, cur && cur.item.ups), 508, 462, 12, '#c8b8a0');
        const why = cur && Items.canEnchant(cur.item, s);
        T_(ctx, why || '바르기 ' + L('ok'), 508, 482, 13, why ? '#ff8a6a' : '#7dff8a');
      }
      hintBar(ctx, this.zone === 'item' ? '장비 고르기 ↑↓ · 주문서로 ' + L('ok') + ' · 강화 옮기기 ' + L('special') + ' · 닫기 ' + L('back') : '주문서 고르기 ↑↓ · 바르기 ' + L('ok') + ' · 돌아가기 ' + L('back'));
    },
    // 강화 옮기기 화면: 왼쪽 = 옮길 강화(옛 장비), 오른쪽 = 같은 부위 새 장비 고르기
    drawMove(ctx, prof, rows, src) {
      T_(ctx, '강화 옮기기', 454, 64, 14, '#ffd36a', 'right');
      ctx.imageSmoothingEnabled = false;
      Gfx.icon(ctx, src, 110, 180, 64);
      T_(ctx, Items.nameOf(src), 180, 160, 18, RARITY[src.rarity].color);
      T_(ctx, '옮길 강화: +' + src.ups, 180, 188, 15, '#ffd36a');
      T_(ctx, Object.keys(src.ench || {}).map(k => STATS[k].name + ' +' + src.ench[k]).join(' · '), 180, 212, 14, '#c8b8a0');
      const lines = ['· 같은 부위 장비로만 옮겨요', '· 계승 주문서 1장을 써요', '· 새 장비에 강화가 있으면 더해져요 (+' + ENCHANT_MAX + '까지)', '· 옛 장비는 강화가 빠져요'];
      lines.forEach((t, i) => T_(ctx, t, 44, 290 + i * 26, 14, '#9a8e96'));
      T_(ctx, '계승 주문서 ' + (prof.scrolls['inherit:0'] || 0) + '장', 44, 474, 18, scrollColor({ g: 'inherit' }));
      const tg = moveTargets(rows, src);
      Gfx.panel(ctx, 488, 24, 448, 470);
      T_(ctx, '옮길 곳 (' + SLOT_NAMES[src.slot] + ')', 508, 64, 20, '#f0e0b8');
      listView(ctx, 488, 448, tg.length, this.pick, true, (i, y, on) => {
        const to = tg[i].item, ok = !Items.canTransfer(src, to);
        ctx.imageSmoothingEnabled = false;
        Gfx.icon(ctx, to, 516, y + 12, 20);
        T_(ctx, Items.nameOf(to), 534, y + 18, 14, on ? '#ffd36a' : ok ? RARITY[to.rarity].color : '#5a5058');
        T_(ctx, (tg[i].slot ? '낀 것 · ' : '') + '+' + (to.ups || 0), 918, y + 18, 12, ok ? '#9a8e96' : '#5a5058', 'right');
      }, i => ({ on: () => this.pick === i, pick: () => { this.pick = i; } }));
      const t = tg[Math.min(this.pick, tg.length - 1)];
      if (t) {
        const to = t.item, why = Items.canTransfer(src, to);
        T_(ctx, '옮기면: ' + to.name + ' +' + (to.ups || 0) + ' → +' + ((to.ups || 0) + src.ups), 508, 462, 12, '#c8b8a0');
        T_(ctx, why || '옮기기 ' + L('ok') + ' (계승 주문서 1장)', 508, 482, 13, why ? '#ff8a6a' : '#7dff8a');
      }
      hintBar(ctx, '새 장비 고르기 ↑↓ · 옮기기 ' + L('ok') + ' · 돌아가기 ' + L('back'));
    },
  };

  // ── 고르기 창(세공사 · 마을 메뉴): o = { title, items: [{ label, go }] } ──
  const choice = {
    sel: 0,
    update(o) {
      if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
      this.sel = menuNav(this.sel, o.items.length);
      if (Input.wasPressed('ok')) { const it = o.items[this.sel]; Game.closeOverlay(); it.go(); }
    },
    draw(ctx, o) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 960, 540);
      const h = 96 + o.items.length * 40, top = 270 - h / 2;
      Gfx.panel(ctx, 320, top, 320, h, { border: '#ffd36a' });
      T_(ctx, o.title, 480, top + 42, 22, '#f0e0b8', 'center');
      o.items.forEach((it, i) => zone(320, top + 86 + i * 40 - 28, 320, 40, { pick: () => { this.sel = i; }, now: true }));
      o.items.forEach((it, i) => centerItem(ctx, it.label, 480, top + 86 + i * 40, 18, i === this.sel ? '#ffd36a' : '#e8e0d0', i === this.sel));
      T_(ctx, '고르기 ' + L('ok') + ' · 닫기 ' + L('back'), 480, top + h - 14, 12, '#8a7e88', 'center');
    },
  };

  // ── 상점 아이템 사고팔기(2026-10-24 사용자: 장비 / 아이템으로 나눔) ──
  // 왼쪽 = 사는 물건(물약 · 조각 속성석 · 보석 · 계승 주문서), 오른쪽 = 내가 가진 속성석 · 보석. 파는 건 조각(1단계)만, 하나에 SHARD_SELL
  const shopItems = {
    zone: 'buy', buy: 0, mine: 0,
    open() { this.zone = 'buy'; this.buy = 0; this.mine = 0; },
    mineList(prof) { return Elements.stacks(prof, [...EL_ORDER, ...GEM_ORDER]); },
    update(o, prof) {
      if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
      const goods = SHOP_GOODS(), mine = this.mineList(prof);
      if (Input.nav('left') || Input.nav('right')) { this.zone = this.zone === 'buy' ? 'mine' : 'buy'; return; }
      if (this.zone === 'buy') this.buy = menuNav(this.buy, goods.length);
      else if (mine.length) this.mine = menuNav(Math.min(this.mine, mine.length - 1), mine.length);
      if (!Input.wasPressed('ok')) return;
      if (this.zone === 'buy') { buyGood(prof, goods[this.buy]); return; }
      const st = mine[Math.min(this.mine, mine.length - 1)];
      if (!st) return;
      if (st.size > 0) { Game.toast('속성석 · 보석은 조각(1단계)만 팔 수 있어요 — 큰 것은 세공사에서 써 주세요'); return; }
      Elements.take(prof, st);
      prof.gold += SHARD_SELL;
      Sfx.gold();
      Game.toast(stoneName(st) + ' 판매 +' + SHARD_SELL + 'G · 남은 개수 ' + (prof.stones[Elements.key(st)] || 0));
      Game.changed();
    },
    draw(ctx, o, prof) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
      const goods = SHOP_GOODS(), mine = this.mineList(prof);
      ctx.imageSmoothingEnabled = false;
      // 왼쪽: 사기
      Gfx.panel(ctx, 24, 24, 440, 470, { border: this.zone === 'buy' ? '#ffd36a' : undefined });
      T_(ctx, '사기', 44, 62, 22, '#f0e0b8');
      T_(ctx, '골드 ' + prof.gold + 'G', 444, 62, 16, '#ffd34d', 'right');
      goods.forEach((g, i) => {
        const y = 78 + i * 44, on = this.zone === 'buy' && this.buy === i;
        zone(40, y, 408, 40, { on: () => this.zone === 'buy' && this.buy === i, pick: () => { this.zone = 'buy'; this.buy = i; } });
        Gfx.panel(ctx, 40, y, 408, 40, { border: on ? '#ffd36a' : '#3a2e36', bg: '#1d151b' });
        if (g.potion) Gfx.spr(ctx, 'flask_big_red', 64, y + 35, { scale: 1.8 });
        else if (g.scroll) Gfx.scrollIcon(ctx, g.scroll, 64, y + 21, 24);
        else Gfx.stoneIcon(ctx, g, 64, y + 20, 26);
        const have = g.potion ? prof.potions + '/' + clsOf(prof).potion.max : g.scroll ? (prof.scrolls[scrollKey(g.scroll)] || 0) + '장' : (prof.stones[Elements.key(g)] || 0) + '개';
        T_(ctx, goodName(g), 88, y + 27, 15, on ? '#ffd36a' : g.potion ? '#f0e0b8' : g.scroll ? scrollColor(g.scroll) : ELEMENTS[g.el].color);
        T_(ctx, goodPrice(g) + 'G · 가진 것 ' + have, 436, y + 27, 12, '#9a8e96', 'right');
      });
      // 오른쪽: 내 속성석 · 보석(팔기)
      Gfx.panel(ctx, 488, 24, 448, 470, { border: this.zone === 'mine' ? '#ffd36a' : undefined });
      T_(ctx, '내 속성석 · 보석', 508, 62, 20, '#f0e0b8');
      T_(ctx, '조각(1단계)만 팔기 ' + SHARD_SELL + 'G', 916, 62, 12, '#9a8e96', 'right');
      if (!mine.length) T_(ctx, '가진 속성석 · 보석이 없어요', 508, 100, 13, '#6a6068');
      const sel = Math.min(this.mine, Math.max(0, mine.length - 1));
      listView(ctx, 488, 448, mine.length, sel, this.zone === 'mine', (i, y, on) => {
        const r = mine[i], can = r.size === 0;
        Gfx.stoneIcon(ctx, r, 526, y + 11, 20);
        T_(ctx, stoneName(r), 546, y + 18, 14, on ? '#ffd36a' : can ? ELEMENTS[r.el].color : '#8a7e88');
        T_(ctx, can ? '판매 ' + SHARD_SELL + 'G' : '못 팖', 860, y + 18, 11, can ? '#9a8e96' : '#5a5058', 'right');
        T_(ctx, '×' + r.n, 912, y + 18, 14, '#e8e0d0', 'right');
      }, i => ({ on: () => this.zone === 'mine' && this.mine === i, pick: () => { this.zone = 'mine'; this.mine = i; } }));
      // 아래 설명
      const g = goods[this.buy], st = mine[sel];
      if (this.zone === 'buy' && g) T_(ctx, g.potion ? '최대 체력의 40%를 바로 회복' : g.scroll ? '강화(+N)를 같은 부위 새 장비로 옮길 때 1장' : GEMS[g.el] ? gemText(g) + ' (' + GEMS[g.el].where + ')' : '세공사에서 3개를 합치면 한 단계 커져요', 44, 476, 12, '#c8b8a0');
      if (this.zone === 'mine' && st) T_(ctx, st.size === 0 ? '조각 하나 판매 +' + SHARD_SELL + 'G' : '1단계(조각)만 팔 수 있어요', 508, 476, 12, st.size === 0 ? '#c8b8a0' : '#ff8a6a');
      hintBar(ctx, '사기 ↔ 내 것 ←→ · 고르기 ↑↓ · ' + (this.zone === 'buy' ? '사기 ' : '팔기 ') + L('ok') + ' · 닫기 ' + L('back'));
    },
  };

  // ── 창고: 유니크 컬렉션(2026-10-24 사용자) ──
  // 줄 = 부위 갈래 8개(무기 경량 · 무기 중량 · 투구 · 갑옷 · 장갑 · 신발 · 목걸이 · 반지), 칸 = 재질 단계(착용 레벨 없음 · 10 … 90).
  // 가방의 유니크를 맞는 칸에 넣고, 갈래마다 달성률을 보여 준다. 넣은 유니크는 창고에 보관(꺼내면 가방으로, 칸은 다시 빈다).
  const VAULT_COLS = GEAR_TIERS.length;
  function vaultFind(prof, key) {  // 가방에서 그 칸에 맞는 유니크(강화 안 된 것 먼저)
    let best = -1;
    prof.bag.forEach((it, i) => { if (it && it.uniq && vaultKey(it) === key && (best < 0 || (prof.bag[best].ups && !it.ups))) best = i; });
    return best;
  }
  const vaultCats = prof => VAULT_CATS.filter(c => !c.cls || c.cls === clsOf(prof).id);  // 무기 줄은 이 캐릭터 직업 것만
  const vaultCount = (prof, cat) => { let n = 0; for (let c = 0; c < VAULT_COLS; c++) if (prof.vault[cat + ':' + c]) n++; return n; };
  const lvName = c => (c ? 'Lv.' + c * 10 : '착용 레벨 없음');
  function vaultPutAll(prof) {
    let n = 0;
    for (const cat of vaultCats(prof)) for (let c = 0; c < VAULT_COLS; c++) {
      const key = cat.id + ':' + c;
      if (prof.vault[key]) continue;
      const i = vaultFind(prof, key);
      if (i >= 0) { prof.vault[key] = prof.bag[i]; prof.bag[i] = null; n++; }
    }
    Game.toast(n ? '유니크 ' + n + '개를 창고에 넣었어요' : '가방에 새로 넣을 유니크가 없어요');
    if (n) Game.changed();
  }
  const vault = {
    r: 0, c: 0,
    open() { this.r = 0; this.c = 0; },
    update(o, prof) {
      if (Input.wasPressed('back') || Input.wasPressed('inv')) { Game.closeOverlay(); return; }
      const R = vaultCats(prof).length;
      if (Input.nav('up')) this.r = (this.r + R - 1) % R;
      if (Input.nav('down')) this.r = (this.r + 1) % R;
      if (Input.nav('left')) this.c = (this.c + VAULT_COLS - 1) % VAULT_COLS;
      if (Input.nav('right')) this.c = (this.c + 1) % VAULT_COLS;
      if (Input.wasPressed('special')) { vaultPutAll(prof); return; }
      if (!Input.wasPressed('ok')) return;
      const cat = vaultCats(prof)[this.r], key = cat.id + ':' + this.c, have = prof.vault[key];
      if (have) {
        if (prof.bag.indexOf(null) < 0) { Game.toast('가방이 가득 찼어요'); return; }
        Game.overlay({ type: 'confirm', text: Items.nameOf(have) + '을(를) 가방으로 꺼낼까요?', sub: '꺼내면 컬렉션 칸이 다시 비어요',
          yes: () => {
            const e = prof.bag.indexOf(null);
            if (e < 0 || prof.vault[key] !== have) return;
            prof.bag[e] = have; delete prof.vault[key];
            Game.toast(have.name + ' 꺼냄'); Game.changed();
          } });
        return;
      }
      const i = vaultFind(prof, key);
      if (i < 0) { Game.toast('가방에 ' + lvName(this.c) + ' ' + cat.name + ' 유니크가 없어요'); return; }
      prof.vault[key] = prof.bag[i]; prof.bag[i] = null;
      Game.toast(prof.vault[key].name + ' 창고에 넣음 · ' + cat.name + ' ' + vaultCount(prof, cat.id) + '/' + VAULT_COLS);
      Game.changed();
    },
    draw(ctx, o, prof) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
      Gfx.panel(ctx, 24, 24, 912, 470);
      const total = vaultCats(prof).reduce((a, cat) => a + vaultCount(prof, cat.id), 0), all = vaultCats(prof).length * VAULT_COLS;
      T_(ctx, '창고 — 유니크 컬렉션', 44, 62, 24, '#f0e0b8');
      T_(ctx, '전체 달성 ' + total + '/' + all + ' (' + Math.floor(total / all * 100) + '%)', 916, 62, 18, '#ffd34d', 'right');
      const X0 = 214, CS = 32, STEP = 40, Y0 = 104, RH = 36;
      // 칸 머리: 착용 레벨
      for (let c = 0; c < VAULT_COLS; c++) T_(ctx, c ? 'Lv' + c * 10 : '없음', X0 + c * STEP + CS / 2, 94, 11, this.c === c ? '#ffd36a' : '#9a8e96', 'center');
      T_(ctx, '부위 달성률', 724, 94, 11, '#9a8e96', 'center');
      ctx.imageSmoothingEnabled = false;
      vaultCats(prof).forEach((cat, r) => {
        const y = Y0 + r * RH, n = vaultCount(prof, cat.id);
        T_(ctx, cat.name, 44, y + 22, 15, this.r === r ? '#ffd36a' : '#f0e0b8');  // 유니크 이름 · 효과는 아래 설명 칸에만(2026-10-24 사용자)
        for (let c = 0; c < VAULT_COLS; c++) {
          const x = X0 + c * STEP, it = prof.vault[cat.id + ':' + c], on = this.r === r && this.c === c;
          zone(x - 4, y - 2, STEP, RH, { on: () => this.r === r && this.c === c, pick: () => { this.r = r; this.c = c; } });
          if (it) { cell(ctx, x, y, CS, it, on); continue; }
          const can = vaultFind(prof, cat.id + ':' + c) >= 0;  // 가방에 넣을 수 있는 것이 있다
          ctx.fillStyle = 'rgba(24,18,22,0.95)'; ctx.fillRect(x, y, CS, CS);
          ctx.strokeStyle = can ? '#7dff8a' : '#2e242a'; ctx.lineWidth = can ? 2 : 1; ctx.strokeRect(x + 1, y + 1, CS - 2, CS - 2);
          T_(ctx, can ? '+' : '·', x + CS / 2, y + CS / 2 + 6, can ? 18 : 14, can ? '#7dff8a' : '#3a3036', 'center');
          if (on) { ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3; ctx.strokeRect(x - 2, y - 2, CS + 4, CS + 4); }
        }
        // 갈래 달성률: 막대 + 개수
        const bx = 626, bw = 196, full = n === VAULT_COLS;
        ctx.fillStyle = '#1a1216'; ctx.fillRect(bx, y + 11, bw, 10);
        ctx.fillStyle = full ? '#ffd34d' : RARITY[3].color; ctx.fillRect(bx, y + 11, Math.round(bw * n / VAULT_COLS), 10);
        ctx.strokeStyle = '#4a3a44'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y + 11.5, bw - 1, 9);
        T_(ctx, n + '/' + VAULT_COLS, 860, y + 21, 13, full ? '#ffd34d' : '#e8e0d0', 'right');
        T_(ctx, Math.floor(n / VAULT_COLS * 100) + '%', 916, y + 21, 13, full ? '#ffd34d' : '#c8b8a0', 'right');
      });
      // 아래: 고른 칸 설명
      ctx.fillStyle = '#3a2e36'; ctx.fillRect(40, 404, 880, 1);
      const cat = vaultCats(prof)[this.r], U = UNIQUES[cat.uniq], key = cat.id + ':' + this.c, have = prof.vault[key];
      const lvTxt = lvName(this.c) + ' (' + GEAR_TIERS[this.c].mat + ')';
      T_(ctx, (have ? Items.nameOf(have) : U.name) + ' — ' + cat.name + ' · ' + lvTxt, 44, 430, 16, have ? RARITY[3].color : '#c8b8a0');
      T_(ctx, '★ ' + U.fx + ': ' + U.desc, 44, 454, 13, '#ffd36a');
      const where = DUNGEONS.filter(d => tierOf(d.ilvl[1]) === this.c).map(d => d.name).join(' · ');
      const can = !have && vaultFind(prof, key) >= 0;
      T_(ctx, have ? '보관 중 — ' + L('ok') + ' = 가방으로 꺼내기' : can ? '가방에 있어요 — ' + L('ok') + ' = 창고에 넣기' : '아직 없어요 — ' + (where || '?') + '의 보스 · 고유 몹에서 떨어져요',
        44, 478, 13, have ? '#9a8e96' : can ? '#7dff8a' : '#8a7e88');
      hintBar(ctx, '넣기 · 꺼내기 ' + L('ok') + ' · 가방 유니크 모두 넣기 ' + L('special') + ' · 닫기 ' + L('back'));
    },
  };

  // ── 일시정지 · 확인 ──
  const pause = {
    sel: 0,
    items: ['계속하기', '장비 스테이터스', '속성석 · 보석 관리', '설정 · 조작', '마을로 돌아가기'],
    update() {
      if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
      this.sel = menuNav(this.sel, this.items.length);
      if (!Input.wasPressed('ok')) return;
      if (this.sel === 0) Game.closeOverlay();
      if (this.sel === 1) Game.overlay({ type: 'inv', mode: 'equip' });
      if (this.sel === 2) Game.overlay({ type: 'manage' });
      if (this.sel === 3) Game.overlay({ type: 'settings' });
      if (this.sel === 4) Game.overlay({ type: 'confirm', text: '던전을 나갈까요? 지금까지 얻은 것은 가져가요.', yes: () => Game.quitRun() });
    },
    draw(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 960, 540);
      Gfx.panel(ctx, 330, 120, 300, 300);
      T_(ctx, '일시정지', 480, 166, 24, '#f0e0b8', 'center');
      this.items.forEach((s, i) => zone(330, 208 + i * 34 - 24, 300, 34, { pick: () => { this.sel = i; }, now: true }));
      this.items.forEach((s, i) => centerItem(ctx, s, 480, 208 + i * 34, 18, i === this.sel ? '#ffd36a' : '#e8e0d0', i === this.sel));
    },
  };

  // ── 설정 · 조작 (봉인의 숲과 같은 틀: 조작 방식 · 패드 종류 · 마우스 조준) ──
  const settings = {
    sel: 0,
    rows() {
      const S = Input.settings;
      return [
        { label: '패드 종류', val: S.padLayout === 'switch' ? '스위치 (오른쪽 A)' : '엑스박스 (아래 A)', flip: () => { S.padLayout = S.padLayout === 'switch' ? 'xbox' : 'switch'; } },
        { label: '효과음', val: S.sound !== false ? '켜기' : '끄기', flip: () => { S.sound = S.sound === false; } },
      ];
    },
    update() {
      if (Input.wasPressed('back') || Input.wasPressed('pause')) { Input.saveSettings(); Game.closeOverlay(); return; }
      const rows = this.rows();
      this.sel = menuNav(this.sel, rows.length);
      if (Input.nav('left') || Input.nav('right') || Input.wasPressed('ok')) { rows[this.sel].flip(); Input.saveSettings(); }
    },
    draw(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, 960, 540);
      Gfx.panel(ctx, 60, 30, 840, 480);
      T_(ctx, '설정 · 조작', 90, 72, 24, '#f0e0b8');
      this.rows().forEach((r, i) => {
        const y = 118 + i * 40, on = i === this.sel;
        zone(84, y - 26, 792, 36, { pick: () => { this.sel = i; }, now: true });
        if (on) { ctx.fillStyle = 'rgba(255,211,106,0.12)'; ctx.fillRect(84, y - 26, 792, 36); }
        T_(ctx, r.label, 100, y, 17, r.dim ? '#5a5058' : on ? '#ffd36a' : '#e8e0d0');
        T_(ctx, '◀  ' + r.val + '  ▶', 560, y, 17, r.dim ? '#5a5058' : on ? '#ffd36a' : '#c8b8a0', 'center');
      });
      // 조작표: 지금 키보드 방식 + 패드
      const K = a => Input.labelFor('kb', a), P = a => Input.labelFor('pad', a), CC = clsOf(Game.prof);  // 직업마다 기술 이름
      const rows = [['이동', K('move'), P('move') + ' · 십자키'], ['공격 (연타 ' + CC.combo.length + '타)', K('attack'), P('attack')],
        [CC.charge.def.name + ' (누르면 바로, 기력 ' + CC.charge.cost + ')', K('charge'), P('charge')],
        ['대시 (무적, 기력 ' + CC.dodge.cost + ')', K('dodge'), P('dodge')], [CC.dashAttack.name, K('dodge') + ' → ' + K('attack'), P('dodge') + ' → ' + P('attack')],
        ['특수기 · ' + CC.special.name + ' (기력 ' + CC.special.cost + ')', K('special'), P('special')],
        ['물약', K('potion'), P('potion')], ['가방', K('inv'), P('inv')], ['메뉴', K('pause'), P('pause')],
        ['메뉴 선택 · 취소', K('ok') + ' · ' + K('back'), P('ok') + ' · ' + P('back')]];
      const y0 = 290;
      T_(ctx, '키보드', 560, y0 - 22, 14, '#9a8e96', 'center');
      T_(ctx, '패드', 790, y0 - 22, 14, '#9a8e96', 'center');
      rows.forEach(([k, a, b], i) => {
        const y = y0 + i * 20;
        T_(ctx, k, 100, y, 14, '#d8ccb0');
        T_(ctx, a, 560, y, 14, '#ffd36a', 'center');
        T_(ctx, b, 790, y, 14, '#8ad8ff', 'center');
      });
      T_(ctx, '바꾸기 ◀ ▶ / ' + L('ok') + ' · 닫기 ' + L('back'), 480, 500, 13, '#8a7e88', 'center');
    },
  };
  // 확인 창: 연달아 누르다 잘못 고르지 않게 — 처음엔 '아니요'에 있고, 열린 뒤 LOCK 프레임(약 0.4초) 동안은 누름을 받지 않는다
  const CONFIRM_LOCK = 24;
  const confirm = {
    sel: 1,
    update(o) {
      o.frames = (o.frames || 0) + 1;
      if (o.frames <= CONFIRM_LOCK) return;
      if (Input.nav('left') || Input.nav('right') || Input.nav('up') || Input.nav('down')) this.sel = 1 - this.sel;
      if (Input.wasPressed('back')) { Game.closeOverlay(); return; }
      if (Input.wasPressed('ok')) { Game.closeOverlay(); if (this.sel === 0) o.yes(); }
    },
    draw(ctx, o) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 960, 540);
      Gfx.panel(ctx, 210, 190, 540, 160, { border: o.danger ? '#ff8a6a' : '#ffd36a' });
      T_(ctx, o.text, 480, o.sub ? 232 : 240, 17, '#f0e0b8', 'center');
      if (o.sub) T_(ctx, o.sub, 480, 260, 13, '#9a8e96', 'center');
      const locked = (o.frames || 0) <= CONFIRM_LOCK;  // 잠긴 동안은 흐리게
      ['예', '아니요'].forEach((s, i) => {
        const on = i === this.sel;
        zone(400 + i * 160 - 75, 282, 150, 44, { pick: () => { this.sel = i; }, now: true });
        centerItem(ctx, s, 400 + i * 160, 310, 20, locked ? '#5a5058' : on ? (i === 0 && o.danger ? '#ff8a6a' : '#ffd36a') : '#e8e0d0', on);
      });
    },
  };

  // ── 결과 ──
  const result = {
    update() { if (Input.wasPressed('ok') || Input.wasPressed('back')) Game.open('town'); },
    draw(ctx, res, prof, time) {
      backdrop(ctx, time);
      zone(0, 0, 960, 540, { now: true });  // 아무 데나 누르면 마을로
      const { run, kind } = res;
      const title = kind === 'clear' ? '던전 클리어!' : kind === 'dead' ? '쓰러졌다…' : '던전을 나왔다';
      T_(ctx, title, 480, 90, 40, kind === 'clear' ? '#ffd36a' : kind === 'dead' ? '#d84a4a' : '#c8b8a0', 'center');
      T_(ctx, run.dungeon.name + (run.diff ? ' · ' + DIFFS[run.diff].name : ''), 480, 122, 16, run.diff ? DIFFS[run.diff].color : '#9a8e96', 'center');
      Gfx.panel(ctx, 180, 150, 600, 320);
      const rows = [['처치', run.kills + '마리'], ['경험치', '+' + run.exp + (run.levelUps ? '  (레벨 업 ' + run.levelUps + '번!)' : '')],
        ['골드', '+' + run.gold + 'G' + (run.lostGold ? '  (쓰러져서 -' + run.lostGold + 'G)' : '')],
        ['시간', run.clearTime !== undefined ? fmtTime(run.clearTime) + (run.newRecord ? '  ★ 새 기록!' + (run.bestPrev ? ' (예전 ' + fmtTime(run.bestPrev) + ')' : '') : '  (최고 ' + fmtTime(run.bestPrev) + ')') : '보스를 못 쓰러뜨림 — 기록 없음'],
        ['주운 장비', run.items.length + '개' + (run.stones ? '  · 속성석 · 보석 ' + run.stones + '개' : '') + (run.scrolls ? '  · 주문서 ' + run.scrolls + '개' : '') + (run.autoSold ? '  · 자동 판매 ' + run.autoSold + '개' : '')]];
      rows.forEach(([k, v], i) => { T_(ctx, k, 220, 190 + i * 30, 17, '#9a8e96'); T_(ctx, v, 360, 190 + i * 30, 17, k === '시간' && run.newRecord ? '#ffd36a' : '#f0e8dc'); });
      run.items.slice(0, 8).forEach((it, i) => T_(ctx, it.name, 220 + (i % 2) * 280, 352 + Math.floor(i / 2) * 26, 15, RARITY[it.rarity].color));
      if (run.items.length > 8) T_(ctx, '외 ' + (run.items.length - 8) + '개', 740, 452, 13, '#8a7e88', 'right');
      T_(ctx, '마을로 ' + L('ok'), 480, 510, 15, '#c8b8a0', 'center');
    },
  };

  // 폰 메뉴 화면의 특수기(Z) 버튼 이름: 그 창에서 Z 가 하는 일(없으면 버튼을 숨긴다)
  function touchSpecial() {
    const o = Game.overlays[Game.overlays.length - 1];
    if (!o) return null;
    if (o.type === 'vault') return '모두 넣기';
    if (o.type === 'smith' && smith.zone === 'item' && !smith.anim) return '강화 옮기기';
    return null;
  }

  return { shopItems, title, choice, select, inv, stones, gems, manage, smith, vault, pause, settings, confirm, result, tap, tapLayer, resolveTap, touchSpecial };
})();
