import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

const ACCENT = '#7C3AED';
const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';
const DANGER = '#EF4444';

const Avatar = ({ name, size = 50, source }) => {
  const initials = React.useMemo(() => {
    if (!name) return '';
    return name
      .split(' ')
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [name]);

  return source ? (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: `${ACCENT}88`,
        backgroundColor: CARD,
      }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${ACCENT}33`,
        borderWidth: 1,
        borderColor: `${ACCENT}88`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{initials}</Text>
    </View>
  );
};

export default function BlockedUsersScreen({ navigation }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const blockedRef = collection(db, 'users', currentUser.uid, 'blocked');
      const blockedSnap = await getDocs(blockedRef);

      const users = [];
      for (const docSnap of blockedSnap.docs) {
        const blockedUserId = docSnap.id;
        const blockedData = docSnap.data();

        // Fetch user data
        const userRef = doc(db, 'users', blockedUserId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          users.push({
            id: blockedUserId,
            name: userData.displayName || userData.name || 'Unknown User',
            handle: userData.username ? `@${userData.username}` : userData.handle || '@user',
            avatar: userData.avatar || userData.photoURL || null,
            blockedAt: blockedData.blockedAt?.toDate() || new Date(),
          });
        } else {
          // User document doesn't exist, but keep the blocked entry
          users.push({
            id: blockedUserId,
            name: 'Unknown User',
            handle: '@user',
            avatar: null,
            blockedAt: blockedData.blockedAt?.toDate() || new Date(),
          });
        }
      }

      // Sort by most recently blocked
      users.sort((a, b) => b.blockedAt - a.blockedAt);
      setBlockedUsers(users);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (user) => {
    Alert.alert(
      'Unblock User',
      `Unblock ${user.name}? They will be able to message you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              const blockRef = doc(db, 'users', currentUser.uid, 'blocked', user.id);
              await deleteDoc(blockRef);

              // Remove from local state
              setBlockedUsers(prev => prev.filter(u => u.id !== user.id));

              Alert.alert('Success', `${user.name} has been unblocked`);
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          },
        },
      ]
    );
  };

  const renderBlockedUser = ({ item }) => (
    <View style={styles.userCard}>
      <Avatar name={item.name} source={item.avatar ? { uri: item.avatar } : null} />
      
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userHandle}>{item.handle}</Text>
        <Text style={styles.blockedDate}>
          Blocked {formatDate(item.blockedAt)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.unblockText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  const formatDate = (date) => {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 3600000) return 'recently';
    if (diff < 86400000) return 'today';
    if (diff < 172800000) return 'yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Blocked Users</Text>
        
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading blocked users...</Text>
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="shield-checkmark-outline" size={80} color={TEXT_DIM} />
          <Text style={styles.emptyTitle}>No Blocked Users</Text>
          <Text style={styles.emptySubtitle}>
            Users you block will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderBlockedUser}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
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
    borderBottomWidth: 1,
    borderBottomColor: `${CARD}88`,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: TEXT_DIM,
  },
  emptyTitle: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ACCENT}22`,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 14,
    color: TEXT_DIM,
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 12,
    color: DANGER,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: `${ACCENT}22`,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },
  separator: {
    height: 12,
  },
});
