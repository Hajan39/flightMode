# Flight Mode: TODO & Improvements

Toto je hlavni dokument pro dalsi praci.
Obsahuje pouze veci, ktere jsou aktivni, navrzene nebo cekaji na schvaleni.

## 1. Prioritized TODO

### P0 (aktivni)

- dokoncit UI consistency pass napric remaining screens (duplicitni titulky, spacing, helper copy)
- pridat lightweight QA checklist pro release-ready smoke test (onboarding, games, explore, relax, profile)
- overit Android runtime issue (`npm run android` momentalne pada) a zapsat root cause + fix

### P1 (blizsi iterace)

- content collections pro Explore (tematicke bloky podle use-case letu)
- relax pillar expansion: dalsi breathing presets (`sleep`, `reset`, `calm`)
- profile progression polish (session summary framing, milestone clarity)

### P2 (stredni horizont)

- richer recommendation heuristiky bez backendu
- dalsi UX polish multiplayer discovery flow
- vybrat 1-2 retention experimenty (napr. continue playing)

## 2. Proposed Improvements (cekaji na schvaleni)

- flight utility naming/UX pass (bez API integrace)
- harmonizace rules textu napric vsemi hrami (voice & tone pass v EN/CS)
- jemne zrychleni Home perceived performance (animace/first paint tuning)

## 3. Out of Scope (aktualne)

- backend/auth
- flight API integration
- sitovy multiplayer
- monetization features
- MMKV migration
- NativeWind migration

## 4. Prioritization Rule

Kazdy navrh hodnotit pres:

1. posiluje to Games/Relax/Profile loop?
2. drzi to offline-first charakter?
3. snizuje to slozitost nebo aspon nevytvari novy drift?
4. je to realizovatelne bez backendove zavislosti?

## 5. Workflow Rule

- nove navrhy a napady zapisovat sem jako "Proposed Improvements"
- po schvaleni presunout do `P0/P1/P2`
- po dokonceni odstranit z TODO a zaznamenat do `documents/app-status-and-changelog.md`
