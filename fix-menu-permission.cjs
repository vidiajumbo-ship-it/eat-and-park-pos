const fs = require("fs");

const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
	console.error("❌ File nahi mili:", filePath);
	process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let edits = 0;

// ---------------------------------------------------------
// FIX 1: Menu listener par detailed error + auth state log
// ---------------------------------------------------------
const menuListenerOld = `const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
	if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
		// 🚀 FIX: 3900 items se crash hone se bachane ke liye sirf 150 items load karo
		setMenu(snap.data().items.slice(0, 150));
	} else {
		console.warn("⚠️ Menu khali hai. Customer app se pehli baar khulne pe seed hoga.");
		setMenu([]);
	}
}, (err) => { console.error("menu listener:", err); });`;

const menuListenerNew = `const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
	if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
		const allItems = snap.data().items;
		console.log("🔍 MENU DEBUG:", {
			totalItems: allItems.length,
			loadedItems: Math.min(allItems.length, 150),
			missingName: allItems.filter(x => !x?.name).length,
			objCategory: allItems.filter(x => typeof x?.category === "object").length,
			firstItem: allItems[0],
		});
		setMenu(allItems.slice(0, 150));
	} else {
		console.warn("⚠️ Menu khali hai ya document exist nahi karta.");
		setMenu([]);
	}
}, (err) => {
	console.error("🚨 MENU LISTENER ERROR:", err.code, err.message);
	if (err.code === "permission-denied") {
		console.error("👉 FIX: Firestore rules check karein. User login hai?:", !!auth?.currentUser);
		console.error("👉 Current user:", auth?.currentUser?.uid || "NOT LOGGED IN");
		console.error("👉 Rules Playground me 'settings/menu' read test karein.");
	}
	setMenu([]);
});`;

if (code.includes(menuListenerOld)) {
	code = code.replace(menuListenerOld, menuListenerNew);
	edits++;
	console.log("✅ Fix 1 apply: Menu listener me detailed error logging add ho gayi.");
} else {
	console.log("⚠️ Fix 1 SKIP: Listener code match nahi hua.");
}

// ---------------------------------------------------------
// FIX 2: Auth import check (agar auth import nahi hai to add karo)
// ---------------------------------------------------------
const authImportOld = `import { getAuth } from "firebase/auth";`;
const authImportNew = `import { getAuth, onAuthStateChanged } from "firebase/auth";`;

if (code.includes(authImportOld) && !code.includes("onAuthStateChanged")) {
	code = code.replace(authImportOld, authImportNew);
	edits++;
	console.log("✅ Fix 2 apply: onAuthStateChanged import add ho gaya.");
} else {
	console.log("ℹ️ Fix 2 SKIP: auth import already theek hai ya manually check karein.");
}

// ---------------------------------------------------------
// FIX 3: Auth state listener add karo (agar nahi hai)
// ---------------------------------------------------------
const authListenerMarker = `onAuthStateChanged(auth, (user) => {`;

if (!code.includes(authListenerMarker)) {
	// useEffect ke andar pehla onSnapshot dhoondo aur uske pehle auth listener add karo
	const snapshotMarker = `const unsubMenu = onSnapshot(doc(db, "settings", "menu"),`;

	if (code.includes(snapshotMarker)) {
		const authListenerCode = `// 🔍 DEBUG: Auth state log karo
		const unsubAuth = onAuthStateChanged(auth, (user) => {
			console.log("🔐 AUTH STATE:", user ? \`Logged in as \${user.uid}\` : "NOT LOGGED IN");
		});

		`;
		code = code.replace(snapshotMarker, authListenerCode + snapshotMarker);
		edits++;
		console.log("✅ Fix 3 apply: Auth state listener add ho gaya.");
	} else {
		console.log("⚠️ Fix 3 SKIP: onSnapshot marker nahi mila.");
	}
} else {
	console.log("ℹ️ Fix 3 SKIP: Auth listener already present hai.");
}

// Save
if (edits > 0) {
	fs.writeFileSync(filePath, code, "utf8");
	console.log(`\n🎉 Total ${edits} fixes apply ho gaye!`);
	console.log("👉 Ab app run karein aur console me '🔍 MENU DEBUG' aur '🔐 AUTH STATE' dekhein.");
} else {
	console.log("\n❌ Koi fix apply nahi hua. File manually check karein.");
}
