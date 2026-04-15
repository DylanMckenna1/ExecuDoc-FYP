import { Client, Storage } from "node-appwrite"; // come from appwrite node sdk
import OpenAI, { toFile } from "openai"; // converts buffer into tofile object

// environment variables
const {
  APPWRITE_ENDPOINT, // appwrite url
  APPWRITE_PROJECT_ID, // Appwrite project
  APPWRITE_API_KEY, // authenticate backend access to storage
  BUCKET_ID, // identify voice recording bucket
  OPENAI_API_KEY, // authenticate calls to openAI transcription
} = process.env;

export default async ({ req, res, error }) => {
  try {
    const missing = [ // check for missing env vars
      !APPWRITE_ENDPOINT && "APPWRITE_ENDPOINT",
      !APPWRITE_PROJECT_ID && "APPWRITE_PROJECT_ID",
      !APPWRITE_API_KEY && "APPWRITE_API_KEY",
      !BUCKET_ID && "BUCKET_ID",
      !OPENAI_API_KEY && "OPENAI_API_KEY",
    ].filter(Boolean);
 // if missing fail early to prevent later failures
    if (missing.length) {
      return res.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        400
      );
    }
// Parse request body so parse the incoming json
    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch {
      body = {};
    }
//Extract fileID
    const fileId = body.fileId;
    if (!fileId) {
      return res.json({ ok: false, error: "Missing fileId" }, 400);
    }
// create appwrite client 
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT) //connect to appwrite using the node sdk 
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY); // authenticate using api key
// storage access 
    const storage = new Storage(client); 
    const fileData = await storage.getFileDownload(BUCKET_ID, fileId); // download file using fileid

// convert the file into a buffer
    let buffer;
      if (fileData instanceof ArrayBuffer) {
      buffer = Buffer.from(fileData);
    } else if (Buffer.isBuffer(fileData)) {
      buffer = fileData;
    } else if (fileData?.arrayBuffer) {
      const arrayBuffer = await fileData.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = Buffer.from(fileData);
    }
// create Openai client 
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
// debug log
console.log("Audio buffer size:", buffer.length);
// convert buffer into file for openAI
const audioFile = await toFile(buffer, "voice-command.m4a", {
  type: "audio/m4a",
});
// call Openai transcription
const result = await openai.audio.transcriptions.create({
  file: audioFile, // send audio file to open ai
  model: "gpt-4o-mini-transcribe", 
  response_format: "text", // get plain text response
});
// debug log transcript
console.log("Transcript result:", result);
// return response
return res.json({ // return json to the frontend
  ok: true,
  transcript: typeof result === "string" ? result.trim() : result?.text || "",
});
// error handling
  } catch (e) { // logbackend error
    error(e);
    return res.json(
      { ok: false, error: e?.message || "Transcription failed" }, // return error response to frontend
      500
    );
  }
};