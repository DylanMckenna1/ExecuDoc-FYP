import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { transcribeAudio } from "../services/transcribeVoice";


export default function Assistant({ navigation }) {
 // Setting up my key states
const [recording, setRecording] = useState(null);
const [status, setStatus] = useState("idle");
const [transcript, setTranscript] = useState("");
const [actionText, setActionText] = useState("");

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
    setStatus("processing");
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

// run command immediately
   handleVoiceCommand(transcriptText);

// update status after
   setStatus("processing");

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

const buildAssistantStatusText = (actions = []) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return "Understanding your request...";
  }

  const labels = actions.map((action) => {
    if (action.type === "openRecent") return "Opening recent document";
    if (action.type === "openDocuments") return "Opening documents";
    if (action.type === "openHome") return "Opening home";
    if (action.type === "openLibrary") return "Opening library";
    if (action.type === "openProfile") return "Opening profile";
    if (action.type === "playLatestSummary") return "Opening latest saved summary";
    if (action.type === "openFirstSavedSummary") return "Opening first saved summary";
    if (action.type === "filterCategory") {
      return `Opening ${action.value} folder`;
    }
    if (action.type === "targetDocument") {
      if (action.open && action.listen) return `Opening and listening to ${action.value}`;
      if (action.open && action.summarise) return `Opening and summarising ${action.value}`;
      if (action.listen) return `Listening to ${action.value}`;
      if (action.summarise) return `Summarising ${action.value}`;
      return `Finding ${action.value}`;
    }
    if (action.type === "summaryTarget") {
      if (action.open) return `Opening summary of ${action.value}`;
      if (action.listen) return `Listening to summary of ${action.value}`;
      if (action.save) return `Saving summary of ${action.value} to Library`;
      return `Using summary of ${action.value}`;
    }
    if (action.type === "savedSummaryTarget") {
    if (action.play) return `Playing saved summary of ${action.value}`;
    if (action.open) return `Opening saved summary of ${action.value}`;
    if (action.listen) return `Playing saved summary of ${action.value}`;
     return `Finding saved summary of ${action.value}`;
  }
    if (action.type === "summariseRecent") return "Summarising document";
    if (action.type === "listenRecent") return "Listening to document";
    if (action.type === "saveRecentSummary") return "Saving summary to Library";
    if (action.type === "searchDocuments") return `Searching for ${action.value}`;
    if (action.type === "selectSuggestedDoc") {
    const labels = ["first", "second", "third"];
    const which = labels[action.index] || "selected";
    if (action.open && action.listen) return `Opening and listening to the ${which} match`;
    if (action.open && action.summarise) return `Opening and summarising the ${which} match`;
    if (action.open) return `Opening the ${which} match`;
    if (action.summarise) return `Summarising the ${which} match`;
    if (action.listen) return `Listening to the ${which} match`;
    if (action.save) return `Saving the ${which} match summary`;
         return `Using the ${which} match`;
    }
    return "Executing command";
  });

  return labels.join(" • ");
};

const extractTargetText = (command) => {
  const text = normaliseVoiceText(command);

  if (!text) return "";

   const patterns = [
  /^open\s+(?:the\s+)?saved\s+summary\s+of\s+(.+)$/,
  /^listen\s+to\s+(?:the\s+)?saved\s+summary\s+of\s+(.+)$/,
  /^play\s+(?:the\s+)?saved\s+summary\s+of\s+(.+)$/,
  /^open\s+(.+?)\s+saved\s+summary$/,
  /^listen\s+to\s+(.+?)\s+saved\s+summary$/,
  /^play\s+(.+?)\s+saved\s+summary$/,
  /^open\s+(.+?)\s+summary\s+in\s+library$/,
  /^listen\s+to\s+(.+?)\s+summary\s+in\s+library$/,
  /^play\s+(.+?)\s+summary\s+in\s+library$/,
  /^open\s+(?:the\s+)?summary\s+of\s+(.+)$/,
  /^listen\s+to\s+(?:the\s+)?summary\s+of\s+(.+)$/,
  /^play\s+(?:the\s+)?summary\s+of\s+(.+)$/,
  /^save\s+(?:the\s+)?summary\s+of\s+(.+?)(?:\s+to\s+(?:the\s+)?library)?$/,
  /^open\s+(?:file\s+|document\s+)?(.+)$/,
  /^find\s+(.+)$/,
  /^search\s+(.+)$/,
  /^listen\s+to\s+(.+)$/,
  /^play\s+(.+)$/,
  /^read\s+out\s+(.+)$/,
  /^summari[sz]e\s+(.+)$/,
];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
         return match[1]
        .replace(/\b(it|this|that)\b/g, "")
        .replace(/\b(?:in library|and library|saved summary|summary)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return "";
};

const isReferentialCommand = (command) => {
  const text = normaliseVoiceText(command);
  return /\b(it|this|that)\b/.test(text);
};

const getOrdinalIndex = (command) => {
  const text = normaliseVoiceText(command);

  if (/\bfirst\b/.test(text)) return 0;
  if (/\bsecond\b/.test(text)) return 1;
  if (/\bthird\b/.test(text)) return 2;

  return null;
};

const hasOrdinalReference = (command) => {
  return getOrdinalIndex(command) !== null;
};

const getCommandAction = (text) => {
  const command = normaliseVoiceText(text);
  const targetText = extractTargetText(command);
  const refersToLastDoc = isReferentialCommand(command);
  const ordinalIndex = getOrdinalIndex(command);

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
    "open home",
    "go home",
    "open homepage",
    "go to homepage",
    "homepage",
    "go to home",
  ])
) {
  return { type: "openHome" };
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
      "open library",
      "go to library",
      "show library",
      "open my library",
      "take me to library",
      "open saved summaries",
      "show saved summaries",
    ])
  ) {
    return { type: "openLibrary" };
  }

  if (
  matchesCommand(command, [
    "open profile",
    "go to profile",
    "show profile",
    "open my profile",
    "take me to profile",
  ]) ||
  command === "open account" ||
  command === "show account"
) {
  return { type: "openProfile" };
}
 
 if (
  matchesCommand(command, [
    "play latest summary",
    "play newest summary",
    "play recent summary",
    "open latest summary",
    "open recent summary",
    "play my latest summary",
    "play my recent summary",
    "play the latest summary",
    "play the latest saved summary",
    "play latest saved summary",
    "open the latest summary",
    "open the latest saved summary",
    "open latest saved summary",
    "listen to the latest summary",
    "listen to the latest saved summary",
    "listen to latest saved summary",
  ])
) {
  return { type: "playLatestSummary" };
}

  if (
  matchesCommand(command, [
    "open saved summary",
    "open the saved summary",
    "open a saved summary",
  ])
) {
  return { type: "openFirstSavedSummary" };
}

if (
  matchesCommand(command, [
    "listen to saved summary",
    "listen to the saved summary",
    "play saved summary",
    "play the saved summary",
  ])
) {
  return { type: "listenSavedSummary" };
}

  if (
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
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
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
    "work folder",
    "work documents",
    "work files",
    "open work",
    "show work",
  ])
) {
  return { type: "filterCategory", value: "work" };
}

  if (
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
    "study folder",
    "study documents",
    "study files",
    "open study",
    "show study",
  ])
) {
  return { type: "filterCategory", value: "study" };
}

  if (
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
    "personal folder",
    "personal documents",
    "personal files",
    "open personal",
    "show personal",
  ])
) {
  return { type: "filterCategory", value: "personal" };
}

  if (
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
    "legal folder",
    "legal documents",
    "legal files",
    "open legal",
    "show legal",
  ])
) {
  return { type: "filterCategory", value: "legal" };
}

 if (
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
    "history folder",
    "history documents",
    "history files",
    "open history",
    "show history",
  ])
) {
  return { type: "filterCategory", value: "history" };
}

  if (
  !hasOrdinalReference(command) &&
  matchesCommand(command, [
    "other folder",
    "other documents",
    "other files",
    "open other",
    "show other",
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
    return { type: "summariseRecent", useLastVoiceDoc: refersToLastDoc };
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
    return { type: "listenRecent", useLastVoiceDoc: refersToLastDoc };
  }

    if (
    matchesCommand(command, [
      "save it to the library",
      "save this to the library",
      "save summary to the library",
      "save the summary to the library",
      "save the summary to library",
      "save summary to library",
      "save it",
      "save this summary",
      "save to library",
      "add it to the library",
      "add this to the library",
    ])
  ) {
    return { type: "saveRecentSummary", useLastVoiceDoc: refersToLastDoc };
  }

     if (
  (command.startsWith("open saved summary of ") ||
    command.startsWith("open the saved summary of ") ||
    command.match(/^open .+ saved summary$/) ||
    command.match(/^open .+ summary in library$/) ||
    command.match(/^open .+ summary$/)) &&
  targetText &&
  !command.startsWith("open the summary of ")
) {
  return { type: "savedSummaryTarget", value: targetText, open: true };
}

if (
  (command.startsWith("listen to saved summary of ") ||
    command.startsWith("listen to the saved summary of ") ||
    command.match(/^listen to .+ saved summary$/) ||
    command.match(/^listen to .+ summary in library$/) ||
    command.match(/^listen to .+ summary$/)) &&
  targetText
) {
  return { type: "savedSummaryTarget", value: targetText, listen: true, play: true };
}

if (
  (command.startsWith("play saved summary of ") ||
    command.startsWith("play the saved summary of ") ||
    command.match(/^play .+ saved summary$/) ||
    command.match(/^play .+ summary$/) ||
    command.match(/^play .+ summary in library$/)) &&
  targetText &&
  !/\b(latest|newest|recent)\b/.test(targetText)
) {
  return { type: "savedSummaryTarget", value: targetText, play: true };
}

  if (
    matchesCommand(command, [
      "open saved summary in library",
      "open summary in library",
      "open the saved summary in library",
      "open the summary in library",
    ])
  ) {
    return { type: "playLatestSummary" };
  }

  if (
    matchesCommand(command, [
      "open first saved summary in library",
      "open the first saved summary in library",
      "open first summary in library",
      "open the first summary in library",
    ])
  ) {
    return { type: "openFirstSavedSummary" };
  }

  if (command.startsWith("open summary of ") && targetText) {
    return { type: "summaryTarget", value: targetText, open: true };
  }

  if (command.startsWith("open the summary of ") && targetText) {
    return { type: "summaryTarget", value: targetText, open: true };
  }

  if (command.startsWith("listen to summary of ") && targetText) {
    return { type: "summaryTarget", value: targetText, listen: true };
  }

  if (command.startsWith("listen to the summary of ") && targetText) {
    return { type: "summaryTarget", value: targetText, listen: true };
  }
  
  if (
    command.startsWith("save summary of ") &&
    targetText
  ) {
    return { type: "summaryTarget", value: targetText, save: true };
  }

  if (
    command.startsWith("save the summary of ") &&
    targetText
  ) {
    return { type: "summaryTarget", value: targetText, save: true };
  }

   if (ordinalIndex !== null) {
  if (command.includes("file in work folder")) {
    return { type: "selectFolderDoc", category: "work", index: ordinalIndex, open: true };
  }

  if (command.includes("file in finance folder")) {
    return { type: "selectFolderDoc", category: "finance", index: ordinalIndex, open: true };
  }

  if (command.includes("file in study folder")) {
    return { type: "selectFolderDoc", category: "study", index: ordinalIndex, open: true };
  }

  if (command.includes("file in legal folder")) {
    return { type: "selectFolderDoc", category: "legal", index: ordinalIndex, open: true };
  }

  if (command.includes("file in personal folder")) {
    return { type: "selectFolderDoc", category: "personal", index: ordinalIndex, open: true };
  }

  if (command.includes("file in history folder")) {
    return { type: "selectFolderDoc", category: "history", index: ordinalIndex, open: true };
  }

  if (command.startsWith("open ")) {
    return { type: "selectSuggestedDoc", index: ordinalIndex, open: true };
  }

  if (command.startsWith("summarise ") || command.startsWith("summarize ")) {
    return { type: "selectSuggestedDoc", index: ordinalIndex, summarise: true };
  }

  if (command.startsWith("listen to ") || command.startsWith("read out ")) {
    return { type: "selectSuggestedDoc", index: ordinalIndex, listen: true };
  }

  if (command.startsWith("save ")) {
    return { type: "selectSuggestedDoc", index: ordinalIndex, save: true };
  }
}

  if (command.startsWith("open ") && targetText) {
    return { type: "targetDocument", value: targetText, open: true };
  }

  if (command.startsWith("find ") && targetText) {
    return { type: "targetDocument", value: targetText };
  }

  if (command.startsWith("search ") && targetText) {
    return { type: "targetDocument", value: targetText };
  }

  if (command.startsWith("listen to ") && targetText) {
    return { type: "targetDocument", value: targetText, listen: true };
  }

  if (command.startsWith("read out ") && targetText) {
    return { type: "targetDocument", value: targetText, listen: true };
  }

  if ((command.startsWith("summarise ") || command.startsWith("summarize ")) && targetText) {
    return { type: "targetDocument", value: targetText, summarise: true };
  }

  return null;
};

const isIdle = status === "idle";
const isListening = status === "listening";
const isTranscribing = status === "transcribing";
const isProcessing = status === "processing";
const isExecuting = status === "executing";

const getStatusLabel = () => {
  if (isListening) return "Listening...";
  if (isTranscribing) return "Transcribing speech...";
  if (isProcessing) return "Understanding command...";
  if (isExecuting) return actionText || "Executing action...";
  return "Tap the microphone to start";
};

//calling get command action text 
const handleVoiceCommand = (text) => {
  const parts = splitVoiceCommands(text);
  const actions = parts.map(getCommandAction).filter(Boolean);

  if (!actions.length) {
    setTranscript(text || "");
    setActionText("I couldn’t match that command.");
    alert("I couldn't understand that command. Please try again.");
    setStatus("idle");
    return;
  }

  const statusText = buildAssistantStatusText(actions);

  setStatus("executing");
  setTranscript(text);
  setActionText(statusText);

const documentsParams = {
  autoOpenRecent: false,
  autoFilterCategory: null,
  autoSearchText: "",
  autoTargetText: "",
  autoUseLastVoiceDoc: false,
  autoSuggestedMatchIndex: null,
  autoFolderDocCategory: "",
  autoFolderDocIndex: null,
  autoOpenSummaryTarget: false,
  autoListenSummaryTarget: false,
  autoSaveSummaryTarget: false,
  autoSummariseRecent: false,
  autoListenRecent: false,
  autoSaveRecentSummary: false,
  commandNonce: Date.now(),
};

  const libraryParams = {
  autoMostRecent: false,
  autoSearchText: "",
  autoOpenFirstMatch: false,
  autoPlayFirstMatch: false,
  commandNonce: Date.now(),
};
  
  let targetScreen = "Documents";
  let targetParams = documentsParams;

  actions.forEach((action) => {
    if (action.type === "openRecent") {
      targetScreen = "Documents";
      documentsParams.autoOpenRecent = true;
    }

    if (action.type === "openDocuments") {
      targetScreen = "Documents";
    }

      if (action.type === "openHome") {
  targetScreen = "Home";
  targetParams = { commandNonce: Date.now() };
}

if (action.type === "openLibrary") {
  targetScreen = "Library";
  targetParams = { ...libraryParams, commandNonce: Date.now() };
}

if (action.type === "openProfile") {
  targetScreen = "Profile";
  targetParams = { commandNonce: Date.now() };
}

if (action.type === "playLatestSummary") {
  targetScreen = "Library";
  targetParams = {
    ...libraryParams,
    autoMostRecent: true,
    autoPlayFirstMatch: true,
    commandNonce: Date.now(),
  };
}

if (action.type === "openFirstSavedSummary") {
  targetScreen = "Library";
  targetParams = {
    ...libraryParams,
    autoOpenFirstMatch: true,
    commandNonce: Date.now(),
  };
}

if (action.type === "listenSavedSummary") {
  targetScreen = "Library";
  targetParams = {
    ...libraryParams,
    autoOpenFirstMatch: true,
    autoPlayFirstMatch: true,
    commandNonce: Date.now(),
  };
}

   if (action.type === "savedSummaryTarget") {
  targetScreen = "Library";
  targetParams = {
    ...libraryParams,
    autoSearchText: action.value,
    autoOpenFirstMatch: true,
    autoPlayFirstMatch: !!action.listen || !!action.play,
    commandNonce: Date.now(),
  };
}

    if (action.type === "filterCategory") {
      targetScreen = "Documents";
      documentsParams.autoFilterCategory = action.value;
    }

    if (action.type === "searchDocuments") {
      targetScreen = "Documents";
      documentsParams.autoSearchText = action.value;
    }

    if (action.type === "targetDocument") {
      targetScreen = "Documents";
      documentsParams.autoTargetText = action.value;
      documentsParams.autoSearchText = action.value;

      if (action.open) {
        documentsParams.autoOpenRecent = true;
      }

      if (action.summarise) {
        documentsParams.autoSummariseRecent = true;
      }

      if (action.listen) {
        documentsParams.autoListenRecent = true;
      }
    }

      if (action.type === "summaryTarget") {
      targetScreen = "Documents";
      documentsParams.autoTargetText = action.value;
      documentsParams.autoSearchText = action.value;

      if (action.open) {
        documentsParams.autoOpenSummaryTarget = true;
      }

      if (action.listen) {
        documentsParams.autoListenSummaryTarget = true;
      }

      if (action.save) {
        documentsParams.autoSaveSummaryTarget = true;
      }
    }

          if (action.type === "selectSuggestedDoc") {
      targetScreen = "Documents";
      documentsParams.autoSuggestedMatchIndex = action.index;

      if (action.open) {
        documentsParams.autoOpenRecent = true;
      }

      if (action.summarise) {
        documentsParams.autoSummariseRecent = true;
      }

      if (action.listen) {
        documentsParams.autoListenRecent = true;
      }

      if (action.save) {
        documentsParams.autoSaveRecentSummary = true;
      }
    }

    if (action.type === "selectFolderDoc") {
      targetScreen = "Documents";
      documentsParams.autoFolderDocCategory = action.category;
      documentsParams.autoFolderDocIndex = action.index;

      if (action.open) {
        documentsParams.autoOpenRecent = true;
      }
    }

     if (action.type === "summariseRecent") {
      targetScreen = "Documents";
      documentsParams.autoSummariseRecent = true;
      if (action.useLastVoiceDoc) {
        documentsParams.autoUseLastVoiceDoc = true;
      }
    }

    if (action.type === "listenRecent") {
      targetScreen = "Documents";
      documentsParams.autoListenRecent = true;
      if (action.useLastVoiceDoc) {
        documentsParams.autoUseLastVoiceDoc = true;
      }
    }

    if (action.type === "saveRecentSummary") {
      targetScreen = "Documents";
      documentsParams.autoSaveRecentSummary = true;
      if (action.useLastVoiceDoc) {
        documentsParams.autoUseLastVoiceDoc = true;
      }
    }
  });

  if (targetScreen === "Documents") {
    targetParams = documentsParams;
  }

  navigation.navigate(targetScreen, targetParams);

  setTimeout(() => {
    setStatus("idle");
    setActionText("");
  }, 900);
};

  return (
  <View
    style={{
      flex: 1,
      backgroundColor: "#F8FAFC",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 32,
    }}
  >

    <View style={{ alignItems: "center", marginBottom: 24 }}>
  <Text style={{ fontSize: 32, fontWeight: "900", color: "#0F172A" }}>
    Voice Assistant
  </Text>
 <Text
  style={{
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  }}
>
  Find documents, trigger summaries, and listen to content using the Voice Assistant
</Text>
</View>

      <TouchableOpacity
  onPress={recording ? stopRecording : startRecording}
  activeOpacity={0.88}
  style={{
    width: isListening ? 108 : 96,
    height: isListening ? 108 : 96,
    borderRadius: 999,
    backgroundColor: isListening ? "#DC2626" : "#4F46E5",
    shadowColor: "#000",
    shadowOpacity: isListening ? 0.22 : 0.14,
    shadowRadius: isListening ? 18 : 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: isListening ? "rgba(220,38,38,0.14)" : "rgba(79,70,229,0.12)",
  }}
>
  <Ionicons
    name={recording ? "stop" : "mic"}
    size={34}
    color="#fff"
  />
</TouchableOpacity>

      <View
  style={{
    marginTop: 28,
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  }}
>
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: isListening
          ? "rgba(220,38,38,0.10)"
          : "rgba(79,70,229,0.10)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
      }}
    >
      {isListening ? (
        <Ionicons name="mic" size={18} color="#DC2626" />
      ) : isTranscribing || isProcessing ? (
        <ActivityIndicator size="small" color="#4F46E5" />
      ) : isExecuting ? (
        <Ionicons name="flash-outline" size={18} color="#4F46E5" />
      ) : (
        <Ionicons name="sparkles-outline" size={18} color="#4F46E5" />
      )}
    </View>

    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B" }}>
        STATUS
      </Text>
      <Text style={{ marginTop: 2, fontSize: 15, fontWeight: "800", color: "#0F172A" }}>
        {getStatusLabel()}
      </Text>
    </View>
  </View>

  {!!transcript && (
    <View
      style={{
        marginTop: 6,
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B", marginBottom: 6 }}>
        LAST COMMAND
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: "#0F172A", fontWeight: "600" }}>
        {transcript}
      </Text>
    </View>
  )}

  {isIdle && !transcript && (
  <View
    style={{
      marginTop: 6,
      backgroundColor: "#F8FAFC",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: "#E2E8F0",
    }}
  >
    <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B", marginBottom: 8 }}>
      TRY SAYING
    </Text>
    <Text style={{ fontSize: 14, color: "#0F172A", lineHeight: 22 }}>
      “Open my essay and summarise it”{"\n"}
      “Play the latest saved summary”{"\n"}
      “Open the first file in study folder”{"\n"}
      “Read out my document”{"\n"}
    </Text>
  </View>
)}
</View>

    </View>
  );
}