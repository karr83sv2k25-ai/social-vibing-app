import React, { useState } from 'react';
import { View, Modal, Text, TouchableOpacity, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import HomeScreen from './homescreen';
import CommunityScreen from './community';
import MessageScreen from './messagescreen'; 
import MarketPlaceScreen from './marketplace';  

// Empty component for the Add button tab
const EmptyComponent = () => null;

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const navigation = useNavigation();
  const [showAddOptions, setShowAddOptions] = useState(false);

  const handleAddOption = (option) => {
    setShowAddOptions(false);
    switch (option.id) {
      case 'post':
        // Navigate to create post - open WhatsHappening screen
        navigation.navigate('WhatsHappening');
        break;
      case 'story':
        // Navigate to create story - can use WhatsHappening with story mode
        navigation.navigate('WhatsHappening');
        break;
      case 'live':
        // Navigate to screen sharing/live stream
        navigation.navigate('ScreenSharingRoom');
        break;
      case 'community':
        // Navigate to create community
        navigation.navigate('CreateCommunityScreen');
        break;
      case 'collections':
        // Navigate to marketplace to create collection/store
        navigation.navigate('StoreManagment');
        break;
      case 'question':
        // Navigate to create post with question type
        navigation.navigate('WhatsHappening');
        break;
      case 'quiz':
        // Navigate to create quiz post
        navigation.navigate('WhatsHappening');
        break;
      case 'poll':
        // Navigate to create poll post
        navigation.navigate('WhatsHappening');
        break;
      case 'draft':
        // Navigate to profile or posts management
        navigation.navigate('Profile');
        break;
      default:
        break;
    }
  };

  const addOptions = [
    { id: 'post', name: 'Post', icon: 'add', color: '#FFD700', iconFamily: 'Ionicons' },
    { id: 'story', name: 'Story', icon: 'camera', color: '#FF69B4', iconFamily: 'Ionicons' },
    { id: 'live', name: 'Go live', icon: 'videocam', color: '#4169E1', iconFamily: 'Ionicons' },
    { id: 'community', name: 'Community', icon: 'people', color: '#FF6347', iconFamily: 'Ionicons' },
    { id: 'collections', name: 'Collections', icon: 'gift', color: '#00CED1', iconFamily: 'Ionicons' },
    { id: 'question', name: 'Question', icon: 'help-circle', color: '#1E90FF', iconFamily: 'Ionicons' },
    { id: 'quiz', name: 'Quiz', icon: 'checkmark-done', color: '#32CD32', iconFamily: 'Ionicons' },
    { id: 'poll', name: 'Poll', icon: 'bar-chart', color: '#FF8C00', iconFamily: 'Ionicons' },
    { id: 'draft', name: 'Draft', icon: 'create', color: '#00FF00', iconFamily: 'Ionicons' },
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
            paddingHorizontal: 10,
          }}>
            {addOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={{
                  alignItems: 'center',
                  width: '30%',
                  marginBottom: 20,
                }}
                onPress={() => handleAddOption(option)}
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
                  {option.iconFamily === 'Ionicons' ? (
                    <Ionicons name={option.icon} size={24} color="#fff" />
                  ) : option.iconFamily === 'FontAwesome5' ? (
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
