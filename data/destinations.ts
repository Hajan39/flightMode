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
	{
		id: "seoul",
		city: "Seoul",
		country: "South Korea",
		emoji: "🏙️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Incheon (ICN) the AREX Airport Railroad Express reaches Seoul Station in about 45 minutes; official taxis and airport limousine buses serve every district.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy a rechargeable T-money card and tap it on the vast, cheap subway and buses. Trains are signposted in English and run frequently until around midnight.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Korean BBQ, bibimbap, and late-night street food are excellent and affordable. Side dishes (banchan) are free and refillable, and tap water is safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the won and cards are accepted almost everywhere, even for tiny purchases. Tipping is not customary and is often politely declined.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "Give and receive money or objects with both hands, especially with elders. Remove your shoes when entering homes and many traditional restaurants.",
			},
		],
	},
	{
		id: "cairo",
		city: "Cairo",
		country: "Egypt",
		emoji: "🐫",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "There is no train from Cairo Airport, so use an official white taxi or a ride-hailing app like Uber or Careem, which are metered and avoid haggling.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The metro is cheap and beats the heavy traffic, with dedicated women-only carriages in the middle of each train. Agree fares before any street-taxi ride.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try koshari, ful medames, and falafel (taameya) from busy local spots. Stick to bottled water and avoid raw salads washed in tap water.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Egyptian pound; carry small notes as small tips (baksheesh) are expected for most services. Cards work in hotels but cash rules elsewhere.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Dress modestly by covering shoulders and knees, and women should carry a scarf for mosques. Ask before photographing people, and remove your shoes to enter mosques.",
			},
		],
	},
	{
		id: "mexico-city",
		city: "Mexico City",
		country: "Mexico",
		emoji: "🌮",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Use the authorized airport taxis booked at the fixed-price booths, or a ride-hailing app rather than hailing a cab outside. The metro is nearby but not luggage-friendly.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The metro and Metrobús are very cheap — load a rechargeable card for both. The city sits at 2,240m, so take the first day slowly while you adjust to the altitude.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Tacos al pastor, tamales, and quesadillas from busy street stalls are superb value. Drink bottled water and choose stalls with a steady local crowd.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the peso; keep cash for markets and street food where cards aren't taken. Tipping 10–15% at restaurants is expected for table service.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Use registered taxis or ride-hailing apps rather than flagging cabs, especially at night. Keep valuables out of sight on crowded metro lines and markets.",
			},
		],
	},
	{
		id: "cape-town",
		city: "Cape Town",
		country: "South Africa",
		emoji: "🏔️",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "The MyCiTi bus links the airport to the city centre, or use a metered taxi or a ride-hailing app like Uber, which are reliable and affordable.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Load a myconnect card for the MyCiTi buses, though renting a car or using apps is easiest for Table Mountain and the coast. Public transit is limited after dark.",
			},
			{
				icon: "wine-outline",
				label: "Food",
				text: "Enjoy a braai (barbecue), fresh seafood, and day trips to the nearby Winelands. Tap water is safe to drink, and restaurants offer excellent value.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the rand and cards are widely accepted. Tipping 10–15% is standard in restaurants, and it's normal to tip petrol attendants and car guards a few rand.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Avoid walking alone after dark and don't display phones or valuables in the open. Use ride-hailing apps at night and check local advice before hiking trails alone.",
			},
		],
	},
	{
		id: "vienna",
		city: "Vienna",
		country: "Austria",
		emoji: "🎻",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The City Airport Train (CAT) reaches Wien Mitte in about 16 minutes, while the S7 suburban train is slower but much cheaper. Official taxis wait outside arrivals.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The U-Bahn, trams, and buses are punctual and extensive — a 24, 48, or 72-hour pass is great value. Validate your ticket before your first ride to avoid a fine.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Try Wiener schnitzel, a sausage from a Würstelstand, and a coffee-house Sachertorte. Lingering for hours over one coffee is a cherished local tradition.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Austria uses the euro; carry some cash as smaller cafés and stands can be card-shy. Round up or add about 5–10% and hand the tip to the server directly.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "A polite 'Grüß Gott' greeting is customary when entering shops. Punctuality is valued, and being quiet and orderly on public transport is expected.",
			},
		],
	},
	{
		id: "bali",
		city: "Denpasar (Bali)",
		country: "Indonesia",
		emoji: "🏝️",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Ngurah Rai (Denpasar) airport has no train, so use the official taxi counter or a ride-hailing app like Grab or Gojek. Many hotels offer cheap pickups worth arranging in advance.",
			},
			{
				icon: "car-outline",
				label: "Getting around",
				text: "There is no public transit network, so hire a private driver, rent a scooter, or use ride-hailing apps. Traffic is heavy, so allow extra time between areas like Seminyak, Ubud, and Uluwatu.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Local warungs serve cheap, tasty nasi goreng, satay, and babi guling. Stick to bottled water and busy stalls, and be cautious with ice from unknown vendors.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the rupiah; carry cash for warungs and markets, as cards aren't accepted everywhere. Tipping isn't expected, but rounding up or leaving 5–10% is appreciated.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Dress modestly at temples and wear a sarong, which is often provided at the entrance. Never touch anyone's head, and step around the small daily offerings (canang sari) left on the ground.",
			},
		],
	},
	{
		id: "marrakech",
		city: "Marrakech",
		country: "Morocco",
		emoji: "🕌",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Marrakech Menara airport is a short ride from the medina; agree the taxi fare before setting off or use a metered petit taxi. Bus 19 is a cheap alternative to the main squares.",
			},
			{
				icon: "walk-outline",
				label: "Getting around",
				text: "The medina is a walkable maze best explored on foot, while petit taxis handle longer trips — insist on the meter or agree a price first. Expect narrow lanes shared with scooters and handcarts.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try tagine, couscous, and fresh mint tea, with Jemaa el-Fna's evening food stalls a lively option. Stick to bottled water and busy stalls for the safest street food.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the dirham and cash rules in the souks, where haggling is expected. Small tips for guides, waiters, and helpers are customary, so keep coins handy.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Dress modestly by covering shoulders and knees, especially away from tourist zones. Ask before photographing people, and expect persistent offers of 'help' with directions that end in a tip request.",
			},
		],
	},
	{
		id: "buenos-aires",
		city: "Buenos Aires",
		country: "Argentina",
		emoji: "💃",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "From Ezeiza airport use an official remis or the Manuel Tienda León shuttle rather than unmarked cabs; ride-hailing apps also work well. The closer Aeroparque airport handles most domestic flights.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy a rechargeable SUBE card to use on the subte (subway), buses, and trains. The subte is cheap and fast, though it closes relatively early at night.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Don't miss the steak (bife), empanadas, and dulce de leche, and note that locals dine late after 9pm. A cover charge (cubierto) is normal, and tap water is safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The peso's value shifts fast, so check current rates; carrying some US dollars in cash can fetch a favorable exchange. Tipping around 10% in cash is customary, as it often can't be added to cards.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Keep valuables out of sight and stay alert around crowded areas and transit. Use official taxis or apps at night, and be wary of anyone 'helpfully' pointing out a stain on your clothes.",
			},
		],
	},
	{
		id: "prague",
		city: "Prague",
		country: "Czechia",
		emoji: "🏰",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Václav Havel airport has no train, so take the Airport Express bus to the main train station or bus 119 to the metro. Use the official AAA taxi rank rather than drivers who approach you.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "A single time-based ticket covers the metro, trams, and buses — validate it in the yellow machine when you board. The three metro lines and historic trams cover the city well.",
			},
			{
				icon: "wine-outline",
				label: "Food",
				text: "Try goulash, svíčková, and roast pork with dumplings, washed down with famously cheap, excellent beer. Skip the tourist-trap restaurants right on Old Town Square for better value.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Czechia uses the koruna, not the euro, so pay in crowns and decline poor 'dynamic currency conversion' on cards. Tipping around 10% is normal — tell the server the total rather than leaving it on the table.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Watch for pickpockets on tram 22 and around Charles Bridge, and only change money at proper banks or ATMs, never street exchangers. Always check the taxi meter is running.",
			},
		],
	},
	{
		id: "toronto",
		city: "Toronto",
		country: "Canada",
		emoji: "🍁",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The UP Express train links Pearson airport to downtown Union Station in about 25 minutes. Official taxis and ride-hailing apps also serve every terminal.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Tap a contactless card or a Presto card on the TTC subway, streetcars, and buses. The subway is straightforward, though streetcars can be slow in heavy traffic.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Toronto's diversity means superb, affordable eats — dim sum, roti, and global street food. Try a peameal bacon sandwich at St. Lawrence Market, and tap water is safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Canadian dollar and cards are accepted almost everywhere; note that sales tax is added at checkout. Tipping 15–20% at restaurants and bars is expected.",
			},
			{
				icon: "walk-outline",
				label: "Local note",
				text: "Canadians queue politely and say 'sorry' and 'thank you' freely. Winters are bitterly cold, so use the underground PATH network to walk between downtown buildings.",
			},
		],
	},
	{
		id: "berlin",
		city: "Berlin",
		country: "Germany",
		emoji: "🐻",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Brandenburg (BER) the FEX airport express and S-Bahn (S9/S45) reach the centre in about 30–45 minutes. Buy a ticket covering zones ABC before boarding.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The U-Bahn, S-Bahn, trams, and buses share one ticket — validate paper ones in the platform machines. There are no barriers, but inspectors do fine riders without a valid ticket.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Try currywurst, döner kebab, and hearty brunch spots across Kreuzberg and Neukölln. Tap water is safe, though restaurants usually serve bottled water by default.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Germany uses the euro and Berlin is surprisingly cash-friendly, so carry some for smaller bars and imbiss stands. Round up or add about 5–10%, telling the server the total as you pay.",
			},
			{
				icon: "walk-outline",
				label: "Local note",
				text: "Never walk in the red-paved bike lanes and wait for the green Ampelmann before crossing, even on empty streets. Sundays are quiet, as most shops and supermarkets close.",
			},
		],
	},
	{
		id: "kyoto",
		city: "Kyoto",
		country: "Japan",
		emoji: "⛩️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "Most visitors arrive via Osaka's Kansai (KIX) airport, where the JR Haruka express reaches Kyoto Station in about 75 minutes. From there taxis and city buses fan out across the city.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy an ICOCA or Suica IC card and tap it on buses and subways; buses are best for temples but get crowded. Pay as you exit city buses, and cycling the flat backstreets is a joy.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try kaiseki, tofu cuisine, matcha sweets, and the food stalls of Nishiki Market. Slurping noodles is fine, and tap water is clean and safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Carry cash, as many temples, small eateries, and older shops are cash-only, though IC cards work widely. Tipping is not practiced and may cause polite confusion.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "Remove your shoes where indicated at temples and traditional inns, and keep quiet in shrines. Do not photograph geisha in Gion without permission — it is disrespectful and sometimes fined.",
			},
		],
	},
	{
		id: "rio-de-janeiro",
		city: "Rio de Janeiro",
		country: "Brazil",
		emoji: "🏖️",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "From Galeão (GIG) there is no train, so use the official BRT/premium airport bus or a ride-hailing app like Uber rather than unmarked cabs. Agree or app-book fares before setting off.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The metro is clean, safe, and cheap along the beach neighborhoods — buy a rechargeable card. Ride-hailing apps fill the gaps, and the tram (bondinho) to Santa Teresa is a scenic ride.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try feijoada, pão de queijo, açaí bowls, and per-kilo buffets (comida a quilo) for great value. Stick to bottled or filtered water, and sip a fresh coconut on the beach.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the real; cards are widely accepted but keep some cash for beach kiosks and markets. A 10% service charge is usually added to restaurant bills, so extra tipping is optional.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Leave valuables in the hotel and take only what you need to the beach — carry a little cash to hand over if mugged. Avoid displaying phones or jewellery, and use apps for transport after dark.",
			},
		],
	},
	{
		id: "athens",
		city: "Athens",
		country: "Greece",
		emoji: "🏛️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "Metro Line 3 links the airport to Syntagma in the centre in about 40 minutes; the X95 express bus runs 24/7 as a cheaper option. Official taxis charge a fixed flat day fare to the centre.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The clean, modern metro reaches most sights — buy and validate a ticket or rechargeable Ath.ena card before boarding. The historic centre around the Acropolis is compact and walkable.",
			},
			{
				icon: "wine-outline",
				label: "Food",
				text: "Fill up on souvlaki, gyros, mezze, and fresh Greek salad at neighbourhood tavernas away from Plaka's tourist strips. Tap water in Athens is safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Greece uses the euro and cards are widely accepted, but keep coins for kiosks (periptera) and small tavernas. Tipping is modest — round up or leave 5–10% for good service.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Watch for pickpockets on the metro and around Monastiraki and Omonia, especially in crowds. Wear sturdy shoes, as the marble paths near the Acropolis get very slippery when wet.",
			},
		],
	},
	{
		id: "hanoi",
		city: "Hanoi",
		country: "Vietnam",
		emoji: "🛵",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Noi Bai airport has no train, so use the official taxi rank, an airport minibus, or a ride-hailing app like Grab. Agree the fare or book in-app first to avoid overcharging.",
			},
			{
				icon: "car-outline",
				label: "Getting around",
				text: "The Old Quarter is best explored on foot, with Grab cars and motorbike taxis (xe om) for longer trips. Public buses are cheap but tricky, and a metro line is slowly expanding.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Don't miss pho, bun cha, banh mi, and egg coffee from busy street-side stalls on tiny plastic stools. Stick to bottled water and be cautious with ice from unknown vendors.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the dong; carry small notes as street food, markets, and taxis are largely cash-only. Tipping isn't expected, but rounding up or leaving small change is appreciated.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "To cross the chaotic streets, walk slowly and steadily so scooters can flow around you. Dress modestly and remove your shoes at temples, and use both hands to pass items to elders.",
			},
		],
	},
	{
		id: "madrid",
		city: "Madrid",
		country: "Spain",
		emoji: "🐻",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Barajas the Metro Line 8 reaches the city in about 20 minutes, or the Cercanías C-1 train links to Atocha and Chamartín. Official taxis charge a fixed flat fare to the centre — use the marked rank.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The metro is fast, cheap, and extensive — buy a rechargeable Multi card that also works on buses. The centre is compact and walkable, and trains run until around 1:30am.",
			},
			{
				icon: "wine-outline",
				label: "Food",
				text: "Locals eat late — lunch around 2:30pm and dinner after 9pm. Hop between tapas bars, where a drink sometimes comes with a free small plate, and try cocido and churros con chocolate.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Spain uses the euro and cards are accepted almost everywhere, but keep coins for small bars. Tipping is modest — round up or leave a euro or two for good service.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Madrid is generally safe, but watch for pickpockets on the metro and around Puerta del Sol and Gran Vía. Summers are very hot, so plan indoor activities during the midday peak.",
			},
		],
	},
	{
		id: "stockholm",
		city: "Stockholm",
		country: "Sweden",
		emoji: "⛴️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Arlanda Express train reaches the centre in about 20 minutes but is pricey; slower Flygbussarna coaches and commuter trains are cheaper. Official taxis have a fixed fare to the city — always agree it first.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The Tunnelbana metro, buses, trams, and ferries share one SL ticket — tap a contactless card or buy in the SL app. The metro's art-filled stations are a sight in themselves.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Take a fika — a coffee and cinnamon bun (kanelbulle) break — as locals do daily. Try Swedish meatballs, herring, and lunch specials (dagens lunch) for the best value.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the krona, not the euro, and Sweden is almost entirely cashless — cards and phones work everywhere. Tipping is not expected as service is included, though rounding up is welcome.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "Swedes value quiet, personal space, and orderly queues, so keep your voice down on transit. Remove your shoes when entering someone's home, and expect a relaxed, punctual approach to plans.",
			},
		],
	},
	{
		id: "delhi",
		city: "Delhi",
		country: "India",
		emoji: "🛺",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Airport Express (Orange Line) metro reaches New Delhi station in about 20 minutes and beats the traffic. Otherwise use the prepaid taxi booth or a ride-hailing app rather than hailing a cab.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "The metro is clean, cheap, and air-conditioned, with women-only carriages at the front of each train. Buy a token or a rechargeable card, and agree fares before any auto-rickshaw ride or use the meter.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Street food like chaat, parathas, and kebabs is superb — choose busy stalls with high turnover. Stick to bottled water, avoid raw salads and ice from unknown vendors, and ease into the spice.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the rupee; carry small notes for markets, rickshaws, and street food that are cash-only. Tipping around 10% is customary in restaurants, and small tips for helpers are appreciated.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Dress modestly by covering shoulders and knees, especially at temples where you must also remove your shoes. Use your right hand to eat and pass items, and ask before photographing people.",
			},
		],
	},
	{
		id: "osaka",
		city: "Osaka",
		country: "Japan",
		emoji: "🏯",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "From Kansai (KIX) the JR Haruka express reaches Shin-Osaka in about 50 minutes, while the Nankai Rapi:t serves Namba. From the closer Itami (ITM) airport the monorail and buses reach the centre quickly.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Buy an ICOCA or Suica IC card and tap it on the subway, JR loop line, and buses. The Midosuji subway line links most major districts, and the compact centre is easy to walk.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Osaka is Japan's street-food capital — don't miss takoyaki, okonomiyaki, and kushikatsu around Dotonbori. There's a no-double-dipping rule for the shared kushikatsu sauce, and tap water is safe to drink.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Carry some cash, as many small eateries and stalls are cash-only, though IC cards and contactless are widely accepted. Tipping is not practiced and can cause confusion.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "Keep your voice low on trains and don't eat while walking. Stand on the right of escalators — the opposite of Tokyo — and remove your shoes when entering homes or traditional restaurants.",
			},
		],
	},
	{
		id: "zurich",
		city: "Zurich",
		country: "Switzerland",
		emoji: "🏔️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "Frequent trains link Zurich Airport to the main station (Hauptbahnhof) in about 10 minutes. Official taxis are available but expensive, so the train is the fast, cheap choice into town.",
			},
			{
				icon: "subway-outline",
				label: "Getting around",
				text: "Trams, buses, and S-Bahn trains share one ZVV ticket — buy it from machines or the app before boarding. The compact centre is very walkable, and everything runs precisely on time.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try cheese fondue, raclette, and rösti, and the local Zürcher Geschnetzeltes veal dish. Eating out is expensive, so lunch menus (Mittagsmenü) offer better value and tap water is clean and free.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "Switzerland uses the Swiss franc, not the euro, and cards are accepted almost everywhere. Service is included, so tipping is minimal — simply round up to the nearest franc for good service.",
			},
			{
				icon: "hand-left-outline",
				label: "Etiquette",
				text: "A polite 'Grüezi' greeting is customary when entering shops, and punctuality is taken seriously. Sundays are quiet with most shops closed, and loud noise or recycling is frowned upon then.",
			},
		],
	},
	{
		id: "lima",
		city: "Lima",
		country: "Peru",
		emoji: "🦙",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Jorge Chávez airport has no train, so use the official taxi counter inside arrivals or a ride-hailing app rather than drivers who approach you. Traffic to Miraflores can take an hour, so allow extra time.",
			},
			{
				icon: "car-outline",
				label: "Getting around",
				text: "The Metropolitano bus rapid-transit line is cheap and beats the traffic along key corridors — load a rechargeable card. Ride-hailing apps are cheap and safer than flagging street taxis.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Lima is a world food capital — don't miss ceviche, lomo saltado, and a pisco sour. Eat ceviche at lunchtime when the fish is freshest, and stick to bottled water.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the sol; carry small notes for taxis and markets as cards aren't taken everywhere. Tipping around 10% is customary in restaurants, and rounding up elsewhere is appreciated.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Keep valuables out of sight and use ride-hailing apps rather than street taxis, especially after dark. Stick to well-trodden districts like Miraflores and Barranco and stay alert in crowds.",
			},
		],
	},
	{
		id: "nairobi",
		city: "Nairobi",
		country: "Kenya",
		emoji: "🦁",
		tips: [
			{
				icon: "car-outline",
				label: "From the airport",
				text: "Jomo Kenyatta airport has no train link, so use an official taxi or a ride-hailing app like Uber or Bolt, which are metered and avoid haggling. Traffic is heavy, so allow plenty of time.",
			},
			{
				icon: "car-outline",
				label: "Getting around",
				text: "Ride-hailing apps are cheap, reliable, and easier than the informal matatu minibuses. Traffic jams are severe, so plan trips outside peak hours and keep doors locked in slow traffic.",
			},
			{
				icon: "restaurant-outline",
				label: "Food",
				text: "Try nyama choma (grilled meat), ugali, and sukuma wiki at busy local spots. Stick to bottled water, and sample Kenyan coffee and chai (spiced tea) while you are here.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the shilling, and mobile money (M-Pesa) is used everywhere, though cash is handy too. Tipping around 10% in restaurants is appreciated, as is a small tip for guides.",
			},
			{
				icon: "shield-checkmark-outline",
				label: "Safety",
				text: "Don't display phones, jewellery, or cash, and use ride-hailing apps after dark rather than walking. Keep car windows up and doors locked in traffic, and check local advice before exploring on foot.",
			},
		],
	},
	{
		id: "vancouver",
		city: "Vancouver",
		country: "Canada",
		emoji: "🏔️",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Canada Line SkyTrain links the airport to downtown in about 25 minutes and runs frequently. Official taxis and ride-hailing apps also serve the terminal, though the train avoids bridge traffic.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "Tap a contactless card or a Compass card on the driverless SkyTrain, buses, and the SeaBus ferry. Downtown is compact and walkable, and the SeaBus to North Vancouver is a scenic, cheap ride.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Vancouver's diversity shines in its sushi, dim sum, and Asian night-market eats, plus fresh Pacific seafood. Tap water is clean and safe, and food trucks downtown offer great-value lunches.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the Canadian dollar and cards are accepted almost everywhere; note that sales tax is added at checkout. Tipping 15–20% at restaurants and bars is expected.",
			},
			{
				icon: "walk-outline",
				label: "Local note",
				text: "Canadians queue politely and say 'sorry' and 'thank you' freely. Rain is frequent, so pack a waterproof jacket, and take advantage of the seawall for walking and cycling.",
			},
		],
	},
	{
		id: "copenhagen",
		city: "Copenhagen",
		country: "Denmark",
		emoji: "🚲",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The Metro (M2) and trains link the airport to the city centre in about 15 minutes and run very frequently. Buy a ticket from the machines or tap a contactless card before boarding.",
			},
			{
				icon: "bicycle-outline",
				label: "Getting around",
				text: "Copenhagen is a cyclist's city, and renting a bike is often the fastest way around. The Metro, buses, and harbour buses share one ticket, and the compact centre is very walkable.",
			},
			{
				icon: "cafe-outline",
				label: "Food",
				text: "Try smørrebrød (open sandwiches), pastries, and hot dogs from a pølsevogn stand. Eating out is pricey, so the street-food halls and lunch specials offer better value, and tap water is free and safe.",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the krone, not the euro, and Denmark is nearly cashless — cards and phones work everywhere. Service is included, so tipping is not expected, though rounding up for great service is welcome.",
			},
			{
				icon: "warning-outline",
				label: "Local note",
				text: "Never walk or stand in the busy blue bike lanes and always look for cyclists before crossing. Danes value quiet and personal space, so keep your voice down on public transport.",
			},
		],
	},
	{
		id: "kuala-lumpur",
		city: "Kuala Lumpur",
		country: "Malaysia",
		emoji: "🕌",
		tips: [
			{
				icon: "train-outline",
				label: "From the airport",
				text: "The KLIA Ekspres train reaches KL Sentral in about 30 minutes, the fastest route into the city. Official taxis use a fixed-price coupon system, and ride-hailing apps like Grab are cheap and reliable.",
			},
			{
				icon: "card-outline",
				label: "Getting around",
				text: "The LRT, MRT, and monorail cover the centre — tap a Touch 'n Go card or buy a token. Distances feel long and it gets hot and humid, so lean on the trains and cheap Grab rides.",
			},
			{
				icon: "fast-food-outline",
				label: "Food",
				text: "Hawker stalls and food courts serve superb, cheap nasi lemak, char kway teow, and satay. Stick to busy stalls, drink bottled water, and cool off with a teh tarik (pulled milk tea).",
			},
			{
				icon: "cash-outline",
				label: "Money & tipping",
				text: "The currency is the ringgit; carry small notes for hawker stalls and markets, though cards and e-wallets are widely used. Tipping isn't expected, as many restaurants add a service charge to the bill.",
			},
			{
				icon: "shirt-outline",
				label: "Etiquette",
				text: "Dress modestly at mosques — cover shoulders and knees, and women should carry a scarf; robes are often provided. Remove your shoes before entering mosques and homes, and use your right hand to eat and pass items.",
			},
		],
	},
];

/** Look up a single destination by its id. */
export function getDestinationById(id: string): Destination | undefined {
	return destinations.find((destination) => destination.id === id);
}
