// functions/receiptVerification.js - Receipt Verification Service
const functions = require("firebase-functions");

/**
 * Verify iOS receipt with App Store Server API
 * @param {string} receiptData - Base64 encoded receipt
 * @param {boolean} isSandbox - Use sandbox environment
 * @return {Object} Verification result
 */
async function verifyIOSReceipt(receiptData, isSandbox = false) {
  const url = isSandbox ?
    "https://sandbox.itunes.apple.com/verifyReceipt" :
    "https://buy.itunes.apple.com/verifyReceipt";

  // Get shared secret from Firebase config
  const sharedSecret = functions.config().apple?.shared_secret;

  const requestBody = {
    "receipt-data": receiptData,
    "password": sharedSecret,
    "exclude-old-transactions": true,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    // Handle sandbox redirect (status 21007)
    if (result.status === 21007 && !isSandbox) {
      functions.logger.info(
          "Redirecting to sandbox for iOS receipt verification");
      return await verifyIOSReceipt(receiptData, true);
    }

    // Status codes:
    // 0: Valid receipt
    // 21000: App Store could not read receipt
    // 21002: Receipt data malformed
    // 21003: Receipt could not be authenticated
    // 21005: Receipt server unavailable
    // 21007: Sandbox receipt sent to production
    // 21008: Production receipt sent to sandbox

    if (result.status !== 0) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          `Receipt verification failed with status ${result.status}`,
      );
    }

    // Extract purchase data
    const receipt = result.receipt;
    const inAppPurchases =
      result["latest_receipt_info"] || receipt.in_app || [];

    if (inAppPurchases.length === 0) {
      throw new functions.https.HttpsError(
          "not-found",
          "No purchases found in receipt",
      );
    }

    // Get most recent purchase
    const latestPurchase =
      inAppPurchases[inAppPurchases.length - 1];

    return {
      valid: true,
      productId: latestPurchase.product_id,
      transactionId: latestPurchase.transaction_id,
      purchaseDate: latestPurchase.purchase_date_ms,
      quantity: parseInt(latestPurchase.quantity || "1"),
      environment: isSandbox ? "sandbox" : "production",
    };
  } catch (error) {
    functions.logger.error("iOS receipt verification error",
        {error: error.message});
    throw error;
  }
}

/**
 * Verify Android receipt with Google Play Developer API
 * @param {string} packageName - App package name
 * @param {string} productId - Product SKU
 * @param {string} purchaseToken - Purchase token
 * @return {Object} Verification result
 */
async function verifyAndroidReceipt(packageName, productId, purchaseToken) {
  try {
    // Note: This requires Google Cloud service account with
    // Play Developer API access
    // Setup instructions:
    // 1. Enable Google Play Developer API in Cloud Console
    // 2. Create/use service account with API access
    // 3. Grant service account access in Google Play Console

    const {google} = require("googleapis");
    const androidPublisher = google.androidpublisher("v3");

    // Get service account credentials from Firebase config or environment
    const serviceAccount =
      functions.config().google?.service_account ?
        JSON.parse(functions.config().google.service_account) :
        require("./service-account-key.json");

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes:
        ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const authClient = await auth.getClient();

    // Verify the purchase
    const response = await androidPublisher.purchases.products.get({
      auth: authClient,
      packageName: packageName,
      productId: productId,
      token: purchaseToken,
    });

    const purchase = response.data;

    // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
    // consumptionState: 0 = not consumed, 1 = consumed
    if (purchase.purchaseState !== 0) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          "Purchase is not in a valid state",
      );
    }

    return {
      valid: true,
      productId: productId,
      orderId: purchase.orderId,
      purchaseTime: purchase.purchaseTimeMillis,
      purchaseState: purchase.purchaseState,
      consumptionState: purchase.consumptionState,
      acknowledged: purchase.acknowledgementState === 1,
    };
  } catch (error) {
    functions.logger.error("Android receipt verification error", {
      error: error.message,
      productId,
    });

    // Handle specific error cases
    if (error.code === 401) {
      throw new functions.https.HttpsError(
          "permission-denied",
          "Service account not authorized",
      );
    }

    throw new functions.https.HttpsError(
        "internal",
        "Receipt verification failed: " + error.message,
    );
  }
}

/**
 * Acknowledge Android purchase (required as of
 * Google Play Billing 3.0)
 * @param {string} packageName - App package name
 * @param {string} productId - Product SKU
 * @param {string} purchaseToken - Purchase token
 */
async function acknowledgeAndroidPurchase(
    packageName, productId, purchaseToken) {
  try {
    const {google} = require("googleapis");
    const androidPublisher = google.androidpublisher("v3");

    const serviceAccount = functions.config().google?.service_account ?
      JSON.parse(functions.config().google.service_account) :
      require("./service-account-key.json");

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const authClient = await auth.getClient();

    await androidPublisher.purchases.products.acknowledge({
      auth: authClient,
      packageName: packageName,
      productId: productId,
      token: purchaseToken,
    });

    functions.logger.info("Android purchase acknowledged", {productId});
  } catch (error) {
    functions.logger.error("Android acknowledgment error", {
      error: error.message,
      productId,
    });
    // Don't throw - acknowledgment failure shouldn't block the purchase
  }
}

/**
 * Main receipt verification function
 * @param {Object} data - Purchase data
 * @return {Object} Verification result
 */
async function verifyReceipt(data) {
  const {platform, purchaseToken, productId, packageName} = data;

  if (platform === "ios") {
    return await verifyIOSReceipt(purchaseToken);
  } else if (platform === "android") {
    const result = await verifyAndroidReceipt(
        packageName || "com.socialvibing.app",
        productId,
        purchaseToken,
    );

    // Acknowledge the purchase if not already acknowledged
    if (!result.acknowledged) {
      await acknowledgeAndroidPurchase(
          packageName || "com.socialvibing.app",
          productId,
          purchaseToken,
      );
    }

    return result;
  } else {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid platform specified",
    );
  }
}

module.exports = {
  verifyReceipt,
  verifyIOSReceipt,
  verifyAndroidReceipt,
  acknowledgeAndroidPurchase,
};
