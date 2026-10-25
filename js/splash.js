// 시작 화면(2026-10-25 사용자: 봉인의 숲 시작 화면처럼). 작은 캔버스(320x180)에 그린 뒤 3배로 키워 도트 느낌을 살린다.
// 지하 도시 벨록 아래 동굴: 천장의 마을 불빛 · 종유석, 겹겹이 흐르는 바위 그림자, 바닥 깊은 틈에서 보랏빛으로 열린 심연의 문과 빛기둥,
// 떠오르는 불티, 그리고 왼쪽 절벽 끝으로 걸어와 문을 내려다보는 주인공. 캐릭터 선택 화면도 이 배경(stand: 걷지 않고 서 있기)
const Splash = (() => {
  const W = 320, H = 180, WALK = 4.2, EMBER_N = 46, STAR_N = 30;
  const R = i => { const v = Math.sin(i * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };
  let buf = null, g = null, walk0 = 0, lastT = -9, logo = null;

  // 바위 능선: 아래에서 솟은(top = false) 또는 천장에서 내려온(top = true) 들쭉날쭉한 띠. drift = 옆으로 흐름
  function ridge(base, amp, step, seed, drift, col, top) {
    const off = ((drift % step) + step) % step;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-step * 2, top ? 0 : H);
    for (let i = -1, x = -off - step; x < W + step * 2; i++, x += step) {
      const k = Math.floor(drift / step) + i;
      g.lineTo(Math.round(x), Math.round(base + (R(k * 7 + seed) - 0.5) * amp * 2));
    }
    g.lineTo(W + step * 2, top ? 0 : H);
    g.closePath(); g.fill();
  }

  // 심연의 문: 돌기둥 둘 + 아치, 안은 소용돌이치는 보랏빛
  function gate(cx, cy, t, pulse) {
    const glow = g.createRadialGradient(cx, cy, 2, cx, cy, 70);
    glow.addColorStop(0, 'rgba(200,110,255,' + (0.5 + 0.2 * pulse) + ')'); glow.addColorStop(0.4, 'rgba(120,40,200,0.25)'); glow.addColorStop(1, 'rgba(60,10,120,0)');
    g.fillStyle = glow; g.fillRect(cx - 70, cy - 70, 140, 140);
    // 안쪽: 어두운 중심 + 도는 고리
    g.save();
    g.beginPath(); g.ellipse(cx, cy, 13, 19, 0, 0, Math.PI * 2); g.clip();
    const inner = g.createRadialGradient(cx, cy, 1, cx, cy, 19);
    inner.addColorStop(0, '#0a0412'); inner.addColorStop(0.55, '#3a0f6a'); inner.addColorStop(1, '#c86aff');
    g.fillStyle = inner; g.fillRect(cx - 14, cy - 20, 28, 40);
    g.strokeStyle = 'rgba(255,170,255,0.55)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = t * (0.8 + i * 0.4) + i * 2;
      g.beginPath(); g.ellipse(cx, cy, 4 + i * 3.5, 6 + i * 5, a, 0.4, 2.6); g.stroke();
    }
    g.restore();
    // 돌기둥 · 아치(앞면 어둡게, 문 쪽 가장자리만 빛을 받는다)
    g.fillStyle = '#1a1122';
    g.fillRect(cx - 22, cy - 22, 7, 46); g.fillRect(cx + 15, cy - 22, 7, 46);
    g.beginPath(); g.arc(cx, cy - 20, 22, Math.PI, 0); g.arc(cx, cy - 20, 15, 0, Math.PI, true); g.closePath(); g.fill();
    g.fillStyle = 'rgba(210,140,255,' + (0.55 + 0.25 * pulse) + ')';
    g.fillRect(cx - 16, cy - 20, 1, 44); g.fillRect(cx + 15, cy - 20, 1, 44);
    g.fillStyle = '#2c1f38';
    g.fillRect(cx - 24, cy + 22, 11, 3); g.fillRect(cx + 13, cy + 22, 11, 3);  // 받침
    g.fillStyle = '#c86aff'; g.fillRect(cx - 1, cy - 44, 2, 3);  // 아치 꼭대기 보석
  }

  // 천장 마을: 바위 턱 위 작은 집 불빛 · 내려온 사다리
  function village(t) {
    g.fillStyle = '#0d0912';
    g.fillRect(14, 22, 74, 6); g.fillRect(232, 28, 60, 5);
    const houses = [[18, 13, 12, 9], [34, 10, 14, 12], [52, 14, 10, 8], [66, 11, 13, 11], [238, 20, 12, 8], [256, 17, 14, 11], [274, 21, 10, 7]];
    houses.forEach(([x, y, w, h], i) => {
      g.fillStyle = '#120d18'; g.fillRect(x, y, w, h);
      g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x + w / 2, y - 4); g.lineTo(x + w + 1, y); g.closePath(); g.fill();
      const on = 0.75 + 0.25 * Math.sin(t * (2 + R(i) * 3) + i * 4);
      g.fillStyle = 'rgba(255,200,110,' + on + ')'; g.fillRect(x + 3, y + 3, 2, 2);
      if (w > 11) g.fillRect(x + w - 5, y + 3, 2, 2);
    });
    // 마을 불빛이 아래로 번진다
    const lg = g.createRadialGradient(50, 22, 2, 50, 22, 60);
    lg.addColorStop(0, 'rgba(255,190,110,0.16)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = lg; g.fillRect(0, 0, 120, 80);
    // 사다리
    g.fillStyle = '#2a1e22';
    g.fillRect(84, 28, 1, 40); g.fillRect(89, 28, 1, 40);
    for (let y = 31; y < 68; y += 5) g.fillRect(84, y, 6, 1);
  }

  function scene(t, o = {}) {
    if (!buf) { buf = document.createElement('canvas'); buf.width = W; buf.height = H; g = buf.getContext('2d'); }
    if (!(lastT > t - 0.5)) walk0 = t;  // 잠깐이라도 안 그렸으면 다시 걸어 들어온다
    lastT = t;
    const wt = o.stand ? 99 : t - walk0, wk = Math.min(1, wt / WALK);
    const arrive = !o.stand && wt >= WALK ? Math.max(0, 1 - (wt - WALK) / 1.2) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8) + arrive;
    const cx = 168, gy = 128;
    g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // 바탕: 위는 거의 검정, 아래로 갈수록 보랏빛
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#050309'); sky.addColorStop(0.45, '#100a18'); sky.addColorStop(0.8, '#21102e'); sky.addColorStop(1, '#2c0f3c');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // 동굴 속 반짝이는 광물(별 대신)
    for (let i = 0; i < STAR_N; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + R(i + 3) * 2) + i);
      g.fillStyle = 'rgba(190,160,255,' + (0.15 + 0.6 * tw) * (0.3 + 0.7 * R(i + 7)) + ')';
      g.fillRect(Math.floor(R(i) * W), Math.floor(30 + R(i + 99) * 70), 1, 1);
    }
    // 먼 바위 → 가까운 바위(멀수록 보랏빛 · 천천히 흐른다)
    ridge(112, 9, 14, 11, t * 1.2, '#1c1028', false);
    ridge(124, 10, 18, 37, t * 2.4, '#150b1f', false);
    // 문과 빛기둥
    g.globalCompositeOperation = 'lighter';
    const beam = g.createLinearGradient(0, 0, 0, gy);
    beam.addColorStop(0, 'rgba(160,80,255,0)'); beam.addColorStop(1, 'rgba(180,90,255,' + (0.22 + 0.08 * pulse) + ')');
    g.fillStyle = beam; g.fillRect(cx - 16, 0, 32, gy);
    g.fillStyle = 'rgba(220,160,255,' + (0.08 + 0.04 * pulse) + ')'; g.fillRect(cx - 6, 0, 12, gy);
    g.globalCompositeOperation = 'source-over';
    gate(cx, gy, t, pulse);
    if (arrive > 0) {  // 주인공이 서는 순간 문이 한 번 크게 빛난다
      g.strokeStyle = 'rgba(220,150,255,' + arrive * 0.8 + ')'; g.lineWidth = 1;
      const rr = 18 + (1 - arrive) * 50;
      g.beginPath(); g.ellipse(cx, gy + 4, rr, rr * 0.4, 0, 0, Math.PI * 2); g.stroke();
    }
    // 천장: 바위 띠 · 종유석 · 마을
    ridge(10, 6, 12, 71, t * 0.6, '#08050d', true);
    for (let i = 0; i < 16; i++) {
      const x = Math.round(R(i + 40) * W), len = 6 + Math.round(R(i + 60) * 16);
      g.fillStyle = '#08050d'; g.beginPath(); g.moveTo(x - 3, 10); g.lineTo(x + 3, 10); g.lineTo(x, 10 + len); g.closePath(); g.fill();
    }
    village(t);
    // 떠오르는 불티(보랏빛 · 분홍)
    for (let i = 0; i < EMBER_N; i++) {
      const sp = 6 + R(i + 5) * 14, y = H + 10 - ((t * sp + R(i + 9) * (H + 20)) % (H + 20));
      const x = Math.round((R(i) * 0.6 + 0.2) * W + Math.sin(t * 0.8 + i) * 6);
      const a = Math.min(1, (H - y) / 40) * Math.min(1, y / 60);
      g.fillStyle = (i % 3 ? 'rgba(200,130,255,' : 'rgba(255,150,210,') + a * 0.8 + ')';
      g.fillRect(x, Math.round(y), 1, 1);
    }
    // 앞 절벽(왼쪽 · 오른쪽), 가운데는 깊은 틈
    g.fillStyle = '#07040a';
    g.beginPath(); g.moveTo(0, H); g.lineTo(0, 150); g.lineTo(40, 148); g.lineTo(78, 151); g.lineTo(112, 150); g.lineTo(124, 158); g.lineTo(130, H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W, H); g.lineTo(W, 146); g.lineTo(282, 149); g.lineTo(246, 147); g.lineTo(218, 152); g.lineTo(206, 160); g.lineTo(200, H); g.closePath(); g.fill();
    g.fillStyle = 'rgba(190,110,255,0.35)';  // 문빛을 받은 절벽 끝
    g.fillRect(100, 150, 12, 1); g.fillRect(218, 152, 12, 1);
    // 주인공: 왼쪽 아래에서 걸어와 절벽 끝에 선다(문 쪽을 본다)
    const sx = -12, sy = 166, ex = 104, ey = 150, moving = wk < 1;
    const hx = Math.round(sx + (ex - sx) * wk), hy = Math.round(sy + (ey - sy) * wk);
    Gfx.spr(g, moving ? Gfx.anim('hero_run_anim', wt, 10) : Gfx.anim('hero_idle_anim', t, 6), hx, hy, {});
    // 문빛이 주인공 등에 닿는다
    const rim = g.createRadialGradient(hx + 4, hy - 12, 1, hx + 4, hy - 12, 14);
    rim.addColorStop(0, 'rgba(200,120,255,' + (0.12 + 0.06 * pulse) + ')'); rim.addColorStop(1, 'rgba(200,120,255,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = rim; g.fillRect(hx - 12, hy - 28, 30, 30); g.globalCompositeOperation = 'source-over';
    // 가장자리 어둡게
    const vg = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 200);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return buf;
  }

  // 제목 글씨: 작은 캔버스에 쓰고 도트 그대로 키운다. 은빛 → 보라 그라데이션, 짙은 테두리 · 아래로 두께, 밑줄 + 보랏빛 보석
  function logoCanvas() {
    if (logo) return logo;
    const size = 30, pad = 8, text = '심연속으로';
    const c = document.createElement('canvas'), m = c.getContext('2d');
    m.font = '900 ' + size + 'px ' + Gfx.FONT;
    c.width = Math.ceil(m.measureText(text).width) + pad * 2; c.height = size + pad * 2 + 10;
    const q = c.getContext('2d');
    q.font = '900 ' + size + 'px ' + Gfx.FONT; q.textAlign = 'left'; q.textBaseline = 'top'; q.lineJoin = 'round';
    q.strokeStyle = '#08030e'; q.lineWidth = 6;
    for (let d = 3; d >= 0; d--) q.strokeText(text, pad, pad + d);
    q.fillStyle = '#2a0f44';
    for (let d = 3; d >= 1; d--) q.fillText(text, pad, pad + d);
    const gd = q.createLinearGradient(0, pad, 0, pad + size);
    gd.addColorStop(0, '#fbf4ff'); gd.addColorStop(0.35, '#d8c0ff'); gd.addColorStop(0.65, '#a070f0'); gd.addColorStop(1, '#5a2aa8');
    q.fillStyle = gd; q.fillText(text, pad, pad);
    const ly = pad + size + 6, mid = c.width / 2;
    q.fillStyle = '#08030e'; q.fillRect(pad + 2, ly - 1, c.width - pad * 2 - 4, 3);
    q.fillStyle = '#b48aff'; q.fillRect(pad + 3, ly, c.width - pad * 2 - 6, 1);
    q.fillStyle = '#08030e'; q.beginPath(); q.moveTo(mid, ly - 4); q.lineTo(mid + 5, ly + 0.5); q.lineTo(mid, ly + 5); q.lineTo(mid - 5, ly + 0.5); q.closePath(); q.fill();
    q.fillStyle = '#ff7ad8'; q.beginPath(); q.moveTo(mid, ly - 2); q.lineTo(mid + 3, ly + 0.5); q.lineTo(mid, ly + 3); q.lineTo(mid - 3, ly + 0.5); q.closePath(); q.fill();
    return (logo = c);
  }
  function drawLogo(ctx, cx, top, t) {
    const c = logoCanvas(), s = 3, w = c.width * s, h = c.height * s, x = Math.round(cx - w / 2);
    const glow = ctx.createRadialGradient(cx, top + h * 0.45, 4, cx, top + h * 0.45, w * 0.6);
    glow.addColorStop(0, 'rgba(170,100,255,' + (0.2 + 0.07 * Math.sin(t * 2)) + ')'); glow.addColorStop(1, 'rgba(170,100,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - w * 0.6, top - h * 0.3, w * 1.2, h * 1.5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, x, Math.round(top + Math.sin(t * 1.5) * s), w, h);
    return top + h;
  }

  // 배경만(캐릭터 선택 화면 뒤)
  function backdrop(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene(t, { stand: true }), 0, 0, 960, 540);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, 960, 540);
  }

  function update() {
    // 아무 버튼이나 누르면(폰은 화면을 누르면) 캐릭터 선택으로
    if (['ok', 'attack', 'back', 'pause', 'dodge', 'special', 'charge', 'inv', 'potion'].some(a => Input.wasPressed(a))) {
      Sfx.pickup();
      Game.open('title');
      UI.title.open();
    }
  }
  function draw(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene(t), 0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { now: true });  // 폰: 아무 데나 누르면 시작
    const bottom = drawLogo(ctx, 480, 52, t);
    const story = ['그날 밤 땅이 갈라지고, 왕국은 하룻밤 만에 마물에게 무너졌다.', '땅 위로 가는 길은 단 하나, 지하 도시 벨록에서 심연의 문 너머 왕의 갱도뿐.'];
    story.forEach((l, i) => Gfx.text(ctx, l, 480, bottom + 26 + i * 24, 15, '#e6dcf4', 'center', '600'));
    const touch = (typeof Touch !== 'undefined' && Touch.on && Input.device !== 'pad') || Input.device === 'touch';
    if (Math.sin(t * 4) > -0.2) Gfx.text(ctx, (touch ? '화면을 눌러서' : '아무 버튼이나 눌러서') + ' 시작', 480, 474, 20, '#e0b8ff', 'center');
    Gfx.text(ctx, '© 2026 웨폰마스터. All rights reserved.', 480, 528, 10, 'rgba(220,210,235,0.7)', 'center', '600');
    // 판 번호(2026-10-25 사용자: 인트로에 버전) — index.html 스크립트 주소의 ?v=. 폰이 새 판인지 바로 보이게
    if (Net.VER) Gfx.text(ctx, '판 ' + Net.VER, 948, 528, 11, 'rgba(220,210,235,0.75)', 'right', '600');
  }

  return { scene, backdrop, update, draw };
})();
