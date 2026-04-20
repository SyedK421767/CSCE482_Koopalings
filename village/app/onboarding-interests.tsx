import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { HobbyPicker, type HobbyTag } from '@/components/hobby-picker';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';

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
      router.replace('/login');
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
    backgroundColor: COLORS.background,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    color: COLORS.textOnDark,
    lineHeight: 24,
    fontWeight: '600',
  },
  pickerWrapper: {
    flex: 1,
    minHeight: 200,
  },
  footer: {
    gap: 16,
    marginTop: 32,
  },
  continueButton: {
    backgroundColor: COLORS.red,
    borderRadius: 0,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  continueButtonText: {
    color: COLORS.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.yellow,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
