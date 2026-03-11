// screens/SearchInChatScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MessageItem } from '../components/MessageItemEnhanced';

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export default function SearchInChatScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const currentUserId = auth.currentUser?.uid;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [allMessages, setAllMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadAllMessages();
  }, [conversationId]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      performSearch(searchQuery);
    } else {
      setFilteredMessages([]);
    }
  }, [searchQuery]);

  const loadAllMessages = async () => {
    try {
      setLoading(true);
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setAllMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = (query) => {
    setSearching(true);
    const lowerQuery = query.toLowerCase().trim();

    const results = allMessages.filter((message) => {
      // Search in message text
      if (message.text && message.text.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Search in sender name
      if (message.senderName && message.senderName.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in file names
      if (message.fileName && message.fileName.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });

    setFilteredMessages(results);
    setSearching(false);
  };

  const highlightText = (text, query) => {
    if (!text || !query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text>
        {parts.map((part, index) => (
          <Text
            key={index}
            style={
              part.toLowerCase() === query.toLowerCase()
                ? styles.highlightedText
                : styles.normalText
            }
          >
            {part}
          </Text>
        ))}
      </Text>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) { // Less than 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        // Navigate back to chat and jump to this message
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        // You can pass the messageId to scroll to it
      }}
    >
      <View style={styles.resultContent}>
        <View style={styles.resultHeader}>
          <Text style={styles.senderName}>{item.senderName || 'Unknown'}</Text>
          <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
        </View>
        
        {item.text && (
          <View style={styles.messageTextContainer}>
            {highlightText(item.text, searchQuery)}
          </View>
        )}
        
        {item.imageUrl && (
          <View style={styles.mediaIndicator}>
            <Ionicons name="image" size={16} color={ACCENT} />
            <Text style={styles.mediaText}>Photo</Text>
          </View>
        )}
        
        {item.fileName && (
          <View style={styles.mediaIndicator}>
            <Ionicons name="document" size={16} color={ACCENT} />
            <Text style={styles.mediaText}>{item.fileName}</Text>
          </View>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={TEXT_DIM} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={TEXT_DIM} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search in chat..."
            placeholderTextColor={TEXT_DIM}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={TEXT_DIM} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : searchQuery.trim().length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>Search Messages</Text>
          <Text style={styles.emptySubtitle}>
            Type to search for messages, names, or files
          </Text>
        </View>
      ) : searching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : filteredMessages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptySubtitle}>
            No messages found for "{searchQuery}"
          </Text>
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsCount}>
            {filteredMessages.length} {filteredMessages.length === 1 ? 'result' : 'results'}
          </Text>
          <FlatList
            data={filteredMessages}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2F',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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
  resultsContainer: {
    flex: 1,
  },
  resultsCount: {
    fontSize: 13,
    color: TEXT_DIM,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2F',
  },
  listContainer: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    color: TEXT_DIM,
  },
  messageTextContainer: {
    marginBottom: 4,
  },
  normalText: {
    fontSize: 14,
    color: '#fff',
  },
  highlightedText: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
    backgroundColor: ACCENT + '20',
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  mediaText: {
    fontSize: 13,
    color: ACCENT,
  },
});
