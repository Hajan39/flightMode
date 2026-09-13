import type { LocalizedText } from "@/i18n/translations";

/**
 * Question bank for Seat Neighbor — the icebreaker duel.
 *
 * Content is bulky, so it lives here as `LocalizedText` (en required, cs/de
 * provided, other UI languages fall back to English) instead of pushing ~250
 * strings through the flat locale tables.
 *
 * `mindMeld`: the guesser predicts what the answerer will pick.
 * `wyr`: "would you rather" — both pick privately, matching answers score.
 */

export type SNQuestionKind = "mindMeld" | "wyr";

export type SNQuestion = {
	id: string;
	kind: SNQuestionKind;
	prompt: LocalizedText;
	options: LocalizedText[];
};

const q = (
	id: string,
	kind: SNQuestionKind,
	prompt: [string, string, string],
	options: [string, string, string][],
): SNQuestion => ({
	id,
	kind,
	prompt: { en: prompt[0], cs: prompt[1], de: prompt[2] },
	options: options.map(([en, cs, de]) => ({ en, cs, de })),
});

export const seatNeighborQuestions: SNQuestion[] = [
	// ── Mind Meld (40) ──
	q("mm-seat", "mindMeld", ["Window or aisle?", "Okénko nebo ulička?", "Fenster oder Gang?"], [["Window", "Okénko", "Fenster"], ["Aisle", "Ulička", "Gang"]]),
	q("mm-landing", "mindMeld", ["First thing after landing?", "Co uděláš hned po přistání?", "Erstes nach der Landung?"], [["Turn on phone", "Zapnout telefon", "Handy einschalten"], ["Stretch", "Protáhnout se", "Strecken"], ["Rush to the exit", "Hnát se k východu", "Zum Ausgang eilen"]]),
	q("mm-drink", "mindMeld", ["In-flight drink of choice?", "Nápoj na palubě?", "Getränk an Bord?"], [["Coffee or tea", "Káva nebo čaj", "Kaffee oder Tee"], ["Juice", "Džus", "Saft"], ["Something with bubbles", "Něco s bublinkami", "Etwas mit Bläschen"]]),
	q("mm-sleep", "mindMeld", ["Can you sleep on planes?", "Dokážeš spát v letadle?", "Kannst du im Flugzeug schlafen?"], [["Instantly", "Okamžitě", "Sofort"], ["Only if exhausted", "Jen vyčerpaný/á", "Nur wenn erschöpft"], ["Never", "Nikdy", "Nie"]]),
	q("mm-pack", "mindMeld", ["Packing style?", "Styl balení?", "Packstil?"], [["Night before, panicked", "Večer předtím, v panice", "Am Abend davor, panisch"], ["List, days ahead", "Podle seznamu, s předstihem", "Liste, Tage vorher"], ["Just throw things in", "Prostě to tam naházím", "Einfach reinwerfen"]]),
	q("mm-breakfast", "mindMeld", ["Ideal holiday breakfast?", "Ideální dovolenková snídaně?", "Ideales Urlaubsfrühstück?"], [["Hotel buffet", "Hotelový bufet", "Hotelbuffet"], ["Local café", "Místní kavárna", "Lokales Café"], ["Skip it, sleep in", "Vynechat, spát déle", "Auslassen, ausschlafen"]]),
	q("mm-map", "mindMeld", ["Lost in a new city — you…", "Ztracen/a v cizím městě — ty…", "Verloren in einer Stadt — du…"], [["Ask a local", "Zeptám se místních", "Frage Einheimische"], ["Open the map app", "Otevřu mapu", "Öffne die Karten-App"], ["Wander, it's fine", "Bloumám, v pohodě", "Schlendere einfach"]]),
	q("mm-souvenir", "mindMeld", ["Go-to souvenir?", "Oblíbený suvenýr?", "Lieblingssouvenir?"], [["Magnet", "Magnetka", "Magnet"], ["Local food", "Místní jídlo", "Lokales Essen"], ["Photos only", "Jen fotky", "Nur Fotos"]]),
	q("mm-beach", "mindMeld", ["Beach day means…", "Den na pláži znamená…", "Strandtag heißt…"], [["Book and shade", "Kniha a stín", "Buch und Schatten"], ["Swim all day", "Plavat celý den", "Den ganzen Tag schwimmen"], ["Beach sports", "Plážové sporty", "Strandsport"]]),
	q("mm-photo", "mindMeld", ["Travel photos: how many?", "Fotky z cest: kolik?", "Reisefotos: wie viele?"], [["Hundreds", "Stovky", "Hunderte"], ["A few good ones", "Pár dobrých", "Ein paar gute"], ["Almost none", "Skoro žádné", "Fast keine"]]),
	q("mm-early", "mindMeld", ["Airport arrival?", "Příjezd na letiště?", "Ankunft am Flughafen?"], [["3 hours early", "3 hodiny předem", "3 Stunden vorher"], ["Comfortable 90 min", "Pohodových 90 min", "Bequeme 90 Min"], ["Sprint to the gate", "Sprint ke gatu", "Sprint zum Gate"]]),
	q("mm-food", "mindMeld", ["Trying unknown street food?", "Ochutnat neznámé street food?", "Unbekanntes Streetfood probieren?"], [["Always", "Vždy", "Immer"], ["If it looks safe", "Když vypadá bezpečně", "Wenn es sicher aussieht"], ["No thanks", "Ne, díky", "Nein danke"]]),
	q("mm-music", "mindMeld", ["Flight soundtrack?", "Hudba na let?", "Flug-Soundtrack?"], [["Podcast", "Podcast", "Podcast"], ["Playlist", "Playlist", "Playlist"], ["Engine hum", "Hukot motorů", "Triebwerksbrummen"]]),
	q("mm-plan", "mindMeld", ["Itinerary style?", "Styl plánování?", "Reiseplan-Stil?"], [["Hour by hour", "Hodinu po hodině", "Stunde für Stunde"], ["Loose list", "Volný seznam", "Lose Liste"], ["Zero plan", "Žádný plán", "Null Plan"]]),
	q("mm-weather", "mindMeld", ["Dream trip weather?", "Počasí na cestu snů?", "Traumreise-Wetter?"], [["Hot sun", "Horké slunce", "Heiße Sonne"], ["Crisp and cold", "Svěží zima", "Klar und kalt"], ["Mild and cloudy", "Mírné, zataženo", "Mild und wolkig"]]),
	q("mm-movie", "mindMeld", ["In-flight movie pick?", "Film na palubě?", "Film an Bord?"], [["Comedy", "Komedie", "Komödie"], ["Action", "Akce", "Action"], ["Something to cry at", "Něco k slzám", "Etwas zum Weinen"]]),
	q("mm-city", "mindMeld", ["City or nature?", "Město nebo příroda?", "Stadt oder Natur?"], [["City", "Město", "Stadt"], ["Nature", "Příroda", "Natur"], ["Both, alternating", "Obojí, střídavě", "Beides, abwechselnd"]]),
	q("mm-talk", "mindMeld", ["Chatting with a seat neighbour?", "Povídat si se sousedem?", "Mit dem Sitznachbarn plaudern?"], [["Love it", "Miluju to", "Liebe es"], ["Short hello", "Krátké ahoj", "Kurzes Hallo"], ["Headphones on", "Sluchátka na uši", "Kopfhörer auf"]]),
	q("mm-money", "mindMeld", ["Holiday budget?", "Dovolenkový rozpočet?", "Urlaubsbudget?"], [["Tracked to the cent", "Sledovaný do koruny", "Auf den Cent"], ["Rough idea", "Zhruba", "Ungefähre Idee"], ["What budget?", "Jaký rozpočet?", "Welches Budget?"]]),
	q("mm-morning", "mindMeld", ["On holiday you wake up…", "Na dovolené vstáváš…", "Im Urlaub stehst du auf…"], [["At sunrise", "Za úsvitu", "Bei Sonnenaufgang"], ["Around 9", "Kolem deváté", "Gegen 9"], ["When you wake up", "Až se probudíš", "Wann auch immer"]]),
	q("mm-luggage", "mindMeld", ["Luggage style?", "Styl zavazadla?", "Gepäckstil?"], [["Carry-on only", "Jen příruční", "Nur Handgepäck"], ["One big suitcase", "Jeden velký kufr", "Ein großer Koffer"], ["Everything, twice", "Všechno, dvakrát", "Alles, doppelt"]]),
	q("mm-fear", "mindMeld", ["Turbulence reaction?", "Reakce na turbulence?", "Reaktion auf Turbulenzen?"], [["Grip the armrest", "Chytím se opěrky", "Armlehne festhalten"], ["Kind of fun", "Docela zábava", "Irgendwie spaßig"], ["Don't even notice", "Ani nevnímám", "Merke es gar nicht"]]),
	q("mm-language", "mindMeld", ["Local language attempts?", "Pokusy o místní jazyk?", "Versuche in der Landessprache?"], [["Full sentences", "Celé věty", "Ganze Sätze"], ["Hello and thanks", "Ahoj a díky", "Hallo und danke"], ["Point and smile", "Ukázat a usmát se", "Zeigen und lächeln"]]),
	q("mm-museum", "mindMeld", ["Museums on holiday?", "Muzea na dovolené?", "Museen im Urlaub?"], [["Every single one", "Úplně všechna", "Jedes einzelne"], ["One or two", "Jedno dvě", "Ein oder zwei"], ["Hard pass", "Rozhodně ne", "Auf keinen Fall"]]),
	q("mm-snack", "mindMeld", ["Airport snack?", "Svačina na letišti?", "Flughafen-Snack?"], [["Overpriced sandwich", "Předražený sendvič", "Überteuertes Sandwich"], ["Brought from home", "Z domova", "Von zu Hause"], ["Just coffee", "Jen káva", "Nur Kaffee"]]),
	q("mm-selfie", "mindMeld", ["Selfies at landmarks?", "Selfie u památek?", "Selfies vor Sehenswürdigkeiten?"], [["Absolutely", "Rozhodně", "Absolut"], ["Ask a stranger", "Požádám někoho", "Fremde fragen"], ["No people in my photos", "Bez lidí ve fotkách", "Keine Menschen auf Fotos"]]),
	q("mm-shoes", "mindMeld", ["Shoes for a city trip?", "Boty na výlet do města?", "Schuhe für den Städtetrip?"], [["Sneakers", "Tenisky", "Sneaker"], ["Sandals", "Sandály", "Sandalen"], ["Whatever looks good", "Cokoliv, co vypadá dobře", "Hauptsache schick"]]),
	q("mm-hotel", "mindMeld", ["Where do you stay?", "Kde bydlíš?", "Wo übernachtest du?"], [["Hotel", "Hotel", "Hotel"], ["Apartment", "Apartmán", "Apartment"], ["Hostel or friends", "Hostel nebo přátelé", "Hostel oder Freunde"]]),
	q("mm-return", "mindMeld", ["Back home you first…", "Doma nejdřív…", "Zuhause zuerst…"], [["Unpack immediately", "Hned vybalím", "Sofort auspacken"], ["Shower and sleep", "Sprcha a spát", "Duschen und schlafen"], ["Suitcase stays for a week", "Kufr stojí týden", "Koffer bleibt eine Woche"]]),
	q("mm-ticket", "mindMeld", ["Boarding pass?", "Palubní lístek?", "Bordkarte?"], [["Phone", "V telefonu", "Handy"], ["Printed", "Vytištěný", "Gedruckt"], ["Both, just in case", "Obojí, pro jistotu", "Beides, zur Sicherheit"]]),
	q("mm-window", "mindMeld", ["Window shade during the flight?", "Roleta okénka během letu?", "Fensterblende im Flug?"], [["Always open", "Vždy otevřená", "Immer offen"], ["Closed to sleep", "Zavřená na spaní", "Zu zum Schlafen"], ["Whatever the neighbour wants", "Jak chce soused", "Wie der Nachbar will"]]),
	q("mm-rain", "mindMeld", ["Rainy day on holiday?", "Deštivý den na dovolené?", "Regentag im Urlaub?"], [["Museum or café", "Muzeum nebo kavárna", "Museum oder Café"], ["Go out anyway", "Jít ven stejně", "Trotzdem raus"], ["Hotel movie day", "Filmový den v hotelu", "Filmtag im Hotel"]]),
	q("mm-friends", "mindMeld", ["Best travel company?", "Nejlepší společnost na cesty?", "Beste Reisebegleitung?"], [["Partner", "Partner/ka", "Partner/in"], ["Group of friends", "Parta přátel", "Freundesgruppe"], ["Solo", "Sólo", "Solo"]]),
	q("mm-nightlife", "mindMeld", ["Evenings on holiday?", "Večery na dovolené?", "Abende im Urlaub?"], [["Long dinner", "Dlouhá večeře", "Langes Dinner"], ["Bars and dancing", "Bary a tanec", "Bars und Tanzen"], ["Early night", "Brzo spát", "Früh ins Bett"]]),
	q("mm-souvenir2", "mindMeld", ["Do you send postcards?", "Posíláš pohledy?", "Schickst du Postkarten?"], [["Yes, handwritten", "Ano, ručně psané", "Ja, handgeschrieben"], ["A photo message", "Fotku ve zprávě", "Foto-Nachricht"], ["Never", "Nikdy", "Nie"]]),
	q("mm-seatback", "mindMeld", ["Reclining your seat?", "Sklápíš sedačku?", "Sitz zurücklehnen?"], [["Always", "Vždy", "Immer"], ["Only on long flights", "Jen na dlouhých letech", "Nur auf Langstrecke"], ["Never, it's rude", "Nikdy, je to neslušné", "Nie, unhöflich"]]),
	q("mm-train", "mindMeld", ["Plane, train or car?", "Letadlo, vlak nebo auto?", "Flugzeug, Zug oder Auto?"], [["Plane", "Letadlo", "Flugzeug"], ["Train", "Vlak", "Zug"], ["Road trip", "Road trip", "Roadtrip"]]),
	q("mm-guide", "mindMeld", ["Guided tour or self-guided?", "S průvodcem nebo sami?", "Führung oder allein?"], [["Guided", "S průvodcem", "Führung"], ["Self-guided", "Sami", "Allein"], ["Audio guide", "Audioprůvodce", "Audioguide"]]),
	q("mm-coffee", "mindMeld", ["Coffee abroad?", "Káva v zahraničí?", "Kaffee im Ausland?"], [["Local style, always", "Vždy po místním", "Immer lokal"], ["My usual order", "Moje obvyklá", "Meine übliche Bestellung"], ["Tea person", "Jsem na čaj", "Teetrinker/in"]]),
	q("mm-plane-meal", "mindMeld", ["Plane food verdict?", "Verdikt nad jídlem v letadle?", "Urteil zum Flugzeugessen?"], [["Secretly love it", "Tajně miluju", "Heimlich geliebt"], ["It's fine", "V pohodě", "Geht so"], ["Bring my own", "Beru vlastní", "Bringe eigenes mit"]]),
	// ── Would you rather (20) ──
	q("wyr-luggage", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Lose your luggage", "Ztratit zavazadlo", "Gepäck verlieren"], ["Miss your connection", "Zmeškat přestup", "Anschluss verpassen"]]),
	q("wyr-seat", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Middle seat, 12 hours", "Prostřední sedačka, 12 hodin", "Mittelsitz, 12 Stunden"], ["Two layovers, aisle seats", "Dva přestupy, uličky", "Zwei Zwischenstopps, Gangplätze"]]),
	q("wyr-weather", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Rain all week", "Déšť celý týden", "Eine Woche Regen"], ["40 °C all week", "40 °C celý týden", "Eine Woche 40 °C"]]),
	q("wyr-phone", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["No phone for the trip", "Bez telefonu celou cestu", "Kein Handy auf der Reise"], ["No camera for the trip", "Bez fotoaparátu celou cestu", "Keine Kamera auf der Reise"]]),
	q("wyr-food", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Only local food", "Jen místní jídlo", "Nur lokales Essen"], ["Only food you know", "Jen známé jídlo", "Nur bekanntes Essen"]]),
	q("wyr-time", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["3 short trips a year", "3 krátké cesty ročně", "3 kurze Reisen im Jahr"], ["1 month-long trip", "1 měsíční cesta", "1 Monat lange Reise"]]),
	q("wyr-mountain", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Mountains forever", "Navždy hory", "Für immer Berge"], ["Beaches forever", "Navždy pláže", "Für immer Strände"]]),
	q("wyr-sleep", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Red-eye flight", "Noční let", "Nachtflug"], ["5 a.m. departure", "Odlet v 5 ráno", "Abflug um 5 Uhr"]]),
	q("wyr-neighbour", "wyr", ["Would you rather sit next to…", "Radši bys seděl/a vedle…", "Lieber neben…"], [["A chatty stranger", "Upovídaného cizince", "Einem redseligen Fremden"], ["A crying baby", "Plačícího miminka", "Einem weinenden Baby"]]),
	q("wyr-ticket", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Free flights, cheap hotels", "Lety zdarma, levné hotely", "Freiflüge, billige Hotels"], ["Free hotels, cheap flights", "Hotely zdarma, levné lety", "Freie Hotels, billige Flüge"]]),
	q("wyr-guide", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Know the language, no map", "Umět jazyk, bez mapy", "Sprache können, keine Karte"], ["Perfect map, no language", "Perfektní mapu, bez jazyka", "Perfekte Karte, keine Sprache"]]),
	q("wyr-city", "wyr", ["Would you rather visit…", "Radši bys navštívil/a…", "Lieber besuchen…"], [["Tokyo", "Tokio", "Tokio"], ["New York", "New York", "New York"]]),
	q("wyr-pack", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Forget your charger", "Zapomenout nabíječku", "Ladegerät vergessen"], ["Forget your toothbrush", "Zapomenout kartáček", "Zahnbürste vergessen"]]),
	q("wyr-hotel", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Fancy hotel, boring town", "Luxusní hotel, nudné město", "Nobles Hotel, langweilige Stadt"], ["Basic room, amazing town", "Základní pokoj, úžasné město", "Einfaches Zimmer, tolle Stadt"]]),
	q("wyr-wifi", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["No Wi-Fi for a week", "Týden bez Wi-Fi", "Eine Woche kein WLAN"], ["No coffee for a week", "Týden bez kávy", "Eine Woche kein Kaffee"]]),
	q("wyr-space", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Fly to space once", "Jednou letět do vesmíru", "Einmal ins All fliegen"], ["Fly first class forever", "Navždy první třídou", "Für immer First Class"]]),
	q("wyr-delay", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["4-hour delay, free lounge", "4 h zpoždění, salonek zdarma", "4 h Verspätung, freie Lounge"], ["On time, middle seat", "Včas, prostřední sedačka", "Pünktlich, Mittelsitz"]]),
	q("wyr-season", "wyr", ["Would you rather travel in…", "Radši bys cestoval/a v…", "Lieber reisen im…"], [["Summer crowds", "Letních davech", "Sommertrubel"], ["Winter quiet", "Zimním klidu", "Winterstille"]]),
	q("wyr-food2", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Eat the same meal all trip", "Jíst celou cestu totéž", "Die ganze Reise dasselbe essen"], ["Never eat before 8 p.m.", "Nikdy nejíst před 20:00", "Nie vor 20 Uhr essen"]]),
	q("wyr-photo", "wyr", ["Would you rather…", "Radši bys…", "Was wäre dir lieber…"], [["Lose all trip photos", "Ztratit všechny fotky z cesty", "Alle Reisefotos verlieren"], ["Lose all souvenirs", "Ztratit všechny suvenýry", "Alle Souvenirs verlieren"]]),
];
