// components/AnimatedPurchaseCard.js - Animated Purchase Card Component
import React, {useRef, useEffect} from 'react';
import {Animated, TouchableOpacity, StyleSheet} from 'react-native';

/**
 * Animated card component for purchase items
 * Features: Scale animation on press, shimmer effect for bonus items
 */
export const AnimatedPurchaseCard = ({
  children,
  onPress,
  disabled,
  hasBonus,
  style,
  activeOpacity = 0.8,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Shimmer animation for bonus cards
  useEffect(() => {
    if (hasBonus) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [hasBonus, shimmerAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{scale: scaleAnim}],
            opacity: hasBonus ? shimmerOpacity : 1,
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Pulse animation for balance updates
 */
export const PulseView = ({children, trigger, style}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (trigger) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [trigger, pulseAnim]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{scale: pulseAnim}],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Fade in animation for elements
 */
export const FadeInView = ({children, delay = 0, style}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Loading shimmer effect
 */
export const ShimmerPlaceholder = ({style}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.shimmer,
        style,
        {
          opacity,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: '#23232A',
    borderRadius: 8,
  },
});

export default AnimatedPurchaseCard;
