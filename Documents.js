// screens/Documents.js
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Pdf from 'react-native-pdf';
import { Buffer } from 'buffer';
import { Ionicons } from "@expo/vector-icons";
import { saveToLibrary, getDocumentById, listSavedItems, updateSavedItem } from "../services/appwrite";

import {
  StyledContainer,
  InnerContainer,
  PageTitle,
  SubTitle,
  Line,
  Colors,
} from '../components/styles';

import {
  APPWRITE_PROJECT_ID,
  account,
  uploadUserDoc,
  listUserDocs,
  deleteUserDoc,
  getFileDownloadUrl,
  callTagFunction,
  callSummariseFunction,
  updateTtsCacheField,
  callExtractTextFunction,
  updateDocFields, 
} from '../services/appwrite';

import { useTtsPlayer } from '../hooks/useTtsPlayer';

const { brand } = Colors;

/* ─ helpers ─ */

function deriveType(doc) {
  if (doc.fileType) return doc.fileType;

  const mime = (doc.mimeType || '').toLowerCase();
  const title = (doc.title || '').toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('pdf') || title.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  return 'other';
}

function typeLabelAndColor(type) {
  switch (type) {
    case 'pdf':
      return { label: 'PDF', bg: '#F97316' };
    case 'image':
      return { label: 'Image', bg: '#22C55E' };
    case 'audio':
      return { label: 'Audio', bg: '#0EA5E9' };
    default:
      return { label: 'Document', bg: '#6C63FF' };
  }
}

function safeParseJson(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function makeTtsCache({
  bucketId,
  docParts,
  summaryParts,
  summaryDetailedParts,
  summaryDetailedText,
}) {
  return JSON.stringify({
    bucketId,
    docParts: Array.isArray(docParts) ? docParts : [],
    summaryParts: Array.isArray(summaryParts) ? summaryParts : [],
    summaryDetailedParts: Array.isArray(summaryDetailedParts)
      ? summaryDetailedParts
      : [],
    summaryDetailedText:
      typeof summaryDetailedText === "string" ? summaryDetailedText : "",
  });
}

function readTtsCache(doc) {
  const parsed = safeParseJson(doc?.ttsSummaryParts);
  if (parsed && typeof parsed === "object") {
    return {
      bucketId: parsed.bucketId || null,
      docParts: Array.isArray(parsed.docParts) ? parsed.docParts : [],
      summaryParts: Array.isArray(parsed.summaryParts) ? parsed.summaryParts : [],
      summaryDetailedParts: Array.isArray(parsed.summaryDetailedParts)
        ? parsed.summaryDetailedParts
        : [],
      summaryDetailedText:
        typeof parsed.summaryDetailedText === "string"
          ? parsed.summaryDetailedText
          : "",
    };
  }
  return {
    bucketId: null,
    docParts: [],
    summaryParts: [],
    summaryDetailedParts: [],
    summaryDetailedText: "",
  };
}

// setting up all screen states 
export default function Documents({ route, navigation }) {
  const [user, setUser] = useState(null);
  const userId = user?.$id;

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summarisingId, setSummarisingId] = useState(null);
  const [summaryPickerVisible, setSummaryPickerVisible] = useState(false);
  const [summaryPickerDoc, setSummaryPickerDoc] = useState(null);
  const [summaryPickerMode, setSummaryPickerMode] = useState("short"); // "short" | "detailed"
  const CATEGORY_OPTIONS = ["finance", "history", "study", "legal", "work", "personal"];

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);  
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryModalDoc, setCategoryModalDoc] = useState(null);
  const [categoryChoice, setCategoryChoice] = useState("");
  const [categoryCustom, setCategoryCustom] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [taggingId, setTaggingId] = useState(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuDoc, setMenuDoc] = useState(null);

  const [kwModalVisible, setKwModalVisible] = useState(false);
  const [kwModalDoc, setKwModalDoc] = useState(null);
  const [lastVoiceDoc, setLastVoiceDoc] = useState(null);
  const [lastSuggestedVoiceDocs, setLastSuggestedVoiceDocs] = useState([]);

const onAutoTag = async (doc, options = {}) => {
  const silent = options?.silent === true;
  const docId = doc?.$id;

  if (!docId) {
    Alert.alert("Tagging failed", "Missing document id.");
    return;
  }
// set tagging id for loading state 
  try {
    setTaggingId(docId);

    const hasText = (doc?.textContent || "").trim().length > 0;
  if (!hasText) {
  await callExtractTextFunction(doc);

  // ensure fresh doc with text
  const refreshed = await getDocumentById(docId);
  doc = refreshed;
}
// get latest doc by iD and calls tagFunction latest doc
    const latestDoc = await getDocumentById(docId);
    await callTagFunction(latestDoc);
// reloads the list 
    await load();

    if (!silent) {
      Alert.alert("Done", "Category and keywords updated.");
    }
  } catch (e) {
    if (!silent) {
      Alert.alert("Tagging failed", e?.message || "Try again later.");
    } else {
      console.log("silent tagging failed:", e?.message || e);
    }
  } finally {
    setTaggingId(null);
  }
};

  // Viewer state
const [viewerVisible, setViewerVisible] = useState(false);
const [viewerUri, setViewerUri] = useState(null);
const [viewerTitle, setViewerTitle] = useState('');
const [viewerLoading, setViewerLoading] = useState(false);
const [viewerType, setViewerType] = useState('pdf');
const [viewerText, setViewerText] = useState('');
const [kwValue, setKwValue] = useState("");

  const openSummaryPicker = (doc) => {
  setSummaryPickerDoc(doc);
  setSummaryPickerMode("short"); // default
  setSummaryPickerVisible(true);
};

const openMenu = (doc) => {
  setMenuDoc(doc);
  setMenuVisible(true);
};

const closeMenu = () => {
  setMenuVisible(false);
  setMenuDoc(null);
};

const closeCategoryModal = () => {
  setCategoryModalVisible(false);
  setCategoryModalDoc(null);
  setCategoryChoice("");
  setCategoryCustom("");
};

const openKeywordsModal = (doc) => {
  setKwModalDoc(doc);
  setKwValue(doc?.keywords || "");
  setKwModalVisible(true);
};

const closeKeywordsModal = () => {
  setKwModalVisible(false);
  setKwModalDoc(null);
  setKwValue("");
};

const openCategoryModalForDoc = (doc) => {
  setCategoryModalDoc(doc);
  setCategoryChoice(normaliseCategory(doc?.category) || "");
  setCategoryCustom("");
  setCategoryModalVisible(true);
};

const handleMenuAction = async (action) => {
  const doc = menuDoc;
  if (!doc) return;

  closeMenu();

  if (action === "open") onOpen(doc);
  if (action === "summarise") openSummaryPicker(doc);
  if (action === "listen") onListenDoc(doc);
  if (action === "categorise") onAutoTag(doc);
  if (action === "category") openCategoryModalForDoc(doc);
  if (action === "keywords") openKeywordsModal(doc);
  if (action === "delete") onDelete(doc);
};

  // TTS modal state
  const [ttsVisible, setTtsVisible] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [ttsContext, setTtsContext] = useState(null); // { docId, mode: 'doc'|'summary' }
  const [ttsAutoPlayRequested, setTtsAutoPlayRequested] = useState(false);

  // Function URLs from .env 
  const TTS_FUNCTION_URL =
    process.env.EXPO_PUBLIC_TTS_FUNCTION_URL ||
    'https://697201a400145780b4c0.fra.appwrite.run';

  // Keptin  file
  const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
  const TTS_BUCKET_ID = '6972be01002bee843a33';

  const {
    status: ttsStatus,
    error: ttsError,
    generateAndPlay,
    playParts,
    pause,
    resume,
    stop,
  } = useTtsPlayer({
    ttsFunctionUrl: TTS_FUNCTION_URL,
    appwriteEndpoint: APPWRITE_ENDPOINT,
    appwriteProjectId: APPWRITE_PROJECT_ID,
    ttsBucketId: TTS_BUCKET_ID,
  });

  const ttsBusy = ttsStatus === 'generating' || ttsStatus === 'downloading';

 useEffect(() => {
  if (!ttsVisible || !ttsAutoPlayRequested || !ttsText) return;
  if (ttsStatus === "playing") return;
  if (ttsBusy) return;

  const ctx = ttsContext;
  const doc = files.find((d) => d.$id === ctx?.docId);

  const run = async () => {
    setTtsAutoPlayRequested(false);

    try {
      if (doc && ctx?.mode) {
        await playWithCache({
          doc,
          mode: ctx.mode,
          variant: ctx.variant,
          text: ttsText,
        });
      } else {
        await generateAndPlay(ttsText);
      }
    } catch (e) {
      console.log("tts autoplay error", e);
    }
  };

  run();
}, [
  ttsVisible,
  ttsAutoPlayRequested,
  ttsText,
  ttsContext,
  files,
  ttsBusy,
]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u = await account.get();
        if (mounted) setUser(u);
      } catch (e) {
        console.log('Not logged in:', e?.message || e);
        if (mounted) setUser(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setFiles([]);
      setMsg('Loading session…');
      return;
    }

    setLoading(true);
    setMsg('');
    try {
      const docs = await listUserDocs(userId);
      setFiles(docs);
      if (!docs.length) setMsg('You have not uploaded any documents yet.');
    } catch (e) {
      console.log('list docs error', e);
      setMsg('Could not load your documents.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

useEffect(() => {
  const autoOpenRecent = route?.params?.autoOpenRecent === true;
  const autoFilterCategory = route?.params?.autoFilterCategory;
  const autoSearchText = route?.params?.autoSearchText || "";
  const autoTargetText = route?.params?.autoTargetText || "";
  const autoUseLastVoiceDoc = route?.params?.autoUseLastVoiceDoc === true;
  const autoSuggestedMatchIndex =
    typeof route?.params?.autoSuggestedMatchIndex === "number"
      ? route.params.autoSuggestedMatchIndex
      : null;
  const autoFolderDocCategory = route?.params?.autoFolderDocCategory || "";
  const autoFolderDocIndex =
    typeof route?.params?.autoFolderDocIndex === "number"
      ? route.params.autoFolderDocIndex
      : null;
 const autoOpenSummaryTarget = route?.params?.autoOpenSummaryTarget === true;
 const autoListenSummaryTarget = route?.params?.autoListenSummaryTarget === true;
 const autoSaveSummaryTarget = route?.params?.autoSaveSummaryTarget === true;
 const autoSummariseRecent = route?.params?.autoSummariseRecent === true;
 const autoListenRecent = route?.params?.autoListenRecent === true;
 const autoSaveRecentSummary = route?.params?.autoSaveRecentSummary === true;
 const autoSummaryMode = route?.params?.autoSummaryMode || "short";
 const startUploadFlow = route?.params?.startUploadFlow === true;
 const commandNonce = route?.params?.commandNonce;

  if (!commandNonce) return;
  if (!files) return;

  if (startUploadFlow) {
    navigation.setParams({
      startUploadFlow: false,
      commandNonce: null,
    });

    setTimeout(() => {
      onUploadFile();
    }, 0);

    return;
  }

  if (files.length === 0) return;

  if (autoFilterCategory) {
    setSelectedCategory(autoFilterCategory);
  } else {
    setSelectedCategory("all");
  }

  if (autoSearchText) {
    setSearchQuery(autoSearchText);
  } else {
    setSearchQuery("");
  }

  const runVoiceActions = async () => {
  let workingDoc = null;
  const summaryMode = autoSummaryMode === "detailed" ? "detailed" : "short";

    if (autoFolderDocCategory && autoFolderDocIndex !== null) {
  const folderDocs = files.filter(
    (doc) =>
      (doc?.category || "").toLowerCase().trim() ===
      autoFolderDocCategory.toLowerCase().trim()
  );

  workingDoc = folderDocs[autoFolderDocIndex] || null;

  if (!workingDoc) {
    Alert.alert("Voice command failed", "I couldn’t find that file in the folder.");
    return;
  }
} else if (autoSuggestedMatchIndex !== null) {
  workingDoc = lastSuggestedVoiceDocs?.[autoSuggestedMatchIndex] || null;

  if (!workingDoc) {
    Alert.alert(
      "Voice command failed",
      "I couldn’t find that suggested match anymore."
    );
    return;
  }
} else if (autoUseLastVoiceDoc && lastVoiceDoc) {

  } else {
    const ranked = getRankedVoiceTargetDocs({
      files,
      autoTargetText,
      autoSearchText,
      autoFilterCategory,
    });

    if (
      (autoTargetText || autoSearchText) &&
      ranked.length > 1 &&
      hasAmbiguousTopMatches(ranked)
    ) {
      const topDocs = ranked
        .slice(0, 3)
        .map((item) => item?.doc)
        .filter(Boolean);

      setLastSuggestedVoiceDocs(topDocs);

      const names = topDocs.map((doc, index) => {
        const labels = ["First", "Second", "Third"];
        return `${labels[index]}: ${doc.title}`;
      });

      Alert.alert(
        "Multiple close matches found",
        `I found a few close matches:\n\n${names.join("\n")}\n\nYou can say “open the first one”, “summarise the second one”, or “listen to the third one”.`
      );
      return;
    }

      const bestScore = ranked[0]?.score || 0;

      if ((autoTargetText || autoSearchText) && bestScore < 30) {
        Alert.alert("Voice command failed", "No matching document found.");
        return;
      }

      workingDoc = resolveVoiceTargetDoc({
        files,
        autoTargetText,
        autoSearchText,
        autoFilterCategory,
        autoOpenRecent,
      });

    if (!workingDoc) {
      const likelyMatches = ranked
        .slice(0, 3)
        .map((item) => item?.doc?.title)
        .filter(Boolean);

      if (likelyMatches.length > 0) {
        setLastSuggestedVoiceDocs(
          ranked.slice(0, 3).map((item) => item?.doc).filter(Boolean)
        );

        Alert.alert(
          "No exact match found",
          `I couldn’t find an exact match.\n\nTop likely matches:\n- ${likelyMatches.join("\n- ")}\n\nYou can also say “open the first one” if one of these is correct.`
        );
      } else {
        Alert.alert("Voice command failed", "No matching document found.");
      }

      return;
    }
  }

    setLastVoiceDoc(workingDoc);
    setLastSuggestedVoiceDocs([]);

  const workingCache = readTtsCache(workingDoc);
  let summaryText =
  summaryMode === "detailed"
    ? (workingCache.summaryDetailedText || "").trim()
    : (workingDoc.summary || "").trim();

      if (autoOpenRecent) {
      await onOpen(workingDoc);
      setSearchQuery("");
    }

    const needsSummaryTargetAction =
      autoOpenSummaryTarget ||
      autoListenSummaryTarget ||
      autoSaveSummaryTarget;

      // ensure text exists before voice summary
let text = (workingDoc.textContent || "").trim();

if (!text) {
  const extractResult = await callExtractTextFunction(workingDoc);

  text = (
    extractResult?.textContent ||
    extractResult?.extractedText ||
    extractResult?.text ||
    ""
  ).trim();

  if (!text) {
    const freshDocs = await listUserDocs(userId);
    setFiles(freshDocs);

    const refreshed = freshDocs.find((d) => d.$id === workingDoc.$id);
    text = (refreshed?.textContent || "").trim();

    if (!text) {
      Alert.alert("No text found", "Cannot summarise this document.");
      return;
    }

    workingDoc = refreshed;
  }
}

    if (autoSummariseRecent || needsSummaryTargetAction) {
      if (!summaryText) {
        try {
          setSummarisingId(workingDoc.$id);

          const result = await callSummariseWithRetry(workingDoc, summaryMode);
          const newSummary = (result?.summary || "").trim();

         if (newSummary) {
  summaryText = newSummary;

  if (summaryMode === "detailed") {
    const cache = readTtsCache(workingDoc);

    const nextCacheJson = makeTtsCache({
      bucketId: cache.bucketId || TTS_BUCKET_ID,
      docParts: cache.docParts,
      summaryParts: cache.summaryParts,
      summaryDetailedParts: [],
      summaryDetailedText: newSummary,
    });

    await updateTtsCacheField(workingDoc.$id, nextCacheJson);

    workingDoc = {
      ...workingDoc,
      ttsSummaryParts: nextCacheJson,
    };
  } else {
    await updateDocFields(workingDoc.$id, { summary: newSummary });

    workingDoc = {
      ...workingDoc,
      summary: newSummary,
    };
  }

  setLastVoiceDoc(workingDoc);
  await load();
} else {
  Alert.alert("Summarise failed", "No summary was returned.");
}

        } finally {
          setSummarisingId(null);
        }
      }

     if (autoSummariseRecent && summaryText) {
  openVoiceSummaryResult(
    workingDoc,
    summaryText,
    summaryMode === "detailed" ? "detailed" : "short"
  );
}
    }

    if (autoOpenSummaryTarget && summaryText) {
      openVoiceSummaryResult(workingDoc, summaryText, "short");
      setSearchQuery("");
    }
 
    if (autoSaveRecentSummary || autoSaveSummaryTarget) {
  const latestCache = readTtsCache(workingDoc);
  const finalSummary =
    summaryText ||
    (summaryMode === "detailed"
      ? (latestCache.summaryDetailedText || "").trim()
      : (workingDoc.summary || "").trim());

  if (finalSummary) {
    await saveSummaryToLibraryDirect(
      workingDoc,
      finalSummary,
      summaryMode === "detailed" ? "detailed" : "short"
    );
    setSearchQuery("");
    Alert.alert(
      "Saved",
      `${summaryMode === "detailed" ? "Detailed" : "Short"} summary saved to your Library.`
    );
  } else {
    Alert.alert("Save failed", "No summary available to save.");
  }
}

  if (autoListenSummaryTarget && summaryText) {
  await autoPlayTtsForDoc(
    workingDoc,
    "summary",
    summaryMode === "detailed" ? "detailed" : "short",
    summaryText
  );
  setSearchQuery("");
}

if (autoListenRecent) {
  await onListenDoc(workingDoc, { autoPlay: true });
  setSearchQuery("");
}
  };

  runVoiceActions().catch((e) => {
    Alert.alert("Voice command failed", e?.message || "Please try again.");
  });

navigation.setParams({
  autoOpenRecent: false,
  autoFilterCategory: null,
  autoSearchText: "",
  autoTargetText: "",
  autoUseLastVoiceDoc: false,
  autoSuggestedMatchIndex: null,
  autoFolderDocCategory: "",
  autoFolderDocIndex: null,
  autoOpenSummaryTarget: false,
  autoListenSummaryTarget: false,
  autoSaveSummaryTarget: false,
  autoSummariseRecent: false,
  autoListenRecent: false,
  autoSaveRecentSummary: false,
  autoSummaryMode: "short",
  startUploadFlow: false,
  commandNonce: null,
});
}, [route?.params?.commandNonce, files]);

  /* ─ uploads ─ */

 const onUploadFile = async () => {
  if (!userId) {
    Alert.alert('Not logged in', 'Session not ready yet. Please wait a second.');
    return;
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    const fileToUpload = {
      uri: asset.uri,
      name: asset.name || "document",
      type: asset.mimeType || "application/octet-stream",
      size: asset.size || 0,
    };

    setPendingFile(fileToUpload);
    setUploadTitle(fileToUpload.name || "");
    setUploadCategory("");
    setShowUploadModal(true);
  } catch (e) {
    console.log('upload file error', e);
    Alert.alert('Upload failed', e?.message || 'Please try again.');
  }
};

  const onTakePhoto = async () => {
  if (!userId) {
    Alert.alert('Not logged in', 'Session not ready yet. Please wait a second.');
    return;
  }

  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera access is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    const fileToUpload = {
      uri: asset.uri,
      name: `Photo_${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
      size: asset.fileSize || 0,
    };

    setPendingFile(fileToUpload);
    setUploadTitle(fileToUpload.name || "");
    setUploadCategory("");
    setShowUploadModal(true);
  } catch (e) {
    console.log('take photo error', e);
    Alert.alert('Upload failed', e?.message || 'Please try again.');
  }
};

const confirmUpload = async () => {
  if (!userId || !pendingFile) return;

  try {
    const finalTitle = uploadTitle.trim() || pendingFile.name || "document";

    const createdDoc = await uploadUserDoc(userId, {
      ...pendingFile,
      title: finalTitle,
      category: uploadCategory,
    });

    setShowUploadModal(false);
    setPendingFile(null);
    setUploadTitle("");
    setUploadCategory("");

    await onAutoTag(createdDoc, { silent: true });
    await load();
  } catch (e) {
    console.log('confirm upload error', e);
    Alert.alert('Upload failed', e?.message || 'Please try again.');
  }
};

const closeUploadModal = () => {
  setShowUploadModal(false);
  setPendingFile(null);
  setUploadTitle("");
  setUploadCategory("");
};

  /* ─ open file ─ */
 const onOpen = async (doc) => {
  try {
    const type = deriveType(doc);
    const title = doc.title || 'File';
    const mime = (doc.mimeType || '').toLowerCase();
    const lowerTitle = title.toLowerCase();

    const isDocxFile =
    mime.includes('wordprocessingml') ||
    lowerTitle.endsWith('.docx');

    const isLegacyWordDoc =
    mime === 'application/msword' ||
    lowerTitle.endsWith('.doc');

    setViewerTitle(title);
    setViewerVisible(true);
    setViewerLoading(true);
    setViewerUri(null);
    setViewerText("");

   if (isLegacyWordDoc) {
  throw new Error(
    "Legacy .doc files are not supported for in-app viewing. Please use PDF or DOCX for the best experience."
  );
}

if (isDocxFile) {
  let text = (doc.textContent || "").trim();

  if (!text) {
    const result = await callExtractTextFunction(doc);
    text = (
      result?.textContent ||
      result?.extractedText ||
      result?.text ||
      ""
    ).trim();
  }

  if (!text) {
    throw new Error("This DOCX file could not be opened as readable text.");
  }

  setViewerType("text");
  setViewerText(text);
  return;
}

    const url = getFileDownloadUrl(doc.fileId);
    if (!url) throw new Error('Invalid file URL.');

    if (type === 'pdf') setViewerType('pdf');
    else if (type === 'image') setViewerType('image');
    else setViewerType('doc');

      const resp = await fetch(url, {
        headers: {
          'X-Appwrite-Project': APPWRITE_PROJECT_ID,
        },
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(body || `Download failed (${resp.status})`);
      }
// converting to localbase 64
      const arrayBuffer = await resp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      const name = (doc.title || '').toLowerCase();

      let ext = '';
      if (mime.includes('pdf') || name.endsWith('.pdf')) ext = '.pdf';
      else if (mime.startsWith('image/')) {
        if (mime.includes('png') || name.endsWith('.png')) ext = '.png';
        else ext = '.jpg';
      } else if (mime.includes('word') || name.endsWith('.docx')) ext = '.docx';
      else if (name.includes('.')) ext = name.slice(name.lastIndexOf('.'));
      else ext = '';
// writes file into local cache
      const safeId = (doc.fileId || doc.$id).replace(/[^a-zA-Z0-9_-]/g, '');
      const localPath = `${FileSystem.cacheDirectory}execudoc_${safeId}${ext}`;

      await FileSystem.writeAsStringAsync(localPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
// open file viewer
      setViewerUri(localPath);
    } catch (e) {
      console.log('open error', e);
      setViewerVisible(false);
      setViewerUri(null);
      Alert.alert('Open failed', e?.message || 'Could not open file.');
    } finally {
      setViewerLoading(false);
    }
  };

  /* ─ summarise ─*/
//short/detailed
 const onSummarise = async (doc, mode = "short") => {
  const isDetailed = mode === "detailed";
  try {
    setSummarisingId(doc.$id);

    // Cache check so no API call if already saved
    const cache = readTtsCache(doc);

    // short mode
if (!isDetailed) {
 
  const existingShort = (doc.summary || "").trim();
      if (existingShort) {
      openSummaryResult(doc, existingShort, "short");
        return;
      }
    }

    // Detailed mode
  if (isDetailed) {
  const existingDetailed = (cache.summaryDetailedText || "").trim();
  if (existingDetailed) {
      openSummaryResult(doc, existingDetailed, "detailed");
      return;
  }
}

// ensure text exists before summarising
let workingDoc = doc;
let text = (doc.textContent || "").trim();

if (!text) {
  const extractResult = await callExtractTextFunction(doc);

  text = (
    extractResult?.textContent ||
    extractResult?.extractedText ||
    extractResult?.text ||
    ""
  ).trim();

  if (!text) {
    // fallback: reload fresh doc
    const freshDocs = await listUserDocs(userId);
    setFiles(freshDocs);

    const refreshed = freshDocs.find((d) => d.$id === doc.$id);
    text = (refreshed?.textContent || "").trim();

    if (!text) {
      Alert.alert(
        "No text found",
        "This document has no readable text. Try another file."
      );
      return;
    }

    workingDoc = refreshed;
  }
}

    // Not cached, so call function 
    const result = await callSummariseWithRetry(workingDoc, mode);

    const newSummary = (result?.summary || "").trim();

    if (!newSummary) {
      if (result?.error) Alert.alert("Summarise failed", result.error);
      else Alert.alert("Summarise complete", "No summary returned.");
      return;
    }

if (!isDetailed) {

      // Save short summary into "summary" column
      try {
        const nextCacheJson = makeTtsCache({
          bucketId: cache.bucketId || TTS_BUCKET_ID,
          docParts: cache.docParts,
          summaryParts: [], // reset (new summary)
          summaryDetailedParts: cache.summaryDetailedParts,
          summaryDetailedText: cache.summaryDetailedText,
        });
        await updateTtsCacheField(doc.$id, nextCacheJson);
      } catch {}
    
      await updateDocFields(doc.$id, { summary: newSummary });
         openSummaryResult(doc, newSummary, "short");
    } else {
  // Save detailed summary into ttsSummaryParts 
  const nextCacheJson = makeTtsCache({
    bucketId: cache.bucketId || TTS_BUCKET_ID,
    docParts: cache.docParts,
    summaryParts: cache.summaryParts,
    summaryDetailedParts: [], // reset for new detailed sum
    summaryDetailedText: newSummary,
  });

  await updateTtsCacheField(doc.$id, nextCacheJson);
  openSummaryResult(doc, newSummary, "detailed");
}

    await load();
  } catch (e) {
    console.log("summarise error", e);
    Alert.alert("Summarise failed", e?.message || "Try again later.");
  } finally {
    setSummarisingId(null);
  }
};

const getRankedVoiceTargetDocs = ({
  files,
  autoTargetText,
  autoSearchText,
  autoFilterCategory,
}) => {
  if (!Array.isArray(files) || files.length === 0) return [];

  const normalise = (value) =>
    typeof value === "string"
      ? value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
      : "";

const stemVoiceWord = (word) => {
  if (!word || word.length <= 4) return word;

  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }

  if (word.endsWith("es") && word.length > 5) {
    return word.slice(0, -2);
  }

  if (word.endsWith("s") && word.length > 4) {
    return word.slice(0, -1);
  }

  return word;
};

const simplifyVoiceMatchText = (value) => {
  const text = normalise(value);

  if (!text) return "";

  return text
    .replace(/\b(my|the|a|an|document|file|summary)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(stemVoiceWord)
    .join(" ");
};

  const targetText = normalise(autoTargetText || autoSearchText);
  const simplifiedTargetText = simplifyVoiceMatchText(autoTargetText || autoSearchText);
  const filterCategory = normalise(autoFilterCategory);

  let candidates = [...files];

  if (filterCategory) {
    candidates = candidates.filter(
      (doc) => normalise(doc?.category) === filterCategory
    );
  }

  if (!targetText) {
    return candidates.map((doc) => ({ doc, score: 1 }));
  }

  const scoreDoc = (doc) => {
  const title = normalise(doc?.title);
  const simplifiedTitle = simplifyVoiceMatchText(doc?.title);
  const keywords = normalise(doc?.keywords);
  const summary = normalise(doc?.summary);
  const textContent = normalise(doc?.textContent);
  const category = normalise(doc?.category);

  let score = 0;

  if (!targetText && !simplifiedTargetText) return score;

  // exact title match
  if (title === targetText) score += 120;
  if (simplifiedTargetText && simplifiedTitle === simplifiedTargetText) score += 110;

  // strong title match
  if (targetText && title.includes(targetText)) score += 80;
  if (simplifiedTargetText && simplifiedTitle.includes(simplifiedTargetText)) score += 75;

  // query fully covered by title words
  if (targetText && targetText.split(" ").every((w) => title.includes(w))) score += 60;
  if (
    simplifiedTargetText &&
    simplifiedTargetText.split(" ").every((w) => simplifiedTitle.includes(w))
  ) {
    score += 55;
  }

// partial overlap on title words
const targetWords = (simplifiedTargetText || targetText).split(" ").filter(Boolean);
const titleWords = simplifiedTitle.split(" ").filter(Boolean);
const matchedWords = targetWords.filter((word) => titleWords.includes(word)).length;

if (matchedWords >= 1) score += 15;
if (matchedWords >= 2) score += 30;
if (targetWords.length > 0 && matchedWords === targetWords.length) score += 25;
  

  // category match
  if (category && (targetText.includes(category) || simplifiedTargetText.includes(category))) {
    score += 50;
  }

  // keywords
  if (targetText && keywords.includes(targetText)) score += 40;
  if (simplifiedTargetText && keywords.includes(simplifiedTargetText)) score += 35;

  // summary
  if (targetText && summary.includes(targetText)) score += 20;
  if (simplifiedTargetText && summary.includes(simplifiedTargetText)) score += 15;

  // fallback 
  if (score === 0 && targetText && textContent.includes(targetText)) score += 10;
  if (score === 0 && simplifiedTargetText && textContent.includes(simplifiedTargetText)) score += 10;

  return score;
};

  return candidates
    .map((doc) => ({ doc, score: scoreDoc(doc) }))
    .sort((a, b) => b.score - a.score);
};

const hasAmbiguousTopMatches = (ranked = []) => {
  if (!Array.isArray(ranked) || ranked.length < 2) return false;

  const first = ranked[0]?.score || 0;
  const second = ranked[1]?.score || 0;

  if (first <= 0 || second <= 0) return false;

  return Math.abs(first - second) <= 15;
};

const resolveVoiceTargetDoc = ({
  files,
  autoTargetText,
  autoSearchText,
  autoFilterCategory,
  autoOpenRecent,
}) => {
  const ranked = getRankedVoiceTargetDocs({
    files,
    autoTargetText,
    autoSearchText,
    autoFilterCategory,
  });

  if (!ranked.length) return null;

  if (!autoTargetText && !autoSearchText) {
    return ranked[0]?.doc || null;
  }

 if (ranked[0]?.score >= 40)  {
    return ranked[0].doc;
  }

  if (autoOpenRecent) {
    return ranked[0]?.doc || null;
  }

  return null;
};

const openSummaryResult = (doc, summaryText, summaryType = "short") => {
  const cleanSummary = (summaryText || "").trim();
  if (!cleanSummary) return;

  const isDetailed = summaryType === "detailed";
  const alertTitle = isDetailed ? "AI Summary (Detailed)" : "AI Summary (Short)";
  const ttsVariant = isDetailed ? "detailed" : "short";

  Alert.alert(alertTitle, cleanSummary, [
    {
      text: "Listen",
      onPress: () => {
        setTtsText(cleanSummary);
        setTtsContext({
          docId: doc.$id,
          mode: "summary",
          variant: ttsVariant,
        });
        setTtsVisible(true);
      },
    },
    {
      text: "Save to Library",
      onPress: async () => {
        try {
          await saveSummaryToLibraryDirect(doc, cleanSummary, summaryType);
          Alert.alert("Saved", `${isDetailed ? "Detailed" : "Short"} summary saved to your Library.`);
        } catch (e) {
          Alert.alert("Save failed", e?.message || "Could not save summary.");
        }
      },
    },
    { text: "OK", style: "default" },
  ]);
};

const openVoiceSummaryResult = (doc, summaryText, summaryType = "short") => {
  openSummaryResult(doc, summaryText, summaryType);
};

const saveSummaryToLibraryDirect = async (doc, summaryText, summaryType = "short") => {
  if (!userId) {
    throw new Error("User session not ready.");
  }

  if (!doc?.$id) {
    throw new Error("Missing document.");
  }

  const cleanSummary = (summaryText || "").trim();
  if (!cleanSummary) {
    throw new Error("No summary available to save.");
  }

  await saveToLibrary({
    userId,
    docId: doc.$id,
    title: doc.title,
    summaryType,
    summaryText: cleanSummary,
    audioFileId: "",
    category: doc.category || "",
    keywords: doc.keywords || "",
  });
};

const syncSavedSummaryCategoryForDoc = async (docId, nextCategory) => {
  if (!userId || !docId) return;

  try {
    const savedItems = await listSavedItems(userId);

    const linkedItems = savedItems.filter((item) => item?.docId === docId);

    await Promise.all(
      linkedItems.map((item) =>
        updateSavedItem(item.$id, {
          category: nextCategory || "",
        })
      )
    );
  } catch (e) {
    console.log("sync saved summary category failed", e);
  }
};

const callSummariseWithRetry = async (doc, mode = "short") => {
  const firstResult = await callSummariseFunction(doc, mode);

  if (firstResult?.ok !== false && (firstResult?.summary || "").trim()) {
    return firstResult;
  }

  const firstError = (firstResult?.error || "").toLowerCase();
  const shouldRetry =
    firstError.includes("connection error") ||
    firstError.includes("network") ||
    firstError.includes("timeout");

  if (!shouldRetry) {
    return firstResult;
  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  return await callSummariseFunction(doc, mode);
};

  /* ─Listen full doc auto extract ─*/
const onListenDoc = async (doc, options = {}) => {
  const autoPlay = options?.autoPlay === true;

  try {
    const existing = (doc.textContent || "").trim();
    if (existing) {
      if (autoPlay) {
        await autoPlayTtsForDoc(doc, "doc", undefined, existing);
      } else {
        setTtsText(existing);
        setTtsContext({ docId: doc.$id, mode: "doc" });
        setTtsVisible(true);
      }
      return;
    }

    Alert.alert(
      "Preparing audio",
      "No text extracted yet — extracting text now. This can take a few seconds…"
    );

    const result = await callExtractTextFunction(doc);

    const returnedText =
      (result?.textContent || result?.extractedText || result?.text || "").trim();

    if (returnedText) {
      if (autoPlay) {
        await autoPlayTtsForDoc(doc, "doc", undefined, returnedText);
      } else {
        setTtsText(returnedText);
        setTtsContext({ docId: doc.$id, mode: "doc" });
        setTtsVisible(true);
      }
      return;
    }

    const freshDocs = await listUserDocs(userId);
    setFiles(freshDocs);

    const refreshed = freshDocs.find((d) => d.$id === doc.$id);
    const finalText = (refreshed?.textContent || "").trim();

    if (!finalText) {
      Alert.alert(
        "No text found",
        "We couldn’t extract readable text from this file. Try a different file or use Summarise."
      );
      return;
    }

    if (autoPlay) {
      await autoPlayTtsForDoc(refreshed || doc, "doc", undefined, finalText);
    } else {
      setTtsText(finalText);
      setTtsContext({ docId: doc.$id, mode: "doc" });
      setTtsVisible(true);
    }
  } catch (e) {
    console.log("listen doc error", e);
    Alert.alert("Listen failed", e?.message || "Try again.");
  }
};
  /* ─ delete ─*/
  const onDelete = (doc) => {
    Alert.alert('Delete document', `Delete "${doc.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { // calls delete user doc 
          try {
            await deleteUserDoc(doc.$id, doc.fileId);
            await load();
          } catch (e) {
            Alert.alert('Delete failed', e?.message || 'Try again.');
          }
        },
      },
    ]);
  };
// folder categorys 
  const CATEGORY_PRESETS = ["work", "study", "legal", "finance", "personal", "history", "other"];
// converting category text to lc 
const normaliseCategory = (value) => {
  const v = (value || "").trim().toLowerCase();
  return v;
};

const getFolderCards = () => {
  // counts how many docs in each 
  const counts = {};

  for (const d of files) {
    const c = normaliseCategory(d.category);
    const key = c || "uncategorised";
    counts[key] = (counts[key] || 0) + 1;
  }
//builds folder cards dynamicaly adds - 
  const cards = [{ key: "all", label: "All", count: files.length }];

  for (const c of CATEGORY_PRESETS) {
    const count = counts[c] || 0;
    if (count > 0) cards.push({ key: c, label: c, count });
  }
// and if needed uncategorise 
  const unc = counts["uncategorised"] || 0;
  if (unc > 0) cards.push({ key: "uncategorised", label: "Other", count: unc });

  return cards;
};

const folderCards = getFolderCards();
// filter files in 3 stages 
const filteredFiles = files
  .filter((doc) => {
    if (filter === "all") return true;
    const t = deriveType(doc);
    if (filter === "pdf") return t === "pdf";
    if (filter === "image") return t === "image";
    if (filter === "other") return t === "other";
    return true;
  })
  .filter((doc) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const title = (doc.title || "").toLowerCase();
    return title.includes(q);
  })
  .filter((doc) => {
    if (!selectedCategory || selectedCategory === "all") return true;

    const c = normaliseCategory(doc.category);

    if (selectedCategory === "uncategorised") return !c;
    return c === selectedCategory;
  });

  const showFolderEmptyState =
  selectedCategory &&
  selectedCategory !== "all" &&
  filteredFiles.length === 0;

  const FolderCard = ({ item }) => {
  const selected = selectedCategory === item.key;

  return (
    <TouchableOpacity
      onPress={() => setSelectedCategory(item.key)}
      activeOpacity={0.85}
      style={{
        width: "48%",
        padding: 13,
        borderRadius: 18,
        backgroundColor: selected ? "#EEF2FF" : "#FFFFFF",
        borderWidth: 1,
        borderColor: selected ? "#C7D2FE" : "#E2E8F0",
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: selected ? brand : "#EEF2FF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="folder-outline" size={18} color={selected ? "#fff" : brand} />
        </View>

        <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "800" }}>
          {item.count} {item.count === 1 ? "file" : "files"}
        </Text>
      </View>

      <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "900", color: "#0F172A" }}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
};
 // document row card component 
const Item = ({ item }) => {
  const type = deriveType(item);
  const { label, bg } = typeLabelAndColor(type);

  const categoryText = (normaliseCategory(item.category) || "uncategorised")
    .replace(/^\w/, (c) => c.toUpperCase());

    const keywordPreview = (item?.keywords || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  return (
    <View
      style={{
        width: "100%",
        alignSelf: "stretch",
        backgroundColor: "#FFFFFF",
        padding: 15,
        borderRadius: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <TouchableOpacity
          onPress={() => onOpen(item)}
          style={{ flex: 1, paddingRight: 10 }}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
             style={{ fontWeight: "900", fontSize: 15, color: "#0F172A", flex: 1 }}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <View
              style={{
                backgroundColor: bg,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                {label}
              </Text>
            </View>
          </View>

          <Text
            style={{ marginTop: 6, fontSize: 12, color: "#64748B", fontWeight: "700" }}
            numberOfLines={1}
          >
            {categoryText}
          </Text>

          {!!item.summary && (
           <Text
              style={{ marginTop: 8, color: "#475569", lineHeight: 20 }}
              numberOfLines={2}
            >
              {item.summary}
           </Text>
          )}

          {!!keywordPreview && (
            <Text
              style={{ marginTop: 8, fontSize: 12, color: "#94A3B8" }}
              numberOfLines={1}
            >
              Keywords: {keywordPreview}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openMenu(item)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F8FAFC",
            borderWidth: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={brand} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
  // play cached parts 
  const playWithCache = async ({ doc, mode, variant, text }) => {
  const cache = readTtsCache(doc);

  const isSummary = mode === "summary";
  const isDetailed = isSummary && variant === "detailed";

  const existingParts = isSummary
    ? (isDetailed ? cache.summaryDetailedParts : cache.summaryParts)
    : cache.docParts;

  if (existingParts?.length) {
    await playParts(existingParts);
    return;
  }

  await generateAndPlay(text, {
    onPartsReady: async (parts) => {
      try {
        const nextJson = makeTtsCache({
          bucketId: cache.bucketId || TTS_BUCKET_ID,
          docParts: isSummary ? cache.docParts : parts,
          summaryParts: isSummary && !isDetailed ? parts : cache.summaryParts,
          summaryDetailedParts: isDetailed ? parts : cache.summaryDetailedParts,
          summaryDetailedText: cache.summaryDetailedText,
        });

        await updateTtsCacheField(doc.$id, nextJson);
        await load();
      } catch (e) {
        console.log("cache save failed", e);
      }
    },
  });
};

const autoPlayTtsForDoc = async (doc, mode, variant, text) => {
  setTtsText(text);
  setTtsContext({ docId: doc.$id, mode, variant });
  setTtsVisible(true);
  setTtsAutoPlayRequested(true);
};


  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <InnerContainer style={{ width: '100%', flex: 1, alignSelf: 'stretch' }}>
      <PageTitle style={{ textAlign: "center", color: "#4F46E5" }}>Documents</PageTitle>
      <SubTitle
  style={{
    textAlign: "center",
    marginBottom: 16,
    color: "#475569",
    lineHeight: 20,
    paddingHorizontal: 8,
  }}
>
         Upload, organise, summarise, and listen to your files in one place.
       </SubTitle>

                <View
          style={{
            flexDirection: "row",
            marginBottom: 14,
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 8,
            borderWidth: 1,
            borderColor: "#E2E8F0",
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 1,
          }}
        >
          <TouchableOpacity
            onPress={onUploadFile}
            style={{
              flex: 1,
              backgroundColor: brand,
              paddingVertical: 12,
              borderRadius: 14,
              marginRight: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>
              Upload File
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onTakePhoto}
            style={{
              flex: 1,
              backgroundColor: "#8B5CF6",
              paddingVertical: 12,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>
              Take Photo
            </Text>
          </TouchableOpacity>
        </View>

        {msg ? (
          <Text style={{ marginBottom: 12, color: "#64748B", textAlign: "center" }}>
            {msg}
          </Text>
        ) : null}

        <Line />

   <FlatList
  data={filteredFiles}
  keyExtractor={(item) => item.$id}
renderItem={({ item }) => (
  <View style={{ width: "100%", alignSelf: "stretch" }}>
    <Item item={item} />
  </View>
)}
refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
contentContainerStyle={{
  paddingHorizontal: 16,
  paddingTop: 14,
  paddingBottom: 32,
  flexGrow: 1,
  alignItems: "stretch",
}}
style={{ flex: 1, width: "100%", alignSelf: "stretch" }}

    ListEmptyComponent={
    showFolderEmptyState ? (
      <View
        style={{
          backgroundColor: "#F8FAFC",
          borderWidth: 1,
          borderColor: "#E2E8F0",
          borderRadius: 16,
          paddingVertical: 24,
          paddingHorizontal: 18,
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <Ionicons name="folder-open-outline" size={28} color="#94A3B8" />
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A", marginTop: 10, marginBottom: 6 }}>
          No documents in this folder
        </Text>
        <Text style={{ color: "#64748B", textAlign: "center", lineHeight: 20 }}>
          Try another folder or go back to all folders.
        </Text>
      </View>
    ) : (
      !loading && (
        <View
          style={{
            backgroundColor: "#F8FAFC",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 16,
            paddingVertical: 28,
            paddingHorizontal: 18,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <Ionicons name="document-outline" size={28} color="#94A3B8" />
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A", marginTop: 10, marginBottom: 6 }}>
            No documents yet
          </Text>
          <Text style={{ color: "#64748B", textAlign: "center", lineHeight: 20 }}>
            Upload a file or take a photo to get started.
          </Text>
        </View>
      )
    )
  }

 ListHeaderComponent={
  <View style={{ width: "100%", alignSelf: "stretch" }}>
   <TextInput
  value={searchQuery}
  onChangeText={setSearchQuery}
  placeholder="Search documents..."
  placeholderTextColor="#9CA3AF"
style={{
  width: "100%",
  alignSelf: "stretch",
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 13,
  marginTop: 14,
  marginBottom: 18,
  borderWidth: 1,
  borderColor: "#E2E8F0",
}}
/>

                    {selectedCategory && selectedCategory !== "all" ? (
  <View style={{ width: "100%", alignSelf: "stretch", marginBottom: 18 }}>
    <TouchableOpacity
      onPress={() => setSelectedCategory("all")}
      style={{
        alignSelf: "flex-start",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 14,
      }}
    >
      <Text style={{ fontWeight: "800", color: "#0F172A" }}>All folders</Text>
    </TouchableOpacity>

   <Text style={{ fontWeight: "900", fontSize: 24, color: "#0F172A" }}>
  {(selectedCategory === "uncategorised" ? "Other" : (selectedCategory || ""))
    .toString()
    .replace(/^\w/, (c) => c.toUpperCase())}
</Text>

    <Text style={{ color: "#64748B", fontWeight: "600", marginTop: 4, marginBottom: 14 }}>
      {filteredFiles.length} {filteredFiles.length === 1 ? "document" : "documents"}
    </Text>

    <Text style={{ fontWeight: "900", fontSize: 16, color: "#0F172A" }}>
      Documents
    </Text>
  </View>
) : (

        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontWeight: "900", fontSize: 16 }}>Folders</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
  {folderCards.map((f) => (
  <FolderCard key={f.key} item={f} />
))}
</View>

          <Text style={{ fontWeight: "900", fontSize: 16, marginTop: 8 }}>Recent documents</Text>
        </View>
      )}
    </View>
  }
/>
</InnerContainer>

<Modal
  visible={showUploadModal}
  transparent
  animationType="fade"
  onRequestClose={closeUploadModal}
>
  <TouchableOpacity
    activeOpacity={1}
    onPress={closeUploadModal}
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      padding: 18,
    }}
  >
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => {}}
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 6 }}>
        Upload document
      </Text>

      <Text style={{ color: "#64748B", marginBottom: 10, lineHeight: 20 }}>
        Review the title and optional category before saving your file.
      </Text>

      <Text style={{ marginBottom: 6, fontSize: 12, color: "#64748B" }}>
        Title
      </Text>

      <TextInput
        value={uploadTitle}
        onChangeText={setUploadTitle}
        placeholder="Enter document title"
        placeholderTextColor="#94A3B8"
        style={{
          width: "100%",
          backgroundColor: "#F1F5F9",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          color: "#0F172A",
          marginBottom: 12,
        }}
      />

      <Text style={{ marginBottom: 8, fontSize: 12, color: "#64748B" }}>
        Category (optional)
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CATEGORY_OPTIONS.map((c) => {
          const selected = uploadCategory === c;

          return (
            <TouchableOpacity
              key={c}
              onPress={() => setUploadCategory(selected ? "" : c)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? brand : "#E2E8F0",
                backgroundColor: selected ? brand : "#F8FAFC",
              }}
            >
              <Text style={{ color: selected ? "#fff" : "#0F172A", fontWeight: "800" }}>
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <TouchableOpacity
          onPress={closeUploadModal}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: "#F1F5F9",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#0F172A", fontWeight: "900" }}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmUpload}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: brand,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Upload</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>

<Modal
  visible={menuVisible}
  transparent
  animationType="fade"
  onRequestClose={closeMenu}
>
  <TouchableOpacity
    activeOpacity={1}
    onPress={closeMenu}
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    }}
  >
     <TouchableOpacity
      activeOpacity={1}
      onPress={() => {}}
style={{
  backgroundColor: "#fff",
  padding: 18,
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  shadowColor: "#000",
  shadowOpacity: 0.10,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: -6 },
  elevation: 5,
}}
    >
    <View
  style={{
    paddingBottom: 14,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  }}
>
  <Text style={{ fontSize: 17, fontWeight: "900", color: "#0F172A" }} numberOfLines={1}>
    {menuDoc?.title || "Document"}
  </Text>
  <Text style={{ marginTop: 4, fontSize: 12, color: "#64748B", fontWeight: "700" }} numberOfLines={1}>
    {(normaliseCategory(menuDoc?.category) || "uncategorised").replace(/^\w/, (c) => c.toUpperCase())}
  </Text>
</View>

  {[
  { key: "open", label: "Open", icon: "document-text-outline" },
  { key: "summarise", label: "Summarise", icon: "sparkles-outline" },
  { key: "listen", label: "Listen", icon: "volume-high-outline" },
  { key: "categorise", label: "Categorise", icon: "pricetag-outline" },
  { key: "category", label: "Change category", icon: "folder-outline" },
  { key: "keywords", label: "Edit keywords", icon: "create-outline" },
  { key: "delete", label: "Delete", icon: "trash-outline" },
].map((a, idx) => (
  <TouchableOpacity
    key={a.key}
    onPress={() => handleMenuAction(a.key)}
style={{
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 14,
  borderTopWidth: idx === 0 ? 0 : 1,
  borderTopColor: "#F8FAFC",
}}
  >
    <View style={{ width: 28, alignItems: "center" }}>
      <Ionicons
        name={a.icon}
        size={18}
        color={a.key === "delete" ? "#B91C1C" : "#0F172A"}
      />
    </View>

    <Text
      style={{
        flex: 1,
        fontSize: 15,
        fontWeight: "700",
        color: a.key === "delete" ? "#B91C1C" : "#0F172A",
      }}
    >
      {a.label}
    </Text>

    {a.key !== "delete" && (
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    )}
  </TouchableOpacity>
))}

      <TouchableOpacity
        onPress={closeMenu}
        style={{
          marginTop: 12,
          paddingVertical: 13,
          borderRadius: 14,
          backgroundColor: "#F8FAFC",
          borderWidth: 1,
          borderColor: "#E2E8F0",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "900" }}>Cancel</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>

<Modal
  visible={kwModalVisible}
  transparent
  animationType="fade"
  onRequestClose={closeKeywordsModal}
>
  <TouchableOpacity
    activeOpacity={1}
    onPress={closeKeywordsModal}
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      padding: 18,
    }}
  >
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => {}}
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 10 }}>
        Keywords
      </Text>

      <TextInput
        value={kwValue}
        onChangeText={setKwValue}
        placeholder="Comma separated keywords"
        placeholderTextColor="#94A3B8"
        style={{
          width: "100%",
          backgroundColor: "#F1F5F9",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          color: "#0F172A",
        }}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          onPress={async () => {
            try {
              if (!kwModalDoc?.$id) return;
              await updateDocFields(kwModalDoc.$id, { keywords: kwValue });
              closeKeywordsModal();
              await load();
            } catch {
              Alert.alert("Update failed", "Could not save keywords.");
            }
          }}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: brand,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={closeKeywordsModal}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: "#F1F5F9",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#0F172A", fontWeight: "900" }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>

<Modal
  visible={categoryModalVisible}
  transparent
  animationType="fade"
  onRequestClose={closeCategoryModal}
>
  <TouchableOpacity
    activeOpacity={1}
    onPress={closeCategoryModal}
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      padding: 18,
    }}
  >
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => {}}
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 10 }}>
        Change category
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CATEGORY_OPTIONS.map((c) => {
          const selected = categoryChoice === c;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => {
                setCategoryChoice(c);
                setCategoryCustom("");
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? brand : "#E2E8F0",
                backgroundColor: selected ? brand : "#F8FAFC",
              }}
            >
              <Text style={{ color: selected ? "#fff" : "#0F172A", fontWeight: "800" }}>
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ marginTop: 12, fontSize: 12, color: "#64748B" }}>
        Or type a custom category
      </Text>

      <TextInput
        value={categoryCustom}
        onChangeText={(t) => {
          setCategoryCustom(t);
          if (t.trim().length > 0) setCategoryChoice("");
        }}
        placeholder="e.g. insurance"
        placeholderTextColor="#94A3B8"
        style={{
          marginTop: 8,
          width: "100%",
          backgroundColor: "#F1F5F9",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          color: "#0F172A",
        }}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          onPress={async () => {
            try {
              const docId = categoryModalDoc?.$id;
              if (!docId) return;

              const next =
                categoryCustom.trim().length > 0
                  ? categoryCustom.trim().toLowerCase()
                  : categoryChoice;

              await updateDocFields(docId, { category: next || null });
               await syncSavedSummaryCategoryForDoc(docId, next || "");
               closeCategoryModal();
               await load();
            } catch {
              Alert.alert("Update failed", "Could not save category.");
            }
          }}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: brand,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={closeCategoryModal}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: "#F1F5F9",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#0F172A", fontWeight: "900" }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>

      <Modal
        visible={!!summarisingId}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
  style={{
    width: "100%",
    maxWidth: 330,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  }}
>
  <View
    style={{
      width: 62,
      height: 62,
      borderRadius: 20,
      backgroundColor: "rgba(79,70,229,0.10)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    }}
  >
    <ActivityIndicator size="large" color={brand} />
  </View>

  <Text
  style={{
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  }}
>
  Generating summary
</Text>

  <Text
    style={{
      marginTop: 8,
      fontSize: 13,
      color: "#64748B",
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 250,
    }}
  >
    Please wait while ExecuDoc prepares your summary. Larger documents can take a few seconds.
  </Text>
</View>
        </View>
      </Modal>

      {/* TTS Modal */}
      <Modal
        visible={ttsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          stop();
          setTtsVisible(false);
        }}
      >
<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
  <View
    style={{
      backgroundColor: "#fff",
      padding: 16,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "78%",
      borderWidth: 1,
      borderColor: "#E5E7EB",
    }}
  >
           <View
  style={{
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  }}
>
  <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B" }}>
    {ttsContext?.mode === "doc" ? "FULL DOCUMENT AUDIO" : "SUMMARY AUDIO"}
  </Text>
  <Text style={{ marginTop: 4, fontSize: 20, fontWeight: "900", color: "#0F172A" }}>
    {ttsContext?.mode === "doc" ? "Listen to full document" : "Listen to summary"}
  </Text>
</View>

<ScrollView
  style={{
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  }}
>
  <Text style={{ fontSize: 15, lineHeight: 22, color: "#0F172A" }}>{ttsText}</Text>
</ScrollView>

            {ttsBusy && (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      backgroundColor: "#EEF2FF",
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#C7D2FE",
    }}
  >
    <ActivityIndicator color={brand} />
    <Text style={{ color: "#3730A3", fontWeight: "700" }}>
      {ttsStatus === "generating" ? "Generating audio…" : "Downloading audio…"}
    </Text>
  </View>
)}

            {!!ttsError && <Text style={{ color: 'red', marginBottom: 10 }}>{ttsError}</Text>}
<View style={{ marginTop: 4 }}>
  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
    <TouchableOpacity
      onPress={async () => {
        const ctx = ttsContext;
        if (!ctx?.docId) {
          await generateAndPlay(ttsText);
          return;
        }

        const doc = files.find((d) => d.$id === ctx.docId);
        if (!doc) {
          await generateAndPlay(ttsText);
          return;
        }

        await playWithCache({ doc, mode: ctx.mode, variant: ctx.variant, text: ttsText });
      }}
      disabled={ttsBusy}
      style={{
        flex: 1,
        minWidth: 110,
        paddingVertical: 13,
        backgroundColor: ttsBusy ? "#CBD5E1" : brand,
        borderRadius: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900" }}>Listen</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={ttsStatus === "paused" ? resume : pause}
      disabled={!(ttsStatus === "playing" || ttsStatus === "paused")}
      style={{
        flex: 1,
        minWidth: 110,
        paddingVertical: 13,
        backgroundColor: "#0F172A",
        borderRadius: 14,
        alignItems: "center",
        opacity: ttsStatus === "playing" || ttsStatus === "paused" ? 1 : 0.4,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900" }}>
        {ttsStatus === "paused" ? "Resume" : "Pause"}
      </Text>
    </TouchableOpacity>
  </View>

  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
    <TouchableOpacity
      onPress={stop}
      disabled={!(ttsStatus === "playing" || ttsStatus === "paused")}
      style={{
        flex: 1,
        paddingVertical: 13,
        backgroundColor: "#F1F5F9",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        opacity: ttsStatus === "playing" || ttsStatus === "paused" ? 1 : 0.5,
      }}
    >
      <Text style={{ color: "#0F172A", fontWeight: "900" }}>Stop</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={() => {
        stop();
        setTtsVisible(false);
      }}
      style={{
        flex: 1,
        paddingVertical: 13,
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#0F172A", fontWeight: "900" }}>Close</Text>
    </TouchableOpacity>
  </View>
</View>
          </View>
        </View>
      </Modal>

{/* Summary type picker */}
<Modal
  visible={summaryPickerVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setSummaryPickerVisible(false)}
>
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    }}
  >
    <View
      style={{
        backgroundColor: "#fff",
        padding: 16,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>
        Choose summary type
      </Text>

      <Text style={{ color: "#6B7280", marginBottom: 14 }}>
        {summaryPickerDoc?.title || "Selected document"}
      </Text>

      {/* Options */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <TouchableOpacity
          onPress={() => setSummaryPickerMode("short")}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: summaryPickerMode === "short" ? brand : "#E5E7EB",
            backgroundColor: summaryPickerMode === "short" ? "rgba(99,102,241,0.10)" : "#fff",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", color: "#111827" }}>Short</Text>
          <Text style={{ color: "#6B7280", marginTop: 2, fontSize: 12 }}>
            Quick summary
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSummaryPickerMode("detailed")}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: summaryPickerMode === "detailed" ? brand : "#E5E7EB",
            backgroundColor: summaryPickerMode === "detailed" ? "rgba(99,102,241,0.10)" : "#fff",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", color: "#111827" }}>Detailed</Text>
          <Text style={{ color: "#6B7280", marginTop: 2, fontSize: 12 }}>
            More depth
          </Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
       onPress={() => {
  setSummaryPickerVisible(false);
  setSummaryPickerDoc(null);
}}
            style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", color: "#111827" }}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const doc = summaryPickerDoc;
            const mode = summaryPickerMode;

            setSummaryPickerVisible(false);

            if (doc) onSummarise(doc, mode);
          }}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: brand,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: "#fff" }}>Summarise</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* INTERNAL FILE VIEWER */}
      <Modal
        visible={viewerVisible}
        animationType="slide"
        onRequestClose={() => {
         setViewerVisible(false);
         setViewerUri(null);
         setViewerText('');
       }}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View
            style={{
              paddingTop: 50,
              paddingHorizontal: 12,
              paddingBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
              zIndex: 10,
            }}
          >
            <TouchableOpacity
             onPress={() => {
              setViewerVisible(false);
              setViewerUri(null);
              setViewerText('');
            }}
              style={{ padding: 8 }}
            >
              <Text style={{ color: brand, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>

            <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontWeight: '800' }}>
              {viewerTitle || 'PDF'}
            </Text>

            <View style={{ width: 60 }} />
          </View>

         {viewerLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <ActivityIndicator size="large" color={brand} />
              <Text style={{ marginTop: 12, color: '#475569', fontWeight: '700' }}>
                Loading document...
              </Text>
              <Text style={{ marginTop: 6, color: '#64748B', textAlign: 'center', lineHeight: 20 }}>
                Please wait while ExecuDoc prepares your file for viewing.
              </Text>
            </View>
        ) : viewerType === 'text' ? (
  <ScrollView
    style={{ flex: 1, padding: 16 }}
    contentContainerStyle={{ paddingBottom: 24 }}
  >
    <View
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B" }}>
        EXTRACTED DOCUMENT TEXT
      </Text>
      <Text style={{ marginTop: 4, color: "#475569", lineHeight: 20 }}>
        This document is displayed as readable extracted text for reliable in-app viewing.
      </Text>
    </View>

    <Text style={{ color: '#0F172A', fontSize: 15, lineHeight: 24 }}>
      {viewerText}
    </Text>
  </ScrollView>

) : viewerUri ? (
  viewerType === 'pdf' ? (
    <Pdf
      source={{ uri: viewerUri }}
      style={{ flex: 1, width: '100%' }}
      onError={(err) => {
        console.log('pdf render error', err);
        Alert.alert('PDF error', 'Could not render this PDF.');
      }}
    />
  ) : viewerType === 'image' ? (
    <View style={{ flex: 1, padding: 12 }}>
      <Image
        source={{ uri: viewerUri }}
        style={{ flex: 1, width: '100%', borderRadius: 10 }}
        resizeMode="contain"
      />
    </View>
  ) : (
    <WebView
      source={{ uri: viewerUri }}
      style={{ flex: 1 }}
      originWhitelist={['*']}
      allowFileAccess
      allowingReadAccessToURL={FileSystem.cacheDirectory}
    />
  )
) : (
              
     <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#6B7280' }}>No file loaded.</Text>
            </View>
          )}
        </View>
      </Modal>
    </StyledContainer>
  );
}
