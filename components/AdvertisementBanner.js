/**
 * AdvertisementBanner Component
 * Displays active advertisements managed by the admin panel.
 * Fetches from Firestore `advertisements` collection.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
} from 'react-native';
import { subscribeToAdvertisements } from '../shared/services/advertisementService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AdvertisementBanner({ position = 'home', communityId = null, style }) {
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const unsub = subscribeToAdvertisements(
      { position, communityId, limitCount: 5 },
      (fetchedAds) => setAds(fetchedAds)
    );

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [position, communityId]);

  // Rotate ads every 8 seconds
  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % ads.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [ads.length]);

  if (!ads || ads.length === 0) return null;

  const ad = ads[currentIndex] || ads[0];
  if (!ad) return null;

  const handlePress = () => {
    if (ad.link) {
      Linking.openURL(ad.link).catch(err =>
        console.warn('Failed to open ad link:', err)
      );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {ad.imageUrl ? (
        <Image source={{ uri: ad.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.overlay}>
        {ad.title ? <Text style={styles.title} numberOfLines={1}>{ad.title}</Text> : null}
        {ad.description ? (
          <Text style={styles.description} numberOfLines={2}>{ad.description}</Text>
        ) : null}
      </View>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>Ad</Text>
      </View>
      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH - 32,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    marginVertical: 10,
  },
  image: {
    width: '100%',
    height: 140,
  },
  overlay: {
    padding: 10,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 3,
  },
  adLabel: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adLabelText: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: '#08FFE2',
  },
});
