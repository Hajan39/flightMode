const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const branch = process.argv[2];
const allowedBranches = new Set(["preview", "production"]);

if (!allowedBranches.has(branch)) {
	console.error("Usage: node ./scripts/eas-update-from-changelog.js <preview|production>");
	process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");

function readChangelog() {
	return fs.readFileSync(changelogPath, "utf8");
}

function getUnreleasedSection(changelog) {
	const match = changelog.match(
		/^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[|\Z)/m,
	);

	if (!match) {
		throw new Error("Missing ## [Unreleased] section in CHANGELOG.md");
	}

	return match[1].trim();
}

function buildUpdateMessage(unreleasedSection) {
	const lines = unreleasedSection
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	const sections = [];
	let currentHeading = null;
	let currentItems = [];

	const flush = () => {
		if (currentHeading && currentItems.length > 0) {
			sections.push(`${currentHeading}: ${currentItems.join("; ")}`);
		}
		currentItems = [];
	};

	for (const line of lines) {
		if (line.startsWith("### ")) {
			flush();
			currentHeading = line.replace(/^###\s+/, "").trim();
			continue;
		}

		if (line.startsWith("- ")) {
			currentItems.push(line.slice(2).trim());
		}
	}

	flush();

	if (sections.length === 0) {
		throw new Error(
			"CHANGELOG.md Unreleased section does not contain any bullet items to publish",
		);
	}

	return sections.join(" | ");
}

let message;

try {
	message = buildUpdateMessage(getUnreleasedSection(readChangelog()));
} catch (error) {
	console.error(error.message);
	process.exit(1);
}

console.log(`Using changelog-derived update message for ${branch}:`);
console.log(message);

const result = spawnSync(
	process.platform === "win32" ? "npx.cmd" : "npx",
	[
		"eas-cli",
		"update",
		"--branch",
		branch,
		"--environment",
		branch,
		"--message",
		message,
		"--non-interactive",
		"--json",
	],
	{
		cwd: repoRoot,
		stdio: "inherit",
	},
);

if (typeof result.status === "number") {
	process.exit(result.status);
}

process.exit(1);