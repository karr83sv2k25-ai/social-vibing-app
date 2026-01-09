# 📌 Community Announcements & Featured Posts Guide

Complete guide for implementing pinned announcements and featured posts in your community.

## 🎯 Overview

### Announcements (Pinned Posts)
- **What:** Posts that moderators/creators can pin to the top of community
- **Limit:** Maximum 3 announcements per community
- **Display:** Shows only post title (e.g., "Announcement 1")
- **Purpose:** Highlight rules, applications, news, important updates
- **Who can pin:** Community creator and moderators

### Featured Posts
- **What:** Posts promoted to top priority in community feed
- **Limit:** Unlimited, but typically show top 10
- **Display:** Shows full post with "Featured" badge
- **Purpose:** Highlight quality content, trending posts, important discussions
- **Who can feature:** Community creator and moderators

---

## 🏗️ Database Structure

### Community Document (Firestore)
```javascript
{
  id: "community_id",
  name: "Example name",
  creatorId: "user_id",
  moderators: ["user_id1", "user_id2"],
  members: ["user_id1", "user_id2", ...],
  memberCount: 180,
  
  // Announcements
  announcements: ["post_id1", "post_id2", "post_id3"], // Max 3
  
  // Featured Posts
  featuredPosts: ["post_id4", "post_id5", ...],
  
  // Other fields...
}
```

### Post Document (Firestore)
```javascript
{
  id: "post_id",
  userId: "author_id",
  communityId: "community_id",
  type: "blog", // text, image, video, poll, quiz, question, blog
  title: "Post title",
  content: "Post content...",
  
  // Announcement fields
  isPinned: true,
  pinnedAt: Timestamp,
  pinnedBy: "moderator_id",
  
  // Featured fields
  isFeatured: true,
  featuredAt: Timestamp,
  featuredBy: "moderator_id",
  
  // Other fields...
}
```

---

## 🚀 Quick Start

### Import Services
```javascript
import { auth, db } from './firebaseConfig';
import * as CommunityService from './shared/services/communityService';
import * as PostService from './shared/services/postService';
```

### Check if User is Moderator
```javascript
const currentUserId = auth.currentUser?.uid;
const isMod = await CommunityService.isModerator(db, communityId, currentUserId);
```

---

## 📌 Announcements (Pinned Posts)

### Pin a Post as Announcement
```javascript
const result = await CommunityService.pinPostAsAnnouncement(
  db,
  communityId,
  postId,
  currentUserId
);

if (result.success) {
  console.log('✅ Post pinned!');
} else {
  console.log('❌ Error:', result.error);
  // Possible errors:
  // - "Only moderators can pin announcements"
  // - "Post already pinned"
  // - "Maximum 3 announcements allowed"
}
```

### Unpin an Announcement
```javascript
const result = await CommunityService.unpinAnnouncement(
  db,
  communityId,
  postId,
  currentUserId
);

if (result.success) {
  console.log('✅ Announcement unpinned!');
}
```

### Get All Announcements
```javascript
const result = await CommunityService.getAnnouncements(db, communityId);

if (result.success) {
  const announcements = result.data; // Array of post objects
  console.log(`Found ${announcements.length} announcements`);
  
  announcements.forEach(post => {
    console.log(`- ${post.title}`);
  });
}
```

---

## ⭐ Featured Posts

### Feature a Post
```javascript
const result = await CommunityService.featurePost(
  db,
  communityId,
  postId,
  currentUserId
);

if (result.success) {
  console.log('✅ Post featured!');
} else {
  console.log('❌ Error:', result.error);
  // Possible errors:
  // - "Only moderators can feature posts"
  // - "Post already featured"
}
```

### Unfeature a Post
```javascript
const result = await CommunityService.unfeaturePost(
  db,
  communityId,
  postId,
  currentUserId
);

if (result.success) {
  console.log('✅ Post unfeatured!');
}
```

### Get Featured Posts
```javascript
const result = await CommunityService.getFeaturedPosts(db, communityId, 10);

if (result.success) {
  const featuredPosts = result.data; // Array sorted by featuredAt (newest first)
  console.log(`Found ${featuredPosts.length} featured posts`);
}
```

---

## 🎨 UI Implementation

### Announcements Section (React Native)
```javascript
import { FlatList, TouchableOpacity, Text, View } from 'react-native';

function AnnouncementsSection({ announcements, navigation }) {
  const renderAnnouncement = ({ item }) => (
    <TouchableOpacity
      style={styles.announcementItem}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
    >
      <Text style={styles.announcementTitle}>
        {item.title || 'Announcement 1'}
      </Text>
    </TouchableOpacity>
  );

  if (announcements.length === 0) return null;

  return (
    <View style={styles.announcementsContainer}>
      <FlatList
        data={announcements}
        renderItem={renderAnnouncement}
        keyExtractor={item => item.id}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  announcementsContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  announcementItem: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6C5CE7', // Purple accent
  },
  announcementTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Featured Post Badge
```javascript
function PostCard({ post }) {
  return (
    <View style={styles.postCard}>
      {/* Featured badge */}
      {post.isFeatured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>⭐ Featured</Text>
        </View>
      )}
      
      {/* Post content */}
      <Image source={{ uri: post.mediaUrls[0] }} style={styles.postImage} />
      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postContent}>{post.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  featuredBadge: {
    backgroundColor: '#FFD700', // Gold
    padding: 5,
    alignItems: 'center',
  },
  featuredText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
```

### Moderator Actions Menu
```javascript
function PostModActions({ post, communityId, onPin, onFeature }) {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <View>
      <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
        <Text>⋮</Text>
      </TouchableOpacity>
      
      {showMenu && (
        <View style={styles.modMenu}>
          {!post.isPinned && (
            <TouchableOpacity onPress={onPin}>
              <Text>📌 Pin as Announcement</Text>
            </TouchableOpacity>
          )}
          
          {post.isPinned && (
            <TouchableOpacity onPress={onPin}>
              <Text>📌 Unpin Announcement</Text>
            </TouchableOpacity>
          )}
          
          {!post.isFeatured && (
            <TouchableOpacity onPress={onFeature}>
              <Text>⭐ Feature Post</Text>
            </TouchableOpacity>
          )}
          
          {post.isFeatured && (
            <TouchableOpacity onPress={onFeature}>
              <Text>⭐ Unfeature Post</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
```

---

## 🔒 Permission Checks

### Client-Side Check
```javascript
// Check before showing moderator options
const isMod = await CommunityService.isModerator(db, communityId, currentUserId);

if (isMod) {
  // Show pin/unpin/feature/unfeature options
}
```

### Server-Side (Firestore Rules)
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is moderator
    function isModerator(communityId, userId) {
      let community = get(/databases/$(database)/documents/communities/$(communityId));
      return community.data.creatorId == userId || 
             userId in community.data.moderators;
    }
    
    match /communities/{communityId} {
      // Only moderators can update announcements and featuredPosts
      allow update: if request.auth != null && 
                    isModerator(communityId, request.auth.uid);
    }
    
    match /posts/{postId} {
      // Only moderators can update isPinned and isFeatured
      allow update: if request.auth != null && 
                    (request.resource.data.userId == request.auth.uid ||
                     isModerator(request.resource.data.communityId, request.auth.uid));
    }
  }
}
```

---

## 💡 Best Practices

### 1. Limit Announcements to 3
```javascript
// Before pinning, check count
const communityDoc = await getDoc(doc(db, 'communities', communityId));
const currentAnnouncements = communityDoc.data().announcements || [];

if (currentAnnouncements.length >= 3) {
  Alert.alert(
    'Maximum Reached',
    'You can only have 3 announcements. Please unpin one first.',
    [{ text: 'OK' }]
  );
  return;
}
```

### 2. Show Clear Visual Distinction
- Announcements: Different background, border, or icon
- Featured posts: Badge or ribbon indicating "Featured"
- Use consistent colors (purple for announcements, gold for featured)

### 3. Order Matters
```javascript
// Announcements: Show in order they were pinned
const announcements = await getAnnouncements(db, communityId);

// Featured: Show newest first
const featured = await getFeaturedPosts(db, communityId);
// Already sorted by featuredAt (newest first)
```

### 4. Handle Long Press for Moderators
```javascript
<TouchableOpacity
  onLongPress={() => {
    if (isModerator) {
      Alert.alert(
        'Moderator Actions',
        'What would you like to do?',
        [
          { text: 'Pin as Announcement', onPress: () => handlePin() },
          { text: 'Feature Post', onPress: () => handleFeature() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  }}
>
  {/* Post content */}
</TouchableOpacity>
```

### 5. Notifications
```javascript
// Notify post author when their post is pinned/featured
if (postAuthorId !== moderatorId) {
  await setDoc(doc(collection(db, 'notifications')), {
    type: 'post_featured', // or 'post_pinned'
    fromUserId: moderatorId,
    toUserId: postAuthorId,
    postId: postId,
    message: 'Your post was featured in the community!',
    createdAt: serverTimestamp(),
    read: false
  });
}
```

---

## 📊 Use Cases

### Example 1: Community Rules
```javascript
// Create a post with community rules
const rulesPost = await PostService.createPost(db, moderatorId, {
  communityId: communityId,
  type: 'blog',
  title: 'Community Rules',
  content: '1. Be respectful\n2. No spam\n3. Stay on topic...'
});

// Pin it as first announcement
await CommunityService.pinPostAsAnnouncement(
  db, communityId, rulesPost.postId, moderatorId
);
```

### Example 2: Staff Applications
```javascript
// Create staff application post
const staffPost = await PostService.createPost(db, moderatorId, {
  communityId: communityId,
  type: 'question',
  title: 'Moderator Applications Open!',
  content: 'We are looking for new moderators...'
});

// Pin as announcement
await CommunityService.pinPostAsAnnouncement(
  db, communityId, staffPost.postId, moderatorId
);
```

### Example 3: Replace Old Announcements
```javascript
// Unpin all old announcements
const oldAnnouncements = await CommunityService.getAnnouncements(db, communityId);
for (const post of oldAnnouncements.data) {
  await CommunityService.unpinAnnouncement(db, communityId, post.id, moderatorId);
}

// Pin new announcements
const newPostIds = ['post1', 'post2', 'post3'];
for (const postId of newPostIds) {
  await CommunityService.pinPostAsAnnouncement(db, communityId, postId, moderatorId);
}
```

---

## 🐛 Troubleshooting

### Issue: Can't pin more than 3 announcements
**Solution:** Unpin one existing announcement first
```javascript
// Check current count
const announcements = await getAnnouncements(db, communityId);
console.log(`Current announcements: ${announcements.data.length}/3`);
```

### Issue: Non-moderators trying to pin
**Solution:** Always check permissions before showing UI
```javascript
const isMod = await CommunityService.isModerator(db, communityId, userId);
if (!isMod) {
  // Don't show moderator actions
  return null;
}
```

### Issue: Featured posts not sorting correctly
**Solution:** They're sorted by `featuredAt` timestamp automatically
```javascript
const featured = await getFeaturedPosts(db, communityId);
// Already sorted, newest first
```

---

## 📚 Complete Example

See [CommunityScreen.example.js](./examples/CommunityScreen.example.js) for a complete working example with:
- Community header with image and tags
- Announcements section
- Featured/Following/Community tabs
- Moderator actions (pin/unpin/feature/unfeature)
- Long press handlers
- Full styling

---

## 🎯 Summary

**Announcements:**
- Max 3 per community
- Show only title
- For important info (rules, news, applications)
- Pinned by moderators

**Featured Posts:**
- Unlimited (show top 10)
- Show full post with badge
- For quality content
- Featured by moderators

**Both:**
- Only moderators can manage
- Automatically synced across mobile & web
- Full CRUD operations available
- Permission-checked on client & server
