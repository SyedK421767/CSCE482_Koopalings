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

export default function PostScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);

  // Coordinates from place selection or fallback geocoding
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

  const selectedTagName = tags.find((t) => t.tagid === selectedTagId)?.name;

  useEffect(() => {
    if (!isLocationFocused) {
      return;
    }

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

  // Fetch lat/lng from Google Place Details when user selects a suggestion
  const fetchPlaceCoordinates = async (placeId: string) => {
    if (!GOOGLE_PLACES_API_KEY) return;

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'location',
          },
        }
      );

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

  // Fallback: geocode using expo-location if user typed an address without selecting a suggestion
  const geocodeFallback = async (addressText: string): Promise<{ lat: number; lng: number } | null> => {
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

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
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
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    } as any);
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

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !address.trim()) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      const combinedDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes(),
      );

      let imageUrl: string | null = null;
      if (image) {
        imageUrl = await uploadImage(image);
      }

      // Use stored coordinates, or try fallback geocoding
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
          tagIds: selectedTagId ? [selectedTagId] : [],
          latitude: finalLat,
          longitude: finalLng,
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
      setSelectedTagId(null);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Post</Text>
      <View style={styles.form}>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Event title"
          placeholderTextColor="#9ca3af"
          style={styles.input}
        />

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor="#9ca3af"
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.locationGroup}>
          <Text style={styles.locationTitle}>Where&apos;s it happening?</Text>
          <Text style={styles.locationSubtitle}>Search venue, street, or neighborhood</Text>
          <TextInput
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setLatitude(null);
              setLongitude(null);
              if (!isLocationFocused) setIsLocationFocused(true);
            }}
            onFocus={() => setIsLocationFocused(true)}
            placeholder="Start typing an address..."
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />
          {!GOOGLE_PLACES_API_KEY && (
            <Text style={styles.locationHint}>Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to enable autocomplete.</Text>
          )}
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

        {/* Tag selector */}
        <Pressable style={styles.pickerButton} onPress={() => setShowTagModal(true)}>
          <Text style={styles.pickerLabel}>Tag</Text>
          <Text style={[styles.pickerValue, !selectedTagName && { color: '#9ca3af' }]}>
            {selectedTagName || 'Select a tag...'}
          </Text>
        </Pressable>

        <Modal visible={showTagModal} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowTagModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select a Tag</Text>
              <FlatList
                data={tags}
                keyExtractor={(item) => item.tagid.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.tagOption,
                      item.tagid === selectedTagId && styles.tagOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedTagId(item.tagid);
                      setShowTagModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.tagOptionText,
                        item.tagid === selectedTagId && styles.tagOptionTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
              <Pressable style={styles.modalCancel} onPress={() => setShowTagModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.pickerLabel}>Date</Text>
          <Text style={styles.pickerValue}>{formattedDate}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            onChange={handleDateChange}
            textColor="#111827"
          />
        )}

        <Pressable style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.pickerLabel}>Time</Text>
          <Text style={styles.pickerValue}>{formattedTime}</Text>
        </Pressable>
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            onChange={handleTimeChange}
            textColor="#111827"
          />
        )}

        <Pressable style={styles.imagePicker} onPress={handlePickImage}>
          <Text style={styles.imagePickerText}>
            {image ? 'Change Photo' : 'Add Photo'}
          </Text>
        </Pressable>
        {image && (
          <Image source={{ uri: image }} style={styles.imagePreview} />
        )}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Post</Text>
          )}
        </Pressable>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
  },
  form: {
    gap: 10,
  },
  locationGroup: {
    gap: 6,
    marginBottom: 2,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  locationSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  locationHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111827',
  },
  suggestionsCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
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
    gap: 2,
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  suggestionSecondary: {
    fontSize: 13,
    color: '#6b7280',
  },
  textArea: {
    height: 100,
    paddingTop: 10,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  pickerValue: {
    fontSize: 15,
    color: '#111827',
  },
  imagePicker: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 15,
    color: '#6b7280',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  tagOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tagOptionSelected: {
    backgroundColor: '#f3f4f6',
  },
  tagOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  tagOptionTextSelected: {
    fontWeight: '600',
  },
  modalCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
});