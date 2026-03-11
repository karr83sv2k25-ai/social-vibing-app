// DiamondPurchaseScreen.js
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useIAP} from './services/iapService';
import {IAP_PRODUCTS} from './config/iapConfig';
import {getAuth} from 'firebase/auth';
import {getFirestore, doc, onSnapshot} from 'firebase/firestore';
import {
  AnimatedPurchaseCard,
  PulseView,
  FadeInView,
  ShimmerPlaceholder,
} from './components/AnimatedPurchaseCard';

const BG = '#0B0B0E';
const CARD = '#17171C';
const BORDER = '#23232A';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const DIAMOND = '#00D9FF'; // Cyan for diamonds
const DIAMOND_DARK = '#0099CC';
const GREEN = '#00FF73';

export default function DiamondPurchaseScreen({navigation}) {
  const {products, loading: iapLoading, purchasing, purchaseProduct, getProduct} = useIAP();
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [balanceUpdated, setBalanceUpdated] = useState(false);

  // Load user's current diamond balance
  useEffect(() => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const db = getFirestore();
    const userRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        const newDiamonds = userData.wallet?.diamonds || 0;

        // Trigger pulse animation if balance increased
        if (newDiamonds > userDiamonds && !loadingBalance) {
          setBalanceUpdated(true);
          setTimeout(() => setBalanceUpdated(false), 400);
        }

        setUserDiamonds(newDiamonds);
      }
      setLoadingBalance(false);
    });

    return () => unsubscribe();
  }, [userDiamonds, loadingBalance]);

  // Handle purchase
  const handlePurchase = (productId) => {
    Alert.alert(
      'Confirm Purchase',
      `Purchase ${IAP_PRODUCTS.DIAMONDS[productId].amount} diamonds?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Buy',
          onPress: () => purchaseProduct(productId),
        },
      ],
    );
  };

  // Get diamond products from config
  const diamondProducts = Object.entries(IAP_PRODUCTS.DIAMONDS).map(([id, product]) => {
    const storeProduct = getProduct(id);
    return {
      id,
      ...product,
      localizedPrice: storeProduct?.localizedPrice || product.price,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔹 Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Up Diamonds</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 💎 Balance Display */}
        <FadeInView delay={0}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceContent}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              {loadingBalance ? (
                <ActivityIndicator size="small" color={DIAMOND} />
              ) : (
                <PulseView trigger={balanceUpdated}>
                  <View style={styles.balanceRow}>
                    <Ionicons name="diamond" size={24} color={DIAMOND} />
                    <Text style={styles.balanceAmount}>{userDiamonds.toLocaleString()}</Text>
                    <Text style={styles.balanceUnit}>Diamonds</Text>
                  </View>
                </PulseView>
              )}
            </View>
          </View>
        </FadeInView>

        {/* Loading State */}
        {iapLoading && (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.card}>
                <ShimmerPlaceholder style={{width: 48, height: 48, marginBottom: 8}} />
                <ShimmerPlaceholder style={{width: 60, height: 24, marginBottom: 4}} />
                <ShimmerPlaceholder style={{width: 80, height: 32}} />
              </View>
            ))}
          </View>
        )}

        {/* 💎 Diamonds Grid */}
        {!iapLoading && (
          <View style={styles.grid}>
            {diamondProducts.map((product, index) => {
              const totalAmount = product.amount + (product.bonus || 0);
              const hasBonus = product.bonus && product.bonus > 0;

              return (
                <FadeInView key={product.id} delay={index * 100} style={{width: '47%'}}>
                  <AnimatedPurchaseCard
                    onPress={() => handlePurchase(product.id)}
                    disabled={purchasing}
                    hasBonus={hasBonus}
                    style={[
                      styles.card,
                      purchasing && styles.cardDisabled,
                      hasBonus && styles.cardBonusHighlight,
                    ]}
                  >
                  {hasBonus && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusText}>+{product.bonus} BONUS</Text>
                    </View>
                  )}

                  <Ionicons name="diamond" size={48} color={DIAMOND} />

                  <Text style={styles.amountText}>{totalAmount}</Text>
                  <Text style={styles.diamondLabel}>Diamonds</Text>

                  {hasBonus && (
                    <Text style={styles.baseAmountText}>
                      {product.amount} + {product.bonus} bonus
                    </Text>
                  )}

                    <View style={styles.pricePill}>
                      {purchasing ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.priceText}>{product.localizedPrice}</Text>
                      )}
                    </View>
                  </AnimatedPurchaseCard>
                </FadeInView>
              );
            })}
          </View>
        )}

        {/* Info Section */}
        <FadeInView delay={600}>
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>💎 About Diamonds</Text>
            <Text style={styles.infoText}>
              • Premium currency for exclusive items{'\n'}
              • Access limited edition content{'\n'}
              • VIP customizations and special effects{'\n'}
              • Bonus diamonds on larger packages
            </Text>
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

/* 🎨 Styles */
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BG},

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerTitle: {color: TEXT, fontSize: 16, fontWeight: '800'},

  balanceCard: {
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  balanceContent: {alignItems: 'center'},
  balanceLabel: {
    color: TEXT_DIM,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceAmount: {
    color: DIAMOND,
    fontSize: 32,
    fontWeight: '800',
  },
  balanceUnit: {
    color: TEXT_DIM,
    fontSize: 16,
    fontWeight: '600',
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 12,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 20,
  },

  card: {
    width: '47%',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 12,
    position: 'relative',
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardBonusHighlight: {
    borderColor: DIAMOND,
    borderWidth: 2,
  },

  bonusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: DIAMOND,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bonusText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
  },

  amountText: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  diamondLabel: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  baseAmountText: {
    color: TEXT_DIM,
    fontSize: 10,
    marginBottom: 8,
  },

  pricePill: {
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  priceText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },

  infoSection: {
    marginHorizontal: 16,
    marginBottom: 30,
    padding: 16,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    color: TEXT_DIM,
    fontSize: 12,
    lineHeight: 20,
  },
});

