import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function CreatePollScreen({ navigation }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isPosting, setIsPosting] = useState(false);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    } else {
      Alert.alert('Limit Reached', 'Maximum 10 options allowed');
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      Alert.alert('Minimum Required', 'At least 2 options are required');
    }
  };

  const updateOption = (index, text) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const publishPoll = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const filledOptions = options.filter(opt => opt.trim() !== '');
    if (filledOptions.length < 2) {
      Alert.alert('Error', 'Please add at least 2 options');
      return;
    }

    setIsPosting(true);
    try {
      const pollData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        question: question,
        options: filledOptions.map(opt => ({
          text: opt,
          votes: 0,
          voters: [],
        })),
        totalVotes: 0,
        allowMultipleAnswers: allowMultipleAnswers,
        likes: 0,
        likedBy: [],
        comments: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: 'poll',
        scope: 'global',
      };

      await addDoc(collection(db, 'polls'), pollData);
      
      Alert.alert('Success', 'Poll created successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Poll</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Question Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Question</Text>
          <TextInput
            style={styles.questionInput}
            placeholder="Ask a question..."
            placeholderTextColor="#666"
            value={question}
            onChangeText={setQuestion}
            maxLength={200}
            multiline
          />
        </View>

        {/* Options */}
        <View style={styles.section}>
          <Text style={styles.label}>Options</Text>
          {options.map((option, index) => (
            <View key={index} style={styles.optionContainer}>
              <View style={styles.optionNumber}>
                <Text style={styles.optionNumberText}>{index + 1}</Text>
              </View>
              <TextInput
                style={styles.optionInput}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="#666"
                value={option}
                onChangeText={(text) => updateOption(index, text)}
                maxLength={100}
              />
              {options.length > 2 && (
                <TouchableOpacity
                  onPress={() => removeOption(index)}
                  style={styles.removeOptionButton}
                >
                  <Ionicons name="close-circle" size={24} color="#FF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Add Option Button */}
          {options.length < 10 && (
            <TouchableOpacity style={styles.addOptionButton} onPress={addOption}>
              <Ionicons name="add-circle-outline" size={24} color="#08FFE2" />
              <Text style={styles.addOptionText}>Add Option</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.label}>Settings</Text>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setAllowMultipleAnswers(!allowMultipleAnswers)}
          >
            <View>
              <Text style={styles.settingTitle}>Allow multiple answers</Text>
              <Text style={styles.settingDescription}>
                Let people choose more than one option
              </Text>
            </View>
            <View
              style={[
                styles.switch,
                allowMultipleAnswers && styles.switchActive,
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  allowMultipleAnswers && styles.switchThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer - Publish Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.publishButton, isPosting && styles.publishButtonDisabled]}
          onPress={publishPoll}
          disabled={isPosting}
        >
          {isPosting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.publishButtonText}>Create Poll</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  questionInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionNumberText: {
    color: '#08FFE2',
    fontWeight: 'bold',
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  removeOptionButton: {
    marginLeft: 8,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginTop: 8,
  },
  addOptionText: {
    marginLeft: 8,
    color: '#08FFE2',
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 12,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#08FFE2',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  publishButton: {
    backgroundColor: '#08FFE2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
