// screens/marketplace/ProductDetailScreen.js - Product detail with purchase
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../context/WalletContext';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../../firebaseConfig';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import ReportUserModal from '../../components/ReportUserModal';
import { REPORT_TYPES } from '../../shared/services/reportService';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

export default function ProductDetailScreen({ route, navigation }) {
    const { productId } = route.params;
    const { wallet, refreshWallet } = useWallet();

    const [product, setProduct] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [activeImage, setActiveImage] = useState(0);
    const [showReportModal, setShowReportModal] = useState(false);

    useEffect(() => {
        fetchProductDetails();
    }, [productId]);

    const fetchProductDetails = async () => {
        try {
            console.log('📦 Fetching product:', productId);
            
            // Fetch product from Firestore
            const productRef = doc(db, 'products', productId);
            const productDoc = await getDoc(productRef);

            if (!productDoc.exists()) {
                Alert.alert('Error', 'Product not found');
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
                return;
            }

            const productData = {
                id: productDoc.id,
                productId: productDoc.id,
                ...productDoc.data()
            };

            // Check if user already owns this product
            const user = auth.currentUser;
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const ownedProducts = userDoc.data().ownedProducts || [];
                    productData.hasPurchased = ownedProducts.includes(productId);
                }
            }

            // Create seller info from product data
            productData.seller = {
                userId: productData.creatorId || 'official',
                username: productData.creatorName || 'Official Store',
                displayName: productData.creatorName || 'Official Store',
                avatar: productData.creatorAvatar || 'https://via.placeholder.com/100',
                stats: {
                    averageRating: productData.stats?.rating || 5,
                    totalSales: productData.stats?.purchaseCount || 0
                }
            };

            // Ensure stats exist
            if (!productData.stats) {
                productData.stats = {
                    rating: 5,
                    reviewCount: 0,
                    purchases: 0,
                    views: 0
                };
            } else {
                productData.stats.purchases = productData.stats.purchaseCount || 0;
                productData.stats.views = productData.stats.viewCount || 0;
            }

            console.log('✅ Product loaded:', productData.title);
            setProduct(productData);

            // Fetch reviews
            await fetchProductReviews(productId);
        } catch (error) {
            console.error('❌ Failed to load product:', error);
            Alert.alert('Error', 'Failed to load product details');
            navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
        } finally {
            setLoading(false);
        }
    };

    const fetchProductReviews = async (productId) => {
        try {
            const reviewsRef = collection(db, 'reviews');
            const q = query(
                reviewsRef,
                where('productId', '==', productId),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            
            const snapshot = await getDocs(q);
            const reviewsList = snapshot.docs.map(doc => ({
                reviewId: doc.id,
                ...doc.data(),
                buyer: {
                    username: doc.data().buyerName || 'Anonymous',
                    avatar: doc.data().buyerAvatar || 'https://via.placeholder.com/50'
                }
            }));

            setReviews(reviewsList);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
            // Reviews are not critical, so we don't show error to user
        }
    };

    const handlePurchase = async () => {
        if (!product) return;

        // Check authentication
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'Please log in to make a purchase');
            navigation.navigate('Login');
            return;
        }

        // Check if already purchased
        if (product.hasPurchased) {
            Alert.alert('Already Owned', 'You already own this product.');
            return;
        }

        // Check balance (client-side pre-check for better UX)
        const currency = product.currency;
        const price = product.price;

        if (currency === 'diamonds' && wallet.diamonds < price) {
            Alert.alert(
                'Insufficient Diamonds',
                `You need ${price} diamonds but only have ${wallet.diamonds}. Buy more diamonds?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Buy Diamonds', onPress: () => navigation.navigate('DiamondPurchase') },
                ]
            );
            return;
        }

        if (currency === 'coins' && wallet.coins < price) {
            Alert.alert(
                'Insufficient Coins',
                `You need ${price} coins but only have ${wallet.coins}. Buy more coins?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Buy Coins', onPress: () => navigation.navigate('CoinPurchase') },
                ]
            );
            return;
        }

        // Confirm purchase
        Alert.alert(
            'Confirm Purchase',
            `Purchase "${product.title}" for ${price} ${currency}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Buy Now',
                    onPress: async () => {
                        setPurchasing(true);
                        try {
                            // Verify user is still authenticated
                            const currentUser = auth.currentUser;
                            if (!currentUser) {
                                throw new Error('User not authenticated');
                            }
                            
                            // Force refresh the auth token to ensure it's valid
                            console.log('🔐 Refreshing auth token...');
                            await currentUser.getIdToken(true);
                            console.log('✅ Auth token refreshed');
                            
                            console.log('🔐 Making purchase as user:', currentUser.uid);
                            console.log('📦 Product ID:', product.productId);
                            
                            // ✅ SECURE: Call Cloud Function instead of direct wallet update
                            const buyProduct = httpsCallable(functions, 'buyProduct');
                            
                            const result = await buyProduct({ 
                                productId: product.productId 
                            });
                            
                            console.log('✅ Purchase result:', result.data);

                            if (result.data.success) {
                                // Purchase successful!
                                Alert.alert(
                                    'Success! 🎉',
                                    result.data.message,
                                    [
                                        {
                                            text: 'View in Library',
                                            onPress: () => navigation.navigate('Library', {
                                                type: product.type
                                            })
                                        },
                                        {
                                            text: 'OK',
                                            onPress: () => {
                                                // Refresh wallet balance
                                    if (refreshWallet) {
                                        refreshWallet();
                                    }
                                    // Mark product as purchased and refetch
                                    fetchProductDetails();
                                }
                            }
                        ]
                    );
                } else {
                    Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
                }
            } catch (error) {
                console.error('❌ Purchase error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                
                // Handle specific error codes from Cloud Function
                if (error.code === 'functions/unauthenticated') {
                    Alert.alert(
                        'Authentication Error',
                        'Please log out and log back in, then try again.',
                        [
                            { text: 'OK', onPress: () => navigation.navigate('Login') }
                        ]
                    );
                } else if (error.code === 'functions/failed-precondition') {
                    // Insufficient balance or product not available
                    Alert.alert('Purchase Failed', error.message);
                } else if (error.code === 'functions/already-exists') {
                    Alert.alert('Already Owned', 'You already own this product');
                    fetchProductDetails();
                                Alert.alert('Error', 'Product not found');
                            } else {
                                Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
                            }
                        } finally {
                            setPurchasing(false);
                        }
                    },
                },
            ]
        );
    };

    const handleContactSeller = () => {
        if (!product || !product.seller) return;
        
        // Navigate to chat with seller
        navigation.navigate('ChatScreen', {
            recipientId: product.seller.userId,
            recipientName: product.seller.username
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={{ color: TEXT, marginTop: 12 }}>Loading product...</Text>
            </View>
        );
    }

    if (!product) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: TEXT }}>Product not found</Text>
            </View>
        );
    }

    // Prepare images array with fallback
    const images = product.coverImage 
        ? [product.coverImage, ...(product.previewImages || [])]
        : ['https://via.placeholder.com/400x400?text=No+Image'];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity>
                        <Ionicons name="heart-outline" size={24} color={TEXT} />
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Ionicons name="share-outline" size={24} color={TEXT} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowReportModal(true)}>
                        <Ionicons name="flag-outline" size={22} color={TEXT} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Image Gallery */}
                <View style={styles.imageGallery}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => {
                            const x = e.nativeEvent.contentOffset.x;
                            const index = Math.round(x / 400);
                            setActiveImage(index);
                        }}
                        scrollEventThrottle={16}
                    >
                        {images.map((img, idx) => (
                            <Image key={idx} source={{ uri: img }} style={styles.productImage} />
                        ))}
                    </ScrollView>

                    {/* Image Dots */}
                    <View style={styles.imageDots}>
                        {images.map((_, idx) => (
                            <View
                                key={idx}
                                style={[styles.dot, activeImage === idx && styles.dotActive]}
                            />
                        ))}
                    </View>
                </View>

                {/* Product Info */}
                <View style={styles.infoCard}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{product.title}</Text>
                        <View style={styles.priceTag}>
                            {product.currency === 'diamonds' ? (
                                <MaterialCommunityIcons name="diamond-stone" size={18} color="#EC4899" />
                            ) : (
                                <Ionicons name="logo-usd" size={18} color="#FFA500" />
                            )}
                            <Text style={styles.price}>{product.price}</Text>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Ionicons name="star" size={16} color="#FFD54F" />
                            <Text style={styles.statText}>{product.stats.rating.toFixed(1)}</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="cart" size={16} color="#9CA3AF" />
                            <Text style={styles.statText}>{product.stats.purchases} sold</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="eye" size={16} color="#9CA3AF" />
                            <Text style={styles.statText}>{product.stats.views} views</Text>
                        </View>
                    </View>

                    {/* Description */}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{product.description}</Text>

                    {/* Type-specific info */}
                    {product.type === 'sticker_pack' && (
                        <View style={styles.infoRow}>
                            <Ionicons name="images-outline" size={18} color={ACCENT} />
                            <Text style={styles.infoText}>{product.stickerCount} stickers included</Text>
                        </View>
                    )}

                    {product.type === 'comic' || product.type === 'book' && (
                        <View style={styles.infoRow}>
                            <Ionicons name="book-outline" size={18} color={ACCENT} />
                            <Text style={styles.infoText}>{product.pageCount} pages</Text>
                        </View>
                    )}

                    {product.type === 'freelance_gig' && (
                        <>
                            <View style={styles.infoRow}>
                                <Ionicons name="time-outline" size={18} color={ACCENT} />
                                <Text style={styles.infoText}>{product.deliveryTime} days delivery</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Ionicons name="refresh-outline" size={18} color={ACCENT} />
                                <Text style={styles.infoText}>{product.revisions} revisions</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Seller Card */}
                <View style={styles.sellerCard}>
                    <View style={styles.sellerInfo}>
                        <Image source={{ uri: product.seller.avatar }} style={styles.sellerAvatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sellerName}>{product.seller.displayName || product.seller.username}</Text>
                            <View style={styles.sellerStats}>
                                <Ionicons name="star" size={12} color="#FFD54F" />
                                <Text style={styles.sellerStatsText}>
                                    {product.seller.stats.averageRating.toFixed(1)} • {product.seller.stats.totalSales} sales
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.contactBtn} onPress={handleContactSeller}>
                            <Ionicons name="chatbubble-outline" size={18} color={ACCENT} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Reviews */}
                <View style={styles.reviewsSection}>
                    <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Reviews ({product.stats.reviewCount})</Text>
                        <TouchableOpacity>
                            <Text style={styles.viewAllText}>View all</Text>
                        </TouchableOpacity>
                    </View>

                    {reviews.slice(0, 3).map((review) => (
                        <View key={review.reviewId} style={styles.reviewItem}>
                            <View style={styles.reviewHeader}>
                                <Image source={{ uri: review.buyer.avatar }} style={styles.reviewerAvatar} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.reviewerName}>{review.buyer.username}</Text>
                                    <View style={styles.reviewStars}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Ionicons
                                                key={i}
                                                name={i < review.rating ? 'star' : 'star-outline'}
                                                size={12}
                                                color="#FFD54F"
                                            />
                                        ))}
                                    </View>
                                </View>
                                <Text style={styles.reviewDate}>
                                    {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Text>
                            </View>
                            <Text style={styles.reviewComment}>{review.comment}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Purchase Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[
                        styles.buyButton,
                        (purchasing || product.hasPurchased) && styles.buyButtonDisabled,
                    ]}
                    onPress={handlePurchase}
                    disabled={purchasing || product.hasPurchased}
                >
                    <LinearGradient
                        colors={product.hasPurchased ? ['#666', '#444'] : [ACCENT, '#EC4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buyButtonGradient}
                    >
                        {purchasing ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                {product.hasPurchased ? (
                                    <>
                                        <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                                        <Text style={styles.buyButtonText}>Already Owned</Text>
                                    </>
                                ) : (
                                    <>
                                        {product.currency === 'diamonds' ? (
                                            <MaterialCommunityIcons name="diamond-stone" size={24} color="#FFF" />
                                        ) : (
                                            <Ionicons name="logo-usd" size={24} color="#FFF" />
                                        )}
                                        <Text style={styles.buyButtonText}>Buy Now • {product.price} {product.currency}</Text>
                                    </>
                                )}
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Report Product Modal */}
            <ReportUserModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                reportedUser={{
                    id: product?.seller?.userId || product?.creatorId || '',
                    username: product?.seller?.username || product?.seller?.displayName || 'Seller',
                    name: product?.seller?.displayName || product?.seller?.username || 'Seller',
                }}
                reportType={REPORT_TYPES.PRODUCT}
                contentId={productId}
                contentType="product"
                contentPreview={product?.title || ''}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 10,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: 'rgba(11,11,14,0.8)',
    },
    headerRight: { flexDirection: 'row', gap: 16 },

    imageGallery: {
        height: 400,
        backgroundColor: CARD,
    },
    productImage: {
        width: 400,
        height: 400,
        resizeMode: 'cover',
    },
    imageDots: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    dotActive: {
        backgroundColor: '#FFF',
        width: 20,
    },

    infoCard: {
        backgroundColor: CARD,
        margin: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    title: {
        flex: 1,
        color: TEXT,
        fontSize: 22,
        fontWeight: '800',
        marginRight: 12,
    },
    priceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: ACCENT + '20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    price: {
        color: TEXT,
        fontSize: 18,
        fontWeight: '800',
    },

    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#23232A',
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: '#9CA3AF',
        fontSize: 13,
        fontWeight: '600',
    },

    sectionTitle: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    description: {
        color: '#9CA3AF',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },

    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    infoText: {
        color: TEXT,
        fontSize: 14,
        fontWeight: '600',
    },

    sellerCard: {
        backgroundColor: CARD,
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#23232A',
        marginBottom: 16,
    },
    sellerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sellerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    sellerName: {
        color: TEXT,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    sellerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sellerStatsText: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    contactBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: ACCENT + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },

    reviewsSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    viewAllText: {
        color: ACCENT,
        fontSize: 14,
        fontWeight: '600',
    },
    reviewItem: {
        backgroundColor: CARD,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    reviewerName: {
        color: TEXT,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    reviewStars: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewDate: {
        color: '#666',
        fontSize: 11,
    },
    reviewComment: {
        color: '#9CA3AF',
        fontSize: 13,
        lineHeight: 18,
    },

    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: 24,
        backgroundColor: BG,
        borderTopWidth: 1,
        borderTopColor: '#23232A',
    },
    buyButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    buyButtonDisabled: {
        opacity: 0.6,
    },
    buyButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    buyButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
});
