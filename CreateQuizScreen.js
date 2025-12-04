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

export default function CreateQuizScreen({ navigation }) {
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState([
    {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
    },
  ]);
  const [isPosting, setIsPosting] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const addQuestion = () => {
    if (questions.length < 20) {
      setQuestions([
        ...questions,
        {
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
        },
      ]);
    } else {
      Alert.alert('Limit Reached', 'Maximum 20 questions allowed');
    }
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    } else {
      Alert.alert('Minimum Required', 'At least 1 question is required');
    }
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (questionIndex, optionIndex, text) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = text;
    setQuestions(newQuestions);
  };

  const selectCorrectAnswer = (questionIndex, optionIndex) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].correctAnswer = optionIndex;
    setQuestions(newQuestions);
  };

  const publishQuiz = async () => {
    if (!quizTitle.trim()) {
      Alert.alert('Error', 'Please enter a quiz title');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question.trim()) {
        Alert.alert('Error', `Please enter text for question ${i + 1}`);
        return;
      }
      
      const filledOptions = questions[i].options.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2) {
        Alert.alert('Error', `Question ${i + 1} needs at least 2 options`);
        return;
      }
    }

    setIsPosting(true);
    try {
      const quizData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        title: quizTitle,
        questions: questions.map(q => ({
          question: q.question,
          options: q.options.filter(opt => opt.trim() !== ''),
          correctAnswer: q.correctAnswer,
        })),
        attempts: 0,
        likes: 0,
        likedBy: [],
        comments: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: 'quiz',
        scope: 'global',
      };

      await addDoc(collection(db, 'quizzes'), quizData);
      
      Alert.alert('Success', 'Quiz created successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating quiz:', error);
      Alert.alert('Error', 'Failed to create quiz. Please try again.');
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
        <Text style={styles.headerTitle}>Create Quiz</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Quiz Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Quiz Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter quiz title..."
            placeholderTextColor="#666"
            value={quizTitle}
            onChangeText={setQuizTitle}
            maxLength={100}
          />
        </View>

        {/* Questions */}
        {questions.map((q, qIndex) => (
          <View key={qIndex} style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionNumber}>Question {qIndex + 1}</Text>
              {questions.length > 1 && (
                <TouchableOpacity onPress={() => removeQuestion(qIndex)}>
                  <Ionicons name="trash-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
            </View>

            {/* Question Text */}
            <TextInput
              style={styles.questionInput}
              placeholder="Enter your question..."
              placeholderTextColor="#666"
              value={q.question}
              onChangeText={(text) => updateQuestion(qIndex, 'question', text)}
              maxLength={200}
              multiline
            />

            {/* Options */}
            <Text style={styles.optionsLabel}>Options (tap to select correct answer)</Text>
            {q.options.map((option, oIndex) => (
              <View key={oIndex} style={styles.optionRow}>
                <TouchableOpacity
                  style={[
                    styles.correctButton,
                    q.correctAnswer === oIndex && styles.correctButtonActive,
                  ]}
                  onPress={() => selectCorrectAnswer(qIndex, oIndex)}
                >
                  <Ionicons
                    name={q.correctAnswer === oIndex ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={q.correctAnswer === oIndex ? '#00FF00' : '#666'}
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.optionInput}
                  placeholder={`Option ${oIndex + 1}`}
                  placeholderTextColor="#666"
                  value={option}
                  onChangeText={(text) => updateOption(qIndex, oIndex, text)}
                  maxLength={100}
                />
              </View>
            ))}
          </View>
        ))}

        {/* Add Question Button */}
        {questions.length < 20 && (
          <TouchableOpacity style={styles.addQuestionButton} onPress={addQuestion}>
            <Ionicons name="add-circle-outline" size={24} color="#08FFE2" />
            <Text style={styles.addQuestionText}>Add Question</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer - Publish Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.publishButton, isPosting && styles.publishButtonDisabled]}
          onPress={publishQuiz}
          disabled={isPosting}
        >
          {isPosting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.publishButtonText}>Publish Quiz</Text>
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
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  titleInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  questionCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#08FFE2',
  },
  questionInput: {
    backgroundColor: '#000',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  optionsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  correctButton: {
    marginRight: 12,
  },
  correctButtonActive: {
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 12,
    padding: 2,
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#000',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    marginBottom: 16,
  },
  addQuestionText: {
    marginLeft: 8,
    color: '#08FFE2',
    fontSize: 16,
    fontWeight: '600',
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
