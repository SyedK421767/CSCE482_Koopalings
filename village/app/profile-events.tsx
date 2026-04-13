import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/context/auth-context';
import { formatEventStartForDisplay } from '@/lib/event-datetime';
import { getRsvpInfo, RsvpInfoOwner } from '@/lib/rsvp-api';
import { API_URL } from '@/lib/config';

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

const COLORS = {
  background: '#062f66',
  cardBackground: '#FFFFFF',
  primary: '#2743bc',
  textPrimary: '#062f66',
  textSecondary: '#5a6c8c',
  textOnDark: '#FFFFFF',
  border: '#E5E7EB',
  shadow: '#000000',
};

export default function ProfileEventsScreen() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [guestListModalVisible, setGuestListModalVisible] = useState(false);
  const [guestListEvent, setGuestListEvent] = useState<Post | null>(null);
  const [guestListRsvpInfo, setGuestListRsvpInfo] = useState<RsvpInfoOwner | null>(null);
  const [guestListLoading, setGuestListLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editTime, setEditTime] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editImage, setEditImage] = useState<string | null>(null);
  const fetchEvents = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/posts`);
      if (!res.ok) {
        console.error('Failed to fetch events');
        return;
      }
      const data = (await res.json()) as Post[];
      const now = new Date();
      const mine = data
        .filter(
          (p) => p.userid === currentUser.userid && p.start_time && new Date(p.start_time) >= now
        )
        .sort((a, b) => {
          const aTime = new Date(a.start_time).getTime();
          const bTime = new Date(b.start_time).getTime();
          return aTime - bTime;
        });
      setEvents(mine);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      void fetchEvents();
    }, [fetchEvents])
  );

  const fetchGuestList = useCallback(async (event: Post) => {
    if (!currentUser) return;
    setGuestListLoading(true);
    try {
      const info = await getRsvpInfo(event.postid, currentUser.userid);
      if (info.isOwner) {
        setGuestListRsvpInfo(info);
      } else {
        setGuestListRsvpInfo(null);
      }
    } catch (err) {
      console.error('Failed to load guest list:', err);
      setGuestListRsvpInfo(null);
    } finally {
      setGuestListLoading(false);
    }
  }, [currentUser]);

  const handleViewGuestList = useCallback((event: Post) => {
    if (!currentUser) return;
    setGuestListEvent(event);
    setGuestListModalVisible(true);
    setGuestListRsvpInfo(null);
    void fetchGuestList(event);
  }, [currentUser, fetchGuestList]);

  const handleCloseGuestList = () => {
    setGuestListModalVisible(false);
    setGuestListEvent(null);
    setGuestListRsvpInfo(null);
  };

  const openEditModal = (post: Post) => {
    const dt = post.start_time ? new Date(post.start_time) : new Date();
    setEditTitle(post.title ?? '');
    setEditDescription(post.description ?? '');
    setEditLocation(post.location ?? '');
    setEditDate(dt);
    setEditTime(dt);
    setEditImage(null);
    setShowEditDatePicker(false);
    setShowEditTimePicker(false);
    setEditingPost(post);
  };

  const pickEditImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setEditImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', { uri, type: 'image/jpeg', name: 'upload.jpg' } as any);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      return data.url ?? null;
    } catch (err) {
      console.error('Image upload failed:', err);
      return null;
    }
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    if (!editTitle.trim() || !editLocation.trim()) {
      Alert.alert('Missing fields', 'Title and location are required.');
      return;
    }
    setEditSaving(true);
    try {
      let imageUrl: string | null | undefined;
      if (editImage) {
        imageUrl = await uploadImage(editImage);
        if (!imageUrl) {
          Alert.alert('Error', 'Image upload failed. Please try again.');
          return;
        }
      }

      const combined = new Date(
        editDate.getFullYear(), editDate.getMonth(), editDate.getDate(),
        editTime.getHours(), editTime.getMinutes(), 0, 0
      );
      const res = await fetch(`${API_URL}/posts/${editingPost.postid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          location: editLocation.trim(),
          start_time: combined.toISOString(),
          ...(imageUrl !== undefined && { image_url: imageUrl }),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        Alert.alert('Error', payload?.error ?? 'Could not update post.');
        return;
      }
      const updated = (await res.json()) as Post;
      setEvents((prev) => prev.map((p) => (p.postid === updated.postid ? updated : p)));
      setEditingPost(null);
    } catch (err) {
      console.error('Failed to update post:', err);
      Alert.alert('Error', 'Could not update post.');
    } finally {
      setEditSaving(false);
    }
  };

  const deletePost = () => {
    if (!editingPost) return;
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setEditSaving(true);
            try {
              const res = await fetch(`${API_URL}/posts/${editingPost.postid}`, { method: 'DELETE' });
              if (!res.ok) {
                const payload = await res.json().catch(() => null);
                Alert.alert('Error', payload?.error ?? 'Could not delete post.');
                return;
              }
              setEvents((prev) => prev.filter((p) => p.postid !== editingPost.postid));
              setEditingPost(null);
            } catch (err) {
              console.error('Failed to delete post:', err);
              Alert.alert('Error', 'Could not delete post.');
            } finally {
              setEditSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Post }) => (
    <Pressable style={styles.eventCard} onPress={() => openEditModal(item)}>
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      )}
      <View style={styles.eventCardBody}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventDetail}>📍 {item.location}</Text>
          <Text style={styles.eventDetail}>
            🕐 {formatEventStartForDisplay(item.start_time)}
          </Text>
          <View style={styles.editHint}>
            <Ionicons name="pencil" size={12} color={COLORS.textSecondary} />
            <Text style={styles.editHintText}>Tap to edit</Text>
          </View>
          <View style={styles.eventCardFooter}>
            <Pressable
              style={styles.guestListButton}
              onPress={(event) => {
                event.stopPropagation();
                handleViewGuestList(item);
              }}>
              <Text style={styles.guestListButtonText}>View RSVP List</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'All Events',
          headerBackTitle: 'Back',
          headerBackTitleVisible: true,
        }}
      />
      <View style={styles.container}>
        {loading && events.length === 0 ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.postid.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>You have no upcoming events.</Text>
                <Text style={styles.emptyStateSubText}>Create one from the Post tab.</Text>
              </View>
            }
            renderItem={renderItem}
          />
        )}

        <Modal
          visible={editingPost !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingPost(null)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.editModalOverlay}>
              <View style={[styles.editModalContainer]}>
                <View style={styles.editModalHeader}>
                  <Text style={styles.editModalTitle}>Edit Event</Text>
                  <Pressable onPress={() => setEditingPost(null)} hitSlop={8}>
                    <Ionicons name="close" size={24} color={COLORS.textOnDark} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {(editImage || editingPost?.image_url) ? (
                    <View style={styles.editImageWrapper}>
                      <Image
                        source={{ uri: editImage ?? editingPost!.image_url! }}
                        style={styles.editImagePreview}
                        resizeMode="cover"
                      />
                      <Pressable style={styles.editImageButton} onPress={pickEditImage}>
                        <Ionicons name="camera" size={14} color={COLORS.textPrimary} />
                        <Text style={styles.editImageButtonText}>Change Photo</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={styles.editImagePlaceholder} onPress={pickEditImage}>
                      <Ionicons name="image-outline" size={28} color={COLORS.textSecondary} />
                      <Text style={styles.editImagePlaceholderText}>Add Photo</Text>
                    </Pressable>
                  )}

                  <Text style={styles.editLabel}>Title</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Event title"
                    placeholderTextColor={COLORS.textSecondary}
                  />

                  <Text style={styles.editLabel}>Location</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editLocation}
                    onChangeText={setEditLocation}
                    placeholder="Location"
                    placeholderTextColor={COLORS.textSecondary}
                  />

                  <Text style={styles.editLabel}>Date</Text>
                  <Pressable
                    style={styles.editInput}
                    onPress={() => { setShowEditDatePicker((p) => !p); setShowEditTimePicker(false); }}
                  >
                    <Text style={styles.editInputText}>
                      {editDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </Pressable>
                  {showEditDatePicker && (
                    <DateTimePicker
                      value={editDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                      textColor="#FFFFFF"
                      onChange={(_e: DateTimePickerEvent, d?: Date) => {
                        if (Platform.OS === 'android') setShowEditDatePicker(false);
                        if (d) setEditDate(d);
                      }}
                    />
                  )}

                  <Text style={styles.editLabel}>Time</Text>
                  <Pressable
                    style={styles.editInput}
                    onPress={() => { setShowEditTimePicker((p) => !p); setShowEditDatePicker(false); }}
                  >
                    <Text style={styles.editInputText}>
                      {editTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {showEditTimePicker && (
                    <DateTimePicker
                      value={editTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                      textColor="#FFFFFF"
                      onChange={(_e: DateTimePickerEvent, t?: Date) => {
                        if (Platform.OS === 'android') setShowEditTimePicker(false);
                        if (t) setEditTime(t);
                      }}
                    />
                  )}

                  <Text style={styles.editLabel}>Description</Text>
                  <TextInput
                    style={[styles.editInput, styles.editInputMultiline]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Description"
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />

                  <Pressable
                    style={[styles.deleteButton, editSaving && styles.disabledButton]}
                    onPress={deletePost}
                    disabled={editSaving}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.textOnDark} />
                    <Text style={styles.deleteButtonText}>Delete Event</Text>
                  </Pressable>
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <Pressable style={styles.editCancelButton} onPress={() => setEditingPost(null)} disabled={editSaving}>
                    <Text style={styles.editCancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, editSaving && styles.disabledButton]}
                    onPress={saveEdit}
                    disabled={editSaving}
                  >
                    <Text style={styles.saveButtonText}>{editSaving ? 'Saving…' : 'Save'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={guestListModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseGuestList}>
          <View style={styles.guestListOverlay}>
            <View style={styles.guestListModal}>
              <View style={styles.guestListModalHeader}>
                <Text style={styles.guestListModalTitle}>Guest List</Text>
                <Pressable onPress={handleCloseGuestList} hitSlop={8}>
                  <Text style={styles.guestListCloseButtonText}>✕</Text>
                </Pressable>
              </View>
              {guestListEvent && (
                <Text style={styles.guestListEventTitle}>{guestListEvent.title}</Text>
              )}
              {guestListLoading ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : guestListRsvpInfo && guestListRsvpInfo.guests.length > 0 ? (
                <ScrollView style={styles.guestListScrollView}>
                  {guestListRsvpInfo.guests.map((guest) => (
                    <View key={guest.rsvpid} style={styles.guestListItem}>
                      {guest.profile_picture ? (
                        <Image
                          source={{ uri: guest.profile_picture }}
                          style={styles.guestAvatarImage}
                        />
                      ) : (
                        <View style={styles.guestAvatarPlaceholder}>
                          <Text style={styles.guestAvatarText}>
                            {guest.first_name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
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
              )}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  eventCard: {
    backgroundColor: COLORS.cardBackground,
    borderLeftWidth: 8,
    borderLeftColor: COLORS.primary,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.primary,
  },
  eventCardBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    lineHeight: 24,
  },
  eventDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
    lineHeight: 22,
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textOnDark,
    marginBottom: 6,
  },
  emptyStateSubText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  editModalContainer: {
    backgroundColor: COLORS.background,
    borderTopWidth: 3,
    borderColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxHeight: '90%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editImageWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  editImagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.primary,
  },
  editImageButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.yellow,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  editImageButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editImagePlaceholder: {
    height: 100,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  editImagePlaceholderText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.yellow,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 14,
  },
  editInput: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 3,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  editInputText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  editInputMultiline: {
    minHeight: 110,
    paddingTop: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    borderWidth: 3,
    borderColor: COLORS.red,
    marginTop: 20,
    marginBottom: 24,
  },
  deleteButtonText: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  editCancelButton: {
    flex: 1,
    borderWidth: 3,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  editCancelButtonText: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  editHintText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  guestListButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 0,
  },
  guestListButtonText: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    width: '90%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    padding: 24,
    maxHeight: '70%',
    elevation: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
  },
  guestListModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  guestListModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  guestListEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  guestListScrollView: {
    maxHeight: 300,
  },
  guestListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  guestAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: COLORS.primary,
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyGuestList: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyGuestListText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  guestListCloseButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
