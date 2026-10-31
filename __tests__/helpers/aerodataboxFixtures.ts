/**
 * AeroDataBox `GET /flights/number/{number}/{date}` response fixtures, shaped
 * after the published OpenAPI models (FlightContract →
 * FlightAirportMovementContract → ListingAirportContract / DateTimeContract;
 * times as "YYYY-MM-DD HH:mmZ" / "YYYY-MM-DD HH:mm±hh:mm"). Not recorded from
 * the live API — re-record from a real call when the account exists.
 */

function movement(
  iata: string,
  icao: string,
  name: string,
  city: string,
  timeZone: string,
  utc: string,
  local: string
) {
  return {
    airport: {
      countryCode: "XX",
      iata,
      icao,
      municipalityName: city,
      name,
      shortName: name,
      timeZone,
    },
    quality: ["Basic"],
    scheduledTime: { local, utc },
    terminal: "1",
  };
}

const PRG = (utc: string, local: string) =>
  movement(
    "PRG",
    "LKPR",
    "Prague Vaclav Havel",
    "Prague",
    "Europe/Prague",
    utc,
    local
  );
const CDG = (utc: string, local: string) =>
  movement(
    "CDG",
    "LFPG",
    "Paris Charles de Gaulle",
    "Paris",
    "Europe/Paris",
    utc,
    local
  );
const DOH = (utc: string, local: string) =>
  movement("DOH", "OTHH", "Doha Hamad", "Doha", "Asia/Qatar", utc, local);
const AKL = (utc: string, local: string) =>
  movement(
    "AKL",
    "NZAA",
    "Auckland",
    "Auckland",
    "Pacific/Auckland",
    utc,
    local
  );
const SYD = (utc: string, local: string) =>
  movement(
    "SYD",
    "YSSY",
    "Sydney Kingsford Smith",
    "Sydney",
    "Australia/Sydney",
    utc,
    local
  );

/** One leg, operated by the queried carrier. */
export const singleLeg = [
  {
    airline: { iata: "OK", icao: "CSA", name: "CSA Czech Airlines" },
    arrival: CDG("2026-11-14 09:55Z", "2026-11-14 10:55+01:00"),
    codeshareStatus: "IsOperator",
    departure: PRG("2026-11-14 08:00Z", "2026-11-14 09:00+01:00"),
    isCargo: false,
    lastUpdatedUtc: "2026-10-30 12:00Z",
    number: "OK 766",
    status: "Expected",
  },
];

/**
 * Same number, two legs the same day (DOH→SYD→AKL style through-flight),
 * plus the previous day's rotation *arriving* on the requested date.
 */
export const multiLeg = [
  {
    arrival: AKL("2026-11-15 05:00Z", "2026-11-15 18:00+13:00"),
    codeshareStatus: "IsOperator",
    departure: SYD("2026-11-15 01:30Z", "2026-11-15 12:30+11:00"),
    number: "QR 920",
  },
  {
    arrival: SYD("2026-11-14 19:00Z", "2026-11-15 06:00+11:00"),
    codeshareStatus: "IsOperator",
    departure: DOH("2026-11-14 05:00Z", "2026-11-14 08:00+03:00"),
    number: "QR 920",
  },
  {
    // Departed the 13th, arrives the 14th — must not be chosen.
    arrival: SYD("2026-11-13 19:00Z", "2026-11-14 06:00+11:00"),
    codeshareStatus: "IsOperator",
    departure: DOH("2026-11-13 05:00Z", "2026-11-13 08:00+03:00"),
    number: "QR 920",
  },
];

/** Marketing number of a codeshare + the operating entry of the same leg. */
export const codeshare = [
  {
    arrival: CDG("2026-11-14 09:55Z", "2026-11-14 10:55+01:00"),
    codeshareStatus: "IsCodeshared",
    departure: PRG("2026-11-14 08:00Z", "2026-11-14 09:00+01:00"),
    number: "AF 4911",
  },
  {
    arrival: CDG("2026-11-14 09:55Z", "2026-11-14 10:55+01:00"),
    codeshareStatus: "IsOperator",
    departure: PRG("2026-11-14 08:00Z", "2026-11-14 09:00+01:00"),
    number: "OK 766",
  },
  {
    arrival: CDG("2026-11-14 09:55Z", "2026-11-14 10:55+01:00"),
    codeshareStatus: "IsCodeshared",
    departure: PRG("2026-11-14 08:00Z", "2026-11-14 09:00+01:00"),
    number: "KL 2286",
  },
];

/** Older API versions: flat scheduledTimeUtc / scheduledTimeLocal fields. */
export const legacyFlatTimes = [
  {
    arrival: {
      airport: { iata: "CDG", icao: "LFPG", name: "Paris Charles de Gaulle" },
      scheduledTimeLocal: "2026-11-14T10:55:00+01:00",
      scheduledTimeUtc: "2026-11-14T09:55:00Z",
    },
    departure: {
      airport: { iata: "PRG", icao: "LKPR", name: "Prague" },
      scheduledTimeLocal: "2026-11-14T09:00:00+01:00",
      scheduledTimeUtc: "2026-11-14T08:00:00Z",
    },
    number: "OK766",
  },
];

/** Partial data: no arrival airport → unusable. */
export const missingArrival = [
  {
    departure: PRG("2026-11-14 08:00Z", "2026-11-14 09:00+01:00"),
    number: "OK 766",
  },
];
