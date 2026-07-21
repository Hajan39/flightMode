# Flight Mode: App Status & Changelog

Toto je hlavni source-of-truth dokument pro to, jak aplikace vypada ted.
Pouzivej ho misto starsich roztristenych status dokumentu.

## 1. Current Status (As-Is)

### Produktovy fokus

Flight Mode je contextual travel assistant + offline entertainment system pro cestujici v letadle.

Aktualne je nejsilnejsi implementovana vrstva:

- offline mini hry
- relax a ambient audio
- static travel content
- jednoduchy flight progress tracker
- local profile stats a achievements

### Co aplikace umi ted

- onboarding s vyberem jazyka
- tabs: Home, Games, Explore, Relax
- profile + achievements + local stats
- settings kompaktne seskupene na app preferences, article sync a support
- 31 offline miniher s centralni registry v `data/games.ts` (nejnovejsi: Cabin Lights, Word Guess, Sudoku, Snake)
- 44 clanku v `data/content.json`
- content lokalizace kompletni pro `en/cs/de`
- UI translation keys jsou kompletni napric vsemi podporovanymi jazyky (`en/cs/de/es/fr/hi/it/ja/ko/pl/pt/zh`)
- games search + category filtry + intent filtry pro quick, play together a longer/deep hry
- home dashboard s daily challenge, play together a flight utility kartou; navic flight-aware sekce "Games for your flight" (hry podle zbyvajiciho casu letu), "Jump back in" (naposledy hrane hry) a CTA na pre-flight readiness screen
- pre-flight readiness screen (modal): potvrzeni offline dostupnosti (hry/clanky/relax s pocty), stav site a pri online rucni "Download latest content"
- relax: breathing + ambient audio + sleep timer
- PostHog SDK foundation pro anonymni produktovou analytiku, pokud je nakonfigurovany `EXPO_PUBLIC_POSTHOG_KEY`
- Expo Network foundation pro online/offline stav v root bootstrapu
- article sync foundation: remote JSON/Strapi-compatible endpoint pres env, persisted cache, fallback na bundled `data/content.json`
- zakladni eventy: `app_open`, `onboarding_complete`, `flight_added`, `flight_edited`, `game_start`, `game_finish`, `article_open`, `article_finish`, `relax_start`, `relax_finish`, `audio_play`, `audio_stop`, `settings_open`, `profile_open`, `home_action_open`, `home_recommendation_open`, `content_search_changed`, `content_filter_changed`, `content_sort_changed`, `network_status_changed`, `content_sync_start`, `content_sync_success`, `content_sync_failed`
- retention eventy: `second_session_started`, `first_session_completed`, `flight_setup_completed`
- reminder eventy: `reminder_scheduled`, `reminder_permission_denied`, `reminder_opened`
- support funnel eventy: `support_opened`, `support_clicked`, `support_completed`

### Co aplikace ted nema

- auth nebo uzivatelske ucty
- publikovana Strapi article data potvrzena proti realnemu backendu
- custom SQLite analytics event queue
- flight API integraci
- airport detection nebo location permissions
- push/local notifications
- sitovy multiplayer
- serverovou personalizaci
- monetization/premium unlock

### Dulezite implementacni fakty

- Expo Router + Zustand stores
- persistence pres AsyncStorage (`zustand/persist`)
- audio runtime pres `expo-audio`
- PostHog provider je zabaleny v `components/AnalyticsProvider.tsx`
- analytics helper je v `utils/analytics.ts` a payloady nesmi obsahovat osobni data, presnou lokaci ani flight number
- Explore analytics neposila hledany text, jen anonymni stav/delku dotazu a typ interakce
- network state je neperzistovany v `store/useNetworkStore.ts` a inicializovany pres `components/NetworkStatusBootstrap.tsx`
- article sync cache je v `store/useContentStore.ts`, normalizace endpointu v `utils/contentSync.ts`, a app cte clanky pres `hooks/useContentItems.ts`
- Strapi se pouziva pouze jako volitelny zdroj clanku; hry, relax, flight utility, profile, settings a dalsi app data zustavaji lokalni
- article sync endpoint je volitelny pres `EXPO_PUBLIC_STRAPI_CONTENT_URL` nebo `EXPO_PUBLIC_CONTENT_SYNC_URL`; `EXPO_PUBLIC_STRAPI_CONTENT_URL` muze byt Strapi root nebo primo `/api/articles`; bez endpointu app zustava ciste bundled/offline
- app neobsahuje Strapi API token; pro public clanky preferujeme povolit public read endpoint, pripadne pouzit serverovy proxy endpoint, aby se tajny token nikdy neposilal do klienta
- local reminders jsou zapnute pres `expo-notifications`: root bootstrap konfiguruje Android channel a response listener; flight setup planuje reminder relativne k odletu (preferuje 3h pred odletem, fallback 30min pred odletem, jinak +5 min od ulozeni)
- potvrzeny Strapi Article contract pro app sync je `title`, `category`, `body` a `readTime` nebo `read_time`; textova pole mohou byt plain string nebo lokalizovany objekt s aspon `en`
- aktualni Strapi Articles endpoint `https://cheerful-approval-7e0a5ca32d.strapiapp.com/api/articles` vraci `200`, ale zatim `data: []`; sync proto zustava na bundled fallbacku, dokud nebudou publikovane clanky; Strapi overeni neni aktualni hlavni fokus
- content sync respektuje persisted user setting `syncNetworkPolicy`: Wi-Fi only, Wi-Fi + mobile data, nebo off; default je Wi-Fi only
- analytics runtime byl uzivatelsky overeny; analytics opt-out toggle je dostupny v Settings pod sekcí Privacy; default je zapnuto (anonymni, bez osobnich dat)
- vsech 44 bundlovanych clanku v `data/content.json` bylo rozsireno z 56–237 slov na 350–415 slov (EN), ekvivalentne v cestine a nemcine; kazdy clanek ma strukturovane sekce (must-see, jidlo, doprava, prakticke tipy, vylety) pro kvalitatnej offline cteni
- game quality pass zacal prvni kalibraci: `reaction` ma jednotny konec session, `duel-dice` ma prehlednejsi horni score strip a vysledkovou tabuli, `duel-tictactoe` ma volbu 3x3 a rostoucich 5+ piskvorek, `cross-air-radar` dovoluje pred potvrzenim presouvat polozenou flotilu, daily challenge pool preferuje kratke hry, Games tab ma intent discovery se ztlumenou barevnosti a cast metadata byla upravena podle realne delky/obtiznosti; multiplayer metadata uz rozlisuji shared-screen a pass-and-play flow
- PostHog se vypne bez `EXPO_PUBLIC_POSTHOG_KEY` nebo pri `EXPO_PUBLIC_ANALYTICS_ENABLED=false`
- PostHog options pouzivaji anonymous-only nastaveni: `personProfiles: "never"`, `disableGeoip: true`, bez autocapture, surveys, remote config a session replay
- offline-first je zakladni constraint

## 2. Target Architecture

### Mobile app

- Expo + React Native + TypeScript
- Expo Router navigation
- AsyncStorage pro settings, flight info a jednoducha persisted data
- PostHog pro anonymni produktovou analytiku
- budouci SQLite queue pro explicitni event retry model, pokud PostHog SDK persistence nebude stacit pro product needs
- Expo Network pro online/offline stav
- Expo FileSystem pro vetsi stazene content packy a assety
- Expo Location jen jako volitelny opt-in pro airport detection
- Expo Notifications jen pro budouci local notifications

### Backend/content

- Strapi jako planovany zdroj clanku, ne jako zdroj her nebo ostatnich app dat
- version check endpoint pro article updates
- local cache tak, aby app fungovala beze zbytku offline

### Analytics model

- eventy jsou anonymni produktove eventy bez loginu
- eventy nesmi obsahovat jmeno, email, presnou lokaci, flight number ani volny text od uzivatele
- upload probiha jen kdyz je dostupna sit a SDK/backend ho umi dorucit
- offline UX nesmi byt zavisle na uspesnem analytics uploadu

## 3. Roadmap

### Phase 1 (ted)

- dokoncit analytics consent/opt-out UX a payload privacy kontrolu
- udelat game quality pass napric vsemi 19 hrami a rozhodnout `keep/tune/rework/remove`
- zkalibrovat herni obtiznosti, delky session a Games discovery podle realne navratovosti
- navrhnout a pripadne pridat SQLite event queue/retry vrstvu, pokud bude potreba vetsi kontrola nez poskytuje PostHog SDK
- udrzet privacy policy a event payloady v souladu s anonymni analytikou

### Phase 2

- airport detection jako opt-in feature
- smart recommendations bez AI backendu
- destination packs podle cile nebo kontextu letu

### Phase 3

- premium unlock
- affiliate integrace po pristani

### Phase 4

- local notifications
- advanced personalization

## 4. Changelog

## 2026-07-20

- depth iterace: Snake pohybova logika vyextrahovana do `games/snake/logic.ts` (`step` pohyb/rust/kolize, `placeFood` s inject RNG, `opposite`, `getIntervalMs`) + unit testy; destinace 34 → 39 (Lima, Nairobi, Vancouver, Kodan, Kuala Lumpur); suite 252 testu / 12 suites
- depth iterace: Sudoku ciste helpery vyextrahovany do `games/sudoku/logic.ts` (souradnice, isPeer, computeErrors, isSolved, formatTime) + unit testy; test integrity obsahu (44 clanku: unikatni id, kladny readTime, neprazdne en/cs/de); destinace 29 → 34 (Madrid, Stockholm, Dilli, Osaka, Curych); suite 237 testu / 11 suites
- nova hra Word Search (`word-search`, novy zanr): najdi 6 skrytych leteckych slov v 8×8 mrizce (H/V/D, dopredu i pozpatku), vyber tapem prvni + posledni pismeno; achievement "Word Hunter"; cista grid logika v `games/word-search/logic.ts` + unit testy (citelnost umisteni pres seedy, detekce primky); +5 destinaci (29: Berlin, Kjoto, Rio, Ateny, Hanoj); suite 173 testu (celkem 34 her)
- depth iterace (bez nove hry — pokryti zanru je siroke): destinace rozsireny z 19 na 24 (Bali, Marrakech, Buenos Aires, Praha, Toronto); flight-recommendation logika vyextrahovana do `utils/flightRecommendations.ts` + testy; testy `useGameStore` (best/streak/levelStars/reset); AsyncStorage jest mock (`jest.setup.js`) — suite 156 testu
- nova hra Cargo Catch (`cargo-catch`): reflexni — posouvej vozik a chytej padajici naklad (+1), vyhybej se bombam (kazda = zivot); 3 zivoty, 60s wall-clock, ramp obtiznosti; achievement "Cargo Captain" (25); reflex/medium; 12 jazyku (celkem 33 her)
- testy: Word Guess cista logika vyextrahovana do `games/word-guess/logic.ts` + unit testy green/yellow/gray vcetne double-letter, integrita word poolu; opraveno neslovo "GROUN" → "PROPS"
- CI: GitHub Actions workflow (`.github/workflows/ci.yml`) — `tsc --noEmit` + `npm test` na kazdy push a PR
- destinace rozsireny z 14 na 19 (Soul, Kahira, Mexico City, Kapske Mesto, Viden)
- nova hra Sliding Puzzle (`sliding-puzzle`): klasicky 4×4 15-puzzle, garantovane resitelny shuffle, tahy + wall-clock casovac, pauza, countdown; achievement "Slide Master"; brain/medium/5 min; 12 jazyku (celkem 32 her)
- testy: zavedeny Jest (`jest-expo`) + `npm test` a 123 pure-logic/data testu v `__tests__/` — parita klicu vsech 12 jazyku, integrita registru her a achievementu, destinace, validita vsech 15 Sudoku puzzlu (puzzly vyextrahovany do `games/sudoku/puzzles.ts`)
- destinace rozsireny z 8 na 14 (Londyn, Singapur, Istanbul, Sydney, Lisabon, Reykjavik)
- flight ↔ destinace propojeni: flight setup ma nepovinny picker cile (8 destinaci); kdyz je nastaveny, karta na Home je "Tips for {city}" a odkazuje primo na tipy dane destinace (auto-expand pres `focus` param); Flight typ ma nove `destinationId`
- destinace & tipy na letiste (`app/destinations.tsx`, `data/destinations.ts`): prohlizeci obrazovka s praktickymi tipy (doprava z letiste, pohyb po meste, jidlo, penize, etiketa) pro 8 destinaci, dostupna z karty "Where you're headed" na Home; bundled offline obsah (EN), chrome lokalizovany do 12 jazyku
- Home "New to try" radek: hry, ktere uzivatel jeste neotevrel (max 4) — fresh obsah pro kazdy let (lepsi nez denni streak pro narazove pouziti); sledovano v novem `useDiscoveryStore`
- onboarding personalizace: novy krok "What do you enjoy?" pro vyber oblibenych kategorii her (skippable); ovlivnuje razeni doporuceni "Games for your flight"; ulozeno v settings
- per-flight reframe (app je narazova, ne denni): Home i Profil ukazuji "Flights" misto "Day Streak"; Profil ma "Games Tried" misto streak dlazdice; achievementy streak-3/streak-7 prepracovany z dennich streaku na navraty za dalsi lety — "Round Trip" (2. let, klicovy retention moment) a "Seasoned Flyer" (5 letu); `streakDays` zustava ve store, ale uz se nikde nezobrazuje ani nepouziva pro achievementy

- pre-flight readiness screen (`app/preflight.tsx`): modal z Home ("Ready to fly?"), potvrzuje offline dostupnost her/clanku/relaxu s zivymi pocty, ukazuje stav site a pri online nabizi "Download latest content"; 13 klicu × 12 jazyku
- Home: nova sekce "Games for your flight" — doporuci solo hry podle zbyvajiciho casu letu (kratky → rychle, dlouhy → hluboke/hard); bez backendu, z `estimatedTime`/`difficulty`
- Home: nova sekce "Jump back in" — naposledy hrane hry (nejnovejsi prvni, max 4) s nejlepsim skore pro rychle pokracovani; skryta pro nove uzivatele
- polish: lokalizovane a11y labely D-padu (2048, Snake) do 12 jazyku; nove sematicke tokeny `danger`/`dangerSurface`/`dangerBorder` ve vsech tematech, nasazene na wrong-answer plochy (quiz, sky-math, odd-one-out, reaction) a low-time casovace (tap-rush, whack-mole, cabin-call, emoji-find) — drive fixni tmave-cervene hexy spatne citelne na light tematu
- dependency alignment se stability opravami: react/react-dom 19.2.3, typescript 6.0.3, odebran nepouzity `expo-av`; pridana root error boundary + globalni JS error handler + izolace bootstrap komponent; eas.json ma internal-testing submit profil pro pre-launch report
- Sky Defense: oprava umistovani veze na spatnou bunku (souradnice odvozeny z absolutni pozice plochy misto element-relative locationX)

## 2026-07-05

- pridana nova hra Cabin Lights (`cabin-lights`): Lights Out puzzle — klepnutim prepinas svetlo + sousedy, cil zhasnout vse; 5 kol, deska roste 3×3 → 5×5, scramble generovany nahodnymi tapy (vzdy resitelne); skore 100/kolo + bonus za efektivitu tahu; brain/medium/5 min; prelozeno do vsech 12 jazyku
- game quality audit vsech 30 stavajicich her (logika, temata, UX) — opraveny nalezene chyby:
  - Whack-a-Mole: pauza nezastavovala herni cas (wall-clock deadliny se ted posouvaji o delku pauzy)
  - Air Traffic Control a 2048: dvojite volani `updateProgress()` pri soubehu dvou end-game podminek (pridan synchronni guard)
  - Cross Air Radar: hardcoded ceske "sestreleno" ve vsech jazycich → novy lokalizovany klic `arShipDown`
  - Connect 4 a Hangman: male dotykove plochy (18px / 34px) rozsireny pres `hitSlop` na ≥44px bez zmeny layoutu
- fix: `expo-notifications` se v Expo Go uz nenacita (SDK 53+ tam push odstranil) — lazy require + guard, dev/prod buildy beze zmeny
- zbyvajici nalezy auditu (hardcoded barvy mimo theme paletu v ~15 hrach, male klavesy ve word-guess) zapsany do todo-and-improvements.md

- pridany 3 nove hry: Word Guess (Wordle-style, denni vyzva), Sudoku (9×9, 15 hádanek easy/medium/hard), Snake (18×18, D-pad ovladani)
- pridano 5 novych achievementu: Word Solver, Word Master, Sudoku Novice, Sudoku Master, Snake Charmer
- UX: achievement badges na Profile zmenseny na 2 sloupce s popis — driv nescitelne male
- UX: hardcoded barvy (#f0f8ff, #ddd, #666, #999) na Home screen nahrazeny theme tokeny — opraveno v dark a crazy tematech
- UX: prazdny stav v Games je filtrace-aware — pri aktivnich filtrech ukazuje "Zadne hry" a tlacitko "Vycistit filtry"
- UX: day stepper v Flight Edit pouziva Ionicons sipky misto znakoveho textu; sipky se zakazuji na hranicich (dnes / +14 dni)
- UX: na Relax obrazovce je tenky progress bar pod odpocetem sleep timeru
- vsechny nove prekladove klice rozsireny do vsech 12 locale souboru

## 2026-06-17

- redesignovan flight setup formular: datum chips (Dnes / Zítra / +2 dny) + day stepper nahrazuji free-text datum input; hodina/minuta steppery nahrazuji free-text cas input; pridano volitelne pole pro flight number
- flight number se uklada do flight store a zobrazuje se na Home flight karte; neni zahrnuto v analytics payloadech
- zobrazen label lokalni timezone pod time stepperem
- pridana pauza do Quiz a Sky Math her (GamePauseOverlay + GameControls)
- pridan uvitaci card na Home pro noveho uzivatele (0 odehranych her) s CTA na Games tab
- zjednodusena GameRules emoji regex na `/^\p{Extended_Pictographic}/u`
- doplnen `achievement_unlocked` analytics event do `checkAndUnlock()` v `useAchievementStore`
- pridany 4 nove achievementy pro tezke hry: Sky Guardian (100+ v Sky Defense), Sky Commander (500+ v Sky Defense), Tower Operator (150+ v Air Traffic Control), Air Boss (500+ v Air Traffic Control)
- nove achievement preklady ve vsech 12 locale souborech

## 2026-05-08

- doplnen analytics opt-out toggle v Settings pod novou sekcí Privacy; preference je persistovana pres AsyncStorage a funguje pro vsech 12 jazyku; AnalyticsProvider reaktivne zapina/vypina PostHog sink bez nutnosti restartu appky

## 2026-05-06

## 2026-05-13

## 2026-05-15

- do Settings support sekce pridany nenasilny support CTA flow: titul "Bavi te FlightMode?", helper text "Podpor dalsi vyvoj", a akcni polozka "Stan se podporovatelem" (Buy Me a Coffee link)
- doplnen support funnel analytics tracking: `support_opened` pri otevreni Settings, `support_clicked` po kliknuti na support CTA, `support_completed` pri navratu do appky po odchodu na support odkaz

- doplnena retention instrumentation vrstva: `app_open` ted nese `app_open_count` a `is_returning_user`; pri druhem otevreni se posila `second_session_started`
- doplnen `first_session_completed` marker napric hlavnimi offline aktivitami (game finish, article finish, relax finish)
- doplnen `flight_setup_completed` event po ulozeni flight setupu/editace
- pridana local-notification foundation pres `expo-notifications`: Android channel bootstrap, notification handler a tracking `reminder_opened` po tapnuti na reminder
- flight setup se po ulozeni pokusi naplanovat local reminder za 3 hodiny; vysledek jde do analytics jako `reminder_scheduled` nebo `reminder_permission_denied`
- flight setup ted podporuje planovani odletu: uzivatel zadava datum + cas odletu a ulozeny `departureTime` je konkretni planovany timestamp misto automatickeho `now`
- local reminder scheduling je navazany na planovany odlet, ne na fixni offset od okamziku ulozeni

## 2026-05-06

- opraven Tap Rush timer: konec kola se ted ridi realnym elapsed time misto retezenych JS timeoutu, takze velmi rychle tapovani uz neprodluzuje odpoctovy cas
- upraven Tap Rush input: pocitani tapu se ted spousti uz na `PressIn` a haptika je omezena, aby se pri velmi rychlem klepani mene ztracely vstupy
- opraveny dalsi timed hry stejnym principem: Cabin Call, Emoji Find a Air Traffic Control ted odpocitaji podle wall-clock deadline (`Date.now`) misto zavislosti na presnem vykonani sekundovych JS ticku, takze rychle klepani neprodluzuje cas/fuel
- upraven layout hornich filtrovacich chipu v Games a Explore: radky maji stabilni vysku a explicitni mezery mezi chipy, takze se uz vizualne neprekryvaji
- upraven Sky Defense wave-clear stav: informace o dalsi vlne je ted ve stredovem overlayi misto pod herni plochou, takze obraz uz mezi vlnami neposkakuje
- doplneno potvrzeni restartu ve Sky Defense: top reset i restart z pause overlaye uz nejdriv oteviraji potvrzovaci dialog, aby nahodny tap nesmazal rozjetou hru
- opraven preview range ve Sky Defense: pri vybranem toweru se pri dotyku a tahu po boardu aktualizuje `placeCursor`, takze pri mireni pred polozenim vidis dosah obrany
- upraven Stack Sort progress: level select ted ukazuje drive ziskane hvezdy pro kazdy level a stary encoded vysledek se pri migraci prevede do nove `levelStars` historie
- opraven Reaction result modal: misto interniho score `1000 - ms` ted ukazuje realny nejrychlejsi reaction time v milisekundach; restart/reset taky cisti stare session `bestMs`
- doplneny obtiznosti pro Sky Math: prepnuti Easy/Medium/Hard meni generovani prikladu v cele 12-otazkove session
- upraven Flight Path: pred spawnem se 2s zobrazuje varovny marker mista priletu a runwaye jsou striktne prirazene podle typu letadla (short=PROP, medium=JET, long=JUMBO/CARGO/FAST) s barevnym rozlisenim prijmu
- upraven Duel Hangman: vyber poctu hracu ted podporuje i 1 hrace; zobrazeni hadaneho slova je drzeno v jednom radku (pri delce se posouva horizontalne misto zalomeni)
- upraven Air Radar combat feedback: po dodelani celeho letadla se zobrazi hlaseni ktere letadlo bylo sestreleno; v HUD je navic prehled kolik zasahu a letadel jeste chybi do vyhry
- upraveno pexeso (Memory): v result overlayi odstranena bounce animace score cisla

## 2026-04-30

- zaveden sjednoceny game UX system: novy `GameResult` overlay s Best / Last / Streak udajemi a "New Best!" odznakem, sdilene `GameControls` (pause + reset), `GamePauseOverlay` s Resume / Restart / Quit a `GameCountdown` 3-2-1 intro s haptickou odezvou
- per-game progres rozsiren o `lastScore`, `currentStreak` a `bestStreak`; persistovany store ma migration na verzi 2, takze stare ulozeny stav nezarane
- Reaction, Tap Rush, Sky Math, Cabin Call, Runway Landing, Memory, Quiz, Sky Defense, Air Traffic Control a Flight Path dostaly viditelnou Best plaketu, jednotny reset (a tam, kde to dava smysl, i pause), countdown pred timed koly a novy result screen
- doplneno 12 sdilenych preklady pro game UX (`gameBest`, `gameLast`, `gameStreak`, `gameNewBest`, `gamePause`, `gameResume`, `gamePaused`, `gameRestart`, `gameQuit`, `gameReady`, `gameGo`, `gameTapToStart`) napric vsemi 12 podporovanymi jazyky

## 2026-04-28

- produktovy smer zarovnan na contextual travel assistant + offline entertainment system
- zalozena PostHog analytics foundation s anonymnimi eventy a bez autocapture/session replay
- doplneny prvni eventy pro app open, onboarding, flight setup, games, articles, relax a audio
- doplnen Expo Network foundation a anonymni event zmeny konektivity
- doplnen article sync foundation s persisted cache a fallbackem na bundled content
- doplneno nastaveni, jestli se content sync smi spoustet jen pres Wi-Fi, i pres mobilni data, nebo vubec
- Settings kompaktne seskupene na app preferences, article sync a support, aby screen dal rostl prehledne
- doplneny anonymni eventy pro Settings, Profile, Home akce/doporuceni a Explore discovery controls
- potvrzeno, ze Strapi bude pouzity pouze na clanky; ostatni app data zustavaji lokalni
- overeno, ze Strapi public Articles permission funguje (`/api/articles` vraci `200`), ale endpoint zatim neobsahuje publikovana data
- article sync umi pouzit Strapi root URL a sam z ni slozi `/api/articles`; prazdna odpoved zustava bezpecne na bundled fallbacku
- privacy/documentation backlog zarovnan na anonymni analytics + budouci Strapi sync

## 2026-04-23

- zavedena a napojena centralni game registry (`data/games.ts`) napric hlavnimi konzumenty
- home/games/explore/relax/profile/settings microcopy polish
- odstranene redundantni titulky na Games/Explore (vyuziva se nav bar header)
- Games: jednodussi filtry + search + opravy text clippingu
- Explore + Home: language-ready obsah (zabraneno michani EN/CZ/DE ve vyberu)
- doplneny chybejici `cs/de` preklady u 13 EN-only clanku
- dokumentace konsolidovana do 2 hlavnich provoznich dokumentu

## 2026-04-22

- stabilizace Home layoutu a flight utility pozice
- opravena semantika editace letu
- doplneni/zarovnani copy auditu (onboarding + vysledkove hlasky)

## 5. Update Rule

Pri kazde zmene, ktera meni chovani produktu, UX flow, feature scope nebo data model:

1. aktualizuj sekci "Current Status (As-Is)"
2. pridej zaznam do "Changelog" (datum + co se zmenilo)
3. pokud zmena vytvari novou prioritu, promtni ji i do `documents/todo-and-improvements.md`
