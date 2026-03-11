// screens/marketplace/MyOrdersScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../../context/WalletContext';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const CYAN = '#08FFE2';

export default function MyOrdersScreen({ navigation }) {
    const { transactions, fetchTransactions, loading } = useWallet();
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        loadOrders();
    }, [filter]);

    const loadOrders = async () => {
        await fetchTransactions(1, { 
            type: filter === 'all' ? undefined : filter 
        });
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadOrders();
        setRefreshing(false);
    };

    const getTransactionIcon = (type) => {
        const icons = {
            coin_purchase: 'cart',
            diamond_purchase: 'cart',
            coin_earned: 'gift',
            diamond_earned: 'cash',
            coin_spent: 'remove-circle',
            diamond_spent: 'cart',
            withdrawal: 'arrow-up-circle',
            refund: 'arrow-undo',
            daily_reward: 'calendar',
            ad_reward: 'play-circle',
        };
        return icons[type] || 'help-circle';
    };

    const getTransactionColor = (type) => {
        if (type.includes('earned') || type.includes('purchase') || type.includes('reward') || type.includes('refund')) {
            return '#4ADE80';
        }
        return '#F87171';
    };

    const getStatusColor = (status) => {
        const colors = {
            completed: '#4ADE80',
            pending: '#FFA500',
            failed: '#F87171',
            refunded: '#9CA3AF',
        };
        return colors[status] || '#9CA3AF';
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Filter transactions to show only purchase/order related ones
    const orderTransactions = transactions.filter(tx => 
        tx.type.includes('purchase') || 
        tx.type.includes('spent') || 
        tx.type === 'withdrawal'
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Orders</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh-outline" size={24} color={TEXT} />
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {['all', 'coin_purchase', 'diamond_purchase', 'coin_spent', 'diamond_spent', 'withdrawal'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && styles.filterChipActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                {f.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Orders List */}
            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} />
                }
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={CYAN} />
                        <Text style={styles.loadingText}>Loading orders...</Text>
                    </View>
                ) : orderTransactions.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="cart-outline" size={64} color="#666" />
                        <Text style={styles.emptyTitle}>No Orders Yet</Text>
                        <Text style={styles.emptySubtitle}>Your purchase history will appear here</Text>
                    </View>
                ) : (
                    <View style={styles.ordersList}>
                        {orderTransactions.map((order) => (
                            <View key={order.transactionId} style={styles.orderCard}>
                                <View style={styles.orderHeader}>
                                    <View style={[styles.orderIcon, { backgroundColor: getTransactionColor(order.type) + '20' }]}>
                                        <Ionicons
                                            name={getTransactionIcon(order.type)}
                                            size={24}
                                            color={getTransactionColor(order.type)}
                                        />
                                    </View>
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderTitle}>{order.description}</Text>
                                        <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                                    </View>
                                    <View style={styles.orderRight}>
                                        <Text style={[styles.orderAmount, { color: getTransactionColor(order.type) }]}>
                                            {order.amount > 0 ? '+' : ''}{order.amount}
                                        </Text>
                                        <Text style={styles.orderCurrency}>{order.currency}</Text>
                                    </View>
                                </View>

                                {/* Order Details */}
                                <View style={styles.orderDetails}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Transaction ID</Text>
                                        <Text style={styles.detailValue} numberOfLines={1}>
                                            {order.transactionId?.slice(0, 16)}...
                                        </Text>
                                    </View>
                                    {order.status && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Status</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                                                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
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
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
    },
    headerTitle: {
        color: TEXT,
        fontSize: 20,
        fontWeight: '700',
    },
    filterContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    filterScroll: {
        gap: 8,
    },
    filterChip: {
        backgroundColor: CARD,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    filterChipActive: {
        backgroundColor: CYAN + '20',
        borderColor: CYAN,
    },
    filterText: {
        color: '#9CA3AF',
        fontSize: 13,
        fontWeight: '600',
    },
    filterTextActive: {
        color: CYAN,
    },
    content: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 14,
        marginTop: 12,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyTitle: {
        color: TEXT,
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        marginTop: 8,
    },
    ordersList: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 12,
    },
    orderCard: {
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    orderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    orderIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    orderInfo: {
        flex: 1,
    },
    orderTitle: {
        color: TEXT,
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    orderDate: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    orderRight: {
        alignItems: 'flex-end',
    },
    orderAmount: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 2,
    },
    orderCurrency: {
        color: '#9CA3AF',
        fontSize: 11,
        textTransform: 'uppercase',
    },
    orderDetails: {
        borderTopWidth: 1,
        borderTopColor: '#23232A',
        paddingTop: 12,
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    detailValue: {
        color: TEXT,
        fontSize: 12,
        fontWeight: '500',
        maxWidth: 200,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
});
