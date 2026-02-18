// screens/viewers/CustomizationScreen.js - Profile frame and chat bubble customizer
import React, {useState, useEffect} from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {getDoc, doc, updateDoc} from 'firebase/firestore';
import {db, auth} from '../../firebaseConfig';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

export default function CustomizationScreen({route, navigation}) {
  const {productId, type} = route.params; // type: 'profileFrame' or 'chatBubble'
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);

  useEffect(() => {
    fetchProduct();
    fetchUserData();
  }, []);

  const fetchProduct = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        setProduct(productDoc.data());
      } else {
        Alert.alert('Error', 'Customization not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load customization');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUserData(userDoc.data());
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleApplyCustomization = async () => {
    setApplying(true);

    try {
      const functions = getFunctions();
      const setActiveCustomization = httpsCallable(
        functions,
        'setActiveCustomization',
      );

      const result = await setActiveCustomization({
        type: type,
        productId: productId,
      });

      if (result.data.success) {
        Alert.alert(
          'Success! ✨',
          `${type === 'profileFrame' ? 'Profile frame' : 'Chat bubble'} activated!`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    } catch (error) {
      console.error('Customization error:', error);
      Alert.alert(
        'Failed',
        error.message || 'Unable to apply customization',
      );
    } finally {
      setApplying(false);
    }
  };

  const handleRemoveCustomization = async () => {
    Alert.alert(
      'Remove Customization',
      `Remove this ${type === 'profileFrame' ? 'frame' : 'bubble theme'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setApplying(true);
            try {
              const functions = getFunctions();
              const setActiveCustomization = httpsCallable(
                functions,
                'setActiveCustomization',
              );

              await setActiveCustomization({
                type: type,
                productId: null, // null removes the customization
              });

              Alert.alert('Removed', 'Customization removed', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              console.error('Remove error:', error);
              Alert.alert('Error', 'Failed to remove customization');
            } finally {
              setApplying(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading customization...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="color-palette-outline" size={64} color={TEXT} />
        <Text style={styles.errorText}>Customization not available</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isProfileFrame = type === 'profileFrame';
  const config = isProfileFrame
    ? product.profileFrameConfig
    : product.chatBubbleConfig;
  const previewUrl = config?.previewImageUrl || product.coverImage;

  // Check if this is currently active
  const isActive = isProfileFrame
    ? currentUserData?.activeCustomizations?.profileFrameId === productId
    : currentUserData?.activeCustomizations?.chatBubbleThemeId === productId;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {product.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isProfileFrame ? 'Profile Frame' : 'Chat Bubble Theme'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Customization Info',
              `${product.title}\n\nType: ${isProfileFrame ? 'Profile Frame' : 'Chat Bubble Theme'}\n\nCreator: ${product.creator || 'Unknown'}\n\nDescription: ${product.description || 'No description'}`,
            );
          }}
          style={styles.headerButton}
        >
          <Ionicons name="information-circle-outline" size={24} color={TEXT} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Preview Section */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Preview</Text>

          {isProfileFrame ? (
            /* Frame Preview */
            <View style={styles.framePreviewContainer}>
              <Image
                source={{uri: previewUrl}}
                style={styles.framePreview}
                resizeMode="contain"
              />
              {/* User avatar overlay for frame preview */}
              {currentUserData?.profilePicture && (
                <Image
                  source={{uri: currentUserData.profilePicture}}
                  style={styles.avatarPreview}
                />
              )}
            </View>
          ) : (
            /* Bubble Preview */
            <View style={styles.bubblePreviewContainer}>
              {/* Preview with different messages */}
              <View style={styles.bubbleExampleContainer}>
                <Text style={styles.bubbleLabel}>Your messages:</Text>
                <View
                  style={[
                    styles.messageExample,
                    styles.sentMessage,
                    config?.colors && {
                      backgroundColor: config.colors.sentBackground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      config?.colors && {color: config.colors.sentText},
                    ]}
                  >
                    Hey! How are you?
                  </Text>
                </View>
                <View
                  style={[
                    styles.messageExample,
                    styles.sentMessage,
                    config?.colors && {
                      backgroundColor: config.colors.sentBackground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      config?.colors && {color: config.colors.sentText},
                    ]}
                  >
                    Check out my new chat theme! 
                  </Text>
                </View>
              </View>

              <View style={styles.bubbleExampleContainer}>
                <Text style={styles.bubbleLabel}>Received messages:</Text>
                <View
                  style={[
                    styles.messageExample,
                    styles.receivedMessage,
                    config?.colors && {
                      backgroundColor: config.colors.receivedBackground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      config?.colors && {color: config.colors.receivedText},
                    ]}
                  >
                    Hi! I'm doing great!
                  </Text>
                </View>
                <View
                  style={[
                    styles.messageExample,
                    styles.receivedMessage,
                    config?.colors && {
                      backgroundColor: config.colors.receivedBackground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      config?.colors && {color: config.colors.receivedText},
                    ]}
                  >
                    Looks awesome! 🎨
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isActive && (
            <View style={styles.activeLabel}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.activeLabelText}>Currently Active</Text>
            </View>
          )}
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Creator</Text>
              <Text style={styles.detailValue}>
                {product.creator || 'Unknown'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {isProfileFrame ? 'Profile Frame' : 'Chat Bubble Theme'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rarity</Text>
              <Text style={styles.detailValue}>
                {config?.rarity || 'Standard'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Users</Text>
              <Text style={styles.detailValue}>
                {product.stats?.purchaseCount || 0} collected
              </Text>
            </View>
          </View>
        </View>

        <View style={{height: 120}} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {isActive ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={handleRemoveCustomization}
            disabled={applying}
          >
            {applying ? (
              <ActivityIndicator size="small" color={TEXT} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={24} color={TEXT} />
                <Text style={styles.actionButtonText}>Remove</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.applyButton]}
            onPress={handleApplyCustomization}
            disabled={applying}
          >
            {applying ? (
              <ActivityIndicator size="small" color={TEXT} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color={TEXT} />
                <Text style={styles.actionButtonText}>Apply Now</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT,
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: TEXT,
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: ACCENT,
    borderRadius: 8,
  },
  backButtonText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  previewSection: {
    padding: 16,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  framePreviewContainer: {
    width: SCREEN_WIDTH - 64,
    height: SCREEN_WIDTH - 64,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  framePreview: {
    width: '100%',
    height: '100%',
  },
  avatarPreview: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 1000,
  },
  bubblePreviewContainer: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
  },
  bubbleExampleContainer: {
    marginBottom: 24,
  },
  bubbleLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  messageExample: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
  },
  messageText: {
    color: TEXT,
    fontSize: 15,
  },
  activeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  activeLabelText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailsSection: {
    padding: 16,
  },
  detailsCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailLabel: {
    color: '#999',
    fontSize: 14,
  },
  detailValue: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  applyButton: {
    backgroundColor: ACCENT,
  },
  removeButton: {
    backgroundColor: '#DC3545',
  },
  actionButtonText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
