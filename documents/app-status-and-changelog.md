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
- 19 offline miniher s centralni registry v `data/games.ts`
- 44 clanku v `data/content.json`
- content lokalizace kompletni pro `en/cs/de`
- UI translation keys jsou kompletni napric vsemi podporovanymi jazyky (`en/cs/de/es/fr/hi/it/ja/ko/pl/pt/zh`)
- games search + category filtry + intent filtry pro quick, play together a longer/deep hry
- home dashboard s daily challenge, play together a flight utility kartou
- relax: breathing + ambient audio + sleep timer
- PostHog SDK foundation pro anonymni produktovou analytiku, pokud je nakonfigurovany `EXPO_PUBLIC_POSTHOG_KEY`
- Expo Network foundation pro online/offline stav v root bootstrapu
- article sync foundation: remote JSON/Strapi-compatible endpoint pres env, persisted cache, fallback na bundled `data/content.json`
- zakladni eventy: `app_open`, `onboarding_complete`, `flight_added`, `flight_edited`, `game_start`, `game_finish`, `article_open`, `article_finish`, `relax_start`, `relax_finish`, `audio_play`, `audio_stop`, `settings_open`, `profile_open`, `home_action_open`, `home_recommendation_open`, `content_search_changed`, `content_filter_changed`, `content_sort_changed`, `network_status_changed`, `content_sync_start`, `content_sync_success`, `content_sync_failed`

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
- potvrzeny Strapi Article contract pro app sync je `title`, `category`, `body` a `readTime` nebo `read_time`; textova pole mohou byt plain string nebo lokalizovany objekt s aspon `en`
- aktualni Strapi Articles endpoint `https://cheerful-approval-7e0a5ca32d.strapiapp.com/api/articles` vraci `200`, ale zatim `data: []`; sync proto zustava na bundled fallbacku, dokud nebudou publikovane clanky; Strapi overeni neni aktualni hlavni fokus
- content sync respektuje persisted user setting `syncNetworkPolicy`: Wi-Fi only, Wi-Fi + mobile data, nebo off; default je Wi-Fi only
- analytics runtime byl uzivatelsky overeny; dalsi privacy krok je explicitni analytics consent/opt-out UX, ne cookie banner v browser smyslu
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
