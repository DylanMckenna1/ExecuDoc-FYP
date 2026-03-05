 import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useTtsPlayer } from "../hooks/useTtsPlayer";
import { Colors } from "../components/styles";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser, listSavedItems, removeSavedItem } from "../services/appwrite";

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
  const flag = route?.params?.autoMostRecent === true;
  if (!flag) return;
  if (!items || items.length === 0) return;

  const mostRecent = items[0];
  if (!mostRecent?.summaryText) return;

  setLocalText(mostRecent.summaryText);
  navigation.setParams({ autoMostRecent: false });
}, [route?.params?.autoMostRecent, items]);

  // Tts player 
  const { status, error, generateAndPlay, pause, resume, stop } = useTtsPlayer({
    ttsFunctionUrl:
      process.env.EXPO_PUBLIC_TTS_FUNCTION_URL ||
      "https://697201a400145780b4c0.fra.appwrite.run",
    appwriteEndpoint: "https://fra.cloud.appwrite.io/v1",
    appwriteProjectId: "690bc577001de9633dc5",
    ttsBucketId: "6972be01002bee843a33",
  });

  const busy = status === "generating" || status === "downloading";
  

  const norm = (v) => (typeof v === "string" ? v.toLowerCase().trim() : "");

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
    const hasAudio = typeof item?.audioFileId === "string" && item.audioFileId.trim().length > 0;

    return (
      <TouchableOpacity
        onPress={() => {
          if (item?.summaryText) setLocalText(item.summaryText);
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
            onPress={() => {
              if (!item?.summaryText) return;
              generateAndPlay(item.summaryText);
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
        keyExtractor={(it) => it.$id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loadingLib} onRefresh={loadLibrary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0F172A" }}>Library</Text>
            <Text style={{ marginTop: 6, color: "#64748B", lineHeight: 20 }}>
              Saved summaries (and audio when available).
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
              marginTop: 40,
              alignItems: "center",
              padding: 18,
              borderRadius: 18,
              backgroundColor: "#F8FAFC",
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: "#EEF2FF",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons name="library-outline" size={22} color={brand} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#0F172A" }}>
              No saved items yet
            </Text>
            <Text style={{ marginTop: 6, color: "#64748B", textAlign: "center", lineHeight: 20 }}>
              Save a summary from Documents and it will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

  // Player mode 
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 10 }}>
     <Text style={{ fontSize: 22, fontWeight: "800", color: "#0F172A" }}>
  {title}
</Text>

<TouchableOpacity
  onPress={() => setLocalText("")}
  style={{
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  }}
>
  <Text style={{ fontWeight: "800", color: "#0F172A" }}>Back to Library</Text>
</TouchableOpacity>

        {busy && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 6 }}>
            <ActivityIndicator />
            <Text style={{ marginLeft: 10, color: "#334155" }}>
              {status === "generating" ? "Generating audio..." : "Downloading audio..."}
            </Text>
          </View>
        )}

        {error ? <Text style={{ color: "red", marginTop: 8 }}>{error}</Text> : null}

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <TouchableOpacity
            onPress={() => generateAndPlay(text)}
            disabled={busy}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: busy ? "#CBD5E1" : brand,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {status === "idle" || status === "error" ? "Listen" : "Regenerate + Play"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={status === "paused" ? resume : pause}
            disabled={!(status === "playing" || status === "paused")}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: "#0F172A",
              borderRadius: 12,
              opacity: status === "playing" || status === "paused" ? 1 : 0.4,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {status === "paused" ? "Resume" : "Pause"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={stop}
            disabled={!(status === "playing" || status === "paused")}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: "#0F172A",
              borderRadius: 12,
              opacity: status === "playing" || status === "paused" ? 1 : 0.4,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Stop</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
