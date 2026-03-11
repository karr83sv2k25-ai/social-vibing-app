/**
 * Report Service - Handles all user/content reporting functionality
 * This service manages reports that admins can review and take action on
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// ==================== REPORT TYPES ====================
export const REPORT_TYPES = {
  USER: 'user',
  POST: 'post',
  COMMENT: 'comment',
  MESSAGE: 'message',
  COMMUNITY: 'community',
  PRODUCT: 'product',
  STORY: 'story',
};

// ==================== REPORT REASONS ====================
export const REPORT_REASONS = {
  // User-related reasons
  HARASSMENT: {
    id: 'harassment',
    label: 'Harassment or Bullying',
    description: 'Threatening, intimidating, or bullying behavior',
    category: 'behavior',
  },
  SPAM: {
    id: 'spam',
    label: 'Spam',
    description: 'Repetitive or irrelevant messages/content',
    category: 'content',
  },
  INAPPROPRIATE_CONTENT: {
    id: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Sexually explicit, violent, or disturbing content',
    category: 'content',
  },
  HATE_SPEECH: {
    id: 'hate_speech',
    label: 'Hate Speech',
    description: 'Content that promotes hatred against groups',
    category: 'behavior',
  },
  IMPERSONATION: {
    id: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else',
    category: 'identity',
  },
  SCAM: {
    id: 'scam',
    label: 'Scam or Fraud',
    description: 'Attempting to deceive or steal from users',
    category: 'security',
  },
  UNDERAGE: {
    id: 'underage',
    label: 'Underage User',
    description: 'User appears to be under the minimum age',
    category: 'safety',
  },
  FAKE_PROFILE: {
    id: 'fake_profile',
    label: 'Fake Profile',
    description: 'Profile with false or misleading information',
    category: 'identity',
  },
  VIOLENCE: {
    id: 'violence',
    label: 'Violence or Threats',
    description: 'Threats of violence or harmful behavior',
    category: 'safety',
  },
  SELF_HARM: {
    id: 'self_harm',
    label: 'Self-Harm or Suicide',
    description: 'Content promoting self-harm or suicide',
    category: 'safety',
  },
  COPYRIGHT: {
    id: 'copyright',
    label: 'Copyright Violation',
    description: 'Unauthorized use of copyrighted material',
    category: 'legal',
  },
  OTHER: {
    id: 'other',
    label: 'Other',
    description: 'Other violation not listed above',
    category: 'other',
  },
};

// ==================== REPORT STATUS ====================
export const REPORT_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  ACTION_TAKEN: 'action_taken',
};

// ==================== ADMIN ACTION TYPES ====================
export const ADMIN_ACTIONS = {
  WARNING: 'warning',
  CONTENT_REMOVED: 'content_removed',
  TEMPORARY_BAN: 'temporary_ban',
  PERMANENT_BAN: 'permanent_ban',
  ACCOUNT_SUSPENDED: 'account_suspended',
  NO_VIOLATION: 'no_violation',
  DISMISSED: 'dismissed',
};

// ==================== SUBMIT REPORT ====================
/**
 * Submit a new report against a user or content
 * @param {Object} reportData - Report details
 * @returns {Promise<{success: boolean, reportId?: string, error?: string}>}
 */
export const submitReport = async ({
  reporterId,
  reporterUsername,
  reportedId,
  reportedUsername,
  reportType = REPORT_TYPES.USER,
  reason,
  description,
  evidence = [],
  contentId = null,
  contentType = null,
  contentPreview = null,
  communityId = null,
  parentId = null,
}) => {
  try {
    // Validation
    if (!reporterId || !reportedId) {
      return { success: false, error: 'Reporter and reported user IDs are required' };
    }

    // Prevent self-reporting
    if (reporterId === reportedId) {
      return { success: false, error: 'You cannot report yourself' };
    }

    if (!reason) {
      return { success: false, error: 'Report reason is required' };
    }

    // Validate report type
    if (!Object.values(REPORT_TYPES).includes(reportType)) {
      return { success: false, error: 'Invalid report type' };
    }

    // Sanitize description input
    const sanitizedDescription = (description || '').trim().substring(0, 500);

    // Validate evidence array
    if (evidence && !Array.isArray(evidence)) {
      return { success: false, error: 'Evidence must be an array' };
    }

    // Validate reason object/string
    const reasonId = reason.id || reason;
    const validReasonIds = Object.values(REPORT_REASONS).map(r => r.id);
    if (!validReasonIds.includes(reasonId)) {
      return { success: false, error: 'Invalid report reason' };
    }

    // Check if user has already reported this same content/user recently (within 24 hours)
    // Note: Firestore requires composite indexes for complex queries
    // We'll do a simpler query and filter in code to avoid index requirements
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      const recentReportsQuery = query(
        collection(db, 'reports'),
        where('reporterId', '==', reporterId),
        where('reportedId', '==', reportedId),
        where('reportType', '==', reportType),
        orderBy('createdAt', 'desc'),
        limit(10) // Get last 10 reports to check
      );

      const recentReports = await getDocs(recentReportsQuery);
      
      // Check for duplicate reports
      for (const doc of recentReports.docs) {
        const report = doc.data();
        const reportTime = report.createdAt?.toDate();
        
        // Check if same content was reported within 24 hours
        if (reportTime && reportTime > oneDayAgo) {
          // For content reports, check if same content
          if (contentId && report.contentId === contentId) {
            return { 
              success: false, 
              error: 'You have already reported this content recently. Please wait 24 hours before reporting again.' 
            };
          }
          
          // For user reports without specific content, check recent report
          if (!contentId && !report.contentId) {
            return { 
              success: false, 
              error: 'You have already reported this user recently. Please wait 24 hours before reporting again.' 
            };
          }
        }
      }
    } catch (queryError) {
      console.warn('⚠️ Could not check for duplicate reports:', queryError.message);
      // Continue with submission if duplicate check fails
    }

    // Rate limiting: Check total reports submitted in last hour
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentUserReportsQuery = query(
        collection(db, 'reports'),
        where('reporterId', '==', reporterId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const recentUserReports = await getDocs(recentUserReportsQuery);
      let reportsInLastHour = 0;
      
      recentUserReports.forEach(doc => {
        const reportTime = doc.data().createdAt?.toDate();
        if (reportTime && reportTime > oneHourAgo) {
          reportsInLastHour++;
        }
      });
      
      // Limit to 10 reports per hour to prevent spam
      if (reportsInLastHour >= 10) {
        return {
          success: false,
          error: 'You have submitted too many reports recently. Please try again later.'
        };
      }
    } catch (rateLimitError) {
      console.warn('⚠️ Could not check rate limit:', rateLimitError.message);
      // Continue with submission if rate limit check fails
    }

    // Generate report ID
    const reportRef = doc(collection(db, 'reports'));
    const reportId = reportRef.id;

    // Get the reason object properly
    const reasonObj = typeof reason === 'string' 
      ? Object.values(REPORT_REASONS).find(r => r.id === reason) || REPORT_REASONS.OTHER
      : reason;

    // Prepare report document with sanitized and validated data
    const reportDoc = {
      id: reportId,
      reporterId: String(reporterId),
      reporterUsername: String(reporterUsername || 'Unknown User').substring(0, 100),
      reportedId: String(reportedId),
      reportedUsername: String(reportedUsername || 'Unknown User').substring(0, 100),
      reportType,
      reason: reasonObj.id,
      reasonLabel: reasonObj.label,
      reasonCategory: reasonObj.category || 'other',
      description: sanitizedDescription,
      evidence: Array.isArray(evidence) ? evidence.slice(0, 10) : [], // Limit to 10 evidence items
      contentId: contentId || null,
      contentType: contentType || null,
      contentPreview: contentPreview ? String(contentPreview).substring(0, 500) : null,
      communityId: communityId || null,
      parentId: parentId || null,
      status: REPORT_STATUS.PENDING,
      priority: calculatePriority(reasonObj),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedBy: null,
      reviewedAt: null,
      actionTaken: null,
      actionDetails: null,
      adminNotes: null,
      isResolved: false,
    };

    // Save report
    await setDoc(reportRef, reportDoc);

    // Update reported user's report count for tracking (don't fail if this fails)
    try {
      await updateReportedUserStats(reportedId);
    } catch (statsError) {
      console.warn('⚠️ Could not update user stats:', statsError.message);
      // Don't fail the entire report submission
    }

    console.log('✅ Report submitted successfully:', reportId);
    return { success: true, reportId };
  } catch (error) {
    console.error('❌ Error submitting report:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit report. Please try again.';
    
    if (error.code === 'permission-denied') {
      errorMessage = 'You do not have permission to submit reports. Please ensure you are logged in.';
    } else if (error.code === 'unavailable') {
      errorMessage = 'Service temporarily unavailable. Please check your internet connection and try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

// ==================== CALCULATE PRIORITY ====================
/**
 * Calculate report priority based on reason
 */
const calculatePriority = (reason) => {
  const highPriority = ['violence', 'self_harm', 'underage', 'scam'];
  const mediumPriority = ['harassment', 'hate_speech', 'impersonation', 'inappropriate_content', 'copyright'];
  
  const reasonId = reason.id || reason;
  
  if (highPriority.includes(reasonId)) return 'high';
  if (mediumPriority.includes(reasonId)) return 'medium';
  return 'low';
};

// ==================== UPDATE REPORTED USER STATS ====================
/**
 * Update the reported user's statistics
 */
const updateReportedUserStats = async (userId) => {
  try {
    if (!userId) {
      console.warn('⚠️ Cannot update stats: userId is missing');
      return;
    }
    
    const userRef = doc(db, 'users', userId);
    
    // Check if user document exists before updating
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      console.warn('⚠️ User document does not exist:', userId);
      return;
    }
    
    await updateDoc(userRef, {
      reportsReceived: increment(1),
      lastReportedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('❌ Error updating reported user stats:', error);
    // Don't fail the report if this fails - just log the error
    throw error; // Re-throw to be caught by caller
  }
};

// ==================== GET USER REPORTS (FOR ADMIN) ====================
/**
 * Get all reports for admin review
 * @param {Object} options - Query options
 * @returns {Promise<{success: boolean, reports?: Array, error?: string}>}
 */
export const getReportsForAdmin = async ({
  status = null,
  reportType = null,
  priority = null,
  limitCount = 50,
  startAfter = null,
} = {}) => {
  try {
    let reportQuery = collection(db, 'reports');
    const constraints = [orderBy('createdAt', 'desc')];

    if (status) {
      constraints.unshift(where('status', '==', status));
    }

    if (reportType) {
      constraints.unshift(where('reportType', '==', reportType));
    }

    if (priority) {
      constraints.unshift(where('priority', '==', priority));
    }

    constraints.push(limit(limitCount));

    const q = query(reportQuery, ...constraints);
    const snapshot = await getDocs(q);

    const reports = [];
    snapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        reviewedAt: doc.data().reviewedAt?.toDate(),
      });
    });

    return { success: true, reports };
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET PENDING REPORTS COUNT ====================
/**
 * Get count of pending reports for admin dashboard
 */
export const getPendingReportsCount = async () => {
  try {
    const q = query(
      collection(db, 'reports'),
      where('status', '==', REPORT_STATUS.PENDING)
    );
    const snapshot = await getDocs(q);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('❌ Error getting pending reports count:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// ==================== GET SINGLE REPORT ====================
/**
 * Get a single report by ID
 */
export const getReportById = async (reportId) => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportDoc = await getDoc(reportRef);

    if (!reportDoc.exists()) {
      return { success: false, error: 'Report not found' };
    }

    return {
      success: true,
      report: {
        id: reportDoc.id,
        ...reportDoc.data(),
        createdAt: reportDoc.data().createdAt?.toDate(),
        updatedAt: reportDoc.data().updatedAt?.toDate(),
      },
    };
  } catch (error) {
    console.error('❌ Error fetching report:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE REPORT STATUS (ADMIN) ====================
/**
 * Update report status and add admin notes
 * @param {string} reportId - Report ID
 * @param {Object} updateData - Update data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateReportStatus = async (reportId, {
  status,
  adminId,
  adminNotes = null,
  actionTaken = null,
}) => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    
    const updateData = {
      status,
      updatedAt: serverTimestamp(),
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (actionTaken) {
      updateData.actionTaken = actionTaken;
    }

    if (status === REPORT_STATUS.RESOLVED || status === REPORT_STATUS.ACTION_TAKEN || status === REPORT_STATUS.DISMISSED) {
      updateData.isResolved = true;
    }

    await updateDoc(reportRef, updateData);

    console.log('✅ Report status updated:', reportId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating report status:', error);
    return { success: false, error: error.message };
  }
};

// ==================== TAKE ACTION ON REPORT (ADMIN) ====================
/**
 * Take action on a report - ban, warn, etc.
 */
export const takeActionOnReport = async (reportId, {
  adminId,
  action,
  actionDetails = {},
  notifyUser = true,
}) => {
  try {
    // Input validation
    if (!reportId || typeof reportId !== 'string') {
      return { success: false, error: 'Invalid report ID' };
    }
    
    if (!adminId || typeof adminId !== 'string') {
      return { success: false, error: 'Invalid admin ID' };
    }
    
    if (!action || !Object.values(ADMIN_ACTIONS).includes(action)) {
      return { success: false, error: 'Invalid action type' };
    }
    
    const batch = writeBatch(db);
    
    // Get report details
    const reportRef = doc(db, 'reports', reportId);
    const reportDoc = await getDoc(reportRef);
    
    if (!reportDoc.exists()) {
      return { success: false, error: 'Report not found' };
    }

    const report = reportDoc.data();
    const reportedUserId = report.reportedId;
    const userRef = doc(db, 'users', reportedUserId);

    // Update report
    batch.update(reportRef, {
      status: REPORT_STATUS.ACTION_TAKEN,
      actionTaken: action,
      actionDetails,
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isResolved: true,
    });

    // Take action on user based on action type
    switch (action) {
      case ADMIN_ACTIONS.WARNING:
        batch.update(userRef, {
          warningsCount: increment(1),
          lastWarning: actionDetails.message || 'Community guidelines violation',
          warnedAt: serverTimestamp(),
          warnedBy: adminId,
        });
        break;

      case ADMIN_ACTIONS.TEMPORARY_BAN:
        const banDuration = parseInt(actionDetails.duration) || 7; // Days
        
        // Validate ban duration (1-365 days)
        if (banDuration < 1 || banDuration > 365) {
          return { success: false, error: 'Ban duration must be between 1 and 365 days' };
        }
        
        const banExpiresAt = new Date();
        banExpiresAt.setDate(banExpiresAt.getDate() + banDuration);
        
        batch.update(userRef, {
          isBanned: true,
          banType: 'temporary',
          banReason: actionDetails.reason || 'Violation of community guidelines',
          bannedAt: serverTimestamp(),
          bannedBy: adminId,
          banExpiresAt: banExpiresAt,
        });
        break;

      case ADMIN_ACTIONS.PERMANENT_BAN:
        batch.update(userRef, {
          isBanned: true,
          banType: 'permanent',
          banReason: actionDetails.reason || 'Severe violation of community guidelines',
          bannedAt: serverTimestamp(),
          bannedBy: adminId,
          banExpiresAt: null,
        });
        break;

      case ADMIN_ACTIONS.ACCOUNT_SUSPENDED:
        batch.update(userRef, {
          isSuspended: true,
          suspendedReason: actionDetails.reason || 'Account under review',
          suspendedAt: serverTimestamp(),
          suspendedBy: adminId,
        });
        break;

      case ADMIN_ACTIONS.CONTENT_REMOVED:
        // Handle content removal if contentId exists
        if (report.contentId && report.contentType) {
          await removeReportedContent(report.contentId, report.contentType, adminId);
        }
        break;

      case ADMIN_ACTIONS.NO_VIOLATION:
      case ADMIN_ACTIONS.DISMISSED:
        // No action on user, just mark report as resolved
        break;
    }

    // Create admin action log
    const actionLogRef = doc(collection(db, 'admin_actions'));
    batch.set(actionLogRef, {
      id: actionLogRef.id,
      adminId,
      reportId,
      targetUserId: reportedUserId,
      action,
      actionDetails,
      createdAt: serverTimestamp(),
    });

    // Send notification to reported user if needed
    if (notifyUser && action !== ADMIN_ACTIONS.NO_VIOLATION && action !== ADMIN_ACTIONS.DISMISSED) {
      const notificationRef = doc(collection(db, 'users', reportedUserId, 'notifications'));
      batch.set(notificationRef, {
        id: notificationRef.id,
        type: 'moderation_action',
        title: 'Account Action Taken',
        message: getActionNotificationMessage(action, actionDetails),
        createdAt: serverTimestamp(),
        read: false,
      });
    }

    await batch.commit();

    console.log('✅ Action taken on report:', reportId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error taking action on report:', error);
    return { success: false, error: error.message };
  }
};

// ==================== REMOVE REPORTED CONTENT ====================
/**
 * Remove content that was reported
 */
const removeReportedContent = async (contentId, contentType, adminId) => {
  try {
    let contentRef;
    
    switch (contentType) {
      case 'post':
        contentRef = doc(db, 'posts', contentId);
        break;
      case 'comment':
        contentRef = doc(db, 'comments', contentId);
        break;
      case 'story':
        contentRef = doc(db, 'stories', contentId);
        break;
      default:
        console.log('Unknown content type:', contentType);
        return;
    }

    await updateDoc(contentRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: adminId,
      deletionReason: 'Violated community guidelines',
    });
  } catch (error) {
    console.error('Error removing content:', error);
  }
};

// ==================== GET ACTION NOTIFICATION MESSAGE ====================
/**
 * Get notification message for user based on action
 */
const getActionNotificationMessage = (action, details) => {
  switch (action) {
    case ADMIN_ACTIONS.WARNING:
      return `Your account has received a warning: ${details.message || 'Please follow community guidelines'}`;
    case ADMIN_ACTIONS.TEMPORARY_BAN:
      return `Your account has been temporarily suspended for ${details.duration || 7} days. Reason: ${details.reason || 'Violation of guidelines'}`;
    case ADMIN_ACTIONS.PERMANENT_BAN:
      return `Your account has been permanently banned. Reason: ${details.reason || 'Severe violation of guidelines'}`;
    case ADMIN_ACTIONS.ACCOUNT_SUSPENDED:
      return `Your account has been suspended pending review. Reason: ${details.reason || 'Account under review'}`;
    case ADMIN_ACTIONS.CONTENT_REMOVED:
      return 'Your content has been removed for violating community guidelines.';
    default:
      return 'An action has been taken on your account. Please contact support for details.';
  }
};

// ==================== GET USER'S REPORT HISTORY ====================
/**
 * Get reports submitted by a user
 */
export const getUserReportHistory = async (userId, limitCount = 20) => {
  try {
    const q = query(
      collection(db, 'reports'),
      where('reporterId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const reports = [];
    
    snapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      });
    });

    return { success: true, reports };
  } catch (error) {
    console.error('❌ Error fetching user report history:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET REPORTS AGAINST USER ====================
/**
 * Get all reports against a specific user (for admin review)
 */
export const getReportsAgainstUser = async (userId, limitCount = 50) => {
  try {
    const q = query(
      collection(db, 'reports'),
      where('reportedId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const reports = [];
    
    snapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      });
    });

    return { success: true, reports };
  } catch (error) {
    console.error('❌ Error fetching reports against user:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET REPORT STATISTICS (ADMIN DASHBOARD) ====================
/**
 * Get report statistics for admin dashboard
 */
export const getReportStatistics = async () => {
  try {
    const allReportsSnapshot = await getDocs(collection(db, 'reports'));
    
    let stats = {
      total: 0,
      pending: 0,
      underReview: 0,
      resolved: 0,
      dismissed: 0,
      actionTaken: 0,
      byPriority: { high: 0, medium: 0, low: 0 },
      byType: {},
      byReason: {},
    };

    allReportsSnapshot.forEach((doc) => {
      const report = doc.data();
      stats.total++;
      
      // Status counts
      switch (report.status) {
        case REPORT_STATUS.PENDING: stats.pending++; break;
        case REPORT_STATUS.UNDER_REVIEW: stats.underReview++; break;
        case REPORT_STATUS.RESOLVED: stats.resolved++; break;
        case REPORT_STATUS.DISMISSED: stats.dismissed++; break;
        case REPORT_STATUS.ACTION_TAKEN: stats.actionTaken++; break;
      }

      // Priority counts
      if (report.priority) {
        stats.byPriority[report.priority]++;
      }

      // Type counts
      if (report.reportType) {
        stats.byType[report.reportType] = (stats.byType[report.reportType] || 0) + 1;
      }

      // Reason counts
      if (report.reason) {
        stats.byReason[report.reason] = (stats.byReason[report.reason] || 0) + 1;
      }
    });

    return { success: true, stats };
  } catch (error) {
    console.error('❌ Error fetching report statistics:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET REPORTS FOR COMMUNITY (COMMUNITY STAFF) ====================
/**
 * Get reports that are scoped to a specific community.
 * Community leaders/owners can use this to review reports inside their community.
 * @param {string} communityId - Community ID
 * @param {Object} options - Query options
 */
export const getReportsForCommunity = async (communityId, {
  status = null,
  limitCount = 50,
} = {}) => {
  try {
    if (!communityId) {
      return { success: false, error: 'Community ID is required' };
    }

    const constraints = [
      where('communityId', '==', communityId),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    ];

    if (status) {
      constraints.unshift(where('status', '==', status));
    }

    const q = query(collection(db, 'reports'), ...constraints);
    const snapshot = await getDocs(q);

    const reports = [];
    snapshot.forEach((d) => {
      reports.push({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
        reviewedAt: d.data().reviewedAt?.toDate(),
      });
    });

    return { success: true, reports };
  } catch (error) {
    console.error('❌ Error fetching community reports:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET COMMUNITY PENDING REPORTS COUNT ====================
/**
 * Get count of pending reports for a specific community (for community staff).
 */
export const getCommunityPendingReportsCount = async (communityId) => {
  try {
    if (!communityId) return { success: false, count: 0 };
    const q = query(
      collection(db, 'reports'),
      where('communityId', '==', communityId),
      where('status', '==', REPORT_STATUS.PENDING)
    );
    const snapshot = await getDocs(q);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('❌ Error getting community pending reports count:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// ==================== COMMUNITY STAFF REPORT ACTION ====================
/**
 * Community staff (leader/owner) can dismiss or mark a community-scoped report as reviewed.
 * They CANNOT take platform-level actions (ban, warn globally) — only admins can.
 * Available actions for community staff: 'dismissed', 'content_removed' (post hidden), 'reviewed'
 *
 * @param {string} reportId - Report ID
 * @param {string} staffId - Community staff user ID
 * @param {string} action - 'dismissed' | 'content_removed' | 'reviewed'
 * @param {string} notes - Optional notes
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const takeCommunityStaffAction = async (reportId, staffId, action, notes = '') => {
  try {
    if (!reportId || !staffId || !action) {
      return { success: false, error: 'reportId, staffId and action are all required' };
    }

    const allowedActions = ['dismissed', 'content_removed', 'reviewed'];
    if (!allowedActions.includes(action)) {
      return { success: false, error: `Invalid action. Allowed: ${allowedActions.join(', ')}` };
    }

    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) {
      return { success: false, error: 'Report not found' };
    }

    const newStatus = action === 'dismissed'
      ? REPORT_STATUS.DISMISSED
      : action === 'content_removed'
        ? REPORT_STATUS.ACTION_TAKEN
        : REPORT_STATUS.UNDER_REVIEW;

    await updateDoc(reportRef, {
      status: newStatus,
      actionTaken: action,
      communityReviewedBy: staffId,
      communityReviewedAt: serverTimestamp(),
      adminNotes: notes || null,
      isResolved: action !== 'reviewed',
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error taking community staff action:', error);
    return { success: false, error: error.message };
  }
};

export default {
  REPORT_TYPES,
  REPORT_REASONS,
  REPORT_STATUS,
  ADMIN_ACTIONS,
  submitReport,
  getReportsForAdmin,
  getPendingReportsCount,
  getReportById,
  updateReportStatus,
  takeActionOnReport,
  getUserReportHistory,
  getReportsAgainstUser,
  getReportStatistics,
  getReportsForCommunity,
  getCommunityPendingReportsCount,
  takeCommunityStaffAction,
};
