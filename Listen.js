import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTtsPlayer } from "../hooks/useTtsPlayer";
import { Colors } from "../components/styles";

const { brand } = Colors;

export default function Listen({ route }) {
  const text = route?.params?.text ?? "";
  const title = route?.params?.title ?? "Library";

  // TTS config 
  const {
    status,
    error,
    generateAndPlay,
    pause,
    resume,
    stop,
  } = useTtsPlayer({
    ttsFunctionUrl:
      process.env.EXPO_PUBLIC_TTS_FUNCTION_URL ||
      "https://697201a400145780b4c0.fra.appwrite.run",
    appwriteEndpoint: "https://fra.cloud.appwrite.io/v1",
    appwriteProjectId: "690bc577001de9633dc5",
    ttsBucketId: "6972be01002bee843a33",
  });

  const busy = status === "generating" || status === "downloading";
  const hasText = typeof text === "string" && text.trim().length > 0;

  // Tab open =Library placeholder
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
              Nothing saved yet.
          </Text>
     </View>
        </View>
      </SafeAreaView>
    );
  }

  // If text IS provided navigated here intentionally, show player UI
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#0F172A" }}>
          {title}
        </Text>

        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 14,
            backgroundColor: "#F8FAFC",
            borderWidth: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <Text style={{ color: "#0F172A", lineHeight: 20 }}>{text}</Text>
        </View>

        {busy && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            <ActivityIndicator />
            <Text style={{ marginLeft: 10, color: "#334155" }}>
              {status === "generating"
                ? "Generating audio..."
                : "Downloading audio..."}
            </Text>
          </View>
        )}

        {error ? (
          <Text style={{ color: "red", marginTop: 8 }}>{error}</Text>
        ) : null}

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
