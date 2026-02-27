// screens/marketplace/SellerDashboardScreen.js - Seller's control center
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const ACCENT = '#7C3AED';
const GREEN = '#10B981';
const RED = '#EF4444';

export default function SellerDashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sellerData, setSellerData] = useState(null);
    const [myProducts, setMyProducts] = useState([]);
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalSales: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        activeProducts: 0,
    });

    useEffect(() => {
        fetchSellerData();
    }, []);

    const fetchSellerData = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                navigation.replace('Login');
                return;
            }

            setLoading(true);

            // Fetch user profile
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                Alert.alert('Error', 'User profile not found');
                return;
            }

            const userData = userDoc.data();
            setSellerData({
                ...userData,
                userId: user.uid,
            });

            // Fetch seller's products
            const productsRef = collection(db, 'products');
            const q = query(
                productsRef,
                where('creatorId', '==', user.uid),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setMyProducts(products);

            // Calculate stats
            const totalSales = products.reduce((sum, p) => sum + (p.stats?.purchaseCount || 0), 0);
            const totalEarnings = products.reduce((sum, p) => {
                const sales = p.stats?.purchaseCount || 0;
                const earnings = sales * p.price * 0.7; // 70% commission
                return sum + earnings;
            }, 0);

            setStats({
                totalProducts: products.length,
                totalSales: totalSales,
                totalEarnings: Math.floor(totalEarnings),
                pendingEarnings: userData.earningsBalance || 0,
                activeProducts: products.filter(p => p.status === 'active').length,
            });

        } catch (error) {
            console.error('Failed to fetch seller data:', error);
            Alert.alert('Error', 'Failed to load seller dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchSellerData();
    };

    const handleCreateProduct = () => {
        navigation.navigate('ProductTypeSelection');
    };

    const handleEditProduct = (product) => {
        navigation.navigate('TypeSpecificUpload', { productId: product.id, productType: product.type });
    };

    const handleDeleteProduct = (product) => {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete "${product.title}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'products', product.id));
                            Alert.alert('Success', 'Product deleted successfully');
                            fetchSellerData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete product');
                        }
                    }
                }
            ]
        );
    };

    const toggleProductStatus = async (product) => {
        try {
            const newStatus = product.status === 'active' ? 'inactive' : 'active';
            await updateDoc(doc(db, 'products', product.id), {
                status: newStatus
            });
            Alert.alert('Success', `Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
            fetchSellerData();
        } catch (error) {
            Alert.alert('Error', 'Failed to update product status');
        }
    };

    const handleWithdraw = () => {
        if (stats.pendingEarnings < 100) {
            Alert.alert('Minimum Withdrawal', 'You need at least 100 coins to withdraw');
            return;
        }
        navigation.navigate('Withdrawal');
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={{ color: TEXT, marginTop: 12 }}>Loading dashboard...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Seller Dashboard</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MyOrders')}>
                    <Ionicons name="list-outline" size={24} color={TEXT} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
                }
            >
                {/* Seller Profile Card */}
                <LinearGradient
                    colors={[ACCENT, '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileCard}
                >
                    <View style={styles.profileInfo}>
                        <Image
                            source={{ uri: sellerData?.profileImage || 'https://via.placeholder.com/80' }}
                            style={styles.profileImage}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.profileName}>{sellerData?.displayName || 'Seller'}</Text>
                            <Text style={styles.profileRole}>
                                {sellerData?.role === 'verified_creator' ? '⭐ Verified Creator' : '🎨 Creator'}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="cube"
                        label="Products"
                        value={stats.totalProducts}
                        color="#7C3AED"
                    />
                    <StatCard
                        icon="cart"
                        label="Sales"
                        value={stats.totalSales}
                        color="#10B981"
                    />
                    <StatCard
                        icon="cash"
                        label="Earnings"
                        value={`${stats.totalEarnings} 💎`}
                        color="#F59E0B"
                    />
                    <StatCard
                        icon="trending-up"
                        label="Active"
                        value={stats.activeProducts}
                        color="#06B6D4"
                    />
                </View>

                {/* Earnings Card */}
                <View style={styles.earningsCard}>
                    <View style={styles.earningsHeader}>
                        <Text style={styles.earningsTitle}>💰 Available Balance</Text>
                        <Text style={styles.earningsAmount}>{stats.pendingEarnings} Coins</Text>
                    </View>
                    <Text style={styles.earningsNote}>
                        You earn 70% commission on each sale
                    </Text>
                    <TouchableOpacity
                        style={[styles.withdrawBtn, stats.pendingEarnings < 100 && { opacity: 0.5 }]}
                        onPress={handleWithdraw}
                        disabled={stats.pendingEarnings < 100}
                    >
                        <Ionicons name="wallet" size={20} color="#FFF" />
                        <Text style={styles.withdrawBtnText}>Withdraw Earnings</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.createBtn} onPress={handleCreateProduct}>
                        <LinearGradient
                            colors={[ACCENT, '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.createBtnGradient}
                        >
                            <Ionicons name="add-circle" size={24} color="#FFF" />
                            <Text style={styles.createBtnText}>Create New Product</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Products Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📦 My Products ({myProducts.length})</Text>

                    {myProducts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="package-variant" size={60} color={TEXT_DIM} />
                            <Text style={styles.emptyTitle}>No Products Yet</Text>
                            <Text style={styles.emptyDesc}>
                                Start selling by creating your first product!
                            </Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={handleCreateProduct}>
                                <Text style={styles.emptyBtnText}>Create Product</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        myProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onEdit={() => handleEditProduct(product)}
                                onDelete={() => handleDeleteProduct(product)}
                                onToggleStatus={() => toggleProductStatus(product)}
                                onView={() => navigation.navigate('ProductDetail', { productId: product.id })}
                            />
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// Stat Card Component
function StatCard({ icon, label, value, color }) {
    return (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <Ionicons name={icon} size={24} color={color} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// Product Card Component
function ProductCard({ product, onEdit, onDelete, onToggleStatus, onView }) {
    return (
        <View style={styles.productCard}>
            <TouchableOpacity onPress={onView} style={styles.productContent}>
                <Image
                    source={{ uri: product.coverImage || 'https://via.placeholder.com/80' }}
                    style={styles.productImage}
                />
                <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={1}>{product.title}</Text>
                    <Text style={styles.productType}>{product.type}</Text>
                    <View style={styles.productStats}>
                        <Text style={styles.productPrice}>{product.price} {product.currency}</Text>
                        <Text style={styles.productSales}>
                            {product.stats?.purchaseCount || 0} sales
                        </Text>
                    </View>
                </View>
                <View style={styles.productStatus}>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: product.status === 'active' ? GREEN + '20' : RED + '20' }
                    ]}>
                        <Text style={[
                            styles.statusText,
                            { color: product.status === 'active' ? GREEN : RED }
                        ]}>
                            {product.status === 'active' ? '● Active' : '● Inactive'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.productActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
                    <Ionicons name="create-outline" size={20} color={ACCENT} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={onToggleStatus}>
                    <Ionicons
                        name={product.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={20}
                        color={GREEN}
                    />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
                    <Ionicons name="trash-outline" size={20} color={RED} />
                </TouchableOpacity>
            </View>
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
    profileCard: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 16,
        borderRadius: 16,
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    profileImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#FFF',
    },
    profileName: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '800',
    },
    profileRole: {
        color: '#FFF',
        fontSize: 14,
        opacity: 0.9,
        marginTop: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        marginTop: 16,
        gap: 12,
    },
    statCard: {
        width: '48%',
        backgroundColor: CARD,
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderColor: '#23232A',
    },
    statValue: {
        color: TEXT,
        fontSize: 24,
        fontWeight: '800',
        marginTop: 8,
    },
    statLabel: {
        color: TEXT_DIM,
        fontSize: 12,
        marginTop: 4,
    },
    earningsCard: {
        backgroundColor: CARD,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    earningsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    earningsTitle: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
    },
    earningsAmount: {
        color: GREEN,
        fontSize: 24,
        fontWeight: '800',
    },
    earningsNote: {
        color: TEXT_DIM,
        fontSize: 12,
        marginBottom: 12,
    },
    withdrawBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: GREEN,
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    withdrawBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    actionsRow: {
        paddingHorizontal: 16,
        marginTop: 16,
    },
    createBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    createBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        color: TEXT,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        color: TEXT,
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    },
    emptyDesc: {
        color: TEXT_DIM,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
    },
    emptyBtn: {
        backgroundColor: ACCENT,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 16,
    },
    emptyBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    productCard: {
        backgroundColor: CARD,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#23232A',
        overflow: 'hidden',
    },
    productContent: {
        flexDirection: 'row',
        padding: 12,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    productTitle: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
    },
    productType: {
        color: TEXT_DIM,
        fontSize: 12,
        textTransform: 'capitalize',
    },
    productStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productPrice: {
        color: GREEN,
        fontSize: 14,
        fontWeight: '700',
    },
    productSales: {
        color: TEXT_DIM,
        fontSize: 12,
    },
    productStatus: {
        position: 'absolute',
        top: 12,
        right: 12,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    productActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#23232A',
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        alignItems: 'center',
        padding: 8,
    },
});
