import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useTtsPlayer } from "../hooks/useTtsPlayer";
import { Colors } from "../components/styles";
import { Ionicons } from "@expo/vector-icons";
import {
  getCurrentUser,
  listSavedItems,
  removeSavedItem,
  updateSavedItemAudio,
  TTS_FUNCTION_URL,
  TTS_BUCKET_ID,
} from "../services/appwrite";

const { brand } = Colors;
export default function Listen({ route, navigation }) {
const textFromRoute = typeof route?.params?.text === "string" ? route.params.text : "";
const [localText, setLocalText] = useState("");
const text = localText || textFromRoute;
const title = route?.params?.title ?? "Library";
const hasText = typeof text === "string" && text.trim().length > 0;

  // Library state 
  const [me, setMe] = useState(null);
  const [loadingLib, setLoadingLib] = useState(false);
  const [libError, setLibError] = useState("");
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [currentItem, setCurrentItem] = useState(null);

  //load saved summaries
  async function loadLibrary() {
    setLoadingLib(true);
    setLibError("");
    try {
      const u = await getCurrentUser();
      setMe(u);
      const userId = u?.$id || u?.id;
      if (!userId) {
        setItems([]);
        return;
      }
      const docs = (await listSavedItems(userId)) || [];

const sorted = [...docs].sort(
  (a, b) => new Date(b.$createdAt) - new Date(a.$createdAt)
);
setItems(sorted);
    } catch (e) {
      setLibError(e?.message || "Failed to load library");
    } finally {
      setLoadingLib(false);
    }
  }

  useEffect(() => {
  if (!hasText) {
    loadLibrary();
  }
}, [hasText]);

useEffect(() => {
  return () => {
    stop();
  };
}, []);

useEffect(() => {
  const flag = route?.params?.autoMostRecent === true;
  const autoPlayFirstMatch = route?.params?.autoPlayFirstMatch === true;

  if (!flag) return;
  if (!items || items.length === 0) return;

  const mostRecent = items[0];
  if (!mostRecent?.summaryText) return;

  setCurrentItem(mostRecent);
  setLocalText(mostRecent.summaryText);

  if (autoPlayFirstMatch) {
    setTimeout(() => {
      playItemAudio(mostRecent);
    }, 250);
  }

  navigation.setParams({
    autoMostRecent: false,
    autoPlayFirstMatch: false,
  });
}, [
  route?.params?.autoMostRecent,
  route?.params?.autoPlayFirstMatch,
  items,
  hasText,
  navigation,
]);

useEffect(() => {
  const hasVoiceNavigation =
    route?.params?.autoMostRecent === true ||
    route?.params?.autoOpenFirstMatch === true ||
    route?.params?.autoPlayFirstMatch === true ||
    !!route?.params?.autoSearchText;

  if (!hasVoiceNavigation) return;

  setLocalText("");
  setCurrentItem(null);
}, [
  route?.params?.autoMostRecent,
  route?.params?.autoOpenFirstMatch,
  route?.params?.autoPlayFirstMatch,
  route?.params?.autoSearchText,
]);

useEffect(() => {
  const autoSearchText = route?.params?.autoSearchText || "";
  const autoOpenFirstMatch = route?.params?.autoOpenFirstMatch === true;
  const autoPlayFirstMatch = route?.params?.autoPlayFirstMatch === true;

  if (!autoOpenFirstMatch && !autoSearchText && !autoPlayFirstMatch) return;
  if (!items || items.length === 0) return;

  const query = normaliseVoiceSearch(autoSearchText);

 if ((autoOpenFirstMatch || autoPlayFirstMatch) && !query) {
  const firstItem = items[0];
  if (firstItem?.summaryText) {
    setCurrentItem(firstItem);
    setLocalText(firstItem.summaryText);

    if (autoPlayFirstMatch) {
      setTimeout(() => {
        playItemAudio(firstItem);
      }, 250);
    }
  }

  navigation.setParams({
    autoSearchText: "",
    autoOpenFirstMatch: false,
    autoPlayFirstMatch: false,
  });
  return;
}

  const ranked = items
    .map((item) => {
      const title = normaliseVoiceSearch(item?.title);
      const summaryText = normaliseVoiceSearch(item?.summaryText);
      const keywords = normaliseVoiceSearch(item?.keywords);
      const category = normaliseVoiceSearch(item?.category);

      let score = 0;

           const queryWithoutSummary = query.replace(/\bsaved summary\b|\bsummary\b/g, "").trim();

      if (title === query) score += 100;
      if (title.includes(query)) score += 60;
      if (query.split(" ").every((word) => title.includes(word))) score += 40;
      if (queryWithoutSummary && title.includes(queryWithoutSummary)) score += 35;
      if (
        queryWithoutSummary &&
        queryWithoutSummary.split(" ").every((word) => title.includes(word))
      ) {
        score += 25;
      }
      if (summaryText.includes(query)) score += 20;
      if (keywords.includes(query)) score += 15;
      if (category.includes(query)) score += 10;

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

    const bestMatch = ranked[0]?.item;
    const bestScore = ranked[0]?.score || 0;

if ((autoOpenFirstMatch || autoPlayFirstMatch) && bestMatch && bestScore >= 35 && bestMatch.summaryText) {
  setSearchQuery(autoSearchText);
  setCurrentItem(bestMatch);
  setLocalText(bestMatch.summaryText);

  if (autoPlayFirstMatch) {
    setTimeout(() => {
      playItemAudio(bestMatch);
    }, 250);
  }

  navigation.setParams({
    autoSearchText: "",
    autoOpenFirstMatch: false,
    autoPlayFirstMatch: false,
  });
  return;
}
   if (autoSearchText && (autoOpenFirstMatch || autoPlayFirstMatch)) {
    Alert.alert("No exact match found", "I couldn’t find a matching saved summary.");
  }

  setSearchQuery(autoSearchText);

  navigation.setParams({
    autoSearchText: "",
    autoOpenFirstMatch: false,
    autoPlayFirstMatch: false,
  });
}, [
  route?.params?.autoPlayFirstMatch,
  route?.params?.autoSearchText,
  route?.params?.autoOpenFirstMatch,
  items,
  hasText,
  navigation,
]);

  // Tts player 
 const { status, error, generateAndPlay, playParts, pause, resume, stop } = useTtsPlayer({
  ttsFunctionUrl:
    TTS_FUNCTION_URL || "https://697201a400145780b4c0.fra.appwrite.run",
  appwriteEndpoint: "https://fra.cloud.appwrite.io/v1",
  appwriteProjectId: "690bc577001de9633dc5",
  ttsBucketId: TTS_BUCKET_ID,
});

  const busy = status === "generating" || status === "downloading";

  const normaliseVoiceSearch = (value) =>
  typeof value === "string"
    ? value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
    : "";
  
  const norm = (v) => (typeof v === "string" ? v.toLowerCase().trim() : "");
// search and filter
const filteredItems = items.filter((it) => {
  const q = norm(searchQuery);
  const cat = norm(it.category);

  if (categoryFilter !== "all" && cat !== norm(categoryFilter)) return false;

  if (!q) return true;

  const hay = [it.title, it.summaryType, it.summaryText, it.category, it.keywords]
    .map(norm)
    .join(" ");

  return hay.includes(q);
});
// read saved audio parts
function getAudioParts(item) {
  try {
    const parsed = JSON.parse(item?.audioParts || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}
// save audio ids
async function persistAudioParts(item, parts) {
  const cleanParts = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (!item?.$id || cleanParts.length === 0) return;

  const firstFileId = cleanParts[0] || "";

  await updateSavedItemAudio(item.$id, {
    audioFileId: firstFileId,
    audioParts: cleanParts,
  });

  setItems((prev) =>
    prev.map((it) =>
      it.$id === item.$id
        ? {
            ...it,
            audioFileId: firstFileId,
            audioParts: JSON.stringify(cleanParts),
          }
        : it
    )
  );

  setCurrentItem((prev) =>
    prev?.$id === item.$id
      ? {
          ...prev,
          audioFileId: firstFileId,
          audioParts: JSON.stringify(cleanParts),
        }
      : prev
  );
}
// play new or saved audio
async function playItemAudio(item) {
  if (!item?.summaryText) return;

  const savedParts = getAudioParts(item);

  if (savedParts.length > 0) {
    await playParts(savedParts);
    return;
  }

  if (item?.audioFileId) {
    await playParts([item.audioFileId]);
    return;
  }

  await generateAndPlay(item.summaryText, {
    onPartsReady: async (parts) => {
      try {
        await persistAudioParts(item, parts);
      } catch (e) {
        console.log("save audio error", e);
      }
    },
  });
}

  // Library tab
if (!hasText) {
  const categories = ["all", "finance", "history", "study", "legal", "work", "personal"];

  const renderChip = (key) => {
    const active = categoryFilter === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setCategoryFilter(key)}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: active ? brand : "#F1F5F9",
          borderWidth: 1,
          borderColor: active ? brand : "#E2E8F0",
          marginRight: 8,
          marginBottom: 8,
        }}
      >
        <Text style={{ color: active ? "#fff" : "#0F172A", fontWeight: "800", fontSize: 12 }}>
          {key === "all" ? "All" : key.charAt(0).toUpperCase() + key.slice(1)}
        </Text>
      </TouchableOpacity>
    );
  };

    const renderItem = ({ item }) => {
    const hasAudio =
  getAudioParts(item).length > 0 ||
  (typeof item?.audioFileId === "string" && item.audioFileId.trim().length > 0);
    return (
        
     <TouchableOpacity
        onPress={() => {
  if (!item?.summaryText) return;
  setCurrentItem(item);
  setLocalText(item.summaryText);
}}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          padding: 14,
          marginBottom: 12,
        }}
        activeOpacity={0.9}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: "#EEF2FF",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Ionicons name="bookmark-outline" size={18} color={brand} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "900", color: "#0F172A" }} numberOfLines={1}>
              {item?.title || "Saved summary"}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
              {!!item?.category && (
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: "#F1F5F9",
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                    marginRight: 8,
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A" }}>
                    {String(item.category).charAt(0).toUpperCase() + String(item.category).slice(1)}
                  </Text>
                </View>
              )}

              {!!item?.summaryType && (
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: "#EEF2FF",
                    borderWidth: 1,
                    borderColor: "#C7D2FE",
                    marginRight: 8,
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "900", color: brand }}>
                    {String(item.summaryType).toUpperCase()}
                  </Text>
                </View>
              )}

              {hasAudio && (
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: "#ECFDF5",
                    borderWidth: 1,
                    borderColor: "#A7F3D0",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "900", color: "#065F46" }}>AUDIO</Text>
                </View>
              )}
            </View>

            {!!item?.summaryText && (
              <Text style={{ marginTop: 8, color: "#475569", lineHeight: 20 }} numberOfLines={3}>
                {item.summaryText}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => {
              Alert.alert("Remove", "Remove this item from your Library?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await removeSavedItem(item.$id);
                      await loadLibrary();
                    } catch (e) {
                      Alert.alert("Remove failed", e?.message || "Could not remove item.");
                    }
                  },
                },
              ]);
            }}
            style={{ paddingLeft: 10, paddingTop: 4 }}
          >
            <Ionicons name="trash-outline" size={18} color="#B91C1C" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => {
  if (!item?.summaryText) return;
  setCurrentItem(item);
  setLocalText(item.summaryText);
}}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: "#F1F5F9",
              borderWidth: 1,
              borderColor: "#E2E8F0",
              alignItems: "center",
              marginRight: 10,
            }}
          >
            <Text style={{ fontWeight: "900", color: "#0F172A" }}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
            if (!item?.summaryText) return;
            setCurrentItem(item);
            setLocalText(item.summaryText);
            await playItemAudio(item);
        }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: brand,
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            }}
            disabled={busy}
          >
            <Text style={{ fontWeight: "900", color: "#fff" }}>
              {busy ? "Loading…" : "Play"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlatList
        data={filteredItems}
        keyExtractor={(it) => it.$id || String(it.docId || it.title || Math.random())}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loadingLib} onRefresh={loadLibrary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
        ListHeaderComponent={
         <View style={{ marginBottom: 14 }}>
  <Text style={{ fontSize: 28, fontWeight: "900", color: "#0F172A" }}>Library</Text>
  <Text style={{ marginTop: 6, color: "#64748B", lineHeight: 20 }}>
    Saved summaries you can open, play again, and revisit anytime.
  </Text>

 {!!libError && (
    <Text style={{ marginTop: 10, color: "#B91C1C", fontWeight: "800" }}>
      {libError}
    </Text>
  )}

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F1F5F9",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                borderRadius: 14,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search saved summaries…"
                placeholderTextColor="#94A3B8"
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: "#0F172A" }}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 6 }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap" }}>
              {categories.map(renderChip)}
            </View>
          </View>
        }
        ListEmptyComponent={
         <View
  style={{
    marginTop: 44,
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  }}
>
  <View
    style={{
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: "#EEF2FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    }}
  >
    <Ionicons name="library-outline" size={24} color={brand} />
  </View>
  <Text style={{ fontSize: 17, fontWeight: "900", color: "#0F172A" }}>
    No saved summaries yet
  </Text>
  <Text style={{ marginTop: 8, color: "#64748B", textAlign: "center", lineHeight: 21 }}>
    Save a summary from Documents and it will appear here for quick playback and view
  </Text>
</View>
        }
      />
    </SafeAreaView>
  );
}

  // Player mode 
  return (
   <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
  <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 28 }}>
   
<View
  style={{
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  }}
>
  <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B" }}>
    SAVED SUMMARY
  </Text>

  <Text
    style={{
      marginTop: 6,
      fontSize: 24,
      fontWeight: "900",
      color: "#0F172A",
      lineHeight: 30,
    }}
  >
    {currentItem?.title || title}
  </Text>

  <TouchableOpacity
    onPress={() => {
      setLocalText("");
      setCurrentItem(null);
      stop();
    }}
    style={{
      marginTop: 14,
      alignSelf: "flex-start",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: "#F8FAFC",
      borderWidth: 1,
      borderColor: "#E2E8F0",
    }}
  >
    <Text style={{ fontWeight: "800", color: "#0F172A" }}>Back to Library</Text>
  </TouchableOpacity>
</View>

<View
  style={{
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  }}
>
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: "rgba(79,70,229,0.10)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
      }}
    >
      <Ionicons
        name={status === "playing" ? "volume-high-outline" : "document-text-outline"}
        size={18}
        color={brand}
      />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B" }}>
        {status === "playing" || status === "paused" ? "NOW PLAYING" : "READY TO PLAY"}
      </Text>
      <Text style={{ marginTop: 2, fontSize: 15, fontWeight: "800", color: "#0F172A" }}>
        {status === "playing"
          ? "Audio is playing"
          : status === "paused"
          ? "Playback paused"
          : "Saved summary loaded"}
      </Text>
    </View>
  </View>

  <Text style={{ fontSize: 13, fontWeight: "800", color: "#64748B" }}>
    Summary text
  </Text>

  <Text style={{ marginTop: 10, color: "#0F172A", lineHeight: 22, fontSize: 15 }}>
    {text}
  </Text>
</View>

        {busy && (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
      marginBottom: 4,
      backgroundColor: "#EEF2FF",
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#C7D2FE",
    }}
  >
    <ActivityIndicator color={brand} />
    <Text style={{ marginLeft: 10, color: "#3730A3", fontWeight: "700" }}>
      {status === "generating" ? "Generating audio..." : "Downloading audio..."}
    </Text>
  </View>
)}

        {error ? <Text style={{ color: "red", marginTop: 8 }}>{error}</Text> : null}

       <View style={{ marginTop: 16 }}>
  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
    <TouchableOpacity
      onPress={async () => {
        if (currentItem) {
          await playItemAudio(currentItem);
        } else {
          await generateAndPlay(text);
        }
      }}
      disabled={busy || status === "playing"}
      style={{
        flex: 1,
        minWidth: 110,
        paddingVertical: 13,
        paddingHorizontal: 16,
        backgroundColor: busy || status === "playing" ? "#CBD5E1" : brand,
        borderRadius: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900" }}>
        {busy ? "Loading…" : "Play"}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={() => {
        if (status === "paused") resume();
        else pause();
      }}
      disabled={!(status === "playing" || status === "paused")}
      style={{
        flex: 1,
        minWidth: 110,
        paddingVertical: 13,
        paddingHorizontal: 16,
        backgroundColor: "#0F172A",
        borderRadius: 14,
        alignItems: "center",
        opacity: status === "playing" || status === "paused" ? 1 : 0.4,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900" }}>
        {status === "paused" ? "Resume" : "Pause"}
      </Text>
    </TouchableOpacity>
  </View>

  <TouchableOpacity
    onPress={stop}
    disabled={!(status === "playing" || status === "paused")}
    style={{
      marginTop: 10,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: "#F1F5F9",
      borderWidth: 1,
      borderColor: "#E2E8F0",
      alignItems: "center",
      opacity: status === "playing" || status === "paused" ? 1 : 0.5,
    }}
  >
    <Text style={{ color: "#0F172A", fontWeight: "900" }}>Stop</Text>
  </TouchableOpacity>
</View>

      </ScrollView>
    </SafeAreaView>
  );
}
