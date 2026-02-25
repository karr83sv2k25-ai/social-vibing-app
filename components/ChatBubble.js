// components/ChatBubble.js - Chat message bubble with theme support
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import productUsageService from '../services/productUsageService';

export default function ChatBubble({ 
  message, 
  isSent, 
  userId,
  style 
}) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    if (userId) {
      loadTheme();
    }
  }, [userId]);

  const loadTheme = async () => {
    try {
      const chatTheme = await productUsageService.getActiveChatBubbleTheme(userId);
      if (chatTheme) {
        setTheme(chatTheme);
      }
    } catch (error) {
      console.error('Failed to load chat theme:', error);
    }
  };

  // Default styles
  const defaultStyle = isSent
    ? styles.sentBubble
    : styles.receivedBubble;

  // Apply theme if available
  const bubbleStyle = theme
    ? {
        backgroundColor: theme.metadata?.colorScheme || (isSent ? '#7C3AED' : '#2A2A32'),
        borderRadius: 16,
        borderBottomLeftRadius: isSent ? 16 : 4,
        borderBottomRightRadius: isSent ? 4 : 16,
      }
    : defaultStyle;

  return (
    <View style={[bubbleStyle, style]}>
      <Text style={styles.messageText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receivedBubble: {
    backgroundColor: '#2A2A32',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '75%',
  },
  sentBubble: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: '75%',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
});
