import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { formatEventStartForDisplay } from '@/lib/event-datetime';
import { useAuth } from '@/context/auth-context';
import { checkRsvpStatus, formatRsvpCategory, getRsvpInfo, getUserRsvps, RsvpInfo, toggleRsvp } from '@/lib/rsvp-api';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

// Color Theme - Modernist colorful palette
const COLORS = {
  background: '#062f66',        // Deep navy background
  cardBackground: '#FFFFFF',    // White cards for contrast
  primary: '#2743bc',           // Bold blue accent
  yellow: '#ffbd59',            // Bright yellow accent
  red: '#e34348',               // Bold red accent
  cream: '#ffd59a',             // Warm cream accent
  textPrimary: '#062f66',       // Dark navy text on cards
  textSecondary: '#5a6c8c',     // Muted blue-gray
  textLight: '#8892a8',         // Light gray-blue
  textOnDark: '#FFFFFF',        // White text on dark bg
  border: '#E5E7EB',            // Borders
  shadow: '#000000',            // Shadow color
};

type Post = {
  postid: number;
  userid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
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
  const eventsListRef = useRef<FlatList>(null);
  const rsvpListRef = useRef<FlatList>(null);
  const modalSlideAnim = useRef(new Animated.Value(0)).current;

  const fetchPosts = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      // If user has selected interests, filter posts by those interests
      const url = currentUser?.userid
        ? `${API_URL}/posts?userid=${currentUser.userid}`
        : `${API_URL}/posts`;
      console.log('Fetching posts from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        console.error('Failed to fetch posts, status:', response.status);
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('Fetched posts count:', data.length);
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setPosts([]); // Set empty array on error
    } finally {
      setLoading(false); // Always turn off loading
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

  const closeModal = () => {
    // Animate modal out
    Animated.timing(modalSlideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectedPost(null);
      setRsvpInfo(null);
      setUserRsvped(false);
      setGuestListModalVisible(false);
    });
  };

  useEffect(() => {
    if (selectedPost) {
      // Animate modal in
      Animated.timing(modalSlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      void fetchRsvpInfo(selectedPost.postid);
    }
  }, [selectedPost, fetchRsvpInfo, modalSlideAnim]);

  useEffect(() => {
    console.log('Guest list modal visible:', guestListModalVisible);
  }, [guestListModalVisible]);

  useFocusEffect(
    useCallback(() => {
      // Refresh posts every time the home tab is focused
      void fetchPosts(false);
      if (currentUser) {
        void fetchRsvpedPosts();
      }
    }, [fetchPosts, fetchRsvpedPosts, currentUser])
  );

  // Refresh posts when user's tags/hobbies change
  useEffect(() => {
    if (currentUser?.tags) {
      void fetchPosts(false); // Refresh without spinner
    }
  }, [currentUser?.tags, fetchPosts]);

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
          onPress={() => {
            setActiveTab('Events');
            eventsListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}>
          <Text style={[styles.tabText, activeTab === 'Events' && styles.activeTabText]}>Events</Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'RSVP' && styles.activeTabButton]}
          onPress={() => {
            setActiveTab('RSVP');
            rsvpListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}>
          <Text style={[styles.tabText, activeTab === 'RSVP' && styles.activeTabText]}>My RSVPs</Text>
        </Pressable>
      </View>

      {activeTab === 'Events' ? (
        loading ? (
          <ActivityIndicator size="large" color="#111827" />
        ) : (
          <View style={styles.eventsContainer}>
            <FlatList
              ref={eventsListRef}
              data={posts}
              keyExtractor={(item) => item.postid.toString()}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable style={styles.postCard} onPress={() => setSelectedPost(item)}>
                  {item.image_url && (
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                  )}
                  <Text style={styles.postTitle}>{item.title}</Text>
                  <Text style={styles.postAuthor}>by {item.displayname}</Text>
                  <Text style={styles.postDetail}>📍 {item.location}</Text>
                  <Text style={[styles.postDetail, { marginBottom: 24 }]}>🕐 {formatEventStartForDisplay(item.start_time)}</Text>
                </Pressable>
              )}
            />
          </View>
        )
      ) : (
        <View style={styles.eventsContainer}>
          {rsvpedPosts.length > 0 ? (
            <FlatList
              ref={rsvpListRef}
              data={rsvpedPosts}
              keyExtractor={(item) => item.postid.toString()}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable style={styles.postCard} onPress={() => setSelectedPost(item)}>
                  {item.image_url && (
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                  )}
                  <Text style={styles.postTitle}>{item.title}</Text>
                  <Text style={styles.postAuthor}>by {item.displayname}</Text>
                  <Text style={styles.postDetail}>📍 {item.location}</Text>
                  <Text style={[styles.postDetail, { marginBottom: 24 }]}>🕐 {formatEventStartForDisplay(item.start_time)}</Text>
                </Pressable>
              )}
            />
          ) : (
            <View style={styles.emptyRsvpContainer}>
              <Text style={styles.emptyRsvpText}>
                {rsvpedLoading ? 'Loading...' : "You haven't RSVP'd to any events yet"}
              </Text>
              {!rsvpedLoading && (
                <Text style={styles.emptyRsvpSubtext}>
                  Browse events in the Events tab and tap RSVP to add them here
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <Modal
        visible={selectedPost !== null}
        animationType="none"
        transparent
        onRequestClose={closeModal}>
        <Pressable
          style={styles.modalOverlay}
          onPress={closeModal}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <Animated.View
              style={[
                styles.modalContent,
                {
                  transform: [
                    {
                      translateY: modalSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [600, 0],
                      }),
                    },
                  ],
                  opacity: modalSlideAnim,
                },
              ]}>
              <Pressable
                style={{ flex: 1 }}
                onPress={(e) => e.stopPropagation()}>
                <Pressable
                  style={styles.closeButton}
                  onPress={closeModal}>
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

                  <Text style={styles.descriptionLabel}>About this event</Text>
                  <Text style={styles.description}>
                    {selectedPost.description || 'No description provided.'}
                  </Text>

                  <View style={styles.divider} />

                  <Text style={styles.modalDetail}>📍 {selectedPost.location}</Text>
                  <Text style={styles.modalDetail}>
                    🕐 {formatEventStartForDisplay(selectedPost.start_time)}
                  </Text>
                  <Text style={styles.modalDetail}>
                    {(() => {
                      const min = Number(selectedPost.price_min ?? 0);
                      const max = Number(selectedPost.price_max ?? 0);
                      if (min === 0 && max === 0) return '💲 Free';
                      if (min === max) return `💲 $${min}`;
                      return `💲 $${min} – $${max}`;
                    })()}
                  </Text>

                  {/* RSVP Section */}
                  {currentUser && selectedPost && (
                    <>
                      <View style={styles.divider} />

                      <View style={styles.rsvpSection}>
                        {currentUser.userid === selectedPost.userid ? (
                          // Owner view - only show guest list button
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
                    </>
                  )}
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
              </Pressable>
            </Animated.View>
          </ScrollView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingHorizontal: 16,
    alignContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 0,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  activeTabButton: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.yellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  tabText: {
    color: COLORS.textOnDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeTabText: {
    color: COLORS.textPrimary,
    fontWeight: '900',
  },
  eventsContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  list: {
    gap: 32,
    paddingBottom: 40,
    paddingTop: 12,
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
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyRsvpSubtext: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  postCard: {
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    backgroundColor: COLORS.cardBackground,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
    marginBottom: 0,
    borderLeftWidth: 8,
    borderLeftColor: COLORS.red,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: COLORS.cream,
  },
  postTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 20,
    marginHorizontal: 24,
    letterSpacing: -0.8,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  postAuthor: {
    fontSize: 12,
    color: COLORS.textOnDark,
    marginBottom: 16,
    marginHorizontal: 24,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '800',
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postDetail: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 0,
    marginBottom: 10,
    marginHorizontal: 24,
    lineHeight: 24,
    fontWeight: '600',
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
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    padding: 24,
    width: '100%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: 0,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  modalAuthor: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginVertical: 16,
  },
  modalDetail: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 22,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  rsvpSection: {
    marginVertical: 8,
  },
  rsvpButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 0,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 6,
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  rsvpButtonActive: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.yellow,
  },
  rsvpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  rsvpInfoContainer: {
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rsvpCountText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textOnDark,
    marginBottom: 8,
  },
  rsvpCategoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textOnDark,
  },
  guestList: {
    marginTop: 8,
  },
  guestListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textOnDark,
    marginBottom: 6,
  },
  guestItem: {
    fontSize: 14,
    color: COLORS.textOnDark,
    marginBottom: 4,
  },
  guestListButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 0,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 6,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  guestListButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    padding: 24,
    width: '90%',
    maxHeight: '70%',
    elevation: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  guestListModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  guestListModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  guestListScrollView: {
    maxHeight: 400,
  },
  guestListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.background,
    borderRadius: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  guestAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  guestEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyGuestList: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyGuestListText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});