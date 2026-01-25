/**
 * ReportUserModal - A reusable modal component for reporting users/content
 * Can be used anywhere in the app where reporting functionality is needed
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { 
  submitReport, 
  REPORT_REASONS, 
  REPORT_TYPES 
} from '../shared/services/reportService';

// Color constants
const COLORS = {
  bg: '#0B0B10',
  card: '#1A1F27',
  border: '#242A33',
  text: '#EAEAF0',
  dim: '#9CA3AF',
  accent: '#7C3AED',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
};

// Report reasons grouped by category
const REASON_CATEGORIES = {
  safety: {
    label: 'Safety',
    icon: 'shield-outline',
    reasons: [REPORT_REASONS.VIOLENCE, REPORT_REASONS.SELF_HARM, REPORT_REASONS.UNDERAGE],
  },
  behavior: {
    label: 'Behavior',
    icon: 'person-outline',
    reasons: [REPORT_REASONS.HARASSMENT, REPORT_REASONS.HATE_SPEECH],
  },
  content: {
    label: 'Content',
    icon: 'document-text-outline',
    reasons: [REPORT_REASONS.INAPPROPRIATE_CONTENT, REPORT_REASONS.SPAM],
  },
  identity: {
    label: 'Identity',
    icon: 'finger-print-outline',
    reasons: [REPORT_REASONS.IMPERSONATION, REPORT_REASONS.FAKE_PROFILE],
  },
  security: {
    label: 'Security',
    icon: 'lock-closed-outline',
    reasons: [REPORT_REASONS.SCAM],
  },
  legal: {
    label: 'Legal',
    icon: 'document-outline',
    reasons: [REPORT_REASONS.COPYRIGHT],
  },
  other: {
    label: 'Other',
    icon: 'ellipsis-horizontal-outline',
    reasons: [REPORT_REASONS.OTHER],
  },
};

export default function ReportUserModal({
  visible,
  onClose,
  reportedUser, // { id, username, name }
  reportType = REPORT_TYPES.USER,
  contentId = null,
  contentType = null,
  contentPreview = null,
  communityId = null,
}) {
  const [step, setStep] = useState(1); // 1: Select reason, 2: Add details, 3: Confirmation
  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Reset state when modal closes
  const handleClose = () => {
    setStep(1);
    setSelectedReason(null);
    setDescription('');
    setIsSubmitting(false);
    setSubmitSuccess(false);
    onClose();
  };

  // Handle reason selection
  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    setStep(2);
  };

  // Handle back navigation
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      handleClose();
    }
  };

  // Submit the report
  const handleSubmit = async () => {
    // Validation checks
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for your report');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to submit a report');
      return;
    }

    if (!reportedUser || !reportedUser.id) {
      Alert.alert('Error', 'Invalid user to report');
      return;
    }

    // Prevent self-reporting (extra client-side check)
    if (currentUser.uid === reportedUser.id) {
      Alert.alert('Error', 'You cannot report yourself');
      return;
    }

    // Validate description length
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 500) {
      Alert.alert('Error', 'Description is too long. Please limit to 500 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitReport({
        reporterId: currentUser.uid,
        reporterUsername: currentUser.displayName || currentUser.email || 'Anonymous',
        reportedId: reportedUser.id,
        reportedUsername: reportedUser.username || reportedUser.name || 'Unknown User',
        reportType,
        reason: selectedReason,
        description: trimmedDescription,
        contentId: contentId || null,
        contentType: contentType || null,
        contentPreview: contentPreview || null,
        communityId: communityId || null,
      });

      if (result.success) {
        setSubmitSuccess(true);
        setStep(3);
      } else {
        Alert.alert('Report Failed', result.error || 'Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render reason selection step
  const renderReasonSelection = () => (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Why are you reporting this {reportType}?</Text>
      <Text style={styles.stepDescription}>
        Select the most appropriate reason. False reports may result in action against your account.
      </Text>

      {Object.entries(REASON_CATEGORIES).map(([key, category]) => (
        <View key={key} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Ionicons name={category.icon} size={18} color={COLORS.accent} />
            <Text style={styles.categoryLabel}>{category.label}</Text>
          </View>
          
          {category.reasons.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={styles.reasonItem}
              onPress={() => handleReasonSelect(reason)}
              activeOpacity={0.7}
            >
              <View style={styles.reasonContent}>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
                <Text style={styles.reasonDescription}>{reason.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.dim} />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // Render details step
  const renderDetailsStep = () => (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Provide more details</Text>
      
      <View style={styles.selectedReasonCard}>
        <Ionicons name="flag" size={20} color={COLORS.warning} />
        <View style={styles.selectedReasonInfo}>
          <Text style={styles.selectedReasonLabel}>{selectedReason?.label}</Text>
          <Text style={styles.selectedReasonDesc}>{selectedReason?.description}</Text>
        </View>
      </View>

      <Text style={styles.inputLabel}>Additional information (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Describe the issue in more detail..."
        placeholderTextColor={COLORS.dim}
        multiline
        numberOfLines={5}
        maxLength={500}
        value={description}
        onChangeText={setDescription}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{description.length}/500</Text>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
        <Text style={styles.infoText}>
          Reports are reviewed by our moderation team. You will not be notified of the outcome, 
          but appropriate action will be taken if a violation is found.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.submitButtonText}>Submit Report</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // Render confirmation step
  const renderConfirmation = () => (
    <View style={styles.confirmationContainer}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
      </View>
      
      <Text style={styles.confirmationTitle}>Report Submitted</Text>
      <Text style={styles.confirmationText}>
        Thank you for helping keep our community safe. Our team will review your report 
        and take appropriate action.
      </Text>

      <View style={styles.confirmationInfo}>
        <Ionicons name="eye-off-outline" size={20} color={COLORS.dim} />
        <Text style={styles.confirmationInfoText}>
          Your identity will be kept confidential
        </Text>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  // Render step indicator
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            step >= s && styles.stepDotActive,
            step === s && styles.stepDotCurrent,
          ]}
        />
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons 
                name={step === 1 ? "close" : "arrow-back"} 
                size={24} 
                color={COLORS.text} 
              />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                Report {reportType === REPORT_TYPES.USER ? 'User' : 'Content'}
              </Text>
              {reportedUser && (
                <Text style={styles.headerSubtitle}>
                  @{reportedUser.username || reportedUser.name || 'user'}
                </Text>
              )}
            </View>
            
            <View style={styles.headerRight}>
              {renderStepIndicator()}
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 1 && renderReasonSelection()}
            {step === 2 && renderDetailsStep()}
            {step === 3 && renderConfirmation()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.dim,
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 12,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.accent,
  },
  stepDotCurrent: {
    width: 20,
    borderRadius: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.dim,
    marginBottom: 20,
    lineHeight: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  reasonDescription: {
    fontSize: 13,
    color: COLORS.dim,
  },
  selectedReasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  selectedReasonInfo: {
    flex: 1,
  },
  selectedReasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 4,
  },
  selectedReasonDesc: {
    fontSize: 13,
    color: COLORS.dim,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.dim,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.dim,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.danger,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  confirmationContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 15,
    color: COLORS.dim,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  confirmationInfoText: {
    fontSize: 14,
    color: COLORS.dim,
  },
  doneButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
