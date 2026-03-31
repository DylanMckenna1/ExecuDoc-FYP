// screens/Welcome.js
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  StyledContainer,
  InnerContainer,
  PageTitle,
  SubTitle,
  Colors,
} from '../components/styles';
import {
  databases,
  DB_ID,
  PROFILES_ID,
  DOCUMENTS_ID,
  SAVED_ITEMS_ID,
  Query,
} from '../services/appwrite';
const { brand } = Colors;

export default function Welcome({
  user,
  onLogout,
  onOpenDocuments,
  onOpenProfile,
  navigation,
}) {
  
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [recentDocs, setRecentDocs] = useState([]);
  const [recentSummaries, setRecentSummaries] = useState([]);

  useEffect(() => {
  let mounted = true;

  (async () => {
    try {
      if (!user?.id) return;

      const [profileRes, docsRes, savedRes] = await Promise.all([
        databases.listDocuments(DB_ID, PROFILES_ID, [
          Query.equal('userID', user.id),
          Query.limit(1),
        ]),
        databases.listDocuments(DB_ID, DOCUMENTS_ID, [
          Query.equal('userID', user.id),
          Query.orderDesc('$createdAt'),
          Query.limit(3),
        ]),
        databases.listDocuments(DB_ID, SAVED_ITEMS_ID, [
          Query.equal('userID', user.id),
          Query.orderDesc('$createdAt'),
          Query.limit(3),
        ]),
      ]);

      const profileDoc = profileRes.documents?.[0];
      const fullName = profileDoc
        ? [profileDoc.firstName, profileDoc.lastName].filter(Boolean).join(' ')
        : (user?.name || '');

      if (!mounted) return;

      setDisplayName(fullName || user?.email || 'User');
      setRecentDocs(docsRes.documents || []);
      setRecentSummaries(savedRes.documents || []);
    } catch {
      if (!mounted) return;
      setDisplayName(user?.name || user?.email || 'User');
      setRecentDocs([]);
      setRecentSummaries([]);
    }
  })();

  return () => {
    mounted = false;
  };
}, [user?.id, user?.name, user?.email]);

 const QuickAction = ({ icon, label, onPress }) => (
  <TouchableOpacity
  onPress={onPress}
  activeOpacity={0.75}
    style={{
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderRadius: 18,
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 6,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    }}
  >
    <Ionicons name={icon} size={24} color={brand} style={{ marginBottom: 8 }} />
    <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 13 }}>
      {label}
    </Text>
  </TouchableOpacity>
);

const SectionCard = ({ title, icon, children }) => (
  <View
    style={{
      width: "100%",
      backgroundColor: "#FFFFFF",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      padding: 16,
      marginTop: 18,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
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
        <Ionicons name={icon} size={18} color={brand} />
      </View>

      <Text style={{ fontSize: 16, fontWeight: "900", color: "#0F172A" }}>
        {title}
      </Text>
    </View>

    {children}
  </View>
);

  return (
    <StyledContainer>
      <StatusBar style="dark" />
     <InnerContainer style={{ width: "100%", alignItems: "center" }}>
  <ScrollView
    style={{ width: "100%" }}
    contentContainerStyle={{
      width: "100%",
      alignItems: "center",
      paddingBottom: 28,
    }}
    showsVerticalScrollIndicator={false}
  >
    <View style={{ alignItems: "center", marginBottom: 16, width: "100%" }}>
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 20,
          backgroundColor: "rgba(79,70,229,0.1)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Ionicons name="document-text" size={34} color={brand} />
      </View>

      <PageTitle style={{ color: brand, fontSize: 26 }}>ExecuDoc</PageTitle>

      <SubTitle style={{ color: "#0F172A", marginTop: 6, fontSize: 20 }}>
        Welcome back
      </SubTitle>

      <SubTitle style={{ color: "#64748B", marginTop: 2 }}>
        {displayName}
      </SubTitle>
    </View>

    <SectionCard title="AI Assistant" icon="sparkles-outline">
      <View
        style={{
          borderRadius: 16,
          backgroundColor: "#EEF2FF",
          borderWidth: 1,
          borderColor: "#C7D2FE",
          padding: 14,
        }}
      >
        <Text style={{ fontWeight: "900", fontSize: 15, color: "#3730A3" }}>
          Your AI Assistant is ready
        </Text>

        <Text style={{ marginTop: 6, color: "#4F46E5", lineHeight: 20 }}>
              You can control your documents using voice:
        </Text>

        <Text style={{ marginTop: 6, color: "#3730A3", fontSize: 13, lineHeight: 20 }}>
          • “Open my recent document”{"\n"}
          • “Summarise my CV”{"\n"}
          • “Play latest summary”
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate("Assistant")}
          activeOpacity={0.88}
          style={{
            marginTop: 12,
            alignSelf: "flex-start",
            backgroundColor: brand,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Open Assistant</Text>
        </TouchableOpacity>
      </View>
    </SectionCard>

    <SectionCard title="Quick Actions" icon="flash-outline">
      <View style={{ flexDirection: "row", marginHorizontal: -6 }}>
        <QuickAction
          icon="document-text-outline"
          label="Documents"
          onPress={onOpenDocuments}
     />
        <QuickAction
          icon="mic-outline"
          label="Assistant"
          onPress={() => navigation.navigate("Assistant")}
        />
        <QuickAction
          icon="person-circle-outline"
          label="Profile"
          onPress={onOpenProfile}
        />
      </View>
    </SectionCard>

    <SectionCard title="Recent Documents" icon="folder-open-outline">
      {recentDocs.length > 0 ? (
        recentDocs.map((doc) => (
          <TouchableOpacity
            key={doc.$id}
            onPress={onOpenDocuments}
            activeOpacity={0.88}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#E2E8F0",
            }}
          >
            <Text style={{ fontWeight: "800", color: "#0F172A" }}>
              {doc.title || "Untitled document"}
            </Text>
            <Text style={{ marginTop: 4, color: "#64748B", fontSize: 13 }}>
             {String(doc.category || "Uncategorised").toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))
      ) : (
       <View style={{ alignItems: "center", paddingVertical: 10 }}>
  <Ionicons name="document-outline" size={26} color="#94A3B8" />
  <Text style={{ color: "#64748B", marginTop: 6 }}>
    No documents yet
  </Text>
</View>
      )}
    </SectionCard>

    <SectionCard title="Recent Summaries" icon="library-outline">
      {recentSummaries.length > 0 ? (
        recentSummaries.map((item) => (
          <TouchableOpacity
            key={item.$id}
            onPress={() =>
              navigation.navigate("Library", {
                autoSearchText: item.title || "",
                autoOpenFirstMatch: true,
                commandNonce: Date.now(),
              })
            }
            activeOpacity={0.88}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#E2E8F0",
            }}
          >
            <Text style={{ fontWeight: "800", color: "#0F172A" }}>
              {item.title || "Saved summary"}
            </Text>
            <Text style={{ marginTop: 4, color: "#64748B", fontSize: 13 }}>
              {(item.summaryType || "summary").toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={{ color: "#64748B", lineHeight: 20 }}>
          No saved summaries yet. Save a summary from Documents to see it here.
        </Text>
      )}
    </SectionCard>

    <TouchableOpacity
      onPress={onLogout}
      activeOpacity={0.88}
      style={{
        marginTop: 20,
        backgroundColor: "#F1F5F9",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 14,
      }}
    >
      <SubTitle style={{ color: "#0F172A", marginBottom: 0, fontWeight: "700" }}>
        Logout
      </SubTitle>
    </TouchableOpacity>
  </ScrollView>
</InnerContainer>
    </StyledContainer>
  );
}

