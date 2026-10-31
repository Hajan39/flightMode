/**
 * Main passenger airports (IATA) serving each bundled destination, used to
 * pick the destination when a flight lookup returns the arrival airport.
 *
 * Keyed by `Destination.id`; `__tests__/flightLookupFill.test.ts` checks that
 * every destination has an entry and no code maps to two destinations.
 * Kyoto has no airport of its own (KIX / ITM are listed under Osaka), so it
 * is deliberately empty — a lookup to KIX picks Osaka.
 */
export const destinationAirports: Record<string, readonly string[]> = {
  amsterdam: ["AMS"],
  athens: ["ATH"],
  auckland: ["AKL"],
  bali: ["DPS"],
  bangkok: ["BKK", "DMK"],
  barcelona: ["BCN"],
  berlin: ["BER"],
  budapest: ["BUD"],
  "buenos-aires": ["EZE", "AEP"],
  cairo: ["CAI"],
  "cape-town": ["CPT"],
  copenhagen: ["CPH"],
  delhi: ["DEL"],
  doha: ["DOH"],
  dubai: ["DXB", "DWC"],
  hanoi: ["HAN"],
  istanbul: ["IST", "SAW"],
  "kuala-lumpur": ["KUL"],
  kyoto: [],
  lima: ["LIM"],
  lisbon: ["LIS"],
  london: ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"],
  madrid: ["MAD"],
  marrakech: ["RAK"],
  "mexico-city": ["MEX", "NLU"],
  nairobi: ["NBO"],
  "new-york": ["JFK", "EWR", "LGA"],
  osaka: ["KIX", "ITM"],
  paris: ["CDG", "ORY"],
  prague: ["PRG"],
  reykjavik: ["KEF", "RKV"],
  "rio-de-janeiro": ["GIG", "SDU"],
  rome: ["FCO", "CIA"],
  "san-francisco": ["SFO"],
  seoul: ["ICN", "GMP"],
  singapore: ["SIN"],
  stockholm: ["ARN", "BMA"],
  sydney: ["SYD"],
  tokyo: ["NRT", "HND"],
  toronto: ["YYZ", "YTZ"],
  vancouver: ["YVR"],
  vienna: ["VIE"],
  warsaw: ["WAW", "WMI"],
  zurich: ["ZRH"],
};

/** Destination id whose airports include `iata`, else undefined. */
export function findDestinationIdByAirport(
  iata: string | undefined
): string | undefined {
  if (!iata) {
    return undefined;
  }
  const code = iata.trim().toUpperCase();
  for (const [id, codes] of Object.entries(destinationAirports)) {
    if (codes.includes(code)) {
      return id;
    }
  }
  return undefined;
}
