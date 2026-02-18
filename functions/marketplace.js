/**
 * Firebase Cloud Functions - Marketplace
 *
 * Secure server-side marketplace operations including:
 * - Product purchases with atomic transactions
 * - IAP (In-App Purchase) verification and coin crediting
 * - Active customization management (frames, bubbles)
 * - Library management
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {verifyReceipt} = require("./receiptVerification");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ==================== PRODUCT PURCHASE ====================

/**
 * Buy Product - Secure server-side purchase with atomic transaction
 *
 * @param {string} productId - The ID of the product to purchase
 * @returns {Object} Purchase result with success status, message,
 *
 * Security Features:
 * - Firestore transaction ensures atomicity
 * - Server-side balance validation
 * - Duplicate purchase prevention
 * - Automatic creator earnings distribution
 */
exports.buyProduct = functions.https.onCall(async (data, context) => {
  // 1. Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to make a purchase",
    );
  }

  const {productId} = data;
  const userId = context.auth.uid;

  if (!productId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Product ID is required",
    );
  }

  // 2. Execute Firestore transaction (atomic operation)
  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.doc(`users/${userId}`);
      const productRef = db.doc(`products/${productId}`);
      const libraryRef = db.doc(`libraries/${userId}`);

      // Get all documents
      const [userDoc, productDoc, libraryDoc] = await transaction.getAll(
          userRef,
          productRef,
          libraryRef,
      );

      // 3. Validation
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
            "not-found",
            "User profile not found",
        );
      }

      if (!productDoc.exists) {
        throw new functions.https.HttpsError(
            "not-found",
            "Product not found",
        );
      }

      const product = productDoc.data();
      const user = userDoc.data();

      // Check product status
      if (product.status !== "active") {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "This product is not available for purchase",
        );
      }

      // Check if already owned
      const ownedProducts = user.ownedProducts || [];
      if (ownedProducts.includes(productId)) {
        throw new functions.https.HttpsError(
            "already-exists",
            "You already own this product",
        );
      }

      // Check balance
      const currency = product.currency || "coins";
      const balance = currency === "coins" ?
        (user.coins || 0) :
        (user.diamonds || 0);

      if (balance < product.price) {
        const shortfall = product.price - balance;
        throw new functions.https.HttpsError(
            "failed-precondition",
            `Insufficient ${currency}. You need ${shortfall} more ${currency}.`,
        );
      }

      // 4. Execute purchase transaction
      const orderId = db.collection("orders").doc().id;
      const orderRef = db.doc(`orders/${orderId}`);
      const walletField = currency === "coins" ? "coins" : "diamonds";

      // Deduct currency and add to owned products
      const userUpdate = {
        [walletField]: admin.firestore.FieldValue.increment(-product.price),
        ownedProducts: admin.firestore.FieldValue.arrayUnion(productId),
      };
      transaction.update(userRef, userUpdate);

      // Add to library
      const typeToFieldMap = {
        comic: "comics",
        book: "books",
        art: "art",
        sticker_pack: "stickerPacks",
        profile_frame: "profileFrames",
        chat_bubble: "chatBubbles",
      };
      const fieldName = typeToFieldMap[product.type];

      if (!fieldName) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            `Unknown product type: ${product.type}`,
        );
      }

      if (libraryDoc.exists) {
        transaction.update(libraryRef, {
          [fieldName]: admin.firestore.FieldValue.arrayUnion(productId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const libraryData = {
          userId: userId,
          comics: [],
          books: [],
          art: [],
          stickerPacks: [],
          profileFrames: [],
          chatBubbles: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        libraryData[fieldName] = [productId];
        transaction.set(libraryRef, libraryData);
      }

      // Create order record
      const orderData = {
        orderId: orderId,
        userId: userId,
        productId: productId,
        productTitle: product.title,
        productType: product.type,
        price: product.price,
        currency: currency,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(orderRef, orderData);

      // Update product stats
      transaction.update(productRef, {
        "stats.purchaseCount": admin.firestore.FieldValue.increment(1),
      });

      // Credit creator (70% revenue share for non-official products)
      if (!product.isOfficial && product.creatorId && product.creatorId !== userId) {
        const creatorRef = db.doc(`users/${product.creatorId}`);
        const creatorEarnings = Math.floor(product.price * 0.7); // 70% to creator

        transaction.update(creatorRef, {
          earningsBalance: admin.firestore.FieldValue.increment(creatorEarnings),
          totalEarnings: admin.firestore.FieldValue.increment(creatorEarnings),
        });
      }

      const newBalance = balance - product.price;

      return {
        success: true,
        orderId: orderId,
        message: `Successfully purchased "${product.title}"!`,
        newBalance: newBalance,
        currency: currency,
      };
    });

    functions.logger.info("Product purchased successfully", {
      userId,
      productId,
      orderId: result.orderId,
    });

    return result;
  } catch (error) {
    functions.logger.error("Product purchase failed", {
      userId,
      productId,
      error: error.message,
    });
    throw error;
  }
});

// ==================== IAP VERIFICATION ====================

/**
 * Credit Coins After IAP - Verify in-app purchases and credit coins securely
 *
 * @param {number} amount - Amount of coins to credit
 * @param {string} purchaseToken - Purchase receipt/token from App Store/Play Store
 * @param {string} platform - 'ios' or 'android'
 * @param {string} productId - IAP product identifier
 * @returns {Object} Credit result with success status and amount
 *
 * Security Features:
 * - Prevents replay attacks (duplicate token usage)
 * - Server-side token validation
 * - Atomic transaction for coin crediting
 *
 * TODO: Add actual receipt verification with Google/Apple APIs in production
 */
exports.creditCoinsAfterIAP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in",
    );
  }

  const {amount, purchaseToken, platform, productId} = data;
  const userId = context.auth.uid;

  // Validation
  if (!purchaseToken || !amount || amount <= 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid purchase data",
    );
  }

  if (!["ios", "android"].includes(platform)) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Platform must be \"ios\" or \"android\"",
    );
  }

  try {
    // Check if token already used (prevent replay attacks)
    const txnRef = db.collection("iap_transactions");
    const existingQuery = await txnRef
        .where("purchaseToken", "==", purchaseToken)
        .limit(1)
        .get();

    if (!existingQuery.empty) {
      throw new functions.https.HttpsError(
          "already-exists",
          "This purchase has already been processed",
      );
    }

    // Verify receipt with App Store or Google Play
    functions.logger.info("Verifying receipt", {platform, productId});

    let verificationResult;
    try {
      verificationResult = await verifyReceipt({
        platform,
        purchaseToken,
        productId,
        packageName: data.packageName || "com.socialvibing.app",
      });

      if (!verificationResult.valid) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "Receipt verification failed",
        );
      }

      functions.logger.info("Receipt verified successfully", {
        productId: verificationResult.productId,
        platform,
      });
    } catch (error) {
      functions.logger.error("Receipt verification error", {
        error: error.message,
        platform,
        productId,
      });

      // In development, allow bypass for testing (remove in production)
      if (functions.config().app?.environment === "development") {
        functions.logger.warn("Bypassing verification in development mode");
      } else {
        throw error;
      }
    }

    // Determine currency type from product ID
    const currency = productId.includes("diamond") ? "diamonds" : "coins";

    // Credit currency in atomic transaction
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.doc(`users/${userId}`);
      const txnId = txnRef.doc().id;
      const txnDocRef = txnRef.doc(txnId);

      // Credit coins or diamonds using wallet structure
      const walletUpdate = {};
      walletUpdate[`wallet.${currency}`] = admin.firestore.FieldValue.increment(amount);
      transaction.update(userRef, walletUpdate);

      // Record transaction
      const txnData = {
        transactionId: txnId,
        userId: userId,
        amount: amount,
        currency: currency,
        purchaseToken: purchaseToken,
        platform: platform,
        productId: productId,
        verificationData: verificationResult ? {
          transactionId: verificationResult.transactionId || verificationResult.orderId,
          environment: verificationResult.environment,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        } : null,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(txnDocRef, txnData);

      return {success: true, amount: amount, currency: currency};
    });

    functions.logger.info("IAP credited successfully", {
      userId,
      amount,
      currency,
      platform,
      productId,
    });

    return result;
  } catch (error) {
    functions.logger.error("IAP credit failed", {
      userId,
      amount,
      error: error.message,
    });
    throw error;
  }
});

// ==================== CUSTOMIZATION MANAGEMENT ====================

/**
 * Set Active Customization - Apply purchased frames or chat bubbles
 *
 * @param {string} type - 'profileFrame' or 'chatBubble'
 * @param {string} productId - Product ID to activate (null to remove)
 * @returns {Object} Success status
 *
 * Security Features:
 * - Ownership verification
 * - Server-side validation
 */
exports.setActiveCustomization = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in",
    );
  }

  const {type, productId} = data;
  const userId = context.auth.uid;

  // Validate type
  if (!["profileFrame", "chatBubble"].includes(type)) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Type must be \"profileFrame\" or \"chatBubble\"",
    );
  }

  try {
    const userRef = db.doc(`users/${userId}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
          "not-found",
          "User not found",
      );
    }

    const userData = userDoc.data();

    // If setting a customization (not removing), verify ownership
    if (productId) {
      const ownedProducts = userData.ownedProducts || [];
      if (!ownedProducts.includes(productId)) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "You do not own this product",
        );
      }
    }

    // Set active customization
    const updateField = type === "profileFrame" ?
      "activeCustomizations.profileFrameId" :
      "activeCustomizations.chatBubbleThemeId";

    await userRef.update({
      [updateField]: productId || null, // null to remove customization
    });

    functions.logger.info("Active customization updated", {
      userId,
      type,
      productId,
    });

    return {
      success: true,
      type: type,
      productId: productId,
    };
  } catch (error) {
    functions.logger.error("Set customization failed", {
      userId,
      type,
      error: error.message,
    });
    throw error;
  }
});

// ==================== LIBRARY MANAGEMENT ====================

/**
 * Get User Library - Fetch all purchased products with metadata
 *
 * @returns {Object} Library data with product details
 *
 * Features:
 * - Fetches all owned products
 * - Includes full product metadata
 * - Organized by product type
 */
exports.getUserLibrary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in",
    );
  }

  const userId = context.auth.uid;

  try {
    const libraryRef = db.doc(`libraries/${userId}`);
    const libraryDoc = await libraryRef.get();

    if (!libraryDoc.exists) {
      return {
        library: {},
        products: [],
      };
    }

    const library = libraryDoc.data();

    // Fetch product details for each owned item
    const productPromises = [];
    const productTypes = [
      "comics",
      "books",
      "art",
      "stickerPacks",
      "profileFrames",
      "chatBubbles",
    ];

    for (const type of productTypes) {
      const productIds = library[type] || [];
      for (const productId of productIds) {
        productPromises.push(
            db.doc(`products/${productId}`).get(),
        );
      }
    }

    const productDocs = await Promise.all(productPromises);
    const products = productDocs
        .filter((doc) => doc.exists)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

    functions.logger.info("Library fetched", {
      userId,
      productCount: products.length,
    });

    return {
      library: library,
      products: products,
    };
  } catch (error) {
    functions.logger.error("Get library failed", {
      userId,
      error: error.message,
    });
    throw error;
  }
});

// ==================== ADMIN FUNCTIONS ====================

/**
 * Create Product - Admin/Creator function to add new marketplace products
 *
 * @param {Object} productData - Product information
 * @returns {Object} Created product with ID
 *
 * TODO: Add admin/creator role verification
 */
exports.createProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in",
    );
  }

  const userId = context.auth.uid;

  // TODO: Verify user is admin or approved creator
  // const userDoc = await db.doc(`users/${userId}`).get();
  // if (!userDoc.exists || !['admin', 'creator'].includes(userDoc.data().role)) {
  //   throw new functions.https.HttpsError(
  //     'permission-denied',
  //     'Only admins and creators can create products'
  //   );
  // }

  const productData = data;

  // Validate required fields
  const requiredFields = ["title", "description", "type", "price", "currency"];
  for (const field of requiredFields) {
    if (!productData[field]) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          `Missing required field: ${field}`,
      );
    }
  }

  try {
    const productRef = db.collection("products").doc();
    const product = {
      ...productData,
      productId: productRef.id,
      creatorId: userId,
      status: "active",
      stats: {
        purchaseCount: 0,
        viewCount: 0,
        rating: 0,
        reviewCount: 0,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await productRef.set(product);

    functions.logger.info("Product created", {
      productId: productRef.id,
      creatorId: userId,
    });

    return {
      success: true,
      productId: productRef.id,
      product: product,
    };
  } catch (error) {
    functions.logger.error("Create product failed", {
      userId,
      error: error.message,
    });
    throw error;
  }
});
