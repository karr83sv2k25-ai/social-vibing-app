// screens/AdminPanelScreen.js - King Media Admin Panel WebView
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function AdminPanelScreen() {
    return (
        <View style={styles.container}>
            <WebView
                source={{ uri: 'https://beige-crane-665569.hostingersite.com/admin' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
});
