const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Get gmail config from functions config: firebase functions:config:set gmail.email=... gmail.pass=... gmail.from=...
const GMAIL_EMAIL = functions.config()?.gmail?.email || "";
const GMAIL_PASS = functions.config()?.gmail?.pass || "";
const FROM_EMAIL = functions.config()?.gmail?.from || GMAIL_EMAIL;

if (!GMAIL_EMAIL || !GMAIL_PASS) {
  console.warn(
    "GMAIL credentials not set. Run: firebase functions:config:set gmail.email=\"you@gmail.com\" gmail.pass=\"APP_PASSWORD\" gmail.from=\"Your <you@gmail.com>\""
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_EMAIL,
    pass: GMAIL_PASS,
  },
});

// helper: generate 6-digit code
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /sendOtp  { email }
exports.sendOtp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send({ success: false, message: "Only POST" });
      const { email } = req.body;
      if (!email) return res.status(400).send({ success: false, message: "Email required" });

      const code = generateOtp();
      const createdAt = Date.now();

      // Save OTP to Firestore
      await db.collection("emailOtps").doc(email).set({ code, createdAt });

      // send email
      const mailOptions = {
        from: FROM_EMAIL,
        to: email,
        subject: "Your Social Vibing verification code",
        text: `Your 6-digit verification code is ${code}. This code will expire in 5 minutes.`,
      };

      await transporter.sendMail(mailOptions);

      return res.send({ success: true, message: "OTP sent" });
    } catch (err) {
      console.error("sendOtp error:", err);
      return res.status(500).send({ success: false, message: err.message || "Server error" });
    }
  });
});

// POST /verifyOtp  { email, code }
// On success: generate custom token and return it { success:true, token }
exports.verifyOtp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send({ success: false, message: "Only POST" });
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).send({ success: false, message: "Email and code required" });

      const docRef = db.collection("emailOtps").doc(email);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(400).send({ success: false, message: "No OTP found" });

      const data = doc.data();
      const savedCode = data.code;
      const createdAt = data.createdAt || 0;

      const expired = Date.now() - createdAt > 5 * 60 * 1000; // 5 minutes
      if (expired) {
        await docRef.delete().catch(() => {});
        return res.status(400).send({ success: false, message: "OTP expired" });
      }

      if (savedCode !== code) return res.status(400).send({ success: false, message: "Invalid OTP" });

      // OTP ok → delete it
      await docRef.delete();

      // Ensure Firebase Auth user exists; if not create
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (err) {
        // user not found; create one
        userRecord = await admin.auth().createUser({ email });
      }

      // create custom token
      const customToken = await admin.auth().createCustomToken(userRecord.uid);

      return res.send({ success: true, token: customToken });
    } catch (err) {
      console.error("verifyOtp error:", err);
      return res.status(500).send({ success: false, message: err.message || "Server error" });
    }
  });
});
