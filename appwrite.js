// services/appwrite.js
import {
  Client,
  Account,
  Databases,
  Storage,
  Functions,
  ID,
  Query,
  Permission,
  Role,
} from "react-native-appwrite";

// Expo .env helpers 
function env(key, fallback = "") {
  return (process?.env?.[key] ?? fallback) || fallback;
}

// Core Appwrite configur
export const APPWRITE_ENDPOINT = env(
  "EXPO_PUBLIC_APPWRITE_ENDPOINT",
  "https://fra.cloud.appwrite.io/v1"
);
export const APPWRITE_PROJECT_ID = env(
  "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
  "690bc577001de9633dc5"
);

export const DATABASE_ID = "execudoc_db";
export const DOCUMENTS_COLLECTION_ID = "documents";
export const BUCKET_ID = "69202f250019fb07635d";

export const SAVED_ITEMS_COLLECTION_ID = "savedItems";
export const VOICE_RECORDINGS_BUCKET_ID = "69b2d9b00003b46bfc62";
export const TRANSCRIBE_VOICE_FUNCTION_ID = "transcribeVoice";
export { Query };

// Function domains (from .env) 
export const TTS_FUNCTION_URL = env("EXPO_PUBLIC_TTS_FUNCTION_URL", "");
export const EXTRACT_TEXT_FUNCTION_ID = "697552940000b9d83b57";
export const TAG_FUNCTION_ID = env("EXPO_PUBLIC_TAG_FUNCTION_ID", "");
console.log("TAG_FUNCTION_ID:", TAG_FUNCTION_ID);


// summarise function URL 
export const SUMMARISE_FUNCTION_URL =
  "https://6969232f000c0badafbe.fra.appwrite.run";

const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const functions = new Functions(client);

export const databasesClient = databases;

async function getJwtString() {
  const j = await account.createJWT();
  return typeof j === "string" ? j : j?.jwt || "";
}

// Auth helpers
export async function register(email, password, name) {
  const user = await account.create(ID.unique(), email, password, name);
  await login(email, password);
  return user;
}

export async function login(email, password) {
  return account.createEmailPasswordSession(email, password);
}

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch (e) {
    console.log("getCurrentUser error", e?.message || e);
    return null;
  }
}

export async function logout() {
  try {
    await account.deleteSessions();
  } catch (e) {
    console.log("logout error", e?.message || e);
  }
}

// Helpers 
function guessFileType(mimeOrName) {
  const val = (mimeOrName || "").toLowerCase();
  if (val.startsWith("image/")) return "image";
  if (val.includes("pdf") || val.endsWith(".pdf")) return "pdf";
  if (val.startsWith("audio/")) return "audio";
  return "other";
}

const ALLOWED_CATEGORIES = ["work", "study", "legal", "finance", "history", "personal", "other"];

function normaliseCategory(value) {
  return (value || "").toString().trim().toLowerCase();
}

function toKeywordString(keywords) {
  if (Array.isArray(keywords)) return keywords.join(" ").toLowerCase();
  return (keywords || "").toString().toLowerCase();
}

function mapCategory(rawCategory, keywords, title) {
  const c = normaliseCategory(rawCategory);
  const kw = toKeywordString(keywords);
  const t = (title || "").toString().toLowerCase();

  const combined = `${c} ${kw} ${t}`.replace(/\s+/g, " ").trim();

  // finance
  if (
    combined.includes("account") ||
    combined.includes("accounting") ||
    combined.includes("invoice") ||
    combined.includes("receipt") ||
    combined.includes("bank") ||
    combined.includes("statement") ||
    combined.includes("tax") ||
    combined.includes("vat") ||
    combined.includes("payroll") ||
    combined.includes("audit") ||
    combined.includes("finance")
  ) {
    return "finance";
  }

  // legal
  if (
    combined.includes("nda") ||
    combined.includes("contract") ||
    combined.includes("agreement") ||
    combined.includes("terms") ||
    combined.includes("policy") ||
    combined.includes("gdpr") ||
    combined.includes("legal")
  ) {
    return "legal";
  }

  // work
  if (
    combined.includes("cv") ||
    combined.includes("resume") ||
    combined.includes("interview") ||
    combined.includes("job") ||
    combined.includes("employment") ||
    combined.includes("offer") ||
    combined.includes("onboarding") ||
    combined.includes("hr") ||
    combined.includes("work")
  ) {
    return "work";
  }

  // study
  if (
    combined.includes("leaving cert") ||
    combined.includes("junior cert") ||
    combined.includes("exam") ||
    combined.includes("essay") ||
    combined.includes("assignment") ||
    combined.includes("homework") ||
    combined.includes("lecture") ||
    combined.includes("notes") ||
    combined.includes("college") ||
    combined.includes("school") ||
    combined.includes("study") ||
    combined.includes("thesis") ||
    combined.includes("project")
  ) {
    return "study";
  }

  // history
  if (
    combined.includes("history") ||
    combined.includes("world war") ||
    combined.includes("ww1") ||
    combined.includes("ww2") ||
    combined.includes("hitler") ||
    combined.includes("nazi") ||
    combined.includes("allies") ||
    combined.includes("battle") ||
    combined.includes("treaty") ||
    combined.includes("revolution") ||
    combined.includes("1916")
  ) {
    return "history";
  }

  // personal
  if (
    combined.includes("personal") ||
    combined.includes("family") ||
    combined.includes("travel") ||
    combined.includes("holiday") ||
    combined.includes("gym") ||
    combined.includes("health") ||
    combined.includes("journal") ||
    combined.includes("diary")
  ) {
    return "personal";
  }

  if (ALLOWED_CATEGORIES.includes(c)) return c;

  return "other";
}

// Document and storage 
export async function uploadUserDoc(userId, file) {
  if (!userId) throw new Error("Missing userId (you must be logged in).");

  if (!file || !file.uri || !file.name) {
    console.log("uploadUserDoc invalid file arg:", file);
    throw new Error("Invalid file selected.");
  }

  const name = file.name;
  const mimeType = file.type || "application/octet-stream";
  const size = file.size || 0;
  const fileType = guessFileType(file.type || file.name);

  const storedFile = await storage.createFile({
    bucketId: BUCKET_ID,
    fileId: ID.unique(),
    file: { name, type: mimeType, size, uri: file.uri },
  });

  const doc = await databases.createDocument(
    DATABASE_ID,
    DOCUMENTS_COLLECTION_ID,
    ID.unique(),
        {
      userID: userId,
      title: name,
      fileId: storedFile.$id,
      fileType,
      mimeType,
      textContent: "",
      summary: "",
      ttsSummaryParts: "",
      category: "",
      keywords: "",
    }
  );

  return doc;
}

export async function uploadVoiceRecording(file) {
  if (!file?.uri) throw new Error("Missing voice file.");

  const storedFile = await storage.createFile({
    bucketId: VOICE_RECORDINGS_BUCKET_ID,
    fileId: ID.unique(),
    file: {
      name: file.name || "voice-command.m4a",
      type: file.type || "audio/m4a",
      size: file.size || 0,
      uri: file.uri,
    },
  });

  return storedFile;
}

export async function callTranscribeVoiceFunction(fileId) {
  if (!fileId) throw new Error("Missing voice file id.");

  const execution = await executeFunctionAndWait(
    TRANSCRIBE_VOICE_FUNCTION_ID,
    { fileId }
  );

  const bodyText =
  execution?.responseBody ||
  execution?.stdout ||
  execution?.response ||
  "";

console.log("transcribe raw response:", bodyText);
console.log("transcribe execution:", execution);

  let parsed = null;
try {
  parsed = typeof bodyText === "string" ? JSON.parse(bodyText) : bodyText;
} catch {}

if (parsed?.error) throw new Error(parsed.error);

const transcript =
  parsed?.transcript ??
  parsed?.text ??
  parsed?.data?.transcript ??
  "";

if (!transcript || typeof transcript !== "string") {
  throw new Error("No transcript returned.");
}

  return transcript.trim();
}

export async function listUserDocs(userId) {
  if (!userId) return [];
  const res = await databases.listDocuments(
    DATABASE_ID,
    DOCUMENTS_COLLECTION_ID,
    [Query.equal("userID", userId), Query.orderDesc("$createdAt")]
  );
  return res.documents || [];
}

export async function getDocumentById(docId) {
  if (!docId) throw new Error("Missing docId");
  return databases.getDocument(DATABASE_ID, DOCUMENTS_COLLECTION_ID, docId);
}

export async function deleteUserDoc(docId, fileId) {
  const tasks = [];
  if (docId) tasks.push(databases.deleteDocument(DATABASE_ID, DOCUMENTS_COLLECTION_ID, docId));
  if (fileId) tasks.push(storage.deleteFile(BUCKET_ID, fileId));
  await Promise.all(tasks);
}

export function getFileViewUrl(fileId) {
  if (!fileId) return null;
  return `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

export function getFileDownloadUrl(fileId) {
  if (!fileId) return null;
  return `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/download?project=${APPWRITE_PROJECT_ID}`;
}

export async function updateDocFields(docId, data) {
  if (!docId) throw new Error("Missing docId in updateDocFields");
  return databases.updateDocument(DATABASE_ID, DOCUMENTS_COLLECTION_ID, docId, data || {});
}

export async function attachExtractedText(docId, text) {
  return updateDocFields(docId, { textContent: text || "" });
}

export async function attachTextContent(docId, text) {
  return updateDocFields(docId, { textContent: text || "" });
}

export async function updateTtsCacheField(docId, ttsSummaryPartsJson) {
  return updateDocFields(docId, { ttsSummaryParts: ttsSummaryPartsJson || "" });
}

// AI summariser 
export async function callSummariseFunction(doc) {
  const docId = typeof doc === "string" ? doc : doc?.$id;
  if (!docId) throw new Error("Missing docId for summariser.");

  const fileId = typeof doc === "object" ? doc?.fileId : null;
  const mimeType = typeof doc === "object" ? doc?.mimeType : null;
  const fileUrl = fileId ? getFileDownloadUrl(fileId) : null;

  const payload = {
    docId,
    ...(fileUrl ? { fileUrl } : {}),
    ...(mimeType ? { mimeType } : {}),
  };

  const resp = await fetch(`${SUMMARISE_FUNCTION_URL}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await resp.text();
  console.log("summarise raw response:", bodyText);

  let parsed = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {}

  if (!resp.ok) {
    throw new Error(parsed?.error || parsed?.message || bodyText || `HTTP ${resp.status}`);
  }
  if (parsed?.error) throw new Error(parsed.error);

  return parsed || { ok: true, summary: bodyText };
}

async function executeFunctionAndWait(functionId, payload) {
  const execution = await functions.createExecution(
    functionId,
    JSON.stringify(payload),
    false
  );

  return execution;
}

// Extract full text 
export async function callExtractTextFunction(doc) {
  const docId = typeof doc === "string" ? doc : doc?.$id;
  if (!docId) throw new Error("Missing docId for extractDocumentText.");

  const fileId = typeof doc === "object" ? doc?.fileId : null;
  const mimeType = typeof doc === "object" ? doc?.mimeType : null;
  const fileUrl = fileId ? getFileDownloadUrl(fileId) : null;

  const payload = {
    documentId: docId, 
    docId, 
    ...(fileId ? { fileId } : {}),
    ...(fileUrl ? { fileUrl } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(doc?.title ? { title: doc.title } : {}),
  };

  // Execute 
  const execution = await executeFunctionAndWait(
  EXTRACT_TEXT_FUNCTION_ID,
  payload
);

  const bodyText = execution?.responseBody || "";
  console.log("extract raw response:", bodyText);

  let parsed = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {}

  if (parsed?.error) throw new Error(parsed.error);

  const text =
    parsed?.textContent ??
    parsed?.extractedText ??
    parsed?.text ??
    "";

  if (text && typeof text === "string") {
    try {
      await attachTextContent(docId, text);
    } catch (e) {
      console.log("attachTextContent failed:", e?.message || e);
    }
  }

  return parsed || { ok: true, textContent: text };
}
export async function callTagFunction(doc) {
  const docId = typeof doc === "string" ? doc : doc?.$id;
  if (!docId) throw new Error("Missing docId for tagging.");
  if (!TAG_FUNCTION_ID) throw new Error("TAG_FUNCTION_ID not set.");

  const fileId = typeof doc === "object" ? doc?.fileId : null;
  const mimeType = typeof doc === "object" ? doc?.mimeType : null;
  const fileUrl = fileId ? getFileDownloadUrl(fileId) : null;

  const payload = {
    docId,
    ...(fileId ? { fileId } : {}),
    ...(fileUrl ? { fileUrl } : {}),
    ...(mimeType ? { mimeType } : {}),
  };

 const execution = await executeFunctionAndWait(
  TAG_FUNCTION_ID,
  payload
);

  const bodyText = execution?.responseBody || "";
  let parsed = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {}

  if (parsed?.error) throw new Error(parsed.error);

  const category = parsed?.category;
  const keywords = parsed?.keywords;

  const mappedCategory = mapCategory(category, keywords, doc?.title);

 if (mappedCategory || keywords) {
  try {
    await updateDocFields(docId, {
      category: mappedCategory,
      ...(keywords ? { keywords } : {}),
    });
  } catch (e) {
    console.log("updateDocFields(tag) failed:", e?.message || e);
  }
}

  return parsed || { ok: true, category: "", keywords: "" };
}

// Library
function savedItemPermissions(userId) {
  if (!userId) return [];
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function listSavedItems(userId) {
  if (!userId) return [];
  const res = await databases.listDocuments(
    DATABASE_ID,
    SAVED_ITEMS_COLLECTION_ID,
    [Query.equal("userID", userId), Query.orderDesc("$createdAt")]
  );
  return res.documents || [];
}

export async function isSavedItem(userId, docId, summaryType) {
  if (!userId || !docId || !summaryType) return null;
  const res = await databases.listDocuments(
    DATABASE_ID,
    SAVED_ITEMS_COLLECTION_ID,
    [
      Query.equal("userID", userId),
      Query.equal("docId", docId),
      Query.equal("summaryType", summaryType),
      Query.limit(1),
    ]
  );
  return res.documents?.[0] || null;
}

export async function saveToLibrary({
  userId,
  docId,
  title,
  summaryType,
  summaryText = "",
  audioFileId = "",
  category = "",
  keywords = "",
}) {
  if (!userId) throw new Error("Missing userId");
  if (!docId) throw new Error("Missing docId");
  if (!title) throw new Error("Missing title");
  if (!summaryType) throw new Error("Missing summaryType");

  // prevent duplicates 
  const existing = await isSavedItem(userId, docId, summaryType);
  if (existing) return existing;

  const data = {
    userID: userId,
    docId,
    title,
    summaryType,
    summaryText,
    audioFileId,
    category,
    keywords,
  };

  // Create with per-user permissions
  return databases.createDocument(
    DATABASE_ID,
    SAVED_ITEMS_COLLECTION_ID,
    ID.unique(),
    data,
    savedItemPermissions(userId)
  );
}

export async function removeSavedItem(savedItemId) {
  if (!savedItemId) throw new Error("Missing savedItemId");
  return databases.deleteDocument(DATABASE_ID, SAVED_ITEMS_COLLECTION_ID, savedItemId);
}
