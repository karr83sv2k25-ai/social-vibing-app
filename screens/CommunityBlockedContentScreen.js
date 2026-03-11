// screens/CommunityBlockedContentScreen.js
// Manage blocked content keywords/rules for a community
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { clearBlockedContentCache } from '../shared/services/blockedContentService';

const TYPE_OPTIONS = [
  { key: 'word', label: 'Word', desc: 'Matches exact word boundaries' },
  { key: 'phrase', label: 'Phrase', desc: 'Matches text containing this phrase' },
  { key: 'regex', label: 'Regex', desc: 'Advanced pattern matching' },
];

export default function CommunityBlockedContentScreen({ route, navigation }) {
  const { communityId } = route.params || {};
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [ruleType, setRuleType] = useState('word');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (communityId) {
      fetchRules();
    }
  }, [communityId]);

  const fetchRules = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'blocked_content'),
        where('communityId', '==', communityId)
      );
      const snapshot = await getDocs(q);

      const rulesData = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date(),
      }));

      rulesData.sort((a, b) => b.createdAt - a.createdAt);
      setRules(rulesData);
    } catch (error) {
      console.warn('Error fetching blocked content rules:', error);
      Alert.alert('Error', 'Failed to load blocked content rules.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId]);

  const handleSaveRule = useCallback(async () => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      Alert.alert('Missing Keyword', 'Please enter a keyword or phrase.');
      return;
    }
    if (trimmedKeyword.length < 2) {
      Alert.alert('Too Short', 'Keyword must be at least 2 characters.');
      return;
    }

    // Validate regex if type is regex
    if (ruleType === 'regex') {
      try {
        new RegExp(trimmedKeyword);
      } catch {
        Alert.alert('Invalid Regex', 'The regex pattern is not valid.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingRule) {
        // Update existing rule
        await updateDoc(doc(db, 'blocked_content', editingRule.id), {
          keyword: trimmedKeyword,
          type: ruleType,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid,
        });

        setRules(prev => prev.map(r =>
          r.id === editingRule.id
            ? { ...r, keyword: trimmedKeyword, type: ruleType }
            : r
        ));
      } else {
        // Check for duplicate
        const existing = rules.find(r => r.keyword?.toLowerCase() === trimmedKeyword.toLowerCase());
        if (existing) {
          Alert.alert('Duplicate', 'This keyword already exists.');
          setSaving(false);
          return;
        }

        // Create new rule
        const docRef = await addDoc(collection(db, 'blocked_content'), {
          keyword: trimmedKeyword,
          type: ruleType,
          active: true,
          communityId,
          createdBy: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
        });

        setRules(prev => [{
          id: docRef.id,
          keyword: trimmedKeyword,
          type: ruleType,
          active: true,
          communityId,
          createdAt: new Date(),
        }, ...prev]);
      }

      // Clear cache so the new rule takes effect immediately
      clearBlockedContentCache();

      setShowAddModal(false);
      setEditingRule(null);
      setKeyword('');
      setRuleType('word');
    } catch (err) {
      console.warn('Save rule error:', err);
      Alert.alert('Error', 'Failed to save rule. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [keyword, ruleType, editingRule, rules, communityId]);

  const handleToggleActive = useCallback(async (rule) => {
    try {
      const newActive = !rule.active;
      await updateDoc(doc(db, 'blocked_content', rule.id), {
        active: newActive,
        updatedAt: serverTimestamp(),
      });

      setRules(prev => prev.map(r =>
        r.id === rule.id ? { ...r, active: newActive } : r
      ));

      clearBlockedContentCache();
    } catch (err) {
      console.warn('Toggle error:', err);
      Alert.alert('Error', 'Failed to update rule.');
    }
  }, []);

  const handleDeleteRule = useCallback(async (rule) => {
    Alert.alert(
      'Delete Rule',
      `Remove the blocked keyword "${rule.keyword}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(rule.id);
            try {
              await deleteDoc(doc(db, 'blocked_content', rule.id));
              setRules(prev => prev.filter(r => r.id !== rule.id));
              clearBlockedContentCache();
            } catch (err) {
              console.warn('Delete rule error:', err);
              Alert.alert('Error', 'Failed to delete rule.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setKeyword(rule.keyword || '');
    setRuleType(rule.type || 'word');
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setEditingRule(null);
    setKeyword('');
    setRuleType('word');
    setShowAddModal(true);
  };

  const getTypeLabel = (type) => {
    const option = TYPE_OPTIONS.find(t => t.key === type);
    return option ? option.label : 'Word';
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'word': return '#22C55E';
      case 'phrase': return '#F59E0B';
      case 'regex': return '#EF4444';
      default: return '#22C55E';
    }
  };

  const renderRule = useCallback(({ item }) => {
    const isDeleting = deletingId === item.id;

    return (
      <View style={[styles.ruleCard, !item.active && styles.ruleCardInactive]}>
        <View style={styles.ruleRow}>
          <View style={styles.ruleInfo}>
            <View style={styles.ruleHeader}>
              <Text style={[styles.ruleKeyword, !item.active && { opacity: 0.5 }]} numberOfLines={1}>
                {item.keyword}
              </Text>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '25' }]}>
                <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                  {getTypeLabel(item.type)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.ruleActions}>
            {/* Toggle active/inactive */}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => handleToggleActive(item)}
            >
              <Ionicons
                name={item.active ? 'eye' : 'eye-off'}
                size={18}
                color={item.active ? '#22C55E' : '#555'}
              />
            </TouchableOpacity>

            {/* Edit */}
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => openEditModal(item)}
            >
              <Ionicons name="pencil" size={16} color="#06B6D4" />
            </TouchableOpacity>

            {/* Delete */}
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" style={{ marginLeft: 8 }} />
            ) : (
              <TouchableOpacity
                style={styles.deleteRuleBtn}
                onPress={() => handleDeleteRule(item)}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [deletingId, handleToggleActive, handleDeleteRule]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#D946EF" />
        <Text style={styles.loadingText}>Loading content rules...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0b0e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Content</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#D946EF" />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="shield-outline" size={18} color="#22C55E" />
        <Text style={styles.infoBannerText}>
          Posts and messages containing these keywords will be automatically blocked in this community.
        </Text>
      </View>

      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        renderItem={renderRule}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRules(); }}
            tintColor="#D946EF"
            colors={['#D946EF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#333" />
            <Text style={styles.emptyTitle}>No content rules</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to add blocked keywords
            </Text>
          </View>
        }
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingRule ? 'Edit Rule' : 'Add Blocked Keyword'}
            </Text>

            <Text style={styles.inputLabel}>Keyword / Phrase</Text>
            <TextInput
              style={styles.modalInput}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Enter keyword..."
              placeholderTextColor="#666"
              autoFocus
              maxLength={200}
            />

            <Text style={styles.inputLabel}>Match Type</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.typeOption,
                    ruleType === opt.key && { backgroundColor: getTypeColor(opt.key) + '25', borderColor: getTypeColor(opt.key) },
                  ]}
                  onPress={() => setRuleType(opt.key)}
                >
                  <Text style={[
                    styles.typeOptionText,
                    ruleType === opt.key && { color: getTypeColor(opt.key) },
                  ]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.typeOptionDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowAddModal(false); setEditingRule(null); }}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveRule}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>{editingRule ? 'Update' : 'Add'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0e',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#D946EF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E10',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1c22',
  },
  infoBannerText: {
    color: '#22C55E',
    fontSize: 12,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  ruleCard: {
    backgroundColor: '#1a1c22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  ruleCardInactive: {
    opacity: 0.6,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleInfo: {
    flex: 1,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleKeyword: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  ruleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 12,
  },
  toggleBtn: {
    padding: 6,
  },
  editBtn: {
    padding: 6,
  },
  deleteRuleBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#444',
    fontSize: 13,
    marginTop: 4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1a1c22',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#0a0b0e',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2c32',
    marginBottom: 16,
  },
  typeRow: {
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2c32',
    backgroundColor: '#0a0b0e',
  },
  typeOptionText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  typeOptionDesc: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2a2c32',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D946EF',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
