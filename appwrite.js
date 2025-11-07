import { Platform } from 'react-native';
import {
  Client,
  Account,
  ID,
  Databases,
  Permission,
  Role,
  Query,
} from 'react-native-appwrite';

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const project  = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;

const client = new Client().setEndpoint(endpoint).setProject(project);

// Make auth work in Expo Go during development
const expoPlatform = Platform.select({
  ios: 'host.exp.Exponent',
  android: 'host.exp.exponent',
  default: undefined, // web doesn't need setPlatform
});
if (expoPlatform) client.setPlatform(expoPlatform);

// Auth
const account = new Account(client);

export const appwriteAuth = {
  signup: ({ fullName, email, password }) =>
    account.create(ID.unique(), email, password, fullName),
  login: ({ email, password }) =>
    account.createEmailPasswordSession(email, password),
  me: () => account.get(),
  logout: () => account.deleteSessions(),
};

// Database
export const databases = new Databases(client);

// Use real IDs from Appwrite Console
export const DB_ID = 'execudoc_db';
export const PROFILES_ID = 'profiles';

// Re-export helpers for convenience
export { ID, Permission, Role, Query };
