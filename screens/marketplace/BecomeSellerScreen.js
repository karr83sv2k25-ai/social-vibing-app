// screens/marketplace/BecomeSellerScreen.js - Onboarding screen for new sellers
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../../firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';
const GREEN = '#10B981';

export default function BecomeSellerScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [storeName, setStoreName] = useState('');
    const [storeDescription, setStoreDescription] = useState('');

    const handleBecomeSeller = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'You must be logged in');
            return;
        }

        if (!storeName.trim()) {
            Alert.alert('Required', 'Please enter a store name');
            return;
        }

        if (!agreedToTerms) {
            Alert.alert('Terms Required', 'Please agree to the seller terms');
            return;
        }

        try {
            setLoading(true);

            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                Alert.alert('Error', 'User profile not found');
                return;
            }

            // Update user profile with seller information
            await updateDoc(userRef, {
                isSeller: true,
                sellerSince: new Date().toISOString(),
                storeName: storeName.trim(),
                storeDescription: storeDescription.trim() || '',
                earningsBalance: 0,
                sellerStats: {
                    totalProducts: 0,
                    totalSales: 0,
                    totalEarnings: 0,
                    rating: 0,
                    reviews: 0,
                },
            });

            Alert.alert(
                'Welcome, Seller! 🎉',
                `Your store "${storeName}" is now live! You can start creating products.`,
                [
                    {
                        text: 'Start Selling',
                        onPress: () => navigation.replace('SellerDashboard')
                    }
                ]
            );

        } catch (error) {
            console.error('Failed to enable seller mode:', error);
            Alert.alert('Error', 'Failed to enable seller mode. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Become a Seller</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <LinearGradient
                    colors={[ACCENT, '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <MaterialCommunityIcons name="storefront" size={60} color="#FFF" />
                    <Text style={styles.heroTitle}>Start Your Own Store</Text>
                    <Text style={styles.heroSubtitle}>
                        Reach millions of users and turn your creativity into income
                    </Text>
                </LinearGradient>

                {/* Benefits Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Why Sell With Us?</Text>
                    <View style={styles.benefitsGrid}>
                        <BenefitCard
                            icon="trending-up"
                            title="70% Commission"
                            desc="Keep most of your earnings"
                            color="#10B981"
                        />
                        <BenefitCard
                            icon="people"
                            title="Large Audience"
                            desc="Access millions of buyers"
                            color="#7C3AED"
                        />
                        <BenefitCard
                            icon="shield-checkmark"
                            title="Secure Payments"
                            desc="Safe and instant payouts"
                            color="#06B6D4"
                        />
                        <BenefitCard
                            icon="stats-chart"
                            title="Analytics"
                            desc="Track your performance"
                            color="#F59E0B"
                        />
                    </View>
                </View>

                {/* What You Can Sell */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What Can You Sell?</Text>
                    <View style={styles.typesList}>
                        <TypeItem icon="book" label="Comics & Books" color="#7C3AED" />
                        <TypeItem icon="color-palette" label="Digital Art" color="#EC4899" />
                        <TypeItem icon="happy" label="Sticker Packs" color="#F59E0B" />
                        <TypeItem icon="images" label="Profile Frames" color="#06B6D4" />
                        <TypeItem icon="chatbubble" label="Chat Bubbles" color="#10B981" />
                        <TypeItem icon="briefcase" label="Freelance Services" color="#8B5CF6" />
                    </View>
                </View>

                {/* Store Setup Form */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Setup Your Store</Text>

                    <View style={styles.formCard}>
                        <Text style={styles.label}>Store Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Anime Art Studio"
                            placeholderTextColor={TEXT_DIM}
                            value={storeName}
                            onChangeText={setStoreName}
                            maxLength={30}
                        />

                        <Text style={styles.label}>Store Description (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Tell buyers about your store..."
                            placeholderTextColor={TEXT_DIM}
                            value={storeDescription}
                            onChangeText={setStoreDescription}
                            multiline
                            numberOfLines={4}
                            maxLength={200}
                        />
                    </View>
                </View>

                {/* Terms & Conditions */}
                <View style={styles.section}>
                    <View style={styles.termsCard}>
                        <View style={styles.termsHeader}>
                            <Ionicons name="document-text" size={24} color={ACCENT} />
                            <Text style={styles.termsTitle}>Seller Agreement</Text>
                        </View>

                        <View style={styles.termsList}>
                            <TermItem text="You must own or have rights to sell all products" />
                            <TermItem text="You earn 70% commission on each sale" />
                            <TermItem text="Minimum withdrawal amount is 100 coins" />
                            <TermItem text="Products must comply with community guidelines" />
                            <TermItem text="You are responsible for product quality and support" />
                            <TermItem text="We reserve the right to remove violating content" />
                        </View>

                        <TouchableOpacity
                            style={styles.termsCheckbox}
                            onPress={() => setAgreedToTerms(!agreedToTerms)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                                {agreedToTerms && <Ionicons name="checkmark" size={18} color="#FFF" />}
                            </View>
                            <Text style={styles.termsCheckboxText}>
                                I agree to the Seller Terms and Conditions
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* CTA Button */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.ctaButton, (!agreedToTerms || !storeName.trim()) && { opacity: 0.5 }]}
                        onPress={handleBecomeSeller}
                        disabled={loading || !agreedToTerms || !storeName.trim()}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[ACCENT, '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name="rocket" size={24} color="#FFF" />
                                    <Text style={styles.ctaText}>Start Selling Now</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function BenefitCard({ icon, title, desc, color }) {
    return (
        <View style={styles.benefitCard}>
            <View style={[styles.benefitIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.benefitTitle}>{title}</Text>
            <Text style={styles.benefitDesc}>{desc}</Text>
        </View>
    );
}

function TypeItem({ icon, label, color }) {
    return (
        <View style={styles.typeItem}>
            <View style={[styles.typeIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={styles.typeLabel}>{label}</Text>
        </View>
    );
}

function TermItem({ text }) {
    return (
        <View style={styles.termItem}>
            <Ionicons name="checkmark-circle" size={16} color={GREEN} />
            <Text style={styles.termText}>{text}</Text>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
    },
    headerTitle: {
        color: TEXT,
        fontSize: 20,
        fontWeight: '700',
    },
    hero: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 32,
        borderRadius: 16,
        alignItems: 'center',
    },
    heroTitle: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: '800',
        marginTop: 16,
        textAlign: 'center',
    },
    heroSubtitle: {
        color: '#FFF',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 8,
        opacity: 0.9,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        color: TEXT,
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
    },
    benefitsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    benefitCard: {
        width: '48%',
        backgroundColor: CARD,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    benefitIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    benefitTitle: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    benefitDesc: {
        color: TEXT_DIM,
        fontSize: 12,
    },
    typesList: {
        gap: 12,
    },
    typeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#23232A',
        gap: 12,
    },
    typeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeLabel: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '600',
    },
    formCard: {
        backgroundColor: CARD,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    label: {
        color: TEXT,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#0B0B0E',
        color: TEXT,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#23232A',
        fontSize: 16,
        marginBottom: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    termsCard: {
        backgroundColor: CARD,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    termsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    termsTitle: {
        color: TEXT,
        fontSize: 18,
        fontWeight: '700',
    },
    termsList: {
        gap: 10,
        marginBottom: 16,
    },
    termItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    termText: {
        color: TEXT_DIM,
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    },
    termsCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#23232A',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: TEXT_DIM,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: GREEN,
        borderColor: GREEN,
    },
    termsCheckboxText: {
        color: TEXT,
        fontSize: 14,
        flex: 1,
    },
    ctaButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    ctaGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        gap: 12,
    },
    ctaText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
});
