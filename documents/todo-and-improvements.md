# Flight Mode: TODO & Improvements

Toto je hlavni dokument pro dalsi praci.
Obsahuje pouze veci, ktere jsou aktivni, navrzene nebo cekaji na schvaleni.

## 1. Prioritized TODO

### P0 (aktivni)

- overit PostHog runtime v Expo/Android buildu s realnym `EXPO_PUBLIC_POSTHOG_KEY`
- zkontrolovat, ze analytics payloady neobsahuji flight number, presnou lokaci, email, jmeno ani volny text
- rozhodnout, jestli PostHog SDK offline persistence staci, nebo jestli pridat vlastni SQLite event queue
- pridat lightweight QA checklist pro release-ready smoke test: onboarding, games, explore, relax, profile, analytics no-crash path
- overit Android runtime issue (`npm run android` momentalne pada) a zapsat root cause + fix

### P1 (blizsi iterace)

- vyuzit centralni online/offline stav pro budouci analytics flush debug a Strapi sync gating
- publikovat prvni Strapi article data a potvrdit field contract: `title`, `category`, `body`, `readTime`/`read_time`
- otestovat article sync na realnych Strapi datech; public `find/findOne` uz vraci `200`, ale `/api/articles` je zatim prazdne
- neposilat tajny Strapi API token do mobilni appky; pouzivat public read Articles nebo serverovy proxy endpoint
- overit UX sync nastaveni na Androidu: Wi-Fi only, Wi-Fi + mobile data, off
- rozsirit local cache strategii pro vetsi article assety, pokud clanky zacnou pouzivat remote media
- pripravit analytics QA/debug mode pro lokalni overeni eventu bez produkcniho sumu

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
