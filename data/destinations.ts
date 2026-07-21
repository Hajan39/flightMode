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
	{
		id: "london",
		city: "London",
		country: "United Kingdom",
		emoji: "🎡",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Heathrow the Piccadilly line is the cheapest route into the centre, while the Elizabeth line is faster; Gatwick, Stansted, and Luton have their own express trains to central stations.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Just tap a contactless card or phone on the Tube and buses — daily fares cap automatically, so no travelcard is needed. Stand on the right on escalators.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Beyond pubs, try the diverse food markets like Borough or Brick Lane for great-value meals. Tap water is free and safe, and you must ask for it in restaurants.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the pound sterling and cards are accepted almost everywhere. Restaurants often add a 12.5% service charge — check the bill so you don't tip twice.",
			},
			{
				icon: "walk-outline",
				label: "Local note",
				text: "Look right first when crossing — traffic drives on the left. Queuing is taken seriously, so join the back of the line and never push in.",
			},
		],
	},
	{
		id: "singapore",
		city: "Singapore",
		country: "Singapore",
		emoji: "🦁",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Changi the MRT reaches the city in about 40 minutes and is very cheap; official metered taxis and ride-hailing apps like Grab are reliable alternatives.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Tap a contactless card or phone straight onto the spotless, air-conditioned MRT and buses. The network is easy to navigate and signposted in English.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Hawker centres serve outstanding, cheap meals like Hainanese chicken rice and laksa. Reserve a table by leaving a packet of tissues on it, as locals do.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Singapore dollar and cards are accepted widely. Tipping is not customary, and a 10% service charge is usually already included on bills.",
			},
			{
				icon: "warning-outline",
				label: "Local note",
				text: "Laws are strictly enforced: littering, jaywalking, and eating or drinking on the MRT bring fines. Chewing gum is banned from sale, so don't bring large quantities.",
			},
		],
	},
	{
		id: "istanbul",
		city: "Istanbul",
		country: "Türkiye",
		emoji: "🕌",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Istanbul Airport (IST) the M11 metro connects to the wider network, or the HAVAIST bus reaches central districts. If taking a taxi, insist the meter is running.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy an Istanbulkart and tap it on metros, trams, buses, and ferries. Crossing the Bosphorus by ferry between the European and Asian sides is cheap and scenic.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try street simit, kebabs, and mezes, and finish with strong Turkish tea or coffee. Stick to bottled water, as the tap water is not recommended for drinking.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Turkish lira; carry cash for markets and small eateries. Tipping around 10% is customary in restaurants for good service.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Cover shoulders and knees to enter mosques, and women should carry a scarf for their head. Remove your shoes at the entrance and avoid visiting during prayer times.",
			},
		],
	},
	{
		id: "sydney",
		city: "Sydney",
		country: "Australia",
		emoji: "🌉",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Airport Link train reaches the city centre in about 15 minutes but carries a station access fee. Official taxis and ride-hailing apps queue outside each terminal.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Tap a contactless card or phone on trains, buses, light rail, and ferries — fares cap daily and weekly. The ferry to Manly is a cheap, spectacular harbour trip.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Sydney's café culture is world-class, so try a flat white and brunch. Fresh seafood at the Fish Market and multicultural eats across the suburbs are excellent value.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Australian dollar and cards are accepted almost everywhere. Tipping is not expected, though rounding up for great service is appreciated.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "The sun is intense — wear sunscreen and a hat even on cool days. At beaches, always swim between the red-and-yellow flags where lifeguards patrol.",
			},
		],
	},
	{
		id: "lisbon",
		city: "Lisbon",
		country: "Portugal",
		emoji: "🚋",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The red metro line links the airport to the centre in about 20 minutes. Official taxis and ride-hailing apps are affordable, and the airport is unusually close to town.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Load a rechargeable Viva Viagem card for the metro, buses, and historic trams. The city is hilly, so use the funiculars and the Santa Justa lift to save your legs.",
			},
			{
				icon: "wine-outline",
				label: "Food",
				text: "Try grilled sardines, bacalhau (salt cod), and a warm pastel de nata custard tart. Neighbourhood tascas away from tourist zones serve hearty, cheap lunches.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Portugal uses the euro and cards are widely accepted, but keep coins for small cafés. Tipping is modest — rounding up or leaving 5–10% is plenty.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Lisbon is very safe, but pickpockets work the crowded 28 tram and metro. Wear sturdy shoes, as the classic calçada cobblestones get slippery when wet.",
			},
		],
	},
	{
		id: "reykjavik",
		city: "Reykjavík",
		country: "Iceland",
		emoji: "🌋",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Keflavík airport is about 45 minutes from the city, linked by the Flybus and Airport Direct coaches rather than a train. Many visitors rent a car to explore beyond town.",
			},
			{
				icon: "walk-outline",
				label: "Getting around",
				text: "Central Reykjavík is small and easily walkable, with city buses (Strætó) filling the gaps. There is no metro, so a rental car is best for the Golden Circle and ring road.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try lamb soup, fresh seafood, and a classic hot dog (pylsur) with all the toppings. Eating out is pricey, so tap water — some of the purest anywhere — is free and delicious.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Icelandic króna, but Iceland is nearly cashless — cards work everywhere, even for tiny purchases. Tipping is not expected as service is included.",
			},
			{
				icon: "warning-outline",
				label: "Safety",
				text: "Weather changes fast, so pack windproof, waterproof layers year-round. Check road and aurora conditions before driving, and always shower before entering geothermal pools.",
			},
		],
	},
];

/** Look up a single destination by its id. */
export function getDestinationById(id: string): Destination | undefined {
	return destinations.find((destination) => destination.id === id);
}
