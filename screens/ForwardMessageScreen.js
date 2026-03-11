// screens/ForwardMessageScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { forwardMessage } from '../utils/messageControls';

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';

export default function ForwardMessageScreen({ route, navigation }) {
  const { message, conversationId: sourceConversationId } = route.params;
  const currentUserId = auth.currentUser?.uid;
  
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  
  useEffect(() => {
    loadConversations();
  }, []);
  
  useEffect(() => {
    if (searchText.trim()) {
      const filtered = conversations.filter(conv =>
        conv.name?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchText, conversations]);
  
  const loadConversations = async () => {
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', currentUserId)
      );
      
      const snapshot = await getDocs(q);
      const conversationsList = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let conversationName = '';
        let conversationImage = null;
        
        if (data.type === 'group') {
          conversationName = data.groupName || 'Unnamed Group';
          conversationImage = data.groupIcon;
        } else {
          // Get other user's name for direct chats
          const otherUserId = data.participants?.find(id => id !== currentUserId);
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              conversationName = userData.name || 'Unknown User';
              conversationImage = userData.profileImage;
            }
          }
        }
        
        conversationsList.push({
          id: docSnapshot.id,
          name: conversationName,
          image: conversationImage,
          type: data.type,
          ...data
        });
      }
      
      setConversations(conversationsList);
      setFilteredConversations(conversationsList);
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleSelection = (conversationId) => {
    setSelectedConversations(prev => {
      if (prev.includes(conversationId)) {
        return prev.filter(id => id !== conversationId);
      } else {
        return [...prev, conversationId];
      }
    });
  };
  
  const handleForward = async () => {
    if (selectedConversations.length === 0) {
      Alert.alert('No selection', 'Please select at least one conversation');
      return;
    }
    
    setForwarding(true);
    
    try {
      // Forward to each selected conversation
      const forwardPromises = selectedConversations.map(targetConversationId =>
        forwardMessage(
          sourceConversationId,
          message.id,
          targetConversationId,
          currentUserId
        )
      );
      
      await Promise.all(forwardPromises);
      
      Alert.alert(
        'Success',
        `Message forwarded to ${selectedConversations.length} ${selectedConversations.length === 1 ? 'conversation' : 'conversations'}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')
          }
        ]
      );
    } catch (error) {
      console.error('Error forwarding message:', error);
      Alert.alert('Error', 'Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };
  
  const renderConversation = ({ item }) => {
    const isSelected = selectedConversations.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.conversationRow, isSelected && styles.selectedRow]}
        onPress={() => toggleSelection(item.id)}
      >
        <View style={styles.checkbox}>
          {isSelected && (
            <Ionicons name="checkmark" size={20} color={ACCENT} />
          )}
        </View>
        
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons 
              name={item.type === 'group' ? 'people' : 'person'} 
              size={24} 
              color="#666" 
            />
          </View>
        )}
        
        <View style={styles.conversationInfo}>
          <Text style={styles.conversationName}>{item.name}</Text>
          {item.type === 'group' && (
            <Text style={styles.groupBadge}>
              {item.participants?.length || 0} members
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forward to...</Text>
        <TouchableOpacity
          onPress={handleForward}
          disabled={selectedConversations.length === 0 || forwarding}
        >
          {forwarding ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Text
              style={[
                styles.forwardButton,
                selectedConversations.length === 0 && styles.forwardButtonDisabled
              ]}
            >
              Send
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#666"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Selection count */}
      {selectedConversations.length > 0 && (
        <View style={styles.selectionBanner}>
          <Text style={styles.selectionText}>
            {selectedConversations.length} selected
          </Text>
        </View>
      )}
      
      {/* Message preview */}
      <View style={styles.messagePreview}>
        <Text style={styles.previewLabel}>Forwarding message:</Text>
        <View style={styles.previewContent}>
          {message.type === 'text' && (
            <Text style={styles.previewText} numberOfLines={2}>
              {message.text}
            </Text>
          )}
          {message.type === 'image' && (
            <View style={styles.previewMedia}>
              <Ionicons name="image" size={20} color="#666" />
              <Text style={styles.previewText}>Image</Text>
            </View>
          )}
          {message.type === 'video' && (
            <View style={styles.previewMedia}>
              <Ionicons name="videocam" size={20} color="#666" />
              <Text style={styles.previewText}>Video</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Conversations list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>
                {searchText ? 'No conversations found' : 'No conversations'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center'
  },
  forwardButton: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600'
  },
  forwardButtonDisabled: {
    color: '#666'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16
  },
  selectionBanner: {
    backgroundColor: ACCENT,
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  selectionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  messagePreview: {
    backgroundColor: CARD,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  previewLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  previewText: {
    color: '#fff',
    fontSize: 14
  },
  previewMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  listContent: {
    paddingVertical: 8
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  selectedRow: {
    backgroundColor: '#1a1a24'
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center'
  },
  conversationInfo: {
    flex: 1
  },
  conversationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2
  },
  groupBadge: {
    color: '#999',
    fontSize: 12
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12
  }
});
