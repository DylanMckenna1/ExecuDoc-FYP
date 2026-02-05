// screens/MainTabs.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import Welcome from "./Welcome";
import Documents from "./Documents";
import Library from "./Listen";
import Profile from "./Profile";
import { Colors } from "../components/styles";

const Tab = createBottomTabNavigator();
const { brand } = Colors;

export default function MainTabs({ user, onLogout }) {
  const WelcomeScreen = (props) => (
    <Welcome
      {...props}
      user={user}
      onLogout={onLogout}
      onOpenDocuments={() => props.navigation.navigate("Documents")}
      onOpenProfile={() => props.navigation.navigate("Profile")}
    />
  );

  const DocumentsScreen = (props) => (
    <Documents
      {...props}
      user={user}
      onBack={() => props.navigation.navigate("Home")}
    />
  );

  const ProfileScreen = (props) => (
    <Profile
      {...props}
      user={user}
      onLogout={onLogout}
    />
  );

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false, // No header
          tabBarActiveTintColor: brand,
          tabBarInactiveTintColor: "#94A3B8",
          tabBarStyle: {
            height: 64,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarIcon: ({ color, size }) => {
            let icon = "home-outline";
            if (route.name === "Home") icon = "home-outline";
            if (route.name === "Documents") icon = "document-text-outline";
            if (route.name === "Library") icon = "library-outline";
            if (route.name === "Profile") icon = "person-circle-outline";
            return <Ionicons name={icon} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={WelcomeScreen} />
        <Tab.Screen name="Documents" component={DocumentsScreen} />
        <Tab.Screen name="Library" component={Library} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
