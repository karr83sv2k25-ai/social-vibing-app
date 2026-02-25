// components/ProfileWithFrame.js - Profile picture with optional frame overlay
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import productUsageService from '../services/productUsageService';

export default function ProfileWithFrame({ 
  userId, 
  avatarUrl, 
  size = 50, 
  style,
  showFrame = true 
}) {
  const [frameImage, setFrameImage] = useState(null);

  useEffect(() => {
    if (showFrame && userId) {
      loadFrame();
    }
  }, [userId, showFrame]);

  const loadFrame = async () => {
    try {
      const frame = await productUsageService.getActiveProfileFrame(userId);
      if (frame && frame.frameImage) {
        setFrameImage(frame.frameImage);
      }
    } catch (error) {
      console.error('Failed to load frame:', error);
    }
  };

  return (
    <View style={[styles.container, style, { width: size, height: size }]}>
      {/* Avatar */}
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]} />
      )}
      
      {/* Frame Overlay */}
      {frameImage && (
        <Image
          source={{ uri: frameImage }}
          style={[styles.frame, { width: size, height: size }]}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    position: 'absolute',
  },
  placeholder: {
    backgroundColor: '#2A2A32',
    position: 'absolute',
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
