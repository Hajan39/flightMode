# ✈️ 1. Základní přehled produktu

## Název (pracovní)

**FlightMode**

## Produkt

Mobilní aplikace (iOS/Android) vytvořená pro použití během letu, která nabízí:

* offline hry
* relaxační obsah
* audio
* kontextové doporučení podle fáze letu

---

## Hlavní problém

Cestující v letadle:

* nemají přístup k internetu
* nemají kvalitní zábavu (zejména lowcost lety)
* jsou unavení, znudění nebo ve stresu

---

## Řešení

Offline-first aplikace poskytující:

* rychlou zábavu
* relaxaci
* relevantní obsah během letu

---

# 🎯 2. Cíle produktu

## Krátkodobé (MVP)

* validovat zájem uživatelů
* získat první uživatele (organic traffic)
* otestovat engagement

---

## Dlouhodobé

* vytvořit „default appku do letadla“
* monetizace přes travel content
* napojení na vlastní travel brand

---

# 👥 3. Cílová skupina

## Primární

* 20–40 let
* cestují několikrát ročně
* economy / lowcost cestování

---

## Sekundární

* solo travelers
* páry
* digitální nomádi

---

# 📱 4. Funkční rozsah

---

## 🧩 4.1 MVP funkce

### 🎮 Hry (offline)

* 2–5 jednoduchých miniher
* krátké herní session (2–10 min)

---

### ✈️ Flight mode

* zadání letu:

  * manuálně
  * přes API (např. Aviationstack)
* výpočet délky letu
* progress bar

---

### 🏠 Dashboard

* přehled letu
* doporučený obsah
* rychlý přístup ke hrám

---

### 📚 Content (offline)

* články
* tipy
* cestovatelský obsah

---

### 🧘 Relax sekce

* breathing exercises
* jednoduché relaxační scénáře

---

### 🎧 Audio

* základní soundscapes
* offline přehrávání

---

---

## 🚀 4.2 Rozšíření (v2+)

### 🧑‍🤝‍🧑 Multiplayer

* async (sdílení score)
* lokální (Bluetooth / WiFi)

---

### 🌍 Social prvky

* anonymní interakce mezi pasažéry
* ankety

---

### 🧠 Personalizace

* doporučení podle:

  * délky letu
  * aktivity

---

### 📈 Analytics

* sledování:

  * engagement
  * retention
  * usage pattern

---

---

# 🧱 5. Technické řešení

---

## 📦 Stack

* Expo (React Native)
* TypeScript
* Expo Router
* NativeWind (Tailwind-like styling)
* Zustand (state management)
* MMKV (lokální storage)

---

## 💾 Data vrstvy

### Lokální:

* MMKV → settings, progress
* JSON → obsah

---

### Externí:

* flight API (např. Aviationstack)

---

---

## 🧭 Architektura

* modulární struktura
* oddělené herní moduly
* offline-first přístup

---

---

# 🧬 6. Datový model (zjednodušený)

* User settings
* Flight data
* Game progress
* Content items

👉 navržený pro rozšiřitelnost

---

---

# 🎨 7. UX principy

* jednoduchost (minimum kroků)
* offline použitelnost
* rychlé načítání
* žádné povinné přihlášení

---

---

# 📈 8. Monetizace

---

## 🟢 Fáze 1 (MVP)

* bez monetizace
* fokus na růst

---

## 🟡 Fáze 2

### Freemium model

* základ zdarma
* premium:

  * více her
  * více contentu

---

### Affiliate

* booking služby
* aktivity v destinaci

---

---

## 🔴 Fáze 3

### Vlastní produkty

* e-booky (např. travel guides)
* prémiový obsah

---

### Partnerství

* spolupráce s travel firmami

---

---

# 📣 9. Go-to-market strategie

---

## Kanály

### SEO

* články typu:

  * „co dělat v letadle“
  * „jak se zabavit bez internetu“

---

### Social media

* krátká videa (TikTok, Reels)

---

### Travel komunita

* Reddit
* fóra

---

---

# ⚠️ 10. Rizika

---

## Nízká adopce

* řešení: silný content marketing

---

## Nízký engagement

* řešení: jednoduché hry + updates

---

## Technická složitost (multiplayer)

* řešení: odložit do v2

---

---

# 🗺️ 11. Roadmapa

---

## 🔹 Fáze 1 (0–6 týdnů)

* MVP vývoj
* release

---

## 🔹 Fáze 2 (2–3 měsíce)

* rozšíření obsahu
* první monetizace

---

## 🔹 Fáze 3 (3–6 měsíců)

* multiplayer
* social prvky

---

---

# 📊 12. KPI

* počet stažení
* aktivní uživatelé
* čas v appce
* počet odehraných her

---

---

# 🧠 13. Konkurenční výhoda

* offline-first přístup
* kombinace:

  * hry + relax + travel content
* zaměření na konkrétní use-case (letadlo)

---

---

# 🧾 14. Shrnutí

Projekt:

* realistický na implementaci
* vhodný jako side project
* dobře napojitelný na existující travel aktivity
