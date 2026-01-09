// screens/KingMediaImageGenScreen.js - AI Image Generator
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiAPI, getRateLimitInfo, formatError } from '../services/kingMediaService';

export default function KingMediaImageGenScreen({ navigation }) {
    const [prompt, setPrompt] = useState('');
    const [provider, setProvider] = useState('dalle'); // dalle, kingai
    const [loading, setLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);

    useEffect(() => {
        checkLoginStatus();
    }, []);

    const checkLoginStatus = async () => {
        const token = await AsyncStorage.getItem('kingmedia_jwt_token');
        if (!token) {
            Alert.alert(
                'Login Required',
                'Please login to King Media to use AI Image Generator',
                [
                    { text: 'Cancel', onPress: () => navigation.goBack() },
                    { text: 'Login', onPress: () => navigation.navigate('KingMediaLogin') }
                ]
            );
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            Alert.alert('Error', 'Please enter an image description');
            return;
        }

        setLoading(true);
        setGeneratedImage(null);
        setImageUrl(null);

        try {
            console.log(`🎨 Starting image generation with prompt: "${prompt}"`);
            const result = await aiAPI.generateImage(prompt, provider);
            console.log('📦 Generation result:', result);

            if (result.success && result.image_url) {
                console.log(`✅ Image URL received: ${result.image_url}`);
                setImageUrl(result.image_url);
                setGeneratedImage({
                    url: result.image_url,
                    prompt: prompt,
                    provider: result.provider,
                    timestamp: new Date().toISOString(),
                });

                Alert.alert(
                    'Success! 🎨',
                    'Your image has been generated successfully!'
                );
            } else if (result.success === false) {
                // API returned error (e.g., OpenAI key not configured)
                Alert.alert(
                    'Configuration Error',
                    result.message || 'Image generation failed. Please contact admin to configure API keys.'
                );
            }
        } catch (error) {
            console.log('❌ Image generation error:', error);
            const rateLimitInfo = getRateLimitInfo(error);

            if (error.response?.status === 401) {
                Alert.alert(
                    'Authentication Required',
                    'Please login to King Media first',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Login', onPress: () => navigation.navigate('KingMediaLogin') }
                    ]
                );
            } else if (rateLimitInfo.limited) {
                Alert.alert(
                    'Rate Limit Exceeded',
                    rateLimitInfo.message
                );
            } else {
                const errorMsg = formatError(error);
                Alert.alert('Error', errorMsg || 'Failed to generate image. Please check your connection.');
            }
        } finally {
            setLoading(false);
        }
    };

    const providers = [
        { id: 'dalle', name: 'DALL-E', icon: 'image-outline' },
        { id: 'kingai', name: 'King AI', icon: 'flash' },
    ];

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={90}
        >
            {/* Header */}
            <LinearGradient
                colors={['#10B981', '#06B6D4']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Ionicons name="image" size={28} color="#fff" />
                    <Text style={styles.headerTitle}>AI Image Generator</Text>
                </View>
                <View style={{ width: 24 }} />
            </LinearGradient>

            <ScrollView style={styles.content}>
                {/* Provider Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Select AI Provider</Text>
                    <View style={styles.providerRow}>
                        {providers.map(p => (
                            <TouchableOpacity
                                key={p.id}
                                style={[
                                    styles.providerChip,
                                    provider === p.id && styles.providerChipActive
                                ]}
                                onPress={() => setProvider(p.id)}
                            >
                                <Ionicons
                                    name={p.icon}
                                    size={18}
                                    color={provider === p.id ? '#10B981' : '#9CA3AF'}
                                />
                                <Text style={[
                                    styles.providerText,
                                    provider === p.id && styles.providerTextActive
                                ]}>
                                    {p.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Prompt Input */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Image Description</Text>
                    <TextInput
                        style={styles.promptInput}
                        placeholder="Describe the image you want to generate..."
                        placeholderTextColor="#6B7280"
                        value={prompt}
                        onChangeText={setPrompt}
                        multiline
                        maxLength={500}
                        editable={!loading}
                    />
                    <Text style={styles.charCount}>{prompt.length}/500</Text>
                </View>

                {/* Generate Button */}
                <TouchableOpacity
                    style={[styles.generateButton, loading && styles.generateButtonDisabled]}
                    onPress={handleGenerate}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={loading ? ['#6B7280', '#4B5563'] : ['#10B981', '#06B6D4']}
                        style={styles.generateGradient}
                    >
                        {loading ? (
                            <>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.generateText}>Generating...</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={20} color="#fff" />
                                <Text style={styles.generateText}>Generate Image</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Rate Limit Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={20} color="#10B981" />
                    <Text style={styles.infoText}>
                        You can generate up to 5 images per hour
                    </Text>
                </View>

                {/* Generated Image Preview */}
                {imageUrl && (
                    <View style={styles.resultSection}>
                        <Text style={styles.resultTitle}>Generated Image</Text>
                        <View style={styles.imageCard}>
                            <Image
                                source={{ uri: imageUrl }}
                                style={styles.generatedImage}
                                resizeMode="contain"
                                onError={(error) => {
                                    console.log('❌ Image failed to load:', error.nativeEvent.error);
                                    console.log('Image URL:', imageUrl);
                                }}
                                onLoad={() => {
                                    console.log('✅ Image loaded successfully:', imageUrl);
                                }}
                            />
                            <View style={styles.imageInfo}>
                                <Text style={styles.imagePrompt} numberOfLines={2}>
                                    {generatedImage?.prompt}
                                </Text>
                                <View style={styles.imageMeta}>
                                    <View style={styles.providerBadge}>
                                        <Ionicons name="flash" size={12} color="#10B981" />
                                        <Text style={styles.providerBadgeText}>
                                            {generatedImage?.provider}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Empty State */}
                {!loading && !imageUrl && (
                    <View style={styles.emptyState}>
                        <Ionicons name="image-outline" size={80} color="#374151" />
                        <Text style={styles.emptyTitle}>No Image Generated Yet</Text>
                        <Text style={styles.emptyDesc}>
                            Enter a description and tap "Generate Image" to create your AI artwork
                        </Text>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0B0E',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 50,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    providerRow: {
        flexDirection: 'row',
        gap: 12,
    },
    providerChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#17171C',
        borderWidth: 2,
        borderColor: '#23232A',
    },
    providerChipActive: {
        backgroundColor: '#10B98120',
        borderColor: '#10B981',
    },
    providerText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    providerTextActive: {
        color: '#10B981',
    },
    promptInput: {
        backgroundColor: '#17171C',
        borderWidth: 1,
        borderColor: '#23232A',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 14,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    charCount: {
        color: '#6B7280',
        fontSize: 12,
        textAlign: 'right',
        marginTop: 8,
    },
    generateButton: {
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    generateButtonDisabled: {
        opacity: 0.6,
    },
    generateGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
    },
    generateText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#10B98120',
        marginHorizontal: 16,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#10B98140',
        marginBottom: 20,
    },
    infoText: {
        flex: 1,
        color: '#10B981',
        fontSize: 13,
        fontWeight: '500',
    },
    resultSection: {
        padding: 16,
    },
    resultTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    imageCard: {
        backgroundColor: '#17171C',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#23232A',
        overflow: 'hidden',
    },
    generatedImage: {
        width: '100%',
        height: 300,
        backgroundColor: '#000',
    },
    imageInfo: {
        padding: 16,
    },
    imagePrompt: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 12,
    },
    imageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    providerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10B98120',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    providerBadgeText: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDesc: {
        color: '#6B7280',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
