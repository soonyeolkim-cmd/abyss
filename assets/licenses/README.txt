심연속으로 — 외부 에셋 출처와 라이선스 근거
==========================================
게임에 들어간 외부 그림 · 음악 · 효과음은 모두 CC0(Creative Commons Zero, 퍼블릭 도메인 기증)이다.
CC0 = 상업적 사용 · 고쳐 쓰기 · 다시 배포 모두 허락, 출처 표기 의무 없음. https://creativecommons.org/publicdomain/zero/1.0/
아래 '근거'는 2026-10-25 에 받으면서 확인한 것이다. 압축 안에 라이선스 글이 들어 있던 것은 이 폴더에 그대로 복사해 두었다.

All third-party art, music and sound effects in this game are CC0 (public domain dedication).
Credits (not required by CC0, given with thanks):
  Art:   16x16 DungeonTileset II by 0x72 (Robert)
  Music: Juhani Junkala (SubspaceAudio)
  Sound effects: Kenney (kenney.nl), JaggedStone, Ogrebane


1. 그림
------
- 16x16 DungeonTileset II v1.7 — 0x72 (Robert)
  출처: https://0x72.itch.io/dungeontileset-ii
  근거: 배포 페이지에 CC0 로 공개(받은 압축의 README 에는 라이선스 글이 없음).
  게임 안: assets/dt/atlas.png 와 그것을 고쳐 만든 assets/dt/*.png


2. 음악 — Juhani Junkala (OpenGameArt 계정 SubspaceAudio, 작곡가 홈페이지 https://juhanijunkala.com/)
------
| 받은 것 | 출처 | 근거 |
| JRPG Music Pack #1 [Exploration] | https://opengameart.org/content/jrpg-pack-1-exploration | 페이지 License(s): CC0 + 압축 안 INFO.txt → juhani-junkala-jrpg-pack-1.txt |
| JRPG Music Pack #2 [Towns]       | https://opengameart.org/content/jrpg-pack-2-towns       | 페이지 CC0 + INFO.txt → juhani-junkala-jrpg-pack-2.txt |
| JRPG Music Pack #3 [Evil]        | https://opengameart.org/content/jrpg-pack-3-evil        | 페이지 CC0 + INFO.txt → juhani-junkala-jrpg-pack-3.txt |
| JRPG Music Pack #4 [Calm]        | https://opengameart.org/content/jrpg-pack-4-calm        | 페이지 CC0 + INFO.txt → juhani-junkala-jrpg-pack-4.txt |
| JRPG Music Pack #5 [Action]      | https://opengameart.org/content/jrpg-pack-5-action      | 페이지 CC0 + INFO.txt → juhani-junkala-jrpg-pack-5.txt |
| Epic Boss Battle [Seamlessly Looping] | https://opengameart.org/content/boss-battle-music  | 페이지 License(s): CC0 (wav 하나라 글 파일 없음) |
| JRPG Theme [Loop Ready]          | https://opengameart.org/content/jrpg-trailer-theme      | 페이지 License(s): CC0 (ogg 하나라 글 파일 없음) |
INFO.txt 에 작곡가가 직접: "These music tracks have been released under CC0 creative commons license. You can do anything you want with these tunes."

게임 안: assets/music/*.mp3 (96kbps 로 바꾸고 크기만 맞춤)
  title = JRPG Theme · belloc = Where Time Stands Still · silvane = Bazaar · chapel = Whispers From Beyond · swamp = Witch's Lair ·
  crypt = Catacombs · ice = Tha'el Mines · fort = Military Base · hell = Apocalypse · plague = Sneaking Around · order = Army Approaching ·
  temple = Encounter With The Witches · abyss = Ancient Evil Awakens · boss = Preparing For Battle · lord = Epic Boss Battle ·
  ending = A Place I Call Home · trueEnding = Innocence


3. 효과음
------
| 받은 것 | 만든 사람 | 출처 | 근거 |
| Impact Sounds (130)    | Kenney     | https://kenney.nl/assets/impact-sounds    | 압축 안 License.txt "Creative Commons Zero, CC0" → kenney-impact-sounds.txt |
| RPG Audio (50)         | Kenney     | https://kenney.nl/assets/rpg-audio        | 압축 안 License.txt → kenney-rpg-audio.txt |
| Interface Sounds (100) | Kenney     | https://kenney.nl/assets/interface-sounds | 압축 안 License.txt → kenney-interface-sounds.txt |
| Magic Spell SFX (7)    | JaggedStone | https://opengameart.org/content/magic-spell-sfx | 페이지 License(s): CC0 (ogg 파일만, 글 파일 없음) |
| Monster Sound Pack, Volume 1 (파일 이름 monster-sounds-volume-2.zip) | Ogrebane | https://opengameart.org/node/4017 | 페이지 License(s): CC0 (wav 파일만, 글 파일 없음) |

게임 안: js/sounds.js (고른 소리를 64kbps mp3 로 바꿔 글자(base64)로 넣음)
  hit · crit · kill · hurt · anvil · bell · glass · plank = Kenney Impact Sounds
  coins · leather · dropItem · latch · creak · doorOpen · cloth = Kenney RPG Audio
  uiMove · uiOk · uiBack · uiDeny = Kenney Interface Sounds
  cast · spell = JaggedStone Magic Spell SFX
  growl · grunt = Ogrebane Monster Sound Pack
나머지 효과음은 파일 없이 코드로 만든 소리(js/sfx.js).


4. 게임에 안 들어간 도구
------
- mp3 바꾸기에 쓴 lamejs(LGPL)는 만드는 사람 컴퓨터의 시험 도구에만 있고 게임 파일에는 들어 있지 않다.
