import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { transcribeAudio } from "../services/transcribeVoice";

export default function Assistant({ navigation }) {
 // Setting up my 3 key states
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

      // Sets audio mode for recording 
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setStatus("listening");
// starts recording and saves the recording into a state 
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
//Stop the recording abnd get the file Uri
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
// clear current recording from state
    setRecording(null);

    if (!uri) {
      setTranscript("I couldn't hear anything. Please try again.");
      setStatus("idle");
      return;
    }
// Calling transcribe Audio URI
    const transcriptText = await transcribeAudio(uri);
//checking to see if the transcript text came back
    if (!transcriptText || typeof transcriptText !== "string") {
      setTranscript("I couldn't understand that. Please try again.");
      setStatus("idle");
      return;
    }
//save transcript and set status to processing 
   setTranscript(transcriptText);
   setStatus("processing");
 // send trancript to handleVoicecommand
   handleVoiceCommand(transcriptText);
  } catch (err) {
    console.log("stop recording error", err);
    setTranscript("Something went wrong. Please try again.");
    setStatus("idle");
    setRecording(null);
  }
};

const matchesCommand = (command, phrases = []) => {
  return phrases.some((phrase) => command.includes(phrase));
};

const normaliseVoiceText = (text) => {
  return typeof text === "string"
    ? text
        .toLowerCase()
        .replace(/[.,!?;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
};

const splitVoiceCommands = (text) => {
  const raw = normaliseVoiceText(text);
  if (!raw) return [];

  return raw
    .split(/\b(?:and then|then|and)\b/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const getCommandAction = (text) => {
const command = normaliseVoiceText(text);

  if (!command) return null;

  if (
    matchesCommand(command, [
      "open recent document",
      "open my recent document",
      "open latest document",
      "open recent file",
      "open latest file",
    ])
  ) {
    return { type: "openRecent" };
  }

  if (
    matchesCommand(command, [
      "open documents",
      "go to documents",
      "show documents",
      "open document section",
      "show my documents",
      "take me to documents",
      "open my files",
      "show my files",
    ])
  ) {
    return { type: "openDocuments" };
  }

  if (
    matchesCommand(command, [
      "finance",
      "finance folder",
      "finance documents",
      "finance files",
      "open finance",
      "show finance",
      "go to finance",
      "my finance documents",
      "finance docs",
    ])
  ) {
    return { type: "filterCategory", value: "finance" };
  }

  if (
    matchesCommand(command, [
      "work",
      "work folder",
      "work documents",
      "work files",
    ])
  ) {
    return { type: "filterCategory", value: "work" };
  }

  if (
    matchesCommand(command, [
      "study",
      "study folder",
      "study documents",
      "study files",
    ])
  ) {
    return { type: "filterCategory", value: "study" };
  }

  if (
    matchesCommand(command, [
      "personal",
      "personal folder",
      "personal documents",
      "personal files",
    ])
  ) {
    return { type: "filterCategory", value: "personal" };
  }

  if (
    matchesCommand(command, [
      "legal",
      "legal folder",
      "legal documents",
      "legal files",
    ])
  ) {
    return { type: "filterCategory", value: "legal" };
  }

  if (
    matchesCommand(command, [
      "history",
      "history folder",
      "history documents",
      "history files",
    ])
  ) {
    return { type: "filterCategory", value: "history" };
  }

  if (
    matchesCommand(command, [
      "other",
      "other folder",
      "other documents",
      "other files",
      "uncategorised",
      "uncategorized",
    ])
  ) {
    return { type: "filterCategory", value: "other" };
  }

  if (
    matchesCommand(command, [
      "summarise it",
      "summarise this",
      "summarise document",
      "summarise this document",
      "summarize it",
      "summarize this",
      "summarize document",
      "summarize this document",
    ])
  ) {
    return { type: "summariseRecent" };
  }

  if (
    matchesCommand(command, [
      "listen to it",
      "listen to this",
      "listen to document",
      "listen to this document",
      "read it out",
      "read this out",
    ])
  ) {
    return { type: "listenRecent" };
  }

    if (
    matchesCommand(command, [
      "save it to the library",
      "save this to the library",
      "save summary to the library",
      "save it",
      "save this summary",
      "save to library",
      "add it to the library",
      "add this to the library",
    ])
  ) {
    return { type: "saveRecentSummary" };
  }

  if (
    command.startsWith("search ") ||
    command.startsWith("find ") ||
    command.startsWith("open document ") ||
    command.startsWith("open file ")
  ) {
    const searchText = command
      .replace("search ", "")
      .replace("find ", "")
      .replace("open document ", "")
      .replace("open file ", "")
      .trim();

    if (searchText.length > 0) {
      return { type: "searchDocuments", value: searchText };
    }
  }

  return null;
};

//calling get command action text 
const handleVoiceCommand = (text) => {
  const parts = splitVoiceCommands(text);
  const actions = parts.map(getCommandAction).filter(Boolean);

  if (!actions.length) {
    alert("I couldn't understand that command. Please try again.");
    setStatus("idle");
    return;
  }

  setStatus("executing");
  setTranscript(text);

    const params = {
    autoOpenRecent: false,
    autoFilterCategory: null,
    autoSearchText: "",
    autoSummariseRecent: false,
    autoListenRecent: false,
    autoSaveRecentSummary: false,
    commandNonce: Date.now(),
  };

  actions.forEach((action) => {
    if (action.type === "openRecent") {
      params.autoOpenRecent = true;
    }

    if (action.type === "openDocuments") {
      params.autoOpenRecent = false;
    }

    if (action.type === "filterCategory") {
      params.autoFilterCategory = action.value;
    }

    if (action.type === "searchDocuments") {
      params.autoSearchText = action.value;
    }

    if (action.type === "summariseRecent") {
      params.autoSummariseRecent = true;
    }

    if (action.type === "listenRecent") {
      params.autoListenRecent = true;
    }

    if (action.type === "saveRecentSummary") {
      params.autoSaveRecentSummary = true;
    }
  });

  navigation.navigate("Documents", params);

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