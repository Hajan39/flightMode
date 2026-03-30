Dobře — teď to převedeme do **technického zadání**, které už je blízko implementaci. Žádné marketingové řeči, ale **jak to bude fungovat uvnitř**.

---

# 1. Architektura aplikace

Aplikace bude navržena jako **offline-first mobilní klient**, bez nutnosti backendu v MVP.

## Hlavní principy:

* aplikace musí fungovat bez internetu
* všechny klíčové funkce jsou lokální
* externí API je pouze doplněk (ne kritická závislost)

---

## Vrstvy aplikace

### 1. UI vrstva

* React Native komponenty (Expo)
* obrazovky definované přes Expo Router (file-based routing)

---

### 2. Business logika

* hooky a services
* logika pro:

  * flight management
  * doporučování obsahu
  * herní mechaniky

---

### 3. State management

* Zustand store
* drží:

  * aktuální flight
  * user settings
  * game progress

---

### 4. Persistence vrstva

* MMKV (synchronní storage)
* slouží jako:

  * persistentní cache
  * jednoduchá databáze

---

### 5. Data zdroje

* statické JSON soubory (obsah, hry)
* externí API (flight data)

---

# 2. Navigační architektura

Použit Expo Router (file-based routing).

---

## Struktura rout

```text
/app
  /(tabs)
    index.tsx        // Home
    games.tsx
    explore.tsx
    relax.tsx

  /game/[id].tsx
  /content/[id].tsx
  /flight/edit.tsx

  _layout.tsx
```

---

## Navigační principy:

* tab-based navigace pro hlavní sekce
* stack navigace pro detail (game, content)
* žádné hluboké nestingy

---

# 3. Stav aplikace (State model)

## Globální store (Zustand)

```ts
type AppState = {
  flight: Flight | null
  settings: Settings
  gameProgress: Record<string, GameProgress>

  setFlight: (flight: Flight) => void
  updateGameProgress: (progress: GameProgress) => void
}
```

---

## Inicializace:

* při startu aplikace:

  * načtení dat z MMKV
  * hydratace store

---

## Synchronizace:

* každá změna:

  * okamžitý zápis do MMKV

---

# 4. Persistence (MMKV)

## Klíče:

```ts
flight
settings
game_progress
```

---

## Strategie:

* serializace do JSON
* synchronní přístup (žádné async čekání)

---

## Důvod:

* rychlé načítání při startu
* minimální overhead

---

# 5. Flight management

## Zdroj dat:

### Varianta 1:

* externí API (např. Aviationstack)

### Varianta 2:

* manuální vstup

---

## Flow:

1. uživatel zadá flight number + datum
2. pokus o fetch z API
3. při selhání:

   * fallback na manuální zadání

---

## Ukládaná data:

```ts
type Flight = {
  id: string
  departureTime: number
  duration: number
}
```

---

## Odvozené hodnoty:

* elapsed time
* remaining time
* progress %

---

# 6. Game architektura

## Cíl:

* izolované herní moduly
* možnost přidávání bez zásahu do core

---

## Struktura:

```text
/games
  /memory
    index.tsx
    logic.ts

  /quiz
    index.tsx
```

---

## Interface hry:

```ts
type GameModule = {
  id: string
  component: React.FC
  config: {
    estimatedTime: number
  }
}
```

---

## Spuštění:

* dynamické mapování podle ID

---

## Ukládání výsledků:

* po ukončení hry:

  * zápis do MMKV

---

# 7. Content systém

## Zdroj:

* statické JSON soubory

---

## Struktura:

```ts
type ContentItem = {
  id: string
  title: string
  category: string
  readTime: number
  body: string
}
```

---

## Načítání:

* import při startu aplikace
* žádné API volání

---

## Výhoda:

* plná offline dostupnost
* jednoduchá správa

---

# 8. Audio systém

## Implementace:

* expo-av

---

## Zdroj:

* lokální audio soubory

---

## Funkce:

* play / pause
* background playback (omezeně dle OS)

---

## Použití:

* relax sekce
* ambient sounds

---

# 9. Doporučovací logika

## Vstupy:

* délka letu
* zbývající čas
* historie aktivit

---

## Výstup:

* seznam doporučených akcí

---

## Příklad:

```ts
if (remainingTime < 30min) → short games
if (remainingTime > 2h) → content / relax
```

---

## Implementace:

* jednoduchá funkce (žádný ML)

---

# 10. Error handling

## Typy chyb:

### API error

* fallback na manuální vstup

---

### chybějící data

* default hodnoty

---

### corrupted storage

* reset na default state

---

# 11. Offline režim

## Zásady:

* žádná klíčová funkce nesmí vyžadovat internet
* API pouze při onboarding

---

## Kontrola:

* network status (optional)

---

# 12. Výkon

## Optimalizace:

* minimalizace re-renderů (Zustand selektory)
* lazy loading her
* malé assety

---

## Startup:

* rychlé načtení z MMKV
* žádné blokující operace

---

# 13. Rozšiřitelnost

## Přidání hry:

* nový modul ve složce /games
* registrace v seznamu

---

## Přidání obsahu:

* úprava JSON

---

## Přidání feature:

* nová route + store slice

---

# 14. Bezpečnost

* žádná citlivá data
* žádný auth
* minimální rizika

---

# 15. Shrnutí

Technicky je aplikace:

* jednoduchá
* modulární
* offline-first

---

## Největší výhody:

* rychlý vývoj
* nízká komplexita
* snadná údržba

---

## Největší limit:

* žádná synchronizace mezi zařízeními (zatím)