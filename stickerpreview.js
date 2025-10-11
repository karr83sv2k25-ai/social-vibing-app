import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT_DIM = '#9CA3AF';
const PINK = '#EC2EC9';

export default function StickerPreviewScreen({ route, navigation }) {
  const { item } = route.params || {};
  const bgSource = item?.img || require('./assets/pp1.png');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ImageBackground
        source={bgSource}
        style={styles.bg}
        imageStyle={{ opacity: 0.85 }}>
        {/* Top buttons */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBtn}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Floating info card (moved a bit higher) */}
        <View style={styles.infoCard}>
          <Image source={item?.img} style={styles.infoThumb} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.infoTitle} numberOfLines={1}>
              {item?.name || 'Anime chat'}
            </Text>

            {/* rating row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
              }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < (item?.rating || 5) ? 'star' : 'star-outline'}
                  size={12}
                  color="#FFD54F"
                  style={{ marginRight: 2 }}
                />
              ))}
              <Text style={{ color: '#fff', fontSize: 12, marginLeft: 6 }}>
                4.5/5 · 120 Reviews
              </Text>
            </View>

            {/* creator */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
              }}>
              <Ionicons name="person-circle" size={14} color="#6EE7B7" />
              <Text style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>
                {item?.creator || 'Ken·Kaneki'}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
              Preview
            </Text>
          </TouchableOpacity>
        </View>

        {/* Side vertical buttons */}
        <View style={styles.sideBtns}>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="bookmark-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="heart-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom bar — Preview + Buy now side-by-side */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.previewPill}>
            <Ionicons name="play-circle" size={18} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '700' }}>
              Preview
            </Text>
          </TouchableOpacity>

          {/* Gradient Buy Now button with border + glow */}
          <LinearGradient
            colors={['rgba(255, 6, 200, 0.40)', 'rgba(255, 6, 200, 0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buyGradient}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.buyBtn}
              onPress={() => navigation.navigate('PaymentDetail', { item })}>
              <Text style={styles.buyText}>Buy now</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, justifyContent: 'space-between' },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 38,
  },
  topBtn: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#25252c',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Info card moved slightly up */
  infoCard: {
    marginHorizontal: 14,
    marginTop: 4, // ↑ closer to top
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262630',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  infoThumb: { width: 50, height: 50, borderRadius: 8 },
  infoTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },

  sideBtns: {
    position: 'absolute',
    right: 14,
    top: '46%',
    gap: 10,
  },
  sideBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#262630',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Bottom: row with spacing */
  bottomBar: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    paddingTop: 396,
    backgroundColor: 'rgba(11,11,14,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#262630',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  buyGradient: {
    width: 213.25,
    height: 41,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF069B',
    justifyContent: 'center',
    // Glow
    shadowColor: '#FF1468',
    shadowOpacity: 0.7,
    shadowRadius: 9.9,
    shadowOffset: { width: 0, height: 0 },
  },
  buyBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#262630',
  },
});
