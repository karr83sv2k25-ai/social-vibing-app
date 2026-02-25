// services/iapService.js - In-App Purchase Service
import {useEffect, useState} from 'react';
import {Platform, Alert} from 'react-native';
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  Purchase,
} from 'react-native-iap';
import {httpsCallable} from 'firebase/functions';
import {getAllProductIds, getProductById, isCoinProduct} from '../config/iapConfig';
import {functions} from '../firebaseConfig';

/**
 * IAP Service Hook
 * Manages in-app purchases for coins and diamonds
 */
export const useIAP = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [connected, setConnected] = useState(false);

  // Initialize IAP connection
  useEffect(() => {
    let purchaseUpdateSubscription;
    let purchaseErrorSubscription;

    const initIAP = async () => {
      try {
        // Connect to store
        await initConnection();
        console.log('IAP connected');
        setConnected(true);

        // Get product list from store
        const productIds = getAllProductIds();
        const availableProducts = await getProducts({skus: productIds});
        console.log('Products loaded:', availableProducts.length);
        setProducts(availableProducts);

        // Listen to purchase updates
        purchaseUpdateSubscription = purchaseUpdatedListener(
          async (purchase) => {
            console.log('Purchase update:', purchase);
            const receipt = purchase.transactionReceipt;

            if (receipt) {
              try {
                // Verify and credit purchase via Cloud Function
                await handlePurchaseVerification(purchase);

                // Finish the transaction
                await finishTransaction({purchase, isConsumable: true});
                console.log('Transaction finished');
              } catch (error) {
                console.error('Purchase verification failed:', error);
                Alert.alert(
                  'Purchase Error',
                  'We received your payment but couldn\'t credit your account. Please contact support.',
                );
              }
            }
          },
        );

        // Listen to purchase errors
        purchaseErrorSubscription = purchaseErrorListener((error) => {
          console.error('Purchase error:', error);
          setPurchasing(false);

          if (error.code !== 'E_USER_CANCELLED') {
            Alert.alert(
              'Purchase Failed',
              error.message || 'Something went wrong. Please try again.',
            );
          }
        });
      } catch (error) {
        console.error('IAP init error:', error);
        setConnected(false);
        Alert.alert(
          'Store Unavailable',
          'Unable to connect to the store. Please try again later.',
        );
      } finally {
        setLoading(false);
      }
    };

    initIAP();

    // Cleanup
    return () => {
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
      endConnection();
    };
  }, []);

  // Handle purchase verification and credit
  const handlePurchaseVerification = async (purchase) => {
    try {
      const creditCoinsAfterIAP = httpsCallable(functions, 'creditCoinsAfterIAP');

      const productInfo = getProductById(purchase.productId);
      if (!productInfo) {
        throw new Error('Product not found');
      }

      const totalAmount = productInfo.amount + (productInfo.bonus || 0);

      // Call Cloud Function to verify and credit
      const result = await creditCoinsAfterIAP({
        amount: totalAmount,
        purchaseToken: purchase.transactionReceipt,
        platform: Platform.OS,
        productId: purchase.productId,
      });

      if (result.data.success) {
        const currency = isCoinProduct(purchase.productId) ? 'coins' : 'diamonds';
        Alert.alert(
          'Purchase Complete! 🎉',
          `You received ${totalAmount} ${currency}!`,
          [{text: 'OK'}],
        );
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      throw error;
    }
  };

  // Make a purchase
  const purchaseProduct = async (productId) => {
    if (!connected) {
      Alert.alert('Store Unavailable', 'Please check your connection and try again.');
      return;
    }

    if (purchasing) {
      return; // Prevent double purchases
    }

    try {
      setPurchasing(true);

      // Request purchase from store
      await requestPurchase({sku: productId});

      // The purchase will be handled by purchaseUpdatedListener
    } catch (error) {
      console.error('Purchase request error:', error);
      setPurchasing(false);

      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert(
          'Purchase Failed',
          error.message || 'Unable to complete purchase. Please try again.',
        );
      }
    }
  };

  // Get product by ID from loaded products
  const getProduct = (productId) => {
    return products.find((p) => p.productId === productId);
  };

  return {
    products,
    loading,
    purchasing,
    connected,
    purchaseProduct,
    getProduct,
  };
};

/**
 * Standalone purchase function (for use outside of hooks)
 */
export const makePurchase = async (productId) => {
  try {
    await requestPurchase({sku: productId});
    return true;
  } catch (error) {
    console.error('Purchase error:', error);
    if (error.code !== 'E_USER_CANCELLED') {
      Alert.alert('Purchase Failed', 'Unable to complete purchase.');
    }
    return false;
  }
};

/**
 * Check if IAP is available on device
 */
export const isIAPAvailable = () => {
  // IAP is available on iOS and Android
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

/**
 * Restore purchases (iOS mainly)
 */
export const restorePurchases = async () => {
  try {
    // This would restore non-consumable/subscription purchases
    // For consumable items (coins/diamonds), we rely on server-side records
    Alert.alert(
      'Restore Purchases',
      'Purchase restoration is not needed for coins and diamonds. Your balance is synced with your account.',
    );
    return true;
  } catch (error) {
    console.error('Restore error:', error);
    Alert.alert('Restore Failed', 'Unable to restore purchases.');
    return false;
  }
};
