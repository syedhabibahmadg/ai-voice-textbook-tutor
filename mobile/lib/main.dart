import 'package:flutter/material.dart';

void main() => runApp(const TextbookTutorApp());

class TextbookTutorApp extends StatelessWidget {
  const TextbookTutorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AI Textbook Tutor',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const TutorHomePage(),
    );
  }
}

class TutorHomePage extends StatelessWidget {
  const TutorHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Voice Textbook Tutor')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Learn from your textbook', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            SizedBox(height: 12),
            Text('Classes 9–12 • Physics • Chemistry • Biology • Mathematics'),
            SizedBox(height: 24),
            Text('Voice tutoring, chapter questions and quizzes are coming soon.'),
          ],
        ),
      ),
    );
  }
}
