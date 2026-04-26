# Flight Mode: App Status & Changelog

Toto je hlavni source-of-truth dokument pro to, jak aplikace vypada ted.
Pouzivej ho misto starsich roztristenych status dokumentu.

## 1. Current Status (As-Is)

### Produktovy fokus

- Primary: Games, Relax, Profile/progression
- Secondary: Explore/content
- Utility vrstva: jednoduchy flight timer bez API lookupu

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

### Co aplikace ted nema

- backend a auth
- flight API integraci
- sitovy multiplayer
- serverovou personalizaci
- analytics pipeline

### Dulezite implementacni fakty

- Expo Router + Zustand stores
- persistence pres AsyncStorage (`zustand/persist`)
- audio runtime pres `expo-audio`
- offline-first je zakladni constraint

## 2. Changelog

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

## 3. Update Rule

Pri kazde zmene, ktera meni chovani produktu, UX flow, feature scope nebo data model:

1. aktualizuj sekci "Current Status (As-Is)"
2. pridej zaznam do "Changelog" (datum + co se zmenilo)
3. pokud zmena vytvari novou prioritu, promtni ji i do `documents/todo-and-improvements.md`
