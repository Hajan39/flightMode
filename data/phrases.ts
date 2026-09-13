/**
 * Bundled offline phrasebook — 12 survival phrases in every language spoken
 * at one of the bundled destinations (see `data/destinations.ts`).
 *
 * The *meaning* of each phrase is shown in the UI language via i18n keys
 * (`phraseHello`, …); the native text and romanization below are data and are
 * deliberately not routed through t(). Romanization is required for every
 * non-Latin script so travellers can attempt the pronunciation.
 */

export type PhraseLanguageCode =
	| "ja"
	| "fr"
	| "en"
	| "es"
	| "nl"
	| "ar"
	| "th"
	| "it"
	| "tr"
	| "pt"
	| "is"
	| "ko"
	| "de"
	| "id"
	| "cs"
	| "el"
	| "vi"
	| "sv"
	| "hi"
	| "sw"
	| "da"
	| "ms"
	| "pl"
	| "hu";

export type PhraseId =
	| "hello"
	| "thankYou"
	| "please"
	| "excuseMe"
	| "howMuch"
	| "whereIs"
	| "help"
	| "water"
	| "bathroom"
	| "billPlease"
	| "yesNo"
	| "dontUnderstand";

/** Display order of phrases in the phrasebook screen. */
export const phraseIds: PhraseId[] = [
	"hello",
	"thankYou",
	"please",
	"excuseMe",
	"yesNo",
	"dontUnderstand",
	"howMuch",
	"whereIs",
	"bathroom",
	"water",
	"billPlease",
	"help",
];

/** i18n key that carries the meaning of each phrase in the UI language. */
export const phraseMeaningKeys = {
	hello: "phraseHello",
	thankYou: "phraseThankYou",
	please: "phrasePlease",
	excuseMe: "phraseExcuseMe",
	howMuch: "phraseHowMuch",
	whereIs: "phraseWhereIs",
	help: "phraseHelp",
	water: "phraseWater",
	bathroom: "phraseBathroom",
	billPlease: "phraseBillPlease",
	yesNo: "phraseYesNo",
	dontUnderstand: "phraseDontUnderstand",
} as const;

export type Phrase = {
	/** Phrase in the native script. */
	native: string;
	/** Latin-script pronunciation guide; required for non-Latin scripts. */
	roman?: string;
};

export type PhraseLanguage = {
	code: PhraseLanguageCode;
	/** English name of the language (proper noun, not translated). */
	nameEn: string;
	/** Name of the language in itself. */
	nativeName: string;
	/** True when the script is not Latin — `roman` must then be present. */
	nonLatin: boolean;
	phrases: Record<PhraseId, Phrase>;
};

/** Languages whose script is not Latin; every phrase must carry `roman`. */
export const nonLatinScripts: PhraseLanguageCode[] = [
	"ja",
	"ko",
	"ar",
	"th",
	"el",
	"hi",
];

export const phraseLanguages: Record<PhraseLanguageCode, PhraseLanguage> = {
	en: {
		code: "en",
		nameEn: "English",
		nativeName: "English",
		nonLatin: false,
		phrases: {
			hello: { native: "Hello" },
			thankYou: { native: "Thank you" },
			please: { native: "Please" },
			excuseMe: { native: "Excuse me" },
			howMuch: { native: "How much is it?" },
			whereIs: { native: "Where is…?" },
			help: { native: "Help!" },
			water: { native: "Water" },
			bathroom: { native: "Where is the bathroom?" },
			billPlease: { native: "The bill, please" },
			yesNo: { native: "Yes / No" },
			dontUnderstand: { native: "I don't understand" },
		},
	},
	ja: {
		code: "ja",
		nameEn: "Japanese",
		nativeName: "日本語",
		nonLatin: true,
		phrases: {
			hello: { native: "こんにちは", roman: "konnichiwa" },
			thankYou: { native: "ありがとうございます", roman: "arigatō gozaimasu" },
			please: { native: "お願いします", roman: "onegai shimasu" },
			excuseMe: { native: "すみません", roman: "sumimasen" },
			howMuch: { native: "いくらですか？", roman: "ikura desu ka?" },
			whereIs: { native: "…はどこですか？", roman: "… wa doko desu ka?" },
			help: { native: "助けて！", roman: "tasukete!" },
			water: { native: "水", roman: "mizu" },
			bathroom: { native: "トイレはどこですか？", roman: "toire wa doko desu ka?" },
			billPlease: { native: "お会計をお願いします", roman: "okaikei o onegai shimasu" },
			yesNo: { native: "はい / いいえ", roman: "hai / iie" },
			dontUnderstand: { native: "分かりません", roman: "wakarimasen" },
		},
	},
	fr: {
		code: "fr",
		nameEn: "French",
		nativeName: "Français",
		nonLatin: false,
		phrases: {
			hello: { native: "Bonjour" },
			thankYou: { native: "Merci" },
			please: { native: "S'il vous plaît" },
			excuseMe: { native: "Excusez-moi" },
			howMuch: { native: "C'est combien ?" },
			whereIs: { native: "Où est… ?" },
			help: { native: "Au secours !" },
			water: { native: "De l'eau" },
			bathroom: { native: "Où sont les toilettes ?" },
			billPlease: { native: "L'addition, s'il vous plaît" },
			yesNo: { native: "Oui / Non" },
			dontUnderstand: { native: "Je ne comprends pas" },
		},
	},
	es: {
		code: "es",
		nameEn: "Spanish",
		nativeName: "Español",
		nonLatin: false,
		phrases: {
			hello: { native: "Hola" },
			thankYou: { native: "Gracias" },
			please: { native: "Por favor" },
			excuseMe: { native: "Perdón / Disculpe" },
			howMuch: { native: "¿Cuánto cuesta?" },
			whereIs: { native: "¿Dónde está…?" },
			help: { native: "¡Ayuda!" },
			water: { native: "Agua" },
			bathroom: { native: "¿Dónde está el baño?" },
			billPlease: { native: "La cuenta, por favor" },
			yesNo: { native: "Sí / No" },
			dontUnderstand: { native: "No entiendo" },
		},
	},
	nl: {
		code: "nl",
		nameEn: "Dutch",
		nativeName: "Nederlands",
		nonLatin: false,
		phrases: {
			hello: { native: "Hallo" },
			thankYou: { native: "Dank u wel" },
			please: { native: "Alstublieft" },
			excuseMe: { native: "Pardon" },
			howMuch: { native: "Hoeveel kost het?" },
			whereIs: { native: "Waar is…?" },
			help: { native: "Help!" },
			water: { native: "Water" },
			bathroom: { native: "Waar is het toilet?" },
			billPlease: { native: "De rekening, alstublieft" },
			yesNo: { native: "Ja / Nee" },
			dontUnderstand: { native: "Ik begrijp het niet" },
		},
	},
	ar: {
		code: "ar",
		nameEn: "Arabic",
		nativeName: "العربية",
		nonLatin: true,
		phrases: {
			hello: { native: "مرحبا", roman: "marhaban" },
			thankYou: { native: "شكرا", roman: "shukran" },
			please: { native: "من فضلك", roman: "min fadlik" },
			excuseMe: { native: "عفوا", roman: "afwan" },
			howMuch: { native: "بكم هذا؟", roman: "bikam hādhā?" },
			whereIs: { native: "أين…؟", roman: "ayna…?" },
			help: { native: "النجدة!", roman: "an-najda!" },
			water: { native: "ماء", roman: "mā'" },
			bathroom: { native: "أين الحمام؟", roman: "ayna al-hammām?" },
			billPlease: { native: "الحساب من فضلك", roman: "al-hisāb min fadlik" },
			yesNo: { native: "نعم / لا", roman: "na'am / lā" },
			dontUnderstand: { native: "لا أفهم", roman: "lā afham" },
		},
	},
	th: {
		code: "th",
		nameEn: "Thai",
		nativeName: "ไทย",
		nonLatin: true,
		phrases: {
			hello: { native: "สวัสดี", roman: "sawatdee" },
			thankYou: { native: "ขอบคุณ", roman: "khop khun" },
			please: { native: "กรุณา", roman: "karunaa" },
			excuseMe: { native: "ขอโทษ", roman: "kho thot" },
			howMuch: { native: "ราคาเท่าไหร่?", roman: "raakhaa thao rai?" },
			whereIs: { native: "…อยู่ที่ไหน?", roman: "… yuu thii nai?" },
			help: { native: "ช่วยด้วย!", roman: "chuay duay!" },
			water: { native: "น้ำ", roman: "naam" },
			bathroom: { native: "ห้องน้ำอยู่ที่ไหน?", roman: "hong naam yuu thii nai?" },
			billPlease: { native: "เช็คบิลด้วย", roman: "check bin duay" },
			yesNo: { native: "ใช่ / ไม่", roman: "chai / mai" },
			dontUnderstand: { native: "ไม่เข้าใจ", roman: "mai khao jai" },
		},
	},
	it: {
		code: "it",
		nameEn: "Italian",
		nativeName: "Italiano",
		nonLatin: false,
		phrases: {
			hello: { native: "Ciao / Buongiorno" },
			thankYou: { native: "Grazie" },
			please: { native: "Per favore" },
			excuseMe: { native: "Scusi" },
			howMuch: { native: "Quanto costa?" },
			whereIs: { native: "Dov'è…?" },
			help: { native: "Aiuto!" },
			water: { native: "Acqua" },
			bathroom: { native: "Dov'è il bagno?" },
			billPlease: { native: "Il conto, per favore" },
			yesNo: { native: "Sì / No" },
			dontUnderstand: { native: "Non capisco" },
		},
	},
	tr: {
		code: "tr",
		nameEn: "Turkish",
		nativeName: "Türkçe",
		nonLatin: false,
		phrases: {
			hello: { native: "Merhaba" },
			thankYou: { native: "Teşekkür ederim" },
			please: { native: "Lütfen" },
			excuseMe: { native: "Affedersiniz" },
			howMuch: { native: "Ne kadar?" },
			whereIs: { native: "… nerede?" },
			help: { native: "İmdat!" },
			water: { native: "Su" },
			bathroom: { native: "Tuvalet nerede?" },
			billPlease: { native: "Hesap, lütfen" },
			yesNo: { native: "Evet / Hayır" },
			dontUnderstand: { native: "Anlamıyorum" },
		},
	},
	pt: {
		code: "pt",
		nameEn: "Portuguese",
		nativeName: "Português",
		nonLatin: false,
		phrases: {
			hello: { native: "Olá" },
			thankYou: { native: "Obrigado / Obrigada" },
			please: { native: "Por favor" },
			excuseMe: { native: "Com licença / Desculpe" },
			howMuch: { native: "Quanto custa?" },
			whereIs: { native: "Onde fica…?" },
			help: { native: "Socorro!" },
			water: { native: "Água" },
			bathroom: { native: "Onde fica o banheiro?" },
			billPlease: { native: "A conta, por favor" },
			yesNo: { native: "Sim / Não" },
			dontUnderstand: { native: "Não entendo" },
		},
	},
	is: {
		code: "is",
		nameEn: "Icelandic",
		nativeName: "Íslenska",
		nonLatin: false,
		phrases: {
			hello: { native: "Halló / Góðan dag" },
			thankYou: { native: "Takk" },
			please: { native: "Vinsamlegast" },
			excuseMe: { native: "Afsakið" },
			howMuch: { native: "Hvað kostar þetta?" },
			whereIs: { native: "Hvar er…?" },
			help: { native: "Hjálp!" },
			water: { native: "Vatn" },
			bathroom: { native: "Hvar er klósettið?" },
			billPlease: { native: "Reikninginn, takk" },
			yesNo: { native: "Já / Nei" },
			dontUnderstand: { native: "Ég skil ekki" },
		},
	},
	ko: {
		code: "ko",
		nameEn: "Korean",
		nativeName: "한국어",
		nonLatin: true,
		phrases: {
			hello: { native: "안녕하세요", roman: "annyeonghaseyo" },
			thankYou: { native: "감사합니다", roman: "gamsahamnida" },
			please: { native: "주세요", roman: "juseyo" },
			excuseMe: { native: "실례합니다", roman: "sillyehamnida" },
			howMuch: { native: "얼마예요?", roman: "eolmayeyo?" },
			whereIs: { native: "…이 어디예요?", roman: "… i eodiyeyo?" },
			help: { native: "도와주세요!", roman: "dowajuseyo!" },
			water: { native: "물", roman: "mul" },
			bathroom: { native: "화장실이 어디예요?", roman: "hwajangsiri eodiyeyo?" },
			billPlease: { native: "계산해 주세요", roman: "gyesanhae juseyo" },
			yesNo: { native: "네 / 아니요", roman: "ne / aniyo" },
			dontUnderstand: { native: "이해가 안 돼요", roman: "ihaega an dwaeyo" },
		},
	},
	de: {
		code: "de",
		nameEn: "German",
		nativeName: "Deutsch",
		nonLatin: false,
		phrases: {
			hello: { native: "Hallo / Guten Tag" },
			thankYou: { native: "Danke" },
			please: { native: "Bitte" },
			excuseMe: { native: "Entschuldigung" },
			howMuch: { native: "Wie viel kostet das?" },
			whereIs: { native: "Wo ist…?" },
			help: { native: "Hilfe!" },
			water: { native: "Wasser" },
			bathroom: { native: "Wo ist die Toilette?" },
			billPlease: { native: "Die Rechnung, bitte" },
			yesNo: { native: "Ja / Nein" },
			dontUnderstand: { native: "Ich verstehe nicht" },
		},
	},
	id: {
		code: "id",
		nameEn: "Indonesian",
		nativeName: "Bahasa Indonesia",
		nonLatin: false,
		phrases: {
			hello: { native: "Halo" },
			thankYou: { native: "Terima kasih" },
			please: { native: "Tolong / Silakan" },
			excuseMe: { native: "Permisi" },
			howMuch: { native: "Berapa harganya?" },
			whereIs: { native: "Di mana…?" },
			help: { native: "Tolong!" },
			water: { native: "Air" },
			bathroom: { native: "Di mana toiletnya?" },
			billPlease: { native: "Minta bon, ya" },
			yesNo: { native: "Ya / Tidak" },
			dontUnderstand: { native: "Saya tidak mengerti" },
		},
	},
	cs: {
		code: "cs",
		nameEn: "Czech",
		nativeName: "Čeština",
		nonLatin: false,
		phrases: {
			hello: { native: "Dobrý den" },
			thankYou: { native: "Děkuji" },
			please: { native: "Prosím" },
			excuseMe: { native: "Promiňte" },
			howMuch: { native: "Kolik to stojí?" },
			whereIs: { native: "Kde je…?" },
			help: { native: "Pomoc!" },
			water: { native: "Voda" },
			bathroom: { native: "Kde je toaleta?" },
			billPlease: { native: "Účet, prosím" },
			yesNo: { native: "Ano / Ne" },
			dontUnderstand: { native: "Nerozumím" },
		},
	},
	el: {
		code: "el",
		nameEn: "Greek",
		nativeName: "Ελληνικά",
		nonLatin: true,
		phrases: {
			hello: { native: "Γεια σας", roman: "yia sas" },
			thankYou: { native: "Ευχαριστώ", roman: "efharistó" },
			please: { native: "Παρακαλώ", roman: "parakaló" },
			excuseMe: { native: "Συγνώμη", roman: "signómi" },
			howMuch: { native: "Πόσο κάνει;", roman: "póso káni?" },
			whereIs: { native: "Πού είναι…;", roman: "pou íne…?" },
			help: { native: "Βοήθεια!", roman: "voíthia!" },
			water: { native: "Νερό", roman: "neró" },
			bathroom: { native: "Πού είναι η τουαλέτα;", roman: "pou íne i toualéta?" },
			billPlease: { native: "Τον λογαριασμό, παρακαλώ", roman: "ton logariasmó, parakaló" },
			yesNo: { native: "Ναι / Όχι", roman: "ne / óhi" },
			dontUnderstand: { native: "Δεν καταλαβαίνω", roman: "den katalavéno" },
		},
	},
	vi: {
		code: "vi",
		nameEn: "Vietnamese",
		nativeName: "Tiếng Việt",
		nonLatin: false,
		phrases: {
			hello: { native: "Xin chào" },
			thankYou: { native: "Cảm ơn" },
			please: { native: "Làm ơn" },
			excuseMe: { native: "Xin lỗi" },
			howMuch: { native: "Bao nhiêu tiền?" },
			whereIs: { native: "… ở đâu?" },
			help: { native: "Cứu tôi!" },
			water: { native: "Nước" },
			bathroom: { native: "Nhà vệ sinh ở đâu?" },
			billPlease: { native: "Tính tiền" },
			yesNo: { native: "Vâng / Không" },
			dontUnderstand: { native: "Tôi không hiểu" },
		},
	},
	sv: {
		code: "sv",
		nameEn: "Swedish",
		nativeName: "Svenska",
		nonLatin: false,
		phrases: {
			hello: { native: "Hej" },
			thankYou: { native: "Tack" },
			please: { native: "Snälla / Tack" },
			excuseMe: { native: "Ursäkta" },
			howMuch: { native: "Hur mycket kostar det?" },
			whereIs: { native: "Var är…?" },
			help: { native: "Hjälp!" },
			water: { native: "Vatten" },
			bathroom: { native: "Var är toaletten?" },
			billPlease: { native: "Notan, tack" },
			yesNo: { native: "Ja / Nej" },
			dontUnderstand: { native: "Jag förstår inte" },
		},
	},
	hi: {
		code: "hi",
		nameEn: "Hindi",
		nativeName: "हिन्दी",
		nonLatin: true,
		phrases: {
			hello: { native: "नमस्ते", roman: "namaste" },
			thankYou: { native: "धन्यवाद", roman: "dhanyavaad" },
			please: { native: "कृपया", roman: "kripya" },
			excuseMe: { native: "माफ़ कीजिए", roman: "maaf kijiye" },
			howMuch: { native: "यह कितने का है?", roman: "yeh kitne ka hai?" },
			whereIs: { native: "… कहाँ है?", roman: "… kahan hai?" },
			help: { native: "मदद करो!", roman: "madad karo!" },
			water: { native: "पानी", roman: "paani" },
			bathroom: { native: "शौचालय कहाँ है?", roman: "shauchalay kahan hai?" },
			billPlease: { native: "बिल दीजिए", roman: "bill dijiye" },
			yesNo: { native: "हाँ / नहीं", roman: "haan / nahin" },
			dontUnderstand: { native: "मुझे समझ नहीं आया", roman: "mujhe samajh nahin aaya" },
		},
	},
	sw: {
		code: "sw",
		nameEn: "Swahili",
		nativeName: "Kiswahili",
		nonLatin: false,
		phrases: {
			hello: { native: "Jambo / Habari" },
			thankYou: { native: "Asante" },
			please: { native: "Tafadhali" },
			excuseMe: { native: "Samahani" },
			howMuch: { native: "Bei gani?" },
			whereIs: { native: "… iko wapi?" },
			help: { native: "Msaada!" },
			water: { native: "Maji" },
			bathroom: { native: "Choo kiko wapi?" },
			billPlease: { native: "Bili, tafadhali" },
			yesNo: { native: "Ndiyo / Hapana" },
			dontUnderstand: { native: "Sielewi" },
		},
	},
	da: {
		code: "da",
		nameEn: "Danish",
		nativeName: "Dansk",
		nonLatin: false,
		phrases: {
			hello: { native: "Hej" },
			thankYou: { native: "Tak" },
			please: { native: "Vær så venlig" },
			excuseMe: { native: "Undskyld" },
			howMuch: { native: "Hvad koster det?" },
			whereIs: { native: "Hvor er…?" },
			help: { native: "Hjælp!" },
			water: { native: "Vand" },
			bathroom: { native: "Hvor er toilettet?" },
			billPlease: { native: "Regningen, tak" },
			yesNo: { native: "Ja / Nej" },
			dontUnderstand: { native: "Jeg forstår det ikke" },
		},
	},
	ms: {
		code: "ms",
		nameEn: "Malay",
		nativeName: "Bahasa Melayu",
		nonLatin: false,
		phrases: {
			hello: { native: "Hai / Selamat sejahtera" },
			thankYou: { native: "Terima kasih" },
			please: { native: "Tolong / Sila" },
			excuseMe: { native: "Maafkan saya" },
			howMuch: { native: "Berapa harganya?" },
			whereIs: { native: "Di mana…?" },
			help: { native: "Tolong!" },
			water: { native: "Air" },
			bathroom: { native: "Di mana tandas?" },
			billPlease: { native: "Bil, tolong" },
			yesNo: { native: "Ya / Tidak" },
			dontUnderstand: { native: "Saya tidak faham" },
		},
	},
	pl: {
		code: "pl",
		nameEn: "Polish",
		nativeName: "Polski",
		nonLatin: false,
		phrases: {
			hello: { native: "Dzień dobry" },
			thankYou: { native: "Dziękuję" },
			please: { native: "Proszę" },
			excuseMe: { native: "Przepraszam" },
			howMuch: { native: "Ile to kosztuje?" },
			whereIs: { native: "Gdzie jest…?" },
			help: { native: "Pomocy!" },
			water: { native: "Woda" },
			bathroom: { native: "Gdzie jest toaleta?" },
			billPlease: { native: "Rachunek, proszę" },
			yesNo: { native: "Tak / Nie" },
			dontUnderstand: { native: "Nie rozumiem" },
		},
	},
	hu: {
		code: "hu",
		nameEn: "Hungarian",
		nativeName: "Magyar",
		nonLatin: false,
		phrases: {
			hello: { native: "Jó napot" },
			thankYou: { native: "Köszönöm" },
			please: { native: "Kérem" },
			excuseMe: { native: "Elnézést" },
			howMuch: { native: "Mennyibe kerül?" },
			whereIs: { native: "Hol van…?" },
			help: { native: "Segítség!" },
			water: { native: "Víz" },
			bathroom: { native: "Hol van a mosdó?" },
			billPlease: { native: "A számlát, kérem" },
			yesNo: { native: "Igen / Nem" },
			dontUnderstand: { native: "Nem értem" },
		},
	},
};

/** All phrase languages in display order (English first, then alphabetical by English name). */
export const phraseLanguageList: PhraseLanguage[] = Object.values(
	phraseLanguages,
).sort((a, b) =>
	a.code === "en" ? -1 : b.code === "en" ? 1 : a.nameEn.localeCompare(b.nameEn),
);

export function getPhraseLanguage(
	code: string | undefined | null,
): PhraseLanguage | undefined {
	if (!code) return undefined;
	return (phraseLanguages as Record<string, PhraseLanguage | undefined>)[code];
}
