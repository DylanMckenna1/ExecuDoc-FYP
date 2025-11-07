import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Formik } from 'formik';
import { Octicons, Ionicons } from '@expo/vector-icons';

import {
  StyledContainer,
  InnerContainer,
  PageLogo,
  PageTitle,
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
  GoogleButton,
} from '../components/styles';

const { brand, darkLight } = Colors;

const Login = ({ onSignup, onGoogleSignIn, onLogin }) => {
  const [hidePassword, setHidePassword] = useState(true);
  const [msg, setMsg] = useState('');

  return (
    <StyledContainer>
      <StatusBar style="light" />
      <InnerContainer>
        {/* Swap to logo.png later */}
        <PageLogo resizeMode="contain" source={require('../assets/execudoc-logo.jpg')} />
        <PageTitle>ExecuDoc</PageTitle>
        <SubTitle>Account Login</SubTitle>

        <Formik
          initialValues={{ email: '', password: '' }}
          onSubmit={async (values, actions) => {
            actions.setSubmitting(true);
            const email = values.email.trim();
            const password = values.password;
            try {
              setMsg('');
              await onLogin({ email, password }); // App.js navigates on success
            } catch (e) {
              setMsg(e?.message || 'Login failed');
            } finally {
              actions.setSubmitting(false);
            }
          }}
        >
          {({ handleChange, handleBlur, handleSubmit, values, isSubmitting }) => (
            <StyledFormArea>
              <MyTextInput
                label="Email Address"
                icon="mail"
                placeholder="Enter your Email"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('email')}
                onBlur={handleBlur('email')}
                value={values.email}
                keyboardType="email-address"
              />

              <MyTextInput
                label="Password"
                icon="lock"
                placeholder="* * * * * * * * *"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('password')}
                onBlur={handleBlur('password')}
                value={values.password}
                secureTextEntry={hidePassword}
                isPassword
                hidePassword={hidePassword}
                setHidePassword={setHidePassword}
              />

              {msg ? <MsgBox>{msg}</MsgBox> : null}

              <StyledButton onPress={handleSubmit} disabled={isSubmitting}>
                <ButtonText>{isSubmitting ? 'Logging in…' : 'Login'}</ButtonText>
              </StyledButton>

              <Line />

              <GoogleButton
                onPress={() =>
                  onGoogleSignIn
                    ? onGoogleSignIn()
                    : alert('Google Sign-In coming soon')
                }
              >
                <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 8 }} />
                <ButtonText>Sign in with Google</ButtonText>
              </GoogleButton>

              <ExtraView>
                <ExtraText>Don't have an account already? </ExtraText>
                <TextLink onPress={onSignup}>
                  <TextLinkContent>Signup</TextLinkContent>
                </TextLink>
              </ExtraView>
            </StyledFormArea>
          )}
        </Formik>
      </InnerContainer>
    </StyledContainer>
  );
};

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
        <RightIcon onPress={() => setHidePassword(!hidePassword)}>
          <Ionicons
            name={hidePassword ? 'md-eye-off' : 'md-eye'}
            size={30}
            color={darkLight}
          />
        </RightIcon>
      )}
    </View>
  );
};

export default Login;
