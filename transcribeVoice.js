import {
  uploadVoiceRecording,
  callTranscribeVoiceFunction,
} from "./appwrite";

// takes in the recorded file uri
export async function transcribeAudio(uri) {
  if (!uri) {
    throw new Error("Missing recording URI.");
  }

  // upload file to Appwrite storage
  const uploadedFile = await uploadVoiceRecording({
    uri,
    name: "voice-command.m4a",
    type: "audio/m4a",
    size: 0,
  });

  const runTranscription = async () => {
    return await callTranscribeVoiceFunction(uploadedFile.$id);
  };

  try {
    return await runTranscription();
  } catch (err) {
    const message = (err?.message || "").toLowerCase();

    const shouldRetry =
      message.includes("connection error") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("503");

    if (!shouldRetry) {
      throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, 700));

    return await runTranscription();
  }
}