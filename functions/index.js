/**
 * Firebase Cloud Functions - Agora Token Generator
 *
 * Deploy this to Firebase Functions for serverless token generation
 */

const {setGlobalOptions} = require("firebase-functions");
const functions = require("firebase-functions");
const {RtcTokenBuilder, RtcRole} = require("agora-token");

const TOKEN_EXPIRATION_TIME = 86400; // 24 hours

setGlobalOptions({maxInstances: 10});

/**
 * Generate Agora RTC Token
 *
 * HTTP Trigger: POST request
 * URL: https://YOUR_PROJECT.cloudfunctions.net/generateAgoraToken
 *
 * Request Body:
 * {
 *   channelName: string,
 *   uid: number (optional),
 *   role: number (optional, 1=publisher, 2=subscriber)
 * }
 */
exports.generateAgoraToken = functions.https.onRequest((req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
    return;
  }

  try {
    const {channelName, uid = 0, role = 1} = req.body;

    // Validation
    if (!channelName) {
      res.status(400).json({
        success: false,
        error: "Channel name is required",
      });
      return;
    }

    // Get Agora config from Firebase environment
    const config = functions.config();
    const APP_ID = (config.agora && config.agora.app_id) ||
      "6158a2b02c6a422aa3646ee2c116efb8";
    const APP_CERTIFICATE = (config.agora && config.agora.app_certificate) ||
      "0c17c48fdac84e63a2e2416d010bc1ef";

    // Generate token
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + TOKEN_EXPIRATION_TIME;

    const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        role === 1 ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
        privilegeExpiredTs,
    );

    functions.logger.info("Token generated", {
      channelName,
      uid,
      expiresAt: privilegeExpiredTs,
    });

    res.json({
      success: true,
      token: token,
      appId: APP_ID,
      channelName: channelName,
      uid: uid,
      expiresAt: privilegeExpiredTs,
    });
  } catch (error) {
    functions.logger.error("Token generation failed", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate token",
      details: error.message,
    });
  }
});

/**
 * Renew Agora Token
 *
 * HTTP Trigger: POST request
 * URL: https://YOUR_PROJECT.cloudfunctions.net/renewAgoraToken
 */
exports.renewAgoraToken = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
    return;
  }

  try {
    const {channelName, uid = 0} = req.body;

    if (!channelName) {
      res.status(400).json({
        success: false,
        error: "Channel name is required",
      });
      return;
    }

    const config = functions.config();
    const APP_ID = (config.agora && config.agora.app_id) ||
      "6158a2b02c6a422aa3646ee2c116efb8";
    const APP_CERTIFICATE = (config.agora && config.agora.app_certificate) ||
      "0c17c48fdac84e63a2e2416d010bc1ef";

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + TOKEN_EXPIRATION_TIME;

    const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
    );

    functions.logger.info("Token renewed", {
      channelName,
      uid,
      expiresAt: privilegeExpiredTs,
    });

    res.json({
      success: true,
      token: token,
      expiresAt: privilegeExpiredTs,
    });
  } catch (error) {
    functions.logger.error("Token renewal failed", error);
    res.status(500).json({
      success: false,
      error: "Failed to renew token",
    });
  }
});
