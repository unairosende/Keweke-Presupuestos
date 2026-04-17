const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { google } = require("googleapis");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const geminiKey = defineSecret("GEMINI_KEY");
const DRIVE_FOLDER_ID = "1CUCUus_SXkrqdyUypfyRkXJs7y7AOCm6";
const BUCKET = "keweke-presupuestos-583aa.firebasestorage.app";

// ── Gemini proxy ──────────────────────────────────────────────────────────────
exports.geminiGenerate = onRequest(
  { secrets: [geminiKey], region: "europe-west1" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "https://unairosende.github.io");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "3600");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    const prompt = body?.prompt || body?.data?.prompt;
    if (!prompt) { res.status(400).json({ error: "Falta el prompt" }); return; }
    try {
      const response = await fetch(
       "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey.value() },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          }),
        }
      );
      const data = await response.json();
      if (data.error) { res.status(500).json({ error: data.error.message }); return; }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      res.json({ result: raw });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Helper: Google Drive auth ─────────────────────────────────────────────────
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

// ── Upload to Drive when saved to Storage ────────────────────────────────────
exports.backupPDFtoDrive = onObjectFinalized(
  { bucket: BUCKET, region: "us-east1", memory: "512MiB", timeoutSeconds: 120 },
  async (event) => {
    const filePath = event.data.name;
    if (!filePath.startsWith("pdfs/")) return;

    const fileName = filePath.split("/").pop();

    try {
      const bucket = admin.storage().bucket(BUCKET);
      const [contents] = await bucket.file(filePath).download();
      const htmlContent = contents.toString("utf-8");

      const drive = await getDriveClient();
      const db = admin.firestore();

      // Find the presupuesto doc that has this file
      const snapshot = await db.collection("presupuestos").get();
      let presupuestoRef = null;
      let existingDriveId = null;

      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.pdfUrl && d.pdfUrl.includes(encodeURIComponent(fileName))) {
          presupuestoRef = doc.ref;
          existingDriveId = d.driveFileId || null;
        }
      });

      const drive2 = drive;
      let driveFileId = null;

      if (existingDriveId) {
        // Try to update existing
        try {
          await drive2.files.update({
            fileId: existingDriveId,
            media: { mimeType: "text/html; charset=utf-8", body: htmlContent },
            supportsAllDrives: true,
          });
          driveFileId = existingDriveId;
          console.log(`Updated ${fileName} in Drive (id: ${driveFileId})`);
        } catch(e) {
          console.log(`Could not update, will create new: ${e.message}`);
          existingDriveId = null;
        }
      }

      if (!existingDriveId) {
        // Create as plain HTML file (NOT Google Doc) so ID is stable
        const created = await drive2.files.create({
          requestBody: {
            name: fileName,
            parents: [DRIVE_FOLDER_ID],
          },
          media: { mimeType: "text/html; charset=utf-8", body: htmlContent },
          fields: "id",
          supportsAllDrives: true,
        });
        driveFileId = created.data.id;
        console.log(`Created ${fileName} in Drive (id: ${driveFileId})`);
      }

      // Save driveFileId to Firestore
      if (presupuestoRef && driveFileId) {
        await presupuestoRef.update({ driveFileId });
        console.log(`Saved driveFileId ${driveFileId} to Firestore`);
      } else {
        console.log(`Could not find presupuesto for ${fileName} to save driveFileId`);
      }

    } catch (err) {
      console.error("Error backing up to Drive:", err.message);
    }
  }
);

// ── Delete from Drive when presupuesto deleted from Firestore ─────────────────
exports.deletePDFfromDrive = onDocumentDeleted(
  { document: "presupuestos/{docId}", region: "europe-west1" },
  async (event) => {
    const data = event.data.data();
    const driveFileId = data?.driveFileId;

    if (!driveFileId) {
      console.log("No driveFileId found, skipping Drive deletion");
      return;
    }

    try {
      const drive = await getDriveClient();
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
      console.log(`Deleted Drive file ${driveFileId}`);
    } catch (err) {
      console.error("Error deleting from Drive:", err.message);
    }
  }
);

// ── Delete specific Drive file by ID (called from frontend) ───────────────────
exports.deleteDriveFile = onRequest(
  { region: "europe-west1" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "https://unairosende.github.io");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    const { fileId } = req.body || {};
    if (!fileId) { res.status(400).json({ error: "Falta fileId" }); return; }

    try {
      const drive = await getDriveClient();
      await drive.files.delete({ fileId, supportsAllDrives: true });
      console.log(`Deleted Drive file ${fileId}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("Error deleting Drive file:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);
