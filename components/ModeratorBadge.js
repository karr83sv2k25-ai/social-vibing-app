import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * ModeratorBadge - Displays a badge indicating moderator or creator status
 * 
 * @param {Object} props
 * @param {string} props.type - 'creator' or 'moderator'
 * @param {boolean} props.showText - Whether to show text label (default: false)
 * @param {string} props.size - 'small' | 'medium' | 'large' (default: 'medium')
 */
export default function ModeratorBadge({ type = 'moderator', showText = false, size = 'medium' }) {
  const isCreator = type === 'creator';
  
  const sizeConfig = {
    small: { icon: 12, badge: 18, text: 10 },
    medium: { icon: 16, badge: 24, text: 12 },
    large: { icon: 20, badge: 28, text: 14 },
  };
  
  const config = sizeConfig[size] || sizeConfig.medium;
  
  const badgeStyle = {
    ...styles.badge,
    width: config.badge,
    height: config.badge,
    borderRadius: config.badge / 2,
    borderColor: isCreator ? '#FFD700' : '#10B981',
  };
  
  if (showText) {
    return (
      <View style={styles.badgeWithText}>
        <View style={badgeStyle}>
          <MaterialIcons 
            name={isCreator ? "verified" : "admin-panel-settings"} 
            size={config.icon} 
            color={isCreator ? '#FFD700' : '#10B981'} 
          />
        </View>
        <Text style={[styles.badgeText, { fontSize: config.text, color: isCreator ? '#FFD700' : '#10B981' }]}>
          {isCreator ? 'Creator' : 'Moderator'}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={badgeStyle}>
      <MaterialIcons 
        name={isCreator ? "verified" : "admin-panel-settings"} 
        size={config.icon} 
        color={isCreator ? '#FFD700' : '#10B981'} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  badgeWithText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontWeight: '600',
  },
});
