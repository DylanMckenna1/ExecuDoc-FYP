import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { transcribeAudio } from "../services/transcribeVoice";

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
  setStatus("idle");
}
  };

 const stopRecording = async () => {
  if (!recording) return;

  try {
    setStatus("transcribing");

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    setRecording(null);

    if (!uri) {
      setTranscript("I couldn't hear anything. Please try again.");
      setStatus("idle");
      return;
    }

    const transcriptText = await transcribeAudio(uri);

    if (!transcriptText || typeof transcriptText !== "string") {
      setTranscript("I couldn't understand that. Please try again.");
      setStatus("idle");
      return;
    }

   setTranscript(transcriptText);
   setStatus("processing");
   handleVoiceCommand(transcriptText);
  } catch (err) {
    console.log("stop recording error", err);
    setTranscript("Something went wrong. Please try again.");
    setStatus("idle");
    setRecording(null);
  }
};

const getCommandAction = (text) => {
  const command = typeof text === "string" ? text.toLowerCase().trim() : "";

  if (!command) return null;

  if (
    command.includes("open recent document") ||
    command.includes("open my recent document") ||
    command.includes("open latest document")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: true,
        autoFilterCategory: null,
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("open library") ||
    command.includes("go to library") ||
    command.includes("open saved summaries") ||
    command.includes("open saved items")
  ) {
    return {
      command,
      screen: "Library",
      params: {
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("open documents") ||
    command.includes("go to documents") ||
    command.includes("show documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: null,
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("play latest summary") ||
    command.includes("play newest summary") ||
    command.includes("open latest summary")
  ) {
    return {
      command,
      screen: "Library",
      params: {
        autoMostRecent: true,
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("finance") ||
    command.includes("finance folder") ||
    command.includes("finance documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "finance",
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("work") ||
    command.includes("work folder") ||
    command.includes("work documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "work",
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("study") ||
    command.includes("study folder") ||
    command.includes("study documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "study",
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("personal") ||
    command.includes("personal folder") ||
    command.includes("personal documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "personal",
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("legal") ||
    command.includes("legal folder") ||
    command.includes("legal documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "legal",
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("history") ||
    command.includes("history folder") ||
    command.includes("history documents")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "history",
        commandNonce: Date.now(),
      },
    };
  }

  if (
    command.includes("other") ||
    command.includes("other folder") ||
    command.includes("other documents") ||
    command.includes("uncategorised") ||
    command.includes("uncategorized")
  ) {
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: "other",
        commandNonce: Date.now(),
      },
    };
  }

  return null;
};

  const handleVoiceCommand = (text) => {
  const action = getCommandAction(text);

  if (!action) {
    alert("I couldn't understand that command. Please try again.");
    setStatus("idle");
    return;
  }

  setStatus("executing");
  setTranscript(action.command);

  navigation.navigate(action.screen, action.params);
  setTimeout(() => setStatus("idle"), 600);
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
          width: 90,
height: 90,
          borderRadius: 45,
          backgroundColor: "#4F46E5",
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
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
  <View style={{ alignItems: "center" }}>
    <Ionicons name="mic" size={20} color="#4F46E5" />
    <Text style={{ marginTop: 6, color: "#475569", fontWeight: "600" }}>
      Listening...
    </Text>
  </View>
)}

{status === "processing" && (
  <View style={{ alignItems: "center" }}>
    <ActivityIndicator size="small" color="#4F46E5" />
    <Text style={{ marginTop: 6, color: "#475569", fontWeight: "600" }}>
      Understanding command...
    </Text>
  </View>
)}

{status === "transcribing" && (
  <View style={{ alignItems: "center" }}>
    <ActivityIndicator size="small" color="#4F46E5" />
    <Text style={{ marginTop: 6, color: "#475569", fontWeight: "600" }}>
      Transcribing speech...
    </Text>
  </View>
)}

{status === "executing" && (
  <View style={{ alignItems: "center" }}>
    <Ionicons name="flash-outline" size={20} color="#4F46E5" />
    <Text style={{ marginTop: 6, color: "#475569", fontWeight: "600" }}>
      Executing action...
    </Text>
  </View>
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