import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Discord-like role hierarchy:
 *   owner  → gold crown
 *   admin  → red shield-star
 *   leader → blue shield
 *   curator→ green palette
 *   moderator (legacy) → green shield
 *   creator (legacy alias for owner)
 *
 * @param {Object} props
 * @param {string} props.type - 'owner'|'admin'|'leader'|'curator'|'moderator'|'creator'
 * @param {boolean} props.showText - Whether to show text label (default: false)
 * @param {string} props.size - 'small' | 'medium' | 'large' (default: 'medium')
 */

const ROLE_CONFIG = {
  owner: {
    label: 'Owner',
    color: '#FFD700',
    icon: 'crown',
    iconLib: 'mci', // MaterialCommunityIcons
  },
  creator: {
    label: 'Owner',
    color: '#FFD700',
    icon: 'crown',
    iconLib: 'mci',
  },
  admin: {
    label: 'Admin',
    color: '#FF5555',
    icon: 'shield-star',
    iconLib: 'mci',
  },
  leader: {
    label: 'Leader',
    color: '#3B82F6',
    icon: 'shield-half-full',
    iconLib: 'mci',
  },
  curator: {
    label: 'Curator',
    color: '#10B981',
    icon: 'palette',
    iconLib: 'mci',
  },
  moderator: {
    label: 'Moderator',
    color: '#10B981',
    icon: 'shield-check',
    iconLib: 'mci',
  },
};

export default function ModeratorBadge({ type = 'moderator', showText = false, size = 'medium' }) {
  const config = ROLE_CONFIG[type] || ROLE_CONFIG.moderator;
  
  const sizeConfig = {
    small: { icon: 12, badge: 18, text: 10 },
    medium: { icon: 16, badge: 24, text: 12 },
    large: { icon: 20, badge: 28, text: 14 },
  };
  
  const s = sizeConfig[size] || sizeConfig.medium;
  
  const badgeStyle = {
    ...styles.badge,
    width: s.badge,
    height: s.badge,
    borderRadius: s.badge / 2,
    borderColor: config.color,
  };

  const IconComponent = config.iconLib === 'mci' ? MaterialCommunityIcons : MaterialIcons;
  
  if (showText) {
    return (
      <View style={styles.badgeWithText}>
        <View style={badgeStyle}>
          <IconComponent 
            name={config.icon} 
            size={s.icon} 
            color={config.color} 
          />
        </View>
        <Text style={[styles.badgeText, { fontSize: s.text, color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={badgeStyle}>
      <IconComponent 
        name={config.icon} 
        size={s.icon} 
        color={config.color} 
      />
    </View>
  );
}

/**
 * Inline role tag for chat messages (Discord-style colored pill).
 */
export function RoleBadgePill({ role, size = 'small' }) {
  const config = ROLE_CONFIG[role];
  if (!config || role === 'member') return null;

  const fontSize = size === 'small' ? 9 : size === 'medium' ? 11 : 13;
  const iconSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  const IconComponent = config.iconLib === 'mci' ? MaterialCommunityIcons : MaterialIcons;

  return (
    <View style={[styles.pill, { backgroundColor: config.color + '20', borderColor: config.color + '40' }]}>
      <IconComponent name={config.icon} size={iconSize} color={config.color} />
      <Text style={[styles.pillText, { fontSize, color: config.color }]}>{config.label}</Text>
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 6,
  },
  pillText: {
    fontWeight: '700',
  },
});
