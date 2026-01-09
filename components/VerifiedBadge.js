import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export const VerifiedBadge = ({ isVerified, size = 14, style }) => {
  if (!isVerified) return null;
  
  return (
    <Ionicons 
      name="shield-checkmark" 
      size={size} 
      color="#08FFE2" 
      style={[{ marginLeft: 4 }, style]}
    />
  );
};

export default VerifiedBadge;
