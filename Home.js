// screens/Home.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';

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
// Public landing screen
export default function Home({ onLogin, onSignup }) {
  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <InnerContainer>
{/* App branding/logo */}
        <LogoWrap>
          <PageLogo
            resizeMode="contain"
            source={require('../assets/logo.png')}
          />
        </LogoWrap>
{/* Main welcome title */}
        <HeroTitle>Welcome to ExecuDoc</HeroTitle>
{/* the app purpose */}
        <Tagline>
          Secure. Simple. Smart document management.
        </Tagline>

        <FeatureRow>
          <FeatureChip>
            <Ionicons name="document-text-outline" size={16} color={brand} />
            <FeatureText>Summarise</FeatureText>
          </FeatureChip>
          <FeatureChip>
            <Ionicons name="mic-outline" size={16} color={brand} />
            <FeatureText>Voice Assist</FeatureText>
          </FeatureChip>
          <FeatureChip>
            <Ionicons name="volume-high-outline" size={16} color={brand} />
            <FeatureText>Listen Anywhere</FeatureText>
          </FeatureChip>
        </FeatureRow>

        <Separator />
{/* Navigate to login screen */}
        <PrimaryButton onPress={onLogin}>
          <ButtonText>Login</ButtonText>
        </PrimaryButton>
{/* Navigate to signup screen */}
        <SecondaryButton onPress={onSignup}>
          <SecondaryText>Create an account</SecondaryText>
        </SecondaryButton>
      </InnerContainer>
    </StyledContainer>
  );
}
// styled components 
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
  margin-bottom: 18px;
`;

const FeatureRow = styled.View`
  width: 92%;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 18px;
`;

const FeatureChip = styled.View`
  flex: 1;
  margin-horizontal: 4px;
  padding-vertical: 12px;
  padding-horizontal: 10px;
  border-radius: 14px;
  border-width: 1px;
  border-color: ${secondary};
  background-color: #f8faff;
  align-items: center;
  justify-content: center;
`;

const FeatureText = styled.Text`
  margin-top: 6px;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  color: ${tertiary};
  font-weight: 700;
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
  border-radius: 12px;
  border-width: 1px;
  border-color: ${brand};
  background-color: transparent;
  justify-content: center;
  align-items: center;
`;

const SecondaryText = styled(ButtonText)`
  color: ${brand};
`;
