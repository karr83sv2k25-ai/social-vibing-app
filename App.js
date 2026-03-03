import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { View, ActivityIndicator, Text, LogBox, AppState, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { app as firebaseApp, db } from './firebaseConfig';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { StatusProvider } from './contexts/StatusContext';
import { WalletProvider } from './context/WalletContext';
import ErrorBoundary from './components/ErrorBoundary';
import { isExpoGo } from './utils/platformCheck';
// import './testFirebaseREST';
// import './diagnoseFirestore';

// Prevent the native splash screen from auto-hiding before app is ready
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// Core screens (always loaded)
import LoginScreen from './loginscreen';
import SignupScreen from './signupscreen';
import HomeScreen from './homescreen';
import TabBarScreen from './tabbarview';

// Direct-import screens (small / always needed)
import MessageOptionsScreen from './MessageOptionsScreen';
import ChatActionsScreen from './ChatActionsScreen';
import BlockedUsersScreen from './BlockedUsersScreen';
import AccountSettingsScreen from './AccountSettingsScreen';
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
import CommunityStaffScreen from './CommunityStaffScreen';
import CommunityModerationScreen from './CommunityModerationScreen';

// Product Viewer Screens
import ComicReaderScreen from './screens/viewers/ComicReaderScreen';
import BookReaderScreen from './screens/viewers/BookReaderScreen';
import ArtViewerScreen from './screens/viewers/ArtViewerScreen';
import StickerPackViewerScreen from './screens/viewers/StickerPackViewerScreen';
import CustomizationScreen from './screens/viewers/CustomizationScreen';

// Marketplace Screens
import BecomeSellerScreen from './screens/marketplace/BecomeSellerScreen';
import SellerDashboardScreen from './screens/marketplace/SellerDashboardScreen';
import ProductCreationWizardScreen from './screens/marketplace/ProductCreationWizardScreen';
import MyOrdersScreen from './screens/marketplace/MyOrdersScreen';
import WalletScreen from './screens/marketplace/WalletScreen';
import WithdrawalScreen from './screens/marketplace/WithdrawalScreen';
import ProductTypeSelectionScreen from './screens/marketplace/ProductTypeSelectionScreen';
import TypeSpecificUploadScreen from './screens/marketplace/TypeSpecificUploadScreen';
import ProductPublishScreen from './screens/marketplace/ProductPublishScreen';
import BubbleCustomizerScreen from './screens/marketplace/BubbleCustomizerScreen';
import FrameCustomizerScreen from './screens/marketplace/FrameCustomizerScreen';
import SellerStoreScreen from './screens/marketplace/SellerStoreScreen';

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
  'No suitable URL request handler found for blob:',
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

// HOC that wraps any lazy-loaded screen with a Suspense boundary.
// Must be defined before any withLazy() calls below.
const withLazy = (importFn) => {
  const LazyComp = React.lazy(importFn);
  // React.memo prevents re-rendering the Suspense tree when unrelated parent state changes.
  const Wrapped = React.memo((props) => (
    <React.Suspense fallback={
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
      </View>
    }>
      <LazyComp {...props} />
    </React.Suspense>
  ));
  return Wrapped;
};

// Lazy load all other screens (each wrapped with Suspense via withLazy)
const WithPhoneScreen = withLazy(() => import('./withphonescreen'));
const WithEmailScreen = withLazy(() => import('./withemailscreen'));
const OtpVerificationScreen = withLazy(() => import('./otpverify'));
const CreateAccountScreen = withLazy(() => import('./createaccount'));
const AgeVerificationScreen = withLazy(() => import('./ageverification'));
const AccountLoginScreen = withLazy(() => import('./accountloginscreen'));
const ForgotPasswordScreen = withLazy(() => import('./ForgotPasswordScreen'));
const SplashScreen = withLazy(() => import('./splashscreen'));
const SearchBarScreen = withLazy(() => import('./searchbar'));
const NotificationScreen = withLazy(() => import('./notification'));
const CommunityScreen = withLazy(() => import('./community'));
const CommunityDetailScreen = withLazy(() => import('./communitydetail'));
const ExploreScreen = withLazy(() => import('./explore'));
const GroupInfoScreen = withLazy(() => import('./groupinfo'));
const MessageScreen = withLazy(() => import('./messagescreen'));
const ChatScreen = withLazy(() => import('./chatscreen'));
const MarketPlaceScreen = withLazy(() => import('./marketplace'));
const MarketPlaceExploreScreen = withLazy(() => import('./marketplaceexplore'));
const ProductDetailScreen = withLazy(() => import('./screens/marketplace/ProductDetailScreen'));
const ComicsLibraryScreen = withLazy(() => import('./ComicsLibraryScreen'));
const GenericLibraryScreen = withLazy(() => import('./GenericLibraryScreen'));
const StickerPreviewScreen = withLazy(() => import('./stickerpreview'));
const PaymentDetailScreen = withLazy(() => import('./paymentdetail'));
const PaymentSelectionScreen = withLazy(() => import('./paymentselection'));
const CoinPurchaseScreen = withLazy(() => import('./coinpurchase'));
const DiamondPurchaseScreen = withLazy(() => import('./diamondpurchase'));
const ProfileScreen = withLazy(() => import('./profile'));
const EditProfileScreen = withLazy(() => import('./editprofile'));
const MyStoreScreen = withLazy(() => import('./mystore'));
const StoreManagmentScreen = withLazy(() => import('./storemanagment'));
const RewardScreen = withLazy(() => import('./reward'));
const DailyRewardScreen = withLazy(() => import('./dailyreward'));
const MembershipScreen = withLazy(() => import('./membership'));
const CommunityLeaderboardScreen = withLazy(() => import('./screens/CommunityLeaderboardScreen'));
const GlobalLeaderboardScreen = withLazy(() => import('./screens/GlobalLeaderboardScreen'));
const CommunityCheckInScreen = withLazy(() => import('./screens/CommunityCheckInScreen'));
const WhatsHappeningScreen = withLazy(() => import('./whatshappening'));
const CreateCommunityScreen = withLazy(() => import('./CreateCommunityScreen'));
const EditCommunityScreen = withLazy(() => import('./EditCommunityScreen'));
const ModeratorsManagementScreen = withLazy(() => import('./ModeratorsManagementScreen'));

// Conditional loading for screens that require native modules (Agora)
// These screens will only work in development builds, not in Expo Go
const GroupAudioCallScreen = withLazy(() => 
  isExpoGo() 
    ? import('./screens/ExpoGoPlaceholderScreen').then(module => ({
        default: (props) => <module.default {...props} feature="Voice Calls" />
      }))
    : import('./GroupAudioCallScreen')
);

const CallScreen = withLazy(() => 
  isExpoGo()
    ? import('./screens/ExpoGoPlaceholderScreen').then(module => ({
        default: (props) => <module.default {...props} feature="Voice/Video Calls" />
      }))
    : import('./CallScreen')
);

const ScreenSharingRoom = withLazy(() => import('./ScreenSharingRoom'));
const RoleplayScreen = withLazy(() => import('./RoleplayScreen'));
const EnhancedChatScreenV2 = withLazy(() => import('./screens/EnhancedChatScreenV2'));
const GroupChatCreationScreen = withLazy(() => import('./screens/GroupChatCreationScreen'));
const ChatSettingsScreen = withLazy(() => import('./screens/ChatSettingsScreen'));
const ForwardMessageScreen = withLazy(() => import('./screens/ForwardMessageScreen'));
const AddFriendsScreen = withLazy(() => import('./AddFriendsScreen'));
const NewGroupInfoScreen = withLazy(() => import('./screens/GroupInfoScreen'));
const AddGroupMembersScreen = withLazy(() => import('./screens/AddGroupMembersScreen'));
const MediaGalleryScreen = withLazy(() => import('./screens/MediaGalleryScreen'));
const StarredMessagesScreen = withLazy(() => import('./screens/StarredMessagesScreen'));
const SearchInChatScreen = withLazy(() => import('./screens/SearchInChatScreen'));
const StoryViewerScreen = withLazy(() => import('./screens/StoryViewerScreen'));

const Stack = createStackNavigator();

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
        // Enforce admin moderation flags from users/{uid}
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnapshot = await getDoc(userRef);

          if (userSnapshot.exists()) {
            const userData = userSnapshot.data();

            // Auto-lift expired temporary bans
            if (userData?.isBanned && userData?.banExpiresAt) {
              const banExpiry = userData.banExpiresAt.toDate
                ? userData.banExpiresAt.toDate()
                : new Date(userData.banExpiresAt);

              if (banExpiry <= new Date()) {
                await updateDoc(userRef, {
                  isBanned: false,
                  banType: null,
                  banReason: null,
                  banExpiresAt: null,
                  updatedAt: serverTimestamp(),
                });
              }
            }

            const hasActiveBan = Boolean(
              userData?.isBanned &&
              (!userData?.banExpiresAt ||
                (userData.banExpiresAt.toDate
                  ? userData.banExpiresAt.toDate()
                  : new Date(userData.banExpiresAt)) > new Date())
            );

            const hasSuspension = Boolean(userData?.isSuspended);
            const hasRestrictedStatus = userData?.accountStatus === 'banned' || userData?.accountStatus === 'suspended';

            if (hasActiveBan || hasSuspension || hasRestrictedStatus) {
              const statusMessage = hasActiveBan
                ? (userData?.banReason || 'Your account has been restricted by an administrator.')
                : hasSuspension
                  ? (userData?.suspendedReason || userData?.suspensionReason || 'Your account is currently suspended by an administrator.')
                  : `Your account status is: ${userData?.accountStatus}. Please contact support.`;

              await auth.signOut();
              setUser(null);

              Alert.alert(
                'Account Restricted',
                statusMessage
              );

              if (initializing) {
                setInitializing(false);
              }

              return;
            }
          }
        } catch (moderationCheckError) {
          console.warn('⚠️ Moderation status check failed, continuing login flow:', moderationCheckError?.message);
        }

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
        setInitializing(false);
        // Hide splash screen once auth state is resolved
        ExpoSplashScreen.hideAsync().catch(() => {});
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
    // Keep splash screen visible — return null to avoid white flash
    return null;
  }

  return (
    <SafeAreaProvider>
    <ErrorBoundary>
    <WalletProvider>
      <StatusProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user == null ? (
              // Auth Screens - Only available when not authenticated
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen name="WithPhone" component={WithPhoneScreen} />
                <Stack.Screen name="WithEmail" component={WithEmailScreen} />
                <Stack.Screen name="OtpVerify" component={OtpVerificationScreen} />
                <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
                <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} />
                <Stack.Screen name="AccountLogin" component={AccountLoginScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              </>
            ) : (
              // App Screens - Only available when authenticated
              <>
                <Stack.Screen name="TabBar" component={TabBarScreen} />
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="SearchBar" component={SearchBarScreen} />
                <Stack.Screen name="Notification" component={NotificationScreen} />
                <Stack.Screen name="Community" component={CommunityScreen} />
                <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
                <Stack.Screen name="Explore" component={ExploreScreen} />
                <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
                <Stack.Screen name="Message" component={MessageScreen} />
                <Stack.Screen name="AddFriends" component={AddFriendsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                
                {/* Marketplace Screens */}
                <Stack.Screen name="MarketPlaceExplore" component={MarketPlaceExploreScreen} />
                <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="BecomeSeller" component={BecomeSellerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SellerStore" component={SellerStoreScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ProductTypeSelection" component={ProductTypeSelectionScreen} options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="ProductCreation" component={ProductCreationWizardScreen} options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="TypeSpecificUpload" component={TypeSpecificUploadScreen} options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="ProductPublish" component={ProductPublishScreen} options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="BubbleCustomizer" component={BubbleCustomizerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="FrameCustomizer" component={FrameCustomizerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Wallet" component={WalletScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Withdrawal" component={WithdrawalScreen} options={{ headerShown: false }} />
                
                {/* Library Screens */}
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
                
                {/* Product Viewer Screens */}
                <Stack.Screen name="ComicReader" component={ComicReaderScreen} options={{ headerShown: false }} />
                <Stack.Screen name="BookReader" component={BookReaderScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ArtViewer" component={ArtViewerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="StickerPackViewer" component={StickerPackViewerScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Customization" component={CustomizationScreen} options={{ headerShown: false }} />
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
                <Stack.Screen name="ModeratorsManagement" component={ModeratorsManagementScreen} options={{ headerShown: false }} />
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
                <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CreateStory" component={CreateStoryScreen} options={{ headerShown: false }} />
                <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ headerShown: false, presentation: 'transparentModal', cardStyle: { backgroundColor: 'transparent' } }} />
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
                <Stack.Screen name="CommunityStaff" component={CommunityStaffScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CommunityModeration" component={CommunityModerationScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CommunityLeaderboard" component={CommunityLeaderboardScreen} options={{ headerShown: false }} />
                <Stack.Screen name="GlobalLeaderboard" component={GlobalLeaderboardScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CommunityCheckIn" component={CommunityCheckInScreen} options={{ headerShown: false }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </StatusProvider>
    </WalletProvider>
    </ErrorBoundary>
    </SafeAreaProvider>
  );
}

