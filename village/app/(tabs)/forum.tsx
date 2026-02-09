import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const initialPosts = [
  { id: '1', title: 'Welcome to the village', author: 'Sandali' },
  { id: '2', title: 'Sports event', author: 'Sandali S' },
  { id: '3', title: 'This is so fun', author: 'sand' },
];

export default function ForumScreen() {
  const [posts, setPosts] = useState(initialPosts);
  const [eventTitle, setEventTitle] = useState('');
  const [eventAuthor, setEventAuthor] = useState('');

  const handleAddEvent = () => {
    if (!eventTitle.trim() || !eventAuthor.trim()) return;

    setPosts((currentPosts) => [
      {
        id: Date.now().toString(),
        title: eventTitle.trim(),
        author: eventAuthor.trim(),
      },
      ...currentPosts,
    ]);

    setEventTitle('');
    setEventAuthor('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forum</Text>
      <View style={styles.form}>
        <TextInput
          value={eventTitle}
          onChangeText={setEventTitle}
          placeholder="Event title"
          style={styles.input}
        />
        <TextInput
          value={eventAuthor}
          onChangeText={setEventAuthor}
          placeholder="Posted by"
          style={styles.input}
        />
        <Pressable style={styles.button} onPress={handleAddEvent}>
          <Text style={styles.buttonText}>Add Event</Text>
        </Pressable>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postAuthor}>by {item.author}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 64,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 16,
  },
  form: {
    gap: 10,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  postCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  postAuthor: {
    fontSize: 14,
    color: '#4b5563',
  },
});
