import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import useUserNames from '../hooks/useUserNames';

const ACCENT = '#8B2EF0';
const BG = '#0B0B0E';
const CARD = '#17171C';

export default function GroupDetailsScreen({ navigation, route }) {
  const { communityId, groupId, groupName, groupImage, groupEmoji, groupColor } = route?.params || {};
  const currentUser = auth.currentUser;

  const [groupData, setGroupData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const isMember = members.some(m => m.userId === currentUser?.uid);
  const isCreator = groupData?.createdBy === currentUser?.uid;

  // RC-fix: resolve live community nicknames for all group members so the list
  // always shows the current nickname, not the name denormalized at join-time.
  const memberUserIds = useMemo(
    () => members.map((m) => m.userId).filter(Boolean),
    [members]
  );
  const liveNames = useUserNames(memberUserIds, communityId);

  const handleLeaveGroup = () => {
    if (isCreator) {
      Alert.alert('Cannot Leave', 'You are the creator of this group. You cannot leave it.');
      return;
    }

    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${groupData?.name || groupName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeaving(true);
              const memberRef = doc(db, 'communities', communityId, 'groups', groupId, 'members', currentUser.uid);
              await deleteDoc(memberRef);

              // Decrement member count
              const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
              await updateDoc(groupRef, { memberCount: increment(-1) });

              Alert.alert('Left Group', 'You have left the group.', [
                { text: 'OK', onPress: () => navigation.pop(2) },
              ]);
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave the group. Please try again.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  // Fetch group data
  useEffect(() => {
    if (!communityId || !groupId) return;

    const fetchGroupData = async () => {
      try {
        const groupRef = doc(db, 'communities', communityId, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (groupSnap.exists()) {
          setGroupData(groupSnap.data());
        }
      } catch (error) {
        console.error('Error fetching group data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [communityId, groupId]);

  // Listen to members
  useEffect(() => {
    if (!communityId || !groupId) return;

    const membersRef = collection(db, 'communities', communityId, 'groups', groupId, 'members');
    
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const membersList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      
      // Sort by joinedAt
      membersList.sort((a, b) => {
        const aTime = a.joinedAt?.toDate?.() || a.joinedAt || new Date(0);
        const bTime = b.joinedAt?.toDate?.() || b.joinedAt || new Date(0);
        return bTime - aTime;
      });
      
      setMembers(membersList);
    }, (error) => {
      console.error('Error fetching members:', error);
    });

    return () => unsubscribe();
  }, [communityId, groupId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Recently';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Group Info Card */}
        <View style={styles.groupInfoCard}>
          <View style={[styles.groupIconLarge, { backgroundColor: groupColor || ACCENT }]}>
            {groupImage ? (
              <Image source={{ uri: groupImage }} style={styles.groupIconLarge} />
            ) : (
              <Text style={{ fontSize: 56 }}>{groupEmoji || '💬'}</Text>
            )}
          </View>

          <Text style={styles.groupName}>{groupData?.name || groupName}</Text>
          
          {groupData?.description && (
            <Text style={styles.groupDescription}>{groupData.description}</Text>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color={ACCENT} />
              <Text style={styles.statValue}>{members.length}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="chatbubbles" size={24} color={ACCENT} />
              <Text style={styles.statValue}>{groupData?.messageCount || 0}</Text>
              <Text style={styles.statLabel}>Messages</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="calendar" size={24} color={ACCENT} />
              <Text style={styles.statValue}>{formatDate(groupData?.createdAt)}</Text>
              <Text style={styles.statLabel}>Created</Text>
            </View>
          </View>
        </View>

        {/* Created By */}
        {groupData?.createdByName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Created By</Text>
            <View style={styles.creatorCard}>
              <Ionicons name="person-circle" size={32} color={ACCENT} />
              <Text style={styles.creatorName}>{groupData.createdByName}</Text>
            </View>
          </View>
        )}

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={40} color="#444" />
              <Text style={styles.emptyText}>No members yet</Text>
            </View>
          ) : (
            <View style={styles.membersList}>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberCard}
                  onPress={() => {
                    if (member.userId && member.userId !== 'system') {
                      navigation.navigate('Profile', { userId: member.userId });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={member.userImage ? { uri: member.userImage } : require('../assets/a1.png')}
                    style={styles.memberAvatar}
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {liveNames[member.userId] || member.userName || 'User'}
                    </Text>
                    <Text style={styles.memberJoinDate}>
                      Joined {formatDate(member.joinedAt)}
                    </Text>
                  </View>
                  
                  {member.userId === currentUser?.uid && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                  
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Leave Group Button */}
        {isMember && !isCreator && (
          <View style={styles.leaveSection}>
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveGroup}
              disabled={leaving}
              activeOpacity={0.7}
            >
              {leaving ? (
                <ActivityIndicator size="small" color="#FF4444" />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={22} color="#FF4444" />
                  <Text style={styles.leaveButtonText}>Leave Group</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  groupInfoCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: CARD,
    margin: 16,
    borderRadius: 16,
  },
  groupIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  membersList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberJoinDate: {
    fontSize: 12,
    color: '#888',
  },
  youBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: CARD,
    borderRadius: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  leaveSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4444',
    gap: 10,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF4444',
  },
});
