// 장면 관리: 마을(걸어 다니는 광장, town.js) → 던전 고르기 → 던전(런) → 결과 → 마을. 위에 겹치는 창(가방 · 일시정지 · 확인)을 쌓는다.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// 던전 계산 한 걸음(초). 120Hz 폰 화면(갤럭시 S21 등)에서도 화면 한 번마다 한 걸음씩 움직이게 1/120(2026-10-25 사용자: 폰에서 버벅임) — 60Hz 화면은 한 번에 두 걸음
const STEP = 1 / 120;

const Game = (() => {
  let scene = 'title', overlays = [], prof = null, res = null;
  let toastMsg = null, toastT = 0, time = 0, acc = 0, last = performance.now();

  // 켜면 시작 화면(splash.js, 2026-10-25) → 아무 버튼이나 누르면 캐릭터 선택(2026-10-24). prof 는 1번 칸(없으면 새 기록)을 미리 읽어 둔다 — 고르기 전에는 저장하지 않는다
  function init() {
    Save.setSlot(0);
    prof = Save.load() || Save.fresh();
    scene = 'splash';
  }
  // 칸 n 의 캐릭터로 시작(fresh = 새로 만들기)
  function startSlot(n, fresh, cls) {
    Save.setSlot(n);
    prof = (!fresh && Save.load(n)) || Save.fresh(cls);
    Save.write(prof);
    scene = 'town'; overlays = []; Input.clear();
    Town.enter(prof, false);
    if (fresh) Story.trigger('opening');  // 새 캐릭터: 오프닝 · 카엘의 인사(2026-10-25)
  }
  function toTitle() { if (Net.state !== 'off') Net.leave(); Save.write(prof); scene = 'title'; overlays = []; Input.clear(); UI.title.open(); }

  // 마을로 올 때는 던전 입구 앞에서 시작(처음 켤 때만 광장 가운데)
  function open(name) { scene = name; overlays = []; Input.clear(); if (name === 'town') { Save.write(prof); Town.enter(prof, true); Net.refresh(); } }
  function overlay(o) {
    if (o.type === 'inv') UI.inv.open(o.mode);
    if (o.type === 'stones') UI.stones.open(o.mode);
    if (o.type === 'gems') UI.gems.open();
    if (o.type === 'manage') UI.manage.open(o.tab);
    if (o.type === 'smith') UI.smith.open();
    if (o.type === 'vault') UI.vault.open();
    if (o.type === 'shopItems') UI.shopItems.open();
    if (o.type === 'pause') UI.pause.sel = 0;
    if (o.type === 'settings') UI.settings.sel = 0;
    if (o.type === 'soundtest') UI.soundtest.open(o);
    if (o.type === 'confirm') UI.confirm.sel = o.defaultYes ? 0 : 1;
    if (o.type === 'choice') UI.choice.sel = 0;
    if (o.type === 'newchar') UI.newchar.open();
    if (o.type === 'coop') Coop.open();
    if (o.type === 'jar') Jar.open(prof);
    if (o.type === 'craft') Craft.open(prof);
    if (o.type === 'quests') Quests.open(prof);
    if (o.type === 'records') Records.open(prof);
    if (o.type === 'imprint') Imprint.open(prof);
    overlays.push(o);
    Input.clear();
  }
  function closeOverlay() { overlays.pop(); Input.clear(); }
  // seed = 파티로 들어갈 때 방장이 정한 씨앗(같은 층). 파티 던전에서는 이야기 대화창을 띄우지 않는다(story.js)
  function startRun(def, diff = 0, seed = 0, party = 1) { World.start(def, prof, diff, seed, party); scene = 'run'; overlays = []; acc = 0; Input.clear(); Story.trigger('start', def); }  // party = 파티 인원
  function endRun(run, kind) { res = { run, kind }; scene = 'result'; overlays = []; Save.write(prof); Input.clear(); }
  function quitRun() { World.player.dead = false; endRun(currentRun(), 'quit'); }
  let runRef = null;
  const currentRun = () => runRef;
  // 장비 · 골드가 바뀌면 능력치 다시 계산하고 저장
  function changed() { if (scene === 'run') refreshStats(World.player); if (scene === 'town') Town.refresh(); Save.write(prof); Net.refresh(); Coop.kitChanged(); }
  function toast(s) { toastMsg = s; toastT = 2; }
  function wipe() { Save.wipe(); prof = Save.fresh(); Save.write(prof); toast('기록을 지웠어요'); }

  function update(dt) {
    UI.resolveTap();  // 폰: 지난 그림에서 누른 메뉴 줄 · 칸
    Unlocks.update(dt, prof, scene, overlays);  // 콘텐츠 해금 알림(2026-10-29)
    const top = overlays[overlays.length - 1];
    if (top) {
      if (top.type === 'inv') UI.inv.update(top, prof);
      else if (top.type === 'stones') UI.stones.update(top, prof);
      else if (top.type === 'gems') UI.gems.update(top, prof);
      else if (top.type === 'manage') UI.manage.update(top, prof);
      else if (top.type === 'smith') UI.smith.update(top, prof);
      else if (top.type === 'vault') UI.vault.update(top, prof);
      else if (top.type === 'shopItems') UI.shopItems.update(top, prof);
      else if (top.type === 'qty') UI.qty.update(top, prof);
      else if (top.type === 'pause') UI.pause.update();
      else if (top.type === 'settings') UI.settings.update();
      else if (top.type === 'soundtest') UI.soundtest.update(top);
      else if (top.type === 'confirm') UI.confirm.update(top);
      else if (top.type === 'choice') UI.choice.update(top);
      else if (top.type === 'newchar') UI.newchar.update(top);
      else if (top.type === 'talk') Story.update(top);
      else if (top.type === 'coop') Coop.update(top);
      else if (top.type === 'coopwait') Coop.waitUpdate();
      else if (top.type === 'coopview') Coop.viewUpdate();
      else if (top.type === 'coopgo') Coop.goUpdate();
      else if (top.type === 'jar') Jar.update(top, prof);
      else if (top.type === 'craft') Craft.update(top, prof);
      else if (top.type === 'quests') Quests.update(top, prof);
      else if (top.type === 'records') Records.update(top, prof);
      else if (top.type === 'imprint') Imprint.update(top, prof);
      else if (top.type === 'ride') Town.rideUpdate(top);  // 광차 타는 장면
      // 파티 던전은 창(가방 · 일시정지 · 계단 확인)을 열어도 멈추지 않는다 — 친구는 계속 싸우고 있음. 내 몸만 입력 없이
      if (scene === 'run' && World.partySeed && overlays.length) {
        World.inputLock = true;
        acc += dt;
        while (acc >= STEP && scene === 'run') { World.update(STEP); acc -= STEP; }
        World.inputLock = false;
        return;
      }
      acc = 0;
      return;
    }
    if (scene === 'town') Town.update(dt);
    else if (scene === 'select') UI.select.update(prof);
    else if (scene === 'title') UI.title.update();
    else if (scene === 'splash') Splash.update();
    else if (scene === 'result') UI.result.update();
    else if (scene === 'run') {
      if (Input.wasPressed('pause')) { overlay({ type: 'pause' }); return; }
      if (Input.wasPressed('inv')) { overlay({ type: 'inv', mode: 'equip' }); return; }
      bufferPlayerInput(World.player);
      acc += dt;
      while (acc >= STEP && scene === 'run') { World.update(STEP); acc -= STEP; }
    }
  }

  function draw() {
    UI.tapLayer();  // 누를 곳은 맨 위에 그린 화면 것만 남긴다
    if (scene === 'town') Town.draw(ctx);
    else if (scene === 'select') UI.select.draw(ctx, prof, time);
    else if (scene === 'title') UI.title.draw(ctx, time);
    else if (scene === 'splash') Splash.draw(ctx, time);
    else if (scene === 'result') UI.result.draw(ctx, res, prof, time);
    else if (scene === 'run') World.draw(ctx);
    for (const o of overlays) {
      UI.tapLayer();
      if (o.type === 'inv') UI.inv.draw(ctx, o, prof, time);
      else if (o.type === 'stones') UI.stones.draw(ctx, o, prof);
      else if (o.type === 'gems') UI.gems.draw(ctx, o, prof);
      else if (o.type === 'manage') UI.manage.draw(ctx, o, prof);
      else if (o.type === 'smith') UI.smith.draw(ctx, o, prof);
      else if (o.type === 'vault') UI.vault.draw(ctx, o, prof);
      else if (o.type === 'shopItems') UI.shopItems.draw(ctx, o, prof);
      else if (o.type === 'qty') UI.qty.draw(ctx, o, prof);
      else if (o.type === 'pause') UI.pause.draw(ctx);
      else if (o.type === 'settings') UI.settings.draw(ctx);
      else if (o.type === 'soundtest') UI.soundtest.draw(ctx, o);
      else if (o.type === 'confirm') UI.confirm.draw(ctx, o);
      else if (o.type === 'choice') UI.choice.draw(ctx, o);
      else if (o.type === 'newchar') UI.newchar.draw(ctx, o, time);
      else if (o.type === 'talk') Story.draw(ctx, o);
      else if (o.type === 'coop') Coop.draw(ctx, o, prof);
      else if (o.type === 'coopwait') Coop.waitDraw(ctx);
      else if (o.type === 'coopview') Coop.viewDraw(ctx, prof, time);
      else if (o.type === 'coopgo') Coop.goDraw(ctx);
      else if (o.type === 'jar') Jar.draw(ctx, o, prof);
      else if (o.type === 'craft') Craft.draw(ctx, o, prof);
      else if (o.type === 'quests') Quests.draw(ctx, o, prof);
      else if (o.type === 'records') Records.draw(ctx, o, prof);
      else if (o.type === 'imprint') Imprint.draw(ctx, o, prof);
      else if (o.type === 'ride') Town.rideDraw(ctx, o);
    }
    Unlocks.draw(ctx, scene, overlays);
    if (toastT > 0 && toastMsg) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, toastT / 0.4);
      ctx.font = 'bold 16px ' + Gfx.FONT;
      const w = ctx.measureText(toastMsg).width + 40;
      const ty = scene === 'run' && !overlays.length ? 392 : 470;  // 던전에서는 아래 체력 구슬 판 위로
      Gfx.panel(ctx, 480 - w / 2, ty, w, 40, { border: '#ffd36a' });
      Gfx.text(ctx, toastMsg, 480, ty + 26, 16, '#f0e0b8', 'center');
      ctx.globalAlpha = 1;
    }
  }

  // 지금 틀 곡(2026-10-25 사용자: 음악 넣기, music.js): 시작 화면 = title · 마을(던전 고르기 · 결과도) = 벨록 · 실베인 · 던전 = 던전마다(끝없는 심연은 빌린 던전 것) ·
  // 보스와 싸우는 중 = boss(심연의 군주 · 끝없는 심연 수호자 = lord) · 엔딩 대사가 나오는 동안 = ending · trueEnding
  function musicFor() {
    const top = overlays[overlays.length - 1];
    if (top && top.type === 'soundtest' && top.track) return top.track;  // 소리 목록 듣기에서 고른 곡
    if (top && top.type === 'talk' && top.lines) {
      const at = l => { const k = top.lines.indexOf(l); return k >= 0 && top.i >= k; };
      if (at(STORY.trueEnding[0])) return 'trueEnding';
      if (at(STORY.ending[0])) return 'ending';
    }
    if (scene === 'splash' || scene === 'title') return 'title';
    if (scene === 'run' && World.level) {
      const def = World.level.def;
      if (World.bossFight) return def.id === 'abyss' || def.endless ? 'lord' : 'boss';
      return def.music || def.id;  // 끝없는 심연은 층마다 빌린 곡(ENDLESS.floors music)
    }
    return Town.where === 'silvane' ? 'silvane' : 'belloc';
  }
  // 메뉴 소리(2026-10-25): 창이 열렸거나 메뉴 화면이면 고르기 · 확인 · 뒤로에 짧은 소리. 걷는 화면(던전 · 마을)의 방향키는 빼고
  function menuSounds() {
    const top = overlays[overlays.length - 1];
    if (!(top ? top.type !== 'ride' : scene === 'title' || scene === 'select' || scene === 'result')) return;
    if (Input.wasPressed('back')) Sfx.ui('back');
    else if (Input.wasPressed('ok')) { if (!top || top.type !== 'soundtest') Sfx.ui('ok'); }  // 소리 목록에서는 고른 소리만
    else if (Input.nav('up') || Input.nav('down') || Input.nav('left') || Input.nav('right')) Sfx.ui('move');
  }

  // 한 화면에서 오류가 나도 게임이 멈추지 않게(2026-10-25: 그리기 오류 하나로 화면이 굳는 일이 두 번 — 검기 · 파티 검기) — 오류는 콘솔에 남기고 다음 화면으로
  function frame(now) {
    try {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      toastT -= dt;
      Input.poll();
      Net.update(dt);  // 함께하기: 연결 속도 · 끊김 살피기
      menuSounds();
      update(dt);
      Coop.tick(dt);  // 함께하기: 내 마을 위치 보내기 · 친구 몸 따라가기
      Music.play(musicFor()); Music.update(dt);
      Input.endFrame();
      draw();
    } catch (e) {
      console.error(e);
      try { ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } catch (e2) { /* 그대로 */ }
    }
    requestAnimationFrame(frame);
  }

  return {
    init, startSlot, toTitle, open, overlay, closeOverlay, startRun, endRun, quitRun, changed, toast, wipe, frame, update, draw,
    get scene() { return scene; }, get prof() { return prof; }, get overlays() { return overlays; },
    setRun(r) { runRef = r; },
  };
})();

// 창 크기에 맞춰 16:9 로 늘린다
function fit() {
  const s = Math.min(window.innerWidth / 960, window.innerHeight / 540);
  canvas.style.width = Math.floor(960 * s) + 'px';
  canvas.style.height = Math.floor(540 * s) + 'px';
}
window.addEventListener('resize', fit);
// 전화가 오거나 다른 앱 · 탭 · 창으로 가면 던전을 자동 일시정지(2026-10-25 사용자). 돌아오면 일시정지 창에서 이어 한다
function autoPause() {
  if (World.partySeed && Game.scene === 'run') return;  // 파티 던전은 멈추지 않는다(친구는 계속 하고 있음)
  if (Game.scene === 'run' && !Game.overlays.length && !World.player.dead) Game.overlay({ type: 'pause' });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('pagehide', autoPause);
window.addEventListener('blur', autoPause);
fit();
Input.attachMouse(canvas);
Game.init();
requestAnimationFrame(Game.frame);
