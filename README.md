# Flight Mode

Flight Mode je offline-first Expo / React Native aplikace pro cestovani letadlem.

Aktualni produktovy fokus:

- offline mini-hry
- relax flow s breathing a ambient audio
- lokalni profil, progress a achievements
- sekundarne travel content
- lehka flight utility vrstva bez API integrace

## Aktualni smer produktu

Pro dalsi fazi vyvoje plati:

- hlavni pilire jsou Games, Relax a Profile
- Content je sekundarni pilir
- Flight zustava jednoducha utility vrstva
- neresi se ted backend, ucty, flight API ani sitovy multiplayer

Podrobnejsi provozni dokumentace:

- `CHANGELOG.md` (Keep a Changelog format)
- `documents/app-status-and-changelog.md` (as-is + changelog)
- `documents/todo-and-improvements.md` (TODO + prioritizace + navrhy)
- `documents/privacy-policy.md` (public privacy policy text)

Versioning:

- projekt pouziva SemVer (`package.json`)
- `CHANGELOG.md` sleduje release sekce podle verzi a drzi rozpracovane zmeny v `Unreleased`

## Tech stack

- Expo 55
- React 19
- React Native 0.83
- Expo Router
- Zustand
- AsyncStorage pres `zustand/persist`
- `expo-audio` pro ambient audio playback
- `expo-updates` pro OTA updates

Poznamky k realne implementaci:

- projekt aktualne nepouziva MMKV
- projekt aktualne nepouziva NativeWind jako hlavni styling vrstvu
- UI je psane primarne pres React Native `StyleSheet` a lokalni komponenty

## Spusteni projektu

Vyvoj:

```bash
npm install
npm run start
```

Dalsi skripty:

```bash
npm run android
npm run ios
npm run web
```

OTA / build skripty:

```bash
npm run ota:preview -- "message"
npm run ota:production -- "message"
npm run eas:build:android
npm run deploy:android
npm run eas:submit:android
```

## Struktura projektu

```text
app/
  _layout.tsx
  onboarding.tsx
  profile.tsx
  settings.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    games.tsx
    explore.tsx
    relax.tsx
  game/[id].tsx
  content/[id].tsx
  flight/edit.tsx

components/
constants/
data/
  content.json
  achievements.ts
  games.ts
games/
hooks/
i18n/
store/
types/
documents/
```

## Kde je source of truth

### Games

Centralni registry her je v:

- `data/games.ts`

Tento soubor je source of truth pro:

- game id
- title key
- description key
- rules key
- category
- estimated time
- icon
- daily challenge eligibility
- play together eligibility
- lazy component loader

Hlavni consumeri:

- `app/(tabs)/games.tsx`
- `app/game/[id].tsx`
- `app/(tabs)/index.tsx`
- `app/profile.tsx`
- `hooks/useProfileStats.ts`

### Content

Staticky obsah je v:

- `data/content.json`

Explore flow:

- list screen: `app/(tabs)/explore.tsx`
- detail screen: `app/content/[id].tsx`

### State

Zustand stores:

- `store/useSettingsStore.ts`
- `store/useFlightStore.ts`
- `store/useGameStore.ts`
- `store/useAchievementStore.ts`
- `store/useAudioStore.ts`

## Jak pridat novou hru

1. Vytvor herni modul pod `games/<id>/index.tsx`
2. Pridej metadata do `data/games.ts`
3. Pridej translation keys do locale souboru pro:
   - title
   - description
   - rules
4. Over, ze se hra zobrazi v:
   - Games listu
   - game detail route
   - pripadne Home, pokud ma byt daily challenge nebo play together
   - profilu a statistikach
5. Ujisti se, ze hra zapisuje progres pres `useGameStore().updateProgress()`

## Jak pridat novy clanek

1. Pridej item do `data/content.json`
2. Vypln `id`, `title`, `category`, `readTime`, `body`
3. Pokud clanek nebude lokalizovany, minimalne zachovej `en`
4. Over list a detail v Explore flow

## Jak pridat nebo zmenit texty

1. Pridej nebo uprav key v `i18n/locales/*.ts`
2. Pokud jde o novy text pro hru, slad ho s `data/games.ts`
3. Pokud jde o Home / Relax / Profile copy, zkontroluj, ze podporuje aktualni positioning produktu

## Conventions pro dalsi vyvoj

- preferuj offline-first reseni
- nepridavej backend dependency do core flow bez explicitniho rozhodnuti
- pouzivej existujici Zustand stores misto nove globalni vrstvy
- preferuj male, lokalni zmeny pred sirokym refaktorem
- nesnaz se vracet projekt smerem k zastarale dokumentaci jen proto, ze tam neco kdysi bylo

## Co ted neni roadmapa

Tyto veci nejsou aktualni priorita:

- MMKV migrace
- NativeWind adoption
- zmena audio stacku
- flight API lookup
- backend a auth
- sitovy multiplayer

## Doporuceny postup pri zmene

1. zkontroluj relevantni dokument v `documents/`
2. najdi aktualni source of truth soubor
3. udelej co nejmensi zmenu v danem slice
4. over touched files v Problems panelu
5. kdyz menis produktove chovani, aktualizuj odpovidajici docs