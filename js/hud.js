// 던전 화면 HUD(디아블로식): 아래 돌판 — 왼쪽 빨간 체력 구슬 · 오른쪽 파란 기력 구슬 · 물약 벨트 · 가운데 기술(속성석) 칸 · 맨 아래 경험치.
// 위 — 가운데 대상 이름표(보스 · 고유 · 정예), 오른쪽 자동 지도. 모두 960x540 좌표.
const Hud = (() => {
  const T_ = Gfx.text;
  // 가운데 알림 줄 나누기: 한 줄(size)에 안 들어가면 22px 로 줄이고 ' — ' 에서 먼저, 그다음 띄어쓰기에서 — 줄 길이가 고르게(한 단어만 남는 줄 없게)
  function wrapMsg(ctx, s, size, maxW) {
    ctx.font = 'bold ' + size + 'px ' + Gfx.FONT;
    if (ctx.measureText(s).width <= maxW) return [s];
    ctx.font = 'bold 22px ' + Gfx.FONT;
    const out = [];
    for (const part of s.split(' — ').map((t, i, a) => (i < a.length - 1 ? t + ' —' : t))) {
      // 줄 수는 maxW 로 나눌 때와 같게 두고, 그 줄 수에 들어가는 가장 좁은 폭으로 다시 나눈다
      const words = part.split(' ');
      const greedy = L => { const ls = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (line && ctx.measureText(t).width > L) { ls.push(line); line = w; } else line = t; } if (line) ls.push(line); return ls; };
      const n = greedy(maxW).length;
      let L = ctx.measureText(part).width / n;
      while (L < maxW && greedy(L).length > n) L += 8;
      out.push(...greedy(Math.min(L, maxW)));
    }
    return out;
  }
  const L = a => Input.label(a);
  const PY = 540 - HUD_H * SCALE;  // 돌판 윗선

  // 구슬: k = 차 있는 정도(0~1)
  function globe(ctx, cx, cy, r, k, col, dark, label) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#120c10'; ctx.fill();
    ctx.strokeStyle = '#6a5440'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = dark; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const top = cy + r - 2 * r * Math.max(0, Math.min(1, k));
    const g = ctx.createLinearGradient(0, top, 0, cy + r);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.fillRect(cx - r, top, r * 2, cy + r - top);
    // 출렁이는 윗면 · 유리 반짝임
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx - r, top, r * 2, 2);
    const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 2, cx - r * 0.35, cy - r * 0.45, r * 0.9);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    if (label) T_(ctx, label, cx, cy + 6, 14, '#ffffff', 'center');
  }

  // 레벨 메달(2026-10-25 사용자: 체력 구슬 · 경험치 막대 근처에 예쁘게) — 구슬 오른쪽 아래 테두리에 붙은 금테 메달, 경험치 막대가 여기서 시작.
  // 안쪽 보랏빛 + 위 반짝임, 'LV' 작게 · 숫자 크게. 만렙이면 테두리 빛 · 숫자 금빛
  function lvBadge(ctx, cx, cy, lv) {
    const max = lv >= lvMax(Game.prof), r = 19;
    ctx.save();
    if (max) { ctx.shadowColor = 'rgba(255,210,100,0.8)'; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fillStyle = '#120c10'; ctx.fill();
    ctx.shadowBlur = 0;
    const ring = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    ring.addColorStop(0, '#ffe7a0'); ring.addColorStop(0.5, '#d8a040'); ring.addColorStop(1, '#7a4a18');
    ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
    const core = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy, r - 2);
    core.addColorStop(0, '#4a2a5a'); core.addColorStop(1, '#170c1c');
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.fillStyle = core; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
    // 위 · 아래 작은 보석 장식
    for (const dy of [-(r + 1), r + 1]) {
      ctx.fillStyle = '#ff5a8a'; ctx.beginPath(); ctx.moveTo(cx, cy + dy - 3); ctx.lineTo(cx + 3, cy + dy); ctx.lineTo(cx, cy + dy + 3); ctx.lineTo(cx - 3, cy + dy); ctx.fill();
    }
    ctx.restore();
    T_(ctx, 'LV', cx, cy - 4, 8, '#c8a8e0', 'center');
    T_(ctx, String(lv), cx, cy + 11, lv >= 100 ? 13 : 16, max ? '#ffd36a' : '#ffffff', 'center');
  }

  // 기술 아이콘(2026-10-24 사용자 '게임과 어울리게'): 선 그림 대신 16x16 도트를 계산으로 찍고 검은 테두리를 둘러 2배로 그린다.
  // 칸 모양 = (x, y) → 0 없음 · 1 본색 · 2 밝은색 · 3 어두운색 · 4 흰색. dash 화살 + 속도선, spin 도는 고리 + 화살촉, wave 초승달, circle 마법진, orb 빛 구슬 + 꼬리
  // 달리는 사람(13x11, 봉인의 숲 DASH_RUNNER): '+' 머리 · 윗몸(밝게), '#' 몸, '-' 속도선. 16x16 칸의 (1, 2)부터
  const DASH_RUNNER = [
    '........++...',
    '........++...',
    '.......++....',
    '-----++++++..',
    '.....#.##..#.',
    '-------##....',
    '......###....',
    '----.##.##...',
    '....##...##..',
    '...##.....#..',
    '..##......##.',
  ];
  const DASH_PAL = { '+': 2, '#': 1, '-': 1 };
  // 글자 그림 아이콘(16x16): 1 기술 색 · 2 밝게 · 3 어둡게 · 4 흰색
  const STR_PAL = { 1: 1, 2: 2, 3: 3, 4: 4 };
  const KATAR_PIX = [
    '................',
    '.......2........',
    '.......21.......',
    '......221.......',
    '......2211......',
    '......2211......',
    '......2211......',
    '......2211......',
    '......2211......',
    '......2211......',
    '....33333333....',
    '....3......3....',
    '....3.1111.3....',
    '....3......3....',
    '....3......3....',
    '................',
  ];
  const TALK_PIX = [
    '................',
    '...1111111111...',
    '..122222222221..',
    '.12222222222221.',
    '.12222222222221.',
    '.12233233233221.',
    '.12233233233221.',
    '.12222222222221.',
    '..122222222221..',
    '...1111221111...',
    '.....1221.......',
    '....121.........',
    '...11...........',
    '................',
    '................',
    '................',
  ];
  const RUSH_PIX = [
    '................',
    '.............44.',
    '............421.',
    '...........221..',
    '..........221...',
    '.........221....',
    '..3.....221.....',
    '.33....221......',
    '......221.......',
    '.3333221........',
    '.....33.........',
    '....3..3........',
    '.333....3.......',
    '..........3.....',
    '.3333...........',
    '................',
  ];
  const SHADOW_PIX = [
    '................',
    '.....1111.......',
    '....111111......',
    '...11333311.....',
    '..1133333311....',
    '..1334334331....',
    '..1133333311..4.',
    '...11333311..42.',
    '..1111111111421.',
    '.111111111142111',
    '.11111111142111.',
    '.1111111142111..',
    '.111111142111...',
    '.11111142111....',
    '......42........',
    '................',
  ];
  const PIX = {
    // 검사 기본 공격: 오른쪽 위를 겨눈 도트 칼(2026-10-25 사용자 고름 — 예전 칼질 초승달은 잎사귀 같고 검기와 헷갈림).
    // 칼날은 끝으로 갈수록 가늘고 위쪽 날이 밝다, 끝 가까이 흰 반짝, 날밑 밝게, 손잡이 어둡게, 끝 구슬
    slash: (x, y) => {
      const px = x + 0.5, py = y + 0.5;
      const seg = (x0, y0, x1, y1) => {
        const vx = x1 - x0, vy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy)));
        return [Math.hypot(px - x0 - vx * t, py - y0 - vy * t), t];
      };
      const [db, tb] = seg(6.2, 9.8, 14.2, 1.8);
      if (db < 1.3 * (1 - tb * 0.5) && tb > 0) {
        if (Math.hypot(px - 12.2, py - 3.8) < 0.8) return 4;
        return px + py < 15.9 ? 2 : 1;
      }
      if (seg(3.7, 8.3, 7.7, 12.3)[0] < 0.75) return 2;
      if (seg(2.7, 13.3, 5, 11)[0] < 0.7) return 3;
      if (Math.hypot(px - 2, py - 14) < 1.1) return 2;
      return 0;
    },
    // 마법사 기본 공격: 빛나는 별 + 휘두른 자리 빛 구슬
    spark: (x, y) => {
      const dx = x + 0.5 - 10.5, dy = y + 0.5 - 5.5;
      if ((Math.abs(dx) <= 0.6 && Math.abs(dy) <= 4.6) || (Math.abs(dy) <= 0.6 && Math.abs(dx) <= 4.6)) return 2;
      if (Math.abs(dx) + Math.abs(dy) <= 2.2) return 2;
      for (const [cx, cy, r] of [[6.5, 9.5, 1.6], [4, 12, 1.3], [2, 14, 1]]) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) return 1;
      return 0;
    },
    // 대시: 봉인의 숲 질주 버튼처럼 오른쪽으로 달리는 사람 + 뒤 속도선(2026-10-25 사용자: 예전 화살 + 속도선은 달리는 느낌이 안 남)
    dash: (x, y) => DASH_RUNNER[y - 2] ? DASH_PAL[DASH_RUNNER[y - 2][x - 1]] || 0 : 0,
    spin: (x, y) => {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const hx = 8 + Math.cos(-0.35) * 5.4, hy = 8 + Math.sin(-0.35) * 5.4;
      if (Math.hypot(x + 0.5 - hx, y + 0.5 - hy - 1) <= 2.3) return 2;  // 화살촉
      if (d >= 4.2 && d <= 6.6 && !(a > -1.5 && a < -0.35)) return dy < 0 ? 2 : 1;
      return 0;
    },
    wave: (x, y) => {
      const o = Math.hypot(x + 0.5 - 3, y + 0.5 - 8), i = Math.hypot(x + 0.5 - 0.5, y + 0.5 - 8);
      return o <= 9.6 && i > 9 && x >= 4 ? (x >= 10 ? 2 : 1) : 0;
    },
    circle: (x, y) => {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 9, e = Math.hypot(dx / 7.4, dy / 4.4);
      if (e >= 0.72 && e <= 1.0) return dy < 0 ? 2 : 1;
      if (Math.abs(dx) + Math.abs(dy) * 1.8 <= 1.6) return 2;  // 가운데 빛
      if ((Math.abs(dx) <= 0.6 && Math.abs(Math.abs(dy) - 2.2) <= 0.6) || (Math.abs(dy) <= 0.6 && Math.abs(Math.abs(dx) - 3.6) <= 0.6)) return 1;  // 룬 점
      return 0;
    },
    // 암살자 기본 공격: 카타르(넓적한 세모 날 + H 손잡이) / 그림자 숨기: 눈만 빛나는 두건 쓴 그림자 + 앞으로 긋는 흰 날
    katar: (x, y) => KATAR_PIX[y] ? STR_PAL[KATAR_PIX[y][x]] || 0 : 0,
    shadow: (x, y) => SHADOW_PIX[y] ? STR_PAL[SHADOW_PIX[y][x]] || 0 : 0,
    // 말 걸기(폰 마을 화면의 기본 버튼, touch.js): 점 세 개 든 말풍선
    talk: (x, y) => TALK_PIX[y] ? STR_PAL[TALK_PIX[y][x]] || 0 : 0,
    // 돌진 베기(암살자): 오른쪽 위로 긋는 칼날 + 뒤로 남는 속도선
    rush: (x, y) => RUSH_PIX[y] ? STR_PAL[RUSH_PIX[y][x]] || 0 : 0,
    orb: (x, y) => {
      const d = Math.hypot(x + 0.5 - 10.5, y + 0.5 - 8);
      if (d <= 1.9) return 2;
      if (d <= 3.8) return 1;
      if (x >= 1 && x <= 7 && Math.abs(y + 0.5 - 8) <= (x - 1) * 0.32 + 0.4) return 1;
      return 0;
    },
  };
  const pixCache = {};
  function mixW(hex, k) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; return 'rgb(' + c.map(v => Math.round(v + (255 - v) * k)).join(',') + ')'; }
  function mixB(hex, k) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; return 'rgb(' + c.map(v => Math.round(v * (1 - k))).join(',') + ')'; }
  function pixIcon(kind, col) {
    const key = kind + col;
    if (pixCache[key]) return pixCache[key];
    const f = PIX[kind], c = document.createElement('canvas');
    c.width = c.height = 18;
    const g = c.getContext('2d'), at = (x, y) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : f(x, y));
    const pal = { 1: col, 2: mixW(col, 0.4), 3: mixB(col, 0.35), 4: '#ffffff' };  // 3 어두운색 · 4 흰 반짝
    for (let y = -1; y <= 16; y++) for (let x = -1; x <= 16; x++) {
      const v = at(x, y);
      if (v) { g.fillStyle = pal[v]; g.fillRect(x + 1, y + 1, 1, 1); continue; }
      let edge = false;  // 둘레 8칸에 무늬가 있으면 검은 테두리
      for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j)) { edge = true; break; }
      if (edge) { g.fillStyle = '#120c10'; g.fillRect(x + 1, y + 1, 1, 1); }
    }
    pixCache[key] = c;
    return c;
  }
  function skillIcon(ctx, kind, cx, cy, col) {
    if (!PIX[kind]) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixIcon(kind, col), Math.round(cx - 18), Math.round(cy - 18), 36, 36);
    ctx.restore();
  }

  function box(ctx, x, y, s, on) {
    ctx.fillStyle = '#1a1216'; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = on || '#4a3a30'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }

  // 쿨타임(2026-10-25 사용자: 쿨타임인 줄 몰라 안 나가는 걸 조건으로 착각): 칸이 어두워졌다가 12시부터 시계 방향으로 밝아진다. k = 남은 비율, 1초 넘게 남으면 초도
  function cool(ctx, x, y, s, k, sec) {
    if (k <= 0) return;
    const cx = x + s / 2, cy = y + s / 2, a0 = -Math.PI / 2 + (1 - k) * Math.PI * 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 2, y + 2, s - 4, s - 4); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, s, a0, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (sec >= 1) T_(ctx, sec.toFixed(1), cx, cy + 5, 12, '#ffffff', 'center');
  }

  // 보석 합계: 묶음마다 이름 · 칸(낀 보석 색 네모, 빈 칸은 테두리만) · 합친 효과(장비 레벨 곡선 반영 = 가방 창과 같은 값)
  // 보석 묶음 = 끼울 수 있는 보석 종류대로(2026-10-24 사용자: 무기 · 장신구는 공격 보석이라 한 줄)
  const GEM_GROUPS = [{ name: '무기 · 장신구', slots: ['weapon', 'amulet', 'ring'] }, { name: '방어구', slots: ['helmet', 'armor', 'gloves', 'boots'] }];
  const GEM_MAIN = ['dmg', 'crit', 'def', 'hp'];
  const GEM_SHORT = { dmg: '피해', crit: '치명', critDmg: '치피', def: '방어', hp: '체력', stamina: '기력' };
  function gemSummary(ctx, prof, x, y, p) {
    GEM_GROUPS.forEach((gr, i) => {
      const yy = y + i * 12, sum = {}, gems = [];
      for (const slot of gr.slots) {
        const it = prof.equip[slot];
        if (!it) continue;
        for (const g of it.gems || []) {
          gems.push(g);
          if (!g) continue;
          const gs = gemStats(g);
          for (const k in gs) sum[k] = (sum[k] || 0) + (k === 'def' || k === 'hp' ? Math.round(gs[k] * POWER(it.ilvl)) : gs[k]);
        }
      }
      T_(ctx, gr.name, x, yy, 10, '#c8b8a0');
      gems.forEach((g, j) => {
        const qx = x + 66 + j * 8, qy = yy - 7;
        if (g) { ctx.fillStyle = ELEMENTS[g.el].color; ctx.fillRect(qx, qy, 6, 6); }
        else { ctx.strokeStyle = '#6a5a64'; ctx.lineWidth = 1; ctx.strokeRect(qx + 0.5, qy + 0.5, 5, 5); }
      });
      const keys = Object.keys(sum);
      const join = ks => ks.map(k => GEM_SHORT[k] + '+' + sum[k] + (STATS[k].pct ? '%' : '')).join(' ');
      let txt = !gems.length ? '보석 칸 없음' : !keys.length ? '비어 있음' : join(keys);
      // 길면 글자를 조금 줄이고, 그래도 넘치면 핵심 수치(피해 · 치명 · 방어 · 체력)만 — 전부는 가방 창에서
      const fits = (t, sz) => { ctx.font = 'bold ' + sz + 'px ' + Gfx.FONT; return ctx.measureText(t).width <= 126; };
      let size = 10;
      if (!fits(txt, 10)) { size = 9; if (!fits(txt, 9)) txt = join(keys.filter(k => GEM_MAIN.includes(k))); if (!fits(txt, 9)) size = 8; }
      T_(ctx, txt, x + 100, yy, size, keys.length ? '#e8e0d0' : '#6a6068');
    });
    // 남는 두 줄: 끼고 있는 유니크 효과(잎사귀 방패는 다시 생기기까지 남은 초)
    const sbn = Elements.setBonus(prof);  // 속성석 세트 효과도 같은 줄에
    const fx = (sbn ? ['◆' + sbn.name] : []).concat(SLOTS.map(s => prof.equip[s]).filter(it => it && it.uniq).map(it => {
      const u = UNIQUES[it.uniq];
      return u.fx + (it.uniq === 'leaf' && p && p.leafT > 0 ? ' ' + Math.ceil(p.leafT) + '초' : '');
    }));
    T_(ctx, sbn ? '★ 효과' : '★ 유니크', x, y + 24, 10, RARITY[3].color);
    if (!fx.length) { T_(ctx, '없음', x + 60, y + 24, 10, '#6a6068'); return; }
    // 한 줄(폭 160)에 들어가는 만큼 담고 나머지는 다음 줄. 둘째 줄도 넘치면 글자를 줄인다
    const W = 160;
    let size = 10, lines;
    for (; size >= 8; size--) {
      ctx.font = 'bold ' + size + 'px ' + Gfx.FONT;
      lines = [[], []];
      for (const f of fx) lines[ctx.measureText([...lines[0], f].join(' · ')).width <= W ? 0 : 1].push(f);
      if (ctx.measureText(lines[1].join(' · ')).width <= W) break;
    }
    lines.forEach((ln, i) => { if (ln.length) T_(ctx, ln.join(' · '), x + 60, y + 24 + i * 12, size, '#ffd36a'); });
  }

  // 아래 돌판: 체력 · 기력 구슬 · 물약 벨트 · 기술(속성석) 칸 · 레벨 · 골드 · 보석 합계 · 경험치. 위로 '체력' 글자까지(PANEL_Y)
  const PANEL_Y = PY - 40;
  const panelC = document.createElement('canvas');
  panelC.width = 960; panelC.height = 540;
  const pg = panelC.getContext('2d');
  let panelKey = '';
  function panel(ctx, p, prof, C) {
    // ── 아래 돌판 ──
    const g = ctx.createLinearGradient(0, PY, 0, 540);
    g.addColorStop(0, '#2a2026'); g.addColorStop(1, '#140e12');
    ctx.fillStyle = g; ctx.fillRect(0, PY, 960, 540 - PY);
    ctx.fillStyle = '#5a4436'; ctx.fillRect(0, PY, 960, 2);
    // 경험치: 판 맨 아래(글자와 안 겹치게, 2026-10-24 사용자)
    Gfx.bar(ctx, 140, PY + 79, 680, 5, prof.lv >= lvMax(prof) ? 1 : prof.exp / expToNext(prof.lv), prof.lv >= lvMax(prof) ? '#ffd36a' : '#c8a040', '#2a2010');  // 만렙이면 금빛으로 가득
    // 체력 구슬 · 특수기 구슬
    globe(ctx, 66, PY + 30, 50, p.hp / p.maxHp, ['#ff4a3a', '#7a0a0a'], '#2a0606', Math.ceil(Math.max(0, p.hp)) + '/' + p.maxHp);
    globe(ctx, 894, PY + 30, 50, p.sp / p.maxSp, ['#5a9aff', '#0a2a7a'], '#06102a', Math.floor(p.sp) + '/' + p.maxSp);
    lvBadge(ctx, 118, PY + 64, prof.lv);  // 체력 구슬 오른쪽 아래 · 경험치 막대 왼쪽 끝
    T_(ctx, '체력', 66, PY - 26, 11, '#c8a8a0', 'center');
    T_(ctx, '기력', 894, PY - 26, 11, '#a8b8d8', 'center');
    // 물약 벨트
    const by = PY + 20;
    T_(ctx, Input.touchMode() ? '물약' : '물약 ' + L('potion'), 142, by - 2, 10, '#c8b8a0');
    for (let i = 0; i < C.potion.max; i++) {
      const x = 140 + i * 38;
      box(ctx, x, by + 2, 34);
      if (i < prof.potions) Gfx.spr(ctx, 'flask_red', x + 17, by + 32, { scale: 1.8 });
    }
    // 가운데: 기술 = 속성석 칸 4개(2026-10-24 사용자: 기술 아이콘 칸은 없애고 속성석 칸이 기술 칸을 겸한다)
    // 위 = 누르는 키 + 기술 이름, 칸 = 낀 속성석(없으면 기술 모양을 흐리게), 아래 = 드는 기력(모자라면 빨강)
    const SKILL_KEYS = { basic: 'attack', charge: 'charge', wave: 'special', dash: 'dodge' };
    const costs = { basic: 0, charge: costOf(p.prof, 'charge'), wave: costOf(p.prof, 'special'), dash: dashCost(p) };  // 무기 특성으로 바뀔 수 있음
    STONE_SLOTS.forEach((slot, i) => {
      const x = 374 + i * 56, y = PY + 16, s = Elements.socket(prof, slot), col = s ? ELEMENTS[s.el].color : null;
      box(ctx, x, y, 44, col);
      // 기술 아이콘을 크게(2026-10-24 사용자), 낀 속성석은 오른쪽 아래에 작게. 속성석이 있으면 아이콘이 그 속성 색
      skillIcon(ctx, C.icons[slot], x + 22, y + 21, col || '#a89cb0');  // 기본 칸도 도트 기술 아이콘(무기 그림 대신, 2026-10-24 사용자)
      if (s) {
        ctx.fillStyle = 'rgba(10,6,8,0.75)'; ctx.beginPath(); ctx.arc(x + 34, y + 33, 9, 0, Math.PI * 2); ctx.fill();
        Gfx.stoneIcon(ctx, s, x + 34, y + 33, 16);
      }
      if (slot === 'wave' && C.special.cd) cool(ctx, x, y, 44, p.specialCd / specialCdOf(p), p.specialCd);  // 특수기 쿨타임
      if (slot === 'charge' && p.hideCd > 0) cool(ctx, x, y, 44, p.hideCd / hideCdOf(p), p.hideCd);  // 그림자 숨기 다시 쓰기까지(2026-10-31)
      T_(ctx, (Input.touchMode() ? '' : L(SKILL_KEYS[slot]) + ' ') + slotShortOf(p.prof, slot), x + 22, PY + 12, 11, col || '#c8b8a0', 'center');
      const n = costs[slot];
      T_(ctx, '기력 ' + n, x + 22, PY + 73, 10, !n ? '#6a7a90' : p.sp >= n ? '#8ab8ff' : '#ff7a6a', 'center');
    });
    // 오른쪽: 골드(윗줄, 레벨은 체력 구슬 옆 메달로 옮김) + 보석 합계 4줄(무기 · 방어구 · 목걸이 · 반지, 2026-10-24 사용자)
    Gfx.spr(ctx, 'coin_anim_f0', 612, PY + 15, { scale: 1.4 });
    T_(ctx, fmtNum(prof.gold), 622, PY + 15, 13, '#ffd34d');
    gemSummary(ctx, prof, 606, PY + 31, p);
    if (!Input.touchMode()) T_(ctx, L('pause') + ' 메뉴 · ' + L('inv') + ' 가방', 142, PY + 73, 10, '#7a6e70');
  }

  function draw(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const p = World.player, prof = World.prof, C = p.cls, lv = World.level;
    // 아래 돌판은 따로 그려 두고 값이 바뀔 때만 다시(2026-10-25 사용자: 폰에서 버벅임 — 예전엔 매 프레임 글자 수십 개를 새로 썼다)
    const legend = STONE_SLOTS.some(sl => { const st = Elements.socket(prof, sl); return st && st.size >= 4; });  // 완전한 · 전설 · 태초 돌은 빛이 돌아서 가끔 다시
    const key = [Math.ceil(Math.max(0, p.hp)), p.maxHp, Math.floor(p.sp), p.maxSp, prof.potions, prof.gold, prof.lv, Math.round(prof.exp / expToNext(prof.lv) * 680),
      Input.device, Input.settings.padLayout, dashCost(p), legend ? Math.floor(performance.now() / 100) : 0,
      SLOTS.map(sl => { const it = prof.equip[sl]; return it ? it.uid + ':' + (it.gems || []).map(gm => (gm ? gm.el + gm.size : '')).join() : ''; }).join(),
      STONE_SLOTS.map(sl => { const st = Elements.socket(prof, sl); return st ? st.el + st.size : ''; }).join()].join('|');
    if (key !== panelKey) {
      panelKey = key;
      pg.setTransform(1, 0, 0, 1, 0, 0);
      pg.clearRect(0, PANEL_Y, 960, 540 - PANEL_Y);
      pg.imageSmoothingEnabled = false;
      panel(pg, p, prof, C);
    }
    ctx.drawImage(panelC, 0, PANEL_Y, 960, 540 - PANEL_Y, 0, PANEL_Y, 960, 540 - PANEL_Y);

    // ── 위: 대상 이름표(보스 → 가까운 고유 · 정예) ──
    const es = World.enemies();
    let tgt = es.find(e => e.rank === 'boss' && e.awake && !e.dying && e.state !== 'dead');
    if (!tgt) {
      let bd = 170;
      for (const e of es) {
        if (e.rank === 'normal' || !e.awake || e.dying || e.state === 'dead') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; tgt = e; }
      }
    }
    if (tgt) {
      T_(ctx, tgt.name, 480, 26, 17, NAME_COLOR[tgt.rank], 'center');
      if (tgt.affixes && tgt.affixes.length && tgt.rank === 'unique') T_(ctx, tgt.affixes.map(a => AFFIXES[a].name).join(' · '), 480, 44, 11, '#c8b8a0', 'center');
      Gfx.bar(ctx, 330, 50, 300, 8, tgt.hp / tgt.maxHp, '#c02a2a');
      if (tgt.def.raid) Raid.hud(ctx, tgt);  // 레이드: 단계 금 · 단계 이름 · 지금 할 일 · 남은 시간
    }
    // ── 오른쪽 위: 자동 지도(가 본 곳) ──
    drawMap(ctx, lv, p);
    if (lv.def.practice) Practice.hud(ctx, prof);  // 연습장: 왼쪽 위 딜 측정판
    const c = World.comboInfo;
    if (c) { ctx.globalAlpha = Math.min(1, c.t / 0.5); T_(ctx, c.n + ' 콤보', 930, 236, 26, '#ffd36a', 'right'); ctx.globalAlpha = 1; }
    const m = World.msg;
    if (m) {  // 긴 글(레이드 공략 알림 등)은 화면 폭에 맞게 줄을 나눈다(2026-10-29 — 폰에서 잘림)
      ctx.globalAlpha = Math.min(1, m.t / 0.4);
      const lines = wrapMsg(ctx, m.s, 28, 720), fs = lines.length > 1 ? 22 : 28;
      lines.forEach((l, i) => T_(ctx, l, 480, 130 + i * (fs + 8), fs, '#f0e0b8', 'center'));
      ctx.globalAlpha = 1;
    }
  }

  // 방 하나 = 맵 하나(끝없는 심연): 던파식 방 지도 — 네모 칸 = 방, 줄 = 문. 지금 방(금빛 깜빡) · 깬 방(보라) · 안 깬 방(붉게).
  // 안 가 본 방은 가려짐(2026-10-25 사용자: 처음엔 전체 지도를 안 보이게) — 가 본 방의 문 쪽에 '?' 칸만. 수호자 방 = 처음부터 붉은 테두리 + 점,
  // 안 연 상자 = 노란 점, 계단 = 하늘색, 파티원 = 그 방에 파티 색 점(파티원이 가 본 방도 내 지도에 보임). 지도 틀은 층 전체 크기 그대로(크기로 길이 드러나지 않게)
  function drawRoomMap(ctx, lv, p) {
    const CWp = 24, CHp = 16, G = 6, gxs = lv.rooms.map(r => r.gx), gys = lv.rooms.map(r => r.gy);
    const gx0 = Math.min(...gxs), gy0 = Math.min(...gys), nx = Math.max(...gxs) - gx0 + 1, ny = Math.max(...gys) - gy0 + 1;
    const mw = nx * (CWp + G) - G, mh = ny * (CHp + G) - G, ox = 950 - mw, oy = 10, now = performance.now() / 1000;
    const pos = r => [ox + (r.gx - gx0) * (CWp + G), oy + (r.gy - gy0) * (CHp + G)];
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(ox - 5, oy - 5, mw + 10, mh + 10);
    for (const mt of World.mates) lv.visited.add(World.roomOf(mt));  // 파티원이 간 방도 열림
    const cur = World.roomOf(p), seenR = i => lv.visited.has(i);
    ctx.fillStyle = '#5a4a6a';  // 문(이음): 가 본 방에서 나가는 문만
    lv.rooms.forEach((r, i) => { if (!seenR(i)) return; for (const d of r.doors) { const [x, y] = pos(r); if (d.dir === 'r') ctx.fillRect(x + CWp, y + CHp / 2 - 1, G, 3); else if (d.dir === 'l') ctx.fillRect(x - G, y + CHp / 2 - 1, G, 3); else if (d.dir === 'd') ctx.fillRect(x + CWp / 2 - 1, y + CHp, 3, G); else ctx.fillRect(x + CWp / 2 - 1, y - G, 3, G); } });
    lv.rooms.forEach((r, i) => {
      const [x, y] = pos(r), seen = seenR(i), done = lv.cleared.has(i);
      if (!seen && r.boss) {  // 수호자 방은 안 가 봤어도 처음부터 보임(2026-10-26 사용자) — 어두운 칸 + 붉은 테두리 · 점
        ctx.fillStyle = '#2a1418'; ctx.fillRect(x, y, CWp, CHp);
        ctx.lineWidth = 1; ctx.strokeStyle = '#d83a3a'; ctx.strokeRect(x + 0.5, y + 0.5, CWp - 1, CHp - 1);
        ctx.fillStyle = '#d83a3a'; ctx.fillRect(x + CWp / 2 - 2, y + CHp / 2 - 2, 4, 4);
        return;
      }
      if (!seen) {  // 안 가 본 방: 가 본 방과 문으로 붙어 있으면 '?' 칸만, 아니면 안 그림
        if (!r.doors.some(d => seenR(d.to))) return;
        ctx.fillStyle = '#1c1424'; ctx.fillRect(x, y, CWp, CHp);
        ctx.lineWidth = 1; ctx.strokeStyle = '#3a2e46'; ctx.strokeRect(x + 0.5, y + 0.5, CWp - 1, CHp - 1);
        T_(ctx, '?', x + CWp / 2, y + CHp - 4, 11, '#5a4a6a', 'center');
        return;
      }
      ctx.fillStyle = done ? '#4a3270' : '#6a2a2a';
      ctx.fillRect(x, y, CWp, CHp);
      ctx.lineWidth = 1; ctx.strokeStyle = r.boss ? '#d83a3a' : '#8a78a0';
      ctx.strokeRect(x + 0.5, y + 0.5, CWp - 1, CHp - 1);
      if (r.boss) { ctx.fillStyle = '#d83a3a'; ctx.fillRect(x + CWp / 2 - 2, y + CHp / 2 - 2, 4, 4); }
      if (seen) for (const c of lv.chests) if (!c.open && Dungeon.roomIdx(lv, c.x, c.y) === i) { ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 3, y + 3, 3, 3); }
      if (lv.stairs && Dungeon.roomIdx(lv, lv.stairs.x, lv.stairs.y) === i) { ctx.fillStyle = '#7dd3ff'; ctx.fillRect(x + CWp - 7, y + 3, 4, 4); }
      if (i === cur && Math.sin(now * 6) > -0.4) { ctx.lineWidth = 2; ctx.strokeStyle = '#ffd36a'; ctx.strokeRect(x - 1, y - 1, CWp + 2, CHp + 2); }
    });
    World.mates.forEach((mt, k) => {  // 파티원: 그 방 아래쪽에 파티 색 점(쓰러졌으면 붉게 깜빡)
      if (mt.dead && Math.sin(now * 8) < 0) return;
      const [x, y] = pos(lv.rooms[World.roomOf(mt)]);
      ctx.fillStyle = mt.dead ? '#ff6a5a' : Coop.colorOf(mt.pid); ctx.fillRect(x + 3 + k * 5, y + CHp - 6, 4, 4);
    });
    const [px, py] = pos(lv.rooms[cur]);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(px + CWp / 2 - 2, py + CHp / 2 - 2, 4, 4);
    return oy + mh;
  }

  function drawMap(ctx, lv, p) {
    if (lv.roomMaps) return mapInfo(ctx, lv, drawRoomMap(ctx, lv, p) + 18);
    const s = Math.min(150 / lv.W, 120 / lv.H);
    const ox = 950 - lv.W * s, oy = 10;
    // 가 본 칸 그림은 따로 만들어 두고, 가 본 곳이 늘 때만 다시(2026-10-25 사용자: 폰에서 버벅임 — 예전엔 매 프레임 칸 수천 개를 칠했다)
    if (!lv.mapCanvas || lv.mapDirty) {
      const c = lv.mapCanvas || (lv.mapCanvas = document.createElement('canvas'));
      c.width = Math.ceil(lv.W * s + 8); c.height = Math.ceil(lv.H * s + 8);
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, lv.W * s + 8, lv.H * s + 8);
      g.fillStyle = 'rgba(170,150,130,0.55)';
      for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) {
        const i = y * lv.W + x;
        if (lv.explored[i] && lv.tiles[i] === 1) g.fillRect(4 + x * s, 4 + y * s, Math.ceil(s), Math.ceil(s));
      }
      lv.mapDirty = false;
    }
    ctx.drawImage(lv.mapCanvas, Math.round(ox - 4), oy - 4);
    const b = lv.boss;  // 보스 방: 안 가 봤어도 처음부터 보임(2026-10-26 사용자) — 옅은 붉은 칸 + 테두리 + 가운데 점
    if (b) {
      ctx.fillStyle = 'rgba(216,58,58,0.18)'; ctx.fillRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s);
      ctx.strokeStyle = '#d83a3a'; ctx.lineWidth = 1; ctx.strokeRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s);
      ctx.fillStyle = '#d83a3a'; ctx.fillRect(ox + (b.x + b.w / 2) * s - 2, oy + (b.y + b.h / 2) * s - 2, 4, 4);
    }
    for (const c of lv.chests) if (!c.open && lv.explored[Math.floor(c.y / T) * lv.W + Math.floor(c.x / T)]) { ctx.fillStyle = '#ffd34d'; ctx.fillRect(ox + c.x / T * s - 1.5, oy + c.y / T * s - 1.5, 3, 3); }
    if (lv.stairs) { ctx.fillStyle = '#7dd3ff'; ctx.fillRect(ox + lv.stairs.x / T * s - 2, oy + lv.stairs.y / T * s - 2, 4, 4); }
    for (const mt of World.mates) if (!mt.dead || Math.sin(performance.now() / 120) > 0) {  // 파티원: 파티 순서 색 점(쓰러졌으면 붉게 깜빡)
      ctx.fillStyle = mt.dead ? '#ff6a5a' : Coop.colorOf(mt.pid); ctx.fillRect(ox + mt.x / T * s - 2, oy + mt.y / T * s - 2, 4, 4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + p.x / T * s - 2, oy + p.y / T * s - 2, 4, 4);
    mapInfo(ctx, lv, oy + lv.H * s + 18);
  }
  // 지도 아래: 던전 이름 · 난이도(끝없는 심연은 최고 층) · 시간
  function mapInfo(ctx, lv, by) {
    const df = DIFFS[RUN.diff], run = World.run, prof = World.prof;
    T_(ctx, lv.def.name, 950, by, 12, '#9a8e96', 'right');
    if (lv.def.endless) T_(ctx, '최고 ' + endlessBest(prof) + '층', 950, by + 16, 12, '#d8b0ff', 'right');  // 끝없는 심연은 난이도 대신 최고 층
    else if (!lv.def.practice) T_(ctx, df.name, 950, by + 16, 12, df.color, 'right');  // 난이도(2026-10-24 사용자) — 연습장은 없음
    // 타임어택: 보스를 쓰러뜨리면 그 시간에서 멈추고 새 기록이면 금색
    const done = run && run.clearTime !== undefined, t = done ? run.clearTime : World.time;
    T_(ctx, '시간 ' + fmtTime(t), 950, by + 34, 14, done ? (run.newRecord ? '#ffd36a' : '#7dff8a') : '#e8e0d0', 'right');
    const best = prof.bestTimes && prof.bestTimes[timeKey(lv.def.timeId || lv.def.id, RUN.diff)];
    if (done && run.newRecord) T_(ctx, '★ 새 기록!', 950, by + 50, 12, '#ffd36a', 'right');
    else if (best) T_(ctx, '최고 ' + fmtTime(done && run.bestPrev ? run.bestPrev : best), 950, by + 50, 11, '#8a7e88', 'right');
  }

  return { draw, pixIcon };
})();
