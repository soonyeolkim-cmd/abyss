// 이야기(2026-10-25 사용자: 봉인의 숲처럼 오프닝 · 스토리. 마물의 습격으로 살아남은 사람들이 지하 도시 벨록에 모였다).
// 대사 = [화자, 글]. 화자: narr 내레이션(검은 화면 가운데 글) · hero 나(주인공 노아 — 2026-10-25 사용자: 검사 · 마법사 모두 같은 사람, 예전엔 이름 = 직업) · kael 파수꾼 카엘 · boss 그 던전 보스.
// 장면마다 한 번만(prof.story 에 본 것을 적는다). 던전: start 처음 들어갈 때 · boss 보스방 · down 보스를 쓰러뜨린 뒤 · town 그 뒤 마을로 돌아왔을 때.
const SPEAKERS = {
  narr: { name: '', color: '#c8b8a0' },
  hero: { name: '노아', color: '#9cc4ff' },
  kael: { name: '파수꾼 카엘', color: '#ffd36a', bg: '#2a2418' },  // 초상 = 따로 찍은 도트(kaelFace) — 0x72 몸은 모두 몹 · 우리 캐릭터와 겹쳐서(2026-10-25 사용자)
  boss: { name: null, color: '#ff7a5a', bg: '#2a1414' },
  // 마을 NPC(2026-10-25) — 초상 = 그 몸(sprite) 가슴 위로
  miner: { name: '늙은 광부 오르반', color: '#e8c040', bg: '#2a2414', sprite: 'miner' },
  smith: { name: '대장장이 브론', color: '#ff9a5a', bg: '#2a1a12', sprite: 'dwarf_f', dy: -22 },  // 드워프는 키가 작아 얼굴이 원 아래로 → 위로
  shop: { name: '상인 엘린', color: '#8aff9a', bg: '#142a1a', sprite: 'elf_m' },
  jewel: { name: '세공사 미라', color: '#7dd3ff', bg: '#141e2a', sprite: 'wizzard_f' },
  gambler: { name: '도박꾼 단지', color: '#e8a050', bg: '#2a1a24', sprite: 'gambler' },
};

// 마을 NPC 대사(2026-10-25 사용자: 카엘이 마을에 · 지하 도시이고 바깥은 위험하다는 사람)
// 카엘: 말 걸 때마다 인사 하나 + 조언 하나(다음 던전 안내 포함). 광부: 처음엔 지하 도시 · 바깥 이야기, 그다음부터는 한마디씩
const NPC_TALK = {
  kaelHello: [
    '왔나. 갱도 쪽은 내가 지키고 있다. 넌 네 길에 집중해라.',
    '또 내려갈 셈인가. 좋다. 살아서 돌아오기만 해라.',
    '이 도시 사람들은 네가 문을 닫아 주길 기다리고 있다.',
  ],
  kaelTips: [
    '대장장이 브론에게 주문서를 가져가면 장비를 벼려 준다. 실패해도 장비는 멀쩡하니 겁낼 것 없다.',
    '속성석은 같은 크기 셋을 모아 세공사 미라에게 가져가라. 더 큰 돌 하나로 합쳐 준다.',
    '혼자 벅차면 동료와 함께 가라. 쓰러져도 동료가 일으켜 줄 거다.',
    '낮은 던전에서는 이름난 장비가 더 잘 나온다. 창고를 채우고 싶다면 기억해 둬라.',
    '심연에 가까워질수록 마물이 거세진다. 장비를 갖추고 가라.',
  ],
  minerFirst: [
    ['miner', '허허, 처음 보는 얼굴이구먼. 여긴 지하 도시 벨록이라네. 옛날 우리 광부들이 파 들어간 곳이지.'],
    ['miner', '그날 밤 땅이 갈라지고 마물이 쏟아졌지. 살아남은 사람들은 모두 이 아래로 달아나 왔다네.'],
    ['miner', '바깥? 꿈도 꾸지 말게. 위로 난 갱도는 우리가 스스로 무너뜨렸어. 그 너머는 마물 천지야.'],
    ['miner', '저기 구멍 보이나? 그게 무너뜨린 옛 갱도 입구라네. 가끔 저 너머에서 긁는 소리가 들려…'],
    ['miner', '땅 위로 나가는 길은 왕의 갱도 하나뿐인데, 그 끝을 심연의 문이 막고 있다지. 자세한 건 카엘에게 물어보게.'],
  ],
  // 기존 NPC 설명(2026-10-25 사용자: 강화 · 속성석 · 보석 어떻게 올리는지). 수치는 data.js 와 같게(ENCHANT_RATE · BLESS_BONUS · COMBINE_COSTS · 가게 값)
  smith: () => [
    ['smith', '어서 와! 장비를 단단하게 하고 싶으면 강화 주문서를 가져와. 던전의 몹 · 상자 · 보스가 가끔 떨어뜨리지.'],
    ['smith', '주문서를 바를 때마다 장비가 +1씩 올라. 무기 · 목걸이 · 반지는 공격력, 투구 · 갑옷 · 장갑 · 신발은 방어력이 오르지.'],
    ['smith', '+0에서 +1은 ' + ENCHANT_RATE[0] + '%로 쉽지만, 올라갈수록 어려워져서 +9에서 +10은 ' + ENCHANT_RATE[ENCHANT_MAX - 1] + '%야. 최고는 +' + ENCHANT_MAX + '!'],
    ['smith', '실패해도 걱정 마. 주문서만 사라지고 장비는 그대로니까. 축복받은 주문서는 성공률이 ' + BLESS_BONUS + '% 더 높아.'],
    ['smith', '새 장비로 갈아탈 땐 계승 주문서로 강화를 옮겨 줄게. 같은 부위끼리만 돼. 계승 주문서는 상인 엘린이 팔고, 던전에서도 가끔 나와.'],
    ['smith', '무기 · 목걸이 · 반지를 모두 +' + ENCHANT_MAX + ' 하면 공격력이 네 배쯤 된다고! 안 쓰는 장비는 나한테 팔아도 돼.'],
  ],
  jewel: () => {
    const sn = clsOf(Game.prof).slotNames, names = STONE_SLOTS.map(k => sn[k]).join(' · ');
    return [
      ['jewel', '속성석과 보석 이야기를 해 줄게. 던전에서는 조각 · 작은 · 보통 크기까지만 나와.'],
      ['jewel', '같은 종류 같은 크기 세 개를 가져오면 한 단계 큰 돌로 합쳐 줄게. 조각 → 작은 → 보통 → 큰 → 완전한 → 전설 → 태초, 일곱 단계야.'],
      ['jewel', '합치는 데는 골드가 들어. 조각을 합칠 땐 ' + COMBINE_COSTS[0] + 'G, 클수록 비싸져서 전설을 태초로 만들 땐 ' + COMBINE_COSTS[COMBINE_COSTS.length - 1] + 'G야.'],
      ['jewel', '속성석은 기술 칸 네 곳(' + names + ')에 끼워. 보통부터 그 기술에 능력이 붙고, 완전한부터 속성 패시브, 전설부터 패시브가 하나 더 열려.'],
      ['jewel', '네 칸을 모두 보통 이상으로 채우면 세트 효과가 생겨. 네 개가 같은 속성이면 공명, 두 속성이 두 개씩이면 듀오!'],
      ['jewel', '보석은 장비에 끼우는 돌이야. 매직 등급 이상 장비마다 한 칸. 공격 보석은 무기 · 목걸이 · 반지, 방어 보석은 투구 · 갑옷 · 장갑 · 신발에.'],
      ['jewel', '보석도 세 개를 모아 합치면 커져. 아, 그리고 무기를 안 끼면 속성석이 잠드니까 꼭 무기를 들고 다녀!'],
    ];
  },
  shop: () => [
    ['shop', '어서 오세요! 체력 물약은 하나에 ' + POTION_PRICE + 'G예요. 수량 정하기 버튼을 누르면 한 번에 가득 살 수도 있어요.'],
    ['shop', '조각 속성석과 조각 보석도 팔아요. 하나에 ' + SHARD_PRICE + 'G. 세 개를 모아 미라에게 가져가면 합쳐 줘요.'],
    ['shop', '계승 주문서는 ' + INHERIT_PRICE + 'G예요. 강화한 장비를 새 장비로 바꿀 때 브론에게 가져가세요.'],
    ['shop', '남는 조각 속성석 · 보석은 하나에 ' + SHARD_SELL + 'G에 사 드려요. 장비는 장비 팔기에서 팔면 되고요.'],
    ['shop', '가방이 가득 차면, 끼고 있는 것보다 약한 일반 · 매직 장비는 주울 때 저절로 골드가 돼요. 짐 걱정은 덜어도 돼요!'],
    ['shop', '장비 항아리요? 그건 저기 항아리 쓴 단지 씨한테 가 보세요. 좀… 별난 사람이에요.'],
  ],
  gambler: () => [
    ['gambler', '크흐흐, 항아리 속이 궁금한가? 이 머리 말이냐? 운이 달아나지 말라고 뚜껑을 덮어 둔 거다.'],
    ['gambler', '골라 봐라. 무기, 투구, 갑옷, 장갑, 신발, 목걸이, 반지. 고른 부위 항아리에 네 레벨에 맞는 장비가 하나 들어 있지.'],
    ['gambler', '값은 네 레벨 따라 오른다. 지금 너라면 ' + JAR.price(Game.prof.lv) + 'G. 깨 보기 전엔 아무도 모른다는 게 묘미지.'],
    ['gambler', '대부분은 일반이나 매직이고, 레어는 ' + Math.round(JAR.rare * 100) + '%쯤. 유니크는… ' + Math.round(JAR.uniq * 100) + '%. 그래도 꿈은 공짜 아니냐, 크흐흐.'],
    ['gambler', '가방은 비워 두고 와라. 빈칸이 없으면 항아리를 안 판다.'],
  ],
  minerPool: [
    '바깥 공기를 마셔 본 게 언제인지… 실베인의 하늘이 그립구먼.',
    '저 옛 갱도 입구엔 가까이 가지 말게. 무너진 돌 너머는 마물 소굴이야.',
    '곡괭이 대신 마물과 씨름하는 젊은이라… 부디 몸조심하게.',  // 무기 이야기는 뺌(2026-10-25 사용자: 검사 · 마법사 모두 어색하지 않게)
    '여기 벨록은 땅 위보다 안전하다네. 적어도 아직까지는 말이지.',
    '내가 젊었을 땐 이 갱도에서 은을 캤지. 지금은 목숨을 캐고 있구먼, 허허.',
  ],
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
    ['kael', '지하 도시 벨록. 땅 위에서 도망쳐 온 사람들의 마지막 피난처다. 나는 이곳을 지키는 파수꾼 카엘. 너는?'],
    ['hero', '…노아예요.'],
    ['kael', '위로 가는 갱도는 그날 밤 우리 손으로 무너뜨렸다. 등불 기름도 식량도 오래 버티지 못해.'],
    ['hero', '다른 길은 없나요?'],
    ['kael', '하나 있다. 옛 왕국이 판 왕의 갱도. 이 광산 가장 먼 끝에서 땅 위 광산 도시 실베인까지 곧장 이어진 길이지.'],
    ['kael', '하지만 그 길 끝에 심연의 문이 있다. 마물은 모두 거기서 쏟아져 나온다. 문이 열려 있는 한 아무도 갱도에 닿지 못해.'],
    ['hero', '그럼 거기까지 길을 뚫고, 문을 닫으면 되겠군요.'],
    ['kael', '…그 눈빛을 보니 말려도 소용없겠군. 첫 길목은 도시 바로 옆 무너진 성당이다. 아래쪽 가운데 계단이 던전 입구다.'],
    ['kael', '대장장이 브론, 상인 엘린, 세공사 미라도 널 도와줄 거다. 살아서 돌아와라.'],
  ],
  ending: [
    ['narr', '심연의 문이 닫히고, 땅 울림이 멎었다.'],
    ['narr', '왕의 갱도를 막던 어둠이 걷히자, 아득히 높은 곳에서 한 줄기 빛이 내려왔다.'],
    ['kael', '길이 열렸다. 저 위 실베인이 어떻게 됐는지는 아무도 모른다. 아직 누군가 버티고 있을지도.'],
    ['kael', '누군가 먼저 올라가 길을 열어야 한다. …충분히 강해지면, 그때 가라. 벨록 사람들은 네 뒤를 따르겠다.'],
    ['miner', '허허, 내 광차가 드디어 쓸모가 생겼구먼! 왕의 갱도 철길만 살아 있으면 땅 위까지 단숨이지. 준비되면 수레에 올라타게.'],  // 2026-10-25 광차로 실베인
    ['kael', '…그런데 이상하군. 문은 닫혔는데, 땅 밑 어딘가가 아직 꿈틀댄다. 봉인을 지키던 놈들이 더 깊은 어둠 속에서 무언가 알고 있을지도 모르지.'],  // 진엔딩 힌트(영웅)
  ],
  // 진엔딩(2026-10-25 사용자: 심연의 문 영웅 클리어) — 영웅에서 군주를 쓰러뜨리고 마을로 돌아오면
  trueEnding: [
    ['narr', '가장 깊은 어둠 속에서 군주가 마지막 숨을 거두자, 심연의 문 가장 깊은 곳에서 얼음과 불과 피의 빛이 하나로 엉켰다.'],
    ['narr', '세 봉인이 문의 심장에 스며들고, 끝없이 울리던 땅의 숨소리가 마침내 멎었다.'],
    ['kael', '…느껴지나? 땅이 조용하다. 몇 년 만인지 모르겠군.'],
    ['jewel', '봉인석에서 금이 사라졌어. 이번엔 진짜야. 문은 다시는 열리지 않아.'],
    ['miner', '허허, 이제 갱도엔 광차 소리만 남겠구먼. 새 철길이나 깔아 볼까!'],
    ['narr', '그날 아침, 실베인의 하늘 위로 오랜만에 새벽이 밝아 왔다.'],
    ['kael', '고맙다. 벨록도, 실베인도 네 이름을 잊지 않을 거다.'],
    ['kael', '…다만 문 아래로 갈라진 틈은 끝이 없다고 하더군. 그 틈으로 내려가는 길이 던전 입구 맨 아래에 열렸다. 밑바닥이 궁금하면 가 봐라.'],  // 끝없는 심연(진엔딩 보상)
    ['narr', '— 심연속으로 · 진엔딩 —'],
  ],
  // 진엔딩 단서(봉인 셋을 지키던 보스를 영웅으로 쓰러뜨리면 한 번씩) · 심연 영웅 군주의 마지막 말
  clues: {
    ice: [['boss', '…얼음 봉인은… 문만 얼릴 뿐… 군주의 심장은… 얼지 않는다…'], ['hero', '군주의 심장? 문을 닫아도 끝이 아니었던 건가.']],
    fort: [['boss', '크크… 피의 봉인은… 군주의 피와 이어져 있다… 군주가 숨 쉬는 한… 문은 언젠가 다시 열린다…'], ['hero', '군주를 완전히 쓰러뜨려야 한다는 거군.']],
    hell: [['boss', '…불은 꺼지지 않아… 가장 깊은 어둠 속에서… 진짜 군주가… 기다린다…'], ['hero', '가장 깊은 어둠… 심연의 문, 가장 험한 길(영웅)에서 끝을 내야 해.']],
    abyss: [['boss', '…이 어둠 속에서까지… 나를… 이번엔… 문의 심장까지… 닫히는구나…'], ['hero', '얼음, 불, 피… 세 봉인의 빛이 문 깊은 곳으로 스며든다.']],
  },
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
    if (kind !== 'opening' && World.partySeed) return;  // 파티 던전에서는 대화창 없음(안 본 장면은 혼자 할 때 나온다)
    if (kind === 'opening') { once('opening', [...STORY.opening, ...STORY.welcome]); return; }
    const S = STORY.dungeons[def.id];
    if (!S) return;
    const boss = ENEMIES[def.boss];
    if (kind === 'down') {
      // 처음 깬 대사 + 영웅이면 진엔딩 단서(봉인 셋 · 심연) — 둘 다 한 번씩, 이어서 한 창에
      const prof = Game.prof, st = prof.story || (prof.story = {}), lines = [];
      if (S.down && !st[def.id + ':down']) { st[def.id + ':down'] = 1; st.pending = def.id; lines.push(...S.down); }
      const clue = RUN.diff >= 2 && STORY.clues[def.id];
      if (clue && !st[def.id + ':clue']) { st[def.id + ':clue'] = 1; lines.push(...clue); }
      if (lines.length) { Save.write(prof); play(lines, boss); }
      return;
    }
    once(def.id + ':' + kind, S[kind], boss);
  }
  // 마을로 돌아오면: 보스를 쓰러뜨린 뒤 카엘의 한마디(마지막 던전이면 엔딩까지), 그리고 진엔딩.
  // 엔딩 · 진엔딩은 열리는 것(광차 · 진엔딩)이 걸려 있어서 파티로만 깨 대사를 못 봤어도 깬 기록(clearedDiff)으로 꼭 보여 준다
  function townArrive() {
    const prof = Game.prof, st = prof.story || (prof.story = {}), lines = [];
    if (st.pending) {
      const id = st.pending, S = STORY.dungeons[id];
      delete st.pending;
      if (S && !st[id + ':town']) { st[id + ':town'] = 1; lines.push(...(id === 'abyss' ? [...S.town, ...STORY.ending] : S.town)); }
    }
    if (diffCleared(prof, 'abyss') >= 0 && !st['abyss:town']) { st['abyss:town'] = 1; lines.push(...STORY.dungeons.abyss.town, ...STORY.ending); }
    if (diffCleared(prof, 'abyss') >= 2 && !st.trueEnding) { st.trueEnding = 1; lines.push(...STORY.trueEnding); }
    if (lines.length) { Save.write(prof); play(lines); }
  }
  // 마을 메뉴 '이야기 다시 보기' · '진엔딩 다시 보기'
  function replay() { play([...STORY.opening, ...STORY.welcome]); }
  function replayTrue() { play([...STORY.trueEnding]); }
  // 마을 NPC 말 걸기(town.js)
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function talkNpc(id) {
    if (id === 'smith' || id === 'shop' || id === 'jewel' || id === 'gambler') { play(NPC_TALK[id]()); return; }  // 기존 NPC: 하는 일 설명
    if (id === 'cartLocked') { play([['miner', '그 광차 말인가? 왕의 갱도 끝은 아직 심연의 문이 막고 있다네. 문부터 닫고 오게, 그럼 땅 위까지 태워 주지. 허허.']]); return; }  // 엔딩 전 광차
    if (id === 'miner') { if (!once('npc:miner', NPC_TALK.minerFirst)) play([['miner', pick(NPC_TALK.minerPool)]]); return; }
    if (id === 'kael') {
      const prof = Game.prof, next = DUNGEONS.find(d => !(prof.cleared || {})[d.id]);
      const st = prof.story || {}, hint = st['abyss:town'] && !st.trueEnding ? ['얼음 · 피 · 불의 봉인을 지키던 놈들… 영웅의 길에서 다시 쓰러뜨리면 무언가 털어놓을지도 모른다. 그리고 문 앞, 가장 험한 길에서 끝을 내라.'] : [];  // 진엔딩 힌트
      const tips = [...NPC_TALK.kaelTips, ...hint, ...hint, next ?'다음 목적지는 ' + next.name + ', 입장 레벨은 Lv.' + next.lv + '. 준비가 됐다면 입구로 가라.' : '심연의 문은 닫혔다. 그래도 왕의 갱도엔 아직 마물이 남아 있다. 방심하지 마라.'];
      play([['kael', pick(NPC_TALK.kaelHello)], ['kael', pick(tips)]]);
    }
  }

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
    text = fmtGold(text);  // 재기 전에 골드 쉼표를 넣어 둔다(Gfx.text 와 같은 너비)
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
    else if (sp.sprite) Gfx.spr(ctx, Gfx.anim(sp.sprite + '_idle_anim', time, 6), cx - 6, cy + r * 1.2 + (sp.dy || 0), { scale: 5 });  // 마을 NPC: 그 몸 가슴 위로
    else if (who === 'boss' && o.boss) {
      const f = FRAMES[idleAnim(o.boss) + '_f0'], small = f[2] <= 16;  // 작은 몸을 키운 거인 보스는 더 크게, 머리끝을 원 위쪽에 맞춤
      const sc = small ? 6.4 : 3.8, pad = { knight_f: 10, lizard_m: 10 }[o.boss.sprite] || 0;  // 기사 · 도마뱀 그림은 위쪽이 비어 있다
      const by = small ? cy - r * 0.95 + (f[3] - pad) * sc : cy + r * 1.15;
      Gfx.spr(ctx, Gfx.anim(idleAnim(o.boss), time, 6), cx, by, { scale: sc, tint: o.boss.tint, tintAlpha: o.boss.tintAlpha });
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
      const name = who === 'boss' ? (o.boss ? o.boss.name : '???') : sp.name;
      T_(ctx, name, bx + 146, by + 34, 18, sp.color);
      const lines = wrap(ctx, text, bw - 170, 17);
      o.total = lines.reduce((n, l) => n + l.length, 0);
      typed(ctx, lines, bx + 146, by + 66, 17, 26, '#f0e8dc', o.chars);
    }
    if (o.chars >= o.total && Math.sin(time * 6) > 0) T_(ctx, '▼', who === 'narr' ? 480 : 832, who === 'narr' ? 430 : 506, 14, sp.color, 'center');
    if (!Input.touchMode()) T_(ctx, '넘기기 ' + L('ok') + ' · 건너뛰기 ' + L('back'), 950, 532, 11, '#6a6068', 'right');
  }

  return { trigger, townArrive, replay, replayTrue, talkNpc, update, draw };
})();
