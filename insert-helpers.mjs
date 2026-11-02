import fs from "fs";

const FILE = "src/StaffApp.jsx";

const helpers = `// ============ SAFE HELPERS ============
function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred. Please try again.";
}
function isRefreshNeeded(error) {
  const msg = getErrorMessage(error);
  return msg === "REFRESH_NEEDED" || msg.includes("badal diya");
}
function safeStorageGet(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
// ======================================
`;

// Read file as array of lines
const text = fs.readFileSync(FILE, "utf8");
const lines = text.split("\n");

// Already inserted?
if (text.includes("function safeStorageGet")) {
  console.log("Helpers already present. Nothing to do.");
  process.exit(0);
}

// Find the line index (0-based) of "} from \"firebase/firestore\";"
let firestoreEndIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('} from "firebase/firestore"')) {
    firestoreEndIdx = i;
    break;
  }
}

if (firestoreEndIdx === -1) {
  console.log('ERROR: Could not find line: } from "firebase/firestore"');
  console.log("File ka pehla 15 line dekho:");
  console.log(lines.slice(0, 15).map((l, i) => `${i + 1}: ${l}`).join("\n"));
  process.exit(1);
}

// Insert helpers AFTER that line (insert blank line, helpers, blank line)
const insertPos = firestoreEndIdx + 1;
const before = lines.slice(0, insertPos);
const after = lines.slice(insertPos);

const newLines = [
  ...before,
  "",                       // blank line
  ...helpers.split("\n"),   // helpers block
  "",                       // blank line
  ...after,
];

fs.writeFileSync(FILE, newLines.join("\n"));

console.log("=================================================");
console.log("SUCCESS");
console.log("=================================================");
console.log(`Firestore import end found at: line ${firestoreEndIdx + 1}`);
console.log(`Helpers inserted after line ${insertPos}`);
console.log(`Total helpers lines added: ${helpers.split("\n").length}`);
console.log("=================================================");
