import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const C = {
  bg: '#0B0B10',
  card: '#14171C',
  card2: '#1A1F27',
  border: '#242A33',
  text: '#EAEAF0',
  dim: '#A2A8B3',
  cyan: '#08FFE2',
  brand: '#BF2EF0',
};

const HelpCenterScreen = () => {
  const navigation = useNavigation();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const helpSections = [
    {
      id: 'account',
      title: 'Account & Profile',
      icon: 'person-outline',
      faqs: [
        {
          question: 'How do I edit my profile?',
          answer: 'Go to your profile and tap "Edit Profile" button. You can update your profile picture, bio, and other information.'
        },
        {
          question: 'How do I reset my password?',
          answer: 'On the login screen, tap "Forgot Password" and follow the instructions sent to your email.'
        },
        {
          question: 'How do I verify my account?',
          answer: 'Verified badges are awarded to notable accounts. Contact support if you believe you qualify.'
        }
      ]
    },
    {
      id: 'marketplace',
      title: 'Marketplace & Wallet',
      icon: 'storefront-outline',
      faqs: [
        {
          question: 'How do I buy products?',
          answer: 'Browse the Marketplace, select a product, and follow the checkout process. You can pay using your wallet balance or diamonds.'
        },
        {
          question: 'How do I sell products?',
          answer: 'Go to "My Store" from your profile, tap "Add Product" and fill in the details including images, price, and description.'
        },
        {
          question: 'How do I withdraw earnings?',
          answer: 'Visit your Wallet screen, tap "Withdraw" and enter your withdrawal method details. Minimum withdrawal is 1000 coins.'
        }
      ]
    },
    {
      id: 'rewards',
      title: 'Coins & Rewards',
      icon: 'diamond-outline',
      faqs: [
        {
          question: 'How do I earn coins?',
          answer: 'Complete daily tasks, check in daily, participate in community activities, and sell products in the marketplace.'
        },
        {
          question: 'What can I do with coins?',
          answer: 'Use coins to purchase items in the marketplace, send gifts, or convert them to real money through withdrawals.'
        },
        {
          question: 'What are diamonds?',
          answer: 'Diamonds are premium currency that can be purchased. They can be used for special features and premium marketplace items.'
        }
      ]
    },
    {
      id: 'community',
      title: 'Communities & Social',
      icon: 'people-outline',
      faqs: [
        {
          question: 'How do I create a community?',
          answer: 'Tap "Communities" > "Create Community". Add details, rules, and customize your community settings.'
        },
        {
          question: 'How do I report inappropriate content?',
          answer: 'Tap the three dots on any post or profile and select "Report". Choose the appropriate reason and submit.'
        },
        {
          question: 'What are status badges?',
          answer: 'Status badges show your current activity. You can set your status from your profile (Online, Busy, Away, etc.).'
        }
      ]
    },
    {
      id: 'privacy',
      title: 'Privacy & Safety',
      icon: 'shield-checkmark-outline',
      faqs: [
        {
          question: 'How do I block someone?',
          answer: 'Visit their profile, tap the three dots menu, and select "Block User". They will no longer be able to contact you.'
        },
        {
          question: 'Who can see my posts?',
          answer: 'Posts visibility depends on your privacy settings. You can control this in Account Settings.'
        },
        {
          question: 'How do I report a user?',
          answer: 'Visit their profile, tap the three dots menu, select "Report User" and choose the violation type.'
        }
      ]
    }
  ];

  const contactOptions = [
    {
      title: 'Email Support',
      subtitle: 'support@socialvibing.com',
      icon: 'mail-outline',
      onPress: () => Linking.openURL('mailto:support@socialvibing.com')
    },
    {
      title: 'Report a Bug',
      subtitle: 'Help us improve',
      icon: 'bug-outline',
      onPress: () => Linking.openURL('mailto:bugs@socialvibing.com?subject=Bug Report')
    },
    {
      title: 'Feature Request',
      subtitle: 'Suggest new features',
      icon: 'bulb-outline',
      onPress: () => Linking.openURL('mailto:feedback@socialvibing.com?subject=Feature Request')
    }
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <Ionicons name="help-circle" size={48} color={C.brand} />
          <Text style={styles.welcomeTitle}>How can we help you?</Text>
          <Text style={styles.welcomeSubtitle}>
            Find answers to common questions or contact our support team
          </Text>
        </View>

        {/* FAQ Sections */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {helpSections.map((section) => (
          <View key={section.id} style={styles.faqSection}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => toggleSection(section.id)}
              activeOpacity={0.8}
            >
              <View style={styles.faqHeaderLeft}>
                <Ionicons name={section.icon} size={24} color={C.cyan} />
                <Text style={styles.faqTitle}>{section.title}</Text>
              </View>
              <Ionicons
                name={expandedSection === section.id ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={C.dim}
              />
            </TouchableOpacity>

            {expandedSection === section.id && (
              <View style={styles.faqContent}>
                {section.faqs.map((faq, index) => (
                  <View key={index} style={styles.faqItem}>
                    <Text style={styles.faqQuestion}>Q: {faq.question}</Text>
                    <Text style={styles.faqAnswer}>A: {faq.answer}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Contact Support */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Contact Support</Text>
        {contactOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.contactOption}
            onPress={option.onPress}
            activeOpacity={0.8}
          >
            <View style={styles.contactIconContainer}>
              <Ionicons name={option.icon} size={24} color={C.brand} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>{option.title}</Text>
              <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={C.dim} />
          </TouchableOpacity>
        ))}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Social Vibing App v1.0.0</Text>
          <Text style={[styles.appInfoText, { fontSize: 12, marginTop: 4 }]}>
            © 2026 Social Vibing. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  welcomeCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginTop: 16,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: C.dim,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
  },
  faqSection: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    marginLeft: 12,
  },
  faqContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    color: C.dim,
    lineHeight: 20,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  contactSubtitle: {
    fontSize: 14,
    color: C.dim,
    marginTop: 2,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  appInfoText: {
    fontSize: 14,
    color: C.dim,
  },
});

export default HelpCenterScreen;
