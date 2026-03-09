import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

export default function Assistant({ navigation }) {

  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");

  const startRecording = async () => {
    try {

      // request permission for microphone access
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        alert("Microphone permission required");
        return;
      }

      // configure recording settings
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setStatus("listening");

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);

    } catch (err) {
      console.log("recording error", err);
    }
  };

  const stopRecording = async () => {
    try {

      setStatus("processing");

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      setRecording(null);

      // temporary placeholder until i wire transcription
      setTranscript("Processing voice command...");

    } catch (err) {
      console.log("stop recording error", err);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >

      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 20 }}>
        Voice Assistant
      </Text>

      <TouchableOpacity
        onPress={recording ? stopRecording : startRecording}
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "#4F46E5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={recording ? "stop" : "mic"}
          size={32}
          color="#fff"
        />
      </TouchableOpacity>

      <View style={{ marginTop: 30, alignItems: "center" }}>

        {status === "listening" && (
          <Text style={{ color: "#64748B" }}>
            Listening...
          </Text>
        )}

        {status === "processing" && (
          <ActivityIndicator />
        )}

        {transcript ? (
          <Text style={{ marginTop: 10, textAlign: "center" }}>
            {transcript}
          </Text>
        ) : null}

      </View>

    </View>
  );
}