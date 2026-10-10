// Word lists for the big Word Search (osmisměrka) mode, per language.
// Words: travel themes, 3–8 letters. Secrets: the hidden message spelled by
// the leftover letters — `letters` is what goes into the grid, `text` is what
// the player sees at the end. Lengths 4–12 so most layouts find a fit.

export interface Secret {
  letters: string;
  text: string;
}

export const SEARCH_WORDS: Record<"cs" | "de" | "en", string[]> = {
  cs: `
PILOT RADAR TRASA BRÁNA VÍZUM MOTOR VĚTER DRÁHA HOTEL MĚSTO CESTA VÝLET
TAXÍK METRO KÁNOE ULICE ODLET OBLAK MAPA PAS KUFR BATOH LETIŠTĚ LETENKA
KAPITÁN PALUBA KŘÍDLO OKNO SEDADLO ULIČKA PLÁŽ MOŘE OSTROV HORY ÚDOLÍ
JEZERO ŘEKA MOST VĚŽ HRAD ZÁMEK MUZEUM KÁVA ČAJ SNÍDANĚ OBĚD VEČEŘE
MĚNA KARTA FOTKA DEŠTNÍK BRÝLE SLUNCE MRAK DUHA PŘÍSTAV LOĎ VLAK
`
    .trim()
    .split(/\s+/),
  de: `
PILOT RADAR ROUTE PISTE REISE KARTE MOTOR STURM SONNE VISUM WOLKE HOTEL
STADT INSEL STRAND MEER HAFEN SCHIFF ZUG TAXI KOFFER RUCKSACK TICKET PASS
FLÜGEL FENSTER SITZ GANG BORD KABINE TOWER GATE BERGE SEE FLUSS BRÜCKE
TURM BURG MUSEUM KAFFEE TEE FRÜHSTÜCK ESSEN LANDUNG FOTO SCHIRM BRILLE
REGEN WIND NEBEL HIMMEL MOND STERN
`
    .trim()
    .split(/\s+/),
  en: `
PILOT CABIN CARGO RADAR TOWER ROUTE CLOUD GATE WINGS PLANE BOARD MILES
HOTEL CITY TRIP TAXI TRAIN FERRY BEACH ISLAND OCEAN COAST HARBOR BRIDGE
CASTLE MUSEUM MAP PASSPORT TICKET LUGGAGE SUITCASE BACKPACK WINDOW AISLE
SEAT CREW CAPTAIN RUNWAY TAKEOFF LANDING COFFEE TEA SNACK DINNER CAMERA
SUNSET STORM RAIN WIND MOON STAR SKY
`
    .trim()
    .split(/\s+/),
};

export const SECRETS: Record<"cs" | "de" | "en", Secret[]> = {
  cs: [
    { letters: "MOŘE", text: "Moře" },
    { letters: "VÝLET", text: "Výlet" },
    { letters: "OBLAKA", text: "Oblaka" },
    { letters: "LETENKA", text: "Letenka" },
    { letters: "DOBRÝLET", text: "Dobrý let" },
    { letters: "UŽIJSITO", text: "Užij si to" },
    { letters: "PRÁZDNINY", text: "Prázdniny" },
    { letters: "CESTOVÁNÍ", text: "Cestování" },
    { letters: "JEDEMEDOMŮ", text: "Jedeme domů" },
    { letters: "NEBEJEMODRÉ", text: "Nebe je modré" },
    { letters: "ŠŤASTNÁCESTA", text: "Šťastná cesta" },
  ],
  de: [
    { letters: "MEER", text: "Meer" },
    { letters: "REISE", text: "Reise" },
    { letters: "STRAND", text: "Strand" },
    { letters: "FERNWEH", text: "Fernweh" },
    { letters: "FREIZEIT", text: "Freizeit" },
    { letters: "GUTENFLUG", text: "Guten Flug" },
    { letters: "HIMMELBLAU", text: "Himmelblau" },
    { letters: "SCHÖNERFLUG", text: "Schöner Flug" },
    { letters: "SCHÖNEFERIEN", text: "Schöne Ferien" },
  ],
  en: [
    { letters: "HOME", text: "Home" },
    { letters: "ALOHA", text: "Aloha" },
    { letters: "SUNSET", text: "Sunset" },
    { letters: "TAKEOFF", text: "Takeoff" },
    { letters: "AIRBORNE", text: "Airborne" },
    { letters: "BONVOYAGE", text: "Bon voyage" },
    { letters: "SAFEFLIGHT", text: "Safe flight" },
    { letters: "WELCOMEHOME", text: "Welcome home" },
    { letters: "ENJOYTHEVIEW", text: "Enjoy the view" },
  ],
};
