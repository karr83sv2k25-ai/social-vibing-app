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

  const filters = ['Recommended', 'Popular', 'Latest'];

  const icons = [
    { id: '1', name: 'Role Play', img: require('./assets/c1.png') },
    { id: '2', name: 'Anime & Manga', img: require('./assets/c2.png') },
    { id: '3', name: 'Art & Aesthetics', img: require('./assets/c3.png') },
    { id: '4', name: 'Fandom', img: require('./assets/c4.png') },
    { id: '5', name: 'Animals & Pets', img: require('./assets/c5.png') },
    { id: '6', name: 'Music', img: require('./assets/c6.png') },
    { id: '7', name: 'Movies', img: require('./assets/c7.png') },
    { id: '8', name: 'Entertainment', img: require('./assets/c8.png') },
    { id: '9', name: 'Role Play', img: require('./assets/c9.png') },
    { id: '10', name: 'Anime & Manga', img: require('./assets/c10.png') },
    { id: '11', name: 'Art & Aesthetics', img: require('./assets/c11.png') },
    { id: '12', name: 'Fandom', img: require('./assets/c12.png') },
  ];

  const displayedIcons = showAll ? icons : icons.slice(0, 8);

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
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#aaa" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Search categories..."
          placeholderTextColor="#888"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Grid */}
      <FlatList
        data={displayedIcons}
        numColumns={4}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.iconContainer}>
            <Image source={item.img} style={styles.iconImage} resizeMode="contain" />
            <Text style={styles.iconLabel}>{item.name}</Text>
          </View>
        )}
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
            {(communities && communities.length > 0 ? communities : [
              { title: 'No communities found', tags: [] }
            ]).map((card, idx) => {
              const title = card.name || card.community_title || card.title || 'Community';
              const subtitle = card.community_id || card.id || 'Community ID';
              const membersCount = card.community_members ? (Array.isArray(card.community_members) ? card.community_members.length : card.community_members) : '—';
              const tags = card.tags || card.community_tags || [];
              return (
                <TouchableOpacity
                  key={card.id || card.community_id || idx}
                  style={styles.cardContainer}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('CommunityDetail', { communityId: card.id || card.community_id })}
                >
                  <Image
                    source={getCommunityImage(card)}
                    style={styles.cardImageHorizontal}
                    resizeMode="cover"
                  />
                  <View style={styles.cardTextWrapperHorizontal}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{subtitle} | {card.language || 'English'}</Text>

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
  iconGrid: { justifyContent: 'center', alignItems: 'center', paddingBottom: 20 },
  iconContainer: { alignItems: 'center', justifyContent: 'center', width: 331 / 4, height: 48, paddingTop: 4, paddingBottom: 4, marginVertical: 6 },
  iconImage: { width: 48, height: 28, borderRadius: 6, marginBottom: 4 },
  iconLabel: { color: '#fff', fontWeight: '500', fontSize: 10, textAlign: 'center' },
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
  membersWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  membersImages: { flexDirection: 'row' },
  memberImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#000' },
  membersText: { color: '#fff', fontSize: 12, marginLeft: 8 },
  tagsWrapper: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tagButton: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  tagButtonText: { fontSize: 12, fontWeight: '500' },
});
