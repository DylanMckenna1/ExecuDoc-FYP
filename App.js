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

export default function App() {
  // 'home' | 'login' | 'signup' |
  const [screen, setScreen] = useState('home');
  const [user, setUser] = useState(null);

  // restore existing session on app start
  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      if (me) {
        setUser({ email: me.email, name: me.name, id: me.$id });
        setScreen('welcome');
      }
    })();
  }, []);

  // --- auth handlers ---

  const handleLogin = async ({ email, password }) => {
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail || !password) {
      throw new Error('Please enter both email and password.');
    }

    await login(trimmedEmail, password);
    const me = await getCurrentUser();
    if (!me) {
      throw new Error('Login succeeded but could not load user profile.');
    }

    setUser({ email: me.email, name: me.name, id: me.$id });
    setScreen('welcome');
  };

  const handleSignup = async ({ fullName, email, password, userType }) => {
  const trimmedEmail = (email || '').trim();
  const name = fullName && fullName.trim().length ? fullName.trim() : trimmedEmail;
  const normalisedUserType = (userType || '').trim().toLowerCase();

  if (!trimmedEmail || !password) {
    throw new Error('Please enter email and password.');
  }

  if (!normalisedUserType) {
    throw new Error('Please select what you use ExecuDoc for.');
  }

  await register(trimmedEmail, password, name);

  const me = await getCurrentUser();
  if (!me) {
    throw new Error('Account created but could not load user profile.');
  }

  await createOrUpdateUserProfile({
    userId: me.$id,
    fullName: name,
    userType: normalisedUserType,
  });

  setUser({ email: me.email, name: me.name, id: me.$id });
  setScreen('welcome');
};

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setScreen('home');
  };

  // --router --

  if (screen === 'home') {
    return (
      <Home
        onLogin={() => setScreen('login')}
        onSignup={() => setScreen('signup')}
      />
    );
  }

  if (screen === 'login') {
    return (
      <Login
        onSignup={() => setScreen('signup')}
        onLogin={handleLogin}
      />
    );
  }

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