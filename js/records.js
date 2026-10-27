// 레이드 기록 · 칭호(2026-10-27 사용자) — 마을 메뉴 '기록 · 칭호'(overlay 'records').
// 기록: prof.raidRec[단계] = { clears, tries, solo: { time, hits }, party: { time, hits } } — time = 파수꾼이 깨어난 뒤 쓰러뜨리기까지(초) 가장 빠른 것,
//   hits = 처치한 판에서 맞은 횟수 가장 적은 것(시간 · 맞은 횟수는 따로 — 다른 판일 수 있음). 혼자 · 파티 따로. 서버가 없어 내 캐릭터(저장 칸 3개)끼리만 견준다.
// 칭호: data.js RAID_TITLES(한 번 얻으면 prof.titles 에 남음) + 도감 칭호(collectTitles — 꺼내면 빠짐). 하나 골라 달면(prof.title) 이름 위에 보인다(꾸미기만).
// 세기: world.js raidBegin(도전) · bossCleared(처치) · noteHit(맞음, combat.js).
const Records = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  const VIS = 10;  // 칭호 목록에 한 번에 보이는 줄
  let sel = 0, top = 0, others = [];

  function rec(prof, stage = 1) {
    const all = prof.raidRec || (prof.raidRec = {});
    if (!all[stage]) {  // 기록을 만들기 전에 깬 횟수는 이어받음(시간 · 맞은 횟수는 몰라서 비움)
      const old = stage === 1 ? (prof.endless && prof.endless.raid) || 0 : 0;
      all[stage] = { clears: old, tries: old, solo: null, party: null };
    }
    return all[stage];
  }
  const earned = prof => prof.titles || (prof.titles = {});
  // 얻을 수 있게 된 칭호를 prof.titles 에 넣고 새로 얻은 이름들을 돌려준다
  function check(prof) {
    const got = earned(prof), fresh = [];
    for (const t of RAID_TITLES) {
      if (got[t.id]) continue;
      const ok = t.all ? RAID_TITLES.every(o => o === t || o.stage !== t.stage || got[o.id]) : t.ok(rec(prof, t.stage));
      if (ok) { got[t.id] = true; fresh.push(t.name); }
    }
    return fresh;  // all 칭호는 단계 맨 끝에 두어 같은 번에 얻은 것까지 센다
  }
  function tried(prof, stage) { rec(prof, stage).tries++; }
  // 처치: 기록 고치기 → 새 칭호. 결과 화면용으로 { solo, time, hits, newTime, prevTime, newHits, prevHits, titles } 를 돌려준다
  function cleared(prof, stage, time, hits, solo) {
    const r = rec(prof, stage);
    r.clears++; r.tries = Math.max(r.tries, r.clears);
    const k = solo ? 'solo' : 'party', b = r[k] || (r[k] = {});
    const out = { solo, time, hits, prevTime: b.time, prevHits: b.hits, newTime: b.time === undefined || time < b.time, newHits: b.hits === undefined || hits < b.hits };
    if (out.newTime) b.time = time;
    if (out.newHits) b.hits = hits;
    out.titles = check(prof);
    if (out.titles.length) { Sfx.unique(); Game.toast('칭호 획득! ★ ' + out.titles.join(' · ')); }
    return out;
  }

  // 칭호 목록: 레이드 칭호 + 도감 칭호(내 직업 줄 · 전설의 수집가)
  function list(prof) {
    const got = earned(prof), col = collectTitles(prof);
    const raid = RAID_TITLES.map(t => ({ id: t.id, name: t.name, cond: t.cond, have: !!got[t.id], kind: '레이드' }));
    const cats = vaultCatsOf(prof).map(c => ({ id: 'col:' + c.name + ' 수집가', name: c.name + ' 수집가', cond: '창고 ' + c.name + ' 줄 10칸 모두 넣기 (꺼내면 빠짐)' }));
    cats.push({ id: 'col:전설의 수집가', name: '전설의 수집가', cond: '창고 80칸 모두 넣기 (꺼내면 빠짐)' });
    return raid.concat(cats.map(c => Object.assign(c, { have: col.includes(c.name), kind: '도감' })));
  }
  // 달고 있는 칭호 이름(없거나 도감 칭호가 빠졌으면 '')
  function titleOf(prof) {
    const id = prof && prof.title;
    if (!id) return '';
    if (id.startsWith('col:')) { const nm = id.slice(4); return collectTitles(prof).includes(nm) ? nm : ''; }
    const t = RAID_TITLES.find(x => x.id === id);
    return t && earned(prof)[id] ? t.name : '';
  }

  // ── 기록 · 칭호 창 ──
  function open(prof) {
    sel = 0; top = 0;
    if (check(prof).length) Game.changed();  // 예전에 깬 횟수로 이미 얻은 칭호(기록 전 처치 · 10번 등)
    // 내 캐릭터끼리: 지금 캐릭터는 지금 기록, 다른 칸은 저장된 것
    others = [];
    for (let n = 0; n < Save.SLOTS_N; n++) others.push(n === Save.slot ? null : Save.load(n));
    const rows = list(prof), cur = rows.findIndex(r => r.id === prof.title);
    if (cur >= 0) sel = cur + 1;
  }
  function update(o, prof) {
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
    const rows = list(prof), n = rows.length + 1;  // 0 = 칭호 달지 않기
    if (Input.nav('up')) sel = (sel + n - 1) % n;
    if (Input.nav('down')) sel = (sel + 1) % n;
    if (!Input.wasPressed('ok')) return;
    if (sel === 0) { if (prof.title) { delete prof.title; Game.toast('칭호를 뗐어요'); Game.changed(); } return; }
    const r = rows[sel - 1];
    if (!r.have) { Sfx.deny(); Game.toast('아직 못 얻은 칭호예요 — ' + r.cond); return; }
    if (prof.title === r.id) { Game.toast('이미 달고 있어요'); return; }
    prof.title = r.id;
    Sfx.chest(); Game.toast('칭호를 달았어요: ★ ' + r.name);
    Game.changed();
  }
  const tm = b => (b && b.time !== undefined ? fmtTime(b.time) : '—');
  const hitTxt = b => (b && b.hits !== undefined ? (b.hits ? b.hits + '번' : '0번 (무피격)') : '—');
  function draw(ctx, o, prof) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    Gfx.panel(ctx, 30, 24, 900, 470, { border: '#5fe0d0', bg: '#140f18' });
    T_(ctx, '기록 · 칭호', 54, 62, 24, '#f0e0b8');
    T_(ctx, '서버가 없어 내 캐릭터끼리만 견줘요', 906, 62, 12, '#8a7e88', 'right');
    // 왼쪽: 레이드 기록
    const st = ABYSS_STAGES[0], r = rec(prof, st.stage);
    T_(ctx, '심연의 파수꾼 — ' + st.name, 54, 100, 16, '#5fe0d0');
    T_(ctx, '처치 ' + r.clears + '번 / 도전 ' + r.tries + '번', 54, 126, 14, '#e8dcc0');
    const head = (y, s) => T_(ctx, s, 54, y, 13, '#c8a0ff');
    const line = (y, k, v) => { T_(ctx, k, 70, y, 13, '#9a8e96'); T_(ctx, v, 430, y, 13, '#f0e8dc', 'right'); };
    head(158, '혼자'); line(180, '가장 빠른 처치', tm(r.solo)); line(200, '가장 적게 맞은 처치', hitTxt(r.solo));
    head(230, '파티'); line(252, '가장 빠른 처치', tm(r.party)); line(272, '가장 적게 맞은 처치', hitTxt(r.party));
    T_(ctx, '시간은 파수꾼이 깨어난 뒤부터 재요', 54, 296, 11, '#6a6068');
    // 내 캐릭터끼리
    T_(ctx, '내 캐릭터끼리', 54, 330, 15, '#ffd36a');
    T_(ctx, '처치', 300, 330, 11, '#8a7e88', 'right'); T_(ctx, '혼자 최고', 430, 330, 11, '#8a7e88', 'right');
    for (let n = 0; n < Save.SLOTS_N; n++) {
      const pr = n === Save.slot ? prof : others[n], y = 356 + n * 26, me = n === Save.slot;
      if (!pr) { T_(ctx, (n + 1) + '. 빈 칸', 70, y, 13, '#5a5058'); continue; }
      const rr = pr.raidRec && pr.raidRec[st.stage], clears = rr ? rr.clears : (pr.endless && pr.endless.raid) || 0;
      T_(ctx, (n + 1) + '. ' + clsOf(pr).name + ' Lv.' + pr.lv + (me ? ' (지금)' : ''), 70, y, 13, me ? '#ffd36a' : '#e8dcc0');
      T_(ctx, clears + '번', 300, y, 13, '#f0e8dc', 'right');
      T_(ctx, tm(rr && rr.solo), 430, y, 13, '#f0e8dc', 'right');
    }
    // 오른쪽: 칭호 목록(0 = 달지 않기)
    const rows = list(prof), n = rows.length + 1, x0 = 466, w = 440, h = 36;
    sel = Math.min(sel, n - 1);
    if (sel < top) top = sel;
    if (sel >= top + VIS) top = sel - VIS + 1;
    T_(ctx, '칭호', x0, 100, 16, '#ffd36a');
    T_(ctx, '얻은 것 ' + rows.filter(x => x.have).length + ' / ' + rows.length + ' · 꾸미기만(능력치 없음)', x0 + w, 100, 11, '#8a7e88', 'right');
    for (let i = top; i < Math.min(n, top + VIS); i++) {
      const y = 112 + (i - top) * (h + 2), on = sel === i, t = i ? rows[i - 1] : null, wear = t ? prof.title === t.id && t.have : !titleOf(prof);
      UI.zone(x0, y, w, h, { on: () => sel === i, pick: () => { sel = i; } });
      Gfx.panel(ctx, x0, y, w, h, { border: on ? '#ffd36a' : wear ? '#5fe0d0' : '#3a2e3a', bg: '#100c12' });
      if (!t) { T_(ctx, '칭호 달지 않기', x0 + 14, y + 23, 14, on ? '#ffd36a' : '#c8b8a0'); }
      else {
        T_(ctx, (t.have ? '★ ' : '') + t.name, x0 + 14, y + 16, 14, !t.have ? '#6a6068' : on ? '#ffd36a' : '#f0e0b8');
        T_(ctx, t.kind + ' · ' + t.cond, x0 + 14, y + 31, 10, t.have ? '#9a8e96' : '#5a5058');
      }
      if (wear) T_(ctx, '달고 있음', x0 + w - 12, y + 23, 12, '#5fe0d0', 'right');
    }
    if (top > 0) T_(ctx, '▲', x0 + w / 2, 110, 11, '#8a7e88', 'center');
    if (top + VIS < n) T_(ctx, '▼', x0 + w / 2, 112 + VIS * (h + 2) + 6, 11, '#8a7e88', 'center');
    if (Input.touchMode()) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 500, 960, 40);
    T_(ctx, '고르기 ↑↓ · 칭호 달기 ' + L('ok') + ' · 닫기 ' + L('back'), 480, 524, 13, '#8a7e88', 'center');
  }
  return { rec, tried, cleared, check, list, titleOf, open, update, draw };
})();
