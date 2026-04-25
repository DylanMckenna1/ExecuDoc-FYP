// screens/Login.js
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ScrollView } from 'react-native';
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
// collect credentials, pass to app.js
  const Login = ({ onSignup, onLogin }) => {
  const [hidePassword, setHidePassword] = useState(true); // ui state for password visibility and errors
  const [msg, setMsg] = useState('');

  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      >
        <InnerContainer>
          {/* App logo */}
          <PageLogo
            resizeMode="contain"
            source={require('../assets/logo.png')}
          />
          <SubTitle>Account Login</SubTitle>

          <Formik // formik handle login form
            initialValues={{ email: '', password: '' }}
            onSubmit={async (values, actions) => { // submit login details
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
            {({ handleChange, handleBlur, handleSubmit, values, isSubmitting }) => ( // formik rendering block
              <StyledFormArea>
                <MyTextInput // email input
                  label="Email Address"
                  icon="mail"
                  placeholder="Enter your email"
                  placeholderTextColor={darkLight}
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  value={values.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <MyTextInput //password input
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

                {msg ? <MsgBox>{msg}</MsgBox> : <MsgBox>{' '}</MsgBox>}

                <StyledButton onPress={handleSubmit} disabled={isSubmitting}> 
                  <ButtonText>{isSubmitting ? 'Logging in…' : 'Login'}</ButtonText>
                </StyledButton>

                <Line />

                <ExtraView>
                  <ExtraText>Don&apos;t have an account already? </ExtraText>
                  <TextLink onPress={onSignup}>
                    <TextLinkContent>Signup</TextLinkContent>
                  </TextLink>
                </ExtraView>
              </StyledFormArea>
            )}
          </Formik>
        </InnerContainer>
      </ScrollView>
    </StyledContainer>
  );
};
// reusable input component
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
          {/* Ionicons v5 names */}
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

export default Login;
