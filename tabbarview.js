import React, { useState } from 'react';
import { View, Modal, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import HomeScreen from './homescreen';
import CommunityScreen from './community';
import MessageScreen from './messagescreen'; 
import MarketPlaceScreen from './marketplace';  

// Empty component for the Add button tab
const EmptyComponent = () => null;

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const [showAddOptions, setShowAddOptions] = useState(false);

  const addOptions = [
    { id: 'link', name: 'Link', icon: 'link', color: '#4A69FF', iconFamily: 'FontAwesome5' },
    { id: 'live', name: 'Go Live', icon: 'video', color: '#E440FC', iconFamily: 'FontAwesome5' },
    { id: 'image', name: 'Image', icon: 'image', color: '#FF4A4A', iconFamily: 'FontAwesome5' },
    { id: 'chat', name: 'Public Chatroom', icon: 'chat', color: '#40FC6F', iconFamily: 'MaterialCommunityIcons' },
    { id: 'blog', name: 'Blog', icon: 'newspaper', color: '#40DFFC', iconFamily: 'FontAwesome5' },
    { id: 'drafts', name: 'Drafts', icon: 'file-document-outline', color: '#4D4D6B', iconFamily: 'MaterialCommunityIcons' },
  ];

  const AddOptionsModal = () => (
    <Modal
      visible={showAddOptions}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddOptions(false)}
    >
      <View style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}>
        <View style={{
          backgroundColor: '#000',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          paddingBottom: 40,
        }}>
          {/* Close button */}
          <TouchableOpacity
            style={{
              alignSelf: 'center',
              marginBottom: 20,
              backgroundColor: '#fff',
              width: 40,
              height: 40,
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setShowAddOptions(false)}
          >
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>

          {/* Grid of options */}
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
            gap: 20,
          }}>
            {addOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={{
                  alignItems: 'center',
                  width: '30%',
                }}
                onPress={() => {
                  setShowAddOptions(false);
                  // Handle option selection here
                }}
              >
                <View style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: option.color,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  {option.iconFamily === 'FontAwesome5' ? (
                    <FontAwesome5 name={option.icon} size={24} color="#fff" />
                  ) : (
                    <MaterialCommunityIcons name={option.icon} size={24} color="#fff" />
                  )}
                </View>
                <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>
                  {option.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
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

      {/* � Shop (Marketplace) */}
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

      {/* ➕ Add Post */}
      <Tab.Screen
        name="AddPost"
        component={EmptyComponent}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setShowAddOptions(true);
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 50,
              height: 50,
              backgroundColor: '#08FFE2',
              borderRadius: 25,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
              shadowColor: '#08FFE2',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
              elevation: 4,
            }}>
              <Ionicons
                name="add"
                size={30}
                color="#000"
              />
            </View>
          ),
        }}
      />



      {/* 💬 Chat */}
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

      {/* � Community */}
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
    </Tab.Navigator>
      <AddOptionsModal />
    </>
  );
}