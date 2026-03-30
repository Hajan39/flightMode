
# ✈️ 1. PRINCIP: žádné „přihlášení“

Než začneme:

👉 **nebudeš mít login**
(alespoň v MVP)

Proč:

* offline app
* friction = uninstall
* nepotřebuješ účet

👉 místo toho:

* „first launch onboarding“
* lokální profil (MMKV)

---

# 🧭 2. USE CASE: první spuštění aplikace

## 🎬 Scénář: First Launch

### Trigger:

* user otevře appku poprvé

---

## Flow:

1. Welcome screen

2. stručné vysvětlení:

   * „funguje offline“
   * „ideální do letadla“

3. volba:

   * ➤ „Přidat let“
   * ➤ „Přeskočit“

---

## Varianta A: uživatel zadá let

### vstupy:

* flight number
* datum

---

### systém:

* zavolá API (např. Aviationstack)
* uloží data do MMKV

---

### fallback:

* manuální zadání

---

## Varianta B: skip

* vytvoří se default flight:

  * duration = null

---

## výstup:

* přechod na Home

---

---

# 🔁 3. USE CASE: opakované spuštění

## 🎬 Scénář: Returning User

### trigger:

* appka se otevře

---

## systém:

1. načte data z MMKV
2. zkontroluje:

   * existuje flight?
   * je aktivní?

---

## varianty:

### A: aktivní flight

→ zobrazí dashboard

---

### B: žádný flight

→ nabídne:

* přidat nový
* pokračovat bez něj

---

---

# 🏠 4. USE CASE: Home (hlavní obrazovka)

## 🎬 Scénář: Dashboard usage

---

### obsah:

* flight progress
* doporučené akce

---

### akce uživatele:

* „Play game“
* „Relax“
* „Explore content“

---

### systém:

* doporučuje podle:

  * času letu
  * historie

---

---

# 🎮 5. USE CASE: spuštění hry

## 🎬 Scénář: Play Game

---

### flow:

1. user klikne na hru
2. otevře se game screen
3. hra běží

---

### po skončení:

* uloží:

  * score
  * last played

→ do MMKV

---

---

# 📚 6. USE CASE: content

## 🎬 Scénář: čtení obsahu

---

### flow:

1. user otevře Explore
2. vybere článek
3. čte

---

### systém:

* track readTime (optional)

---

---

# 🧘 7. USE CASE: relax

## 🎬 Scénář: relax session

---

### flow:

1. user otevře Relax
2. vybere:

   * breathing
   * audio

---

### systém:

* spustí timer
* případně audio

---

---

# ✈️ 8. USE CASE: správa letu

## 🎬 Scénář: editace letu

---

### flow:

1. user otevře settings / flight detail
2. upraví:

   * čas
   * duration

---

### systém:

* uloží do MMKV

---

---

# 🧑‍🤝‍🧑 9. USE CASE: async multiplayer (v2)

## 🎬 Scénář: sdílení skóre

---

### flow:

1. user dokončí hru
2. klikne „share“

---

### systém:

* vygeneruje:

  * QR kód
  * nebo string

---

### druhý user:

* načte
* hraje stejný challenge

---

---

# 🎧 10. USE CASE: audio

## 🎬 Scénář: přehrávání

---

### flow:

1. user vybere audio
2. přehrávání

---

### systém:

* běží i na pozadí

---

---

# ⚠️ 11. Edge cases (kriticky důležité)

---

## ❌ API selže

→ fallback na manuální zadání

---

## ❌ user nemá flight

→ app musí fungovat i bez něj

---

## ❌ app je offline

→ žádná funkce nesmí failnout

---

---

# 🧠 12. Stavový model (zjednodušený)

---

## stavy aplikace:

* `FIRST_LAUNCH`
* `NO_FLIGHT`
* `ACTIVE_FLIGHT`

---

👉 podle toho:

* měníš UX

---

---

# 📊 13. Převod na dev tasky

---

## onboarding

* [ ] welcome screen
* [ ] add flight screen
* [ ] API fetch + fallback

---

## home

* [ ] flight progress
* [ ] doporučení

---

## games

* [ ] game screen
* [ ] save progress

---

## storage

* [ ] MMKV setup
* [ ] hydration

---
