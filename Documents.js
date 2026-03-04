// screens/Documents.js
import React, { useEffect, useState, useCallback } from 'react';
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
  StyleSheet,
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
import { saveToLibrary, getDocumentById } from "../services/appwrite";

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
      return { label: 'Other', bg: '#64748B' };
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

/* ─component ─*/

export default function Documents({ onBack }) {
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

const onAutoTag = async (doc, options = {}) => {
  const silent = options?.silent === true;
  const docId = doc?.$id;

  if (!docId) {
    Alert.alert("Tagging failed", "Missing document id.");
    return;
  }

  try {
    setTaggingId(docId);

    const hasText = (doc?.textContent || "").trim().length > 0;
    if (!hasText) {
      await callExtractTextFunction(doc);
    }

    const latestDoc = await getDocumentById(docId);
    await callTagFunction(latestDoc);

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

const autoCategoriseSilently = (doc) => {
  onAutoTag(doc, { silent: true });
};

  // Viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerType, setViewerType] = useState('pdf');
  const [kwEditId, setKwEditId] = useState(null);
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

  const createdDoc = await uploadUserDoc(userId, {
  uri: asset.uri,
  name: asset.name || "document",
  type: asset.mimeType || "application/octet-stream",
  size: asset.size || 0,
});

autoCategoriseSilently(createdDoc);

await load();
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

  const createdDoc = await uploadUserDoc(userId, {
  uri: asset.uri,
  name: `Photo_${Date.now()}.jpg`,
  type: asset.mimeType || "image/jpeg",
  size: asset.fileSize || 0,
});

autoCategoriseSilently(createdDoc);

await load();

    } catch (e) {
      console.log('take photo error', e);
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    }
  };

  /* ─ open file ─ */

  const onOpen = async (doc) => {
    try {
      const type = deriveType(doc);
      const url = getFileDownloadUrl(doc.fileId);
      if (!url) throw new Error('Invalid file URL.');

      setViewerTitle(doc.title || 'File');
      setViewerVisible(true);
      setViewerLoading(true);

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

      const arrayBuffer = await resp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      const name = (doc.title || '').toLowerCase();
      const mime = (doc.mimeType || '').toLowerCase();

      let ext = '';
      if (mime.includes('pdf') || name.endsWith('.pdf')) ext = '.pdf';
      else if (mime.startsWith('image/')) {
        if (mime.includes('png') || name.endsWith('.png')) ext = '.png';
        else ext = '.jpg';
      } else if (mime.includes('word') || name.endsWith('.docx')) ext = '.docx';
      else if (name.includes('.')) ext = name.slice(name.lastIndexOf('.'));
      else ext = '';

      const safeId = (doc.fileId || doc.$id).replace(/[^a-zA-Z0-9_-]/g, '');
      const localPath = `${FileSystem.cacheDirectory}execudoc_${safeId}${ext}`;

      await FileSystem.writeAsStringAsync(localPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

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

 const onSummarise = async (doc, mode = "short") => {
  const isDetailed = mode === "detailed";
  try {
    setSummarisingId(doc.$id);

    // Cache check sono API call if already saved
    const cache = readTtsCache(doc);

    // short mode
if (!isDetailed) {
 
  const existingShort = (doc.summary || "").trim();
      if (existingShort) {
      Alert.alert("AI Summary (Short)", existingShort, [
  {
    text: "Listen",
    onPress: () => {
  setTtsText(existingShort);
  setTtsContext({ docId: doc.$id, mode: "summary", variant: "short" });
  setTtsVisible(true);
},
  },
  {
    text: "Save to Library",
    onPress: async () => {
      try {
       await saveToLibrary({
  userId,
  docId: doc.$id,
  title: doc.title,
  summaryType: "short",
  summaryText: existingShort,
  audioFileId: "",
  category: doc.category || "",
keywords: doc.keywords || "",
});
        Alert.alert("Saved", "Short summary saved to your Library.");
      } catch (e) {
        Alert.alert("Save failed", e?.message || "Could not save summary.");
      }
    },
  },
  { text: "OK", style: "default" },
]);

        return;
      }
    }

    // Detailed mode
if (isDetailed) {
  const existingDetailed = (cache.summaryDetailedText || "").trim();
  if (existingDetailed) {
    Alert.alert("AI Summary (Detailed)", existingDetailed, [
      {
        text: "Listen",
        onPress: () => {
          setTtsText(existingDetailed);
          setTtsContext({ docId: doc.$id, mode: "summary", variant: "detailed" });
          setTtsVisible(true);
        },
      },
      { text: "OK", style: "default" },
    ]);
    return;
  }
}

    // Not cached, so call function 
    const result = await callSummariseFunction(doc);

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

      Alert.alert("AI Summary (Short)", newSummary, [
        {
          text: "Listen",
          onPress: () => {
            setTtsText(newSummary);
            setTtsContext({ docId: doc.$id, mode: "summary", variant: "short" });
            setTtsVisible(true);
          },
        },
        { text: "OK", style: "default" },
      ]);
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

      Alert.alert("AI Summary (Detailed)", newSummary, [
        {
          text: "Listen",
          onPress: () => {
            setTtsText(newSummary);
            setTtsContext({ docId: doc.$id, mode: "summary", variant: "detailed" });
            setTtsVisible(true); 
          },
        },
        { text: "OK", style: "default" },
      ]);
    }

    await load();
  } catch (e) {
    console.log("summarise error", e);
    Alert.alert("Summarise failed", e?.message || "Try again later.");
  } finally {
    setSummarisingId(null);
  }
};


  /* ─Listen full doc auto extract ─*/

const onListenDoc = async (doc) => {
  try {
    const existing = (doc.textContent || "").trim();
    if (existing) {
      setTtsText(existing);
      setTtsContext({ docId: doc.$id, mode: "doc" });
      setTtsVisible(true);
      return;
    }

    Alert.alert(
      "Preparing audio",
      "No text extracted yet — extracting text now. This can take a few seconds…"
    );

    // Calls extractDocumentText
    const result = await callExtractTextFunction(doc);

    // If the function returns text immediately, use it
    const returnedText =
      (result?.textContent || result?.extractedText || result?.text || "").trim();

    if (returnedText) {
      setTtsText(returnedText);
      setTtsContext({ docId: doc.$id, mode: "doc" });
      setTtsVisible(true);
      return;
    }

    // Otherwise re-fetch docs and read textContent from DB
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

    setTtsText(finalText);
    setTtsContext({ docId: doc.$id, mode: "doc" });
    setTtsVisible(true);
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
        onPress: async () => {
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

  const CATEGORY_PRESETS = ["work", "study", "legal", "finance", "personal", "history", "other"];

const normaliseCategory = (value) => {
  const v = (value || "").trim().toLowerCase();
  return v;
};

const getFolderCards = () => {
  const counts = {};

  for (const d of files) {
    const c = normaliseCategory(d.category);
    const key = c || "uncategorised";
    counts[key] = (counts[key] || 0) + 1;
  }

  const cards = [{ key: "all", label: "All", count: files.length }];

  for (const c of CATEGORY_PRESETS) {
    const count = counts[c] || 0;
    if (count > 0) cards.push({ key: c, label: c, count });
  }

  const unc = counts["uncategorised"] || 0;
  if (unc > 0) cards.push({ key: "uncategorised", label: "Uncategorised", count: unc });

  return cards;
};

const folderCards = getFolderCards();

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

  const FolderCard = ({ item }) => {
  const selected = selectedCategory === item.key;

  return (
    <TouchableOpacity
      onPress={() => setSelectedCategory(item.key)}
      activeOpacity={0.85}
      style={{
        width: "48%",
        padding: 14,
        borderRadius: 16,
        backgroundColor: selected ? "#EEF2FF" : "#FFFFFF",
        borderWidth: 1,
        borderColor: selected ? brand : "#E5E7EB",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            width: 38,
            height: 38,
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

      <Text style={{ marginTop: 10, fontSize: 15, fontWeight: "900", color: "#0F172A" }}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
};
 
const Item = ({ item }) => {
  const type = deriveType(item);
  const { label, bg } = typeLabelAndColor(type);

  const categoryText = (normaliseCategory(item.category) || "uncategorised")
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
  <View
    style={{
      width: "100%",
      backgroundColor: "#F5F7FB",
      padding: 14,
      borderRadius: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    }}
  >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <TouchableOpacity
          onPress={() => onOpen(item)}
          style={{ flex: 1, paddingRight: 10 }}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontWeight: "800", flex: 1 }} numberOfLines={1}>
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
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                {label}
              </Text>
            </View>
          </View>

          <Text style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }} numberOfLines={1}>
            {categoryText}
          </Text>

          {!!item.summary && (
            <Text style={{ marginTop: 8, color: "#4B5563" }} numberOfLines={2}>
              {item.summary}
            </Text>
          )}
        </TouchableOpacity>

     <TouchableOpacity
  onPress={() => openMenu(item)}
  style={{
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
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


  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <InnerContainer style={{ width: '100%' }}>
        <PageTitle style={{ textAlign: 'center' }}>Documents</PageTitle>
        <SubTitle style={{ textAlign: 'center', marginBottom: 12 }}>Your uploaded files</SubTitle>

        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <TouchableOpacity
            onPress={onUploadFile}
            style={{ flex: 1, backgroundColor: brand, padding: 10, borderRadius: 12, marginRight: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Upload File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onTakePhoto}
            style={{ flex: 1, backgroundColor: '#8B5CF6', padding: 10, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {msg ? <Text style={{ marginBottom: 10, color: '#6B7280' }}>{msg}</Text> : null}

        <Line />

   <FlatList
  data={filteredFiles}
  keyExtractor={(item) => item.$id}
  renderItem={({ item }) => <Item item={item} />}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
  style={{ flex: 1 }}
  ListHeaderComponent={
    <View>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search documents..."
        placeholderTextColor="#9CA3AF"
        style={{
          width: "100%",
          backgroundColor: "#F3F4F6",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginTop: 14,
          marginBottom: 12,
        }}
      />
      
      {selectedCategory ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "#F1F5F9",
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text style={{ fontWeight: "800" }}>All folders</Text>
          </TouchableOpacity>

          <Text style={{ color: "#6B7280", fontWeight: "700" }}>
            {(selectedCategory || "").toString().toUpperCase()}
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
        padding: 16,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
    <View style={{ paddingBottom: 10 }}>
  <Text style={{ fontSize: 16, fontWeight: "900" }} numberOfLines={1}>
    {menuDoc?.title || "Document"}
  </Text>
  <Text style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }} numberOfLines={1}>
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
      paddingVertical: 12,
      borderTopWidth: idx === 0 ? 1 : 0,
      borderTopColor: "#F1F5F9",
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
          marginTop: 10,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: "#F1F5F9",
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 10 }}>
              {ttsContext?.mode === 'doc' ? 'Document' : 'Summary'}
            </Text>

            <ScrollView style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 15, lineHeight: 21 }}>{ttsText}</Text>
            </ScrollView>

            {ttsBusy && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <ActivityIndicator />
                <Text>{ttsStatus === 'generating' ? 'Generating audio…' : 'Downloading audio…'}</Text>
              </View>
            )}

            {!!ttsError && <Text style={{ color: 'red', marginBottom: 10 }}>{ttsError}</Text>}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
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
                  padding: 12,
                  backgroundColor: ttsBusy ? '#ccc' : '#111',
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: '#fff' }}>Listen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={ttsStatus === 'paused' ? resume : pause}
                disabled={!(ttsStatus === 'playing' || ttsStatus === 'paused')}
                style={{
                  padding: 12,
                  backgroundColor: '#333',
                  borderRadius: 10,
                  opacity: ttsStatus === 'playing' || ttsStatus === 'paused' ? 1 : 0.4,
                }}
              >
                <Text style={{ color: '#fff' }}>
                  {ttsStatus === 'paused' ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={stop}
                disabled={!(ttsStatus === 'playing' || ttsStatus === 'paused')}
                style={{
                  padding: 12,
                  backgroundColor: '#333',
                  borderRadius: 10,
                  opacity: ttsStatus === 'playing' || ttsStatus === 'paused' ? 1 : 0.4,
                }}
              >
                <Text style={{ color: '#fff' }}>Stop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  stop();
                  setTtsVisible(false);
                }}
                style={{ padding: 12, backgroundColor: '#eee', borderRadius: 10 }}
              >
                <Text>Close</Text>
              </TouchableOpacity>
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
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading…</Text>
            </View>
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
