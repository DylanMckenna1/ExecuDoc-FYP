// screens/Signup.js
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { Formik } from 'formik';
import { Octicons, Ionicons } from '@expo/vector-icons';

import {
  StyledContainer,
  InnerContainer,
  PageLogo,
  SubTitle,
  StyledFormArea,
  LeftIcon,
  StyledInputLabel,
  StyledTextInput,
  RightIcon,
  StyledButton,
  ButtonText,
  Colors,
  MsgBox,
  Line,
  ExtraView,
  ExtraText,
  TextLink,
  TextLinkContent,
} from '../components/styles';

const { brand, darkLight } = Colors;

export default function Signup({ onBack, onCreateAccount }) {
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);

  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <InnerContainer>
        <PageLogo resizeMode="contain" source={require('../assets/logo.png')} />
        <SubTitle>Account Signup</SubTitle>

        <Formik
          initialValues={{ fullName: '', email: '', password: '', confirmPassword: '' }}
          onSubmit={(values) => {
            // basic client check
            if (values.password !== values.confirmPassword) {
              alert('Passwords do not match.');
              return;
            }
            onCreateAccount?.({
              fullName: values.fullName.trim(),
              email: values.email.trim(),
              password: values.password,
            });
          }}
        >
          {({ handleChange, handleBlur, handleSubmit, values }) => (
            <StyledFormArea>
              <MyTextInput
                label="Full Name"
                icon="person"
                placeholder="Enter your Name"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('fullName')}
                onBlur={handleBlur('fullName')}
                value={values.fullName}
              />

              <MyTextInput
                label="Email Address"
                icon="mail"
                placeholder="Enter your Email"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('email')}
                onBlur={handleBlur('email')}
                value={values.email}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <MyTextInput
                label="Password"
                icon="lock"
                placeholder="********"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('password')}
                onBlur={handleBlur('password')}
                value={values.password}
                secureTextEntry={hidePassword}
                isPassword
                hidePassword={hidePassword}
                setHidePassword={setHidePassword}
              />

              <MyTextInput
                label="Confirm Password"
                icon="lock"
                placeholder="********"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                value={values.confirmPassword}
                secureTextEntry={hideConfirm}
                isPassword
                hidePassword={hideConfirm}
                setHidePassword={setHideConfirm}
              />

              <MsgBox>{' '}</MsgBox>

              <StyledButton onPress={handleSubmit}>
                <ButtonText>Create Account</ButtonText>
              </StyledButton>

              <Line />

              <ExtraView>
                <ExtraText>Already have an account? </ExtraText>
                <TextLink onPress={onBack}>
                  <TextLinkContent>Login</TextLinkContent>
                </TextLink>
              </ExtraView>
            </StyledFormArea>
          )}
        </Formik>
      </InnerContainer>
    </StyledContainer>
  );
}

const MyTextInput = ({
  label,
  icon,
  hidePassword,
  setHidePassword,
  isPassword,
  ...props
}) => {
  return (
    <View>
      <LeftIcon>
        <Octicons name={icon} size={30} color={brand} />
      </LeftIcon>

      <StyledInputLabel>{label}</StyledInputLabel>
      <StyledTextInput {...props} />

      {isPassword && (
        <RightIcon onPress={() => setHidePassword?.(!hidePassword)}>
          {/* Ionicons v5 names: 'eye' / 'eye-off' (no md- prefix) */}
          <Ionicons
            name={hidePassword ? 'eye-off' : 'eye'}
            size={28}
            color={darkLight}
          />
        </RightIcon>
      )}
    </View>
  );
};
