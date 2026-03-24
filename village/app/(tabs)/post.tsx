import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import * as Location from 'expo-location';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const SAMPLE_IMAGE =
  'https://placehold.net/600x400.png';

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

export default function PostScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollType, setPollType] = useState<PollType>('multiple-choice');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

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

  const removeMedia = () => {
    setImage(null);
    setHasExtraMedia(false);
  };

  const removeLink = () => {
    setShowLink(false);
    setLinkTitle('');
    setLinkUrl('');
  };

  const removePoll = () => {
    setShowPoll(false);
    setPollQuestion('');
    setPollType('multiple-choice');
    setPollOptions(['', '']);
  };

  const addPollOption = () => {
    setPollOptions((prev) => [...prev, '']);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const selectedTagNames = tags
    .filter((tag) => selectedTagIds.includes(tag.tagid))
    .map((tag) => tag.name);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !address.trim()) {
      Alert.alert('Missing fields', 'Please fill in title, description, and location.');
      return;
    }

    setLoading(true);

    try {
      const combinedDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes()
      );

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

      await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: 1,
          displayname: 'SyedK',
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
          link: showLink
            ? {
                title: linkTitle.trim(),
                url: linkUrl.trim(),
              }
            : null,
          poll: showPoll
            ? {
                question: pollQuestion.trim(),
                type: pollType,
                options:
                  pollType === 'short-answer'
                    ? []
                    : pollOptions.map((option) => option.trim()).filter(Boolean),
              }
            : null,
        }),
      });

      Alert.alert('Success', 'Your post has been created!');

      setTitle('');
      setDescription('');
      setAddress('');
      setLocationSuggestions([]);
      setDate(new Date());
      setTime(new Date());
      setImage(null);
      setHasExtraMedia(false);
      setSelectedTagIds([]);
      setLatitude(null);
      setLongitude(null);
      setShowPoll(false);
      setShowLink(false);
      setPollQuestion('');
      setPollType('multiple-choice');
      setPollOptions(['', '']);
      setLinkTitle('');
      setLinkUrl('');
      setShowAddMenu(false);
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
    <View style={styles.screen}>
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
              textColor="#111827"
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              onChange={handleTimeChange}
              textColor="#111827"
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

          {hasExtraMedia && image && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Extra Media</Text>
                <Pressable style={styles.deletePill} onPress={removeMedia}>
                  <Text style={styles.deletePillText}>Delete</Text>
                </Pressable>
              </View>

              <Image source={{ uri: image }} style={styles.extraMediaPreview} />
            </View>
          )}

          {showLink && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Link</Text>
                <Pressable style={styles.deletePill} onPress={removeLink}>
                  <Text style={styles.deletePillText}>Delete</Text>
                </Pressable>
              </View>

              <TextInput
                value={linkTitle}
                onChangeText={setLinkTitle}
                placeholder="Link title (ex: Parking Form, Spotify Playlist)"
                placeholderTextColor="#9ca3af"
                style={styles.inputBox}
              />

              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="Paste URL"
                placeholderTextColor="#9ca3af"
                style={styles.inputBox}
                autoCapitalize="none"
              />
            </View>
          )}

          {showPoll && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Poll</Text>
                <Pressable style={styles.deletePill} onPress={removePoll}>
                  <Text style={styles.deletePillText}>Delete</Text>
                </Pressable>
              </View>

              <TextInput
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholder="Poll question"
                placeholderTextColor="#9ca3af"
                style={styles.inputBox}
              />

              <Text style={styles.subLabel}>Question Type</Text>
              <View style={styles.pollTypeRow}>
                <Pressable
                  style={[
                    styles.pollTypeButton,
                    pollType === 'multiple-choice' && styles.pollTypeButtonActive,
                  ]}
                  onPress={() => setPollType('multiple-choice')}
                >
                  <Text
                    style={[
                      styles.pollTypeButtonText,
                      pollType === 'multiple-choice' && styles.pollTypeButtonTextActive,
                    ]}
                  >
                    Multiple Choice
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.pollTypeButton,
                    pollType === 'checkbox' && styles.pollTypeButtonActive,
                  ]}
                  onPress={() => setPollType('checkbox')}
                >
                  <Text
                    style={[
                      styles.pollTypeButtonText,
                      pollType === 'checkbox' && styles.pollTypeButtonTextActive,
                    ]}
                  >
                    Checkbox
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.pollTypeButton,
                    pollType === 'short-answer' && styles.pollTypeButtonActive,
                  ]}
                  onPress={() => setPollType('short-answer')}
                >
                  <Text
                    style={[
                      styles.pollTypeButtonText,
                      pollType === 'short-answer' && styles.pollTypeButtonTextActive,
                    ]}
                  >
                    Short Answer
                  </Text>
                </Pressable>
              </View>

              {pollType !== 'short-answer' && (
                <>
                  <Text style={styles.subLabel}>Options</Text>

                  {pollOptions.map((option, index) => (
                    <View key={index} style={styles.pollOptionRow}>
                      <TextInput
                        value={option}
                        onChangeText={(text) => updatePollOption(index, text)}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor="#9ca3af"
                        style={[styles.inputBox, styles.pollOptionInput]}
                      />

                      {pollOptions.length > 2 && (
                        <Pressable
                          style={styles.smallDeleteButton}
                          onPress={() => removePollOption(index)}
                        >
                          <Text style={styles.smallDeleteButtonText}>X</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}

                  <Pressable style={styles.addOptionButton} onPress={addPollOption}>
                    <Text style={styles.addOptionButtonText}>+ Add Another Option</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Post</Text>}
          </Pressable>
        </View>
      </ScrollView>

      {showAddMenu && (
        <View style={styles.fabMenu}>
          <Pressable
            style={styles.fabMenuItem}
            onPress={() => {
              handlePickImage();
              setShowAddMenu(false);
            }}
          >
            <Text style={styles.fabMenuText}>Add Media</Text>
          </Pressable>

          <Pressable
            style={styles.fabMenuItem}
            onPress={() => {
              setShowPoll(true);
              setShowAddMenu(false);
            }}
          >
            <Text style={styles.fabMenuText}>Add Poll</Text>
          </Pressable>

          <Pressable
            style={styles.fabMenuItem}
            onPress={() => {
              setShowLink(true);
              setShowAddMenu(false);
            }}
          >
            <Text style={styles.fabMenuText}>Add Link</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.fab} onPress={() => setShowAddMenu((prev) => !prev)}>
        <Text style={styles.fabPlus}>{showAddMenu ? '×' : '+'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f3f3',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f3f3',
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 140,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#000',
    marginBottom: 18,
  },
  heroWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#ddd',
  },
  imageEditButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  imageEditButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: 14,
  },
  largeTitleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
    marginBottom: 4,
  },
  inputBox: {
    backgroundColor: '#e8e8e8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  inputText: {
    fontSize: 15,
    color: '#111827',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagChip: {
    backgroundColor: '#6b8752',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tagChipText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  dateTimeRow: {
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
  },
  dateBox: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  timeBox: {
    width: 110,
    backgroundColor: '#6b8752',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  timeBoxText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  descriptionBox: {
    minHeight: 130,
    paddingTop: 14,
  },
  sectionCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deletePill: {
    backgroundColor: '#eadfdf',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  deletePillText: {
    color: '#8b1e1e',
    fontSize: 13,
    fontWeight: '700',
  },
  extraMediaPreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  pollTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pollTypeButton: {
    backgroundColor: '#ececec',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pollTypeButtonActive: {
    backgroundColor: '#6b8752',
  },
  pollTypeButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  pollTypeButtonTextActive: {
    color: '#fff',
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollOptionInput: {
    flex: 1,
  },
  smallDeleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eadfdf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallDeleteButtonText: {
    color: '#8b1e1e',
    fontWeight: '700',
  },
  addOptionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#edf3e8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addOptionButtonText: {
    color: '#4d6638',
    fontWeight: '700',
    fontSize: 14,
  },
  locationGroup: {
    gap: 6,
  },
  suggestionsCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  suggestionLoadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  suggestionSecondary: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    left: 22,
    bottom: 22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  fabPlus: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '400',
    lineHeight: 38,
  },
  fabMenu: {
    position: 'absolute',
    left: 22,
    bottom: 98,
    gap: 10,
  },
  fabMenuItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    elevation: 5,
  },
  fabMenuText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  tagOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagOptionSelected: {
    backgroundColor: '#f1f5f9',
  },
  tagOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  tagOptionTextSelected: {
    fontWeight: '700',
  },
  checkMark: {
    fontSize: 18,
    color: '#6b8752',
    fontWeight: '700',
  },
  doneButton: {
    marginTop: 14,
    backgroundColor: '#111827',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});