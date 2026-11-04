import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.heading}>AI Voice Textbook Tutor</Text>
        <Text style={styles.subtitle}>Learn from your textbook</Text>
        <Text style={styles.body}>
          Classes 9–12 • Physics • Chemistry • Biology • Mathematics
        </Text>
        <Text style={styles.note}>
          Voice tutoring, chapter questions and quizzes are coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FC' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  heading: { fontSize: 28, fontWeight: '700', color: '#202B4B', marginBottom: 12 },
  subtitle: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: '#3C465E' },
  note: { marginTop: 28, fontSize: 15, color: '#69758B' },
});
