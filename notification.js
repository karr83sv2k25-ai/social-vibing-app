import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const notifications = [
  {
    id: 1,
    type: 'comment',
    userName: 'Aegon_10',
    action: 'commented on your post',
    profileImage: require('./assets/posticon.jpg'),
    postImage: require('./assets/post1.1.jpg'),
  },
  {
    id: 2,
    type: 'like',
    userName: 'Jon Snow',
    action: 'liked your post',
    profileImage: require('./assets/post3.3.jpg'),
    postImage: require('./assets/post3.4.jpg'),
  },
  {
    id: 3,
    type: 'follow',
    userName: 'Arya Stark',
    profileImage: require('./assets/post3.3.jpg'),
  },
];

export default function NotificationScreen({ navigation }) {
  const renderNotification = ({ item }) => {
    if (item.type === 'follow') {
      return (
        <View style={styles.notificationItem}>
          <Image source={item.profileImage} style={styles.profileImage} />
          <View style={styles.textContainer}>
            <Text style={styles.notificationText}>
              <Text style={styles.userName}>{item.userName} </Text>
              started following you
            </Text>
          </View>
          <TouchableOpacity>
            <LinearGradient
              colors={['rgba(162,162,162,0.25)', 'rgba(255,251,251,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.followButton}
            >
              <Text style={styles.followButtonText}>Follow</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.notificationItem}>
        <Image source={item.profileImage} style={styles.profileImage} />
        <View style={styles.textContainer}>
          <Text style={styles.notificationText}>
            <Text style={styles.userName}>{item.userName} </Text>
            {item.action}
          </Text>
        </View>
        {item.postImage && <Image source={item.postImage} style={styles.postImage} />}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Notification</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Today Section */}
      <Text style={styles.sectionTitle}>Today</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => `today-${item.id}`}
        renderItem={renderNotification}
        scrollEnabled={false}
      />

      {/* Yesterday Section */}
      <Text style={styles.sectionTitle}>Yesterday</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => `yesterday-${item.id}`}
        renderItem={renderNotification}
        scrollEnabled={false}
      />

      {/* Last Week Section */}
      <Text style={styles.sectionTitle}>Last Week</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => `lastweek-${item.id}`}
        renderItem={renderNotification}
        scrollEnabled={false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  heading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#08FFE2',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    marginTop: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
  },
  userName: {
    fontWeight: 'bold',
    color: '#fff',
  },
  postImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  followButton: {
    width: 68,
    height: 26,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
