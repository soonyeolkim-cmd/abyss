// 폰에서 열기 돕기(2026-10-25 사용자: 카톡으로 주소를 보내면 카톡 안 브라우저로 열리고, 크롬에서 홈 화면에 설치하는 게 어렵다).
// ① 카톡 안 브라우저(UA 에 KAKAOTALK)면 바깥 브라우저로 넘긴다: 안드로이드 = 크롬(intent 주소), 안 되면 카톡의 '바깥 브라우저로 열기'(kakaotalk://web/openExternal),
//    아이폰 = 카톡의 바깥 브라우저 열기(사파리). 그래도 남아 있으면 그림 안내(오른쪽 위 점 세 개 → 다른 브라우저로 열기)를 띄운다. 카톡 안 저장은 크롬으로 안 넘어가서.
// ② 크롬이 '설치할 수 있다'(beforeinstallprompt)고 알려 주면 시작 화면 · 캐릭터 선택에 [홈 화면에 설치] 버튼. 이미 설치했거나 홈 화면 앱으로 열면 안 보임.
(function () {
  var ua = navigator.userAgent || '', web = /^https?:/.test(location.protocol);
  var isKakao = /KAKAOTALK/i.test(ua), isAndroid = /Android/i.test(ua);

  function note(html) {  // 화면 위 안내 상자(게임 그림 위에)
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;max-width:86vw;padding:22px 24px;border:2px solid #ffd36a;border-radius:14px;' +
      'background:rgba(16,10,22,0.96);color:#f0e8dc;font:bold 17px/1.6 "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.6)';
    d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  }

  if (web && isKakao) {
    var url = location.href, ext = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    if (isAndroid) {
      location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
      setTimeout(function () { if (!document.hidden) location.href = ext; }, 1200);  // 크롬이 없거나 막히면 기본 브라우저로
    } else location.href = ext;
    setTimeout(function () {  // 그래도 카톡 안이면 손으로 옮기는 법
      if (document.hidden) return;
      var add = function () {
        note('카톡 안에서는 저장이 크롬으로 안 넘어가요<br><span style="color:#ffd36a">크롬(Chrome)으로 열어 주세요</span><br><br>' +
          (isAndroid ? '오른쪽 위 <span style="color:#ff6a5a">점 세 개 버튼</span> → <span style="color:#ff6a5a">다른 브라우저로 열기</span> → Chrome'
                     : '오른쪽 아래 <span style="color:#ff6a5a">공유 버튼</span> → <span style="color:#ff6a5a">Safari로 열기</span>'));
      };
      if (document.body) add(); else addEventListener('DOMContentLoaded', add);
    }, 2600);
  }

  // ② 홈 화면에 설치 버튼
  var installed = matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var ask = null, btn = null;
  addEventListener('beforeinstallprompt', function (e) {
    if (installed) return;
    e.preventDefault(); ask = e;  // 크롬 기본 알림 대신 우리 버튼으로
    if (btn) return;
    btn = document.createElement('button');
    btn.textContent = '📲 홈 화면에 설치';
    // 아래 가운데(2026-10-25: 오른쪽 위는 폰 메뉴 ◀ 버튼 자리)
    btn.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:40;padding:10px 18px;border:2px solid #ffd36a;border-radius:24px;background:rgba(26,16,34,0.92);color:#ffd36a;' +
      'font:bold 16px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5);display:none';
    btn.onclick = function () {
      if (!ask) return;
      ask.prompt();
      ask.userChoice.then(function (r) { if (r && r.outcome === 'accepted') { ask = null; btn.style.display = 'none'; } });
    };
    document.body.appendChild(btn);
  });
  addEventListener('appinstalled', function () { ask = null; if (btn) btn.style.display = 'none'; });
  // 시작 화면 · 캐릭터 선택에서만 보이게(게임 중에는 숨김)
  setInterval(function () {
    if (!btn) return;
    var s = typeof Game !== 'undefined' && Game.scene;
    btn.style.display = ask && (s === 'splash' || s === 'title') && !(Game.overlays && Game.overlays.length) ? 'block' : 'none';
  }, 300);
})();
