import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function WhatsHappening({ navigation }) {
  const memberCategories = [
    {
      title: 'Admins',
      members: [
        { id: '1', name: 'JazzeeBlaze', avatar: require('./assets/join1.png') },
        { id: '2', name: 'Lucifer', avatar: require('./assets/join1.png') },
      ]
    },
    {
      title: 'Moderators',
      members: [
        { id: '3', name: 'Thunder', avatar: require('./assets/join1.png') },
        { id: '4', name: 'Rambo', avatar: require('./assets/join1.png') },
        { id: '5', name: 'Malinga', avatar: require('./assets/join1.png') },
      ]
    },
    {
      title: 'Recently Joined',
      members: [
        { id: '6', name: 'Shah Rukh Khan', avatar: require('./assets/join1.png') },
        { id: '7', name: 'Mikey', avatar: require('./assets/join1.png') },
        { id: '8', name: 'Roronoa Zoro', avatar: require('./assets/join1.png') },
        { id: '9', name: 'Tony Chopper', avatar: require('./assets/join1.png') },
      ]
    }
  ];

  const onlineMembers = [
    { id: '1', name: 'Lucifer', avatar: require('./assets/join1.png') },
    { id: '2', name: 'Thunder', avatar: require('./assets/join1.png') },
    { id: '3', name: 'Rambo', avatar: require('./assets/join1.png') },
    { id: '4', name: 'Zero', avatar: require('./assets/join1.png') },
    { id: '5', name: 'Sang', avatar: require('./assets/join1.png') },
    { id: '6', name: 'JinBai', avatar: require('./assets/join1.png') },
  ];

  const activities = [
    {
      id: '1',
      type: 'Chatting',
      members: 17,
      memberAvatars: [...Array(8)].map(() => require('./assets/join1.png')),
      bgColor: '#0D8F8F'
    },
    {
      id: '2',
      type: 'Live Chatting',
      members: 12,
      memberAvatars: [...Array(8)].map(() => require('./assets/join1.png')),
      bgColor: '#8B2EF0'
    },
    {
      id: '3',
      type: 'Reading Posts',
      members: 21,
      memberAvatars: [...Array(8)].map(() => require('./assets/join1.png')),
      bgColor: '#0D8F8F'
    },
    {
      id: '4',
      type: 'Browsing',
      members: 18,
      memberAvatars: [...Array(8)].map(() => require('./assets/join1.png')),
      bgColor: '#8B2EF0'
    }
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What's Happening Now</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Online Members Section */}
        <View style={styles.onlineSection}>
          <Text style={styles.sectionTitle}>Online Members</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
            {onlineMembers.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <Image source={member.avatar} style={styles.onlineAvatar} />
                <Text style={styles.memberName}>{member.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Activity Cards */}
        <View style={styles.activitiesContainer}>
          {activities.map((activity) => (
            <View 
              key={activity.id} 
              style={[styles.activityCard, { backgroundColor: activity.bgColor }]}
            >
              <View style={styles.activityContent}>
                <View>
                  <Text style={styles.activityType}>{activity.type}</Text>
                  <View style={styles.avatarsRow}>
                    {activity.memberAvatars.slice(0, 5).map((avatar, index) => (
                      <Image
                        key={index}
                        source={avatar}
                        style={[
                          styles.memberAvatar,
                          { marginLeft: index > 0 ? -10 : 0 }
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.memberCount}>{activity.members}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Member Categories */}
        <View style={styles.memberCategories}>
          {memberCategories.map((category) => (
            <View key={category.title} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              {category.members.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Image source={member.avatar} style={styles.memberRowAvatar} />
                    <Text style={styles.memberRowName}>{member.name}</Text>
                  </View>
                  <TouchableOpacity style={styles.followButton}>
                    <Text style={styles.followButtonText}>Follow</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    color: '#8B2EF0',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  onlineSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  membersScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  memberItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  onlineAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#8B2EF0',
  },
  memberName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  activitiesContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
  },
  activityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  memberCategories: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberRowName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  followButton: {
    backgroundColor: '#8B2EF0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});