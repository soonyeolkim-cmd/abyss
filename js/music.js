// 배경음악(2026-10-25 사용자: 음악 + 효과음, 무료 음원 파일). 곡 = Juhani Junkala JRPG 음악 묶음(CC0, 메모/credits.md) → assets/music/<이름>.mp3
// <audio> 두 개를 번갈아 써서 곡을 바꿀 때 천천히 겹쳐 바꾼다(FADE 초). <audio src> 라 file:// 에서도 된다. 곡은 그 장면에 갈 때 불러온다.
// 브라우저는 사용자가 누르기 전에는 소리를 못 내서, 첫 누름 때 두 개를 한 번씩 틀어 열어 둔다(아이폰은 <audio> 마다 한 번 필요).
// 크기 = 설정 '음악 크기'(0 ~ 10). 아이폰은 <audio> 크기를 못 바꿔서(늘 최대) 0 = 멈춤만 된다.
// 어느 곡: Game 이 frame 마다 Music.play(이름) — 장면 · 던전 · 보스 · 엔딩(game.js musicFor).
const Music = (() => {
  const FADE = 1.2, BASE = 0.6;  // 겹쳐 바꾸는 시간 · 최대 크기(효과음보다 조금 작게)
  const decks = [new Audio(), new Audio()];
  decks.forEach(a => { a.loop = true; a.preload = 'auto'; a.volume = 0; a.name = null; a.k = 0; });
  let want = null, unlocked = false;
  const level = () => (Input.settings.sound === false ? 0 : (Input.settings.music ?? 6) / 10);
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    for (const a of decks) {
      if (a.name) continue;
      a.src = 'assets/music/title.mp3'; a.volume = 0;
      const p = a.play(); if (p && p.then) p.then(() => { if (!a.name) a.pause(); }, () => { unlocked = false; });
    }
  }
  ['keydown', 'touchend', 'pointerup', 'click'].forEach(e => window.addEventListener(e, unlock, true));
  // 이 곡을 틀어 달라(같은 곡이면 그대로). null = 조용히
  function play(name) { want = name; }
  function update(dt) {
    const lv = level();
    let cur = decks.find(a => a.name === want);
    if (want && !cur && lv > 0) {  // 새 곡: 소리가 작은 쪽 자리에서
      cur = decks[0].k <= decks[1].k ? decks[0] : decks[1];
      cur.name = want; cur.src = 'assets/music/' + want + '.mp3'; cur.k = 0; cur.volume = 0;
      try { cur.currentTime = 0; } catch (e) { /* 아직 안 불러옴 */ }
    }
    for (const a of decks) {
      const on = a === cur && lv > 0;
      a.k = Math.max(0, Math.min(1, a.k + (on ? dt : -dt) / FADE));
      try { a.volume = Math.max(0, Math.min(1, a.k * a.k * BASE * lv)); } catch (e) { /* 아이폰: 크기 못 바꿈 */ }
      if (on && a.paused && unlocked) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
      if (!on && a.k <= 0 && a.name) { a.pause(); a.name = null; }
    }
  }
  // 창을 숨기면(다른 앱으로) 멈추고, 돌아오면 다시
  document.addEventListener('visibilitychange', () => { for (const a of decks) if (document.hidden) a.pause(); });
  return { play, update, get now() { return want; }, decks };  // decks = 시험용(소리 끄고 재생 확인)
})();
