import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const API_URL = 'http://10.247.66.130:3000';

type Post = {
  postid: number;
  title: string;
  username: string;
};

export default function ForumScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');
  const [eventAuthor, setEventAuthor] = useState('');

  const fetchPosts = async () => {
    try {
      const response = await fetch(`${API_URL}/posts`);
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleAddEvent = async () => {
    if (!eventTitle.trim() || !eventAuthor.trim()) return;

    try {
      await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: 1,
          title: eventTitle.trim(),
          description: '',
          location: '',
        }),
      });
      setEventTitle('');
      setEventAuthor('');
      fetchPosts();
    } catch (err) {
      console.error('Failed to add post:', err);
    }
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
      {loading ? (
        <ActivityIndicator size="large" color="#111827" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.postid.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <Text style={styles.postTitle}>{item.title}</Text>
              <Text style={styles.postAuthor}>by {item.username}</Text>
            </View>
          )}
        />
      )}
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