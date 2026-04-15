import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// parses incoming json 
function safeJsonParse(maybeString) {
  if (maybeString == null) return {};
  if (typeof maybeString === "object") return maybeString;
  if (typeof maybeString !== "string") return {};
  const s = maybeString.trim();
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

async function getFetch() {
  if (typeof fetch === "function") return fetch; //use build in fetch 
  const mod = await import("node-fetch"); // otherwise load node path
  return mod.default;
}
// reads environment variables 
function pickEnv(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
// cleans appwrite endpoint
function normalizeAppwriteBase(endpoint) {
  // Accept either https://... or https://.../v1
  const e = (endpoint || "").trim().replace(/\/+$/, ""); // removes trailing slashes and /v1 if it exists already
  return e.replace(/\/v1$/i, "");
}
// split text for openAi
function chunkText(text, maxChars = 12000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

async function summariseText(openai, fullText, mode = "short") {
  const cleaned = (fullText || "") // normalise formatting, remove messy spacing and prep the text for summarisation
    .replace(/\r/g, "")  
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    return { summary: "", usedChars: 0, note: "No extractable text found." }; // if no text to summarise stop
  }
//text is split
  const chunks = chunkText(cleaned, 12000);

  const shortSystem = `You are a helpful assistant that summarises documents.
Return a concise, well-structured summary in bullet points with clear headings.
Keep it brief and focused on the most important points.
Do NOT invent information.`;

  const detailedSystem = `You are a helpful assistant that summarises documents.
Return a detailed, well-structured summary in bullet points with clear headings.
Include the main ideas, supporting points, important details, and outcomes.
Do NOT invent information.`;

  const system = mode === "detailed" ? detailedSystem : shortSystem;
// sends chunk to openAi 
  const summarizeChunk = async (text, idx, total) => {
    const intro =
      mode === "detailed"
        ? `Summarise this document section (${idx}/${total}) in detail. Include key points, supporting details, dates, and outcomes where relevant.\n\n`
        : `Summarise this document section (${idx}/${total}). Focus only on the most important points, dates, and outcomes.\n\n`;

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: intro + text,
        },
      ],
    });
    return resp.choices?.[0]?.message?.content?.trim() || "";
  };
//skip merge step 
  if (chunks.length === 1) {
    const one = await summarizeChunk(chunks[0], 1, 1);
    return { summary: one, usedChars: cleaned.length };
  }
// 2 stage summmary pipeline 
  const partials = [];
  for (let i = 0; i < chunks.length; i++) {
    partials.push(await summarizeChunk(chunks[i], i + 1, chunks.length));
  }

  const combined = partials.filter(Boolean).join("\n\n");

  const finalInstruction =
    mode === "detailed"
      ? `Combine these partial summaries into ONE final detailed summary. Avoid duplicates. Keep it structured and informative.`
      : `Combine these partial summaries into ONE final concise summary. Avoid duplicates. Keep it tight and readable.`;

  const finalResp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `${finalInstruction}\n\n${combined}`,
      },
    ],
  });

  return {
    summary: finalResp.choices?.[0]?.message?.content?.trim() || "",
    usedChars: cleaned.length,
  };
}
//File extraction helpers
async function extractTextFromPdfBuffer(buffer) { // extract readable text from a pdf buffer
  const data = await pdfParse(buffer);
  return (data?.text || "").trim();
}

async function extractTextFromDocxBuffer(buffer) { // extract raw text from a doc x file
  const result = await mammoth.extractRawText({ buffer });
  return (result?.value || "").trim();
}

async function summariseImageWithVision(openai, buffer, mimeType, mode = "short") {
  const b64 = buffer.toString("base64"); // converts image into base64
  const dataUrl = `data:${mimeType};base64,${b64}`; // wraps it as a data url

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          mode === "detailed"
            ? "You summarise what is in an image. If there is text, read it carefully and provide a detailed summary. If it is a photo or diagram, describe and summarise the key information clearly. Do not invent details."
            : "You summarise what is in an image. If there is text, read it carefully and summarise it briefly. If it is a photo or diagram, describe and summarise the key information. Do not invent details.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              mode === "detailed"
                ? "Summarise this image clearly in detailed bullet points with headings."
                : "Summarise this image clearly in concise bullet points with headings.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  return resp.choices?.[0]?.message?.content?.trim() || "";
}
//utility helpers for main handler
async function appwriteGetJson(doFetch, url, headers) { // used to make Get requests and parse json 
  const r = await doFetch(url, { method: "GET", headers });
  const text = await r.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: r.ok, status: r.status, text, json };
}

async function appwriteDownloadFile(doFetch, url, headers) { // download raw file bytes from storage
  const r = await doFetch(url, { method: "GET", headers });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return { ok: false, status: r.status, text: txt, buffer: null };
  }
  const ab = await r.arrayBuffer();
  return { ok: true, status: r.status, text: "", buffer: Buffer.from(ab) };
}
// functions entry point
export default async ({ req, res, log, error }) => {
  try {
    const body = safeJsonParse(req?.body); // read incoming request

   
    if (body?.ping) { // confirm function is working
      return res.json({ ok: true, pong: true });
    }

    // read doc id and mode 
    const docId = body?.docId;
    const mode = body?.mode === "detailed" ? "detailed" : "short";
    if (!docId) {
      return res.json(
        { ok: false, error: 'Missing required field: docId. Example: {"docId":"..."}' },
        400
      );
    }
 //read env variables
    const OPENAI_API_KEY = pickEnv("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return res.json({ ok: false, error: "OPENAI_API_KEY is missing in Function env vars." }, 500);
    }

   
    const DATABASE_ID = pickEnv("DATABASE_ID", "APPWRITE_DATABASE_ID");
    const COLLECTION_ID = pickEnv("DOCUMENTS_COLLECTION_ID", "APPWRITE_COLLECTION_ID");
    const BUCKET_ID = pickEnv("BUCKET_ID");
    const APPWRITE_PROJECT_ID = pickEnv("APPWRITE_PROJECT_ID");
    const APPWRITE_API_KEY = pickEnv("APPWRITE_API_KEY");
    const APPWRITE_ENDPOINT_RAW = pickEnv("APPWRITE_ENDPOINT");

    if (!DATABASE_ID || !COLLECTION_ID) {
      return res.json(
        {
          ok: false,
          error:
            "DATABASE_ID / DOCUMENTS_COLLECTION_ID env vars missing (or APPWRITE_DATABASE_ID / APPWRITE_COLLECTION_ID).",
        },
        500
      );
    }

    if (!BUCKET_ID || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !APPWRITE_ENDPOINT_RAW) {
      return res.json(
        {
          ok: false,
          error:
            "Missing one or more Appwrite env vars: BUCKET_ID, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_ENDPOINT.",
        },
        500
      );
    }
// prepare appwrite rest access
    const doFetch = await getFetch(); // gets fetch
    const base = normalizeAppwriteBase(APPWRITE_ENDPOINT_RAW); // normalise endpoint
    const v1 = `${base}/v1`; // creates v1

    const appwriteHeaders = {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": APPWRITE_API_KEY,
      "Content-Type": "application/json",
    };

    // 1) Load document record from DB
    const docUrl = `${v1}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${docId}`;
    log?.(`Loading document: ${docUrl}`);

    const docResp = await appwriteGetJson(doFetch, docUrl, appwriteHeaders);
    if (!docResp.ok) {
      return res.json(
        {
          ok: false,
          error: `Failed to load document from DB. HTTP ${docResp.status}`,
          details: docResp.json || docResp.text?.slice?.(0, 300) || "",
        },
        400
      );
    }
// reads
    const doc = docResp.json;
    const fileId = doc?.fileId;
    const mimeType = doc?.mimeType;
    const storedText = (doc?.textContent || "").trim();

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// 2)  reuse stored extracted text if available
if (storedText) {
  log?.(`Using stored textContent from document. Chars: ${storedText.length}`);
  const { summary, usedChars } = await summariseText(openai, storedText, mode);
  return res.json({
    ok: true,
    mimeType: mimeType || "",
    textChars: usedChars,
    source: "textContent",
    summary,
  });
}

if (!fileId || !mimeType) {
  return res.json(
    {
      ok: false,
      error: "Document record missing fileId or mimeType.",
      details: { fileId, mimeType },
    },
    400
  );
}

// 3) download file from Storage only if no stored text exists
const downloadUrl = `${v1}/storage/buckets/${BUCKET_ID}/files/${fileId}/download`;
log?.(`Downloading file: ${downloadUrl} (mime: ${mimeType})`); // needs file id and mimeType

const dl = await appwriteDownloadFile(doFetch, downloadUrl, appwriteHeaders);
if (!dl.ok) {
  return res.json(
    {
      ok: false,
      error: `Failed to download file. HTTP ${dl.status}`,
      details: dl.text?.slice?.(0, 300) || "",
    },
    400
  );
}

const buffer = dl.buffer;

   // 4) Extract and summarise by mimeType
    if (mimeType === "application/pdf") { // pdf
      const extractedText = await extractTextFromPdfBuffer(buffer);
      if (!extractedText) {
        return res.json(
          {
            ok: false,
            error:
              "No extractable text found in PDF. If this PDF is scanned, you’ll need OCR (future improvement).",
            mimeType,
          },
          400
        );
      }
      const { summary, usedChars } = await summariseText(openai, extractedText, mode);
      return res.json({ ok: true, mimeType, textChars: usedChars, summary });
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") { // docX
      const extractedText = await extractTextFromDocxBuffer(buffer);
      if (!extractedText) {
        return res.json({ ok: false, error: "No extractable text found in DOCX.", mimeType }, 400);
      }
      const { summary, usedChars } = await summariseText(openai, extractedText, mode);
      return res.json({ ok: true, mimeType, textChars: usedChars, summary });
    }

    if (mimeType === "text/plain") { //text/plain
      const extractedText = buffer.toString("utf8").trim();
      if (!extractedText) {
        return res.json({ ok: false, error: "No extractable text found in text file.", mimeType }, 400);
      }
      const { summary, usedChars } = await summariseText(openai, extractedText, mode);
      return res.json({ ok: true, mimeType, textChars: usedChars, summary });
    }

    if (mimeType.startsWith("image/")) { // image
      const summary = await summariseImageWithVision(openai, buffer, mimeType, mode);
      if (!summary) {
        return res.json({ ok: false, error: "No summary returned for image.", mimeType }, 500);
      }
      return res.json({ ok: true, mimeType, textChars: 0, summary });
    }

    return res.json(
      {
        ok: false,
        error: `Unsupported mimeType: ${mimeType}. Supported: application/pdf, docx, image/*, text/plain`,
        mimeType,
      },
      400
    );

    // logs an error and returns json error response
  } catch (e) {
    
    error?.(e?.stack || String(e));
    return res.json({ ok: false, error: String(e?.message || e) }, 500);
  }
};

