// 장면 관리: 마을(걸어 다니는 광장, town.js) → 던전 고르기 → 던전(런) → 결과 → 마을. 위에 겹치는 창(가방 · 일시정지 · 확인)을 쌓는다.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const STEP = 1 / 60;

const Game = (() => {
  let scene = 'title', overlays = [], prof = null, res = null;
  let toastMsg = null, toastT = 0, time = 0, acc = 0, last = performance.now();

  // 켜면 캐릭터 선택 화면(2026-10-24 사용자). prof 는 1번 칸(없으면 새 기록)을 미리 읽어 둔다 — 고르기 전에는 저장하지 않는다
  function init() {
    Save.setSlot(0);
    prof = Save.load() || Save.fresh();
    UI.title.open();
  }
  // 칸 n 의 캐릭터로 시작(fresh = 새로 만들기)
  function startSlot(n, fresh, cls) {
    Save.setSlot(n);
    prof = (!fresh && Save.load(n)) || Save.fresh(cls);
    Save.write(prof);
    scene = 'town'; overlays = []; Input.clear();
    Town.enter(prof, false);
  }
  function toTitle() { Save.write(prof); scene = 'title'; overlays = []; Input.clear(); UI.title.open(); }

  // 마을로 올 때는 던전 입구 앞에서 시작(처음 켤 때만 광장 가운데)
  function open(name) { scene = name; overlays = []; Input.clear(); if (name === 'town') { Save.write(prof); Town.enter(prof, true); } }
  function overlay(o) {
    if (o.type === 'inv') UI.inv.open(o.mode);
    if (o.type === 'stones') UI.stones.open(o.mode);
    if (o.type === 'gems') UI.gems.open();
    if (o.type === 'manage') UI.manage.open(o.tab);
    if (o.type === 'smith') UI.smith.open();
    if (o.type === 'vault') UI.vault.open();
    if (o.type === 'pause') UI.pause.sel = 0;
    if (o.type === 'settings') UI.settings.sel = 0;
    if (o.type === 'confirm') UI.confirm.sel = o.defaultYes ? 0 : 1;
    if (o.type === 'choice') UI.choice.sel = 0;
    overlays.push(o);
    Input.clear();
  }
  function closeOverlay() { overlays.pop(); Input.clear(); }
  function startRun(def, diff = 0) { World.start(def, prof, diff); scene = 'run'; overlays = []; acc = 0; Input.clear(); }
  function endRun(run, kind) { res = { run, kind }; scene = 'result'; overlays = []; Save.write(prof); Input.clear(); }
  function quitRun() { World.player.dead = false; endRun(currentRun(), 'quit'); }
  let runRef = null;
  const currentRun = () => runRef;
  // 장비 · 골드가 바뀌면 능력치 다시 계산하고 저장
  function changed() { if (scene === 'run') refreshStats(World.player); if (scene === 'town') Town.refresh(); Save.write(prof); }
  function toast(s) { toastMsg = s; toastT = 2; }
  function wipe() { Save.wipe(); prof = Save.fresh(); Save.write(prof); toast('기록을 지웠어요'); }

  function update(dt) {
    const top = overlays[overlays.length - 1];
    if (top) {
      if (top.type === 'inv') UI.inv.update(top, prof);
      else if (top.type === 'stones') UI.stones.update(top, prof);
      else if (top.type === 'gems') UI.gems.update(top, prof);
      else if (top.type === 'manage') UI.manage.update(top, prof);
      else if (top.type === 'smith') UI.smith.update(top, prof);
      else if (top.type === 'vault') UI.vault.update(top, prof);
      else if (top.type === 'pause') UI.pause.update();
      else if (top.type === 'settings') UI.settings.update();
      else if (top.type === 'confirm') UI.confirm.update(top);
      else if (top.type === 'choice') UI.choice.update(top);
      acc = 0;
      return;
    }
    if (scene === 'town') Town.update(dt);
    else if (scene === 'select') UI.select.update(prof);
    else if (scene === 'title') UI.title.update();
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
    if (scene === 'town') Town.draw(ctx);
    else if (scene === 'select') UI.select.draw(ctx, prof, time);
    else if (scene === 'title') UI.title.draw(ctx, time);
    else if (scene === 'result') UI.result.draw(ctx, res, prof, time);
    else if (scene === 'run') World.draw(ctx);
    for (const o of overlays) {
      if (o.type === 'inv') UI.inv.draw(ctx, o, prof, time);
      else if (o.type === 'stones') UI.stones.draw(ctx, o, prof);
      else if (o.type === 'gems') UI.gems.draw(ctx, o, prof);
      else if (o.type === 'manage') UI.manage.draw(ctx, o, prof);
      else if (o.type === 'smith') UI.smith.draw(ctx, o, prof);
      else if (o.type === 'vault') UI.vault.draw(ctx, o, prof);
      else if (o.type === 'pause') UI.pause.draw(ctx);
      else if (o.type === 'settings') UI.settings.draw(ctx);
      else if (o.type === 'confirm') UI.confirm.draw(ctx, o);
      else if (o.type === 'choice') UI.choice.draw(ctx, o);
    }
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

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    toastT -= dt;
    Input.poll();
    update(dt);
    Input.endFrame();
    draw();
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
fit();
Input.attachMouse(canvas);
Game.init();
requestAnimationFrame(Game.frame);
