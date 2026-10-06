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
  bathroom: "phraseBathroom",
  billPlease: "phraseBillPlease",
  dontUnderstand: "phraseDontUnderstand",
  excuseMe: "phraseExcuseMe",
  hello: "phraseHello",
  help: "phraseHelp",
  howMuch: "phraseHowMuch",
  please: "phrasePlease",
  thankYou: "phraseThankYou",
  water: "phraseWater",
  whereIs: "phraseWhereIs",
  yesNo: "phraseYesNo",
} as const;

export interface Phrase {
  /** Phrase in the native script. */
  native: string;
  /** Latin-script pronunciation guide; required for non-Latin scripts. */
  roman?: string;
}

export interface PhraseLanguage {
  code: PhraseLanguageCode;
  /** English name of the language (proper noun, not translated). */
  nameEn: string;
  /** Name of the language in itself. */
  nativeName: string;
  /** True when the script is not Latin — `roman` must then be present. */
  nonLatin: boolean;
  phrases: Record<PhraseId, Phrase>;
}

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
  ar: {
    code: "ar",
    nameEn: "Arabic",
    nativeName: "العربية",
    nonLatin: true,
    phrases: {
      bathroom: { native: "أين الحمام؟", roman: "ayna al-hammām?" },
      billPlease: { native: "الحساب من فضلك", roman: "al-hisāb min fadlik" },
      dontUnderstand: { native: "لا أفهم", roman: "lā afham" },
      excuseMe: { native: "عفوا", roman: "afwan" },
      hello: { native: "مرحبا", roman: "marhaban" },
      help: { native: "النجدة!", roman: "an-najda!" },
      howMuch: { native: "بكم هذا؟", roman: "bikam hādhā?" },
      please: { native: "من فضلك", roman: "min fadlik" },
      thankYou: { native: "شكرا", roman: "shukran" },
      water: { native: "ماء", roman: "mā'" },
      whereIs: { native: "أين…؟", roman: "ayna…?" },
      yesNo: { native: "نعم / لا", roman: "na'am / lā" },
    },
  },
  cs: {
    code: "cs",
    nameEn: "Czech",
    nativeName: "Čeština",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Kde je toaleta?" },
      billPlease: { native: "Účet, prosím" },
      dontUnderstand: { native: "Nerozumím" },
      excuseMe: { native: "Promiňte" },
      hello: { native: "Dobrý den" },
      help: { native: "Pomoc!" },
      howMuch: { native: "Kolik to stojí?" },
      please: { native: "Prosím" },
      thankYou: { native: "Děkuji" },
      water: { native: "Voda" },
      whereIs: { native: "Kde je…?" },
      yesNo: { native: "Ano / Ne" },
    },
  },
  da: {
    code: "da",
    nameEn: "Danish",
    nativeName: "Dansk",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Hvor er toilettet?" },
      billPlease: { native: "Regningen, tak" },
      dontUnderstand: { native: "Jeg forstår det ikke" },
      excuseMe: { native: "Undskyld" },
      hello: { native: "Hej" },
      help: { native: "Hjælp!" },
      howMuch: { native: "Hvad koster det?" },
      please: { native: "Vær så venlig" },
      thankYou: { native: "Tak" },
      water: { native: "Vand" },
      whereIs: { native: "Hvor er…?" },
      yesNo: { native: "Ja / Nej" },
    },
  },
  de: {
    code: "de",
    nameEn: "German",
    nativeName: "Deutsch",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Wo ist die Toilette?" },
      billPlease: { native: "Die Rechnung, bitte" },
      dontUnderstand: { native: "Ich verstehe nicht" },
      excuseMe: { native: "Entschuldigung" },
      hello: { native: "Hallo / Guten Tag" },
      help: { native: "Hilfe!" },
      howMuch: { native: "Wie viel kostet das?" },
      please: { native: "Bitte" },
      thankYou: { native: "Danke" },
      water: { native: "Wasser" },
      whereIs: { native: "Wo ist…?" },
      yesNo: { native: "Ja / Nein" },
    },
  },
  el: {
    code: "el",
    nameEn: "Greek",
    nativeName: "Ελληνικά",
    nonLatin: true,
    phrases: {
      bathroom: {
        native: "Πού είναι η τουαλέτα;",
        roman: "pou íne i toualéta?",
      },
      billPlease: {
        native: "Τον λογαριασμό, παρακαλώ",
        roman: "ton logariasmó, parakaló",
      },
      dontUnderstand: { native: "Δεν καταλαβαίνω", roman: "den katalavéno" },
      excuseMe: { native: "Συγνώμη", roman: "signómi" },
      hello: { native: "Γεια σας", roman: "yia sas" },
      help: { native: "Βοήθεια!", roman: "voíthia!" },
      howMuch: { native: "Πόσο κάνει;", roman: "póso káni?" },
      please: { native: "Παρακαλώ", roman: "parakaló" },
      thankYou: { native: "Ευχαριστώ", roman: "efharistó" },
      water: { native: "Νερό", roman: "neró" },
      whereIs: { native: "Πού είναι…;", roman: "pou íne…?" },
      yesNo: { native: "Ναι / Όχι", roman: "ne / óhi" },
    },
  },
  en: {
    code: "en",
    nameEn: "English",
    nativeName: "English",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Where is the bathroom?" },
      billPlease: { native: "The bill, please" },
      dontUnderstand: { native: "I don't understand" },
      excuseMe: { native: "Excuse me" },
      hello: { native: "Hello" },
      help: { native: "Help!" },
      howMuch: { native: "How much is it?" },
      please: { native: "Please" },
      thankYou: { native: "Thank you" },
      water: { native: "Water" },
      whereIs: { native: "Where is…?" },
      yesNo: { native: "Yes / No" },
    },
  },
  es: {
    code: "es",
    nameEn: "Spanish",
    nativeName: "Español",
    nonLatin: false,
    phrases: {
      bathroom: { native: "¿Dónde está el baño?" },
      billPlease: { native: "La cuenta, por favor" },
      dontUnderstand: { native: "No entiendo" },
      excuseMe: { native: "Perdón / Disculpe" },
      hello: { native: "Hola" },
      help: { native: "¡Ayuda!" },
      howMuch: { native: "¿Cuánto cuesta?" },
      please: { native: "Por favor" },
      thankYou: { native: "Gracias" },
      water: { native: "Agua" },
      whereIs: { native: "¿Dónde está…?" },
      yesNo: { native: "Sí / No" },
    },
  },
  fr: {
    code: "fr",
    nameEn: "French",
    nativeName: "Français",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Où sont les toilettes ?" },
      billPlease: { native: "L'addition, s'il vous plaît" },
      dontUnderstand: { native: "Je ne comprends pas" },
      excuseMe: { native: "Excusez-moi" },
      hello: { native: "Bonjour" },
      help: { native: "Au secours !" },
      howMuch: { native: "C'est combien ?" },
      please: { native: "S'il vous plaît" },
      thankYou: { native: "Merci" },
      water: { native: "De l'eau" },
      whereIs: { native: "Où est… ?" },
      yesNo: { native: "Oui / Non" },
    },
  },
  hi: {
    code: "hi",
    nameEn: "Hindi",
    nativeName: "हिन्दी",
    nonLatin: true,
    phrases: {
      bathroom: { native: "शौचालय कहाँ है?", roman: "shauchalay kahan hai?" },
      billPlease: { native: "बिल दीजिए", roman: "bill dijiye" },
      dontUnderstand: {
        native: "मुझे समझ नहीं आया",
        roman: "mujhe samajh nahin aaya",
      },
      excuseMe: { native: "माफ़ कीजिए", roman: "maaf kijiye" },
      hello: { native: "नमस्ते", roman: "namaste" },
      help: { native: "मदद करो!", roman: "madad karo!" },
      howMuch: { native: "यह कितने का है?", roman: "yeh kitne ka hai?" },
      please: { native: "कृपया", roman: "kripya" },
      thankYou: { native: "धन्यवाद", roman: "dhanyavaad" },
      water: { native: "पानी", roman: "paani" },
      whereIs: { native: "… कहाँ है?", roman: "… kahan hai?" },
      yesNo: { native: "हाँ / नहीं", roman: "haan / nahin" },
    },
  },
  hu: {
    code: "hu",
    nameEn: "Hungarian",
    nativeName: "Magyar",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Hol van a mosdó?" },
      billPlease: { native: "A számlát, kérem" },
      dontUnderstand: { native: "Nem értem" },
      excuseMe: { native: "Elnézést" },
      hello: { native: "Jó napot" },
      help: { native: "Segítség!" },
      howMuch: { native: "Mennyibe kerül?" },
      please: { native: "Kérem" },
      thankYou: { native: "Köszönöm" },
      water: { native: "Víz" },
      whereIs: { native: "Hol van…?" },
      yesNo: { native: "Igen / Nem" },
    },
  },
  id: {
    code: "id",
    nameEn: "Indonesian",
    nativeName: "Bahasa Indonesia",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Di mana toiletnya?" },
      billPlease: { native: "Minta bon, ya" },
      dontUnderstand: { native: "Saya tidak mengerti" },
      excuseMe: { native: "Permisi" },
      hello: { native: "Halo" },
      help: { native: "Tolong!" },
      howMuch: { native: "Berapa harganya?" },
      please: { native: "Tolong / Silakan" },
      thankYou: { native: "Terima kasih" },
      water: { native: "Air" },
      whereIs: { native: "Di mana…?" },
      yesNo: { native: "Ya / Tidak" },
    },
  },
  is: {
    code: "is",
    nameEn: "Icelandic",
    nativeName: "Íslenska",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Hvar er klósettið?" },
      billPlease: { native: "Reikninginn, takk" },
      dontUnderstand: { native: "Ég skil ekki" },
      excuseMe: { native: "Afsakið" },
      hello: { native: "Halló / Góðan dag" },
      help: { native: "Hjálp!" },
      howMuch: { native: "Hvað kostar þetta?" },
      please: { native: "Vinsamlegast" },
      thankYou: { native: "Takk" },
      water: { native: "Vatn" },
      whereIs: { native: "Hvar er…?" },
      yesNo: { native: "Já / Nei" },
    },
  },
  it: {
    code: "it",
    nameEn: "Italian",
    nativeName: "Italiano",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Dov'è il bagno?" },
      billPlease: { native: "Il conto, per favore" },
      dontUnderstand: { native: "Non capisco" },
      excuseMe: { native: "Scusi" },
      hello: { native: "Ciao / Buongiorno" },
      help: { native: "Aiuto!" },
      howMuch: { native: "Quanto costa?" },
      please: { native: "Per favore" },
      thankYou: { native: "Grazie" },
      water: { native: "Acqua" },
      whereIs: { native: "Dov'è…?" },
      yesNo: { native: "Sì / No" },
    },
  },
  ja: {
    code: "ja",
    nameEn: "Japanese",
    nativeName: "日本語",
    nonLatin: true,
    phrases: {
      bathroom: {
        native: "トイレはどこですか？",
        roman: "toire wa doko desu ka?",
      },
      billPlease: {
        native: "お会計をお願いします",
        roman: "okaikei o onegai shimasu",
      },
      dontUnderstand: { native: "分かりません", roman: "wakarimasen" },
      excuseMe: { native: "すみません", roman: "sumimasen" },
      hello: { native: "こんにちは", roman: "konnichiwa" },
      help: { native: "助けて！", roman: "tasukete!" },
      howMuch: { native: "いくらですか？", roman: "ikura desu ka?" },
      please: { native: "お願いします", roman: "onegai shimasu" },
      thankYou: { native: "ありがとうございます", roman: "arigatō gozaimasu" },
      water: { native: "水", roman: "mizu" },
      whereIs: { native: "…はどこですか？", roman: "… wa doko desu ka?" },
      yesNo: { native: "はい / いいえ", roman: "hai / iie" },
    },
  },
  ko: {
    code: "ko",
    nameEn: "Korean",
    nativeName: "한국어",
    nonLatin: true,
    phrases: {
      bathroom: {
        native: "화장실이 어디예요?",
        roman: "hwajangsiri eodiyeyo?",
      },
      billPlease: { native: "계산해 주세요", roman: "gyesanhae juseyo" },
      dontUnderstand: { native: "이해가 안 돼요", roman: "ihaega an dwaeyo" },
      excuseMe: { native: "실례합니다", roman: "sillyehamnida" },
      hello: { native: "안녕하세요", roman: "annyeonghaseyo" },
      help: { native: "도와주세요!", roman: "dowajuseyo!" },
      howMuch: { native: "얼마예요?", roman: "eolmayeyo?" },
      please: { native: "주세요", roman: "juseyo" },
      thankYou: { native: "감사합니다", roman: "gamsahamnida" },
      water: { native: "물", roman: "mul" },
      whereIs: { native: "…이 어디예요?", roman: "… i eodiyeyo?" },
      yesNo: { native: "네 / 아니요", roman: "ne / aniyo" },
    },
  },
  ms: {
    code: "ms",
    nameEn: "Malay",
    nativeName: "Bahasa Melayu",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Di mana tandas?" },
      billPlease: { native: "Bil, tolong" },
      dontUnderstand: { native: "Saya tidak faham" },
      excuseMe: { native: "Maafkan saya" },
      hello: { native: "Hai / Selamat sejahtera" },
      help: { native: "Tolong!" },
      howMuch: { native: "Berapa harganya?" },
      please: { native: "Tolong / Sila" },
      thankYou: { native: "Terima kasih" },
      water: { native: "Air" },
      whereIs: { native: "Di mana…?" },
      yesNo: { native: "Ya / Tidak" },
    },
  },
  nl: {
    code: "nl",
    nameEn: "Dutch",
    nativeName: "Nederlands",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Waar is het toilet?" },
      billPlease: { native: "De rekening, alstublieft" },
      dontUnderstand: { native: "Ik begrijp het niet" },
      excuseMe: { native: "Pardon" },
      hello: { native: "Hallo" },
      help: { native: "Help!" },
      howMuch: { native: "Hoeveel kost het?" },
      please: { native: "Alstublieft" },
      thankYou: { native: "Dank u wel" },
      water: { native: "Water" },
      whereIs: { native: "Waar is…?" },
      yesNo: { native: "Ja / Nee" },
    },
  },
  pl: {
    code: "pl",
    nameEn: "Polish",
    nativeName: "Polski",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Gdzie jest toaleta?" },
      billPlease: { native: "Rachunek, proszę" },
      dontUnderstand: { native: "Nie rozumiem" },
      excuseMe: { native: "Przepraszam" },
      hello: { native: "Dzień dobry" },
      help: { native: "Pomocy!" },
      howMuch: { native: "Ile to kosztuje?" },
      please: { native: "Proszę" },
      thankYou: { native: "Dziękuję" },
      water: { native: "Woda" },
      whereIs: { native: "Gdzie jest…?" },
      yesNo: { native: "Tak / Nie" },
    },
  },
  pt: {
    code: "pt",
    nameEn: "Portuguese",
    nativeName: "Português",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Onde fica o banheiro?" },
      billPlease: { native: "A conta, por favor" },
      dontUnderstand: { native: "Não entendo" },
      excuseMe: { native: "Com licença / Desculpe" },
      hello: { native: "Olá" },
      help: { native: "Socorro!" },
      howMuch: { native: "Quanto custa?" },
      please: { native: "Por favor" },
      thankYou: { native: "Obrigado / Obrigada" },
      water: { native: "Água" },
      whereIs: { native: "Onde fica…?" },
      yesNo: { native: "Sim / Não" },
    },
  },
  sv: {
    code: "sv",
    nameEn: "Swedish",
    nativeName: "Svenska",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Var är toaletten?" },
      billPlease: { native: "Notan, tack" },
      dontUnderstand: { native: "Jag förstår inte" },
      excuseMe: { native: "Ursäkta" },
      hello: { native: "Hej" },
      help: { native: "Hjälp!" },
      howMuch: { native: "Hur mycket kostar det?" },
      please: { native: "Snälla / Tack" },
      thankYou: { native: "Tack" },
      water: { native: "Vatten" },
      whereIs: { native: "Var är…?" },
      yesNo: { native: "Ja / Nej" },
    },
  },
  sw: {
    code: "sw",
    nameEn: "Swahili",
    nativeName: "Kiswahili",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Choo kiko wapi?" },
      billPlease: { native: "Bili, tafadhali" },
      dontUnderstand: { native: "Sielewi" },
      excuseMe: { native: "Samahani" },
      hello: { native: "Jambo / Habari" },
      help: { native: "Msaada!" },
      howMuch: { native: "Bei gani?" },
      please: { native: "Tafadhali" },
      thankYou: { native: "Asante" },
      water: { native: "Maji" },
      whereIs: { native: "… iko wapi?" },
      yesNo: { native: "Ndiyo / Hapana" },
    },
  },
  th: {
    code: "th",
    nameEn: "Thai",
    nativeName: "ไทย",
    nonLatin: true,
    phrases: {
      bathroom: { native: "ห้องน้ำอยู่ที่ไหน?", roman: "hong naam yuu thii nai?" },
      billPlease: { native: "เช็คบิลด้วย", roman: "check bin duay" },
      dontUnderstand: { native: "ไม่เข้าใจ", roman: "mai khao jai" },
      excuseMe: { native: "ขอโทษ", roman: "kho thot" },
      hello: { native: "สวัสดี", roman: "sawatdee" },
      help: { native: "ช่วยด้วย!", roman: "chuay duay!" },
      howMuch: { native: "ราคาเท่าไหร่?", roman: "raakhaa thao rai?" },
      please: { native: "กรุณา", roman: "karunaa" },
      thankYou: { native: "ขอบคุณ", roman: "khop khun" },
      water: { native: "น้ำ", roman: "naam" },
      whereIs: { native: "…อยู่ที่ไหน?", roman: "… yuu thii nai?" },
      yesNo: { native: "ใช่ / ไม่", roman: "chai / mai" },
    },
  },
  tr: {
    code: "tr",
    nameEn: "Turkish",
    nativeName: "Türkçe",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Tuvalet nerede?" },
      billPlease: { native: "Hesap, lütfen" },
      dontUnderstand: { native: "Anlamıyorum" },
      excuseMe: { native: "Affedersiniz" },
      hello: { native: "Merhaba" },
      help: { native: "İmdat!" },
      howMuch: { native: "Ne kadar?" },
      please: { native: "Lütfen" },
      thankYou: { native: "Teşekkür ederim" },
      water: { native: "Su" },
      whereIs: { native: "… nerede?" },
      yesNo: { native: "Evet / Hayır" },
    },
  },
  vi: {
    code: "vi",
    nameEn: "Vietnamese",
    nativeName: "Tiếng Việt",
    nonLatin: false,
    phrases: {
      bathroom: { native: "Nhà vệ sinh ở đâu?" },
      billPlease: { native: "Tính tiền" },
      dontUnderstand: { native: "Tôi không hiểu" },
      excuseMe: { native: "Xin lỗi" },
      hello: { native: "Xin chào" },
      help: { native: "Cứu tôi!" },
      howMuch: { native: "Bao nhiêu tiền?" },
      please: { native: "Làm ơn" },
      thankYou: { native: "Cảm ơn" },
      water: { native: "Nước" },
      whereIs: { native: "… ở đâu?" },
      yesNo: { native: "Vâng / Không" },
    },
  },
};

/** All phrase languages in display order (English first, then alphabetical by English name). */
export const phraseLanguageList: PhraseLanguage[] = Object.values(
  phraseLanguages
).sort((a, b) =>
  a.code === "en" ? -1 : b.code === "en" ? 1 : a.nameEn.localeCompare(b.nameEn)
);

export function getPhraseLanguage(
  code: string | undefined | null
): PhraseLanguage | undefined {
  if (!code) {
    return undefined;
  }
  return (phraseLanguages as Record<string, PhraseLanguage | undefined>)[code];
}
