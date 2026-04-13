import { ActivityIndicator, FlatList, GestureResponderEvent, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useAuth } from '@/context/auth-context';
import { formatEventStartForDisplay } from '@/lib/event-datetime';
import { getRsvpInfo, RsvpInfoOwner } from '@/lib/rsvp-api';
import { API_URL } from '@/lib/config';

const COLORS = {
  background: '#062f66',
  cardBackground: '#FFFFFF',
  primary: '#2743bc',
  yellow: '#ffbd59',
  red: '#e34348',
  cream: '#ffd59a',
  textPrimary: '#062f66',
  textSecondary: '#5a6c8c',
  textLight: '#8892a8',
  textOnDark: '#FFFFFF',
  border: '#E5E7EB',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
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

// ── Range Slider ─────────────────────────────────────────────────────────────
const THUMB_SIZE = 26;
const RANGE_MIN = 0;
const RANGE_MAX = 200;
const RANGE_STEP = 5;

function valueToPx(val: number, trackW: number) {
  return ((val - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * (trackW - THUMB_SIZE);
}

function pxToValue(px: number, trackW: number) {
  if (trackW <= THUMB_SIZE) return RANGE_MIN;
  const raw = (px / (trackW - THUMB_SIZE)) * (RANGE_MAX - RANGE_MIN) + RANGE_MIN;
  const clamped = Math.max(RANGE_MIN, Math.min(RANGE_MAX, raw));
  return Math.round(clamped / RANGE_STEP) * RANGE_STEP;
}

function RangeSlider({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  minValue: number;
  maxValue: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const minValueRef = useRef(minValue);
  const maxValueRef = useRef(maxValue);
  minValueRef.current = minValue;
  maxValueRef.current = maxValue;
  const onMinChangeRef = useRef(onMinChange);
  onMinChangeRef.current = onMinChange;
  const onMaxChangeRef = useRef(onMaxChange);
  onMaxChangeRef.current = onMaxChange;
  const minStartValue = useRef(minValue);
  const maxStartValue = useRef(maxValue);

  const minPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { minStartValue.current = minValueRef.current; },
      onPanResponderMove: (_, gs) => {
        const tw = trackWidthRef.current;
        let newVal = pxToValue(valueToPx(minStartValue.current, tw) + gs.dx, tw);
        newVal = Math.min(newVal, maxValueRef.current);
        onMinChangeRef.current(newVal);
      },
    })
  ).current;

  const maxPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { maxStartValue.current = maxValueRef.current; },
      onPanResponderMove: (_, gs) => {
        const tw = trackWidthRef.current;
        let newVal = pxToValue(valueToPx(maxStartValue.current, tw) + gs.dx, tw);
        newVal = Math.max(newVal, minValueRef.current);
        onMaxChangeRef.current(newVal);
      },
    })
  ).current;

  const HALF = THUMB_SIZE / 2;
  const minPx = trackWidth > 0 ? valueToPx(minValue, trackWidth) : 0;
  const maxPx = trackWidth > 0 ? valueToPx(maxValue, trackWidth) : 0;

  return (
    <View
      style={{ height: THUMB_SIZE + 16, justifyContent: 'center' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        trackWidthRef.current = w;
        setTrackWidth(w);
      }}
    >
      <View style={{ position: 'absolute', left: HALF, right: HALF, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
      {trackWidth > 0 && (
        <View style={{ position: 'absolute', left: minPx + HALF, width: Math.max(0, maxPx - minPx), height: 4, backgroundColor: '#fff', borderRadius: 2 }} />
      )}
      {trackWidth > 0 && (
        <View {...minPan.panHandlers} style={{ position: 'absolute', left: minPx, width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: HALF, backgroundColor: '#fff' }} />
      )}
      {trackWidth > 0 && (
        <View {...maxPan.panHandlers} style={{ position: 'absolute', left: maxPx, width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: HALF, backgroundColor: '#fff' }} />
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editPostId?: string }>();
  const { currentUser, setCurrentUser, setIsSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<{ tagid: number; name: string }[]>([]);
  const [pendingTagIds, setPendingTagIds] = useState<number[]>([]);
  const [currentTagIds, setCurrentTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [myEvents, setMyEvents] = useState<Post[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editTime, setEditTime] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editImage, setEditImage] = useState<string | null>(null); // local URI of newly picked image
  const [editIsFree, setEditIsFree] = useState(true);
  const [editPriceMin, setEditPriceMin] = useState(0);
  const [editPriceMax, setEditPriceMax] = useState(50);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const [guestListModalVisible, setGuestListModalVisible] = useState(false);
  const [guestListEvent, setGuestListEvent] = useState<Post | null>(null);
  const [guestListRsvpInfo, setGuestListRsvpInfo] = useState<RsvpInfoOwner | null>(null);
  const [guestListLoading, setGuestListLoading] = useState(false);

  useEffect(() => {
    const tags = currentUser?.tags ?? [];
    setHobbies(tags.map((tag: { name: string }) => tag.name));
    const ids = tags.map((tag: { tagid: number }) => tag.tagid);
    setPendingTagIds(ids);
    setCurrentTagIds(ids);
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    const fetchTags = async () => {
      try {
        const res = await fetch(`${API_URL}/posts/tags`);
        if (!res.ok) return;
        const data = (await res.json()) as { tagid: number; name: string }[];
        if (active) setTagOptions(data);
      } catch (err) {
        console.error('Failed to load hobbies list:', err);
      }
    };
    fetchTags();
    return () => { active = false; };
  }, []);

  const fetchMyEvents = useCallback(async () => {
    if (!currentUser) return;
    setEventsLoading(true);
    try {
      const res = await fetch(`${API_URL}/posts`);
      if (!res.ok) return;
      const data = (await res.json()) as Post[];
      const now = new Date();
      const mine = data.filter(
        (p) => p.userid === currentUser.userid && p.start_time != null && new Date(p.start_time) >= now
      )
        .sort((a, b) => {
          const aTime = new Date(a.start_time!).getTime();
          const bTime = new Date(b.start_time!).getTime();
          return aTime - bTime;
        });
      setMyEvents(mine);
    } catch (err) {
      console.error('Failed to load my events:', err);
    } finally {
      setEventsLoading(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      void fetchMyEvents();
    }, [fetchMyEvents])
  );

  const openEditModal = (post: Post) => {
    const dt = post.start_time ? new Date(post.start_time) : new Date();
    const pMin = Number(post.price_min ?? 0);
    const pMax = Number(post.price_max ?? 0);
    setEditTitle(post.title ?? '');
    setEditDescription(post.description ?? '');
    setEditLocation(post.location ?? '');
    setEditDate(dt);
    setEditTime(dt);
    setEditImage(null);
    setEditIsFree(pMin === 0 && pMax === 0);
    setEditPriceMin(pMin === 0 && pMax === 0 ? 0 : pMin);
    setEditPriceMax(pMin === 0 && pMax === 0 ? 50 : pMax);
    setShowEditDatePicker(false);
    setShowEditTimePicker(false);
    setEditingPost(post);
  };

  useEffect(() => {
    const postId = Number(params.editPostId ?? '');
    if (!postId || myEvents.length === 0) return;
    const target = myEvents.find((p) => p.postid === postId);
    if (!target) return;
    openEditModal(target);
    router.replace('/(tabs)/profile');
  }, [params.editPostId, myEvents, openEditModal, router]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const fetchProfilePic = async () => {
      try {
        const res = await fetch(`${API_URL}/profiles/${currentUser.userid}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setProfilePicUrl(data.profile_picture ?? null);
      } catch (err) {
        console.error('Failed to fetch profile picture:', err);
      }
    };
    fetchProfilePic();
    return () => { active = false; };
  }, [currentUser]);

  const handleChangeProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !currentUser) return;

    setProfilePicUploading(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('image', { uri, type: 'image/jpeg', name: 'profile.jpg' } as any);
      const uploadRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      const url: string = uploadData.url;
      if (!url) throw new Error('No URL returned');

      const saveRes = await fetch(`${API_URL}/profiles/${currentUser.userid}/picture`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_picture: url }),
      });
      if (!saveRes.ok) throw new Error('Failed to save profile picture');
      setProfilePicUrl(url);
    } catch (err) {
      console.error('Profile picture update failed:', err);
      Alert.alert('Error', 'Could not update profile picture.');
    } finally {
      setProfilePicUploading(false);
    }
  };

  const displayName = useMemo(
    () => `${currentUser?.first_name ?? ''} ${currentUser?.last_name ?? ''}`.trim(),
    [currentUser]
  );

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
          price_min: editIsFree ? 0 : editPriceMin,
          price_max: editIsFree ? 0 : editPriceMax,
          ...(imageUrl !== undefined && { image_url: imageUrl }),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        Alert.alert('Error', payload?.error ?? 'Could not update post.');
        return;
      }
      const updated = (await res.json()) as Post;
      setMyEvents((prev) => prev.map((p) => (p.postid === updated.postid ? updated : p)));
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
              setMyEvents((prev) => prev.filter((p) => p.postid !== editingPost.postid));
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

  const handleLogout = () => {
    setCurrentUser(null);
    setIsSignedIn(false);
    router.replace('/');
  };

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

  const saveHobbies = async (tagIds: number[]) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/${currentUser.userid}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds }),
      });

      const payload = await res.json();
      if (!res.ok) {
        const message = payload?.error ?? 'Could not update hobbies.';
        Alert.alert('Error', message);
        return;
      }

      const updated = payload;
      setCurrentUser(updated);
      const tags = updated?.tags ?? [];
      const ids = tags.map((tag: { tagid: number }) => tag.tagid);
      setHobbies(tags.map((tag: { name: string }) => tag.name));
      setCurrentTagIds(ids);
      setPendingTagIds(ids);
      setModalVisible(false);
    } catch (err) {
      console.error('Failed to save hobbies:', err);
      Alert.alert('Error', 'Could not update hobbies.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHobby = (tagId: number) => {
    if (saving) return;
    setPendingTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const pendingMatches = useMemo(() => {
    if (pendingTagIds.length !== currentTagIds.length) return false;
    const sortedPending = [...pendingTagIds].sort();
    const sortedCurrent = [...currentTagIds].sort();
    return sortedPending.every((item, index) => item === sortedCurrent[index]);
  }, [pendingTagIds, currentTagIds]);

  const handleCloseModal = () => {
    setPendingTagIds(currentTagIds);
    setModalVisible(false);
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Sign in to manage your space.</Text>
      </View>
    );
  }

  const listHeader = (
    <View style={{ paddingTop: insets.top + 20 }}>
      <View style={styles.profileBox}>
        <Pressable style={styles.avatarWrapper} onPress={handleChangeProfilePic} disabled={profilePicUploading}>
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={48} color="#fff" />
            </View>
          )}
          {(!profilePicUrl || profilePicUploading) && (
            <View style={styles.avatarOverlay}>
              {profilePicUploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={16} color="#fff" />}
            </View>
          )}
        </Pressable>
        <Text style={styles.name}>{displayName || currentUser.email}</Text>
        <Text style={styles.subtitle}>{currentUser.email}</Text>
      </View>

      <Pressable style={styles.hobbiesButton} onPress={() => setModalVisible(true)}>
        <View style={styles.hobbiesButtonContent}>
          <Text style={styles.hobbiesButtonLabel}>Hobbies</Text>
          {hobbies.length > 0 ? (
            <Text style={styles.hobbiesButtonCount}>{hobbies.length} selected</Text>
          ) : (
            <Text style={styles.hobbiesButtonEmpty}>None selected</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>My Upcoming Events</Text>
        {eventsLoading && <ActivityIndicator size="small" color={COLORS.yellow} />}
      </View>
    </View>
  );

  const listFooter = (
    <View style={styles.listFooter}>
      {myEvents.length > 3 && (
        <Pressable style={styles.viewMoreButton} onPress={() => router.push('/profile-events')}>
          <Text style={styles.viewMoreButtonText}>View More</Text>
        </Pressable>
      )}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );

  const recentEvents = myEvents.slice(0, 3);

  return (
    <View style={styles.container}>
      <FlatList
        data={recentEvents}
        keyExtractor={(item) => item.postid.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          !eventsLoading ? (
            <View style={styles.emptyEvents}>
              <Text style={styles.emptyEventsText}>No upcoming events posted.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
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
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  handleViewGuestList(item);
                }}
              >
                <Text style={styles.guestListButtonText}>View RSVP List</Text>
              </Pressable>
            </View>
            </View>
          </Pressable>
        )}
      />

      {/* Edit Post Modal */}
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
            <View style={[styles.editModalContainer, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Edit Event</Text>
                <Pressable onPress={() => setEditingPost(null)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={COLORS.textOnDark} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Image section */}
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

                <View style={styles.editPriceSection}>
                  <Text style={styles.editLabel}>Price</Text>
                  <Pressable
                    style={styles.editToggleRow}
                    onPress={() => setEditIsFree((prev) => !prev)}
                  >
                    <View style={[styles.editToggleTrack, editIsFree && styles.editToggleTrackActive]}>
                      <View style={[styles.editToggleThumb, editIsFree && styles.editToggleThumbActive]} />
                    </View>
                    <Text style={styles.editToggleLabel}>{editIsFree ? 'Free' : 'Not Free'}</Text>
                  </Pressable>

                  {!editIsFree && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.editPriceDisplay}>
                        ${editPriceMin} – ${editPriceMax}
                      </Text>
                      <View style={styles.editSliderRow}>
                        <Text style={styles.editSliderEdge}>$0</Text>
                        <View style={{ flex: 1 }}>
                          <RangeSlider
                            minValue={editPriceMin}
                            maxValue={editPriceMax}
                            onMinChange={setEditPriceMin}
                            onMaxChange={setEditPriceMax}
                          />
                        </View>
                        <Text style={styles.editSliderEdge}>$200</Text>
                      </View>
                    </View>
                  )}
                </View>

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

      {/* Hobbies Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hobbies</Text>
              <Pressable onPress={handleCloseModal} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {pendingTagIds.length > 0 && (
                <View style={styles.selectedSection}>
                  <Text style={styles.modalSectionLabel}>Selected</Text>
                  <View style={styles.pillGrid}>
                    {tagOptions
                      .filter((t) => pendingTagIds.includes(t.tagid))
                      .map((item) => (
                        <Pressable
                          key={item.tagid}
                          style={styles.selectedPill}
                          onPress={() => handleToggleHobby(item.tagid)}
                        >
                          <Text style={styles.selectedPillText}>{item.name}</Text>
                          <Ionicons name="close-circle" size={14} color={COLORS.textOnDark} style={{ marginLeft: 4 }} />
                        </Pressable>
                      ))}
                  </View>
                </View>
              )}

              <Text style={styles.modalSectionLabel}>All Hobbies</Text>
              {tagOptions.length > 0 ? (
                <View style={styles.pillGrid}>
                  {tagOptions.map((item) => {
                    const selected = pendingTagIds.includes(item.tagid);
                    return (
                      <Pressable
                        key={item.tagid}
                        style={[styles.gridPill, selected && styles.gridPillSelected]}
                        onPress={() => handleToggleHobby(item.tagid)}
                      >
                        <Text style={[styles.gridPillText, selected && styles.gridPillSelectedText]}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyHobbyText}>Loading hobbies…</Text>
              )}
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <Pressable style={styles.cancelButton} onPress={handleCloseModal} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, (saving || pendingMatches) && styles.disabledButton]}
                onPress={() => saveHobbies(pendingTagIds)}
                disabled={saving || pendingMatches}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={guestListModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseGuestList}
      >
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginBottom: 16,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  profileBox: {
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: COLORS.cardBackground,
    padding: 24,
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 6,
  },
  avatarWrapper: {
    width: 88,
    height: 88,
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.yellow,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderWidth: 4,
    borderColor: COLORS.yellow,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  hobbiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 3,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 4,
  },
  hobbiesButtonContent: {
    flex: 1,
  },
  hobbiesButtonLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  hobbiesButtonCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  hobbiesButtonEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  listFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  viewMoreButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 6,
  },
  viewMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventCard: {
    backgroundColor: COLORS.cardBackground,
    borderLeftWidth: 8,
    borderLeftColor: COLORS.red,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.cream,
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
  emptyEvents: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyEventsText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  // Edit modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
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
  editPriceSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  editToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  editToggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  editToggleTrackActive: {
    backgroundColor: COLORS.yellow,
  },
  editToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  editToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  editToggleLabel: {
    color: COLORS.textOnDark,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editPriceDisplay: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.yellow,
    textAlign: 'center',
    marginBottom: 8,
  },
  editSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editSliderEdge: {
    color: COLORS.textOnDark,
    fontSize: 12,
    fontWeight: '700',
    width: 34,
    textAlign: 'center',
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
  logoutButton: {
    marginTop: 16,
    backgroundColor: COLORS.red,
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 6,
  },
  logoutText: {
    color: COLORS.textOnDark,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 3,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  selectedSection: {
    marginBottom: 16,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    margin: 4,
  },
  selectedPillText: {
    color: COLORS.textOnDark,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridPill: {
    width: '30%',
    margin: '1.65%',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
  },
  gridPillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  gridPillText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  gridPillSelectedText: {
    color: COLORS.textOnDark,
  },
  emptyHobbyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 3,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
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
