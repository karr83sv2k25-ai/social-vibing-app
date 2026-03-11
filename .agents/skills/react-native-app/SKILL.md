---
name: react-native-app
description: Build cross-platform mobile apps with React Native. Covers navigation with React Navigation, state management with Redux/Context API, API integration, and platform-specific features.
---

# React Native App Development

## Overview

Create robust cross-platform mobile applications using React Native with modern development patterns including navigation, state management, API integration, and native module handling.

## Social Vibing Alignment Notes

When working inside this repository, prefer these project-specific conventions over generic React Native defaults:

- Use Expo SDK 54 / React Native 0.81 patterns.
- Root navigation lives in `App.js` with `createStackNavigator`; bottom tabs live in `tabbarview.js`.
- Prefer Context over Redux. The app standard is `WalletContext` and `StatusContext`, with local component state and Firestore listeners.
- Prefer Firebase Auth + Firestore via `firebaseConfig.js`; do not re-initialize Firebase.
- Prefer retry/cache wrappers from `utils/firestoreHelpers.js` such as `getDocWithRetry`, `getDocsWithRetry`, and `fetchUserWithCache` instead of raw Firestore reads.
- Use `CacheManager` for frequently reused profile/community data.
- Use `components/CachedImage.js` for remote images instead of raw network `<Image>`.
- Use skeleton loaders from `components/SkeletonLoaders.js` for loading states.
- For media uploads, use Hostinger helpers from `hostingerConfig.js` / `utils/fileUpload.js`; do not add Firebase Storage uploads.
- Guard native-only features such as Agora and IAP with `isExpoGo()` from `utils/platformCheck.js`.
- For large lists, use optimized `FlatList` props; avoid `.map()` inside `ScrollView` for data-heavy screens.
- Preserve existing Firestore moderation schemas and soft-delete fields used by the companion admin app.

## When to Use

- Building iOS and Android apps from single codebase
- Rapid prototyping for mobile platforms
- Leveraging web development skills for mobile
- Sharing code between React Native and React Web
- Integrating with native modules and APIs

## Instructions

### 1. **Project Setup & Navigation**

```javascript
// Navigation with React Navigation
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#6200ee' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' }
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home Feed' }}
      />
      <Stack.Screen name="Details" component={DetailsScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            HomeTab: focused ? 'home' : 'home-outline',
            ProfileTab: focused ? 'person' : 'person-outline'
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        }
      })}>
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

### 2. **State Management with Context / local state**

```javascript
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      try {
        setLoading(true);
        const result = await fetchWallet();
        if (active) setWallet(result);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWallet();
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ wallet, loading }), [wallet, loading]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  return useContext(WalletContext);
}

export function HomeScreen() {
  const { wallet, loading } = useWallet();

  if (loading) return <ActivityIndicator size="large" />;

  return (
    <Text>{wallet?.coins ?? 0} coins</Text>
  );
}
```

### 3. **Firebase / service integration**

```javascript
import { doc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import CacheManager from './cacheManager';
import { getDocWithRetry, fetchUserWithCache } from './utils/firestoreHelpers';

export async function loadCurrentUser(userId) {
  return fetchUserWithCache(userId, db, CacheManager);
}

export async function loadCommunity(communityId) {
  const snapshot = await getDocWithRetry(doc(db, 'communities', communityId), {
    timeout: 8000,
    retries: 2,
  });

  return snapshot?.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
```

### 4. **Functional Component with Hooks**

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';

export function DetailsScreen({ route, navigation }) {
  const { itemId } = route.params;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://api.example.com/items/${itemId}`
      );
      const data = await response.json();
      setItem(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  if (loading) return <ActivityIndicator size="large" />;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{item?.title}</Text>
      <Text style={styles.description}>{item?.description}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  description: { fontSize: 16, color: '#666', marginBottom: 16 },
  button: { backgroundColor: '#6200ee', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' }
});
```

## Best Practices

### ✅ DO
- Use functional components with React Hooks
- Implement proper error handling and loading states
- Prefer Context + local state when the app already follows that pattern
- Leverage React Navigation for routing
- Optimize list rendering with FlatList
- Use repository helpers for Firestore retries/caching
- Use `CachedImage` for remote images and shared skeleton loaders for loading UI
- Keep native-only features behind `isExpoGo()` guards in Expo projects
- Handle platform-specific code elegantly
- Use TypeScript for type safety
- Test on both iOS and Android
- Use environment variables for API endpoints
- Implement proper memory management

### ❌ DON'T
- Use inline styles excessively (use StyleSheet)
- Make API calls without error handling
- Store sensitive data in plain text
- Ignore platform differences
- Create large monolithic components
- Use index as key in lists
- Add Firebase Storage for uploads in this repository
- Bypass project Firestore helper utilities for repeated reads
- Make synchronous operations
- Ignore battery optimization
- Deploy without testing on real devices
- Forget to unsubscribe from listeners
