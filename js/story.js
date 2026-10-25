// 이야기(2026-10-25 사용자: 봉인의 숲처럼 오프닝 · 스토리. 마물의 습격으로 살아남은 사람들이 지하 도시 벨록에 모였다).
// 대사 = [화자, 글]. 화자: narr 내레이션(검은 화면 가운데 글) · hero 나(이름 = 직업) · kael 파수꾼 카엘 · boss 그 던전 보스.
// 장면마다 한 번만(prof.story 에 본 것을 적는다). 던전: start 처음 들어갈 때 · boss 보스방 · down 보스를 쓰러뜨린 뒤 · town 그 뒤 마을로 돌아왔을 때.
const SPEAKERS = {
  narr: { name: '', color: '#c8b8a0' },
  hero: { name: null, color: '#9cc4ff' },
  kael: { name: '파수꾼 카엘', color: '#ffd36a', bg: '#2a2418' },  // 초상 = 따로 찍은 도트(kaelFace) — 0x72 몸은 모두 몹 · 우리 캐릭터와 겹쳐서(2026-10-25 사용자)
  boss: { name: null, color: '#ff7a5a', bg: '#2a1414' },
};

// 2026-10-25 사용자: 10던전 = 지하 도시 벨록에서 차례로 탐험해 땅 위(광산 도시 실베인)로 나가는 여정. 잿빛 마을 → 지하 도시 벨록
const STORY = {
  opening: [
    ['narr', '그날 밤, 땅이 갈라졌다.'],
    ['narr', '갈라진 틈에서 마물이 쏟아져 나왔고, 왕국의 성벽은 하룻밤 만에 무너졌다.'],
    ['narr', '살아남은 사람들은 광산 속으로 달아났고, 뒤쫓는 마물을 막으려고 스스로 갱도 입구를 무너뜨렸다.'],
    ['narr', '마물은 막았지만 땅 위로 가는 길도 함께 묻혔다. 옛 광부들이 파 놓은 지하 도시 벨록이 마지막 피난처가 되었다.'],
    ['narr', '등불 기름은 줄어 가고, 광산 저 깊은 곳에서는 무언가가 아직도 울리고 있다.'],
  ],
  welcome: [
    ['kael', '정신이 드나? 무너진 성당 앞에 쓰러져 있던 걸 끌고 왔다.'],
    ['hero', '…여기는 어디죠? 마물은… 다른 사람들은요?'],
    ['kael', '지하 도시 벨록. 땅 위에서 도망쳐 온 사람들의 마지막 피난처다. 나는 이곳을 지키는 파수꾼 카엘.'],
    ['kael', '위로 가는 갱도는 그날 밤 우리 손으로 무너뜨렸다. 등불 기름도 식량도 오래 버티지 못해.'],
    ['hero', '다른 길은 없나요?'],
    ['kael', '하나 있다. 옛 왕국이 판 왕의 갱도. 이 광산 가장 먼 끝에서 땅 위 광산 도시 실베인까지 곧장 이어진 길이지.'],
    ['kael', '하지만 그 길 끝에 심연의 문이 있다. 마물은 모두 거기서 쏟아져 나온다. 문이 열려 있는 한 아무도 갱도에 닿지 못해.'],
    ['hero', '그럼 거기까지 길을 뚫고, 문을 닫으면 되겠군요.'],
    ['kael', '…그 눈빛을 보니 말려도 소용없겠군. 첫 길목은 도시 바로 옆 무너진 성당이다. 위쪽 가운데가 던전 입구다.'],
    ['kael', '대장장이 브론, 상인 엘린, 세공사 미라도 널 도와줄 거다. 살아서 돌아와라.'],
  ],
  ending: [
    ['narr', '심연의 문이 닫히고, 땅 울림이 멎었다.'],
    ['narr', '왕의 갱도를 막던 어둠이 걷히자, 아득히 높은 곳에서 한 줄기 빛이 내려왔다.'],
    ['kael', '길이 열렸다. 저 위 실베인이 어떻게 됐는지는 아무도 모른다. 아직 누군가 버티고 있을지도.'],
    ['kael', '누군가 먼저 올라가 길을 열어야 한다. …충분히 강해지면, 그때 가라. 벨록 사람들은 네 뒤를 따르겠다.'],
  ],
  dungeons: {
    chapel: {
      start: [['hero', '도시 바로 옆에 이런 성당이 묻혀 있었다니…'], ['hero', '해골과 좀비가 돌아다닌다. 죽은 자들까지 깨어난 건가.']],
      boss: [['boss', '…크으… 산 자의… 냄새…'], ['hero', '성당을 지키던 자가 저렇게 썩어 버렸군. 편히 잠들게 해 주마.']],
      down: [['boss', '…저 너머에서… 부르는… 소리가… 멈추지… 않아…'], ['hero', '저 너머에서 부르는 소리? 마물을 불러내는 무언가가 있다는 건가.']],
      town: [['kael', '성당 길이 열렸다고? 잘했다. 첫 길목을 뚫었군.'], ['kael', '부르는 소리라… 늪을 건너온 사람들도 같은 말을 했다. 성당 너머 독안개 늪을 살펴봐 줘.']],
    },
    swamp: {
      start: [['hero', '물이 썩어 있다. 독 웅덩이는 밟지 않는 게 좋겠어.']],
      boss: [['boss', '크르르… 늪은… 내 것… 심연이 준 힘… 내 것…'], ['hero', '심연이 힘을 줬다고?']],
      down: [['boss', '…길 끝에서… 군주님이… 너를… 기다린다…'], ['hero', '군주… 마물들에게도 우두머리가 있다는 거군.']],
      town: [['kael', '심연의 군주… 옛 기록에 딱 한 번 나오는 이름이다.'], ['kael', '늪 너머에 옛 왕국의 지하 묘지가 있다. 왕의 갱도에 대한 단서가 있을지도 모른다.']],
    },
    crypt: {
      start: [['hero', '옛 왕국의 무덤… 벽마다 커다란 문, 그리고 그 옆으로 하늘까지 솟은 긴 갱도가 그려져 있다.'], ['hero', '저게 왕의 갱도인가.']],
      boss: [['boss', '산 자여, 어찌 무덤을 어지럽히나. 우리 왕국은 이미 한 번 문을 닫았거늘.'], ['hero', '한 번 닫았다고? 심연의 문을 말하는 거냐?']],
      down: [['boss', '…문은… 얼음과 불과 피로… 봉인했었다… 누군가… 그 봉인을… 깼다…'], ['hero', '세 개의 봉인… 그걸 되찾으면 문을 닫을 수 있겠어.']],
      town: [['kael', '얼음, 불, 피의 봉인… 묘지 너머 얼어붙은 동굴에 얼음 봉인이 있다고 들었다.'], ['kael', '추위가 뼈까지 파고들 거다. 단단히 준비해 가라.']],
    },
    ice: {
      start: [['hero', '숨이 얼어붙는다. 봉인의 냉기가 아직 남아 있어.']],
      boss: [['boss', '얼음 봉인은 이제 내 몸 안에 있다. 가져가고 싶으면… 부숴 봐라!'], ['hero', '봉인을 삼켰다고? 그래서 문이 열린 거군.']],
      down: [['boss', '…봉인은… 돌아갔다… 하지만… 피의 봉인은… 오크 놈들이…'], ['hero', '얼음 봉인은 되찾았다. 다음은 오크들인가.']],
      town: [['kael', '동굴에 냉기가 다시 차오른다는 보고다. 네가 해낸 거야.'], ['kael', '동굴을 지나면 오크 요새다. 놈들이 도시 물자까지 빼앗아 가고 있어.']],
    },
    fort: {
      start: [['hero', '바리케이드에 벨록의 깃발이 걸려 있다… 약탈해 온 거군.']],
      boss: [['boss', '인간 따위가 여기까지! 심연의 군주께서 땅 위를 우리에게 주셨다!'], ['hero', '땅 위는 아무에게도 준 적 없어.']],
      down: [['boss', '크윽… 피의 봉인은… 이미 군주께 바쳤다… 넌… 늦었어…'], ['hero', '피의 봉인은 군주에게… 서둘러야 해.']],
      town: [['kael', '빼앗겼던 물자가 돌아왔다. 엘린이 무척 기뻐하더군.'], ['kael', '요새 너머가 불의 봉인이 있던 용암 지옥이다. 불꽃 악마가 지키고 있다고 한다.']],
    },
    hell: {
      start: [['hero', '땅 밑에 이런 불바다가… 숨만 쉬어도 목이 탄다.']],
      boss: [['boss', '불의 봉인? 하하! 내가 녹여 버렸다! 문은 이제 닫히지 않아!'], ['hero', '그럼 너를 쓰러뜨리고 다시 세우면 되겠지.']],
      down: [['boss', '…봉인을… 다시 세운다고…? 문 앞에… 서면… 너도… 알게 될 거다…'], ['hero', '불길이 잦아든다. 봉인의 힘이 돌아오는 게 느껴져.']],
      town: [['kael', '불과 얼음의 봉인이 돌아왔다면… 문을 닫을 수 있을지도 모른다.'], ['kael', '하지만 그 너머 하수도에서 병이 번지고 있다. 물을 길러 간 사람들이 쓰러지고 있어.']],
    },
    plague: {
      start: [['hero', '지독한 냄새… 도시로 흘러드는 물이 여기서 썩고 있었구나.']],
      boss: [['boss', '…아프다… 심연의 물을… 마셨더니… 아프다…'], ['hero', '저 거인도 원래는 하수도를 지키던 자였나…']],
      down: [['boss', '…고맙다… 이제… 안 아프다… 기사단을… 조심해라…'], ['hero', '기사단? 왕국의 기사단이 아직 남아 있단 말인가.']],
      town: [['kael', '…기사단. 왕국이 무너지던 날 문을 막겠다며 먼저 떠난 내 옛 동료들이다.'], ['kael', '살아 있다 해도 예전의 그들은 아닐 거다. …부탁한다.']],
    },
    order: {
      start: [['hero', '왕국의 문장이 검게 물들어 있다… 카엘이 말한 기사단이군.']],
      boss: [['boss', '카엘의 냄새가 나는군. 그 겁쟁이는 아직도 벨록에 숨어 있나?'], ['boss', '우리는 문을 지키러 왔다. 그리고 문이 우리를 받아들였지.'], ['hero', '문에 삼켜진 거다. 정신 차려!']],
      down: [['boss', '…그래… 우리는… 지키러… 왔었지… 카엘에게… 미안하다고…'], ['hero', '…꼭 전할게.']],
      town: [['kael', '…그 녀석이 그렇게 말했나.'], ['kael', '고맙다. 이제 남은 건 비늘 신전과… 심연의 문뿐이다.']],
    },
    temple: {
      start: [['hero', '물에 잠긴 신전… 심연의 문으로 가는 마지막 관문이라고 했지.']],
      boss: [['boss', '심연의 문을 연 것은 우리 일족이다. 바다보다 깊은 곳의 주인을 맞이하려고.'], ['hero', '그 주인이 땅 위를 삼키게 둘 수는 없어.']],
      down: [['boss', '…늦었다… 군주는… 이미… 깨어났다…'], ['hero', '깨어났다면 쓰러뜨리면 된다.']],
      town: [['kael', '벨록 사람들이 모두 짐을 싸고 있다. 네가 문을 닫으면 바로 떠날 수 있게.'], ['kael', '심연의 문… 문을 닫고 왕의 갱도를 열어라. 그리고 살아서 돌아와라.']],
    },
    abyss: {
      start: [['hero', '여기가… 심연의 문. 그리고 그 옆으로 솟은 거대한 갱도… 왕의 갱도다.']],
      boss: [['boss', '작은 것이 여기까지 왔구나. 얼음도, 불도, 피도… 나를 막지 못했다.'], ['hero', '봉인은 되찾았다. 이제 문을 닫을 차례다!']],
      down: [['boss', '…빛도 닿지 않는 곳에서… 나를 쓰러뜨린 자가… 있을 줄이야…'], ['hero', '문이 닫힌다… 왕의 갱도를 막던 어둠이 걷혀 간다.']],
      town: [['kael', '땅 울림이 멈췄다! 왕의 갱도 쪽에서 바람이 불어온다!'], ['kael', '…바람이다. 몇 년 만에 맡는 땅 위의 바람이야.']],
    },
  },
};

const Story = (() => {
  const T_ = Gfx.text;
  const CPS = 45;  // 한 초에 나오는 글자 수

  function play(lines, boss, then) { Game.overlay({ type: 'talk', lines, i: 0, chars: 0, total: 1, boss, then }); }
  // 한 번만: 이미 본 장면이면 false
  function once(key, lines, boss, then) {
    const prof = Game.prof;
    if (!prof.story) prof.story = {};
    if (!lines || prof.story[key]) return false;
    prof.story[key] = 1;
    Save.write(prof);
    play(lines, boss, then);
    return true;
  }
  // kind: opening · start · boss · down
  function trigger(kind, def) {
    if (kind === 'opening') { once('opening', [...STORY.opening, ...STORY.welcome]); return; }
    const S = STORY.dungeons[def.id];
    if (!S) return;
    const boss = ENEMIES[def.boss];
    if (kind === 'down') { if (once(def.id + ':down', S.down, boss)) Game.prof.story.pending = def.id; return; }
    once(def.id + ':' + kind, S[kind], boss);
  }
  // 보스를 쓰러뜨리고 마을로 돌아오면 카엘이 한마디(마지막 던전이면 엔딩까지)
  function townArrive() {
    const st = Game.prof.story;
    if (!st || !st.pending) return;
    const id = st.pending;
    delete st.pending;
    const S = STORY.dungeons[id];
    if (S) once(id + ':town', id === 'abyss' ? [...S.town, ...STORY.ending] : S.town);
  }
  // 마을 메뉴 '이야기 다시 보기'
  function replay() { play([...STORY.opening, ...STORY.welcome]); }

  function next(o) {
    o.i++; o.chars = 0;
    if (o.i >= o.lines.length) { Game.closeOverlay(); if (o.then) o.then(); }
  }
  function update(o) {
    o.chars += CPS / 60;
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); if (o.then) o.then(); return; }  // 건너뛰기
    if (Input.wasPressed('ok')) { if (o.chars < o.total) o.chars = o.total; else next(o); }
  }

  // 띄어쓰기 단위로 줄 나누기
  function wrap(ctx, text, w, size) {
    ctx.font = 'bold ' + size + 'px ' + Gfx.FONT;
    const out = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const n = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(n).width > w) { out.push(cur); cur = word; } else cur = n;
    }
    if (cur) out.push(cur);
    return out;
  }
  // 글자가 하나씩 나온다
  function typed(ctx, lines, x, y, size, lh, col, chars, align) {
    let left = Math.floor(chars);
    lines.forEach((l, i) => {
      if (left <= 0) return;
      T_(ctx, l.slice(0, left), x, y + i * lh, size, col, align);
      left -= l.length;
    });
  }

  // 파수꾼 카엘 얼굴: 갈색 두건 · 흰 수염 · 오른쪽 눈 흉터 · 견갑 + 금 고리. 28x28 도트를 계산으로 찍고 검은 테두리
  let kaelCanvas = null;
  function kaelFace() {
    if (kaelCanvas) return kaelCanvas;
    const N = 28, cx = 13.5;
    const P = { k: '#3a2c22', h: '#5e4834', H: '#7a5e42', s: '#dca67f', S: '#b47c5c', b: '#b4aea8', B: '#7c7671', e: '#1a1216', r: '#b44a46', m: '#6f7884', M: '#c8d0d8', n: '#9aa3ae', g: '#ffd36a', G: '#c8962e', o: '#120c10' };
    const at = (x, y) => {
      const px = x + 0.5, py = y + 0.5, ax = Math.abs(px - cx);
      if (py >= 20.5) {  // 어깨 갑옷: 견갑 + 가운데 금 고리 + 리벳
        const w = 7 + (py - 20.5) * 1.7;
        if (ax <= w) {
          if (ax <= 1.4 && py < 23.5) return py < 22 ? 'g' : 'G';
          if (ax > 2 && ax < 3) return 'm';
          if (py < 21.6) return 'M';
          if (Math.abs(ax - 8) < 0.6 && py > 24 && py < 25) return 'M';
          return py < 23.5 ? 'n' : 'm';
        }
      }
      const hood = ((px - cx) / 9.4) ** 2 + ((py - 12) / 10.4) ** 2 <= 1 && py < 21.5;
      const face = ((px - cx) / 5.6) ** 2 + ((py - 13) / 6.9) ** 2 <= 1;
      const beard = ((px - cx) / 4.3) ** 2 + ((py - 17.2) / 3.4) ** 2 <= 1 && py >= 15.2;
      if (beard) { if (py >= 15.6 && py < 16.6 && ax <= 1.3) return 'B'; return ax > 3 || py > 19.6 ? 'B' : 'b'; }
      if (face) {
        if (py < 7.4) return 'k';
        if (py < 8.4) return 'S';  // 두건 그늘
        if (Math.abs(ax - 2.3) < 0.6 && py >= 11 && py < 12.2) return 'e';
        if (py >= 9.8 && py < 10.8 && Math.abs(ax - 2.4) < 1.2) return 'B';
        if (px > cx + 1 && Math.abs(px - (cx + 2.3 + (py - 11) * 0.45)) < 0.6 && py >= 8.6 && py < 14.2) return 'r';  // 흉터
        if (ax < 0.6 && py >= 12.2 && py < 14) return 'S';  // 코
        return px > cx + 3.4 ? 'S' : 's';
      }
      if (hood) return px < cx - 1.5 ? 'H' : py > 16.5 ? 'k' : 'h';
      return null;
    };
    const c = document.createElement('canvas');
    c.width = c.height = N + 2;
    const g = c.getContext('2d'), A = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? null : at(x, y));
    for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) {
      const v = A(x, y);
      if (v) { g.fillStyle = P[v]; g.fillRect(x + 1, y + 1, 1, 1); continue; }
      let edge = false;
      for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if (A(x + i, y + j)) { edge = true; break; }
      if (edge) { g.fillStyle = P.o; g.fillRect(x + 1, y + 1, 1, 1); }
    }
    return (kaelCanvas = c);
  }

  function portrait(ctx, who, o, cx, cy, r, time) {
    const sp = SPEAKERS[who];
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = sp.bg || '#18202e'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = false;
    // 가슴 위로 크게(얼굴이 보이게, 아래는 원 밖으로 잘림)
    if (who === 'hero') Art.avatar(ctx, Game.prof, cx - 6, cy + r * 1.2, 5, time);
    else if (who === 'kael') ctx.drawImage(kaelFace(), Math.round(cx - 51), Math.round(cy - 48 + Math.sin(time * 2) * 1.5), 102, 102);  // 숨 쉬듯 살짝
    else if (who === 'boss' && o.boss) {
      const f = FRAMES[o.boss.sprite + '_idle_anim_f0'], small = f[2] <= 16;  // 작은 몸을 키운 거인 보스는 더 크게, 머리끝을 원 위쪽에 맞춤
      const sc = small ? 6.4 : 3.8, pad = { knight_f: 10, lizard_m: 10 }[o.boss.sprite] || 0;  // 기사 · 도마뱀 그림은 위쪽이 비어 있다
      const by = small ? cy - r * 0.95 + (f[3] - pad) * sc : cy + r * 1.15;
      Gfx.spr(ctx, Gfx.anim(o.boss.sprite + '_idle_anim', time, 6), cx, by, { scale: sc, tint: o.boss.tint, tintAlpha: o.boss.tintAlpha });
      if (o.boss.acc) Art.bossAcc(ctx, o.boss.acc, cx, by, sc, false, time);  // 왕관 · 뿔 · 눈빛
    }
    ctx.restore();
    ctx.strokeStyle = sp.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  function draw(ctx, o) {
    const time = performance.now() / 1000;
    const [who, text] = o.lines[Math.min(o.i, o.lines.length - 1)];
    const sp = SPEAKERS[who] || SPEAKERS.narr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    UI.zone(0, 0, 960, 540, { now: true });  // 폰: 아무 데나 누르면 넘기기
    const L = a => Input.label(a);
    if (who === 'narr') {
      // 내레이션: 검은 화면 가운데 글
      ctx.fillStyle = 'rgba(0,0,0,0.97)'; ctx.fillRect(0, 0, 960, 540);
      const g = ctx.createRadialGradient(480, 270, 40, 480, 270, 420);
      g.addColorStop(0, 'rgba(120,90,70,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
      const lines = wrap(ctx, text, 680, 22);
      o.total = lines.reduce((n, l) => n + l.length, 0);
      typed(ctx, lines, 480, 262 - (lines.length - 1) * 17, 22, 34, '#e8dcc4', o.chars, 'center');
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, 960, 540);
      const bx = 110, by = 372, bw = 740, bh = 146;
      Gfx.panel(ctx, bx, by, bw, bh, { border: sp.color });
      portrait(ctx, who, o, bx + 72, by + bh / 2, 54, time);
      const name = who === 'hero' ? clsOf(Game.prof).name : who === 'boss' ? (o.boss ? o.boss.name : '???') : sp.name;
      T_(ctx, name, bx + 146, by + 34, 18, sp.color);
      const lines = wrap(ctx, text, bw - 170, 17);
      o.total = lines.reduce((n, l) => n + l.length, 0);
      typed(ctx, lines, bx + 146, by + 66, 17, 26, '#f0e8dc', o.chars);
    }
    if (o.chars >= o.total && Math.sin(time * 6) > 0) T_(ctx, '▼', who === 'narr' ? 480 : 832, who === 'narr' ? 430 : 506, 14, sp.color, 'center');
    T_(ctx, '넘기기 ' + L('ok') + ' · 건너뛰기 ' + L('back'), 950, 532, 11, '#6a6068', 'right');
  }

  return { trigger, townArrive, replay, update, draw };
})();
