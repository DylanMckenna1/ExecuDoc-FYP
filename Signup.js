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
} from '../components/styles';

const { brand, darkLight } = Colors;

const Signup = ({ onBack, onCreateAccount }) => {
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);
  const [msg, setMsg] = useState('');

  return (
    <StyledContainer>
      <StatusBar style="light" />
      <InnerContainer>
        <PageLogo resizeMode="contain" source={require('../assets/execudoc-logo.jpg')} />
        <PageTitle>ExecuDoc</PageTitle>
        <SubTitle>Account Signup</SubTitle>

        <Formik
          initialValues={{ fullName: '', email: '', password: '', confirmPassword: '' }}
          onSubmit={async (values, actions) => {
            actions.setSubmitting(true);
            setMsg('');
            const fullName = values.fullName.trim();
            const email = values.email.trim();
            const password = values.password;

            // simple client checks to avoid silent fails
            if (!fullName || !email || !password) {
              setMsg('Please fill in all fields.');
              actions.setSubmitting(false);
              return;
            }
            if (password.length < 8) {
              setMsg('Password must be at least 8 characters.');
              actions.setSubmitting(false);
              return;
            }
            if (password !== values.confirmPassword) {
              setMsg('Passwords do not match.');
              actions.setSubmitting(false);
              return;
            }

            try {
              await onCreateAccount({ fullName, email, password }); // App.js handles navigation
            } catch (e) {
              // Show Appwrite error (e.g., "User already exists")
              setMsg(e?.message || 'Signup failed');
            } finally {
              actions.setSubmitting(false);
            }
          }}
        >
          {({ handleChange, handleBlur, handleSubmit, values, isSubmitting }) => (
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

              <MyTextInput
                label="Confirm Password"
                icon="lock"
                placeholder="* * * * * * * * *"
                placeholderTextColor={darkLight}
                onChangeText={handleChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                value={values.confirmPassword}
                secureTextEntry={hideConfirm}
                isPassword
                hidePassword={hideConfirm}
                setHidePassword={setHideConfirm}
              />

              {msg ? <MsgBox>{msg}</MsgBox> : null}

              <StyledButton onPress={handleSubmit} disabled={isSubmitting}>
                <ButtonText>{isSubmitting ? 'Creating…' : 'Create Account'}</ButtonText>
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
          <Ionicons name={hidePassword ? 'md-eye-off' : 'md-eye'} size={30} color={darkLight} />
        </RightIcon>
      )}
    </View>
  );
};

export default Signup;

