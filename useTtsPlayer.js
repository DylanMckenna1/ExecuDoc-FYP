import { useCallback, useEffect, useRef, useState } from "react";
import { generateAndPlayTts, playStoredTtsFileId } from "../services/tts";

function formatTtsError(error, fallback) {
  const raw = (error?.message || error || "").trim();
  const message = raw.toLowerCase();

  if (!raw) return fallback;
  if (message.includes("audio session not activated")) {
    return "Audio playback is not ready yet. Please try again.";
  }
  if (message.includes("no cached audio")) {
    return "No saved audio is available for this item yet.";
  }
  if (message.includes("no text provided")) {
    return "There is no text available to turn into audio.";
  }
  if (message.includes("network")) {
    return "We could not connect right now. Please try again in a moment.";
  }
  if (message.includes("65000 chars")) {
    return "This file is too large to prepare for audio playback in the app.";
  }
  return fallback;
}

function splitIntoChunks(text, maxLen = 900) {
  const clean = String(text || "").trim();
  if (!clean) return [];

  const paras = clean
    .replace(/\r/g, "")
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let buf = "";

  const pushBuf = () => {
    const s = buf.trim();
    if (s) chunks.push(s);
    buf = "";
  };

  for (const p of paras) {
    const candidate = buf ? `${buf}\n\n${p}` : p;

    if (candidate.length <= maxLen) {
      buf = candidate;
      continue;
    }

    if (p.length > maxLen) {
      pushBuf();
      const sentences = p.split(/(?<=[.!?])\s+/g);
      let sBuf = "";

      for (const s of sentences) {
        const cand = sBuf ? `${sBuf} ${s}` : s;
        if (cand.length <= maxLen) {
          sBuf = cand;
        } else {
          if (sBuf) chunks.push(sBuf.trim());
          sBuf = s;
        }
      }

      if (sBuf) chunks.push(sBuf.trim());
      continue;
    }

    pushBuf();
    buf = p;
  }

  pushBuf();
  return chunks;
}

export function useTtsPlayer({
  ttsFunctionUrl,
  appwriteEndpoint,
  appwriteProjectId,
  ttsBucketId,
}) {
  const soundRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const pausedRef = useRef(false);
  const runTokenRef = useRef(0);

  const [status, setStatus] = useState("idle"); //| generating | downloading | playing | paused | error
  const [error, setError] = useState(null);

  const stopCurrentSound = useCallback(async () => {
    try {
      const s = soundRef.current;
      soundRef.current = null;
      if (!s) return;
      await s.stopAsync().catch(() => {});
      await s.unloadAsync().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      stopCurrentSound();
    };
  }, [stopCurrentSound]);

  const stop = useCallback(async () => {
    runTokenRef.current += 1;
    stopRequestedRef.current = true;
    pausedRef.current = false;
    await stopCurrentSound();
    setStatus("idle");
  }, [stopCurrentSound]);

  const beginPlaybackRun = useCallback(async () => {
    runTokenRef.current += 1;
    const runToken = runTokenRef.current;
    stopRequestedRef.current = true;
    pausedRef.current = false;
    await stopCurrentSound();
    stopRequestedRef.current = false;
    return runToken;
  }, [stopCurrentSound]);

  const pause = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      pausedRef.current = true;
      await s.pauseAsync();
      setStatus("paused");
    } catch (e) {
      setStatus("error");
      setError(formatTtsError(e, "Audio could not be paused."));
    }
  }, []);

  const resume = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      pausedRef.current = false;
      await s.playAsync();
      setStatus("playing");
    } catch (e) {
      setStatus("error");
      setError(formatTtsError(e, "Audio could not be resumed."));
    }
  }, []);

  // play cached parts (no TTS calls)
  const playParts = useCallback(
    async (fileIds = []) => {
      setError(null);
      const runToken = await beginPlaybackRun();

      try {
        const ids = Array.isArray(fileIds) ? [...new Set(fileIds.filter(Boolean))] : [];
        if (!ids.length) throw new Error("No cached audio parts found");

        for (let i = 0; i < ids.length; i++) {
          if (stopRequestedRef.current || runTokenRef.current !== runToken) break;

          let resolveFinished;
          const finishedPromise = new Promise((resolve) => {
            resolveFinished = resolve;
          });

          setStatus("downloading");

          const { sound } = await playStoredTtsFileId({
            appwriteEndpoint,
            appwriteProjectId,
            ttsBucketId,
            fileId: ids[i],
            stopCurrentSound,
            onStatus: (st) => {
              if (!st?.isLoaded) return;

              if (st.isBuffering) setStatus("downloading");
              if (st.isPlaying) setStatus("playing");
              if (pausedRef.current) setStatus("paused");

              if (st.didJustFinish) resolveFinished?.();
            },
          });

          if (stopRequestedRef.current || runTokenRef.current !== runToken) {
            await sound.stopAsync().catch(() => {});
            await sound.unloadAsync().catch(() => {});
            break;
          }

          soundRef.current = sound;
          setStatus("playing");

          await Promise.race([
            finishedPromise,
            new Promise((resolve) => {
              const t = setInterval(() => {
                if (stopRequestedRef.current || runTokenRef.current !== runToken) {
                  clearInterval(t);
                  resolve();
                }
              }, 150);
            }),
          ]);

          while (pausedRef.current && !stopRequestedRef.current && runTokenRef.current === runToken) {
            await new Promise((r) => setTimeout(r, 200));
          }

          await stopCurrentSound();
        }

        if (!stopRequestedRef.current && runTokenRef.current === runToken) setStatus("idle");
      } catch (e) {
        setStatus("error");
        setError(formatTtsError(e, "Saved audio playback is unavailable right now."));
      }
    },
    [appwriteEndpoint, appwriteProjectId, ttsBucketId, stopCurrentSound, beginPlaybackRun]
  );

  // generate and Play returns parts
  const generateAndPlay = useCallback(
    async (text, opts = {}) => {
      const { onPartsReady } = opts;

      setError(null);
      const runToken = await beginPlaybackRun();

      try {
        const chunks = splitIntoChunks(text, 900);
        if (!chunks.length) throw new Error("No text provided for TTS");

        const parts = [];

        for (let i = 0; i < chunks.length; i++) {
          if (stopRequestedRef.current || runTokenRef.current !== runToken) break;

          let resolveFinished;
          const finishedPromise = new Promise((resolve) => {
            resolveFinished = resolve;
          });

          setStatus("generating");

          const { sound, fileId } = await generateAndPlayTts({
            ttsFunctionUrl,
            appwriteEndpoint,
            appwriteProjectId,
            ttsBucketId,
            text: chunks[i],
            stopCurrentSound,
            onStatus: (st) => {
              if (!st?.isLoaded) return;

              if (st.isBuffering) setStatus("downloading");
              if (st.isPlaying) setStatus("playing");
              if (pausedRef.current) setStatus("paused");

              if (st.didJustFinish) resolveFinished?.();
            },
          });

          parts.push(fileId);

          if (stopRequestedRef.current || runTokenRef.current !== runToken) {
            await sound.stopAsync().catch(() => {});
            await sound.unloadAsync().catch(() => {});
            break;
          }

          soundRef.current = sound;
          setStatus("playing");

          await Promise.race([
            finishedPromise,
            new Promise((resolve) => {
              const t = setInterval(() => {
                if (stopRequestedRef.current || runTokenRef.current !== runToken) {
                  clearInterval(t);
                  resolve();
                }
              }, 150);
            }),
          ]);

          while (pausedRef.current && !stopRequestedRef.current && runTokenRef.current === runToken) {
            await new Promise((r) => setTimeout(r, 200));
          }

          await stopCurrentSound();
        }

        if (!stopRequestedRef.current && runTokenRef.current === runToken) {
          setStatus("idle");
          onPartsReady?.(parts);
        }

        return { parts };
      } catch (e) {
        setStatus("error");
        setError(formatTtsError(e, "Audio generation is unavailable right now."));
        return { parts: [] };
      }
    },
    [
      ttsFunctionUrl,
      appwriteEndpoint,
      appwriteProjectId,
      ttsBucketId,
      stopCurrentSound,
      beginPlaybackRun,
    ]
  );

  return { status, error, generateAndPlay, playParts, pause, resume, stop };
}
