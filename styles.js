import styled from 'styled-components/native';
import { View, Text, TextInput, Image, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';

const StatusBarHeight = Constants.statusBarHeight;

// Colors (white theme)
export const Colors = {
  // page & cards
  primary:  '#FFFFFF',   // page background (white)
  surface:  '#F5F7FB',   // light card background (subtle gray)

  // text & inputs
  secondary:'#E6E8F2',   // input bg (light gray)
  tertiary: '#1F2937',   // main text (dark)
  darkLight:'#8C97B5',   // muted text

  // brand
  brand:   '#6E59F9',    // purple
  brand2:  '#3AA0FF',    // blue (for gradients)

  // status
  green:   '#22C55E',
  red:     '#EF4444',
  success: '#22C55E',
  danger:  '#EF4444',

  // legacy alias 
  background: '#FFFFFF',
};

const { primary, secondary, tertiary, darkLight, brand, green, red, background } = Colors;

export const StyledContainer = styled.View`
  flex: 1;
  padding: 25px;
  padding-top: ${StatusBarHeight + 10}px;
  background-color: ${background};
`;

export const InnerContainer = styled.View`
  flex: 1;
  width: 100%;
  align-items: center;
`;

export const PageLogo = styled.Image`
  width: 250px;
  height: 200px;
`;

export const PageTitle = styled.Text`
  font-size: 30px;
  text-align: center;
  font-weight: bold;
  color: ${brand};
  padding: 10px;
`;

export const SubTitle = styled.Text`
  font-size: 18px;
  margin-bottom: 20px;
  letter-spacing: 1px;
  font-weight: bold;
  color: ${tertiary}; /* darker text for white bg */
`;

export const StyledFormArea = styled.View`
  width: 90%;
`;

export const StyledTextInput = styled.TextInput`
  background-color: ${secondary};
  padding: 15px;
  padding-left: 55px;
  padding-right: 55px;
  border-radius: 5px;
  font-size: 16px;
  height: 60px;
  margin-vertical: 3px;
  margin-bottom: 10px;
  color: ${tertiary};
  /* Web nicety: remove blue outline; harmless on native */
  outline-style: none;
`;

export const StyledInputLabel = styled.Text`
  color: ${darkLight}; /* subtle but readable on white */
  font-size: 13px;
  text-align: left;
`;

export const LeftIcon = styled.View`
  left: 15px;
  top: 38px;
  position: absolute;
  z-index: 1;
`;

export const RightIcon = styled.TouchableOpacity`
  right: 15px;
  top: 38px;
  position: absolute;
  z-index: 1;
`;

export const StyledButton = styled.TouchableOpacity`
  padding: 15px;
  background-color: ${brand};
  justify-content: center;
  align-items: center;
  border-radius: 5px;
  margin-vertical: 5px;
  height: 60px;
`;

export const ButtonText = styled.Text`
  color: ${primary};
  font-size: 16px;
`;

export const MsgBox = styled.Text`
  text-align: center;
  font-size: 13px;
  color: ${darkLight};
`;

export const Line = styled.View`
  height: 1px;
  width: 100%;
  background-color: ${darkLight};
  margin-vertical: 10px;
`;

/* "Don't have an account? Signup" */
export const ExtraView = styled.View`
  width: 100%;
  flex-direction: row;
  justify-content: center;
  margin-vertical: 10px;
`;

export const ExtraText = styled.Text`
  color: ${darkLight};
  font-size: 14px;
`;

export const TextLink = styled.TouchableOpacity``;

export const TextLinkContent = styled.Text`
  color: ${brand};
  font-size: 14px;
  font-weight: 600;
`;

/* Google button placeholder action */
export const GoogleButton = styled.TouchableOpacity`
  padding: 15px;
  background-color: #34a853; /* Google green */
  justify-content: center;
  align-items: center;
  border-radius: 5px;
  margin-vertical: 5px;
  height: 60px;
  flex-direction: row;
`;

/*  UI cards/headers */
export const ScreenTitle = styled.Text`
  font-size: 28px;
  font-weight: 800;
  color: #0F172A; /* darker text on white */
  margin: 6px 0 2px 0;
`;

export const Card = styled.View`
  width: 100%;
  background-color: ${Colors.surface};  /* light gray card on white page */
  border-radius: 16px;
  padding: 16px;
  margin-vertical: 8px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 10px;
  elevation: 2;
`;

