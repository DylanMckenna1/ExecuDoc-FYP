import { useCallback, useEffect, useRef, useState } from "react";
import { generateAndPlayTts, playStoredTtsFileId } from "../services/tts";

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
    stopRequestedRef.current = true;
    pausedRef.current = false;
    await stopCurrentSound();
    setStatus("idle");
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
      setError(e?.message || "Pause failed");
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
      setError(e?.message || "Resume failed");
    }
  }, []);

  // play cached parts (no TTS calls)
  const playParts = useCallback(
    async (fileIds = []) => {
      setError(null);
      stopRequestedRef.current = false;
      pausedRef.current = false;

      try {
        const ids = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
        if (!ids.length) throw new Error("No cached audio parts found");

        for (let i = 0; i < ids.length; i++) {
          if (stopRequestedRef.current) break;

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

          soundRef.current = sound;
          setStatus("playing");

          await Promise.race([
            finishedPromise,
            new Promise((resolve) => {
              const t = setInterval(() => {
                if (stopRequestedRef.current) {
                  clearInterval(t);
                  resolve();
                }
              }, 150);
            }),
          ]);

          while (pausedRef.current && !stopRequestedRef.current) {
            await new Promise((r) => setTimeout(r, 200));
          }

          await stopCurrentSound();
        }

        if (!stopRequestedRef.current) setStatus("idle");
      } catch (e) {
        setStatus("error");
        setError(e?.message || "Play cached audio failed");
      }
    },
    [appwriteEndpoint, appwriteProjectId, ttsBucketId, stopCurrentSound]
  );

  // generateAndPlay returns parts
  const generateAndPlay = useCallback(
    async (text, opts = {}) => {
      const { onPartsReady } = opts;

      setError(null);
      stopRequestedRef.current = false;
      pausedRef.current = false;

      try {
        const chunks = splitIntoChunks(text, 900);
        if (!chunks.length) throw new Error("No text provided for TTS");

        const parts = [];

        for (let i = 0; i < chunks.length; i++) {
          if (stopRequestedRef.current) break;

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

          soundRef.current = sound;
          setStatus("playing");

          await Promise.race([
            finishedPromise,
            new Promise((resolve) => {
              const t = setInterval(() => {
                if (stopRequestedRef.current) {
                  clearInterval(t);
                  resolve();
                }
              }, 150);
            }),
          ]);

          while (pausedRef.current && !stopRequestedRef.current) {
            await new Promise((r) => setTimeout(r, 200));
          }

          await stopCurrentSound();
        }

        if (!stopRequestedRef.current) {
          setStatus("idle");
          onPartsReady?.(parts);
        }

        return { parts };
      } catch (e) {
        setStatus("error");
        setError(e?.message || "TTS failed");
        return { parts: [] };
      }
    },
    [
      ttsFunctionUrl,
      appwriteEndpoint,
      appwriteProjectId,
      ttsBucketId,
      stopCurrentSound,
    ]
  );

  return { status, error, generateAndPlay, playParts, pause, resume, stop };
}
