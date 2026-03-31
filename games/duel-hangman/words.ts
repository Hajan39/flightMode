import type { Language } from "@/i18n/translations";

export type Difficulty = "easy" | "medium" | "hard";

type WordPool = Record<Difficulty, string[]>;

/**
 * Aviation-themed word pools per language, grouped by difficulty.
 * easy: 3–4 letters, medium: 5–6 letters, hard: 7+ letters.
 * All words UPPERCASE, basic Latin A-Z only (no diacritics) for keyboard compat.
 */
const pools: Record<Language, WordPool> = {
	en: {
		easy: [
			"JET", "FLY", "AIR", "MAP", "SKY", "FOG", "ICE", "GAS", "CAB", "BOW",
			"ARC", "HUB", "LOG", "BAY", "GAP", "ARM", "FIN", "TIP", "RIG", "OIL",
			"CREW", "TAXI", "WING", "GEAR", "DECK", "TAIL", "MACH", "LIFT", "TURN",
			"FUEL", "WIND", "GATE", "BELT", "LAND", "LOOP", "ROLL", "DRAG", "PROP",
		],
		medium: [
			"PILOT", "TOWER", "RADAR", "CABIN", "CLOUD", "STORM", "FLAPS", "ROTOR",
			"CARGO", "ROUTE", "ORBIT", "NORTH", "SOUTH", "STALL", "BRAKE", "SPEED",
			"GAUGE", "EAGLE", "DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA",
			"TANGO", "CLIMB", "GLIDE", "DRIFT", "WINGS", "BOARD", "VAPOR", "BLADE",
			"TURBO", "SURGE", "FLAME", "LUNAR", "SOLAR", "METAL", "SHOCK", "BLAST",
			"HANGAR", "FLIGHT", "RUNWAY", "JETLAG",
		],
		hard: [
			"COCKPIT", "LANDING", "AUTOPILOT", "ALTITUDE", "FUSELAGE", "TURBINE",
			"AIRFIELD", "BOARDING", "TERMINAL", "CLEARANCE", "AIRSPACE", "THROTTLE",
			"AVIONICS", "CROSSWIND", "NAVIGATOR", "PROPELLER", "TAXIWAY", "COMPASS",
			"HEADWIND", "TAILWIND", "AIRSTRIP", "ELEVATOR", "DEPARTURE", "APPROACH",
			"TAKEOFF",
		],
	},
	cs: {
		easy: [
			"LET", "PAS", "VIR", "KOL", "TYL", "BEH", "RYK", "TUK", "PLN", "TOR",
			"DRAK", "TRUP", "KOLO", "PLYN", "TANK", "MOST", "PORT", "KURS", "HALA",
			"PARK", "BOLT", "STAN", "RADA", "PLAT", "OSOV", "BRAN", "TYRL", "HROT",
		],
		medium: [
			"PILOT", "RADAR", "MOTOR", "KOKPIT", "PISTA", "LETUN", "TUNEL", "PALBA",
			"OBLAST", "SEVER", "TURBO", "TRASA", "START", "ODPOR", "PROUD", "OBLAK",
			"OBLOHA", "ROTACE", "KABINA", "VRTUL", "PLAST",
		],
		hard: [
			"NAVIGACE", "AUTOPILOT", "TERMINAL", "KONTROLA", "MECHANIK",
			"PRISTANI", "VZLETOVA", "VZDUSNIK", "VRTULNIK", "PRETIZENI",
			"PRILETY", "ODMRAZENI", "OSVETLENI", "ODLETOVA", "PODVOZEK",
			"PRIBLIZENI", "POJIZDENI", "VYSILACKA", "ODPOCINEK",
		],
	},
	de: {
		easy: [
			"JET", "GAS", "ART", "RAD", "ARM", "HUB", "TAL", "RAN", "ORT", "BOG",
			"LUFT", "FLUG", "WIND", "TURM", "GURT", "LAND", "TANK", "ZOLL", "MAST",
			"REST", "RUHE", "DECK", "BOOT", "GANG", "SEIL", "KIEL", "STAB", "FUNK",
		],
		medium: [
			"PILOT", "RADAR", "WOLKE", "STURM", "MOTOR", "ROTOR", "ROUTE", "ORBIT",
			"DELTA", "ALPHA", "BRAVO", "HOTEL", "BREMSE", "PISTE", "STALL", "DAMPF",
			"KLIMA", "SOLAR", "KRAFT", "METALL", "BRAND", "DRALL", "KLAPPE", "NEBEL",
			"BLITZ", "HALLE", "GLEISE", "KURVE", "NORDEN", "FRACHT",
		],
		hard: [
			"COCKPIT", "LANDUNG", "AUTOPILOT", "TURBINE", "TERMINAL",
			"STEUERUNG", "FLUGHAFEN", "STARTBAHN", "FLUGROUTE", "KOMPASS",
			"TRIEBWERK", "GEGENWIND", "NAVIGATOR", "ROLLBAHN", "LANDEBAHN",
			"ABFERTIGUNG", "HOHENMESSER", "RUMPFWERK",
		],
	},
	es: {
		easy: [
			"VIA", "SOL", "MAR", "SUR", "RED", "GAS", "ALA", "EJE", "TOR", "RUM",
			"AVIO", "COLA", "RUTA", "MAPA", "GIRO", "POLO", "FARO", "ARCO", "RAYO",
			"RIEL", "MURO", "PISO", "BASE", "CIMA", "ZONA", "PESO", "NAVE", "LIRA",
		],
		medium: [
			"PILOTO", "RADAR", "MOTOR", "PISTA", "TORRE", "VUELO", "NORTE", "CARGO",
			"DELTA", "OSCAR", "HOTEL", "INDIA", "ROTOR", "FRENO", "BRISA", "ORBITA",
			"TURBO", "SOLAR", "METAL", "LLAMA", "BRAVO", "ALPHA", "AVION", "TANGO",
			"RUMBO", "FLOTA", "CURVA", "RAMPA", "CABINA",
		],
		hard: [
			"ATERRIZAJE", "AUTOPILOT", "TURBINA", "TERMINAL", "FUSELAJE",
			"ALTITUD", "DESPEGUE", "NAVEGANTE", "PILOTAJE", "RODADURA",
			"AEROPUERTO", "TRIPULACION", "COMBUSTIBLE", "APROXIMACION",
		],
	},
	fr: {
		easy: [
			"AIR", "VOL", "GAZ", "CAP", "AXE", "ARC", "FER", "NET", "VIS", "ART",
			"AILE", "VENT", "TOUR", "PIED", "PORT", "GARE", "BORD", "PONT", "QUAI",
			"NUIT", "ZONE", "FRET", "CAMP", "BASE", "MIRE", "ARME", "DARD", "FACE",
		],
		medium: [
			"PILOTE", "RADAR", "NUAGE", "MOTEUR", "CABINE", "PISTE", "CARGO",
			"DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA", "TANGO",
			"ROTOR", "FREIN", "ORBITE", "TURBO", "VAPEUR", "FLAMME",
			"METAL", "ROUTE", "VIRAGE", "HANGAR", "PHARE", "BRISE", "ONDES",
			"FLAIR",
		],
		hard: [
			"COCKPIT", "TURBINE", "TERMINAL", "AUTOPILOTE", "FUSELAGE",
			"ATTERRISSAGE", "DECOLLAGE", "ALTITUDE", "NAVIGATEUR",
			"AEROPORT", "APPROCHE", "ROULEMENT", "EQUIPAGE", "CONTROLE",
			"CARBURANT", "AIGUILLAGE",
		],
	},
	hi: {
		easy: [
			"JET", "FLY", "AIR", "MAP", "SKY", "FOG", "ICE", "GAS", "CAB", "HUB",
			"CREW", "TAXI", "WING", "GEAR", "DECK", "LAND", "FUEL", "GATE", "BELT",
			"TAIL", "TURN", "DRAG", "PROP", "MACH", "LIFT", "LOOP", "ROLL", "WIND",
		],
		medium: [
			"PILOT", "TOWER", "RADAR", "CABIN", "CLOUD", "STORM", "FLAPS", "CARGO",
			"ROUTE", "ORBIT", "DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA",
			"TANGO", "CLIMB", "GLIDE", "DRIFT", "WINGS", "STALL", "GAUGE", "TURBO",
			"BLADE", "SURGE", "FLAME", "SPEED", "BRAKE", "METAL",
		],
		hard: [
			"COCKPIT", "LANDING", "AUTOPILOT", "ALTITUDE", "FUSELAGE", "TURBINE",
			"TERMINAL", "BOARDING", "AIRFIELD", "THROTTLE", "CROSSWIND",
			"NAVIGATOR", "PROPELLER", "TAXIWAY", "COMPASS", "HEADWIND",
		],
	},
	it: {
		easy: [
			"JET", "ALA", "VIA", "GAS", "ARC", "ETA", "SOL", "ORT", "ACE", "REM",
			"ARIA", "VOLO", "CODA", "ROTA", "MURO", "ARCO", "BASE", "ZONA", "NAVE",
			"POLO", "FARO", "PALO", "VITE", "ASSE", "TUBO", "URTO",
		],
		medium: [
			"PILOTA", "RADAR", "MOTORE", "CABINA", "PISTA", "TORRE", "NUVOLA",
			"DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA", "TANGO",
			"ROTORE", "FRENO", "ORBITA", "TURBO", "VAPORE", "FIAMMA",
			"VENTO", "STALLO", "CARGO", "ROTTA", "VIRATA", "HANGAR", "RAMPA",
		],
		hard: [
			"COCKPIT", "TURBINA", "TERMINALE", "AUTOPILOTA", "FUSOLIERA",
			"ATTERRAGGIO", "ALTITUDINE", "NAVIGATORE", "EQUIPAGGIO",
			"AEROPORTO", "RULLAGGIO", "AVVICINAMENTO", "BUSSOLA", "DECOLLO",
			"METALLO",
		],
	},
	ja: {
		easy: [
			"JET", "FLY", "AIR", "MAP", "SKY", "FOG", "ICE", "GAS", "CAB", "HUB",
			"CREW", "TAXI", "WING", "GEAR", "DECK", "LAND", "FUEL", "GATE", "BELT",
			"TAIL", "TURN", "DRAG", "PROP", "MACH", "LIFT", "LOOP", "ROLL", "WIND",
		],
		medium: [
			"PILOT", "TOWER", "RADAR", "CABIN", "CLOUD", "STORM", "FLAPS", "CARGO",
			"ROUTE", "ORBIT", "DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA",
			"TANGO", "CLIMB", "GLIDE", "DRIFT", "WINGS", "STALL", "GAUGE", "TURBO",
			"BLADE", "SURGE", "FLAME", "SPEED", "BRAKE", "METAL",
		],
		hard: [
			"COCKPIT", "LANDING", "AUTOPILOT", "ALTITUDE", "FUSELAGE", "TURBINE",
			"TERMINAL", "BOARDING", "AIRFIELD", "THROTTLE", "CROSSWIND",
			"NAVIGATOR", "PROPELLER", "TAXIWAY", "COMPASS", "HEADWIND",
		],
	},
	ko: {
		easy: [
			"JET", "FLY", "AIR", "MAP", "SKY", "FOG", "ICE", "GAS", "CAB", "HUB",
			"CREW", "TAXI", "WING", "GEAR", "DECK", "LAND", "FUEL", "GATE", "BELT",
			"TAIL", "TURN", "DRAG", "PROP", "MACH", "LIFT", "LOOP", "ROLL", "WIND",
		],
		medium: [
			"PILOT", "TOWER", "RADAR", "CABIN", "CLOUD", "STORM", "FLAPS", "CARGO",
			"ROUTE", "ORBIT", "DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA",
			"TANGO", "CLIMB", "GLIDE", "DRIFT", "WINGS", "STALL", "GAUGE", "TURBO",
			"BLADE", "SURGE", "FLAME", "SPEED", "BRAKE", "METAL",
		],
		hard: [
			"COCKPIT", "LANDING", "AUTOPILOT", "ALTITUDE", "FUSELAGE", "TURBINE",
			"TERMINAL", "BOARDING", "AIRFIELD", "THROTTLE", "CROSSWIND",
			"NAVIGATOR", "PROPELLER", "TAXIWAY", "COMPASS", "HEADWIND",
		],
	},
	pl: {
		easy: [
			"LOT", "GAZ", "TOR", "SOL", "PAS", "NET", "LAD", "KOL", "RAN", "BEG",
			"SMOG", "MOST", "PORT", "GURT", "PARK", "TANK", "BAZA", "FALA", "STER",
			"KURS", "TRUP", "DACH", "MASZ", "BIEG", "LINA", "WAGA",
		],
		medium: [
			"PILOT", "RADAR", "MOTOR", "KABINA", "BURZA", "ROTOR", "TRASA", "ORBITA",
			"DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "TURBO", "METAL", "WZNOS",
			"OSTRZE", "SOLAR", "HANGAR", "KLAPA", "PASMO", "NAWIEW", "KLAPY",
			"ODLOT", "RAMPA", "POMOST", "CHMURA",
		],
		hard: [
			"COCKPIT", "TURBINA", "TERMINAL", "AUTOPILOT", "LADOWANIE",
			"NAWIGATOR", "LOTNISKO", "KONTROLA", "WIATRACZEK", "STEROWANIE",
			"PODWOZIE", "PODEJSCIE", "ROLOWANIE", "SMIGLOWIEC",
		],
	},
	pt: {
		easy: [
			"JET", "SOL", "MAR", "VIA", "GAS", "ARC", "EIX", "VIS", "HUB", "AXE",
			"NAVE", "ROTA", "MAPA", "ARCO", "BASE", "ZONA", "POLO", "FARO", "PISO",
			"EIXO", "TUBO", "FACE", "REDE", "LIRA", "ALVO",
		],
		medium: [
			"PILOTO", "RADAR", "MOTOR", "CABINA", "PISTA", "TORRE", "NUVEM",
			"DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA", "TANGO",
			"ROTOR", "FREIO", "ORBITA", "TURBO", "SOLAR", "METAL",
			"VAPOR", "CHAMA", "CURVA", "RAMPA", "HANGAR", "CARGO", "VENTO",
		],
		hard: [
			"COCKPIT", "TURBINA", "TERMINAL", "AUTOPILOTO", "FUSELAGEM",
			"ATERRISSAGEM", "ALTITUDE", "NAVEGADOR", "AEROPORTO",
			"TAXIAMENTO", "PILOTAGEM", "COMBUSTIVEL", "BUSSOLA",
			"APROXIMACAO", "TRIPULACAO", "DECOLAGEM",
		],
	},
	zh: {
		easy: [
			"JET", "FLY", "AIR", "MAP", "SKY", "FOG", "ICE", "GAS", "CAB", "HUB",
			"CREW", "TAXI", "WING", "GEAR", "DECK", "LAND", "FUEL", "GATE", "BELT",
			"TAIL", "TURN", "DRAG", "PROP", "MACH", "LIFT", "LOOP", "ROLL", "WIND",
		],
		medium: [
			"PILOT", "TOWER", "RADAR", "CABIN", "CLOUD", "STORM", "FLAPS", "CARGO",
			"ROUTE", "ORBIT", "DELTA", "ALPHA", "BRAVO", "OSCAR", "HOTEL", "INDIA",
			"TANGO", "CLIMB", "GLIDE", "DRIFT", "WINGS", "STALL", "GAUGE", "TURBO",
			"BLADE", "SURGE", "FLAME", "SPEED", "BRAKE", "METAL",
		],
		hard: [
			"COCKPIT", "LANDING", "AUTOPILOT", "ALTITUDE", "FUSELAGE", "TURBINE",
			"TERMINAL", "BOARDING", "AIRFIELD", "THROTTLE", "CROSSWIND",
			"NAVIGATOR", "PROPELLER", "TAXIWAY", "COMPASS", "HEADWIND",
		],
	},
};

export function getWordPool(lang: Language, difficulty: Difficulty): string[] {
	return pools[lang]?.[difficulty] ?? pools.en[difficulty];
}

export function pickWord(lang: Language, difficulty: Difficulty): string {
	const pool = getWordPool(lang, difficulty);
	return pool[Math.floor(Math.random() * pool.length)];
}
