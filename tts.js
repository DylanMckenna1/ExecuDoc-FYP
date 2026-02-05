import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { account } from "./appwrite"; 

export function buildAppwriteFileViewUrl({ endpoint, projectId, bucketId, fileId }) {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
}

function cachePathForFileId(fileId) {
  return `${FileSystem.documentDirectory}tts_${fileId}.mp3`;
}

export async function getOrDownloadMp3({ remoteUrl, fileId }) {
  const localPath = cachePathForFileId(fileId);

  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists && info.size > 0) return localPath;

  const res = await FileSystem.downloadAsync(remoteUrl, localPath);
  return res.uri;
}

export async function requestTtsFileId({ ttsFunctionUrl, appwriteProjectId, text }) {
  
  const jwt = await account.createJWT();

  const res = await fetch(`${ttsFunctionUrl}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": appwriteProjectId,
      "X-Appwrite-JWT": jwt.jwt,
    },
    body: JSON.stringify({ text, doTTS: true }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `TTS function failed (${res.status})`);
  }
  if (!data.fileId) throw new Error("TTS response missing fileId");

  return { fileId: data.fileId, bucketId: data.bucketId };
}

export async function playLocalMp3(uri, onStatus) {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true },
    (status) => onStatus?.(status)
  );

  await sound.setProgressUpdateIntervalAsync(200);

  return sound;
}

export async function playStoredTtsFileId({
  appwriteEndpoint,
  appwriteProjectId,
  ttsBucketId,
  fileId,
  onStatus,
  stopCurrentSound,
}) {
  if (!fileId) throw new Error("Missing fileId for stored TTS");

  if (stopCurrentSound) await stopCurrentSound();

  const remoteUrl = buildAppwriteFileViewUrl({
    endpoint: appwriteEndpoint,
    projectId: appwriteProjectId,
    bucketId: ttsBucketId,
    fileId,
  });

  const localUri = await getOrDownloadMp3({ remoteUrl, fileId });

  const sound = await playLocalMp3(localUri, (status) => {
    onStatus?.({ ...status, fileId });
  });

  return { sound, fileId, remoteUrl, localUri };
}

export async function generateAndPlayTts({
  ttsFunctionUrl,
  appwriteEndpoint,
  appwriteProjectId,
  ttsBucketId,
  text,
  onStatus,
  stopCurrentSound, 
}) {
  if (!text || !String(text).trim()) throw new Error("No text provided for TTS");

  if (stopCurrentSound) await stopCurrentSound();

  // 1) request tts
  const { fileId, bucketId } = await requestTtsFileId({
    ttsFunctionUrl,
    appwriteProjectId,
    text,
  });

  // 2) build file url
  const remoteUrl = buildAppwriteFileViewUrl({
    endpoint: appwriteEndpoint,
    projectId: appwriteProjectId,
    bucketId: bucketId || ttsBucketId,
    fileId,
  });

  // 3) cache locally
  const localUri = await getOrDownloadMp3({ remoteUrl, fileId });

  // 4) play
  const sound = await playLocalMp3(localUri, (status) => {
    onStatus?.({ ...status, fileId });
  });

  return { sound, fileId, remoteUrl, localUri };
}
