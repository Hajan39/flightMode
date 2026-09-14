import type { TranslationKey } from "@/i18n/translations";

/**
 * Category Blitz prompts. Each is a translation key, so the game works in all
 * 12 languages without a word list — players say answers out loud and the
 * others judge, the app only counts taps.
 */
export const categoryBlitzKeys: TranslationKey[] = [
	"cbzCatAirlines",
	"cbzCatCapitals",
	"cbzCatIslands",
	"cbzCatSuitcase",
	"cbzCatAirportShops",
	"cbzCatBeachItems",
	"cbzCatColdCountries",
	"cbzCatHotCountries",
	"cbzCatBreakfastFoods",
	"cbzCatStreetFood",
	"cbzCatDrinks",
	"cbzCatFruits",
	"cbzCatLandmarks",
	"cbzCatMuseumThings",
	"cbzCatTransport",
	"cbzCatThingsWithWheels",
	"cbzCatThingsThatFly",
	"cbzCatSeaCreatures",
	"cbzCatDesertAnimals",
	"cbzCatMountainGear",
	"cbzCatHotelRoom",
	"cbzCatBathroomItems",
	"cbzCatCarryOnBanned",
	"cbzCatDocuments",
	"cbzCatWeatherWords",
	"cbzCatSouvenirs",
	"cbzCatCurrencies",
	"cbzCatLanguages",
	"cbzCatEuropeanCities",
	"cbzCatAsianCities",
	"cbzCatBoardGames",
	"cbzCatSports",
	"cbzCatMusicGenres",
	"cbzCatMovieGenres",
	"cbzCatJobsAtAirport",
	"cbzCatThingsInSky",
	"cbzCatRedThings",
	"cbzCatThingsYouQueueFor",
	"cbzCatSmells",
	"cbzCatWaysToRelax",
];

export const ROUNDS_PER_PLAYER = 3;
export const TURN_SECONDS = 20;
