import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

type Post = {
  postid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
};

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

const fetchPosts = async () => {
  try {
    const response = await fetch(`${API_URL}/posts`);
    const data = await response.json();
    console.log('First post:', JSON.stringify(data[0]));  // add this
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#111827" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.postid.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.postCard} onPress={() => setSelectedPost(item)}>
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              )}
              <Text style={styles.postTitle}>{item.title}</Text>
              <Text style={styles.postAuthor}>by {item.displayname}</Text>
              <Text style={styles.postDetail}>📍 {item.location}</Text>
              <Text style={styles.postDetail}>
                🕐 {item.start_time ? new Date(item.start_time.replace('Z', '')).toLocaleString() : 'No time set'}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={selectedPost !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedPost(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={() => setSelectedPost(null)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>

            {selectedPost && (
              <>
                {selectedPost.image_url && (
                  <Image source={{ uri: selectedPost.image_url }} style={styles.modalImage} />
                )}
                <Text style={styles.modalTitle}>{selectedPost.title}</Text>
                <Text style={styles.modalAuthor}>by {selectedPost.displayname}</Text>

                <View style={styles.divider} />

                <Text style={styles.modalDetail}>📍 {selectedPost.location}</Text>
                <Text style={styles.modalDetail}>
                  🕐 {selectedPost.start_time ? new Date(selectedPost.start_time.replace('Z', '')).toLocaleString() : 'No time set'}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.descriptionLabel}>About this event</Text>
                <Text style={styles.description}>
                  {selectedPost.description || 'No description provided.'}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 10,
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
  postDetail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6b7280',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalAuthor: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginVertical: 12,
  },
  modalDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
});