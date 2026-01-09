// screens/marketplace/ProductCreationWizardScreen.js - 3-step product creation
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { productAPI } from '../../api/productAPI';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';

// Product types with icons
const PRODUCT_TYPES = [
    { id: 'chat_bubble', name: 'Chat Bubble', icon: 'chatbubbles', color: '#FF6B6B' },
    { id: 'profile_frame', name: 'Profile Frame', icon: 'frame', color: '#4ECDC4' },
    { id: 'art', name: 'Artwork', icon: 'color-palette', color: '#FFE66D' },
    { id: 'sticker_pack', name: 'Sticker Pack', icon: 'happy', color: '#A8E6CF' },
    { id: 'comic', name: 'Comic', icon: 'book', color: '#FF8B94' },
    { id: 'book', name: 'E-Book', icon: 'library', color: '#C7CEEA' },
    { id: 'freelance_gig', name: 'Freelance Gig', icon: 'briefcase', color: '#FFDAB9' },
];

export default function ProductCreationWizardScreen({ route, navigation }) {
    const { productType, productId } = route.params || {}; // productId for editing
    const isEditing = !!productId;

    // Step 1: Category & Name
    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(productType || null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');

    // Step 2: Description & Assets
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState(null);
    const [previewImages, setPreviewImages] = useState([]);
    const [assets, setAssets] = useState([]);

    // Step 2 extras (type-specific)
    const [stickerCount, setStickerCount] = useState('');
    const [pageCount, setPageCount] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('');
    const [revisions, setRevisions] = useState('');

    // Step 3: Preview & Pricing
    const [price, setPrice] = useState('');
    const [currency, setCurrency] = useState('diamonds');
    const [publishing, setPublishing] = useState(false);

    const pickCoverImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setCoverImage(result.assets[0].uri);
        }
    };

    const pickPreviewImages = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setPreviewImages([...previewImages, ...result.assets.map(a => a.uri)]);
        }
    };

    const pickAsset = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
        });

        if (!result.canceled) {
            const file = result.assets[0];
            setAssets([...assets, {
                uri: file.uri,
                name: file.name,
                size: file.size,
                type: file.mimeType,
            }]);
        }
    };

    const removeAsset = (index) => {
        setAssets(assets.filter((_, i) => i !== index));
    };

    const removePreviewImage = (index) => {
        setPreviewImages(previewImages.filter((_, i) => i !== index));
    };

    const validateStep = () => {
        if (step === 1) {
            if (!selectedType || !title.trim()) {
                Alert.alert('Missing Info', 'Please select a type and enter a title');
                return false;
            }
        } else if (step === 2) {
            if (!description.trim() || !coverImage) {
                Alert.alert('Missing Info', 'Please add a description and cover image');
                return false;
            }
            if (assets.length === 0 && selectedType !== 'freelance_gig') {
                Alert.alert('Missing Assets', 'Please upload at least one asset file');
                return false;
            }
        } else if (step === 3) {
            if (!price || parseFloat(price) <= 0) {
                Alert.alert('Invalid Price', 'Please enter a valid price');
                return false;
            }
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep()) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step === 1) {
            navigation.goBack();
        } else {
            setStep(step - 1);
        }
    };

    const handlePublish = async () => {
        if (!validateStep()) return;

        setPublishing(true);

        try {
            // 1. Upload cover image
            const coverUpload = await productAPI.uploadAsset(coverImage, 'image');

            // 2. Upload preview images
            const previewUploads = await Promise.all(
                previewImages.map(img => productAPI.uploadAsset(img, 'image'))
            );

            // 3. Upload asset files
            const assetUploads = await Promise.all(
                assets.map(asset => {
                    const type = asset.type?.includes('image') ? 'image' :
                        asset.type?.includes('pdf') ? 'pdf' :
                            asset.type?.includes('zip') ? 'zip' : 'file';
                    return productAPI.uploadAsset(asset.uri, type);
                })
            );

            // 4. Create product
            const productData = {
                type: selectedType,
                title: title.trim(),
                description: description.trim(),
                category: category.trim() || 'General',
                price: parseFloat(price),
                currency,
                coverImage: coverUpload.url,
                previewImages: previewUploads.map(u => u.url),
                assets: assetUploads.map((u, i) => ({
                    type: assets[i].type?.includes('image') ? 'image' :
                        assets[i].type?.includes('pdf') ? 'pdf' :
                            assets[i].type?.includes('zip') ? 'zip' : 'file',
                    url: u.url,
                    thumbnail: u.thumbnail,
                    size: assets[i].size,
                    fileName: assets[i].name,
                })),
                status: 'published',
            };

            // Add type-specific fields
            if (selectedType === 'sticker_pack' && stickerCount) {
                productData.stickerCount = parseInt(stickerCount);
            }
            if ((selectedType === 'comic' || selectedType === 'book') && pageCount) {
                productData.pageCount = parseInt(pageCount);
            }
            if (selectedType === 'freelance_gig') {
                productData.deliveryTime = parseInt(deliveryTime) || 7;
                productData.revisions = parseInt(revisions) || 1;
            }

            const response = isEditing
                ? await productAPI.updateProduct(productId, productData)
                : await productAPI.createProduct(productData);

            if (response.success) {
                Alert.alert(
                    'Success!',
                    `Product ${isEditing ? 'updated' : 'published'} successfully`,
                    [
                        {
                            text: 'View in Marketplace',
                            onPress: () => {
                                navigation.navigate('ProductDetail', { productId: response.data.productId });
                            },
                        },
                        {
                            text: 'Go to Dashboard',
                            onPress: () => {
                                navigation.navigate('SellerDashboard');
                            },
                        },
                    ]
                );
            }
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to publish product');
        } finally {
            setPublishing(false);
        }
    };

    // ===== RENDER STEPS =====

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 1: Choose Category & Name</Text>

            <Text style={styles.label}>Product Type</Text>
            <View style={styles.typeGrid}>
                {PRODUCT_TYPES.map((type) => (
                    <TouchableOpacity
                        key={type.id}
                        style={[
                            styles.typeCard,
                            selectedType === type.id && { borderColor: type.color, borderWidth: 2 },
                        ]}
                        onPress={() => setSelectedType(type.id)}
                        disabled={!!productType} // Disable if coming from specific category
                    >
                        <Ionicons name={type.icon} size={32} color={type.color} />
                        <Text style={styles.typeName}>{type.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Product Title *</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g., Neon Cyberpunk Bubble"
                placeholderTextColor="#666"
                value={title}
                onChangeText={setTitle}
                maxLength={60}
            />

            <Text style={styles.label}>Category (Optional)</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g., Animated, Minimal, etc."
                placeholderTextColor="#666"
                value={category}
                onChangeText={setCategory}
                maxLength={30}
            />
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 2: Description & Assets</Text>

            <Text style={styles.label}>Description *</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your product in detail..."
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                maxLength={1000}
            />

            <Text style={styles.label}>Cover Image *</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickCoverImage}>
                {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.coverPreview} />
                ) : (
                    <>
                        <Ionicons name="image-outline" size={40} color="#666" />
                        <Text style={styles.uploadText}>Upload Cover (1:1 ratio)</Text>
                    </>
                )}
            </TouchableOpacity>

            <Text style={styles.label}>Preview Images (up to 5)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                {previewImages.map((img, idx) => (
                    <View key={idx} style={styles.previewImageContainer}>
                        <Image source={{ uri: img }} style={styles.previewImage} />
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => removePreviewImage(idx)}
                        >
                            <Ionicons name="close-circle" size={24} color="#F87171" />
                        </TouchableOpacity>
                    </View>
                ))}
                {previewImages.length < 5 && (
                    <TouchableOpacity style={styles.addPreviewBtn} onPress={pickPreviewImages}>
                        <Ionicons name="add" size={32} color="#666" />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {selectedType !== 'freelance_gig' && (
                <>
                    <Text style={styles.label}>Asset Files *</Text>
                    {assets.map((asset, idx) => (
                        <View key={idx} style={styles.assetItem}>
                            <Ionicons name="document" size={20} color={ACCENT} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.assetName} numberOfLines={1}>{asset.name}</Text>
                                <Text style={styles.assetSize}>{(asset.size / 1024).toFixed(1)} KB</Text>
                            </View>
                            <TouchableOpacity onPress={() => removeAsset(idx)}>
                                <Ionicons name="trash-outline" size={20} color="#F87171" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    <TouchableOpacity style={styles.uploadBtn} onPress={pickAsset}>
                        <Ionicons name="cloud-upload-outline" size={20} color={ACCENT} />
                        <Text style={styles.uploadBtnText}>Upload Asset File</Text>
                    </TouchableOpacity>
                </>
            )}

            {/* Type-specific fields */}
            {selectedType === 'sticker_pack' && (
                <>
                    <Text style={styles.label}>Number of Stickers</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 24"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={stickerCount}
                        onChangeText={setStickerCount}
                    />
                </>
            )}

            {(selectedType === 'comic' || selectedType === 'book') && (
                <>
                    <Text style={styles.label}>Page Count</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 120"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={pageCount}
                        onChangeText={setPageCount}
                    />
                </>
            )}

            {selectedType === 'freelance_gig' && (
                <>
                    <Text style={styles.label}>Delivery Time (days)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 7"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={deliveryTime}
                        onChangeText={setDeliveryTime}
                    />
                    <Text style={styles.label}>Revisions Included</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 2"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={revisions}
                        onChangeText={setRevisions}
                    />
                </>
            )}
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 3: Preview & Pricing</Text>

            {/* Product Preview */}
            <View style={styles.previewCard}>
                {coverImage && <Image source={{ uri: coverImage }} style={styles.previewCover} />}
                <Text style={styles.previewTitle}>{title || 'Product Title'}</Text>
                <Text style={styles.previewDesc} numberOfLines={3}>
                    {description || 'Product description...'}
                </Text>
            </View>

            <Text style={styles.label}>Currency</Text>
            <View style={styles.currencyRow}>
                <TouchableOpacity
                    style={[styles.currencyBtn, currency === 'diamonds' && styles.currencyBtnActive]}
                    onPress={() => setCurrency('diamonds')}
                >
                    <MaterialCommunityIcons
                        name="diamond-stone"
                        size={20}
                        color={currency === 'diamonds' ? '#EC4899' : '#666'}
                    />
                    <Text style={[styles.currencyText, currency === 'diamonds' && styles.currencyTextActive]}>
                        Diamonds
                    </Text>
                </TouchableOpacity>

                {selectedType !== 'freelance_gig' && (
                    <TouchableOpacity
                        style={[styles.currencyBtn, currency === 'coins' && styles.currencyBtnActive]}
                        onPress={() => setCurrency('coins')}
                    >
                        <Ionicons
                            name="logo-usd"
                            size={20}
                            color={currency === 'coins' ? '#FFA500' : '#666'}
                        />
                        <Text style={[styles.currencyText, currency === 'coins' && styles.currencyTextActive]}>
                            Coins
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.label}>Price *</Text>
            <TextInput
                style={styles.input}
                placeholder={`Enter price in ${currency}`}
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
            />

            {currency === 'diamonds' && price && (
                <View style={styles.earningsInfo}>
                    <Text style={styles.earningsLabel}>You'll earn (after 25% commission):</Text>
                    <Text style={styles.earningsValue}>
                        {(parseFloat(price) * 0.75).toFixed(1)} Diamonds
                    </Text>
                    <Text style={styles.earningsUSD}>
                        ≈ ${(parseFloat(price) * 0.75 * 0.10).toFixed(2)} USD
                    </Text>
                </View>
            )}

            {currency === 'coins' && (
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#3B82F6" />
                    <Text style={styles.infoText}>
                        Coin products don't generate earnings. Only use coins for AI-generated content or special items.
                    </Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isEditing ? 'Edit Product' : 'Create Product'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
                {[1, 2, 3].map((s) => (
                    <View
                        key={s}
                        style={[
                            styles.progressSegment,
                            s <= step && { backgroundColor: ACCENT },
                        ]}
                    />
                ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Buttons */}
            <View style={styles.bottomButtons}>
                {step < 3 ? (
                    <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                        <Text style={styles.nextBtnText}>Next Step</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.nextBtn, publishing && styles.nextBtnDisabled]}
                        onPress={handlePublish}
                        disabled={publishing}
                    >
                        {publishing ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                                <Text style={styles.nextBtnText}>{isEditing ? 'Update' : 'Publish'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 10,
    },
    headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },

    progressBar: {
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
    },

    stepContainer: { paddingHorizontal: 16 },
    stepTitle: { color: TEXT, fontSize: 20, fontWeight: '800', marginBottom: 20 },

    label: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 14,
        color: TEXT,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },

    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    typeCard: {
        width: '31%',
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#23232A',
    },
    typeName: { color: TEXT, fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },

    uploadBox: {
        backgroundColor: CARD,
        borderRadius: 12,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#23232A',
        borderStyle: 'dashed',
    },
    coverPreview: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    uploadText: { color: '#666', fontSize: 14, marginTop: 8 },

    previewScroll: { flexDirection: 'row', marginBottom: 8 },
    previewImageContainer: { marginRight: 10, position: 'relative' },
    previewImage: { width: 100, height: 100, borderRadius: 8 },
    removeBtn: { position: 'absolute', top: -8, right: -8 },
    addPreviewBtn: {
        width: 100,
        height: 100,
        borderRadius: 8,
        backgroundColor: CARD,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#23232A',
        borderStyle: 'dashed',
    },

    assetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: CARD,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    assetName: { color: TEXT, fontSize: 14, fontWeight: '600' },
    assetSize: { color: '#666', fontSize: 11 },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: CARD,
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: ACCENT,
        borderStyle: 'dashed',
    },
    uploadBtnText: { color: ACCENT, fontSize: 14, fontWeight: '600' },

    previewCard: {
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    previewCover: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        marginBottom: 12,
    },
    previewTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    previewDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },

    currencyRow: { flexDirection: 'row', gap: 12 },
    currencyBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: CARD,
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#23232A',
    },
    currencyBtnActive: { borderColor: ACCENT },
    currencyText: { color: '#666', fontSize: 14, fontWeight: '600' },
    currencyTextActive: { color: TEXT },

    earningsInfo: {
        backgroundColor: ACCENT + '20',
        padding: 14,
        borderRadius: 12,
        marginTop: 12,
    },
    earningsLabel: { color: '#9CA3AF', fontSize: 12 },
    earningsValue: { color: TEXT, fontSize: 20, fontWeight: '800', marginTop: 4 },
    earningsUSD: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },

    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#3B82F620',
        padding: 12,
        borderRadius: 12,
        gap: 10,
        marginTop: 12,
    },
    infoText: { color: '#9CA3AF', fontSize: 12, lineHeight: 16, flex: 1 },

    bottomButtons: {
        padding: 16,
        paddingBottom: 24,
        backgroundColor: BG,
        borderTopWidth: 1,
        borderTopColor: '#23232A',
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: ACCENT,
        paddingVertical: 16,
        borderRadius: 16,
    },
    nextBtnDisabled: { opacity: 0.5 },
    nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
