import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyledContainer,
  InnerContainer,
  PageLogo,
  PageTitle,
  SubTitle,
  StyledButton,
  ButtonText,
  Line,
  Colors,
} from '../components/styles';

export default function Home({ onLogin, onSignup }) {
  return (
    <StyledContainer>
      <StatusBar style="light" />
      <InnerContainer>
        {/* Use current logo for now, switch to logo.png */}
        <PageLogo resizeMode="contain" source={require('../assets/execudoc-logo.jpg')} />

        <PageTitle>ExecuDoc</PageTitle>
        <SubTitle>Welcome to ExecuDoc</SubTitle>

        <SubTitle style={{ marginTop: 10, fontSize: 14 }}>
          Secure. Simple. Smart document management.
        </SubTitle>

        <Line />

        {/* Primary action */}
        <StyledButton onPress={onLogin} style={{ width: '90%', marginTop: 10 }}>
          <ButtonText>Login</ButtonText>
        </StyledButton>

        {/* Secondary action */}
        <StyledButton
          onPress={onSignup}
          style={{
            width: '90%',
            marginTop: 8,
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: Colors.secondary,
          }}
        >
          <ButtonText style={{ color: Colors.primary }}>Sign up</ButtonText>
        </StyledButton>
      </InnerContainer>
    </StyledContainer>
  );
}
