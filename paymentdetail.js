// TopUpCoinsScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';
const BORDER = '#23232A';
const CYAN = '#08FFE2';

export default function TopUpCoinsScreen({ navigation, route }) {
  // Item coming from previous screen, with fallbacks
  const item = route?.params?.item ?? {
    name: 'Anime Chat',
    rating: 5,
    reviews: 50,
    creator: 'Ken·Kaneki',
    price: 5, // coins
    img: require('./assets/pp1.png'),
  };

  // Example balance
  const balance = 8; // coins you already have

  const [qty, setQty] = useState(1);
  const [couponApplied, setCouponApplied] = useState(false);

  const linePrice = useMemo(() => item.price * qty, [item.price, qty]);
  const discount = couponApplied ? Math.round(linePrice * 0.1) : 0; // 10% off
  const total = Math.max(0, linePrice - discount);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.hBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Top Up coins</Text>
        <TouchableOpacity style={styles.hBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Your balance */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Your balance :</Text>
          <View style={styles.coinPill}>
            <Image
              source={require('./assets/goldicon.png')}
              style={styles.goldIcon}
            />
            <Text style={styles.coinText}>{balance}</Text>
          </View>
        </View>

        {/* Item card */}
        <View style={styles.itemCard}>
          <Image source={item.img} style={styles.itemThumb} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.itemTopRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.editPill}>
                <Text style={styles.editPillText}>Editor’s</Text>
              </View>
            </View>

            {/* Stars + reviews */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
              }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < item.rating ? 'star' : 'star-outline'}
                  size={12}
                  color="#FFD54F"
                  style={{ marginRight: 2 }}
                />
              ))}
              <Text style={styles.reviewText}>
                {' '}
                4.5/5 {item.reviews}+ Reviews
              </Text>
            </View>

            {/* Creator */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
              }}>
              <Ionicons name="person-circle" size={16} color="#6EE7B7" />
              <Text style={styles.creatorText}> {item.creator}</Text>
            </View>

            {/* Price line */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
              }}>
              <Image
                source={require('./assets/goldicon.png')}
                style={styles.goldIcon}
              />
              <Text style={styles.priceText}>{item.price}</Text>
            </View>
          </View>
        </View>

        {/* Order details label */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Order details</Text>
          <View style={styles.infoDot}>
            <Ionicons name="help" size={12} color="#fff" />
          </View>
        </View>

        {/* Quantity row */}
        <Row
          left="Quantity Details"
          right={
            <Stepper
              value={qty}
              onMinus={() => setQty((v) => Math.max(1, v - 1))}
              onPlus={() => setQty((v) => v + 1)}
            />
          }
        />

        {/* Required coins */}
        <Row
          left="Required coins"
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={require('./assets/goldicon.png')}
                style={styles.goldIcon}
              />
              <Text style={styles.rowValue}>{linePrice}</Text>
            </View>
          }
        />

        {/* Coupons */}
        <Row
          left="Coupons"
          right={
            <TouchableOpacity onPress={() => setCouponApplied((s) => !s)}>
              <Text style={styles.couponLink}>
                {couponApplied ? 'remove coupon' : 'apply coupon'}{' '}
                <Ionicons name="chevron-forward" size={12} color={CYAN} />
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Total coins required */}
        <View style={[styles.rowWrap, { marginTop: 6 }]}>
          <Text style={[styles.rowLabel, { color: '#fff' }]}>
            Total coins required
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={require('./assets/goldicon.png')}
              style={styles.goldIcon}
            />
            <Text style={[styles.rowValue, { fontWeight: '800' }]}>
              {total}
            </Text>
          </View>
        </View>

        {/* Buy now button */}
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <LinearGradient
            colors={['rgba(255, 6, 200, 0.4)', 'rgba(255, 6, 200, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buyGradient}>
            <TouchableOpacity
              style={styles.buyBtn}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('PaymentSelection', { item })} // 👈
            >
              <Text style={styles.buyText}>Buy now</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Small UI helpers ---------- */

function Row({ left, right }) {
  return (
    <View style={styles.rowWrap}>
      <Text style={styles.rowLabel}>{left}</Text>
      <View>{right}</View>
    </View>
  );
}

function Stepper({ value, onMinus, onPlus }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={onMinus} style={styles.stepBtn}>
        <Ionicons name="remove" size={14} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.stepVal}>{value}</Text>
      <TouchableOpacity onPress={onPlus} style={styles.stepBtn}>
        <Ionicons name="add" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 46,
    paddingBottom: 10,
  },
  hBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  balanceLabel: { color: TEXT_DIM, fontWeight: '700' },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  goldIcon: { width: 16, height: 16, resizeMode: 'contain' },
  coinText: { color: '#fff', fontWeight: '700' },

  itemCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemThumb: { width: 56, height: 56, borderRadius: 10 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#2A2A33',
    borderWidth: 1,
    borderColor: BORDER,
  },
  editPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reviewText: { color: '#fff', fontSize: 12, opacity: 0.85, marginLeft: 2 },
  creatorText: { color: '#fff', fontSize: 12 },

  sectionHeader: {
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { color: TEXT_DIM, fontWeight: '800', fontSize: 13 },
  infoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowWrap: {
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: { color: TEXT_DIM, fontWeight: '700' },
  rowValue: { color: '#fff', fontWeight: '700', marginLeft: 4 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 10,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1C1C22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    color: '#fff',
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },

  /* Buy-now gradient (as requested) */
  buyGradient: {
    width: 213.25,
    height: 41,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF069B',
    justifyContent: 'center',
    // Glow
    shadowColor: '#FF1468',
    shadowOpacity: 0.6,
    shadowRadius: 11.2,
    shadowOffset: { width: 0, height: 0 },
  },
  buyBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
