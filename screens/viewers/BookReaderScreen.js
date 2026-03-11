// screens/viewers/BookReaderScreen.js - PDF/EPUB book reader
import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {WebView} from 'react-native-webview';
import {getDoc, doc} from 'firebase/firestore';
import {db} from '../../firebaseConfig';

const BG = '#2C2C2E';
const TEXT = '#FFFFFF';
const ACCENT = '#7C3AED';
const CARD = '#3A3A3C';

export default function BookReaderScreen({route, navigation}) {
  const {productId} = route.params;
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);

  useEffect(() => {
    fetchBook();
  }, []);

  const fetchBook = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const productData = productDoc.data();
        setBook(productData);
      } else {
        Alert.alert('Error', 'Book not found');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
      }
    } catch (error) {
      console.error('Error loading book:', error);
      Alert.alert('Error', 'Failed to load book');
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar');
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewError = (syntheticEvent) => {
    const {nativeEvent} = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setWebViewError(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading book...</Text>
      </View>
    );
  }

  if (!book || !book.bookConfig || !book.bookConfig.fileUrl) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="book-outline" size={64} color={TEXT} />
        <Text style={styles.errorText}>Book content not available</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (webViewError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {book.title}
          </Text>
          <View style={{width: 40}} />
        </View>

        <View style={[styles.centerContent, {flex: 1}]}>
          <Ionicons name="alert-circle-outline" size={64} color={TEXT} />
          <Text style={styles.errorText}>
            Unable to display this format in the app
          </Text>
          <Text style={styles.errorSubtext}>
            {book.bookConfig.format === 'pdf' ?
              'PDF viewing requires a compatible PDF reader' :
              'This format is not supported'}
          </Text>

          {book.bookConfig.downloadUrl && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => {
                Alert.alert(
                  'Download Book',
                  'Open in external app or browser?',
                  [
                    {text: 'Cancel', style: 'cancel'},
                    {
                      text: 'Open',
                      onPress: () => {
                        // In a real app, use Linking.openURL
                        Alert.alert('Info', 'Download functionality coming soon');
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons name="download-outline" size={20} color={TEXT} />
              <Text style={styles.downloadButtonText}>Download Book</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabBar')}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT} />
  </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {book.title}
        </Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Book Info',
              `${book.title}\n\nAuthor: ${book.bookConfig?.author || 'Unknown'}\n\nFormat: ${book.bookConfig?.format?.toUpperCase() || 'Unknown'}\n\nPages: ${book.bookConfig?.pageCount || 'N/A'}`,
            );
          }}
          style={styles.headerButton}
        >
          <Ionicons name="information-circle-outline" size={24} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* Book Content */}
      <WebView
        source={{uri: book.bookConfig.fileUrl}}
        style={styles.webView}
        onError={handleWebViewError}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        )}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT,
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: TEXT,
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: ACCENT,
    borderRadius: 8,
  },
  backButtonText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  downloadButtonText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: BG,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },
});
