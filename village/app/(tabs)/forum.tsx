import { FlatList, StyleSheet, Text, View } from 'react-native';

const posts = [
  { id: '1', title: 'Welcome to the village', author: 'Sandali' },
  { id: '2', title: 'Sports event', author: 'Sandali S' },
  { id: '3', title: 'This is so fun', author: 'sand' },
];

export default function ForumScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forum</Text>
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
