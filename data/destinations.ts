/**
 * Bundled destination & airport tips (Phase 2 content).
 *
 * All copy is plain English string literals on purpose — this is offline
 * bundled content and is NOT routed through t()/useTranslation. City and
 * country names are proper nouns and stay untranslated.
 *
 * Single source of truth: `destinations` array + `getDestinationById()`.
 */

/** A single practical tip shown under a destination. */
export type DestinationTip = {
	/** Ionicons glyph name (e.g. "train-outline"). */
	icon: string;
	/** Short category label for the tip. */
	label: string;
	/** 1–2 sentence practical advice. */
	text: string;
};

/** A popular flight destination with a set of arrival/local tips. */
export type Destination = {
	id: string;
	city: string;
	country: string;
	emoji: string;
	tips: DestinationTip[];
};

export const destinations: Destination[] = [
	{
		id: "tokyo",
		city: "Tokyo",
		country: "Japan",
		emoji: "🗼",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Narita, the Narita Express or Keisei Skyliner reach central Tokyo in about an hour; from Haneda the Keikyu Line and monorail are faster and cheaper.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy a Suica or PASMO IC card and tap it on every train, subway, and bus. The metro is spotless and punctual, but avoid the 8–9am rush if you can.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Ramen shops, izakayas, and department-store food halls (depachika) offer superb cheap meals. Slurping noodles is polite, and tap water is safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Carry some cash — many small restaurants are cash-only — though IC cards and contactless are widely accepted. Tipping is not expected and can cause confusion.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "Keep your voice low on trains and don't eat while walking. A slight bow and removing your shoes when entering homes or some restaurants are appreciated.",
			},
		],
	},
	{
		id: "paris",
		city: "Paris",
		country: "France",
		emoji: "🗼",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Charles de Gaulle the RER B train reaches the city in about 35 minutes; official taxis charge a fixed flat fare to central Paris — ignore drivers who approach you inside the terminal.",
			},
			{
				icon: "walk-outline",
				label: "Getting around",
				text: "The metro covers everything and a carnet or Navigo Easy pass saves money. Central neighborhoods are compact and very walkable.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Book dinner or eat where locals do rather than tourist strips near landmarks. Bakeries (boulangeries) are great value for breakfast and lunch.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Service is included by law, so tipping is optional — rounding up or leaving a euro or two for good service is plenty. Cards are accepted almost everywhere.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Pickpocketing is common on the metro and around major sights. Greet shopkeepers with 'Bonjour' before asking anything — skipping it is considered rude.",
			},
		],
	},
	{
		id: "new-york",
		city: "New York",
		country: "United States",
		emoji: "🗽",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From JFK take the AirTrain to the subway or LIRR; from Newark the AirTrain connects to NJ Transit. Yellow cabs from JFK to Manhattan use a fixed flat fare.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Tap a contactless card or phone (OMNY) straight onto subway turnstiles. The subway runs 24/7, and Manhattan's numbered grid makes walking easy.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Bodegas, food carts, and pizza slices are cheap and everywhere. Portions are large, so sharing is common.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Tipping is expected: 18–20% at sit-down restaurants and a dollar or two per drink at bars. Listed prices don't include sales tax, which is added at checkout.",
			},
			{
				icon: "walk-outline",
				label: "Local note",
				text: "Keep left-standing, right-walking clear on escalators and don't stop suddenly on busy sidewalks. New Yorkers move fast and appreciate quick, direct questions.",
			},
		],
	},
	{
		id: "barcelona",
		city: "Barcelona",
		country: "Spain",
		emoji: "🏖️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Aerobús runs frequently between El Prat airport and Plaça Catalunya in about 35 minutes; the R2 Nord train and metro L9 Sud are cheaper alternatives.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "A T-casual multi-trip ticket covers metro, tram, and bus. The center is flat and walkable, and the metro reaches the beach and Sagrada Família easily.",
			},
			{
				icon: "wine-outline",
				label: "Food",
				text: "Locals eat late — lunch around 2pm and dinner after 9pm. Seek out tapas bars away from La Rambla for better quality and prices.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Tipping is modest: round up or leave small change for good service. Cards are widely accepted, but keep a few euros for small bars.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Barcelona has persistent pickpockets on La Rambla, the metro, and the beach — keep bags zipped and in front of you. Many locals speak Catalan; a 'Bon dia' greeting goes a long way.",
			},
		],
	},
	{
		id: "amsterdam",
		city: "Amsterdam",
		country: "Netherlands",
		emoji: "🚲",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "Trains from Schiphol reach Amsterdam Centraal in about 15–20 minutes and run very frequently. Buy a ticket from the yellow machines or tap a contactless card.",
			},
			{
				icon: "bicycle-outline",
				label: "Getting around",
				text: "Trams and the compact center make it easy to explore; an OV-chipkaart or contactless card works on all transit. Watch for cyclists constantly — bike lanes are not sidewalks.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Try Dutch snacks like herring, stroopwafels, and bitterballen. 'Coffeeshops' sell cannabis, while a normal café (koffiehuis) is where you get actual coffee.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Rounding up or leaving 5–10% is normal for good service. Many shops and cafés are card-only, so a contactless card or phone is essential.",
			},
			{
				icon: "warning-outline",
				label: "Local note",
				text: "Never walk in the red bike lanes and always look both ways for silent bikes. Photographing people in the Red Light District is prohibited and taken seriously.",
			},
		],
	},
	{
		id: "dubai",
		city: "Dubai",
		country: "United Arab Emirates",
		emoji: "🕌",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "The Metro Red Line connects the airport to downtown cheaply, or use the official taxi rank. Ride-hailing apps like Careem and Uber are reliable and metered.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy a Nol card for the driverless Metro, trams, and buses. Distances are large and it gets very hot, so plan indoor and evening activities.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Food ranges from cheap South Asian and Lebanese spots to lavish buffets. During Ramadan, eating or drinking in public during daylight is restricted.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the dirham (AED); cards are accepted everywhere but keep cash for taxis and markets. A 10% tip is appreciated but not obligatory.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Dress modestly in malls and public areas — cover shoulders and knees. Public displays of affection and drinking outside licensed venues can bring fines.",
			},
		],
	},
	{
		id: "bangkok",
		city: "Bangkok",
		country: "Thailand",
		emoji: "🛕",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Airport Rail Link from Suvarnabhumi reaches the city in about 30 minutes and avoids traffic. If taking a taxi, insist the driver use the meter.",
			},
			{
				icon: "boat-outline",
				label: "Getting around",
				text: "The BTS Skytrain and MRT beat Bangkok's heavy traffic, and river ferries are a scenic way to reach temples. Tuk-tuks are fun but agree the price before you get in.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Street food is excellent, cheap, and generally safe where stalls are busy. Stick to bottled water and be cautious with ice from unknown vendors.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Carry cash in baht for markets, street food, and taxis. Tipping isn't required, but rounding up or leaving small change is a kind gesture.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "Cover shoulders and knees and remove shoes to enter temples. Never touch someone's head or point your feet at people or Buddha images — both are disrespectful.",
			},
		],
	},
	{
		id: "rome",
		city: "Rome",
		country: "Italy",
		emoji: "🏛️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Fiumicino the Leonardo Express train runs to Termini station in about 32 minutes; official taxis charge a fixed flat fare to the city center.",
			},
			{
				icon: "walk-outline",
				label: "Getting around",
				text: "The historic center is best explored on foot, with the metro and buses filling gaps. Validate paper transit tickets when you board or risk a fine.",
			},
			{
				icon: "pizza-outline",
				label: "Food",
				text: "Eat where menus aren't translated into ten languages for better, cheaper meals. A cover charge (coperto) is normal, and coffee is cheaper standing at the bar.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Tipping is minimal — round up or leave a euro or two, as service is often included. Carry some cash for small cafés and market stalls.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Watch for pickpockets on crowded buses (especially the 64) and around major sights. Refill your bottle at the free public 'nasoni' drinking fountains.",
			},
		],
	},
];

/** Look up a single destination by its id. */
export function getDestinationById(id: string): Destination | undefined {
	return destinations.find((destination) => destination.id === id);
}
