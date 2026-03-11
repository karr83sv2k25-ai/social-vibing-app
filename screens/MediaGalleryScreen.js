// screens/MediaGalleryScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  Linking,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');
const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';

export default function MediaGalleryScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const [activeTab, setActiveTab] = useState('media'); // media, links, docs
  const [mediaItems, setMediaItems] = useState([]);
  const [links, setLinks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  useEffect(() => {
    loadMedia();
  }, [conversationId]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const media = [];
      const linksList = [];
      const docs = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check for images/videos
        if (data.imageUrl) {
          media.push({
            id: doc.id,
            url: data.imageUrl,
            type: 'image',
            timestamp: data.createdAt,
            senderName: data.senderName || 'Unknown'
          });
        }
        
        // Check for links in text
        if (data.text) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const foundLinks = data.text.match(urlRegex);
          if (foundLinks) {
            foundLinks.forEach(link => {
              linksList.push({
                id: doc.id + '-' + link,
                url: link,
                text: data.text,
                timestamp: data.createdAt,
                senderName: data.senderName || 'Unknown'
              });
            });
          }
        }

        // Check for file attachments
        if (data.fileUrl && data.fileName) {
          docs.push({
            id: doc.id,
            url: data.fileUrl,
            name: data.fileName,
            type: data.fileType || 'file',
            size: data.fileSize,
            timestamp: data.createdAt,
            senderName: data.senderName || 'Unknown'
          });
        }
      });

      setMediaItems(media);
      setLinks(linksList);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading media:', error);
      Alert.alert('Error', 'Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const openImage = (item) => {
    setSelectedImage(item);
    setFullscreenVisible(true);
  };

  const openLink = async (url) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open this link');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderMediaItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.mediaItem}
      onPress={() => openImage(item)}
    >
      <Image source={{ uri: item.url }} style={styles.mediaThumbnail} />
    </TouchableOpacity>
  );

  const renderLinkItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.linkItem}
      onPress={() => openLink(item.url)}
    >
      <View style={styles.linkIcon}>
        <Ionicons name="link" size={20} color={ACCENT} />
      </View>
      <View style={styles.linkContent}>
        <Text style={styles.linkUrl} numberOfLines={1}>{item.url}</Text>
        <Text style={styles.linkText} numberOfLines={2}>{item.text}</Text>
        <Text style={styles.linkMeta}>{item.senderName} • {formatDate(item.timestamp)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={TEXT_DIM} />
    </TouchableOpacity>
  );

  const renderDocItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.docItem}
      onPress={() => openLink(item.url)}
    >
      <View style={styles.docIcon}>
        <MaterialCommunityIcons 
          name={
            item.type === 'pdf' ? 'file-pdf-box' :
            item.type === 'doc' || item.type === 'docx' ? 'file-word-box' :
            item.type === 'xls' || item.type === 'xlsx' ? 'file-excel-box' :
            'file-document'
          } 
          size={32} 
          color={ACCENT} 
        />
      </View>
      <View style={styles.docContent}>
        <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.docMeta}>
          {formatFileSize(item.size)} • {item.senderName} • {formatDate(item.timestamp)}
        </Text>
      </View>
      <Ionicons name="download" size={20} color={TEXT_DIM} />
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'media':
        if (mediaItems.length === 0) {
          return (
            <View style={styles.centerContainer}>
              <Ionicons name="images-outline" size={64} color={TEXT_DIM} />
              <Text style={styles.emptyText}>No media shared yet</Text>
            </View>
          );
        }
        return (
          <FlatList
            data={mediaItems}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.mediaGrid}
          />
        );

      case 'links':
        if (links.length === 0) {
          return (
            <View style={styles.centerContainer}>
              <Ionicons name="link-outline" size={64} color={TEXT_DIM} />
              <Text style={styles.emptyText}>No links shared yet</Text>
            </View>
          );
        }
        return (
          <FlatList
            data={links}
            renderItem={renderLinkItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        );

      case 'docs':
        if (documents.length === 0) {
          return (
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="file-document-outline" size={64} color={TEXT_DIM} />
              <Text style={styles.emptyText}>No documents shared yet</Text>
            </View>
          );
        }
        return (
          <FlatList
            data={documents}
            renderItem={renderDocItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Media & Files</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'media' && styles.activeTab]}
          onPress={() => setActiveTab('media')}
        >
          <Ionicons name="images" size={20} color={activeTab === 'media' ? ACCENT : TEXT_DIM} />
          <Text style={[styles.tabText, activeTab === 'media' && styles.activeTabText]}>
            Media ({mediaItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'links' && styles.activeTab]}
          onPress={() => setActiveTab('links')}
        >
          <Ionicons name="link" size={20} color={activeTab === 'links' ? ACCENT : TEXT_DIM} />
          <Text style={[styles.tabText, activeTab === 'links' && styles.activeTabText]}>
            Links ({links.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'docs' && styles.activeTab]}
          onPress={() => setActiveTab('docs')}
        >
          <MaterialCommunityIcons name="file-document" size={20} color={activeTab === 'docs' ? ACCENT : TEXT_DIM} />
          <Text style={[styles.tabText, activeTab === 'docs' && styles.activeTabText]}>
            Docs ({documents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {renderContent()}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={fullscreenVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setFullscreenVisible(false)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {selectedImage && (
            <>
              <Image 
                source={{ uri: selectedImage.url }} 
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <View style={styles.imageInfo}>
                <Text style={styles.imageSender}>{selectedImage.senderName}</Text>
                <Text style={styles.imageDate}>{formatDate(selectedImage.timestamp)}</Text>
              </View>
            </>
          )}
        </View>
      </Modal>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: CARD,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2F',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: ACCENT + '20',
  },
  tabText: {
    fontSize: 13,
    color: TEXT_DIM,
    fontWeight: '500',
  },
  activeTabText: {
    color: ACCENT,
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
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: TEXT_DIM,
  },
  mediaGrid: {
    padding: 2,
  },
  mediaItem: {
    width: (width - 6) / 3,
    height: (width - 6) / 3,
    padding: 1,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD,
  },
  listContainer: {
    padding: 16,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkContent: {
    flex: 1,
  },
  linkUrl: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '500',
    marginBottom: 4,
  },
  linkText: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 4,
  },
  linkMeta: {
    fontSize: 11,
    color: TEXT_DIM,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  docIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docContent: {
    flex: 1,
  },
  docName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 11,
    color: TEXT_DIM,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  imageInfo: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
  },
  imageSender: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  imageDate: {
    fontSize: 12,
    color: TEXT_DIM,
    marginTop: 4,
  },
});
