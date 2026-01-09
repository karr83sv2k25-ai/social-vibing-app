// App Navigation Structure for Digital Marketplace

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Import screens
import MarketPlaceScreen from './marketplace';
import MarketplaceExploreScreen from './marketplaceexplore';
import CategoriesScreen from './screens/marketplace/CategoriesScreen';
import ProductDetailScreen from './screens/marketplace/ProductDetailScreen';
import CheckoutScreen from './screens/marketplace/CheckoutScreen';
import OrderSuccessScreen from './screens/marketplace/OrderSuccessScreen';
import MyOrdersScreen from './screens/marketplace/MyOrdersScreen';
import SellerDashboardScreen from './screens/marketplace/SellerDashboardScreen';
import ProductCreationWizardScreen from './screens/marketplace/ProductCreationWizardScreen';
import WalletScreen from './screens/marketplace/WalletScreen';
import WithdrawalScreen from './screens/marketplace/WithdrawalScreen';
import AILabScreen from './screens/marketplace/AILabScreen';
import FreelanceMarketplaceScreen from './screens/marketplace/FreelanceMarketplaceScreen';
import GigDetailScreen from './screens/marketplace/GigDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ===== MARKETPLACE TAB NAVIGATOR =====
function MarketplaceTabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#17171C',
                    borderTopColor: '#23232A',
                    height: 60,
                    paddingBottom: 8,
                },
                tabBarActiveTintColor: '#7C3AED',
                tabBarInactiveTintColor: '#9CA3AF',
            }}
        >
            <Tab.Screen
                name="MarketplaceHome"
                component={MarketPlaceScreen}
                options={{
                    tabBarLabel: 'Marketplace',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="storefront-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Categories"
                component={CategoriesScreen}
                options={{
                    tabBarLabel: 'Categories',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="grid-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="AILab"
                component={AILabScreen}
                options={{
                    tabBarLabel: 'AI Lab',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="robot-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Freelance"
                component={FreelanceMarketplaceScreen}
                options={{
                    tabBarLabel: 'Freelance',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="briefcase-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Wallet"
                component={WalletScreen}
                options={{
                    tabBarLabel: 'Wallet',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="wallet-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

// ===== MAIN MARKETPLACE STACK =====
export function MarketplaceStackNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#0B0B0E' },
            }}
        >
            {/* Main Tab Navigator */}
            <Stack.Screen name="MarketplaceTabs" component={MarketplaceTabNavigator} />

            {/* Product Flow */}
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
            <Stack.Screen name="MyOrders" component={MyOrdersScreen} />

            {/* Seller Flow */}
            <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
            <Stack.Screen
                name="ProductCreation"
                component={ProductCreationWizardScreen}
                options={{ presentation: 'modal' }}
            />

            {/* Wallet Flow */}
            <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />

            {/* Freelance Flow */}
            <Stack.Screen name="GigDetail" component={GigDetailScreen} />

            {/* Search/Explore */}
            <Stack.Screen name="MarketPlaceExplore" component={MarketplaceExploreScreen} />
        </Stack.Navigator>
    );
}

// ===== SCREEN NAVIGATION MAP =====
/*
Navigation Flow:

1. BUYER FLOW:
   MarketplaceHome → ProductDetail → Checkout → OrderSuccess
   Categories → ProductDetail → ...
   MarketplaceExplore → ProductDetail → ...
   
2. SELLER FLOW:
   SellerDashboard → ProductCreation (3 steps) → MarketplaceHome
   SellerDashboard → Edit Product → ...
   
3. WALLET FLOW:
   Wallet → Withdrawal
   Wallet → Transaction Details
   
4. FREELANCE FLOW:
   Freelance → GigDetail → Checkout → OrderSuccess
   
5. AI LAB FLOW:
   AILab → Generate Image → Save/Share

Navigation Methods:
- navigation.navigate('ProductDetail', { productId: 'prod_123' })
- navigation.navigate('Checkout', { productId: 'prod_123' })
- navigation.navigate('ProductCreation', { productType: 'chat_bubble' })
*/
