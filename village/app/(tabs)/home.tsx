import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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
  const [activeTab, setActiveTab] = useState<'Events' | 'Hobbies'>('Events');

  const fetchPosts = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/posts`);
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, []);

  const homeHasLoadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const showSpinner = !homeHasLoadedOnce.current;
      homeHasLoadedOnce.current = true;
      void fetchPosts(showSpinner);
    }, [fetchPosts])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'Events' && styles.activeTabButton]}
          onPress={() => setActiveTab('Events')}>
          <Text style={[styles.tabText, activeTab === 'Events' && styles.activeTabText]}>Events</Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'Hobbies' && styles.activeTabButton]}
          onPress={() => setActiveTab('Hobbies')}>
          <Text style={[styles.tabText, activeTab === 'Hobbies' && styles.activeTabText]}>Hobbies</Text>
        </Pressable>
      </View>

      {activeTab === 'Events' ? (
        loading ? (
          <ActivityIndicator size="large" color="#111827" />
        ) : (
          <View style={styles.eventsContainer}>
            <Text style={styles.containerHeader}>Upcoming 📅</Text>
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
          </View>
        )
      ) : (
        <View style={styles.hobbiesContainer}>
          <Text style={styles.hobbiesText}>Pick a hobby</Text>
          <View style={styles.hobbiesGrid}>
            <Pressable style={styles.hobbyButton}>
              <Text style={styles.hobbyButtonText}>Sports ⚽️</Text>
            </Pressable>
            <Pressable style={styles.hobbyButton}>
              <Text style={styles.hobbyButtonText}>Gaming 🎮</Text>
            </Pressable>
            <Pressable style={styles.hobbyButton}>
              <Text style={styles.hobbyButtonText}>Music 🎵</Text>
            </Pressable>
            <Pressable style={styles.hobbyButton}>
              <Text style={styles.hobbyButtonText}>Art 🎨</Text>
            </Pressable>
            <Pressable style={styles.hobbyButton}>
              <Text style={styles.hobbyButtonText}>Fitness 💪</Text>
            </Pressable>
            <Pressable style={styles.hobbyButton}>
              <Text style={styles.hobbyButtonText}>Study 📚</Text>
            </Pressable>
          </View>
        </View>
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
    backgroundColor: '#e8f3f8',
    paddingTop: 64,
    paddingHorizontal: 10,
    alignContent: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    margin: 8,
    marginTop: 36,
    marginBottom: 36,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tabButton: {
    flex: 1,
    alignContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#7eacc3',
  },
  activeTabButton: {
    backgroundColor: '#fff',
  },
  tabText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#111',
  },
  eventsContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
  },
  containerHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  list: {
    gap: 12,
    paddingBottom: 20,
    width: '100%',
  },
  hobbiesContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
  },
  hobbiesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  hobbiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hobbyButton: {
    width: '48%',
    backgroundColor: '#e5eef4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  hobbyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  postCard: {
    borderWidth: 0,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 25,
    backgroundColor: '#cce6f7',
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 20,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  postAuthor: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  postDetail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#cce6f7',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  closeButton: {
    alignSelf: 'flex-end',
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
    // borderTopColor: '#e5e7eb',
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