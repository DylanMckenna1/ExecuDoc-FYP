import {
  uploadVoiceRecording,
  callTranscribeVoiceFunction,
} from "./appwrite";
// takes in the the recorded file uri 
export async function transcribeAudio(uri) {
  if (!uri) {
    throw new Error("Missing recording URI.");
  }
// upload file to appwrite storage
  const uploadedFile = await uploadVoiceRecording({
    uri,
    name: "voice-command.m4a",
    type: "audio/m4a",
    size: 0,
  });
// calling the appwrite function 
  const transcript = await callTranscribeVoiceFunction(uploadedFile.$id);
  return transcript;
}