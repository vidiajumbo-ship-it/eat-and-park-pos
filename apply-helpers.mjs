import fs from "fs";

const FILE = "src/StaffApp.jsx";
const src = fs.readFileSync(FILE, "utf8");

if (src.includes("function safeStorageGet")) {
  console.log("Helpers already present. Nothing to do.");
  process.exit(0);
}

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

// Split into lines, find the LAST line that is part of an import statement.
// An import statement ends on a line that contains `;` and starts with `import` or `}`.
const lines = src.split("\n");
let insertAt = -1;

for (let k = 0; k < lines.length; k++) {
  const line = lines[k].trim();
  if (line === "") continue;
  // Skip everything until imports are done
  if (line.startsWith("import ") || line.startsWith("} from") || (insertAt >= 0 && !line.startsWith("import ") && !line.startsWith("}"))) {
    if (line.startsWith("import ") || line.startsWith("} from")) {
      insertAt = k + 1; // insert AFTER this line
    }
    continue;
  }
  // First non-import, non-blank line after imports — stop
  break;
}

if (insertAt === -1) {
  console.log("Could not detect imports. Aborting — do manual insert.");
  process.exit(1);
}

const before = lines.slice(0, insertAt).join("\n");
const after = lines.slice(insertAt).join("\n");
fs.writeFileSync(FILE, before + "\n" + helpers + after);
console.log(`Helpers inserted after line ${insertAt}.`);
