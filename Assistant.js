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

const getCommandAction = (text) => {
    // converting text to lowercase
  const command = typeof text === "string" ? text.toLowerCase().trim() : "";
  
  // matching the transcript against these predefined commands 
  if (!command) return null;
  if (
    command.includes("open recent document") ||
    command.includes("open my recent document") ||
    command.includes("open latest document") ||
    command.includes("open recent file") ||
    command.includes("open latest file")
  ) {
// retrn an action object with screens, params and commands 
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
  command.includes("play latest summary") ||
  command.includes("play newest summary") ||
  command.includes("open latest summary") ||
  command.includes("play my latest summary") ||
  command.includes("play saved summary") ||
  command.includes("play recent summary") ||
  command.includes("open recent summary") ||
  command.includes("open summary") ||
  command.includes("play summary") ||
  command.includes("open my summary") ||
  command.includes("play my summary")
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
    command.includes("open documents") ||
    command.includes("go to documents") ||
    command.includes("show documents") ||
    command.includes("open document section")
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
    command.includes("finance") ||
    command.includes("finance folder") ||
    command.includes("finance documents") ||
    command.includes("finance files")
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
    command.includes("work documents") ||
    command.includes("work files")
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
    command.includes("study documents") ||
    command.includes("study files")
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
    command.includes("personal documents") ||
    command.includes("personal files")
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
    command.includes("legal documents") ||
    command.includes("legal files")
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
    command.includes("history documents") ||
    command.includes("history files")
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
    command.includes("other files") ||
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
    return {
      command,
      screen: "Documents",
      params: {
        autoOpenRecent: false,
        autoFilterCategory: null,
        autoSearchText: searchText,
        commandNonce: Date.now(),
      },
    };
  }
}

  return null;
};
//calling get command action text 
  const handleVoiceCommand = (text) => {
  const action = getCommandAction(text);
// if no match show error if matches set status to executing 
  if (!action) {
    alert("I couldn't understand that command. Please try again.");
    setStatus("idle");
    return;
  }

  setStatus("executing");
  //store the matched command in transcript
  setTranscript(action.command);

  navigation.navigate(action.screen, action.params);
  // return the assistant to idle
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