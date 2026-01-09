// screens/marketplace/WalletScreen.js - Wallet UI
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    RefreshControl,
    Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../context/WalletContext';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';

export default function WalletScreen({ navigation }) {
    const {
        wallet,
        loading,
        fetchWallet,
        fetchTransactions,
        transactions,
        canWithdraw,
        getFormattedBalance,
    } = useWallet();

    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        fetchTransactions(1, { type: activeTab === 'all' ? undefined : activeTab });
    }, [activeTab]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchWallet();
        await fetchTransactions(1);
        setRefreshing(false);
    };

    const handleBuyCoins = () => {
        navigation.navigate('CoinPurchase');
    };

    const handleBuyDiamonds = () => {
        navigation.navigate('DiamondPurchase');
    };

    const handleWithdraw = () => {
        if (!canWithdraw()) {
            Alert.alert(
                'Minimum Not Met',
                `You need at least ${wallet.minimumWithdrawal} diamonds to withdraw.`,
                [{ text: 'OK' }]
            );
            return;
        }
        navigation.navigate('Withdrawal');
    };

    const getTransactionIcon = (type) => {
        const icons = {
            coin_purchase: 'add-circle',
            diamond_purchase: 'add-circle',
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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Wallet</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh-outline" size={24} color={TEXT} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} />}
            >
                {/* Balance Cards */}
                <View style={styles.balancesContainer}>
                    {/* Coins Card */}
                    <LinearGradient
                        colors={['#FFA500', '#FF6B00']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.balanceCard}
                    >
                        <View style={styles.balanceHeader}>
                            <Ionicons name="logo-usd" size={28} color="#FFF" />
                            <Text style={styles.balanceLabel}>Coins</Text>
                        </View>
                        <Text style={styles.balanceAmount}>{getFormattedBalance('coins')}</Text>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleBuyCoins}>
                            <Text style={styles.actionBtnText}>Buy Coins</Text>
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Diamonds Card */}
                    <LinearGradient
                        colors={['#A855F7', '#EC4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.balanceCard}
                    >
                        <View style={styles.balanceHeader}>
                            <MaterialCommunityIcons name="diamond-stone" size={28} color="#FFF" />
                            <Text style={styles.balanceLabel}>Diamonds</Text>
                        </View>
                        <Text style={styles.balanceAmount}>{getFormattedBalance('diamonds')}</Text>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleBuyDiamonds}>
                            <Text style={styles.actionBtnText}>Buy Diamonds</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                {/* Earnings Card (for creators) */}
                {wallet.earningsBalance > 0 && (
                    <View style={styles.earningsCard}>
                        <View style={styles.earningsRow}>
                            <View>
                                <Text style={styles.earningsLabel}>Withdrawable Balance</Text>
                                <Text style={styles.earningsAmount}>
                                    {getFormattedBalance('withdrawableBalance')} Diamonds
                                </Text>
                                <Text style={styles.earningsUSD}>≈ ${(wallet.withdrawableBalance * 0.10).toFixed(2)} USD</Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.withdrawBtn,
                                    !canWithdraw() && styles.withdrawBtnDisabled,
                                ]}
                                onPress={handleWithdraw}
                                disabled={!canWithdraw()}
                            >
                                <Text style={styles.withdrawBtnText}>
                                    {canWithdraw() ? 'Withdraw' : `Min ${wallet.minimumWithdrawal}`}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.earningsStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Lifetime Earnings</Text>
                                <Text style={styles.statValue}>{getFormattedBalance('lifetimeEarnings')}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Pending</Text>
                                <Text style={styles.statValue}>{getFormattedBalance('pendingEarnings')}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickActionBtn}>
                        <Ionicons name="gift-outline" size={24} color={CYAN} />
                        <Text style={styles.quickActionText}>Daily Reward</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn}>
                        <Ionicons name="play-circle-outline" size={24} color={CYAN} />
                        <Text style={styles.quickActionText}>Watch Ads</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('MyOrders')}>
                        <Ionicons name="receipt-outline" size={24} color={CYAN} />
                        <Text style={styles.quickActionText}>My Orders</Text>
                    </TouchableOpacity>
                </View>

                {/* Transaction History */}
                <View style={styles.transactionsSection}>
                    <Text style={styles.sectionTitle}>Transaction History</Text>

                    {/* Filter Tabs */}
                    <View style={styles.tabs}>
                        {['all', 'coin_earned', 'diamond_earned', 'coin_spent', 'diamond_spent'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, activeTab === tab && styles.tabActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                    {tab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Transaction List */}
                    <View style={styles.transactionsList}>
                        {transactions.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="receipt-outline" size={48} color="#666" />
                                <Text style={styles.emptyText}>No transactions yet</Text>
                            </View>
                        ) : (
                            transactions.map((tx) => (
                                <View key={tx.transactionId} style={styles.transactionItem}>
                                    <View style={styles.txLeft}>
                                        <View style={[styles.txIcon, { backgroundColor: getTransactionColor(tx.type) + '20' }]}>
                                            <Ionicons
                                                name={getTransactionIcon(tx.type)}
                                                size={20}
                                                color={getTransactionColor(tx.type)}
                                            />
                                        </View>
                                        <View>
                                            <Text style={styles.txDescription}>{tx.description}</Text>
                                            <Text style={styles.txDate}>
                                                {new Date(tx.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.txRight}>
                                        <Text style={[styles.txAmount, { color: getTransactionColor(tx.type) }]}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                                        </Text>
                                        <Text style={styles.txCurrency}>{tx.currency}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    headerTitle: { color: TEXT, fontSize: 28, fontWeight: '800' },

    balancesContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
    },
    balanceCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        minHeight: 140,
    },
    balanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    balanceLabel: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.9,
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 12,
    },
    actionBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    actionBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },

    earningsCard: {
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    earningsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    earningsLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
    earningsAmount: { color: TEXT, fontSize: 24, fontWeight: '800' },
    earningsUSD: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    withdrawBtn: {
        backgroundColor: ACCENT,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    withdrawBtnDisabled: { backgroundColor: '#444' },
    withdrawBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
    earningsStats: { flexDirection: 'row', gap: 20 },
    statItem: { flex: 1 },
    statLabel: { color: '#9CA3AF', fontSize: 11, marginBottom: 4 },
    statValue: { color: TEXT, fontSize: 16, fontWeight: '700' },

    quickActions: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: 16,
        gap: 12,
    },
    quickActionBtn: {
        flex: 1,
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#23232A',
    },
    quickActionText: {
        color: TEXT,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 6,
        textAlign: 'center',
    },

    transactionsSection: { marginTop: 24, paddingHorizontal: 16, paddingBottom: 40 },
    sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 12 },

    tabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    tab: {
        backgroundColor: CARD,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#23232A',
    },
    tabActive: { backgroundColor: ACCENT + '30', borderColor: ACCENT },
    tabText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
    tabTextActive: { color: TEXT },

    transactionsList: { gap: 8 },
    transactionItem: {
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#23232A',
    },
    txLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    txIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txDescription: { color: TEXT, fontSize: 14, fontWeight: '600', marginBottom: 2 },
    txDate: { color: '#9CA3AF', fontSize: 11 },
    txRight: { alignItems: 'flex-end' },
    txAmount: { fontSize: 16, fontWeight: '800' },
    txCurrency: { color: '#9CA3AF', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },

    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: { color: '#666', fontSize: 14, marginTop: 12 },
});
