# Quick Start Guide - User Status System

## 🚀 Getting Started

### Step 1: Update Firebase Security Rules
Add these rules to your `firestore.rules` to allow status updates:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Allow users to read any user's status
      allow read: if true;
      
      // Allow users to update only their own status fields
      allow update: if request.auth != null && request.auth.uid == userId &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['currentStatus', 'customStatuses', 'statusUpdatedAt']);
    }
  }
}
```

### Step 2: Test the Implementation

1. **Run your app**:
   ```bash
   npm start
   # or
   expo start
   ```

2. **Navigate to Profile screen** and look for the status badge below the online/offline indicator

3. **Click the status badge** to open the status selector

4. **Try these actions**:
   - Select a predefined status (Available, Busy, Away, etc.)
   - Create a custom status
   - Navigate to different screens and verify status appears

### Step 3: Verify Integration Points

✅ **Profile Screen**
- Go to your profile
- Status badge should appear below "Online/Offline"
- Click it to change status

✅ **Messages Screen**
- Go to Messages
- Status badge in header (near notifications icon)
- Inline status in conversation list

✅ **Community Screen**
- Go to Community
- Status badge below your profile info
- Click to update

✅ **Home Screen**
- Scroll through posts
- Each post should show author's status below their name

## 🎨 Customization Options

### Change Theme Colors
Edit `components/StatusSelector.js` and `components/StatusBadge.js`:

```javascript
const C = {
  bg: '#YourColor',
  card: '#YourColor',
  // ... modify colors as needed
};
```

### Add More Predefined Statuses
Edit `contexts/StatusContext.js`:

```javascript
export const PREDEFINED_STATUSES = [
  // ... existing statuses
  { id: 'custom', label: 'Your Custom Status', emoji: '🎯', color: '#FF6B6B' },
];
```

### Adjust Status Character Limit
Edit `components/StatusSelector.js` (line ~89):

```javascript
if (customInput.trim().length > 50) {  // Change 50 to your limit
```

## 🔍 Troubleshooting

### Status Not Showing
- Check Firebase rules are updated
- Verify user is logged in
- Check console for errors

### Status Not Updating
- Ensure internet connection
- Check Firestore permissions
- Verify StatusProvider is wrapping app in `App.js`

### Style Issues
- Clear app cache
- Restart development server
- Check component imports

## 📱 Component API Reference

### StatusBadge Props
```javascript
<StatusBadge
  userId={string}           // User ID (null for own status)
  isOwnStatus={boolean}     // Is this the current user's status
  onPress={function}        // Click handler
  size="small|medium|large" // Size variant
  showEditIcon={boolean}    // Show edit icon
  style={object}            // Additional styles
/>
```

### StatusSelector Props
```javascript
<StatusSelector
  visible={boolean}         // Modal visibility
  onClose={function}        // Close handler
  title={string}            // Modal title
/>
```

### InlineStatus Props
```javascript
<InlineStatus
  userId={string}           // User ID
  isOwnStatus={boolean}     // Is current user
  style={object}            // Container styles
  textStyle={object}        // Text styles
/>
```

## 🎯 Best Practices

1. **Always wrap StatusSelector in a state-controlled Modal**
2. **Use InlineStatus for compact displays** (conversation lists, posts)
3. **Use StatusBadge for prominent displays** (profile headers)
4. **Cache status data** when displaying many users at once
5. **Handle loading states** gracefully

## 📊 Firebase Data Access

### Read Current User's Status
```javascript
const { currentStatus, customStatuses } = useStatus();
```

### Update Status Programmatically
```javascript
const { updateStatus } = useStatus();
await updateStatus('New Status Text');
```

### Get Any User's Status
```javascript
const { getUserStatus } = useStatus();
const status = await getUserStatus(userId);
```

### Subscribe to Status Updates
```javascript
const { subscribeToUserStatus } = useStatus();
const unsubscribe = subscribeToUserStatus(userId, (status) => {
  console.log('Status updated:', status);
});
```

## ✅ Success!

Your user status system is now fully operational! Users can set and view statuses across all major screens in your app.

Need help? Check the main documentation at `USER_STATUS_SYSTEM_DOCS.md`
