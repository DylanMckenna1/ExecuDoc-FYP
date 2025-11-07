import React, { useState } from 'react';
import Home from './screens/Home';
import Login from './screens/Login';
import Signup from './screens/Signup';
import Welcome from './screens/Welcome';
import { appwriteAuth } from './services/appwrite';

// DB imports, writes are guarded by USE_DB
import {
  databases, DB_ID, PROFILES_ID, ID, Permission, Role, Query,
} from './services/appwrite';

// const USE_DB = true;
const USE_DB = false;

export default function App() {
  const [screen, setScreen] = useState('home');   // 'home' | 'login' | 'signup' | 'welcome'
  const [user, setUser] = useState(null);

  // clear any stale session to avoid “session is active” errors
  const clearCurrentSession = async () => {
    try { await appwriteAuth.logout(); } catch {}
  };

  const ensureProfile = async (me) => {
    if (!USE_DB) return null;
    try {
      const list = await databases.listDocuments(
        DB_ID, PROFILES_ID, [Query.equal('userID', me.$id), Query.limit(1)]
      );
      if (list.total) return list.documents[0];

      const firstName = me.name?.split(' ')[0] || me.name || '';
      const rest = me.name?.split(' ').slice(1).join(' ');
      const lastName = rest && rest.trim().length ? rest : '-';

      return await databases.createDocument(
        DB_ID, PROFILES_ID, ID.unique(),
        { userID: me.$id, firstName, lastName, gender: 'not specif', birthDate: null, profilePicture: null },
        [
          Permission.read(Role.user(me.$id)),
          Permission.update(Role.user(me.$id)),
          Permission.delete(Role.user(me.$id)),
        ]
      );
    } catch (e) {
      console.log('ensureProfile error (ignored):', e?.message);
      return null;
    }
  };

  const handleLogin = async ({ email, password }) => {
    try {
      await clearCurrentSession();
      await appwriteAuth.login({ email, password });
      const me = await appwriteAuth.me();
      await ensureProfile(me); // ignored if USE_DB === false
      setUser({ email: me.email, name: me.name, id: me.$id });
      setScreen('welcome');
    } catch (e) {
      throw e; // let Login.js show the error
    }
  };

  const handleSignup = async ({ fullName, email, password }) => {
    try {
      await clearCurrentSession();
      await appwriteAuth.signup({ fullName, email, password });
      await appwriteAuth.login({ email, password }); // auto sign-in
      const me = await appwriteAuth.me();
      await ensureProfile(me); // ignored if USE_DB === false
      setUser({ email: me.email, name: me.name, id: me.$id });
      setScreen('welcome');
    } catch (e) {
      throw e; // let Signup.js show the error
    }
  };

  const handleLogout = async () => {
    try { await appwriteAuth.logout(); } catch {}
    setUser(null);
    setScreen('home');
  };

  // Navigation
  if (screen === 'home') {
    return <Home onLogin={() => setScreen('login')} onSignup={() => setScreen('signup')} />;
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
  return <Welcome user={user} onLogout={handleLogout} />;
}
