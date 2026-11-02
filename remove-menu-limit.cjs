const fs = require("fs");

const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
	console.error("❌ File nahi mili:", filePath);
	process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let edits = 0;

// ---------------------------------------------------------
// FIX 1: Menu listener se slice(0, 150) hatao
// ---------------------------------------------------------
const listenerOld = `    const allItems = snap.data().items;
		console.log("🔍 MENU DEBUG:", {
			totalItems: allItems.length,
			loadedItems: Math.min(allItems.length, 150),
			missingName: allItems.filter(x => !x?.name).length,
			objCategory: allItems.filter(x => typeof x?.category === "object").length,
			firstItem: allItems[0],
		});
		setMenu(allItems.slice(0, 150));`;

const listenerNew = `    setMenu(snap.data().items);`;

if (code.includes(listenerOld)) {
	code = code.replace(listenerOld, listenerNew);
	edits++;
	console.log("✅ Fix 1: Listener se 150 limit hat gayi — poora menu load hoga.");
} else {
	// fallback: agar debug log nahi hai, seedha slice hatao
	const fallbackOld = `setMenu(snap.data().items.slice(0, 150));`;
	const fallbackNew = `setMenu(snap.data().items);`;
	if (code.includes(fallbackOld)) {
		code = code.replace(fallbackOld, fallbackNew);
		edits++;
		console.log("✅ Fix 1 (fallback): Listener se 150 limit hat gayi.");
	} else {
		console.log("⚠️ Fix 1 SKIP: Listener code match nahi hua.");
	}
}

// ---------------------------------------------------------
// FIX 2: filtered useMemo se .slice(0, 150) hatao
// ---------------------------------------------------------
const filterOld = `)).slice(0, 150), [menu, category, debouncedSearch]);`;
const filterNew = `)), [menu, category, debouncedSearch]);`;

if (code.includes(filterOld)) {
	code = code.replace(filterOld, filterNew);
	edits++;
	console.log("✅ Fix 2: Render filter se 150 limit hat gayi.");
} else {
	console.log("⚠️ Fix 2 SKIP: Filter code match nahi hua (manual check).");
}

// ---------------------------------------------------------
// FIX 3: Estimate panel se .slice(0, 150) hatao
// ---------------------------------------------------------
const estOld = `    ).slice(0, 150);`;
const estNew = `    );`;

if (code.includes(estOld)) {
	code = code.replace(estOld, estNew);
	edits++;
	console.log("✅ Fix 3: Estimate panel se 150 limit hat gayi.");
} else {
	console.log("⚠️ Fix 3 SKIP: Estimate code match nahi hua (manual check).");
}

// Save
if (edits > 0) {
	fs.writeFileSync(filePath, code, "utf8");
	console.log(`\n🎉 Total ${edits} fixes apply ho gaye — poora menu wapas aayega.`);
} else {
	console.log("\n❌ Koi fix apply nahi hua. File manually check karein.");
}
