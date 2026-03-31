import fs from "fs";
const src = fs.readFileSync("games/duel-hangman/words.ts", "utf8");
const lines = src.split("\n");
const issues = [];
let currentLang = "";
let currentDiff = "";
for (const line of lines) {
	const langMatch = line.match(/^\s+(en|cs|de|es|fr|hi|it|ja|ko|pl|pt|zh):/);
	if (langMatch) currentLang = langMatch[1];
	const diffMatch = line.match(/^\s+(easy|medium|hard):/);
	if (diffMatch) currentDiff = diffMatch[1];
	const wordMatches = [...line.matchAll(/"([^"]+)"/g)];
	for (const wm of wordMatches) {
		const w = wm[1];
		if (w.length < 2) continue; // skip non-word matches
		if (/[^A-Z]/.test(w)) {
			issues.push(`DIACRIT ${currentLang}/${currentDiff}: ${w}`);
		}
		if (currentDiff === "easy" && w.length > 4) {
			issues.push(
				`LENGTH  ${currentLang}/${currentDiff}: ${w} (${w.length} chars, max 4)`,
			);
		}
		if (currentDiff === "medium" && (w.length < 5 || w.length > 6)) {
			issues.push(
				`LENGTH  ${currentLang}/${currentDiff}: ${w} (${w.length} chars, need 5-6)`,
			);
		}
		if (currentDiff === "hard" && w.length < 7) {
			issues.push(
				`LENGTH  ${currentLang}/${currentDiff}: ${w} (${w.length} chars, min 7)`,
			);
		}
	}
}
console.log(issues.length + " issues found:");
console.log(issues.join("\n"));
