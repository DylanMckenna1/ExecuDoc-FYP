// screens/MainApp.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import Welcome from './Welcome';
import Documents from './Documents';
import Listen from './Listen';
import { Colors } from '../components/styles';

const Tab = createBottomTabNavigator();
const { brand } = Colors;

export default function MainApp({ user, onLogout, onOpenProfile }) {
  const WelcomeScreen = (props) => (
    <Welcome
      {...props}
      user={user}
      onLogout={onLogout}
      onOpenProfile={onOpenProfile}
      onOpenDocuments={() => props.navigation.navigate('Documents')}
    />
  );

  const DocumentsScreen = (props) => (
    <Documents
      {...props}
      user={user}
      onBack={() => props.navigation.navigate('Home')}
    />
  );

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: brand,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            height: 64,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarIcon: ({ color, size }) => {
            let icon = 'home-outline';
            if (route.name === 'Home') icon = 'home-outline';
            if (route.name === 'Documents') icon = 'document-text-outline';
            if (route.name === 'Listen') icon = 'headset-outline';
            return <Ionicons name={icon} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={WelcomeScreen} />
        <Tab.Screen name="Documents" component={DocumentsScreen} />
        <Tab.Screen name="Listen" component={Listen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
