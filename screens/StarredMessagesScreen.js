// screens/StarredMessagesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MessageItem } from '../components/MessageItemEnhanced';

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export default function StarredMessagesScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const currentUserId = auth.currentUser?.uid;
  
  const [starredMessages, setStarredMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStarredMessages();
  }, [conversationId]);

  const loadStarredMessages = async () => {
    try {
      setLoading(true);
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        Alert.alert('Error', 'Conversation not found');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        return;
      }

      const data = conversationSnap.data();
      const userSettings = data.userSettings?.[currentUserId];
      const pinnedMessageIds = userSettings?.pinnedMessages || [];

      if (pinnedMessageIds.length === 0) {
        setStarredMessages([]);
        setLoading(false);
        return;
      }

      // Load all pinned messages
      const messages = [];
      for (const messageId of pinnedMessageIds) {
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        const messageSnap = await getDoc(messageRef);
        if (messageSnap.exists()) {
          messages.push({
            id: messageSnap.id,
            ...messageSnap.data()
          });
        }
      }

      // Sort by creation date (newest first)
      messages.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

      setStarredMessages(messages);
    } catch (error) {
      console.error('Error loading starred messages:', error);
      Alert.alert('Error', 'Failed to load starred messages');
    } finally {
      setLoading(false);
    }
  };

  const handleUnstar = async (messageId) => {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        [`userSettings.${currentUserId}.pinnedMessages`]: arrayRemove(messageId)
      });

      // Update local state
      setStarredMessages(prev => prev.filter(msg => msg.id !== messageId));
      Alert.alert('Success', 'Message unstarred');
    } catch (error) {
      console.error('Error unstarring message:', error);
      Alert.alert('Error', 'Failed to unstar message');
    }
  };

  const handleMessageLongPress = (message) => {
    Alert.alert(
      'Unstar Message',
      'Remove this message from starred?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unstar', 
          style: 'destructive',
          onPress: () => handleUnstar(message.id)
        }
      ]
    );
  };

  const renderMessage = ({ item }) => (
    <View style={styles.messageContainer}>
      <MessageItem
        message={item}
        currentUserId={currentUserId}
        onLongPress={() => handleMessageLongPress(item)}
      />
      <TouchableOpacity
        style={styles.unstarButton}
        onPress={() => handleUnstar(item.id)}
      >
        <Ionicons name="star" size={20} color="#FFD700" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Starred Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading starred messages...</Text>
        </View>
      ) : starredMessages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="star-outline" size={64} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>No Starred Messages</Text>
          <Text style={styles.emptySubtitle}>
            Long press a message and select "Star" to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={starredMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2F',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: TEXT_DIM,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  messageContainer: {
    position: 'relative',
  },
  unstarButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 8,
  },
  separator: {
    height: 16,
  },
});
