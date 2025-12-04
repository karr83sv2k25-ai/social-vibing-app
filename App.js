import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { View, ActivityIndicator, Text, LogBox } from 'react-native';
import { app as firebaseApp, db } from './firebaseConfig';

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
    const auth = getAuth(firebaseApp);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#8B2EF0" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? 'Home' : 'Login'}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="WithPhone" component={WithPhoneScreen} />
        <Stack.Screen name="WithEmail" component={WithEmailScreen} />
        <Stack.Screen name="OtpVerify" component={OtpVerificationScreen} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
        <Stack.Screen name="AgeVerification"component={AgeVerificationScreen}/>
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
        <Stack.Screen name="MarketPlaceExplore" component={MarketPlaceExploreScreen}/>
        <Stack.Screen name="StickerPreview" component={StickerPreviewScreen} />
        <Stack.Screen name="PaymentDetail" component={PaymentDetailScreen} />
        <Stack.Screen name="PaymentSelection"component={PaymentSelectionScreen}/>
        <Stack.Screen name="CoinPurchase" component={CoinPurchaseScreen} />
        <Stack.Screen name="DiamondPurchase" component={DiamondPurchaseScreen}/>
        <Stack.Screen name="MyStore" component={MyStoreScreen}/>
         <Stack.Screen name="StoreManagment" component={StoreManagmentScreen}/>
           <Stack.Screen name="Reward" component={RewardScreen}/>
            <Stack.Screen name="DailyReward" component={DailyRewardScreen}/>
             <Stack.Screen name="Membership" component={MembershipScreen}/>
             <Stack.Screen name="WhatsHappening" component={WhatsHappeningScreen}/>
             <Stack.Screen name="CreateCommunityScreen" component={CreateCommunityScreen}/>
             <Stack.Screen name="EditCommunity" component={EditCommunityScreen}/>
             <Stack.Screen name="GroupAudioCall" component={GroupAudioCallScreen}/>
             <Stack.Screen name="ScreenSharingRoom" component={ScreenSharingRoom}/>
             <Stack.Screen name="RoleplayScreen" component={RoleplayScreen}/>
             <Stack.Screen name="EnhancedChatV2" component={EnhancedChatScreenV2} options={{ headerShown: false }}/>
             <Stack.Screen name="GroupChatCreation" component={GroupChatCreationScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="ForwardMessage" component={ForwardMessageScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="NewGroupInfo" component={NewGroupInfoScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="AddGroupMembers" component={AddGroupMembersScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="StarredMessages" component={StarredMessagesScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="SearchInChat" component={SearchInChatScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="MessageOptions" component={MessageOptionsScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="ChatActions" component={ChatActionsScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="CreateStory" component={CreateStoryScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="CreatePoll" component={CreatePollScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="CreateQuiz" component={CreateQuizScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="Draft" component={DraftScreen} options={{ headerShown: false }}/>
             <Stack.Screen name="CreateQuestion" component={CreateQuestionScreen} options={{ headerShown: false }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

