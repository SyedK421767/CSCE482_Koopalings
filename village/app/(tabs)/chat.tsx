import { FlatList, StyleSheet, Text, View } from 'react-native';

const messages = [
  { id: '1', sender: 'Alex', body: 'Hey everyone!' },
  { id: '2', sender: 'Jordan', body: 'Welcome to the village chat.' },
  { id: '3', sender: 'Taylor', body: 'Anyone joining the event later?' },
];

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.messageCard}>
            <Text style={styles.sender}>{item.sender}</Text>
            <Text style={styles.body}>{item.body}</Text>
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
  messageCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  sender: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    fontSize: 15,
    color: '#374151',
  },
});
