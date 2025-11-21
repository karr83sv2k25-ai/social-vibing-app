import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  FlatList,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { app } from './firebaseConfig';

export default function ExploreScreen({ navigation }) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Recommended');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categories = [
    { name: "Gaming & Esports", icon: "game-controller" },
    { name: "Education & Learning", icon: "school" },
    { name: "Technology & Programming", icon: "code-slash" },
    { name: "Sports & Athletics", icon: "basketball" },
    { name: "Entertainment", icon: "film" },
    { name: "Music & Audio", icon: "musical-notes" },
    { name: "Art & Design", icon: "color-palette" },
    { name: "Food & Cooking", icon: "restaurant" },
    { name: "Travel & Adventure", icon: "airplane" },
    { name: "Fashion & Style", icon: "shirt" },
    { name: "Health & Fitness", icon: "fitness" },
    { name: "Business & Entrepreneurship", icon: "briefcase" },
    { name: "Science & Innovation", icon: "flask" },
    { name: "Politics & Current Events", icon: "newspaper" },
    { name: "Photography & Video", icon: "camera" },
    { name: "Movies & TV Shows", icon: "tv" },
    { name: "Books & Literature", icon: "book" },
    { name: "Pets & Animals", icon: "paw" },
    { name: "Spirituality & Religion", icon: "moon" },
    { name: "DIY & Crafts", icon: "construct" },
    { name: "Automotive", icon: "car-sport" },
    { name: "Family & Parenting", icon: "people" },
    { name: "Mental Health & Wellness", icon: "heart" },
    { name: "Finance & Investing", icon: "cash" },
    { name: "Nature & Environment", icon: "leaf" },
    { name: "Other", icon: "apps" }
  ];

  const filters = ['Recommended', 'Popular', 'Latest'];

  // Use categories from CreateCommunityScreen
  const displayedCategories = showAll ? categories : categories.slice(0, 8);

  const TagButton = ({ title, colorActive }) => {
    const [active, setActive] = useState(false);
    return (
      <TouchableOpacity
        style={[styles.tagButton, { borderColor: active ? colorActive : '#555' }]}
        onPress={() => setActive(!active)}
      >
        <Text style={[styles.tagButtonText, { color: active ? colorActive : '#fff' }]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const members = [
    require('./assets/join1.png'),
    require('./assets/join1.png'),
    require('./assets/join1.png'),
    require('./assets/join1.png'),
  ];

  // helper to choose community image
  const getCommunityImage = (c) => {
    const possible = ['profileImage','coverImage','backgroundImage','community_picture','imageUrl','banner','photo','picture'];
    for (const f of possible) {
      if (c && c[f]) return { uri: c[f] };
    }
    return require('./assets/posticon.jpg');
  };

  const [communities, setCommunities] = useState([]);

  useEffect(() => {
    const db = getFirestore(app);
    const unsub = onSnapshot(collection(db, 'communities'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCommunities(docs);
    }, (err) => {
      console.error('Error fetching communities:', err);
    });

    return () => unsub();
  }, []);

  // Function to sort communities based on active filter
  const sortCommunities = (communitiesList) => {
    if (!communitiesList || communitiesList.length === 0) return communitiesList;

    const sorted = [...communitiesList];

    switch (activeFilter) {
      case 'Popular':
        // Sort by members count (descending)
        return sorted.sort((a, b) => {
          const aMembers = a.community_members 
            ? (Array.isArray(a.community_members) ? a.community_members.length : a.community_members)
            : (a.members_count || a.members?.length || 0);
          const bMembers = b.community_members 
            ? (Array.isArray(b.community_members) ? b.community_members.length : b.community_members)
            : (b.members_count || b.members?.length || 0);
          return bMembers - aMembers; // Descending order
        });

      case 'Latest':
        // Sort by createdAt or updatedAt (descending, newest first)
        return sorted.sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt || a.updatedAt?.toDate?.() || a.updatedAt || new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt || b.updatedAt?.toDate?.() || b.updatedAt || new Date(0);
          
          // Convert to Date objects if they're not already
          const aDateObj = aDate instanceof Date ? aDate : new Date(aDate);
          const bDateObj = bDate instanceof Date ? bDate : new Date(bDate);
          
          return bDateObj.getTime() - aDateObj.getTime(); // Descending order (newest first)
        });

      case 'Recommended':
      default:
        // Default order or can add recommendation algorithm here
        // For now, keep original order or sort by members count as recommendation
        return sorted.sort((a, b) => {
          const aMembers = a.community_members 
            ? (Array.isArray(a.community_members) ? a.community_members.length : a.community_members)
            : (a.members_count || a.members?.length || 0);
          const bMembers = b.community_members 
            ? (Array.isArray(b.community_members) ? b.community_members.length : b.community_members)
            : (b.members_count || b.members?.length || 0);
          return bMembers - aMembers; // Sort by popularity as recommendation
        });
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Categories</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Search Bar */}
      <TouchableOpacity 
        style={styles.searchBar}
        onPress={() => setShowCategoryDropdown(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="search-outline" size={20} color="#aaa" style={{ marginRight: 8 }} />
        <Text style={styles.searchInput}>
          {selectedCategory ? selectedCategory.name : "Search categories..."}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#aaa" />
      </TouchableOpacity>

      {/* Category Dropdown Modal */}
      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryDropdown(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryList}>
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  !selectedCategory && styles.categoryItemActive
                ]}
                onPress={() => {
                  setSelectedCategory(null);
                  setShowCategoryDropdown(false);
                }}
              >
                <Text style={[
                  styles.categoryItemText,
                  !selectedCategory && styles.categoryItemTextActive
                ]}>
                  All Categories
                </Text>
                {!selectedCategory && (
                  <Ionicons name="checkmark" size={20} color="#4b6cff" />
                )}
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryItem,
                    selectedCategory?.name === category.name && styles.categoryItemActive
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <View style={styles.categoryItemContent}>
                    <Ionicons 
                      name={category.icon} 
                      size={20} 
                      color={selectedCategory?.name === category.name ? "#4b6cff" : "#666"} 
                      style={{ marginRight: 12 }} 
                    />
                    <Text style={[
                      styles.categoryItemText,
                      selectedCategory?.name === category.name && styles.categoryItemTextActive
                    ]}>
                      {category.name}
                    </Text>
                  </View>
                  {selectedCategory?.name === category.name && (
                    <Ionicons name="checkmark" size={20} color="#4b6cff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Grid */}
      <FlatList
        data={displayedCategories}
        numColumns={4}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => {
          const isSelected = selectedCategory?.name === item.name;
          return (
            <TouchableOpacity
              style={styles.iconContainer}
              onPress={() => {
                if (isSelected) {
                  setSelectedCategory(null); // Deselect if already selected
                } else {
                  setSelectedCategory(item); // Select category
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconImageContainer,
                isSelected && styles.iconImageContainerActive
              ]}>
                <Ionicons 
                  name={item.icon} 
                  size={24} 
                  color={isSelected ? '#4b6cff' : '#fff'} 
                />
              </View>
              <Text style={[
                styles.iconLabel,
                isSelected && styles.iconLabelActive
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.iconGrid}
        ListFooterComponent={
          <>
            {/* View More Button */}
            <View style={styles.viewMoreWrapper}>
              <TouchableOpacity
                style={styles.gradientButtonContainer}
                activeOpacity={0.8}
                onPress={() => setShowAll(!showAll)}
              >
                <LinearGradient
                  colors={['rgba(255,6,200,0.4)', 'rgba(255,6,200,0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.gradientButtonText}>{showAll ? 'View Less' : 'View More'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Filter Buttons */}
            <View style={styles.filterWrapper}>
              {filters.map((filter) => {
                const isActive = activeFilter === filter;
                return (
                  <TouchableOpacity key={filter} style={styles.filterButtonWrapper} onPress={() => setActiveFilter(filter)}>
                    {isActive ? (
                      <LinearGradient
                        colors={['#BF2EF0', 'rgba(191,46,240,0.2)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.filterButtonActive}
                      >
                        <Text style={styles.filterTextActive}>{filter}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.filterButtonInactive}>
                        <Text style={styles.filterTextInactive}>{filter}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Community Cards (from Firestore) */}
            {(communities && communities.length > 0 ? sortCommunities(
              communities.filter(card => {
                // Filter by selected category
                if (!selectedCategory) return true;
                const cardCategory = card.category || card.community_category;
                return cardCategory === selectedCategory.name;
              })
            ) : [
              { title: 'No communities found', tags: [] }
            ]).map((card, idx) => {
              const title = card.name || card.community_title || card.title || 'Community';
              const subtitle = card.community_id || card.id || 'Community ID';
              const membersCount = card.community_members ? (Array.isArray(card.community_members) ? card.community_members.length : card.community_members) : '—';
              const tags = card.tags || card.community_tags || [];
              const cardCategory = card.category || card.community_category || '';
              
              // Find category icon from categories list
              const categoryData = categories.find(cat => cat.name === cardCategory);
              const categoryIcon = categoryData?.icon || 'apps';
              
              return (
                <TouchableOpacity
                  key={card.id || card.community_id || idx}
                  style={styles.cardContainer}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('GroupInfo', { communityId: card.id || card.community_id })}
                >
                  <Image
                    source={getCommunityImage(card)}
                    style={styles.cardImageHorizontal}
                    resizeMode="cover"
                  />
                  <View style={styles.cardTextWrapperHorizontal}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{subtitle} | {card.language || 'English'}</Text>

                    {/* Category Display */}
                    {cardCategory && (
                      <View style={styles.categoryWrapper}>
                        <Ionicons name={categoryIcon} size={14} color="#4b6cff" />
                        <Text style={styles.categoryText}>{cardCategory}</Text>
                      </View>
                    )}

                    {/* Members & Images */}
                    <View style={styles.membersWrapper}>
                      <View style={styles.membersImages}>
                        {members.map((img, index) => (
                          <Image
                            key={index}
                            source={img}
                            style={[styles.memberImage, index !== 0 && { marginLeft: -10 }]}
                          />
                        ))}
                      </View>
                      <Text style={styles.membersText}>{membersCount} members</Text>
                    </View>

                    {/* Tags Buttons */}
                    <View style={styles.tagsWrapper}>
                      {tags.slice(0, 3).map((tag, i) => (
                        <TagButton key={i} title={tag} colorActive="blue" />
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1b1d23',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  categoryList: {
    maxHeight: 500,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  categoryItemActive: {
    backgroundColor: '#1E2127',
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryItemText: {
    color: '#fff',
    fontSize: 16,
  },
  categoryItemTextActive: {
    color: '#4b6cff',
    fontWeight: '600',
  },
  iconGrid: { justifyContent: 'center', alignItems: 'center', paddingBottom: 20 },
  iconContainer: { alignItems: 'center', justifyContent: 'center', width: 331 / 4, paddingTop: 4, paddingBottom: 4, marginVertical: 6 },
  iconImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1a1c20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  iconImageContainerActive: {
    backgroundColor: 'rgba(75, 108, 255, 0.2)',
    borderColor: '#4b6cff',
    borderWidth: 2,
  },
  iconLabel: { color: '#fff', fontWeight: '500', fontSize: 9, textAlign: 'center', paddingHorizontal: 2 },
  iconLabelActive: { color: '#4b6cff', fontWeight: '600' },
  viewMoreWrapper: { marginTop: 10, alignItems: 'center' },
  gradientButtonContainer: { alignItems: 'center' },
  gradientButton: { width: 331, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,6,200,0.2)' },
  gradientButtonText: { color: '#fff', fontWeight: '600' },
  filterWrapper: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 20, marginBottom: 40, gap: 10 },
  filterButtonWrapper: {},
  filterButtonActive: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 0 },
  filterButtonInactive: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', borderWidth: 0 },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  filterTextInactive: { color: '#888', fontWeight: '500' },
  cardContainer: { flexDirection: 'row', marginTop: 20, backgroundColor: '#111', borderRadius: 8, padding: 10, alignItems: 'flex-start', gap: 12 },
  cardImageHorizontal: { width: 96, height: 106, borderRadius: 8 },
  cardTextWrapperHorizontal: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  categoryWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  categoryText: {
    color: '#4b6cff',
    fontSize: 12,
    fontWeight: '500',
  },
  membersWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  membersImages: { flexDirection: 'row' },
  memberImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#000' },
  membersText: { color: '#fff', fontSize: 12, marginLeft: 8 },
  tagsWrapper: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tagButton: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  tagButtonText: { fontSize: 12, fontWeight: '500' },
});
