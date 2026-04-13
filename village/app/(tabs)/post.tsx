import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
import * as Location from 'expo-location';

import { getPostAuthorDisplayName, useAuth } from '@/context/auth-context';
import { API_URL } from '@/lib/config';
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const SAMPLE_IMAGE =
  'https://placehold.net/600x400.png';

// Color Theme - matching home and explore pages
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
};

interface Tag {
  tagid: number;
  name: string;
}

interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

type PollType = 'multiple-choice' | 'checkbox' | 'short-answer';

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
      onPanResponderGrant: () => {
        minStartValue.current = minValueRef.current;
      },
      onPanResponderMove: (_, gs) => {
        const tw = trackWidthRef.current;
        const startPx = valueToPx(minStartValue.current, tw);
        let newVal = pxToValue(startPx + gs.dx, tw);
        newVal = Math.min(newVal, maxValueRef.current);
        onMinChangeRef.current(newVal);
      },
    })
  ).current;

  const maxPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        maxStartValue.current = maxValueRef.current;
      },
      onPanResponderMove: (_, gs) => {
        const tw = trackWidthRef.current;
        const startPx = valueToPx(maxStartValue.current, tw);
        let newVal = pxToValue(startPx + gs.dx, tw);
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
      {/* Background track */}
      <View
        style={{
          position: 'absolute',
          left: HALF,
          right: HALF,
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.25)',
          borderRadius: 2,
        }}
      />
      {/* Filled range */}
      {trackWidth > 0 && (
        <View
          style={{
            position: 'absolute',
            left: minPx + HALF,
            width: Math.max(0, maxPx - minPx),
            height: 4,
            backgroundColor: '#fff',
            borderRadius: 2,
          }}
        />
      )}
      {/* Min thumb */}
      {trackWidth > 0 && (
        <View
          {...minPan.panHandlers}
          style={{
            position: 'absolute',
            left: minPx,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: HALF,
            backgroundColor: '#fff',
          }}
        />
      )}
      {/* Max thumb */}
      {trackWidth > 0 && (
        <View
          {...maxPan.panHandlers}
          style={{
            position: 'absolute',
            left: maxPx,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: HALF,
            backgroundColor: '#fff',
          }}
        />
      )}
    </View>
  );
}

export default function PostScreen() {
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(50);
  const [isFree, setIsFree] = useState(true);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [hasExtraMedia, setHasExtraMedia] = useState(false);

  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);

  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch(`${API_URL}/posts/tags`);
        const data = await response.json();
        setTags(data);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    if (!isLocationFocused) return;

    const trimmedAddress = address.trim();
    if (!trimmedAddress || !GOOGLE_PLACES_API_KEY) {
      setLocationSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setSearchingPlaces(true);

        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
          },
          body: JSON.stringify({
            input: trimmedAddress,
            regionCode: 'US',
            languageCode: 'en',
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setLocationSuggestions([]);
          return;
        }

        const data = await response.json();
        const suggestions: PlaceSuggestion[] = (data?.suggestions ?? [])
          .map((entry: any) => {
            const prediction = entry?.placePrediction;
            const fullText = prediction?.text?.text ?? '';
            if (!prediction?.placeId || !fullText) return null;

            const parts = fullText.split(',');
            const primaryText = parts[0]?.trim() ?? fullText;
            const secondaryText = parts.slice(1).join(',').trim();

            return {
              placeId: prediction.placeId,
              primaryText,
              secondaryText,
              fullText,
            };
          })
          .filter(Boolean);

        setLocationSuggestions(suggestions);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setLocationSuggestions([]);
        }
      } finally {
        setSearchingPlaces(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address, isLocationFocused]);

  const fetchPlaceCoordinates = async (placeId: string) => {
    if (!GOOGLE_PLACES_API_KEY) return;

    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'location',
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data?.location?.latitude != null && data?.location?.longitude != null) {
        setLatitude(data.location.latitude);
        setLongitude(data.location.longitude);
      }
    } catch (err) {
      console.error('Failed to fetch place coordinates:', err);
    }
  };

  const geocodeFallback = async (
    addressText: string
  ): Promise<{ lat: number; lng: number } | null> => {
    try {
      const results = await Location.geocodeAsync(addressText);
      if (results.length > 0) {
        return { lat: results[0].latitude, lng: results[0].longitude };
      }
    } catch (err) {
      console.error('Fallback geocoding failed:', err);
    }
    return null;
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedTime) setTime(selectedTime);
  };

  const handlePickImage = async () => {
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
      setImage(result.assets[0].uri);
      setHasExtraMedia(true);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append(
      'image',
      {
        uri,
        type: 'image/jpeg',
        name: 'upload.jpg',
      } as any
    );

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      return data.url;
    } catch (err) {
      console.error('Image upload failed:', err);
      return null;
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const selectedTagNames = tags
    .filter((tag) => selectedTagIds.includes(tag.tagid))
    .map((tag) => tag.name);

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Not signed in', 'Please sign in to create an event.');
      return;
    }

    if (!title.trim() || !description.trim() || !address.trim()) {
      Alert.alert('Missing fields', 'Please fill in title, description, and location.');
      return;
    }

    const combinedDateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getHours(),
      time.getMinutes(),
      time.getSeconds(),
      time.getMilliseconds()
    );

    if (combinedDateTime < new Date()) {
      Alert.alert('Invalid time', 'Please select a future date and time.');
      return;
    }

    setLoading(true);

    try {
      // Local calendar date + wall-clock time from pickers → one instant, then ISO UTC for the API.

      let imageUrl: string | null = null;
      if (image) {
        imageUrl = await uploadImage(image);
      }

      let finalLat = latitude;
      let finalLng = longitude;

      if (finalLat == null || finalLng == null) {
        const fallback = await geocodeFallback(address.trim());
        if (fallback) {
          finalLat = fallback.lat;
          finalLng = fallback.lng;
        }
      }

      const displayName = getPostAuthorDisplayName(currentUser);

      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: currentUser.userid,
          displayname: displayName,
          title: title.trim(),
          description: description.trim(),
          location: address.trim(),
          address: address.trim(),
          start_time: combinedDateTime.toISOString(),
          dateandtime: combinedDateTime.toISOString(),
          image_url: imageUrl,
          tagIds: selectedTagIds,
          latitude: finalLat,
          longitude: finalLng,
          price_min: isFree ? 0 : priceMin,
          price_max: isFree ? 0 : priceMax,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        Alert.alert('Error', payload?.error ?? 'Could not create this event. Please try again.');
        return;
      }

      Alert.alert('Success', 'Your post has been created!');

      setTitle('');
      setDescription('');
      setPriceMin(0);
      setPriceMax(50);
      setIsFree(true);
      setAddress('');
      setLocationSuggestions([]);
      setDate(new Date());
      setTime(new Date());
      setImage(null);
      setHasExtraMedia(false);
      setSelectedTagIds([]);
      setLatitude(null);
      setLongitude(null);
    } catch (err) {
      console.error('Failed to create post:', err);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Create Post</Text>

        <View style={styles.heroWrapper}>
          <Image
            source={{ uri: image || SAMPLE_IMAGE }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          <Pressable style={styles.imageEditButton} onPress={handlePickImage}>
            <Text style={styles.imageEditButtonText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#9ca3af"
            style={styles.largeTitleInput}
          />

          <View>
            <Text style={styles.sectionLabel}>Tags</Text>
            <Pressable style={styles.inputBox} onPress={() => setShowTagModal(true)}>
              <Text
                style={[
                  styles.inputText,
                  selectedTagNames.length === 0 && styles.placeholderText,
                ]}
              >
                {selectedTagNames.length > 0
                  ? selectedTagNames.join(', ')
                  : 'Choose one or more tags'}
              </Text>
            </Pressable>

            {selectedTagNames.length > 0 && (
              <View style={styles.tagChipRow}>
                {selectedTagNames.map((name) => (
                  <View key={name} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Modal visible={showTagModal} transparent animationType="slide">
            <Pressable style={styles.modalOverlay} onPress={() => setShowTagModal(false)}>
              <Pressable style={styles.modalContent} onPress={() => {}}>
                <Text style={styles.modalTitle}>Select Tags</Text>

                <FlatList
                  data={tags}
                  keyExtractor={(item) => item.tagid.toString()}
                  renderItem={({ item }) => {
                    const selected = selectedTagIds.includes(item.tagid);

                    return (
                      <Pressable
                        style={[styles.tagOption, selected && styles.tagOptionSelected]}
                        onPress={() => toggleTag(item.tagid)}
                      >
                        <Text
                          style={[
                            styles.tagOptionText,
                            selected && styles.tagOptionTextSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={styles.checkMark}>{selected ? '✓' : ''}</Text>
                      </Pressable>
                    );
                  }}
                />

                <Pressable style={styles.doneButton} onPress={() => setShowTagModal(false)}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <View>
            <Text style={styles.sectionLabel}>Date</Text>
            <View style={styles.dateTimeRow}>
              <Pressable
                style={[styles.inputBox, styles.dateBox]}
                onPress={() => {
                  setShowDatePicker((prev) => !prev);
                  if (showTimePicker) setShowTimePicker(false);
                }}
              >
                <Text style={styles.inputText}>{formattedDate}</Text>
              </Pressable>

              <Pressable
                style={styles.timeBox}
                onPress={() => {
                  setShowTimePicker((prev) => !prev);
                  if (showDatePicker) setShowDatePicker(false);
                }}
              >
                <Text style={styles.timeBoxText}>{formattedTime}</Text>
              </Pressable>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              onChange={handleDateChange}
              textColor="#FFFFFF"
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              onChange={handleTimeChange}
              textColor="#FFFFFF"
            />
          )}

          <View style={styles.locationGroup}>
            <Text style={styles.sectionLabel}>Location</Text>
            <TextInput
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setLatitude(null);
                setLongitude(null);
                if (!isLocationFocused) setIsLocationFocused(true);
              }}
              onFocus={() => setIsLocationFocused(true)}
              placeholder="Enter a location"
              placeholderTextColor="#9ca3af"
              style={styles.inputBox}
            />

            {(searchingPlaces || locationSuggestions.length > 0) && (
              <View style={styles.suggestionsCard}>
                {searchingPlaces ? (
                  <View style={styles.suggestionLoading}>
                    <ActivityIndicator size="small" color="#111827" />
                    <Text style={styles.suggestionLoadingText}>Finding places...</Text>
                  </View>
                ) : (
                  locationSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.placeId}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setAddress(suggestion.fullText);
                        setLocationSuggestions([]);
                        setIsLocationFocused(false);
                        fetchPlaceCoordinates(suggestion.placeId);
                      }}
                    >
                      <Text style={styles.suggestionPrimary}>{suggestion.primaryText}</Text>
                      {!!suggestion.secondaryText && (
                        <Text style={styles.suggestionSecondary}>{suggestion.secondaryText}</Text>
                      )}
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>

          <View>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Write something about your post..."
              placeholderTextColor="#9ca3af"
              style={[styles.inputBox, styles.descriptionBox]}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <View>
            <Text style={styles.sectionLabel}>Price</Text>
            <Pressable style={styles.toggleRow} onPress={() => setIsFree((prev) => !prev)}>
              <View style={[styles.toggleTrack, isFree && styles.toggleTrackActive]}>
                <View style={[styles.toggleThumb, isFree && styles.toggleThumbActive]} />
              </View>
              <Text style={styles.toggleLabel}>{isFree ? 'Free' : 'Not Free'}</Text>
            </Pressable>

            {!isFree && (
              <View style={styles.sliderContainer}>
                <Text style={styles.priceRangeDisplay}>
                  ${priceMin} – ${priceMax}
                </Text>

                <View style={styles.sliderRow}>
                  <Text style={styles.sliderEdgeLabel}>$0</Text>
                  <View style={{ flex: 1 }}>
                    <RangeSlider
                      minValue={priceMin}
                      maxValue={priceMax}
                      onMinChange={setPriceMin}
                      onMaxChange={setPriceMax}
                    />
                  </View>
                  <Text style={styles.sliderEdgeLabel}>$200</Text>
                </View>

              </View>
            )}
          </View>

          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Post</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginBottom: 16,
    marginHorizontal: 20,
    marginTop: 8,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  heroWrapper: {
    position: 'relative',
    marginBottom: 20,
    marginHorizontal: 16,
  },
  heroImage: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.cream,
    borderRadius: 0,
  },
  imageEditButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.yellow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
  },
  imageEditButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  form: {
    gap: 18,
    paddingHorizontal: 16,
  },
  largeTitleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 4,
  },
  inputBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#111827',
    borderWidth: 3,
    borderColor: COLORS.border,
    fontWeight: '700',
  },
  inputText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  placeholderText: {
    color: COLORS.textLight,
  },
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  tagChip: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  tagChipText: {
    color: COLORS.textOnDark,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTimeRow: {
    flexDirection: 'row',
    borderRadius: 0,
    overflow: 'hidden',
  },
  dateBox: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  timeBox: {
    width: 130,
    backgroundColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.border,
  },
  timeBoxText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionBox: {
    minHeight: 130,
    paddingTop: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  toggleLabel: {
    color: COLORS.textOnDark,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackActive: {
    backgroundColor: COLORS.yellow,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  sliderContainer: {
    gap: 10,
  },
  priceRangeDisplay: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.yellow,
    textAlign: 'center',
    letterSpacing: 1,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderEdgeLabel: {
    color: COLORS.textOnDark,
    fontSize: 12,
    fontWeight: '700',
    width: 34,
    textAlign: 'center',
  },
  locationGroup: {
    gap: 8,
  },
  suggestionsCard: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    backgroundColor: COLORS.cardBackground,
    overflow: 'hidden',
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  suggestionLoadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  suggestionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  suggestionSecondary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.red,
    borderRadius: 0,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  submitButtonText: {
    color: COLORS.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  tagOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  tagOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagOptionText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagOptionTextSelected: {
    color: COLORS.textOnDark,
    fontWeight: '900',
  },
  checkMark: {
    fontSize: 20,
    color: COLORS.yellow,
    fontWeight: '900',
  },
  doneButton: {
    marginTop: 20,
    backgroundColor: COLORS.red,
    borderRadius: 0,
    alignItems: 'center',
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
  },
  doneButtonText: {
    color: COLORS.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
