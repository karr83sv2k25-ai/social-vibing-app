import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './homescreen';
import CommunityScreen from './community';
import MessageScreen from './messagescreen'; 
import MarketPlaceScreen from './marketplace';  

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      sceneContainerStyle={{ paddingBottom: 80 }}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          height: 64,
          borderRadius: 16,
          backgroundColor: '#000', // black bar
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 8,
          // Make sure tab bar is above other content
          elevation: 20,
          zIndex: 999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      {/* 🏠 Home */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={26}
              color={focused ? '#08FFE2' : '#fff'}
            />
          ),
        }}
      />

      {/* 👥 Community */}
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={26}
              color={focused ? '#08FFE2' : '#fff'}
            />
          ),
        }}
      />

      {/* 💬 Message */}
      <Tab.Screen
        name="Message"
        component={MessageScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'chatbubble' : 'chatbubble-outline'}
              size={26}
              color={focused ? '#08FFE2' : '#fff'}
            />
          ),
        }}
      />

      {/* 🛒 Marketplace */}
      <Tab.Screen
        name="Marketplace"
        component={MarketPlaceScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'cart' : 'cart-outline'}
              size={26}
              color={focused ? '#08FFE2' : '#fff'}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}


