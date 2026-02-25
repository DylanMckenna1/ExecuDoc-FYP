 import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import { useTtsPlayer } from "../hooks/useTtsPlayer";
import { Colors } from "../components/styles";
import { getCurrentUser, listSavedItems, removeSavedItem } from "../services/appwrite";

const { brand } = Colors;

export default function Listen({ route, navigation }) {
  const textFromRoute = route?.params?.text ?? "";
const [localText, setLocalText] = useState("");
const text = localText || textFromRoute;
  const title = route?.params?.title ?? "Library";

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
      const docs = await listSavedItems(userId);

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
    const hasText = typeof text === "string" && text.trim().length > 0;
    if (!hasText) loadLibrary();
  }, [text]);

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
  const hasText = typeof text === "string" && text.trim().length > 0;

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
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#0F172A" }}>
            Library
          </Text>
          <Text style={{ marginTop: 6, color: "#64748B", lineHeight: 20 }}>
            Your saved summaries and audio will show here.
          </Text>

         <TouchableOpacity
  onPress={loadLibrary}
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
  <Text style={{ fontWeight: "800", color: "#0F172A" }}>Refresh</Text>
</TouchableOpacity>
{filteredItems.length > 0 && (
  <TouchableOpacity
    onPress={() => {
      const mostRecent = filteredItems[0];
      if (!mostRecent.summaryText) return;
      setLocalText(mostRecent.summaryText);
    }}
    style={{
      marginTop: 10,
      alignSelf: "flex-start",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: brand,
    }}
  >
    <Text style={{ color: "#fff", fontWeight: "800" }}>
      Open Most Recent
    </Text>
  </TouchableOpacity>
)}

<TextInput
  value={searchQuery}
  onChangeText={setSearchQuery}
  placeholder="Search library..."
  placeholderTextColor="#94A3B8"
  style={{
    marginTop: 12,
    width: "100%",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    color: "#0F172A",
  }}
/>

<View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
  {["all", "finance", "history", "study", "legal", "work", "personal"].map((c) => {
    const active = categoryFilter === c;
    return (
      <TouchableOpacity
        key={c}
        onPress={() => setCategoryFilter(c)}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: active ? brand : "#F1F5F9",
          borderWidth: 1,
          borderColor: active ? brand : "#E2E8F0",
        }}
      >
        <Text style={{ color: active ? "#fff" : "#0F172A", fontWeight: "800" }}>
          {c === "all" ? "All" : c}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>

{loadingLib ? (
  <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center" }}>
    <ActivityIndicator />
    <Text style={{ marginLeft: 10, color: "#334155" }}>Loading...</Text>
  </View>
) : null}

          {libError ? (
            <Text style={{ color: "red", marginTop: 10 }}>{libError}</Text>
          ) : null}

        {!loadingLib && filteredItems.length === 0 ? (
            <View
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#F1F5F9",
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            >
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                Nothing saved yet
              </Text>
              <Text style={{ marginTop: 6, color: "#64748B", lineHeight: 20 }}>
                Save a summary or audio from Documents to see it here.
              </Text>
            </View>
          ) : null}

          <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 30 }}>
                        {filteredItems.map((it) => {
              const label = `${it.summaryType || "summary"} • ${it.title || "Untitled"}`;
              const preview = (it.summaryText || "").slice(0, 120);

              return (
                <View
                  key={it.$id}
                  style={{
                    marginBottom: 10,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#0F172A" }}>{label}</Text>
                  {preview ? (
                    <Text style={{ marginTop: 6, color: "#64748B", lineHeight: 20 }}>
                      {preview}{preview.length >= 120 ? "…" : ""}
                    </Text>
                  ) : null}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <TouchableOpacity
                  onPress={() => {
  if (!it.summaryText) {
    Alert.alert(
      "Nothing to open",
      "This saved item has no summary text stored. Delete it and re-save after summarising."
    );
    return;
  }
  setLocalText(it.summaryText);
}}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: brand,
                      }}
                      disabled={!it.summaryText}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900" }}>
                        Open
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Remove from Library?",
                          "This only removes the saved item (it won't delete your document).",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: async () => {
                                try {
                                  await removeSavedItem(it.$id);
                                  await loadLibrary();
                                } catch (e) {
                                  Alert.alert("Failed", e?.message || "Could not remove item.");
                                }
                              },
                            },
                          ]
                        );
                      }}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: "#0F172A",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900" }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
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
