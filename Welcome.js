import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyledContainer,
  InnerContainer,
  PageLogo,
  PageTitle,
  SubTitle,
  StyledButton,
  ButtonText,
} from '../components/styles';
import { databases, DB_ID, PROFILES_ID, Query } from '../services/appwrite';

export default function Welcome({ user, onLogout }) {
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
        const fullName = doc
          ? [doc.firstName, doc.lastName].filter(Boolean).join(' ')
          : (user?.name || '');
        if (mounted) setDisplayName(fullName || user?.email || 'You are logged in.');
      } catch {
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  return (
    <StyledContainer>
      <StatusBar style="light" />
      <InnerContainer>
        <PageLogo resizeMode="contain" source={require('../assets/execudoc-logo.jpg')} />
        <PageTitle>Welcome</PageTitle>
        <SubTitle>{displayName}</SubTitle>

        <StyledButton onPress={onLogout}>
          <ButtonText>Logout</ButtonText>
        </StyledButton>
      </InnerContainer>
    </StyledContainer>
  );
}
