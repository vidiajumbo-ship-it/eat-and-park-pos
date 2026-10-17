const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.setStaffRole = functions.https.onCall(async (data, context) => {
  const BOOTSTRAP_SECRET = "CHANGE_ME_12345";
  const isBootstrap = data.bootstrap === true && data.bootstrapSecret === BOOTSTRAP_SECRET;

  if (!isBootstrap) {
    if (!context.auth || context.auth.token.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Sirf admin hi role assign kar sakta hai");
    }
  }

  const { uid, role } = data;
  if (!uid || !["admin", "staff", "waiter"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "uid ya role invalid hai");
  }

  await admin.auth().setCustomUserClaims(uid, { role });
  await admin.firestore().collection("staff").doc(uid).set(
    { role, updatedAt: Date.now() },
    { merge: true }
  );

  return { ok: true, uid, role };
});

exports.health = functions.https.onRequest((req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
