// screens/marketplace/WithdrawalScreen.js - Withdrawal request screen
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../../context/WalletContext';

const BG = '#0B0B0E';
const CARD = '#17171C';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';
const CYAN = '#08FFE2';
const ERROR = '#F87171';

const WITHDRAWAL_METHODS = [
    { id: 'paypal', name: 'PayPal', icon: 'logo-paypal', minAmount: 50 },
    { id: 'cashapp', name: 'Cash App', icon: 'cash-outline', minAmount: 50 },
    { id: 'bank', name: 'Bank Transfer', icon: 'card-outline', minAmount: 100 },
];

export default function WithdrawalScreen({ navigation }) {
    const { wallet, requestWithdrawal, canWithdraw, getFormattedBalance } = useWallet();
    
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [amount, setAmount] = useState('');
    const [paypalEmail, setPaypalEmail] = useState('');
    const [cashappTag, setCashappTag] = useState('');
    const [bankDetails, setBankDetails] = useState({
        accountName: '',
        accountNumber: '',
        routingNumber: '',
        bankName: '',
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        // Validate amount
        const withdrawalAmount = parseFloat(amount);
        if (!amount || isNaN(withdrawalAmount)) {
            newErrors.amount = 'Please enter a valid amount';
        } else if (withdrawalAmount < wallet.minimumWithdrawal) {
            newErrors.amount = `Minimum withdrawal is ${wallet.minimumWithdrawal} diamonds`;
        } else if (withdrawalAmount > wallet.withdrawableBalance) {
            newErrors.amount = 'Insufficient balance';
        }

        // Validate payment details
        if (!selectedMethod) {
            newErrors.method = 'Please select a withdrawal method';
        } else if (selectedMethod === 'paypal') {
            if (!paypalEmail) {
                newErrors.paypalEmail = 'PayPal email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
                newErrors.paypalEmail = 'Invalid email format';
            }
        } else if (selectedMethod === 'cashapp') {
            if (!cashappTag) {
                newErrors.cashappTag = 'Cash App tag is required';
            } else if (!cashappTag.startsWith('$')) {
                newErrors.cashappTag = 'Cash App tag must start with $';
            }
        } else if (selectedMethod === 'bank') {
            if (!bankDetails.accountName) newErrors.accountName = 'Account name is required';
            if (!bankDetails.accountNumber) newErrors.accountNumber = 'Account number is required';
            if (!bankDetails.routingNumber) newErrors.routingNumber = 'Routing number is required';
            if (!bankDetails.bankName) newErrors.bankName = 'Bank name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleWithdrawal = async () => {
        if (!validateForm()) {
            return;
        }

        const withdrawalAmount = parseFloat(amount);
        const usdAmount = (withdrawalAmount * 0.10).toFixed(2);

        Alert.alert(
            'Confirm Withdrawal',
            `Withdraw ${withdrawalAmount} diamonds (≈ $${usdAmount} USD) via ${WITHDRAWAL_METHODS.find(m => m.id === selectedMethod)?.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const payoutDetails = {};
                            
                            if (selectedMethod === 'paypal') {
                                payoutDetails.paypalEmail = paypalEmail;
                            } else if (selectedMethod === 'cashapp') {
                                payoutDetails.cashappTag = cashappTag;
                            } else if (selectedMethod === 'bank') {
                                payoutDetails.bankDetails = bankDetails;
                            }

                            const result = await requestWithdrawal(
                                withdrawalAmount,
                                selectedMethod,
                                payoutDetails
                            );

                            Alert.alert(
                                'Success',
                                `Withdrawal request submitted! You'll receive your payment within 3-5 business days.`,
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => navigation.goBack(),
                                    },
                                ]
                            );
                        } catch (error) {
                            let errorMessage = 'Failed to process withdrawal';
                            
                            if (error.message === 'INSUFFICIENT_BALANCE') {
                                errorMessage = 'Insufficient balance';
                            } else if (error.message === 'BELOW_MINIMUM') {
                                errorMessage = `Minimum withdrawal is ${wallet.minimumWithdrawal} diamonds`;
                            } else if (error.message === 'USER_NOT_LOGGED_IN') {
                                errorMessage = 'Please log in to continue';
                            }

                            Alert.alert('Error', errorMessage);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const renderMethodField = () => {
        if (selectedMethod === 'paypal') {
            return (
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>PayPal Email</Text>
                    <TextInput
                        style={[styles.input, errors.paypalEmail && styles.inputError]}
                        placeholder="your@email.com"
                        placeholderTextColor="#666"
                        value={paypalEmail}
                        onChangeText={(text) => {
                            setPaypalEmail(text);
                            if (errors.paypalEmail) {
                                setErrors({ ...errors, paypalEmail: null });
                            }
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    {errors.paypalEmail && <Text style={styles.errorText}>{errors.paypalEmail}</Text>}
                </View>
            );
        } else if (selectedMethod === 'cashapp') {
            return (
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Cash App Tag</Text>
                    <TextInput
                        style={[styles.input, errors.cashappTag && styles.inputError]}
                        placeholder="$YourCashTag"
                        placeholderTextColor="#666"
                        value={cashappTag}
                        onChangeText={(text) => {
                            setCashappTag(text);
                            if (errors.cashappTag) {
                                setErrors({ ...errors, cashappTag: null });
                            }
                        }}
                        autoCapitalize="none"
                    />
                    {errors.cashappTag && <Text style={styles.errorText}>{errors.cashappTag}</Text>}
                </View>
            );
        } else if (selectedMethod === 'bank') {
            return (
                <>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Account Name</Text>
                        <TextInput
                            style={[styles.input, errors.accountName && styles.inputError]}
                            placeholder="John Doe"
                            placeholderTextColor="#666"
                            value={bankDetails.accountName}
                            onChangeText={(text) => {
                                setBankDetails({ ...bankDetails, accountName: text });
                                if (errors.accountName) {
                                    setErrors({ ...errors, accountName: null });
                                }
                            }}
                        />
                        {errors.accountName && <Text style={styles.errorText}>{errors.accountName}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Account Number</Text>
                        <TextInput
                            style={[styles.input, errors.accountNumber && styles.inputError]}
                            placeholder="123456789"
                            placeholderTextColor="#666"
                            value={bankDetails.accountNumber}
                            onChangeText={(text) => {
                                setBankDetails({ ...bankDetails, accountNumber: text });
                                if (errors.accountNumber) {
                                    setErrors({ ...errors, accountNumber: null });
                                }
                            }}
                            keyboardType="number-pad"
                        />
                        {errors.accountNumber && <Text style={styles.errorText}>{errors.accountNumber}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Routing Number</Text>
                        <TextInput
                            style={[styles.input, errors.routingNumber && styles.inputError]}
                            placeholder="987654321"
                            placeholderTextColor="#666"
                            value={bankDetails.routingNumber}
                            onChangeText={(text) => {
                                setBankDetails({ ...bankDetails, routingNumber: text });
                                if (errors.routingNumber) {
                                    setErrors({ ...errors, routingNumber: null });
                                }
                            }}
                            keyboardType="number-pad"
                        />
                        {errors.routingNumber && <Text style={styles.errorText}>{errors.routingNumber}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Bank Name</Text>
                        <TextInput
                            style={[styles.input, errors.bankName && styles.inputError]}
                            placeholder="Chase Bank"
                            placeholderTextColor="#666"
                            value={bankDetails.bankName}
                            onChangeText={(text) => {
                                setBankDetails({ ...bankDetails, bankName: text });
                                if (errors.bankName) {
                                    setErrors({ ...errors, bankName: null });
                                }
                            }}
                        />
                        {errors.bankName && <Text style={styles.errorText}>{errors.bankName}</Text>}
                    </View>
                </>
            );
        }
        return null;
    };

    const usdAmount = amount ? (parseFloat(amount) * 0.10).toFixed(2) : '0.00';

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Withdrawal</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Balance Card */}
                <LinearGradient
                    colors={['#A855F7', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.balanceCard}
                >
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.balanceAmount}>
                        {getFormattedBalance('withdrawableBalance')} Diamonds
                    </Text>
                    <Text style={styles.balanceUSD}>≈ ${(wallet.withdrawableBalance * 0.10).toFixed(2)} USD</Text>
                </LinearGradient>

                {/* Amount Input */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Withdrawal Amount</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Diamonds</Text>
                        <TextInput
                            style={[styles.input, errors.amount && styles.inputError]}
                            placeholder={`Min ${wallet.minimumWithdrawal}`}
                            placeholderTextColor="#666"
                            value={amount}
                            onChangeText={(text) => {
                                setAmount(text);
                                if (errors.amount) {
                                    setErrors({ ...errors, amount: null });
                                }
                            }}
                            keyboardType="numeric"
                        />
                        {amount && !errors.amount && (
                            <Text style={styles.usdConversion}>≈ ${usdAmount} USD</Text>
                        )}
                        {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
                    </View>

                    {/* Quick Amount Buttons */}
                    <View style={styles.quickAmounts}>
                        {[50, 100, 250, 500].map((amt) => (
                            <TouchableOpacity
                                key={amt}
                                style={styles.quickAmountBtn}
                                onPress={() => setAmount(amt.toString())}
                                disabled={amt > wallet.withdrawableBalance}
                            >
                                <Text style={[
                                    styles.quickAmountText,
                                    amt > wallet.withdrawableBalance && styles.quickAmountTextDisabled
                                ]}>
                                    {amt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Withdrawal Method */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Withdrawal Method</Text>
                    {errors.method && <Text style={styles.errorText}>{errors.method}</Text>}
                    {WITHDRAWAL_METHODS.map((method) => (
                        <TouchableOpacity
                            key={method.id}
                            style={[
                                styles.methodCard,
                                selectedMethod === method.id && styles.methodCardActive,
                            ]}
                            onPress={() => setSelectedMethod(method.id)}
                        >
                            <View style={styles.methodLeft}>
                                <View style={styles.methodIcon}>
                                    <Ionicons name={method.icon} size={24} color={ACCENT} />
                                </View>
                                <View>
                                    <Text style={styles.methodName}>{method.name}</Text>
                                    <Text style={styles.methodMin}>Min: {method.minAmount} diamonds</Text>
                                </View>
                            </View>
                            {selectedMethod === method.id && (
                                <Ionicons name="checkmark-circle" size={24} color={ACCENT} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Payment Details */}
                {selectedMethod && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Payment Details</Text>
                        {renderMethodField()}
                    </View>
                )}

                {/* Important Notice */}
                <View style={styles.notice}>
                    <Ionicons name="information-circle" size={20} color={CYAN} />
                    <Text style={styles.noticeText}>
                        Withdrawals are processed within 3-5 business days. A processing fee may apply.
                    </Text>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, (!canWithdraw() || loading) && styles.submitBtnDisabled]}
                    onPress={handleWithdrawal}
                    disabled={!canWithdraw() || loading}
                >
                    {loading ? (
                        <ActivityIndicator color={TEXT} />
                    ) : (
                        <Text style={styles.submitBtnText}>Request Withdrawal</Text>
                    )}
                </TouchableOpacity>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: CARD,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: TEXT,
    },
    balanceCard: {
        margin: 20,
        padding: 25,
        borderRadius: 16,
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 14,
        color: '#FFF',
        opacity: 0.8,
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 5,
    },
    balanceUSD: {
        fontSize: 16,
        color: '#FFF',
        opacity: 0.9,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: TEXT,
        marginBottom: 15,
    },
    inputGroup: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        color: '#999',
        marginBottom: 8,
    },
    input: {
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: TEXT,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputError: {
        borderColor: ERROR,
    },
    errorText: {
        color: ERROR,
        fontSize: 12,
        marginTop: 5,
    },
    usdConversion: {
        fontSize: 14,
        color: CYAN,
        marginTop: 5,
    },
    quickAmounts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    quickAmountBtn: {
        backgroundColor: CARD,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        flex: 1,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    quickAmountText: {
        color: TEXT,
        fontWeight: '600',
    },
    quickAmountTextDisabled: {
        opacity: 0.3,
    },
    methodCard: {
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    methodCardActive: {
        borderColor: ACCENT,
    },
    methodLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    methodIcon: {
        width: 45,
        height: 45,
        borderRadius: 12,
        backgroundColor: ACCENT + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    methodName: {
        fontSize: 16,
        fontWeight: '600',
        color: TEXT,
        marginBottom: 3,
    },
    methodMin: {
        fontSize: 12,
        color: '#999',
    },
    notice: {
        flexDirection: 'row',
        backgroundColor: CARD,
        padding: 15,
        marginHorizontal: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    noticeText: {
        flex: 1,
        fontSize: 13,
        color: '#CCC',
        marginLeft: 10,
        lineHeight: 18,
    },
    submitBtn: {
        backgroundColor: ACCENT,
        marginHorizontal: 20,
        marginBottom: 30,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: TEXT,
    },
});
