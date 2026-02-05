// screens/Welcome.js
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  StyledContainer,
  InnerContainer,
  PageLogo,
  PageTitle,
  SubTitle,
  Line,
  Colors,
} from '../components/styles';
import { databases, DB_ID, PROFILES_ID, Query } from '../services/appwrite';

const { brand } = Colors;

export default function Welcome({ user, onLogout, onOpenDocuments, onOpenProfile }) {
  const [displayName, setDisplayName] = useState(user?.name || '');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id) return;
        const res = await databases.listDocuments(DB_ID, PROFILES_ID, [
          Query.equal('userID', user.id),
          Query.limit(1),
        ]);
        const doc = res.documents?.[0];
        const fullName = doc ? [doc.firstName, doc.lastName].filter(Boolean).join(' ')
                             : (user?.name || '');
        if (mounted) setDisplayName(fullName || user?.email || 'User');
      } catch {}
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  const Tile = ({ icon, label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: '#F5F7FB',
        borderRadius: 16,
        paddingVertical: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Ionicons name={icon} size={26} color={brand} style={{ marginBottom: 10 }} />
      <SubTitle style={{ marginBottom: 0, color: '#0F172A', fontWeight: '600' }}>{label}</SubTitle>
    </TouchableOpacity>
  );

  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <InnerContainer style={{ width: '100%', alignItems: 'center' }}>
        <PageLogo resizeMode="contain" source={require('../assets/logo.png')} />
        <SubTitle style={{ color: '#0F172A', marginTop: 6, marginBottom: 18, fontSize: 22 }}>
          Welcome
        </SubTitle>
        <SubTitle style={{ color: '#334155', marginTop: 0, marginBottom: 20 }}>{displayName}</SubTitle>
        <Line />

        {/* Row 2 */}
        <View style={{ width: '100%', paddingHorizontal: 18, flexDirection: 'row', marginTop: 18 }}>
          <Tile icon="document-text-outline" label="My Documents" onPress={onOpenDocuments} />
          <Tile icon="person-circle-outline" label="Profile" onPress={onOpenProfile} />
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={onLogout}
          style={{
            marginTop: 22,
            backgroundColor: brand,
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
          }}
        >
          <SubTitle style={{ color: 'white', marginBottom: 0 }}>Logout</SubTitle>
        </TouchableOpacity>
      </InnerContainer>
    </StyledContainer>
  );
}

