# User Reporting System - Admin Implementation Guide

## Overview

This document provides complete instructions for implementing the user reporting system in the Admin App. The main Social Vibing app now has full reporting functionality that stores reports in Firestore, which can be reviewed and actioned through the Admin App.

---

## 📍 Where Users Can Report

Users can submit reports from multiple locations in the app:

| Location | Report Type | How to Access |
|----------|-------------|---------------|
| **Chat Actions Screen** | User | Tap user's profile in chat → "Report User" button in Danger Zone |
| **User Profile** | User | Visit other user's profile → Tap ⋮ menu → "Report User" |
| **Home Feed Posts** | Post | Tap ⋯ (ellipsis) on any post → "Report Post" |
| **Comments** | Comment | Tap 🚩 flag icon on any comment |
| **Community Detail** | Community | Tap ⋯ menu in community header → "Report Community" |
| **Group Members List** | User | In group member list → Tap 🚩 flag icon next to member |

---

## 🏗️ Architecture

### Data Flow
```
User Reports → Firestore (reports collection) → Admin App → Actions (ban/warn/dismiss)
```

### Collections Used
- `reports` - All user reports
- `admin_actions` - Log of all admin actions taken
- `users` - User accounts (for bans, warnings, etc.)

---

## 📊 Firestore Schema

### Reports Collection (`/reports/{reportId}`)

```javascript
{
  id: string,                    // Auto-generated report ID
  reporterId: string,            // UID of user who submitted report
  reporterUsername: string,      // Username of reporter
  reportedId: string,            // UID of reported user
  reportedUsername: string,      // Username of reported user
  reportType: string,            // 'user' | 'post' | 'comment' | 'message' | 'community' | 'product' | 'story'
  reason: string,                // Reason ID (e.g., 'harassment', 'spam')
  reasonLabel: string,           // Human-readable reason (e.g., 'Harassment or Bullying')
  reasonCategory: string,        // Category: 'behavior' | 'content' | 'identity' | 'security' | 'safety' | 'legal' | 'other'
  description: string,           // Additional details from reporter
  evidence: array,               // Optional array of evidence URLs
  contentId: string | null,      // ID of reported content (if applicable)
  contentType: string | null,    // Type of content: 'post' | 'comment' | 'message' | 'story'
  contentPreview: string | null, // Preview of reported content
  status: string,                // 'pending' | 'under_review' | 'resolved' | 'dismissed' | 'action_taken'
  priority: string,              // 'high' | 'medium' | 'low'
  createdAt: timestamp,          // When report was submitted
  updatedAt: timestamp,          // Last update time
  reviewedBy: string | null,     // Admin UID who reviewed
  reviewedAt: timestamp | null,  // When reviewed
  actionTaken: string | null,    // Action taken (see ADMIN_ACTIONS below)
  actionDetails: object | null,  // Details of action (reason, duration, etc.)
  adminNotes: string | null,     // Internal admin notes
  isResolved: boolean,           // Whether report is resolved
}
```

### Admin Actions Log (`/admin_actions/{actionId}`)

```javascript
{
  id: string,                    // Auto-generated action ID
  adminId: string,               // UID of admin who took action
  reportId: string,              // Related report ID
  targetUserId: string,          // User who received action
  action: string,                // Action type (see ADMIN_ACTIONS)
  actionDetails: object,         // Details of action
  createdAt: timestamp,          // When action was taken
}
```

---

## 🎯 Report Status Types

| Status | Description |
|--------|-------------|
| `pending` | New report, awaiting review |
| `under_review` | Admin is currently reviewing |
| `resolved` | Report reviewed and resolved |
| `dismissed` | Report dismissed (no violation) |
| `action_taken` | Action taken against reported user |

---

## ⚠️ Report Reasons

### Safety (High Priority)
| ID | Label | Description |
|----|-------|-------------|
| `violence` | Violence or Threats | Threats of violence or harmful behavior |
| `self_harm` | Self-Harm or Suicide | Content promoting self-harm or suicide |
| `underage` | Underage User | User appears to be under minimum age |

### Behavior (Medium Priority)
| ID | Label | Description |
|----|-------|-------------|
| `harassment` | Harassment or Bullying | Threatening or intimidating behavior |
| `hate_speech` | Hate Speech | Content promoting hatred against groups |

### Content (Low-Medium Priority)
| ID | Label | Description |
|----|-------|-------------|
| `inappropriate_content` | Inappropriate Content | Sexually explicit, violent content |
| `spam` | Spam | Repetitive or irrelevant content |

### Identity
| ID | Label | Description |
|----|-------|-------------|
| `impersonation` | Impersonation | Pretending to be someone else |
| `fake_profile` | Fake Profile | False or misleading profile info |

### Security
| ID | Label | Description |
|----|-------|-------------|
| `scam` | Scam or Fraud | Attempting to deceive or steal |

### Legal
| ID | Label | Description |
|----|-------|-------------|
| `copyright` | Copyright Violation | Unauthorized use of copyrighted material |

### Other
| ID | Label | Description |
|----|-------|-------------|
| `other` | Other | Other violation not listed |

---

## 🔧 Admin Actions

| Action | Effect | Description |
|--------|--------|-------------|
| `warning` | Warns user | Sends warning notification, increments warning count |
| `temporary_ban` | Bans for X days | User cannot access app for specified duration |
| `permanent_ban` | Permanent ban | User permanently banned from platform |
| `account_suspended` | Suspends account | Account suspended pending further review |
| `content_removed` | Removes content | Removes the reported content |
| `no_violation` | No action | Marks as no violation found |
| `dismissed` | Dismisses report | Dismisses report without action |

---

## 🔐 Firestore Security Rules

The following rules are already implemented in the main app:

```javascript
// Reports collection - User reporting system
match /reports/{reportId} {
  // Only admins can read reports
  allow read: if isAdmin();
  
  // Any authenticated user can create a report
  allow create: if isSignedIn() && 
                  request.resource.data.reporterId == request.auth.uid &&
                  request.resource.data.reportedId != request.auth.uid;
  
  // Only admins can update reports
  allow update: if isAdmin() && 
                  request.resource.data.diff(resource.data).affectedKeys()
                    .hasOnly(['status', 'reviewedBy', 'reviewedAt', 'updatedAt', 
                              'actionTaken', 'actionDetails', 'adminNotes', 'isResolved', 'priority']);
  
  // Only admins can delete reports
  allow delete: if isAdmin();
}

// Admin Actions Log
match /admin_actions/{actionId} {
  allow read: if isAdmin();
  allow create: if isAdmin();
  allow update: if false;
  allow delete: if false;
}
```

---

## 📱 Admin App Implementation

### Required Screens

#### 1. Reports Dashboard
Shows overview of all reports with filtering options.

```javascript
// Example: Fetch pending reports
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const fetchPendingReports = async () => {
  const q = query(
    collection(db, 'reports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

#### 2. Report Detail Screen
Shows full report details and action buttons.

#### 3. User Management
View reported user's history, take actions.

---

## 🔌 API Endpoints (For Admin App)

### Fetch All Reports
```javascript
// GET /api/admin/reports
// Query Parameters:
//   - status: 'pending' | 'resolved' | 'all'
//   - priority: 'high' | 'medium' | 'low'
//   - reportType: 'user' | 'post' | 'message' | etc.
//   - limit: number (default: 50)
//   - startAfter: string (for pagination)

const getReports = async (options = {}) => {
  const { status, priority, reportType, limit = 50 } = options;
  
  let q = collection(db, 'reports');
  const constraints = [orderBy('createdAt', 'desc')];
  
  if (status && status !== 'all') {
    constraints.unshift(where('status', '==', status));
  }
  if (priority) {
    constraints.unshift(where('priority', '==', priority));
  }
  if (reportType) {
    constraints.unshift(where('reportType', '==', reportType));
  }
  constraints.push(limit(limitCount));
  
  const snapshot = await getDocs(query(q, ...constraints));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

### Get Report Statistics
```javascript
// GET /api/admin/reports/stats

const getReportStats = async () => {
  const snapshot = await getDocs(collection(db, 'reports'));
  
  return {
    total: snapshot.size,
    pending: snapshot.docs.filter(d => d.data().status === 'pending').length,
    resolved: snapshot.docs.filter(d => d.data().status === 'resolved').length,
    actionTaken: snapshot.docs.filter(d => d.data().status === 'action_taken').length,
  };
};
```

### Take Action on Report
```javascript
// POST /api/admin/reports/:reportId/action

const takeAction = async (reportId, { action, actionDetails, adminId }) => {
  const batch = writeBatch(db);
  const reportRef = doc(db, 'reports', reportId);
  const reportDoc = await getDoc(reportRef);
  const report = reportDoc.data();
  
  // Update report
  batch.update(reportRef, {
    status: 'action_taken',
    actionTaken: action,
    actionDetails,
    reviewedBy: adminId,
    reviewedAt: serverTimestamp(),
    isResolved: true,
  });
  
  // Take action on user
  const userRef = doc(db, 'users', report.reportedId);
  
  switch (action) {
    case 'warning':
      batch.update(userRef, {
        warningsCount: increment(1),
        lastWarning: actionDetails.message,
        warnedAt: serverTimestamp(),
      });
      break;
      
    case 'temporary_ban':
      const banExpires = new Date();
      banExpires.setDate(banExpires.getDate() + (actionDetails.duration || 7));
      
      batch.update(userRef, {
        isBanned: true,
        banType: 'temporary',
        banReason: actionDetails.reason,
        bannedAt: serverTimestamp(),
        banExpiresAt: banExpires,
      });
      break;
      
    case 'permanent_ban':
      batch.update(userRef, {
        isBanned: true,
        banType: 'permanent',
        banReason: actionDetails.reason,
        bannedAt: serverTimestamp(),
      });
      break;
  }
  
  // Log action
  const actionLogRef = doc(collection(db, 'admin_actions'));
  batch.set(actionLogRef, {
    adminId,
    reportId,
    targetUserId: report.reportedId,
    action,
    actionDetails,
    createdAt: serverTimestamp(),
  });
  
  await batch.commit();
};
```

### Dismiss Report
```javascript
// POST /api/admin/reports/:reportId/dismiss

const dismissReport = async (reportId, adminId, notes = '') => {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'dismissed',
    actionTaken: 'dismissed',
    reviewedBy: adminId,
    reviewedAt: serverTimestamp(),
    adminNotes: notes,
    isResolved: true,
  });
};
```

---

## 📊 Admin Dashboard Widgets

### Pending Reports Counter
```javascript
const PendingReportsWidget = () => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <View style={styles.widget}>
      <Text style={styles.widgetTitle}>Pending Reports</Text>
      <Text style={styles.widgetCount}>{count}</Text>
    </View>
  );
};
```

### Priority Distribution
```javascript
const PriorityWidget = ({ reports }) => {
  const high = reports.filter(r => r.priority === 'high').length;
  const medium = reports.filter(r => r.priority === 'medium').length;
  const low = reports.filter(r => r.priority === 'low').length;
  
  return (
    <View style={styles.widget}>
      <View style={styles.priorityRow}>
        <View style={[styles.priorityDot, { backgroundColor: '#EF4444' }]} />
        <Text>High: {high}</Text>
      </View>
      <View style={styles.priorityRow}>
        <View style={[styles.priorityDot, { backgroundColor: '#F59E0B' }]} />
        <Text>Medium: {medium}</Text>
      </View>
      <View style={styles.priorityRow}>
        <View style={[styles.priorityDot, { backgroundColor: '#6B7280' }]} />
        <Text>Low: {low}</Text>
      </View>
    </View>
  );
};
```

---

## 🔔 Real-time Notifications

### Listen for New Reports
```javascript
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

const listenForNewReports = (callback) => {
  const q = query(
    collection(db, 'reports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        callback({
          type: 'new_report',
          report: { id: change.doc.id, ...change.doc.data() }
        });
      }
    });
  });
};
```

### Push Notification for High Priority Reports
```javascript
// When a high-priority report is received, send push notification to admins
const notifyAdminsOfHighPriorityReport = async (report) => {
  if (report.priority !== 'high') return;
  
  // Get all admin users
  const adminsQuery = query(
    collection(db, 'users'),
    where('role', '==', 'admin')
  );
  const admins = await getDocs(adminsQuery);
  
  // Send notification to each admin
  admins.forEach(async (admin) => {
    await addDoc(collection(db, 'users', admin.id, 'notifications'), {
      type: 'high_priority_report',
      title: '🚨 High Priority Report',
      message: `New ${report.reasonLabel} report requires immediate attention`,
      reportId: report.id,
      createdAt: serverTimestamp(),
      read: false,
    });
  });
};
```

---

## ✅ Admin App Checklist

### Phase 1: Core Implementation
- [ ] Set up Firebase connection with admin SDK
- [ ] Create Reports Dashboard screen
- [ ] Implement report filtering (status, priority, type)
- [ ] Create Report Detail screen
- [ ] Implement action buttons (warn, ban, dismiss)
- [ ] Add confirmation dialogs for destructive actions

### Phase 2: Enhanced Features
- [ ] Real-time report updates
- [ ] Push notifications for high-priority reports
- [ ] Report statistics dashboard
- [ ] Admin action history/log viewer
- [ ] User profile integration (view reported user's history)

### Phase 3: Advanced
- [ ] Bulk actions (select multiple reports)
- [ ] Report templates (quick responses)
- [ ] Escalation system
- [ ] Admin roles/permissions
- [ ] Export reports to CSV

---

## 🧪 Testing

### Test Cases

1. **Submit Report**
   - Create report from user app
   - Verify it appears in admin dashboard
   - Check all fields are correctly populated

2. **Take Action**
   - Issue warning → verify user receives notification
   - Temporary ban → verify user cannot login during ban period
   - Permanent ban → verify user is locked out
   - Dismiss → verify report status updates

3. **Filters**
   - Filter by pending/resolved
   - Filter by priority
   - Filter by report type

4. **Edge Cases**
   - Multiple reports against same user
   - Reporter reports themselves (should fail)
   - Duplicate reports within 24 hours (should be blocked)

---

## 📞 Support

For implementation questions or issues:
- Review the `reportService.js` in the main app for full API
- Check `AdminModerationScreen.js` for reference implementation
- Examine Firestore rules in `firestore.rules`
- See `REPORTING_SYSTEM_FIXES.md` for robustness improvements
- See `REPORTING_TESTING_GUIDE.md` for comprehensive testing guide

---

## 🔒 Recent Improvements (v2.0)

The reporting system has been significantly enhanced with:
- ✅ Self-reporting prevention at multiple levels
- ✅ Comprehensive input validation and sanitization
- ✅ Improved duplicate detection (24-hour cooldown)
- ✅ Rate limiting (10 reports/hour per user)
- ✅ Better error handling with specific messages
- ✅ Non-blocking user stats updates
- ✅ Ban duration validation (1-365 days)
- ✅ Enhanced Firestore security rules

See `REPORTING_SYSTEM_FIXES.md` for complete details.

---

*Last Updated: January 25, 2026*
*Version: 2.0 - Enhanced Security & Robustness*
