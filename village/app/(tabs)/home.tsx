import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { formatEventStartForDisplay } from '@/lib/event-datetime';
import { useAuth } from '@/context/auth-context';
import { checkRsvpStatus, formatRsvpCategory, getRsvpInfo, getUserRsvps, RsvpInfo, toggleRsvp } from '@/lib/rsvp-api';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

type Post = {
  postid: number;
  userid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
};

export default function HomeScreen() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<'Events' | 'RSVP'>('Events');
  const [rsvpInfo, setRsvpInfo] = useState<RsvpInfo | null>(null);
  const [userRsvped, setUserRsvped] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [guestListModalVisible, setGuestListModalVisible] = useState(false);
  const [rsvpedPosts, setRsvpedPosts] = useState<Post[]>([]);
  const [rsvpedLoading, setRsvpedLoading] = useState(false);

  const fetchPosts = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      // If user has selected interests, filter posts by those interests
      const url = currentUser?.userid
        ? `${API_URL}/posts?userid=${currentUser.userid}`
        : `${API_URL}/posts`;
      const response = await fetch(url);
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [currentUser]);

  const fetchRsvpInfo = useCallback(async (postid: number) => {
    if (!currentUser) return;
    try {
      const info = await getRsvpInfo(postid, currentUser.userid);
      setRsvpInfo(info);
      const rsvped = await checkRsvpStatus(postid, currentUser.userid);
      setUserRsvped(rsvped);
    } catch (err) {
      console.error('Failed to fetch RSVP info:', err);
    }
  }, [currentUser]);

  const fetchRsvpedPosts = useCallback(async () => {
    if (!currentUser) return;
    setRsvpedLoading(true);
    try {
      const posts = await getUserRsvps(currentUser.userid);
      setRsvpedPosts(posts);
    } catch (err) {
      console.error('Failed to fetch RSVP\'d posts:', err);
    } finally {
      setRsvpedLoading(false);
    }
  }, [currentUser]);

  const handleToggleRsvp = async () => {
    if (!currentUser || !selectedPost) return;
    setRsvpLoading(true);
    try {
      const result = await toggleRsvp(selectedPost.postid, currentUser.userid);
      setUserRsvped(result.rsvped);
      await fetchRsvpInfo(selectedPost.postid);
      // Refresh RSVP'd posts list if on RSVP tab
      if (activeTab === 'RSVP') {
        await fetchRsvpedPosts();
      }
    } catch (err) {
      console.error('Failed to toggle RSVP:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPost) {
      void fetchRsvpInfo(selectedPost.postid);
    } else {
      setRsvpInfo(null);
      setUserRsvped(false);
      setGuestListModalVisible(false);
    }
  }, [selectedPost, fetchRsvpInfo]);

  useEffect(() => {
    console.log('Guest list modal visible:', guestListModalVisible);
  }, [guestListModalVisible]);

  const homeHasLoadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const showSpinner = !homeHasLoadedOnce.current;
      homeHasLoadedOnce.current = true;
      void fetchPosts(showSpinner);
      if (currentUser) {
        void fetchRsvpedPosts();
      }
    }, [fetchPosts, fetchRsvpedPosts, currentUser])
  );

  // Fetch RSVP'd posts when switching to RSVP tab
  useEffect(() => {
    if (activeTab === 'RSVP' && currentUser) {
      void fetchRsvpedPosts();
    }
  }, [activeTab, currentUser, fetchRsvpedPosts]);

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
          style={[styles.tabButton, activeTab === 'RSVP' && styles.activeTabButton]}
          onPress={() => setActiveTab('RSVP')}>
          <Text style={[styles.tabText, activeTab === 'RSVP' && styles.activeTabText]}>My RSVPs</Text>
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
                  <Text style={styles.postDetail}>🕐 {formatEventStartForDisplay(item.start_time)}</Text>
                </Pressable>
              )}
            />
          </View>
        )
      ) : (
        <View style={styles.eventsContainer}>
          <Text style={styles.containerHeader}>My RSVPs ✓</Text>
          {rsvpedLoading ? (
            <ActivityIndicator size="large" color="#111827" />
          ) : rsvpedPosts.length > 0 ? (
            <FlatList
              data={rsvpedPosts}
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
                  <Text style={styles.postDetail}>🕐 {formatEventStartForDisplay(item.start_time)}</Text>
                </Pressable>
              )}
            />
          ) : (
            <View style={styles.emptyRsvpContainer}>
              <Text style={styles.emptyRsvpText}>You haven't RSVP'd to any events yet</Text>
              <Text style={styles.emptyRsvpSubtext}>
                Browse events in the Events tab and tap RSVP to add them here
              </Text>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={selectedPost !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedPost(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
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
                    🕐 {formatEventStartForDisplay(selectedPost.start_time)}
                  </Text>

                  <View style={styles.divider} />

                  {/* RSVP Section */}
                  {currentUser && selectedPost && (
                    <>
                      <View style={styles.rsvpSection}>
                        {currentUser.userid === selectedPost.userid ? (
                          // Owner view - only show guest list button
                          <>
                            <Pressable
                              style={styles.guestListButton}
                              onPress={() => {
                                console.log('Guest list button pressed');
                                setGuestListModalVisible(true);
                              }}>
                              <Text style={styles.guestListButtonText}>
                                👥 View Guest List
                                {rsvpInfo && rsvpInfo.isOwner && ` (${rsvpInfo.count})`}
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          // Non-owner view - show RSVP button and category
                          <>
                            <Pressable
                              style={[styles.rsvpButton, userRsvped && styles.rsvpButtonActive]}
                              onPress={handleToggleRsvp}
                              disabled={rsvpLoading}>
                              {rsvpLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.rsvpButtonText}>
                                  {userRsvped ? '✓ Attending' : 'RSVP'}
                                </Text>
                              )}
                            </Pressable>

                            {rsvpInfo && !rsvpInfo.isOwner && (
                              <View style={styles.rsvpInfoContainer}>
                                <Text style={styles.rsvpCategoryText}>
                                  👥 {formatRsvpCategory(rsvpInfo.category)}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>

                      <View style={styles.divider} />
                    </>
                  )}

                  <Text style={styles.descriptionLabel}>About this event</Text>
                  <Text style={styles.description}>
                    {selectedPost.description || 'No description provided.'}
                  </Text>
                </>
              )}

              {/* Guest List Overlay - shows inside event modal */}
              {guestListModalVisible && (
                <View style={styles.guestListOverlay}>
                  <View style={styles.guestListModal}>
                    <View style={styles.guestListModalHeader}>
                      <Text style={styles.guestListModalTitle}>Guest List</Text>
                      <Pressable
                        onPress={() => {
                          console.log('Close button pressed');
                          setGuestListModalVisible(false);
                        }}>
                        <Text style={styles.closeButtonText}>✕</Text>
                      </Pressable>
                    </View>

                    {rsvpInfo && rsvpInfo.isOwner ? (
                      rsvpInfo.guests.length > 0 ? (
                        <ScrollView style={styles.guestListScrollView}>
                          {rsvpInfo.guests.map((guest) => (
                            <View key={guest.rsvpid} style={styles.guestListItem}>
                              <View style={styles.guestAvatarPlaceholder}>
                                <Text style={styles.guestAvatarText}>
                                  {guest.first_name?.[0]?.toUpperCase() || '?'}
                                </Text>
                              </View>
                              <View style={styles.guestInfo}>
                                <Text style={styles.guestName}>
                                  {guest.first_name} {guest.last_name}
                                </Text>
                                
                              </View>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={styles.emptyGuestList}>
                          <Text style={styles.emptyGuestListText}>No one has RSVP'd yet</Text>
                        </View>
                      )
                    ) : (
                      <View style={styles.emptyGuestList}>
                        <Text style={styles.emptyGuestListText}>Loading...</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
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
  emptyRsvpContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyRsvpText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyRsvpSubtext: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#cce6f7',
    borderRadius: 16,
    padding: 24,
    width: '100%',
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
  rsvpSection: {
    marginVertical: 8,
  },
  rsvpButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  rsvpButtonActive: {
    backgroundColor: '#16a34a',
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rsvpInfoContainer: {
    backgroundColor: '#e5eef4',
    padding: 12,
    borderRadius: 8,
  },
  rsvpCountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  rsvpCategoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  guestList: {
    marginTop: 8,
  },
  guestListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  guestItem: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  guestListButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  guestListButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guestListOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  guestListModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  guestListModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  guestListModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  guestListScrollView: {
    maxHeight: 400,
  },
  guestListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  guestAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  guestAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  guestEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyGuestList: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyGuestListText: {
    fontSize: 15,
    color: '#6b7280',
  },
});