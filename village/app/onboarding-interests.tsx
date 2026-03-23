import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { HobbyPicker, type HobbyTag } from '@/components/hobby-picker';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';

export default function OnboardingInterestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser } = useAuth();

  const [tagOptions, setTagOptions] = useState<HobbyTag[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.replace('/');
      return;
    }

    let active = true;
    const fetchTags = async () => {
      try {
        const res = await fetch(`${API_URL}/posts/tags`);
        if (!res.ok) return;
        const data = (await res.json()) as HobbyTag[];
        if (active) setTagOptions(data);
      } catch (err) {
        console.error('Failed to load hobbies:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTags();
    return () => { active = false; };
  }, [currentUser, router]);

  const saveHobbies = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/${currentUser.userid}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: selectedIds }),
      });

      const payload = await res.json();
      if (!res.ok) {
        Alert.alert('Error', payload?.error ?? 'Could not save interests.');
        return;
      }
      setCurrentUser(payload);
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Failed to save hobbies:', err);
      Alert.alert('Error', 'Could not save interests. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    saveHobbies();
  };

  const handleSkip = () => {
    router.replace('/(tabs)/home');
  };

  if (!currentUser) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Interests</Text>
        <Text style={styles.subtitle}>
          Pick hobbies you enjoy. This helps us personalize your experience.
        </Text>
      </View>

      <View style={styles.pickerWrapper}>
        <HobbyPicker
          tags={tagOptions}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          isLoading={loading}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, saving && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving…' : 'Continue'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.skipButton, saving && styles.buttonDisabled]}
          onPress={handleSkip}
          disabled={saving}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  pickerWrapper: {
    flex: 1,
    minHeight: 200,
  },
  footer: {
    gap: 12,
    marginTop: 24,
  },
  continueButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
