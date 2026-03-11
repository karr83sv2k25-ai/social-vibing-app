// utils/groupChatHelpers.js
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  writeBatch,
  deleteField,
  arrayUnion, 
  arrayRemove,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Create a new group chat
 */
export async function createGroupChat(creatorId, groupData) {
  const { name, icon, description, participantIds } = groupData;
  
  // Include creator in participants
  const allParticipants = [creatorId, ...participantIds];
  
  const conversationRef = doc(collection(db, 'conversations'));
  const conversationId = conversationRef.id;
  
  // Initialize user settings for all participants
  const userSettings = {};
  const unreadCount = {};
  allParticipants.forEach(userId => {
    userSettings[userId] = {
      muted: false,
      mutedUntil: null,
      archived: false,
      pinnedMessages: [],
      customNotifications: "all",
      lastSeen: serverTimestamp(),
      clearedAt: null
    };
    unreadCount[userId] = 0;
  });
  
  await setDoc(conversationRef, {
    type: 'group',
    participants: allParticipants,
    groupName: name,
    groupIcon: icon || null,
    groupDescription: description || '',
    admins: [creatorId],
    createdAt: serverTimestamp(),
    createdBy: creatorId,
    lastMessage: {
      text: `Group "${name}" created`,
      senderId: 'system',
      timestamp: serverTimestamp(),
      type: 'system'
    },
    lastMessageTime: serverTimestamp(),
    userSettings,
    unreadCount,
    typing: {}
  });
  
  return conversationId;
}

/**
 * Add members to group
 */
export async function addGroupMembers(conversationId, currentUserId, newMemberIds) {
  const conversationRef = doc(db, 'conversations', conversationId);
  
  // Update arrays
  const updates = {
    participants: arrayUnion(...newMemberIds)
  };
  
  // Add user settings for new members
  newMemberIds.forEach(userId => {
    updates[`userSettings.${userId}`] = {
      muted: false,
      mutedUntil: null,
      archived: false,
      pinnedMessages: [],
      customNotifications: "all",
      lastSeen: serverTimestamp(),
      clearedAt: null
    };
    updates[`unreadCount.${userId}`] = 0;
  });
  
  // Add lastMessageTime for visibility
  updates.lastMessageTime = serverTimestamp();
  updates.lastMessage = {
    text: `${newMemberIds.length} member(s) added`,
    senderId: 'system',
    timestamp: serverTimestamp(),
    type: 'system'
  };
  
  await updateDoc(conversationRef, updates);
  
  // Create system message
  await addSystemMessage(
    conversationId,
    `${newMemberIds.length} member(s) added`,
    currentUserId
  );
}

/**
 * Remove member from group
 */
export async function removeGroupMember(conversationId, adminId, memberToRemoveId) {
  const conversationRef = doc(db, 'conversations', conversationId);
  
  await updateDoc(conversationRef, {
    participants: arrayRemove(memberToRemoveId),
    [`userSettings.${memberToRemoveId}`]: deleteField(),
    [`unreadCount.${memberToRemoveId}`]: deleteField(),
    lastMessageTime: serverTimestamp(),
    lastMessage: {
      text: 'Member removed',
      senderId: 'system',
      timestamp: serverTimestamp(),
      type: 'system'
    }
  });
  
  await addSystemMessage(
    conversationId,
    `Member removed`,
    adminId
  );
}

/**
 * Leave group
 */
export async function leaveGroup(conversationId, userId) {
  const conversationRef = doc(db, 'conversations', conversationId);
  
  await updateDoc(conversationRef, {
    participants: arrayRemove(userId),
    admins: arrayRemove(userId),
    [`userSettings.${userId}`]: deleteField(),
    [`unreadCount.${userId}`]: deleteField(),
    lastMessageTime: serverTimestamp(),
    lastMessage: {
      text: 'Member left the group',
      senderId: 'system',
      timestamp: serverTimestamp(),
      type: 'system'
    }
  });
  
  await addSystemMessage(conversationId, `Member left the group`, userId);
}

/**
 * Promote user to admin
 */
export async function promoteToAdmin(conversationId, currentAdminId, userIdToPromote) {
  await updateDoc(doc(db, 'conversations', conversationId), {
    admins: arrayUnion(userIdToPromote),
    lastMessageTime: serverTimestamp(),
    lastMessage: {
      text: 'New admin promoted',
      senderId: 'system',
      timestamp: serverTimestamp(),
      type: 'system'
    }
  });
  
  await addSystemMessage(
    conversationId,
    `New admin promoted`,
    currentAdminId
  );
}

/**
 * Demote admin
 */
export async function demoteAdmin(conversationId, currentAdminId, userIdToDemote) {
  await updateDoc(doc(db, 'conversations', conversationId), {
    admins: arrayRemove(userIdToDemote),
    lastMessageTime: serverTimestamp(),
    lastMessage: {
      text: 'Admin demoted',
      senderId: 'system',
      timestamp: serverTimestamp(),
      type: 'system'
    }
  });
  
  await addSystemMessage(
    conversationId,
    `Admin demoted`,
    currentAdminId
  );
}

/**
 * Update group info
 */
export async function updateGroupInfo(conversationId, updates) {
  const allowedFields = ['groupName', 'groupIcon', 'groupDescription'];
  const filteredUpdates = {};
  
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });
  
  await updateDoc(doc(db, 'conversations', conversationId), filteredUpdates);
}

/**
 * Delete group (admin only) — removes the conversation doc and all messages
 */
export async function deleteGroup(conversationId, adminId) {
  const batch = writeBatch(db);

  // Delete all messages in the group
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messagesSnap = await getDocs(messagesRef);
  messagesSnap.forEach((msgDoc) => batch.delete(msgDoc.ref));

  // Delete the conversation document itself
  batch.delete(doc(db, 'conversations', conversationId));

  await batch.commit();
}

/**
 * Add system message
 */
async function addSystemMessage(conversationId, text, actorId) {
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  
  await setDoc(messageRef, {
    senderId: 'system',
    text,
    type: 'system',
    createdAt: serverTimestamp(),
    status: {
      sent: serverTimestamp()
    },
    actorId
  });
}
