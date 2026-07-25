# Flight Mode: TODO & Improvements

Toto je hlavni dokument pro dalsi praci.
Obsahuje pouze veci, ktere jsou aktivni, navrzene nebo cekaji na schvaleni.

## 1. Prioritized TODO

### P0 (aktivni)

- ~~pridat explicitni analytics consent/opt-out UX~~ — hotovo: toggle v Settings > Privacy
- ~~achievement tiery pro sky-defense a air-traffic-control~~ — hotovo: Sky Guardian/Commander (100/500+), Tower Operator/Air Boss (150/500+)
- ~~GameRules emoji regex debt~~ — hotovo: `/^\p{Extended_Pictographic}/u`
- ~~pauza v quiz a sky-math~~ — hotovo: GamePauseOverlay + GameControls zapojeny do obou her
- ~~Home empty-state pro noveho uzivatele~~ — hotovo: welcome card s CTA na Games tab
- ~~achievement_unlocked analytics event~~ — hotovo: `checkAndUnlock()` posila event pro kazdy novy unlock
- udelat game quality pass napric vsemi 19 hrami: smysluplnost, obtiznost, delka session, opakovatelnost, jasnost pravidel a mobile ergonomie
- rozdelit hry do rozhodovacich skupin: `keep`, `tune`, `rework`, `maybe remove/replace`
- dokoncit kalibraci metadata her (`difficulty`, `estimatedTime`, `category`, `isDailyChallenge`, `isPlayTogether`) podle realneho gameplaye, ne jen podle nazvu hry
- doladit Games discovery podle realneho pouzivani po prvni implementaci intent filtru: quick, play together, longer/deep
- zkontrolovat, ze analytics payloady neobsahuji flight number, presnou lokaci, email, jmeno ani volny text
- rozhodnout, jestli PostHog SDK offline persistence staci, nebo jestli pridat vlastni SQLite event queue

### P1 (blizsi iterace)

- vyuzit centralni online/offline stav pro budouci analytics flush debug a Strapi sync gating
- navazat na novou retention event vrstvu (`app_open_count`, `second_session_started`, `first_session_completed`, `flight_setup_completed`) a postavit nad ni tydne vyhodnocovane D1/D7 dashboardy
- po nasazeni support CTA vyhodnotit funnel `support_opened -> support_clicked -> support_completed` a upravit copy/umisteni podle konverzi
- theme sweep napric hrami (nalez z game auditu 2026-07-05): ~15 her pouziva hardcoded barvy mimo theme paletu (typicky #ef5350/#cc4b5a cervene, #fff texty na tint pozadi, kvalita/difficulty barvy v runway-landing, sudoku, snake, word-guess, 2048, flight-path, ATC, sky-defense, minesweeper adjacency, higher-lower, odd-one-out, whack-mole, cabin-call, duel-emoji-find, cross-air-radar) — funkcni, ale nekonzistentni v dark/crazy tematech; zvazit pridani `error`/`errorSurface` tokenu do Colors.ts a jednorazovy sweep
- word-guess: klavesy ~36px sirky pod 44px minimem — sirku nelze zvetsit bez redesignu radku, zvazit hitSlop nebo vyssi klavesy
- color-clash: round timer je jednorazovy setTimeout(ROUND_MS) bez wall-clock deadline korekce — hranicni vuci timer rule, nizka priorita
- rozsireni local reminders z aktualni foundation (3h po flight setupu) na realny pre-flight ritual, az flight setup bude mit bud explicitni departure datetime, nebo offset pred odletem
- publikovat prvni Strapi article data podle potvrzeneho contractu: `title`, `category`, `body`, `readTime` nebo `read_time`
- otestovat article sync na realnych Strapi datech; public `find/findOne` uz vraci `200`, ale `/api/articles` je zatim prazdne
- overit, ze Home, Explore a Article Detail zobrazuji remote clanky a ze offline fallback zustava funkcni
- neposilat tajny Strapi API token do mobilni appky; pouzivat public read Articles nebo serverovy proxy endpoint
- overit UX sync nastaveni na Androidu: Wi-Fi only, Wi-Fi + mobile data, off
- rozsirit local cache strategii pro vetsi article assety, pokud clanky zacnou pouzivat remote media
- pripravit analytics QA/debug mode pro lokalni overeni eventu bez produkcniho sumu

### Next Implementation Slice: Game Quality

Goal: rozhodnout, ktere hry jsou dlouhodobe nosne, ktere potrebuji doladit a ktere maji nahradit lepsi opakovatelny gameplay.

Current signal from code audit:

- silne quick-session kandidaty: `reaction`, `tap-rush`, `runway-landing`, `cabin-call`, `sky-math`, `memory`
- silne play-together kandidaty: `duel-tictactoe`, `duel-dice`, `duel-connect4`, `duel-emoji-find`
- rizikove komplexni hry na mobile UX audit: `flight-path`, `sky-defense`, `stack-sort`, `cross-code-breaker`, `cross-liars-dice`, `duel-hangman`
- cast her nema sdileny `GameResult` konec, coz muze snizovat pocit uzavrene session a motivaci hrat znovu
- obtiznost v registru je potreba porovnat s realnou rampou ve hre; nektere hry maji vlastni difficulty/rampu, jine jen staticky label

Initial adjustments already applied:

- `reaction` zapisuje progress az po cele 5kolove session a ma vysledkovy overlay
- daily challenge pool je vic quick-session: pridane `tap-rush` a `sky-math`, vyrazeny delsi `quiz`
- `memory`, `cabin-call` a `air-traffic-control` maji realistictejsi `estimatedTime`
- `stack-sort` je oznaceny jako delsi a tezsi hra, protoze je pravidlove/mentalne narocnejsi nez bezny medium brain game
- Games tab ma prvni intent discovery vrstvu: all, quick, multiplayer a longer/deep hry
- karty her zvyraznuji daily challenge a play-together kandidaty ikonami, aby uzivatel rychleji pochopil proc by je mel otevrit
- Games karty maji ztlumenou barevnost: bez category duhy a bez cerveno/zluto/zeleneho difficulty semaforu
- multiplayer metadata rozlisuji fyzicky zpusob hrani: `sharedScreen` pro hrani nad jednim displejem a `passAndPlay` pro stridani/predavani telefonu
- `duel-dice` ma prehlednejsi horni score strip pro aktualni hody a vysledkovou tabuli: scrollovatelny ranking, kompaktni radky a jasne oddelene vyhry/body
- `cross-air-radar` setup dovoluje pred potvrzenim oznacit, pretahnout a presunout uz polozenou flotilu
- `duel-tictactoe` ma volbu rezimu: klasicke 3x3 a rostouci 5+ piskvorky se startem 5x5, expanzi pri tahu na okraj az do 30x30, delsi `estimatedTime` a medium obtiznost

Decision groups for next pass:

- `keep`: `reaction`, `tap-rush`, `runway-landing`, `cabin-call`, `sky-math`, `memory`, `duel-tictactoe`, `duel-dice`, `duel-connect4`, `duel-emoji-find`
- `tune`: `quiz`, `air-traffic-control`, `stack-sort`, `cross-air-radar`
- `rework before promoting`: `flight-path`, `sky-defense`, `duel-hangman`, `cross-code-breaker`, `cross-liars-dice`
- `maybe remove/replace`: zatim nic bez dalsiho hrani; nejdrive dat komplexnim hram jasnejsi UX a konec session

Multiplayer layout groups:

- `sharedScreen`: `duel-tictactoe`, `duel-connect4`
- `passAndPlay`: `duel-dice`, `duel-emoji-find`, `duel-hangman`, `cross-air-radar`, `cross-code-breaker`, `cross-liars-dice`
- `crossDevice`: zatim nepouzivat jako realny app claim, dokud hra nema skutecny vicezarizeni flow

Audit checklist pro kazdou hru:

1. da se pochopit do 10 sekund bez otevreni dlouhych pravidel?
2. ma prvni session prijemny uspechovy moment do 30-60 sekund?
3. odpovida realna delka `estimatedTime`?
4. odpovida realna obtiznost labelu `easy/medium/hard`?
5. ma jasny konec, skore a duvod dat Play Again?
6. funguje pohodlne jednou rukou a na malem Android displeji?
7. ma opakovatelnost: nahoda, progres, mastery, duel dynamiku nebo kratky challenge loop?
8. neni pravidlove nebo vizualne moc narocna pro letadlo/offline casual kontext?

### Later Implementation Slice: Strapi Articles

Strapi collection type: `Article`.

Required public fields:

- `title`: string, or localized object with at least `en`
- `category`: string, or localized object with at least `en`
- `body`: string, or localized object with at least `en`
- `readTime` or `read_time`: positive number in minutes

Accepted ID/version fields from Strapi:

- `id` or `documentId` is used as the app article id
- `updatedAt`, `publishedAt`, or `createdAt` is used as the sync version fallback

Validation steps:

1. publish 1-2 public Articles in Strapi
2. verify `https://cheerful-approval-7e0a5ca32d.strapiapp.com/api/articles` returns non-empty `data`
3. run the app with `EXPO_PUBLIC_STRAPI_CONTENT_URL=https://cheerful-approval-7e0a5ca32d.strapiapp.com`
4. verify Home recommendations, Explore list/search/filter/sort, and Article Detail read flow
5. turn sync off and verify bundled articles still render offline

### P2 (stredni horizont)

- smart recommendations podle delky letu, typu aktivity, lokalu a historie pouziti
- destination packs podle cilove destinace
- airport detection jako explicitni opt-in pres Expo Location
- relax pillar expansion: dalsi breathing presets (`sleep`, `reset`, `calm`)
- content collections pro Explore (tematicke bloky podle use-case letu)
- profile progression polish (session summary framing, milestone clarity)

### P3 (pozdejsi roadmap)

- premium unlock: vsechny hry, vsechny clanky, dalsi audio
- affiliate integrace po pristani: Booking.com, GetYourGuide
- local notifications: flight reminder, content download reminder, comeback prompt
- advanced personalization
- dalsi UX polish multiplayer discovery flow
- vybrat 1-2 retention experimenty (napr. continue playing)

## 1b. Google Play Games (PGS) + Sidekick — plan (native, follow-up po 1.3.0)

**Sidekick (bez kodu, hned):** v Play Console pri uploadu 1.3.0 AAB zapnout "Sidekick is on by default"
(Testing > Advanced settings > Play Games Sidekick), vyplnit Sidekick SDK registracni formular
(schvaleni ~1-2 tydny). Ziska overlay utility (screenshot, nahravani, streaky). Splnuje Level Up vyzvu.
Podminky splneny: minSdk 24 (>=23), release je AAB.

**Plne PGS propojeni (sign-in + achievementy):**

**HOTOVO (kod-strana, inertni scaffolding — commitnuto, tsc+testy zelene):**
- `utils/playGames.ts` — guarded wrapper: `initPlayGames()` (silent sign-in), `unlockPlayGamesAchievement()`,
  `showPlayGamesAchievements()`, `isPlayGamesAvailable()`. Nativni modul se resolvuje **dynamicky za behu**
  (`require` v try/catch), takze v Expo Go / iOS / web / soucasnem release buildu je to **cisty no-op**
  a nikdy nespadne. → NEpridavame zatim nativni balik do `package.json`, aby to nerozbilo release build.
- `data/playGamesAchievements.ts` — mapa `localAchievementId -> Play ID` (vsech 30 achievementu, zatim `null`).
- `store/useAchievementStore.ts` — po lokalnim unlocku fire-and-forget push do PGS (`void unlock...`), guarded.
- `components/PlayGamesBootstrap.tsx` — silent sign-in on launch (mounted v `app/_layout.tsx`, no-op bez modulu).
- `plugins/withPlayGames.js` — Expo config plugin: vlozi `com.google.android.gms.games.APP_ID` meta-data
  do manifestu z `expo.extra.playGamesAppId`. **No-op kdyz app id chybi** → nerozbije prebuild.
- `__tests__/playGamesAchievements.test.ts` — hlida ze mapa nedivergovala od `data/achievements.ts`.

**ZBYVA (vyzaduje tvoje kredencialy + dev build — nelze udelat ze sandboxu):** viz `documents/play-games-setup.md`.
Shrnuti: (1) Play Console PGS projekt + OAuth 2.0 klient se SHA-1 z app-signing klice; (2) nadefinovat
30 achievementu a jejich `CgkI...` ID doplnit do `data/playGamesAchievements.ts`; (3) doplnit numericke
app id do `app.json` `extra.playGamesAppId` + pridat `"./plugins/withPlayGames"` do `plugins`; (4) vyresit
nativni modul (New-Arch-safe: bud vlastni nativni modul, nebo maintained balik) a napojit v
`resolveNativeModule()`; (5) overit `eas build --profile development` + dev client na zarizeni s Play Store.
Vse guarded — PGS vypadek nikdy nesmi shodit offline UX. Nikdy nespoléhat na Expo Go (PGS tam nefunguje).

## 2. Proposed Improvements (cekaji na schvaleni)

- flight utility naming/UX pass (bez API integrace)
- harmonizace rules textu napric vsemi hrami (voice & tone pass v EN/CS)
- jemne zrychleni Home perceived performance (animace/first paint tuning)
- dokoncit UI consistency pass napric remaining screens (duplicitni titulky, spacing, helper copy)

## 3. Out of Scope (aktualne)

- auth a povinne uzivatelske ucty
- flight API integration jako core requirement
- sitovy multiplayer
- monetization features v Phase 1
- MMKV migration
- NativeWind migration
- online-only gameplay nebo online-only content jako hard dependency

## 4. Prioritization Rule

Kazdy navrh hodnotit pres:

1. posiluje to travel assistant + offline entertainment loop?
2. drzi to offline-first charakter?
3. pomaha to retenci, product learning nebo predletove/prubezne pouzitelnosti?
4. snizuje to slozitost nebo aspon nevytvari novy drift?
5. funguje to s online funkcemi jako optional sync, ne jako povinna zavislost?

## 5. Workflow Rule

- nove navrhy a napady zapisovat sem jako "Proposed Improvements"
- po schvaleni presunout do `P0/P1/P2`
- po dokonceni odstranit z TODO a zaznamenat do `documents/app-status-and-changelog.md`
