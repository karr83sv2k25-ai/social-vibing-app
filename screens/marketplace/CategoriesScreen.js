// CategoriesScreen.js - Shows 8 monetization features
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

// 8 monetization features with client's icons
const CATEGORIES = [
    {
        id: 'chat_bubble',
        name: 'Chat Bubbles',
        description: 'Customize your chat experience',
        icon: require('../../assets/chatbubbles.png'),
        productCount: 234,
        color: '#FF6B6B',
    },
    {
        id: 'profile_frame',
        name: 'Profile Frames',
        description: 'Stand out with unique frames',
        icon: require('../../assets/profileframe.png'),
        productCount: 189,
        color: '#4ECDC4',
    },
    {
        id: 'art',
        name: 'Art Gallery',
        description: 'Original artworks (No AI)',
        icon: require('../../assets/photos.png'),
        productCount: 456,
        color: '#FFE66D',
    },
    {
        id: 'sticker_pack',
        name: 'Sticker Packs',
        description: 'Express yourself',
        icon: require('../../assets/character.png'), // Use appropriate icon
        productCount: 312,
        color: '#A8E6CF',
    },
    {
        id: 'comic',
        name: 'Comics & Manga',
        description: 'Digital comics',
        icon: require('../../assets/character.png'), // Replace with comic icon
        productCount: 145,
        color: '#FF8B94',
    },
    {
        id: 'book',
        name: 'E-Books',
        description: 'Digital books',
        icon: require('../../assets/character.png'), // Replace with book icon
        productCount: 89,
        color: '#C7CEEA',
    },
    {
        id: 'freelance_gig',
        name: 'Freelancing',
        description: 'Hire talented creators',
        icon: require('../../assets/character.png'), // Replace with briefcase icon
        productCount: 267,
        color: '#FFDAB9',
    },
    {
        id: 'ai_generator',
        name: 'AI Generator',
        description: 'Generate AI images',
        icon: require('../../assets/character.png'), // Replace with AI icon
        productCount: 0, // Not a product category
        color: '#B19CD9',
        isAILab: true,
    },
];

export default function CategoriesScreen({ navigation }) {
    const handleCategoryPress = (category) => {
        if (category.isAILab) {
            // Navigate to AI Lab tab
            navigation.navigate('AILab');
        } else {
            // Navigate to product listing for this category
            navigation.navigate('MarketPlaceExplore', {
                categoryType: category.id,
                categoryName: category.name
            });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Categories</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MarketPlaceExplore')}>
                    <Ionicons name="search-outline" size={24} color={TEXT} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.subtitle}>Explore Marketplace</Text>

                <View style={styles.categoriesGrid}>
                    {CATEGORIES.map((category) => (
                        <TouchableOpacity
                            key={category.id}
                            style={[styles.categoryCard, { borderColor: category.color }]}
                            onPress={() => handleCategoryPress(category)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
                                <Image source={category.icon} style={styles.categoryIcon} />
                            </View>

                            <Text style={styles.categoryName}>{category.name}</Text>
                            <Text style={styles.categoryDesc} numberOfLines={2}>
                                {category.description}
                            </Text>

                            {!category.isAILab && (
                                <View style={styles.countBadge}>
                                    <Text style={styles.countText}>{category.productCount} items</Text>
                                </View>
                            )}

                            {category.isAILab && (
                                <View style={[styles.countBadge, { backgroundColor: ACCENT }]}>
                                    <Text style={styles.countText}>Try Now</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    headerTitle: {
        color: TEXT,
        fontSize: 28,
        fontWeight: '800',
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
        paddingBottom: 30,
    },
    categoryCard: {
        width: '47%',
        margin: '1.5%',
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: '#23232A',
        alignItems: 'center',
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
    },
    categoryName: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
    },
    categoryDesc: {
        color: '#9CA3AF',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 12,
    },
    countBadge: {
        backgroundColor: '#23232A',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countText: {
        color: TEXT,
        fontSize: 11,
        fontWeight: '600',
    },
});
