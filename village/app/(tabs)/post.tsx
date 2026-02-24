import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

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
        }),
      });

      Alert.alert('Success', 'Your post has been created!');
      setTitle('');
      setDescription('');
      setAddress('');
      setDate(new Date());
      setTime(new Date());
      setImage(null);
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

        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Address / Location"
          placeholderTextColor="#9ca3af"
          style={styles.input}
        />

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
});