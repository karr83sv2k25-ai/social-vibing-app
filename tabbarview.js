import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HomeScreen from './homescreen';
import CommunityScreen from './community';
import MessageScreen from './messagescreen'; 
import MarketPlaceScreen from './marketplace';  

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 65,
          backgroundColor: '#000', // black bar
          borderTopWidth: 0,
          paddingBottom: 5,
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


