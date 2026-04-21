// screens/Profile.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../components/styles";
import { BarChart } from 'react-native-gifted-charts';
import { useFocusEffect } from "@react-navigation/native";

import {
  account,
  getUserProfile,
  databasesClient,
  DATABASE_ID,
  DOCUMENTS_COLLECTION_ID,
  SAVED_ITEMS_COLLECTION_ID,
  Query,
} from "../services/appwrite";
const { brand } = Colors;


export default function Profile({ user: userProp, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(userProp || null);
  const [userType, setUserType] = useState("");
  const [docCount, setDocCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [categoryChartData, setCategoryChartData] = useState([]);
  const [topCategory, setTopCategory] = useState("None");
  const [activeCategoryCount, setActiveCategoryCount] = useState(0);

  const userTypeLabel =
  userType === "student"
    ? "Student"
    : userType === "professional"
    ? "Professional"
    : userType === "personal"
    ? "Personal"
    : "";

  // Change password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
  let mounted = true;

  (async () => {
    try {
      let activeUser = userProp;

      if (!activeUser) {
        activeUser = await account.get();
        if (mounted) setUser(activeUser);
      }

      const userId = activeUser?.$id || activeUser?.id;
      if (userId) {
        const profile = await getUserProfile(userId);
        if (mounted) {
          setUserType((profile?.userType || "").trim().toLowerCase());
        }
      }
    } catch (e) {
      console.log("profile load error", e);
    } finally {
      if (mounted) setLoading(false);
    }
  })();

  return () => {
    mounted = false;
  };
}, [userProp]);

const loadStats = useCallback(async () => {
  try {
    const userId = user?.$id || user?.id;
    if (!userId) return;

    const [docsRes, saved] = await Promise.all([
      databasesClient.listDocuments(DATABASE_ID, DOCUMENTS_COLLECTION_ID, [
        Query.equal("userID", userId),
      ]),
      databasesClient.listDocuments(DATABASE_ID, SAVED_ITEMS_COLLECTION_ID, [
        Query.equal("userID", userId),
      ]),
    ]);

    const docs = docsRes.documents || [];

    setDocCount(docsRes.total || 0);
    setSavedCount(saved.total || 0);

    const normaliseCategory = (value) => {
      const v = (value || "").trim().toLowerCase();
      return v || "other";
    };

    const categoryCounts = docs.reduce((acc, doc) => {
      const key = normaliseCategory(doc.category);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const chartData = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, count]) => ({
        value: count,
        label: category.charAt(0).toUpperCase() + category.slice(1),
      }));

    const sortedCategories = Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1]
    );

    setTopCategory(
      sortedCategories[0]?.[0]
        ? sortedCategories[0][0].charAt(0).toUpperCase() +
            sortedCategories[0][0].slice(1)
        : "None"
    );

    setActiveCategoryCount(sortedCategories.length);
    setCategoryChartData(chartData);
  } catch (err) {
    console.log("Profile stats error:", err);
  }
}, [user]);

useFocusEffect(
  useCallback(() => {
    loadStats();
  }, [loadStats])
);

  const displayName = useMemo(() => {
    const n = user?.name?.trim();
    if (n) return n;
    const email = user?.email?.trim();
    if (email) return email.split("@")[0];
    return "User";
  }, [user]);

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [displayName]);

  const email = user?.email || "—";

const memberSince = user?.$createdAt
  ? new Date(user.$createdAt).toLocaleDateString()
  : "—";

  const doLogout = async () => {
    try {
      if (onLogout) return onLogout();
      await account.deleteSession("current");
    } catch (e) {
      Alert.alert("Logout failed", e?.message || "Try again.");
    }
  };

  const savePassword = async () => {
    if (!oldPw || !newPw || !newPw2) {
      Alert.alert("Missing info", "Please fill in all password fields.");
      return;
    }
    if (newPw.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (newPw !== newPw2) {
      Alert.alert("Passwords don’t match", "Please re-enter your new password.");
      return;
    }

    try {
      setPwSaving(true);
      await account.updatePassword(newPw, oldPw);

      setPwOpen(false);
      setOldPw("");
      setNewPw("");
      setNewPw2("");
      Alert.alert("Success", "Password updated.");
    } catch (e) {
      console.log("update password error", e);
      Alert.alert("Could not update password", e?.message || "Try again later.");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#64748B" }}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 28 }}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.sub}>{email}</Text>

            {!!userTypeLabel && (
  <View style={styles.pillRow}>
    <View style={styles.pill}>
      <Ionicons name="school-outline" size={14} color={brand} />
      <Text style={styles.pillText}>
        {userTypeLabel}
      </Text>
    </View>
  </View>
)}
 </View>       
  </View>
   </View>

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Your activity</Text>

  <View style={styles.activityCard}>
  <View style={styles.activityRow}>

    <Text style={styles.activityLabel}>Member since</Text>
    <Text style={styles.activityValue}>{memberSince}</Text>
  </View>

  <View style={styles.activityRow}>
    <Text style={styles.activityLabel}>Documents</Text>
    <Text style={styles.activityValue}>{docCount}</Text>
  </View>

  <View style={[styles.activityRow, { borderBottomWidth: 0 }]}>
    <Text style={styles.activityLabel}>Saved summaries</Text>
    <Text style={styles.activityValue}>{savedCount}</Text>
  </View>
</View>
</View>

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Most used categories</Text>
  <Text style={styles.chartSubtitle}>Based on your uploaded documents</Text>

  <View style={[styles.activityCard, { paddingTop: 18 }]}>
    {categoryChartData.length > 0 ? (
      <BarChart
        data={categoryChartData}
        barWidth={30}
        spacing={22}
        roundedTop
        roundedBottom
        hideRules={false}
        rulesColor="#EEF2FF"
        hideYAxisText={false}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor="#E2E8F0"
        noOfSections={4}
        maxValue={
          categoryChartData.length > 0
            ? Math.max(...categoryChartData.map(item => item.value), 4)
            : 4
        }
        frontColor={brand}
        yAxisTextStyle={{
          color: "#94A3B8",
          fontSize: 11,
        }}
        xAxisLabelTextStyle={{
          color: "#64748B",
          fontSize: 11,
          fontWeight: "600",
        }}
        showValuesAsTopLabel
        topLabelTextStyle={{
          color: "#0F172A",
          fontSize: 11,
          fontWeight: "700",
        }}
      />
    ) : (
      <Text style={{ color: "#64748B", lineHeight: 20 }}>
        Upload a few documents to see your most used categories.
      </Text>
    )}

    <View style={styles.chartStatsRow}>
      <View style={styles.chartStatPill}>
        <Text style={styles.chartStatLabel}>Top</Text>
        <Text style={styles.chartStatValue}>{topCategory}</Text>
      </View>

      <View style={styles.chartStatPill}>
        <Text style={styles.chartStatLabel}>Categories</Text>
        <Text style={styles.chartStatValue}>{activeCategoryCount}</Text>
      </View>

      <View style={styles.chartStatPill}>
        <Text style={styles.chartStatLabel}>Docs</Text>
        <Text style={styles.chartStatValue}>{docCount}</Text>
      </View>
    </View>
  </View>
</View>
  

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Row
          icon="key-outline"
          title="Change password"
          subtitle="Update your login password"
          onPress={() => setPwOpen(true)}
        />

        <Row
          icon="log-out-outline"
          title="Logout"
          subtitle="Sign out of ExecuDoc"
          danger
          onPress={doLogout}
        />
      </View>

      {/* Change password modal */}
      <Modal visible={pwOpen} transparent animationType="slide" onRequestClose={() => setPwOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change password</Text>

            <Text style={styles.inputLabel}>Current password</Text>
            <TextInput
              value={oldPw}
              onChangeText={setOldPw}
              secureTextEntry
              placeholder="Enter current password"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>New password</Text>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              placeholder="Enter new password"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Confirm new password</Text>
            <TextInput
              value={newPw2}
              onChangeText={setNewPw2}
              secureTextEntry
              placeholder="Re-enter new password"
              style={styles.input}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setPwOpen(false)}
                style={[styles.btn, styles.btnGhost]}
                disabled={pwSaving}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={savePassword}
                style={[styles.btn, styles.btnPrimary]}
                disabled={pwSaving}
              >
                {pwSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ icon, title, subtitle, onPress, danger }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, danger && { backgroundColor: "#FEF2F2" }]}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? "#DC2626" : brand}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: "#DC2626" }]}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  headerCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTopRow: { flexDirection: "row", justifyContent: "center", marginBottom: 10 },
  logo: { width: 56, height: 56 },

  avatarRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 18 },

  name: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  sub: { marginTop: 2, color: "#64748B", fontSize: 13 },

  pillRow: { marginTop: 10, flexDirection: "row" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  pillText: { color: "#334155", fontWeight: "700", fontSize: 12 },

  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#64748B", marginBottom: 8, marginLeft: 4 },

  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  rowSub: { marginTop: 2, fontSize: 12, color: "#64748B" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A", marginBottom: 12 },

  inputLabel: { fontSize: 12, fontWeight: "800", color: "#334155", marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

activityCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  padding: 14,
  borderWidth: 1,
  borderColor: "#E2E8F0",
},

activityRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#F1F5F9",
},

activityLabel: {
  fontSize: 13,
  fontWeight: "700",
  color: "#64748B",
},

activityValue: {
  fontSize: 14,
  fontWeight: "800",
  color: "#0F172A",
},

chartSubtitle: {
  fontSize: 12,
  color: "#94A3B8",
  marginBottom: 8,
  marginLeft: 4,
},

chartStatsRow: {
  flexDirection: "row",
  gap: 8,
  marginTop: 14,
},

chartStatPill: {
  flex: 1,
  backgroundColor: "#F8FAFC",
  borderWidth: 1,
  borderColor: "#E2E8F0",
  borderRadius: 12,
  paddingVertical: 10,
  paddingHorizontal: 10,
},

chartStatLabel: {
  fontSize: 11,
  fontWeight: "700",
  color: "#64748B",
  marginBottom: 4,
},

chartStatValue: {
  fontSize: 13,
  fontWeight: "800",
  color: "#0F172A",
},

  modalButtons: { flexDirection: "row", gap: 12, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: brand },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnGhost: { backgroundColor: "#F1F5F9" },
  btnGhostText: { color: "#0F172A", fontWeight: "900" },
});