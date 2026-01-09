// screens/KingMediaAIChatScreen.js - AI Chat interface
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiAPI, getRateLimitInfo, formatError } from '../services/kingMediaService';

export default function KingMediaAIChatScreen({ navigation }) {
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState('kingai'); // kingai, openai, gemini

    const handleAsk = async () => {
        if (!question.trim()) {
            Alert.alert('Error', 'Please enter a question');
            return;
        }

        const userMessage = { type: 'user', text: question, time: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setQuestion('');
        setLoading(true);

        try {
            const result = await aiAPI.ask(question, provider);

            if (result.success) {
                const aiMessage = {
                    type: 'ai',
                    text: result.answer,
                    provider: result.provider,
                    tokens: result.tokens_used,
                    time: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
            }
        } catch (error) {
            const rateLimitInfo = getRateLimitInfo(error);

            if (rateLimitInfo.limited) {
                Alert.alert(
                    'Rate Limit Exceeded',
                    rateLimitInfo.message
                );
            } else {
                Alert.alert('Error', formatError(error));
            }

            const errorMessage = {
                type: 'error',
                text: formatError(error),
                time: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const providers = [
        { id: 'kingai', name: 'King AI', icon: 'flash' },
        { id: 'openai', name: 'OpenAI', icon: 'logo-openai' },
        { id: 'gemini', name: 'Gemini', icon: 'diamond' },
    ];

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={90}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Chat</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Provider Selector */}
            <View style={styles.providerRow}>
                {providers.map(p => (
                    <TouchableOpacity
                        key={p.id}
                        style={[styles.providerChip, provider === p.id && styles.providerChipActive]}
                        onPress={() => setProvider(p.id)}
                    >
                        <Ionicons
                            name={p.icon}
                            size={16}
                            color={provider === p.id ? '#fff' : '#9CA3AF'}
                        />
                        <Text
                            style={[styles.providerText, provider === p.id && styles.providerTextActive]}
                        >
                            {p.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Messages */}
            <ScrollView
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="chatbubbles-outline" size={60} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Ask me anything!</Text>
                        <Text style={styles.emptySubtext}>20 requests per hour</Text>
                    </View>
                ) : (
                    messages.map((msg, index) => (
                        <View
                            key={index}
                            style={[
                                styles.messageBubble,
                                msg.type === 'user' ? styles.userBubble : styles.aiBubble,
                                msg.type === 'error' && styles.errorBubble,
                            ]}
                        >
                            <Text style={styles.messageText}>{msg.text}</Text>
                            {msg.type === 'ai' && msg.tokens && (
                                <Text style={styles.messageInfo}>
                                    {msg.provider} • {msg.tokens} tokens
                                </Text>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask me anything..."
                    placeholderTextColor="#9CA3AF"
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                    maxLength={500}
                    editable={!loading}
                />
                <TouchableOpacity
                    style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                    onPress={handleAsk}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#23232A',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    providerRow: {
        flexDirection: 'row',
        padding: 15,
        gap: 10,
    },
    providerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#17171C',
        borderWidth: 1,
        borderColor: '#23232A',
    },
    providerChipActive: {
        backgroundColor: '#7C3AED',
        borderColor: '#7C3AED',
    },
    providerText: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
    },
    providerTextActive: {
        color: '#fff',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 20,
        flexGrow: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 15,
    },
    emptySubtext: {
        color: '#9CA3AF',
        fontSize: 14,
        marginTop: 5,
    },
    messageBubble: {
        padding: 15,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '85%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#7C3AED',
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#17171C',
        borderWidth: 1,
        borderColor: '#23232A',
    },
    errorBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#EF4444',
    },
    messageText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
    },
    messageInfo: {
        color: '#9CA3AF',
        fontSize: 11,
        marginTop: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        borderTopWidth: 1,
        borderTopColor: '#23232A',
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        backgroundColor: '#17171C',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 15,
        maxHeight: 100,
        marginRight: 10,
    },
    sendButton: {
        backgroundColor: '#7C3AED',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.6,
    },
});
