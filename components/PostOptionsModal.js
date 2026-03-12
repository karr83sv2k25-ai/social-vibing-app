/**
 * PostOptionsModal – Bottom sheet shown on long-press of a post.
 *
 * Follows the same pattern as MessageActionsSheet.
 * Renders contextual options (delete, report, share, copy link, pin, feature)
 * with haptic feedback and a dark glass-like bottom sheet.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import useUserNames from '../hooks/useUserNames';

const { height } = Dimensions.get('window');

const PostOptionsModal = ({
  visible = false,
  post = null,
  currentUserId = null,
  communityId = null,
  onClose,
  // Core actions
  onDelete,
  onReport,
  onShare,
  onCopyLink,
  // Community-level actions (optional)
  onPin,
  onUnpin,
  onFeature,
  onUnfeature,
  onEdit,
  onHide,
  // Flags that enable community controls
  isPinned = false,
  isFeatured = false,
  isAdmin = false,
  isModerator = false,
}) => {
  // Resolve live author name in case the user changed their name after posting.
  // Hooks must be called before early returns to comply with Rules of Hooks.
  const authorIds = useMemo(() => (post?.authorId ? [post.authorId] : []), [post?.authorId]);
  // Pass communityId so community nickname is shown instead of global name when available.
  const liveAuthorNames = useUserNames(authorIds, communityId);
  const authorDisplayName = liveAuthorNames[post?.authorId] || post?.authorName || 'Unknown';

  // Must be defined before any early return to comply with Rules of Hooks.
  const handleAction = useCallback(
    (action) => {
      onClose?.();
      // Small delay for modal dismiss animation
      setTimeout(() => {
        action.onPress?.(post);
      }, 200);
    },
    [onClose, post],
  );

  if (!post) return null;

  const isOwner = post.authorId === currentUserId;
  const isStaff = isAdmin || isModerator;

  // Build actions array – order matters (first = top)
  const actions = [
    // --- Community staff actions ---
    {
      icon: 'pin-outline',
      iconLib: 'ionicons',
      label: 'Pin as Announcement',
      onPress: onPin,
      show: isStaff && !isPinned && !!onPin,
    },
    {
      icon: 'pin-outline',
      iconLib: 'ionicons',
      label: 'Unpin Announcement',
      onPress: onUnpin,
      show: isStaff && isPinned && !!onUnpin,
    },
    {
      icon: 'star-outline',
      iconLib: 'material',
      label: 'Add to Featured',
      onPress: onFeature,
      show: isStaff && !isFeatured && !!onFeature,
    },
    {
      icon: 'star',
      iconLib: 'material',
      label: 'Remove from Featured',
      onPress: onUnfeature,
      show: isStaff && isFeatured && !!onUnfeature,
    },
    // --- Owner actions ---
    {
      icon: 'create-outline',
      iconLib: 'ionicons',
      label: 'Edit Post',
      onPress: onEdit,
      show: isOwner && !!onEdit,
    },
    // --- General actions ---
    {
      icon: 'share-social-outline',
      iconLib: 'ionicons',
      label: 'Share Post',
      onPress: onShare,
      show: !!onShare,
    },
    {
      icon: 'link-outline',
      iconLib: 'ionicons',
      label: 'Copy Link',
      onPress: onCopyLink,
      show: !!onCopyLink,
    },
    {
      icon: 'eye-off-outline',
      iconLib: 'ionicons',
      label: 'Hide Post',
      onPress: onHide,
      show: isStaff && !!onHide && !post?.isHidden,
    },
    // --- Danger zone ---
    {
      icon: 'flag-outline',
      iconLib: 'ionicons',
      label: 'Report Post',
      onPress: onReport,
      show: !isOwner && !!onReport,
      danger: true,
    },
    {
      icon: 'trash-outline',
      iconLib: 'ionicons',
      label: 'Delete Post',
      onPress: onDelete,
      show: (isOwner || isStaff) && !!onDelete,
      danger: true,
    },
  ];

  const visibleActions = actions.filter((a) => a.show);

  const renderIcon = (action) => {
    const color = action.danger ? '#EF4444' : '#fff';
    if (action.iconLib === 'material') {
      return <MaterialIcons name={action.icon} size={24} color={color} />;
    }
    if (action.iconLib === 'material-community') {
      return <MaterialCommunityIcons name={action.icon} size={24} color={color} />;
    }
    return <Ionicons name={action.icon} size={24} color={color} />;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          {/* Post preview header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {post.title || post.caption || post.text || post.question || 'Post Options'}
            </Text>
            <Text style={styles.headerSub}>
              by {authorDisplayName}{' '}
              {post.createdAt
                ? `• ${new Date(
                    post.createdAt.toDate?.() || post.createdAt,
                  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : ''}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {visibleActions.map((action, index) => (
              <TouchableOpacity
                key={`${action.label}-${index}`}
                style={styles.actionItem}
                onPress={() => handleAction(action)}
                activeOpacity={0.7}
              >
                {renderIcon(action)}
                <Text style={[styles.actionText, action.danger && styles.dangerText]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#17171C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: height * 0.7,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dangerText: {
    color: '#EF4444',
  },
  cancelButton: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#222',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostOptionsModal;
