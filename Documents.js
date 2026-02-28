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
import { saveToLibrary } from '../services/appwrite';

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

  
  const onAutoTag = async (doc) => {
  try {
    const hasText = (doc.textContent || "").trim().length > 0;
    if (!hasText) {
      await callExtractTextFunction(doc);
    }

    await callTagFunction(doc);

    await load();
    Alert.alert("Tagged", "Category and keywords updated.");
  } catch (e) {
    Alert.alert("Auto-tag failed", e?.message || "Try again later.");
  }
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

      await uploadUserDoc(userId, {
        uri: asset.uri,
        name: asset.name || 'document',
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      });

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
        mediaTypes: ImagePicker.MediaType.IMAGE,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      await uploadUserDoc(userId, {
        uri: asset.uri,
        name: `Photo_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        size: asset.fileSize || 0,
      });

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

 const filteredFiles = files
  .filter((doc) => {
    if (filter === 'all') return true;
    const t = deriveType(doc);
    if (filter === 'pdf') return t === 'pdf';
    if (filter === 'image') return t === 'image';
    if (filter === 'other') return t === 'other';
    return true;
  })
  .filter((doc) => {
    const q = searchQuery.trim().toLowerCase();
if (!q) return true;

const title = (doc.title || "").toLowerCase();
return title.includes(q);

  });

  const Item = ({ item }) => {
    const type = deriveType(item);
    const { label, bg } = typeLabelAndColor(type);
    const isSummarising = summarisingId === item.$id;

    return (
      <View style={{ backgroundColor: '#F5F7FB', padding: 16, borderRadius: 14, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{label}</Text>
          </View>
        </View>

        {!!item.summary && (
          <Text numberOfLines={4} style={{ marginTop: 6, color: '#4B5563' }}>
            {item.summary}
          </Text>
        )}
{/* Category + Keywords */}
<View style={{ marginTop: 8 }}>
  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
    Category: {item.category || "None"}
  </Text>

  {/* Category chips */}
  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
    {["finance", "history", "study", "legal", "work", "personal"].map((c) => {
      const active = item.category === c;

      return (
        <TouchableOpacity
          key={c}
          onPress={async () => {
            try {
              await updateDocFields(item.$id, { category: c });
              await load();
            } catch (e) {
              Alert.alert("Update failed", "Could not set category.");
            }
          }}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: active ? brand : "#F1F5F9",
            borderWidth: 1,
            borderColor: active ? brand : "#E2E8F0",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: active ? "#fff" : "#111827",
              fontWeight: "700",
            }}
          >
            {c}
          </Text>
        </TouchableOpacity>
      );
    })}

    {/* Clear button */}
    <TouchableOpacity
      onPress={async () => {
        try {
          await updateDocFields(item.$id, { category: "" });
          await load();
        } catch {
          Alert.alert("Update failed", "Could not clear category.");
        }
      }}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827" }}>
        Clear
      </Text>
    </TouchableOpacity>
  </View>

  {/* Keywords editor */}
  <View style={{ marginTop: 10 }}>
    {kwEditId === item.$id ? (
      <View style={{ gap: 8 }}>
        <TextInput
          value={kwValue}
          onChangeText={setKwValue}
          placeholder="Keywords (comma separated)"
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

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={async () => {
              try {
                await updateDocFields(item.$id, { keywords: kwValue });
                setKwEditId(null);
                setKwValue("");
                await load();
              } catch {
                Alert.alert("Update failed", "Could not save keywords.");
              }
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: brand,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setKwEditId(null);
              setKwValue("");
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: "#F1F5F9",
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text style={{ color: "#0F172A", fontWeight: "800" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      <TouchableOpacity
        onPress={() => {
          setKwEditId(item.$id);
          setKwValue(item.keywords || "");
        }}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: "#F1F5F9",
          borderWidth: 1,
          borderColor: "#E2E8F0",
        }}
      >
        <Text style={{ color: "#0F172A", fontWeight: "800" }}>
          {item.keywords ? "Edit keywords" : "Add keywords"}
        </Text>
      </TouchableOpacity>
    )}

    {!!item.keywords && (
      <Text style={{ marginTop: 6, color: "#4B5563" }}>
        Keywords: {item.keywords}
      </Text>
    )}
  </View>
</View>
        <View style={{ flexDirection: 'row', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            onPress={() => onOpen(item)}
            style={{ backgroundColor: brand, padding: 8, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff' }}>Open</Text>
          </TouchableOpacity>

         <TouchableOpacity
          onPress={() => openSummaryPicker(item)}
            disabled={isSummarising}
            style={{
              backgroundColor: isSummarising ? '#A5B4FC' : '#4F46E5',
              padding: 8,
              borderRadius: 8,
              opacity: isSummarising ? 0.85 : 1,
            }}
          >
            <Text style={{ color: '#fff' }}>
              {isSummarising ? 'Summarising…' : 'Summarise'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onListenDoc(item)}
            style={{ backgroundColor: '#059669', padding: 8, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff' }}>Listen</Text>
     </TouchableOpacity>

             <TouchableOpacity
            onPress={() => onAutoTag(item)}
            style={{ backgroundColor: "#0F172A", padding: 8, borderRadius: 8 }}
          >
            <Text style={{ color: "#fff" }}>Auto-tag</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onDelete(item)}
            style={{ backgroundColor: '#111827', padding: 8, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff' }}>Delete</Text>
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

<TextInput
  value={searchQuery}
  onChangeText={setSearchQuery}
  placeholder="Search documents..."
  placeholderTextColor="#9CA3AF"
  style={{
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 12,
  }}
/>

    <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.$id}
          renderItem={({ item }) => <Item item={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 12 }}
        />

        <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
          <Text style={{ color: brand, textAlign: 'center' }}>Back</Text>
        </TouchableOpacity>
      </InnerContainer>

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
