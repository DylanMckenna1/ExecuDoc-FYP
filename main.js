//stores openai tts endpoint
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

// conver json into javascript object
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
// convert audio to buffer
function toBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}
// generates speech audio 
async function openaiTts({ apiKey, text, voice = "alloy" }) { // receives apiKey,  text and voice
  const r = await fetch(OPENAI_TTS_URL, { // http request to OpenAI
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ // what is being sent
      model: "gpt-4o-mini-tts",
      voice,
      input: text, 
      format: "mp3",
    }),
  });
// if openAi responds with an error
  if (!r.ok) {
    const errText = await r.text().catch(() => ""); // read response text and return error message
    throw new Error(`OpenAI TTS failed: ${r.status} ${r.statusText} :: ${errText}`); // throw upwards
  }
// return mp3 bytes
  const arrayBuf = await r.arrayBuffer(); // reads returned audio as buffer
  return Buffer.from(arrayBuf);
}
// upload mp3 audio to appwrite storage 
async function uploadToAppwriteStorage({
  endpoint,
  projectId,
  apiKey,
  bucketId,
  fileName,
  bytes,
  userId,
}) {
  //builds appwrites REST upload endpoint
  const url = `${endpoint}/storage/buckets/${bucketId}/files`;
//create upload request
  const form = new FormData();
// tell Appwrite to generate an ID 
  form.append("fileId", "unique()");

  // permissions 
  // If userId from the app - this makes the file readable by that user only
  if (userId) {
    form.append("permissions[]", `read("user:${userId}")`);
    form.append("permissions[]", `update("user:${userId}")`);
    form.append("permissions[]", `delete("user:${userId}")`);
  } else {
    // fallback
    form.append("permissions[]", `read("any")`);
  }
// convert bytes to blob 
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  form.append("file", blob, fileName); // can now be uploaded as a file
// sends file upload request to Appwrite storage
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey,
    },
    body: form,
  });
// if upload fails throw error
  const text = await r.text().catch(() => "");
  if (!r.ok) {
    throw new Error(`Storage upload failed: ${r.status} ${r.statusText} :: ${text}`);
  }
// if succeeds return json response and file metadata
  const json = safeJsonParse(text) || {};
  return json;
}

// Appwrite function entry point
export default async (context) => {
  const { req, res, log, error } = context; // recieves 

  try {
  // parse incoming body
    const raw = req?.bodyRaw ?? req?.body ?? "";
    const body = typeof raw === "string" ? (safeJsonParse(raw) || {}) : (raw || {});

    log("Incoming body keys:", Object.keys(body || {}));

    // Health check
    if (body?.ping === true) {
      return res.json({ ok: true, pong: true });
    }

    // read tts request fields
    const doTTS = body?.doTTS === true;
    const text = body?.text;
//handle non tts requests
    if (!doTTS) {
      return res.json({
        ok: true,
        message: "No doTTS flag set. Send { text: '...', doTTS: true } to generate speech.",
        received: body,
      });
    }
// validate text input 
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.json({ ok: false, error: "Missing or invalid 'text'." }, 400);
    }
//validate openAI api key 
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY; //checks that the function can call openai
    if (!OPENAI_API_KEY) {
      return res.json({ ok: false, error: "OPENAI_API_KEY env var missing." }, 500);
    }

    // Generate MP3 bytes
    log("Calling OpenAI TTS...");
    const mp3Bytes = await openaiTts({ //sends text to openai
      apiKey: OPENAI_API_KEY,
      text,
      voice: body?.voice || "alloy",
    });// get mp3bytes back and log audio size
    log("OpenAI TTS success. Bytes:", mp3Bytes.length); 

    // read appwrite env vars to check appwrite config to upload to storage
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const bucketId = process.env.BUCKET_ID;
// if upload is possible
    const shouldUpload = Boolean(endpoint && projectId && apiKey && bucketId);
// upload mp3 to storage bucket
    if (shouldUpload) {
      log("Uploading MP3 to Appwrite Storage...");
      const uploadResult = await uploadToAppwriteStorage({
        endpoint,
        projectId,
        apiKey,
        bucketId,
        fileName: `tts-${Date.now()}.mp3`, // helps make filenames unique
        bytes: mp3Bytes,
        userId: body?.userId, // pass from app for per-user permissions
      });
// return uploaded file 
      return res.json({
        ok: true,
        uploaded: true,
        bucketId,
        fileId: uploadResult?.$id, // what app caches and re uses
        mimeType: "audio/mpeg",
        size: mp3Bytes.length,
      });
    }

    // Fallback return base64 in app even without storage for testing
    return res.json({
      ok: true,
      uploaded: false,
      mimeType: "audio/mpeg",
      audioBase64: toBase64(mp3Bytes),
      size: mp3Bytes.length,
    });
    // error handling
  } catch (e) {
    context.error("TTS function error:", e?.message || e); // return clear errors to fronted
    return context.res.json(
      {
        ok: false,
        error: e?.message || String(e),
      },
      500
    );
  }
};

