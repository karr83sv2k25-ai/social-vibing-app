// screens/marketplace/ProductTypeSelectionScreen.js - Select product type before upload
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getProductTypesList } from '../../config/productTypeConfig';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#9CA3AF';

export default function ProductTypeSelectionScreen({ navigation }) {
  const productTypes = getProductTypesList();
  
  const handleTypeSelect = (type) => {
    navigation.navigate('TypeSpecificUpload', { productType: type.id });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Product</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>What are you creating?</Text>
          <Text style={styles.subtitle}>
            Choose the type of product you want to sell
          </Text>
          
          <View style={styles.grid}>
            {productTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={styles.typeCard}
                onPress={() => handleTypeSelect(type)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconContainer, { backgroundColor: type.color + '20' }]}>
                  <Ionicons name={type.icon} size={32} color={type.color} />
                </View>
                <Text style={styles.typeName}>{type.name}</Text>
                <Text style={styles.typeDesc} numberOfLines={2}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  title: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: TEXT_DIM,
    fontSize: 14,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  typeDesc: {
    color: TEXT_DIM,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
