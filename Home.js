// screens/Home.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import styled from 'styled-components/native';

import {
  StyledContainer,
  InnerContainer,
  PageLogo,
  SubTitle,
  Colors,
  StyledButton,
  ButtonText,
  Line,
} from '../components/styles';

const { brand, tertiary, darkLight, secondary } = Colors;

export default function Home({ onLogin, onSignup }) {
  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <InnerContainer>

        <LogoWrap>
          <PageLogo
            resizeMode="contain"
            source={require('../assets/logo.png')}
          />
        </LogoWrap>

        <HeroTitle>Welcome to ExecuDoc</HeroTitle>

        <Tagline>
          Secure. Simple. Smart document management.
        </Tagline>

        <Separator />

        <PrimaryButton onPress={onLogin}>
          <ButtonText>Login</ButtonText>
        </PrimaryButton>

        <SecondaryButton onPress={onSignup}>
          <SecondaryText>Create an account</SecondaryText>
        </SecondaryButton>
      </InnerContainer>
    </StyledContainer>
  );
}

const LogoWrap = styled.View`
  width: 100%;
  align-items: center;
  margin-top: 6px;
  margin-bottom: 4px;
`;

const HeroTitle = styled.Text`
  font-size: 26px;
  line-height: 32px;
  text-align: center;
  color: ${tertiary};
  font-weight: 800;
  margin: 4px 0 10px 0;
`;

const Tagline = styled.Text`
  font-size: 15px;
  line-height: 22px;
  text-align: center;
  color: ${darkLight};
  width: 90%;
  margin-bottom: 16px;
`;

const Separator = styled(Line)`
  margin-vertical: 16px;
  background-color: ${secondary};
`;

const PrimaryButton = styled(StyledButton)`
  width: 92%;
  align-self: center;
  margin-top: 4px;
  margin-bottom: 10px;
  background-color: ${brand};
`;

const SecondaryButton = styled.TouchableOpacity`
  width: 92%;
  height: 60px;
  align-self: center;
  border-radius: 5px;
  border-width: 1px;
  border-color: ${brand};
  background-color: transparent;
  justify-content: center;
  align-items: center;
`;

const SecondaryText = styled(ButtonText)`
  color: ${brand};
`;
