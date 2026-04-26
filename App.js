// App.js
import React, { useState, useEffect } from 'react';

import Home from './screens/Home';
import Login from './screens/Login';
import Signup from './screens/Signup';
import MainTabs from "./screens/MainTabs";

import {
  login,
  register,
  getCurrentUser,
  logout,
  createOrUpdateUserProfile,
} from './services/appwrite';

const isValidEmail = (value) => /\S+@\S+\.\S+/.test((value || '').trim());

const formatAuthError = (error, fallback) => {
  const raw = (error?.message || '').trim();
  const message = raw.toLowerCase();

  if (!raw) return fallback;

  if (message.includes('invalid credentials')) {
    return 'Your email or password is incorrect.';
  }

  if (message.includes('password must be between 8 and 256 characters')) {
    return 'Your password must be between 8 and 256 characters.';
  }

  if (message.includes('value must be a valid email address')) {
    return 'Please enter a valid email address.';
  }

  if (message.includes('user already exists')) {
    return 'An account with this email already exists.';
  }

  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (message.includes('network')) {
    return 'We could not connect right now. Please check your connection and try again.';
  }

  return fallback;
};

export default function App() {
  //states
  const [screen, setScreen] = useState('home'); // decides what level screen to show
  const [user, setUser] = useState(null); // user stores the current logged in user object

  // restore existing session on app start
  useEffect(() => {
    (async () => {
      const me = await getCurrentUser(); // calls get Current user
      if (me) { //checks for valid session
        setUser(me); //set user
        setScreen('welcome');
      }
    })();
  }, []);

// -- Auth Handler -- 

// login handler
  const handleLogin = async ({ email, password }) => {
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail || !password) { //validate email/password
      throw new Error('Please enter both email and password.');
    }
    if (!isValidEmail(trimmedEmail)) {
      throw new Error('Please enter a valid email address.');
    }
    if (password.length < 8) {
      throw new Error('Your password must be at least 8 characters long.');
    }
 // call login
    try {
      await login(trimmedEmail, password);
    } catch (error) {
      throw new Error(formatAuthError(error, 'We could not sign you in. Please try again.'));
    }
    const me = await getCurrentUser(); // call current user
    if (!me) {
      throw new Error('Login succeeded but could not load user profile.');
    }

    setUser(me);
    setScreen('welcome');
  };
  // new account creation
  const handleSignup = async ({ fullName, email, password, userType }) => {
  const trimmedEmail = (email || '').trim(); // trim and validate email 
  const name = fullName && fullName.trim().length ? fullName.trim() : trimmedEmail; // display name from fulname / email
  const normalisedUserType = (userType || '').trim().toLowerCase();

  if (!trimmedEmail || !password) {
    throw new Error('Please complete your email address and password.');
  }

  if (!fullName.trim()) {
    throw new Error('Please enter your full name.');
  }

  if (!isValidEmail(trimmedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (password.length < 8) {
    throw new Error('Your password must be at least 8 characters long.');
  }

  if (!normalisedUserType) {
    throw new Error('Please select what you use ExecuDoc for.');
  }
// call register
  try {
    await register(trimmedEmail, password, name);
  } catch (error) {
    throw new Error(formatAuthError(error, 'We could not create your account. Please try again.'));
  }
// get new current user
  const me = await getCurrentUser();
  if (!me) {
    throw new Error('Account created but could not load user profile.');
  }
// update profiles table 
  await createOrUpdateUserProfile({
    userId: me.$id,
    fullName: name,
    userType: normalisedUserType,
  });

  setUser(me);
  setScreen('welcome');
};
// Logout
  const handleLogout = async () => {
    await logout(); // call logout
    setUser(null);
    setScreen('home');
  };

  // --router --
//Home
  if (screen === 'home') {
    return (
      <Home
        onLogin={() => setScreen('login')}
        onSignup={() => setScreen('signup')}
      />
    );
  }
//Login
  if (screen === 'login') {
    return (
      <Login
        onSignup={() => setScreen('signup')}
        onLogin={handleLogin}
      />
    );
  }
//Signup
  if (screen === 'signup') {
    return (
      <Signup
        onBack={() => setScreen('login')}
        onCreateAccount={handleSignup}
      />
    );
  }

 

  //  Main app (tabs)
return (
  <MainTabs
    user={user}
    onLogout={handleLogout}
  />
);
}
