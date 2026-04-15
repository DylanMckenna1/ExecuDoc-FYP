import { Client, Databases, Storage } from "node-appwrite";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
// env variables
const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY, // optional fallback (console/manual testing)
  APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_ID,
  BUCKET_ID,
} = process.env;

export default async ({ req, res, log, error }) => {
  try {
    const missing = [ // missing env variable check
      !APPWRITE_ENDPOINT && "APPWRITE_ENDPOINT",
      !APPWRITE_PROJECT_ID && "APPWRITE_PROJECT_ID",
      !APPWRITE_DATABASE_ID && "APPWRITE_DATABASE_ID",
      !APPWRITE_COLLECTION_ID && "APPWRITE_COLLECTION_ID",
      !BUCKET_ID && "BUCKET_ID",
    ].filter(Boolean);
// fail early if function isnt configured properly
    if (missing.length) {
      return res.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        400
      );
    }

    //  reads user JWT from the request headers
    const jwt =
      (req.headers?.["x-appwrite-jwt"] ||
        req.headers?.["X-Appwrite-JWT"] ||
        req.headers?.["x-appwrite-user-jwt"] ||
        "") // allows function to act as the logged in user, so follows user permissions
        .toString()
        .trim();
//create Appwrite client
    const client = new Client() // creates the appwrite sdk client
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);

    // Prefered auth Jwt which acts as logged-in user
    if (jwt) {
      client.setJWT(jwt);
    } else if (APPWRITE_API_KEY) {
      // Fallback for manual console testing ONLY
      client.setKey(APPWRITE_API_KEY);
      // otherwise reject the request
    } else {
      return res.json(
        { ok: false, error: "Missing X-Appwrite-JWT (login required)" },
        401
      );
    }
// access to database and storage operations
    const databases = new Databases(client);
    const storage = new Storage(client);

    // Parse request body
    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}; // parse incoming json
    } catch { // avoid crashes from bodies
      body = {};
    }
// Read docID or DocumentsID
    const docId = body.documentId || body.docId;
    if (!docId) return res.json({ ok: false, error: "Missing documentId/docId" }, 400);

    //loads document record
    const doc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID, // access to metadata
      docId
    );
// use the fileID
    const fileId = body.fileId || doc.fileId;
    if (!fileId) return res.json({ ok: false, error: "Missing fileId" }, 400);

    // Download file by SDK 
    const download = await storage.getFileDownload(BUCKET_ID, fileId);

    // Normalize to Buffer
    let buffer;
    if (download instanceof ArrayBuffer) { // ensures extraction libraries can read it consistently 
      buffer = Buffer.from(download);
    } else if (download?.arrayBuffer) {
      const ab = await download.arrayBuffer();
      buffer = Buffer.from(ab);
    } else if (Buffer.isBuffer(download)) {
      buffer = download;
    } else {
      buffer = Buffer.from(download);
    }
// determine file type
    const mimeType = (body.mimeType || doc.mimeType || "").toLowerCase(); //mime type first
    const title = (body.title || doc.title || "").toLowerCase(); 

    let textContent = "";

    // --- DOCX ---
    if (mimeType.includes("wordprocessingml.document") || title.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      textContent = (result?.value || "").trim();
    }

    // --- IMAGE (OCR) ---
    else if (mimeType.startsWith("image/")) {
      const { data } = await Tesseract.recognize(buffer, "eng");
      textContent = (data?.text || "").trim();
    }

    // --- PDF---
    else if (mimeType.includes("pdf") || title.endsWith(".pdf")) {
      const pdf = await pdfParse(buffer);
      textContent = (pdf?.text || "").trim();
    }

    // --- other ---
    else {
      textContent = "";
    }

    // Save into DB so Documents.js can read doc.textContent next time
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      docId,
      { textContent }
    );
//frontend service can also use the extracted text
    return res.json({ ok: true, docId, textContent });
    // backend error handling
  } catch (e) {
    error(e);
    return res.json({ ok: false, error: e?.message || String(e) }, 500);
  }
};

