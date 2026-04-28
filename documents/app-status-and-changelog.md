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
- settings (jazyk + theme)
- 19 offline miniher s centralni registry v `data/games.ts`
- 44 clanku v `data/content.json`
- content lokalizace kompletni pro `en/cs/de`
- games search + category filtry
- home dashboard s daily challenge, play together a flight utility kartou
- relax: breathing + ambient audio + sleep timer
- PostHog SDK foundation pro anonymni produktovou analytiku, pokud je nakonfigurovany `EXPO_PUBLIC_POSTHOG_KEY`
- zakladni eventy: `app_open`, `onboarding_complete`, `flight_added`, `flight_edited`, `game_start`, `game_finish`, `article_open`, `article_finish`, `relax_start`, `relax_finish`, `audio_play`, `audio_stop`

### Co aplikace ted nema

- auth nebo uzivatelske ucty
- Strapi content sync v runtime
- custom SQLite analytics event queue
- network state handling pres Expo Network
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

- Strapi jako planovany zdroj clanku a destination packu
- version check endpoint pro content updates
- local cache tak, aby app fungovala beze zbytku offline

### Analytics model

- eventy jsou anonymni produktove eventy bez loginu
- eventy nesmi obsahovat jmeno, email, presnou lokaci, flight number ani volny text od uzivatele
- upload probiha jen kdyz je dostupna sit a SDK/backend ho umi dorucit
- offline UX nesmi byt zavisle na uspesnem analytics uploadu

## 3. Roadmap

### Phase 1 (ted)

- dokoncit PostHog event coverage pro hlavni user flows
- doplnit network handling pres Expo Network
- navrhnout a pripadne pridat SQLite event queue/retry vrstvu, pokud bude potreba vetsi kontrola nez poskytuje PostHog SDK
- pripravit Strapi content sync foundation: version check, download, local cache, fallback na bundled content
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
