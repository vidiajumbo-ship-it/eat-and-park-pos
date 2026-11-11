const RELOAD_FLAG = "ep_fs_recover_ts";
const RELOAD_COOLDOWN_MS = 60_000;
const FS_ERROR_PATTERN = /INTERNAL ASSERTION FAILED|isCorePipeline|getTargetData/i;

function isFirestoreCrash(err) {
  if (!err) return false;
  const reasonMsg = err.reason && typeof err.reason === "object" && err.reason.message;
  const msg = String(err.message || reasonMsg || err.reason || err);
  return FS_ERROR_PATTERN.test(msg);
}

async function wipeFirestoreIndexedDB() {
  if (typeof indexedDB === "undefined") return;
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    await Promise.all(
      dbs.filter((d) => d.name && d.name.toLowerCase().includes("firestore"))
        .map((d) => new Promise((res) => {
          const r = indexedDB.deleteDatabase(d.name);
          r.onsuccess = r.onerror = r.onblocked = () => res();
        }))
    );
  } catch (e) { console.warn("[recover] IDB wipe failed:", e); }
}

export async function tryRecover(err) {
  if (!isFirestoreCrash(err)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch (_) {}
  console.warn("[recover] Firestore crash → wipe cache + reload");
  await wipeFirestoreIndexedDB();
  window.location.reload();
  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => tryRecover(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => tryRecover(e.reason));
}
