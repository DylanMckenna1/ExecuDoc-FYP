// App.js
import React, { useState, useEffect } from 'react';

import Home from './screens/Home';
import Login from './screens/Login';
import Signup from './screens/Signup';
import Welcome from './screens/Welcome';
import Documents from './screens/Documents';
import MainTabs from "./screens/MainTabs";


import {
  login,
  register,
  getCurrentUser,
  logout,
} from './services/appwrite';

export default function App() {
  // simple router: 'home' | 'login' | 'signup' | 'welcome' | 'documents'
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

  const handleSignup = async ({ fullName, email, password }) => {
    const trimmedEmail = (email || '').trim();
    const name = fullName && fullName.trim().length ? fullName.trim() : trimmedEmail;

    if (!trimmedEmail || !password) {
      throw new Error('Please enter email and password.');
    }

    // register() will also create a session
    await register(trimmedEmail, password, name);
    const me = await getCurrentUser();
    if (!me) {
      throw new Error('Account created but could not load user profile.');
    }

    setUser({ email: me.email, name: me.name, id: me.$id });
    setScreen('welcome');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setScreen('home');
  };

  // --- “router” ---

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
        onGoogleSignIn={() => alert('Google Sign-In coming soon')}
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

  if (screen === 'documents') {
    // make sure user exists before opening Documents
    if (!user) {
      return (
        <Home
          onLogin={() => setScreen('login')}
          onSignup={() => setScreen('signup')}
        />
      );
    }
    return <Documents user={user} onBack={() => setScreen('welcome')} />;
  }

  // Default: Main app (tabs)
return (
  <MainTabs
    user={user}
    onLogout={handleLogout}
    onOpenProfile={() => alert("Profile coming next")}
  />
);
}