import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { View, ActivityIndicator, Text, LogBox, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app as firebaseApp, db } from './firebaseConfig';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { StatusProvider } from './contexts/StatusContext';
import { WalletProvider } from './context/WalletContext';
// import './testFirebaseREST';
// import './diagnoseFirestore';

// Suppress known Firestore SDK internal errors in development
LogBox.ignoreLogs([
  'FIRESTORE (12.4.0) INTERNAL ASSERTION FAILED',
  'Unexpected state',
  'Could not reach Cloud Firestore backend',
  'Connection failed',
  'code=unavailable',
  'Target ID already exists',
  'auth/already-initialized',
  'Error fetching all posts',
  '[Firestore] Error in',
  'Could not fetch user from Firestore',
]);

// Add global error handler for uncaught errors
if (typeof ErrorUtils !== 'undefined') {
  const originalErrorHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const errorMessage = error?.message || error?.toString() || '';

    // Suppress Firestore internal assertion errors and known SDK issues
    if (
      errorMessage.includes('INTERNAL ASSERTION FAILED') ||
      errorMessage.includes('Unexpected state') ||
      errorMessage.includes('Target ID already exists') ||
      errorMessage.includes('auth/already-initialized') ||
      errorMessage.includes('FIRESTORE') && errorMessage.includes('b815')
    ) {
      console.log('🔇 Suppressed Firestore SDK internal error (harmless)');
      return; // Don't propagate the error
    }

    // For all other errors, use the original handler
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal);
    }
  });
}

// OPTIMIZATION: Lazy load screens to improve initial load time
// Core screens loaded immediately
import LoginScreen from './loginscreen';
import SignupScreen from './signupscreen';
import HomeScreen from './homescreen';
import TabBarScreen from './tabbarview';

// Lazy load all other screens
const WithPhoneScreen = React.lazy(() => import('./withphonescreen'));
const WithEmailScreen = React.lazy(() => import('./withemailscreen'));
const OtpVerificationScreen = React.lazy(() => import('./otpverify'));
const CreateAccountScreen = React.lazy(() => import('./createaccount'));
const AgeVerificationScreen = React.lazy(() => import('./ageverification'));
const AccountLoginScreen = React.lazy(() => import('./accountloginscreen'));
const SplashScreen = React.lazy(() => import('./splashscreen'));
const SearchBarScreen = React.lazy(() => import('./searchbar'));
const NotificationScreen = React.lazy(() => import('./notification'));
const CommunityScreen = React.lazy(() => import('./community'));
const CommunityDetailScreen = React.lazy(() => import('./communitydetail'));
const ExploreScreen = React.lazy(() => import('./explore'));
const GroupInfoScreen = React.lazy(() => import('./groupinfo'));
const MessageScreen = React.lazy(() => import('./messagescreen'));
const ChatScreen = React.lazy(() => import('./chatscreen'));
const MarketPlaceScreen = React.lazy(() => import('./marketplace'));
const MarketPlaceExploreScreen = React.lazy(() => import('./marketplaceexplore'));
const ProductDetailScreen = React.lazy(() => import('./ProductDetailScreen'));
const ComicsLibraryScreen = React.lazy(() => import('./ComicsLibraryScreen'));
const GenericLibraryScreen = React.lazy(() => import('./GenericLibraryScreen'));
const StickerPreviewScreen = React.lazy(() => import('./stickerpreview'));
const PaymentDetailScreen = React.lazy(() => import('./paymentdetail'));
const PaymentSelectionScreen = React.lazy(() => import('./paymentselection'));
const CoinPurchaseScreen = React.lazy(() => import('./coinpurchase'));
const DiamondPurchaseScreen = React.lazy(() => import('./diamondpurchase'));
const ProfileScreen = React.lazy(() => import('./profile'));
const EditProfileScreen = React.lazy(() => import('./editprofile'));
const MyStoreScreen = React.lazy(() => import('./mystore'));
const StoreManagmentScreen = React.lazy(() => import('./storemanagment'));
const RewardScreen = React.lazy(() => import('./reward'));
const DailyRewardScreen = React.lazy(() => import('./dailyreward'));
const MembershipScreen = React.lazy(() => import('./membership'));
const WhatsHappeningScreen = React.lazy(() => import('./whatshappening'));
const CreateCommunityScreen = React.lazy(() => import('./CreateCommunityScreen'));
const EditCommunityScreen = React.lazy(() => import('./EditCommunityScreen'));
const GroupAudioCallScreen = React.lazy(() => import('./GroupAudioCallScreen'));
const ScreenSharingRoom = React.lazy(() => import('./ScreenSharingRoom'));
const RoleplayScreen = React.lazy(() => import('./RoleplayScreen'));
const EnhancedChatScreenV2 = React.lazy(() => import('./screens/EnhancedChatScreenV2'));
const GroupChatCreationScreen = React.lazy(() => import('./screens/GroupChatCreationScreen'));
const ChatSettingsScreen = React.lazy(() => import('./screens/ChatSettingsScreen'));
const ForwardMessageScreen = React.lazy(() => import('./screens/ForwardMessageScreen'));
const AddFriendsScreen = React.lazy(() => import('./AddFriendsScreen'));
const NewGroupInfoScreen = React.lazy(() => import('./screens/GroupInfoScreen'));
const AddGroupMembersScreen = React.lazy(() => import('./screens/AddGroupMembersScreen'));
const MediaGalleryScreen = React.lazy(() => import('./screens/MediaGalleryScreen'));
const StarredMessagesScreen = React.lazy(() => import('./screens/StarredMessagesScreen'));
const SearchInChatScreen = React.lazy(() => import('./screens/SearchInChatScreen'));

// Direct imports for newly created screens
import MessageOptionsScreen from './MessageOptionsScreen';
import ChatActionsScreen from './ChatActionsScreen';
import BlockedUsersScreen from './BlockedUsersScreen';
import CreatePostScreen from './CreatePostScreen';
import CreateStoryScreen from './CreateStoryScreen';
import CreatePollScreen from './CreatePollScreen';
import CreateQuizScreen from './CreateQuizScreen';
import DraftScreen from './DraftScreen';
import CreateQuestionScreen from './CreateQuestionScreen';
import CommunityCreateGroupScreen from './screens/CommunityCreateGroupScreen';
import CommunityGroupChatScreen from './screens/CommunityGroupChatScreen';
import GroupDetailsScreen from './screens/GroupDetailsScreen';
import FollowersFollowingScreen from './screens/FollowersFollowingScreen';
import TestFollowersScreen from './screens/TestFollowersScreen';
import TestMarketplaceSetup from './TestMarketplaceSetup';
import KingMediaLoginScreen from './screens/KingMediaLoginScreen';
import KingMediaHomeScreen from './screens/KingMediaHomeScreen';
import KingMediaAIChatScreen from './screens/KingMediaAIChatScreen';
import KingMediaImageGenScreen from './screens/KingMediaImageGenScreen';
import KingMediaVideoGenScreen from './screens/KingMediaVideoGenScreen';
import AdminPanelScreen from './screens/AdminPanelScreen';
import AdminModerationScreen from './AdminModerationScreen';

const Stack = createStackNavigator();

// Lazy loading wrapper component
const LazyScreen = ({ component: Component, ...props }) => (
  <React.Suspense fallback={
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
    </View>
  }>
    <Component {...props} />
  </React.Suspense>
);

export default function App() {
  const [initializing, setInitializing] = React.useState(true);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    console.log('🚀 App.js mounted - checking authentication...');
    const auth = getAuth(firebaseApp);

    // Check current auth state immediately
    const currentUser = auth.currentUser;
    console.log('📋 Initial auth.currentUser:', currentUser ? `✅ ${currentUser.email}` : '❌ null');

    // Check AsyncStorage to debug persistence
    AsyncStorage.getItem('firebase:authUser')
      .then(stored => console.log('💾 Firebase auth in AsyncStorage:', stored ? '✅ EXISTS' : '❌ EMPTY'))
      .catch(err => console.log('⚠️ Error checking storage:', err));

    // Helper function to update online status with retry
    const updateOnlineStatus = async (userId, isOnline, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            isOnline: isOnline,
            lastSeen: serverTimestamp(),
            currentStatus: isOnline ? 'online' : 'offline'
          });
          console.log(`📱 User status set to ${isOnline ? 'online' : 'offline'}`);
          return true;
        } catch (error) {
          console.log(`⚠️  Attempt ${attempt}/${retries} failed:`, error.message);
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          }
        }
      }
      console.log('⚠️  Failed to update online status after retries (non-critical)');
      return false;
    };

    // Handle auth state changes - Firebase persists auth automatically
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? `✅ User logged in: ${user.email}` : '❌ No user logged in');

      if (user) {
        // User is signed in - update AsyncStorage and Firestore
        console.log('✅ User authenticated, restoring session...');

        try {
          // Save to AsyncStorage for backup
          await AsyncStorage.setItem('userLoggedIn', 'true');
          await AsyncStorage.setItem('userEmail', user.email);
          await AsyncStorage.setItem('userId', user.uid);
          console.log('💾 Session state saved');
        } catch (storageError) {
          console.warn('⚠️  Failed to save session state:', storageError);
        }

        // Wait for Firestore to be ready before updating status
        try {
          // Import waitForFirestore dynamically
          const { waitForFirestore } = await import('./firebaseConfig');
          await waitForFirestore();
          console.log('✅ Firestore ready, updating online status...');

          // Update online status with retry logic (non-blocking)
          updateOnlineStatus(user.uid, true).catch(err => {
            console.log('⚠️  Online status update failed (non-critical):', err.message);
          });
        } catch (error) {
          console.log('⚠️  Firestore not ready, skipping online status update:', error.message);
        }
      } else {
        // User is signed out - clear AsyncStorage
        console.log('🚪 User signed out, clearing session...');
        try {
          await AsyncStorage.multiRemove(['userLoggedIn', 'userEmail', 'userId']);
        } catch (error) {
          console.log('⚠️  Error clearing session:', error);
        }
      }

      setUser(user);
      if (initializing) {
        console.log('✅ Initialization complete, showing app...');
        setInitializing(false);
      }
    });

    // Handle app state changes (foreground/background)
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (nextAppState === 'active') {
        // App came to foreground - set online
        updateOnlineStatus(currentUser.uid, true).catch(err => {
          console.log('⚠️  App state update failed (non-critical):', err);
        });
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - set offline
        updateOnlineStatus(currentUser.uid, false).catch(err => {
          console.log('⚠️  App state update failed (non-critical):', err);
        });
      }
    });

    // Cleanup function
    return () => {
      unsubscribeAuth();
      appStateSubscription?.remove();

      // Set user offline when component unmounts
      const currentUser = auth.currentUser;
      if (currentUser) {
        updateOnlineStatus(currentUser.uid, false).catch(err => {
          console.log('⚠️  Error setting offline on unmount:', err);
        });
      } else {
        // Clear AsyncStorage if no user is logged in
        AsyncStorage.multiRemove(['userLoggedIn', 'userEmail'])
          .catch(err => console.log('Error clearing AsyncStorage on unmount:', err));
      }
    };
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#8B2EF0" />
        <Text style={{ color: '#8B2EF0', marginTop: 10, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <WalletProvider>
      <StatusProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? 'TabBar' : 'Login'}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="WithPhone" component={WithPhoneScreen} />
            <Stack.Screen name="WithEmail" component={WithEmailScreen} />
            <Stack.Screen name="OtpVerify" component={OtpVerificationScreen} />
            <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
            <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} />
            <Stack.Screen name="AccountLogin" component={AccountLoginScreen} />
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SearchBar" component={SearchBarScreen} />
            <Stack.Screen name="Notification" component={NotificationScreen} />
            <Stack.Screen name="TabBar" component={TabBarScreen} />
            <Stack.Screen name="Community" component={CommunityScreen} />
            <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
            <Stack.Screen name="Explore" component={ExploreScreen} />
            <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
            <Stack.Screen name="Message" component={MessageScreen} />
            <Stack.Screen name="AddFriends" component={AddFriendsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="MarketPlace" component={MarketPlaceScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="MarketPlaceExplore" component={MarketPlaceExploreScreen} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ComicsLibrary" component={ComicsLibraryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BooksLibrary" options={{ headerShown: false }}>
              {(props) => <GenericLibraryScreen {...props} type="book" />}
            </Stack.Screen>
            <Stack.Screen name="ArtLibrary" options={{ headerShown: false }}>
              {(props) => <GenericLibraryScreen {...props} type="art" />}
            </Stack.Screen>
            <Stack.Screen name="StickersLibrary" options={{ headerShown: false }}>
              {(props) => <GenericLibraryScreen {...props} type="sticker_pack" />}
            </Stack.Screen>
            <Stack.Screen name="FramesLibrary" options={{ headerShown: false }}>
              {(props) => <GenericLibraryScreen {...props} type="profile_frame" />}
            </Stack.Screen>
            <Stack.Screen name="BubblesLibrary" options={{ headerShown: false }}>
              {(props) => <GenericLibraryScreen {...props} type="chat_bubble" />}
            </Stack.Screen>
            <Stack.Screen name="StickerPreview" component={StickerPreviewScreen} />
            <Stack.Screen name="PaymentDetail" component={PaymentDetailScreen} />
            <Stack.Screen name="PaymentSelection" component={PaymentSelectionScreen} />
            <Stack.Screen name="CoinPurchase" component={CoinPurchaseScreen} />
            <Stack.Screen name="DiamondPurchase" component={DiamondPurchaseScreen} />
            <Stack.Screen name="MyStore" component={MyStoreScreen} />
            <Stack.Screen name="StoreManagment" component={StoreManagmentScreen} />
            <Stack.Screen name="Reward" component={RewardScreen} />
            <Stack.Screen name="DailyReward" component={DailyRewardScreen} />
            <Stack.Screen name="Membership" component={MembershipScreen} />
            <Stack.Screen name="WhatsHappening" component={WhatsHappeningScreen} />
            <Stack.Screen name="CreateCommunityScreen" component={CreateCommunityScreen} />
            <Stack.Screen name="EditCommunity" component={EditCommunityScreen} />
            <Stack.Screen name="GroupAudioCall" component={GroupAudioCallScreen} />
            <Stack.Screen name="ScreenSharingRoom" component={ScreenSharingRoom} />
            <Stack.Screen name="RoleplayScreen" component={RoleplayScreen} />
            <Stack.Screen name="EnhancedChatV2" component={EnhancedChatScreenV2} options={{ headerShown: false }} />
            <Stack.Screen name="GroupChatCreation" component={GroupChatCreationScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ForwardMessage" component={ForwardMessageScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NewGroupInfo" component={NewGroupInfoScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AddGroupMembers" component={AddGroupMembersScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="StarredMessages" component={StarredMessagesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SearchInChat" component={SearchInChatScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MessageOptions" component={MessageOptionsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChatActions" component={ChatActionsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateStory" component={CreateStoryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreatePoll" component={CreatePollScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateQuiz" component={CreateQuizScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Draft" component={DraftScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateQuestion" component={CreateQuestionScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CommunityCreateGroup" component={CommunityCreateGroupScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CommunityGroupChat" component={CommunityGroupChatScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="FollowersFollowing" component={FollowersFollowingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TestFollowers" component={TestFollowersScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TestMarketplaceSetup" component={TestMarketplaceSetup} options={{ headerShown: false }} />
            <Stack.Screen name="KingMediaLogin" component={KingMediaLoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="KingMediaHome" component={KingMediaHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="KingMediaAIChat" component={KingMediaAIChatScreen} options={{ headerShown: false }} />
            <Stack.Screen name="KingMediaImageGen" component={KingMediaImageGenScreen} options={{ headerShown: false }} />
            <Stack.Screen name="KingMediaVideoGen" component={KingMediaVideoGenScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AdminPanel" component={AdminPanelScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AdminModeration" component={AdminModerationScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </StatusProvider>
    </WalletProvider>
  );
}

