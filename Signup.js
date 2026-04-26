// screens/Signup.js
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
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
// define user type
const USER_TYPE_OPTIONS = [
  {
    label: 'Student',
    value: 'student',
    subtitle: 'Notes, assignments, and study material',
    icon: 'school-outline',
  },
  {
    label: 'Professional',
    value: 'professional',
    subtitle: 'Work files, reports, and business documents',
    icon: 'briefcase-outline',
  },
  {
    label: 'Personal',
    value: 'personal',
    subtitle: 'Everyday files and personal records',
    icon: 'person-outline',
  },
];

export default function Signup({ onBack, onCreateAccount }) // props it receives for back to login and handles account sign up in app.js
{// states 
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);
  const [msg, setMsg] = useState(''); // show sign up error message

  return (
    <StyledContainer>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        > 
          <InnerContainer> 
            <PageLogo resizeMode="contain" source={require('../assets/logo.png')} /> 
            <SubTitle>Account Signup</SubTitle>
            <Text
              style={{
                color: darkLight,
                fontSize: 14,
                lineHeight: 21,
                textAlign: 'center',
                marginTop: -8,
                marginBottom: 18,
                width: '84%',
              }}
            >
              Create your account to upload documents, generate summaries, and use voice controls.
            </Text>
            
            <Formik // form handling
              initialValues={{
                fullName: '',
                email: '',
                password: '',
                confirmPassword: '',
                userType: '',
              }}
              onSubmit={async (values, actions) => { // on submit
  setMsg('');
  if (values.password !== values.confirmPassword) { //check passwords match
    setMsg('Your passwords do not match. Please re-enter them.');
    return;
  }

  if (!values.userType) { // checks if user types selected
    setMsg('Please select what you use ExecuDoc for.');
    return;
  }

  actions.setSubmitting(true); // set submitting state

  try {
    setMsg(''); // clear previous message 
    await onCreateAccount?.({  // call onCreateAccount
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      password: values.password,
      userType: values.userType,
    });
  } catch (e) { // fail if error and display
    setMsg(e?.message || 'Signup failed'); 
  } finally { // stops submitting
    actions.setSubmitting(false);
  }
}}
            >
              {({ handleChange, handleBlur, handleSubmit, values, isSubmitting }) => ( // formik rendering block gives access 
                <StyledFormArea>
                  <MyTextInput // full name input 
                    label="Full Name"
                    icon="person"
                    placeholder="Enter your name"
                    placeholderTextColor={darkLight}
                    onChangeText={handleChange('fullName')}
                    onBlur={handleBlur('fullName')}
                    value={values.fullName}
                  />

                  <MyTextInput // email input for authentication
                    label="Email Address"
                    icon="mail"
                    placeholder="Enter your email"
                    placeholderTextColor={darkLight}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    value={values.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <MyTextInput // password input 
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
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    textContentType="oneTimeCode"
                    importantForAutofill="no"
                  />

                  <MyTextInput // confirm password input
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
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    textContentType="oneTimeCode"
                    importantForAutofill="no"
                  />
               
                  <View style={{ marginTop: 6, marginBottom: 8 }}> 
                    <StyledInputLabel>What do you use ExecuDoc for?</StyledInputLabel> 

                    <View style={{ marginTop: 10 }}>
                      {USER_TYPE_OPTIONS.map((option) => { // Render each user type as a selectable card from the options array
                        const selected = values.userType === option.value;

                        return (
                          <TouchableOpacity
                            key={option.value} // updates current formik user type 
                            activeOpacity={0.85}
                            onPress={() => handleChange('userType')(option.value)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 14,
                              paddingHorizontal: 14,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: selected ? brand : '#E2E8F0',
                              backgroundColor: selected ? '#EEF2FF' : '#FFFFFF',
                              marginBottom: 10,
                            }}
                          >
                            <View
                              style={{ //represents the selected user type option
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: selected ? brand : '#F8FAFC',
                                marginRight: 12,
                              }}
                            >
                              <Ionicons 
                                name={option.icon}
                                size={18}
                                color={selected ? '#FFFFFF' : brand}
                              />
                            </View>

                            <View style={{ flex: 1 }}> 
                              <Text // user type label and description
                                style={{
                                  fontSize: 15,
                                  fontWeight: '800',
                                  color: '#0F172A',
                                }}
                              >
                                {option.label}
                              </Text>

                              <Text
                                style={{
                                  marginTop: 2,
                                  fontSize: 12,
                                  color: '#64748B',
                                  lineHeight: 18,
                                }}
                              >
                                {option.subtitle}
                              </Text>
                            </View>

                            <View // show which user type is selected
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                borderWidth: 2,
                                borderColor: selected ? brand : '#CBD5E1',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: 10,
                              }}
                            >
                              {selected ? (
                                <View
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 999,
                                    backgroundColor: brand,
                                  }}
                                />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                   
                 {msg ? <MsgBox>{msg}</MsgBox> : <MsgBox>{' '}</MsgBox>} 

                 <StyledButton onPress={handleSubmit} disabled={isSubmitting}> 
                    <ButtonText>{isSubmitting ? 'Creating account…' : 'Create Account'}</ButtonText>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </StyledContainer>
  );
}
// reusable helper for icons/ input label and input field
const MyTextInput = ({
  label,
  icon,
  hidePassword,
  setHidePassword,
  isPassword,
  ...props
}) => {
  return ( // show the type of input field
    <View style={{ marginBottom: 2 }}> 
      <LeftIcon> 
        <Octicons name={icon} size={28} color={brand} />
      </LeftIcon>

      <StyledInputLabel>{label}</StyledInputLabel> 
      <StyledTextInput {...props} /> 

      {isPassword && (
        <RightIcon onPress={() => setHidePassword?.(!hidePassword)}>
          <Ionicons
            name={hidePassword ? 'eye-off' : 'eye'}
            size={26}
            color={darkLight}
          />
        </RightIcon>
      )}
    </View>
  );
};
