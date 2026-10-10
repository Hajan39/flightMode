// Pure, dependency-free Word Guess logic — extracted from the component so it
// can be unit-tested (green/yellow/gray marking incl. double letters, word pool
// integrity) without pulling in React Native.

export type LetterState =
  | "correct"
  | "present"
  | "absent"
  | "empty"
  | "pending";

const AVIATION_WORDS = [
  "PILOT",
  "PLANE",
  "RADAR",
  "CABIN",
  "TOWER",
  "CARGO",
  "FLAPS",
  "CLOUD",
  "GATES",
  "ROUTE",
  "DELTA",
  "PITCH",
  "CLEAR",
  "CLIMB",
  "GLIDE",
  "HOVER",
  "ORBIT",
  "SKIES",
  "VAPOR",
  "GAUGE",
  "CHUTE",
  "SONIC",
  "BOOST",
  "WINDS",
  "FRONT",
  "NIGHT",
  "SKIDS",
  "TAXIS",
  "PYLON",
  "BRACE",
  "VISOR",
  "QUEUE",
  "TRAIL",
  "FUMES",
  "BRAKE",
  "SPEED",
  "LIGHT",
  "LAPSE",
  "STORM",
  "PROPS",
];

const COMMON_WORDS = [
  "RAISE",
  "HOUSE",
  "LIGHT",
  "PLACE",
  "STAND",
  "THINK",
  "FOUND",
  "GREAT",
  "OFTEN",
  "ABOVE",
  "EVERY",
  "THOSE",
  "STILL",
  "SINCE",
  "THREE",
  "WHILE",
  "MIGHT",
  "AFTER",
  "WATER",
  "ABOUT",
  "AGAIN",
  "WORLD",
  "NIGHT",
  "PHONE",
  "BLACK",
  "WHITE",
  "YOUNG",
  "SMALL",
  "HEART",
  "MUSIC",
  "DRIVE",
  "WRITE",
  "PAPER",
  "SHARE",
  "CHAIR",
  "SMILE",
  "FIELD",
  "DREAM",
  "BREAK",
  "CLOCK",
  "FLOOR",
  "POINT",
  "POWER",
  "BREAD",
  "EARTH",
  "GLASS",
  "GRADE",
  "GRACE",
  "PEACE",
  "PRIZE",
  "QUEEN",
  "SPACE",
  "SPARK",
  "STAGE",
  "STAKE",
  "STARE",
  "STORY",
  "STYLE",
  "SUITE",
  "SWEAR",
  "SWEET",
  "SWORD",
  "SWORE",
  "TABLE",
  "TASTE",
  "TEACH",
  "TEARS",
  "TEETH",
  "THANK",
  "THEME",
  "THICK",
  "THING",
  "THORN",
  "THOSE",
  "THROW",
  "TIGHT",
  "TIRED",
  "TODAY",
  "TOKEN",
  "TAKEN",
  "TOUGH",
  "TOWEL",
  "TRACK",
  "TRADE",
  "TRAIN",
  "TREAT",
  "TREND",
  "TRIBE",
  "TRICK",
  "TRIED",
  "BRING",
  "BUILD",
  "BUILT",
  "BURST",
  "BUYER",
  "CARGO",
  "CARRY",
  "CAUSE",
  "CEASE",
  "CEDAR",
  "CHALK",
  "CHAOS",
  "CHECK",
  "CHESS",
  "CHIEF",
  "CHILD",
  "CLAIM",
  "CLASS",
  "CLEAN",
  "CLERK",
];

// Travel, food, nature and everyday words: together the pool covers a full
// year of daily words without a repeat.
const MORE_WORDS = `
BEACH COAST OCEAN HOTEL VISIT GUIDE TOURS MONEY PASTA PIZZA LEMON MANGO GRAPE
APPLE PEACH MELON BERRY HONEY SUGAR SALAD SAUCE SPICE CREAM DRINK JUICE TOAST
BACON STEAK CANDY LUNCH SNACK FEAST RIVER LAKES TREES PLANT GRASS FLAME STONE
SHORE WAVES CORAL TIDES DUNES CLIFF RIDGE PEAKS SUNNY RAINY WINDY FROST SNOWY
MOUNT HILLS MARSH CREEK BLOOM PETAL TIGER ZEBRA HORSE SHEEP MOUSE EAGLE RAVEN
CRANE STORK GOOSE SHARK WHALE OTTER SNAIL CAMEL LLAMA PANDA KOALA BISON MOOSE
LUNAR SOLAR GLOBE ATLAS WATCH CHAIN KNIFE SPOON PLATE RADIO VIDEO PHOTO BRUSH
SHIRT SOCKS SHOES BOOTS SCARF GLOVE JEANS DRESS PURSE SHELF COUCH HAPPY QUIET
EARLY LEARN LAUGH SLEEP RELAX ENJOY REACH START BEGIN SHINE SMART BRAVE PROUD
FRESH CRISP SHARP ROUND SOLID EXTRA FINAL FIRST LARGE GIANT BRIEF QUICK RAPID
SWIFT HEAVY LUCKY MAGIC FUNNY EMPTY READY ALIVE AWAKE FOCUS SOLVE GUESS SCORE
MATCH LEVEL BONUS TIMER MONTH MAJOR MINOR NOBLE ROYAL CROWN PLAZA ALLEY VILLA
HUMAN PARTY GUEST ENTRY ANGEL AWARD BADGE BASIC BENCH BLANK BLEND BLOCK BOARD
BRAIN BRAND BRASS BRICK BROAD BROWN BUNCH CANAL CATCH CHART CHASE CHEAP CHEER
CHEST CHORD CLOSE COACH COUNT COURT COVER CRAFT CROSS CROWD CURVE CYCLE DAILY
DANCE DEPTH DIARY DOZEN DRAFT DRAMA EIGHT ELBOW EQUAL EVENT EXACT FANCY FENCE
FIFTY FLASH FLEET FLOAT FLOCK FLOUR FLUTE FORCE FORUM FRAME FRUIT GIVEN GRAIN
GRAND GREEN GROUP GUARD HABIT HEDGE HOBBY HONOR HUMOR IDEAL IMAGE INDEX INNER
IVORY JEWEL JOLLY JUDGE KNOCK LABEL LASER LAYER LIMIT LINEN LOCAL LOGIC LOYAL
MAKER MARCH METAL MODEL MOTOR MOUTH MOVIE NEVER NORTH NOVEL NURSE OFFER OLIVE
OPERA ORDER OTHER OWNER PAINT PANEL PEARL PIANO PIECE PLAIN PRESS PRICE PRIDE
PRINT PROOF QUEST QUOTE RANGE REPLY RIGHT RIVAL ROBIN ROCKY RUGBY RURAL SCALE
SCENE SEVEN SHADE SHAPE SHELL SHIFT SHORT SIGHT SKILL SLICE SLIDE SOUTH SPARE
SPEAK SPELL SPEND SPORT STAFF STAMP STEAM STEEL STICK STOVE STRAW STUDY SUPER
SWING SYRUP TITLE TOPIC TORCH TOTAL TRUCK TRUST TRUTH TULIP TWICE TWIST UNCLE
UNDER UNITY UPPER URBAN USUAL VALUE VERSE VIVID VOICE WAGON WHEAT WHEEL WHOLE
YACHT YOUTH
`
  .trim()
  .split(/\s+/);

export const WORD_POOL = [
  ...new Set([...AVIATION_WORDS, ...COMMON_WORDS, ...MORE_WORDS]),
].filter((w) => w.length === 5);

export function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Wordle marking. Two passes so double letters resolve correctly: greens are
 * consumed first, then each remaining letter is matched against the still-
 * unconsumed target letters. Guarantees no more yellows/greens for a letter
 * than it actually occurs in the target.
 */
export function checkGuess(guess: string, target: string): LetterState[] {
  const states: LetterState[] = new Array(5).fill("absent");
  const targetChars = target.split("");

  // Pass 1: greens
  for (let i = 0; i < 5; i += 1) {
    if (guess[i] === target[i]) {
      states[i] = "correct";
      targetChars[i] = ""; // consumed
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < 5; i += 1) {
    if (states[i] === "correct") {
      continue;
    }
    const idx = targetChars.indexOf(guess[i]);
    if (idx !== -1) {
      states[i] = "present";
      targetChars[idx] = ""; // consume
    }
  }

  return states;
}

export const PRIORITY: Record<LetterState, number> = {
  absent: 1,
  correct: 3,
  empty: 0,
  pending: 0,
  present: 2,
};

export function mergeKeyboard(
  existing: Record<string, LetterState>,
  newStates: LetterState[],
  letters: string[]
): Record<string, LetterState> {
  const next = { ...existing };
  letters.forEach((letter, i) => {
    const cur = next[letter];
    const inc = newStates[i];
    if (!cur || PRIORITY[inc] > PRIORITY[cur]) {
      next[letter] = inc;
    }
  });
  return next;
}
