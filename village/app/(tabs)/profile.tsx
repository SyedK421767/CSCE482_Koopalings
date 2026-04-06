import { FlatList, Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';

const COLORS = {
  background: '#062f66',
  cardBackground: '#FFFFFF',
  primary: '#2743bc',
  yellow: '#ffbd59',
  red: '#e34348',
  textPrimary: '#062f66',
  textSecondary: '#5a6c8c',
  textLight: '#8892a8',
  textOnDark: '#FFFFFF',
  border: '#E5E7EB',
  shadow: '#000000',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, setCurrentUser, setIsSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<{ tagid: number; name: string }[]>([]);
  const [pendingTagIds, setPendingTagIds] = useState<number[]>([]);
  const [currentTagIds, setCurrentTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

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
    return () => {
      active = false;
    };
  }, []);

  const displayName = useMemo(
    () => `${currentUser?.first_name ?? ''} ${currentUser?.last_name ?? ''}`.trim(),
    [currentUser]
  );

  const handleLogout = () => {
    setCurrentUser(null);
    setIsSignedIn(false);
    router.replace('/');
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

  const handleSaveSelection = () => {
    saveHobbies(pendingTagIds);
  };

  const handleResetSelection = () => {
    setPendingTagIds(currentTagIds);
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Sign in to manage your space.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}
         >
      <View style={styles.profileBox}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={48} color="#fff" />
        </View>
        <Text style={styles.name}>{displayName || currentUser.email}</Text>
        <Text style={styles.subtitle}>{currentUser.email}</Text>
      </View>

      <View style={styles.currentHobbiesBox}>
        <Text style={styles.sectionLabel}>Current Hobbies</Text>
        {hobbies.length > 0 ? (
          <FlatList
            data={hobbies}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.currentHobbyList}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.hobbyPill}>
                <Text style={styles.hobbyText}>{item}</Text>
              </View>
            )}
          />
        ) : (
          <Text style={styles.emptyHobbyText}>You have not saved hobbies yet.</Text>
        )}
      </View>

      <View style={styles.hobbiesBox}>
        <Text style={styles.sectionLabel}>Hobbies</Text>
        <FlatList
          data={tagOptions}
          keyExtractor={(item) => item.tagid.toString()}
          horizontal
          contentContainerStyle={styles.hobbyList}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = pendingTagIds.includes(item.tagid);
            return (
              <Pressable
                style={[styles.hobbyPill, selected && styles.hobbySelected]}
                onPress={() => handleToggleHobby(item.tagid)}
              >
                <Text style={[styles.hobbyText, selected && styles.hobbySelectedText]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyHobbyText}>Loading hobbies…</Text>}
        />
        <View style={styles.hobbyButtonsRow}>
          <Pressable
            style={[styles.saveHobbyButton, (saving || pendingMatches) && styles.disabledButton]}
            onPress={handleSaveSelection}
            disabled={saving || pendingMatches}
          >
            <Text style={styles.saveHobbyButtonText}>Save hobbies</Text>
          </Pressable>
          <Pressable style={styles.resetHobbyButton} onPress={handleResetSelection} disabled={saving}>
            <Text style={styles.resetHobbyButtonText}>Reset</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
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
    marginBottom: 16,
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: COLORS.yellow,
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
  hobbiesBox: {
    borderRadius: 0,
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 4,
  },
  currentHobbiesBox: {
    borderRadius: 0,
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  hobbyList: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  currentHobbyList: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  hobbyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.border,
    marginRight: 8,
    backgroundColor: COLORS.cardBackground,
  },
  hobbyText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyHobbyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  hobbySelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  hobbySelectedText: {
    color: COLORS.textOnDark,
  },
  hobbyButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  saveHobbyButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    borderRadius: 0,
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
  saveHobbyButtonText: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resetHobbyButton: {
    flex: 1,
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
  },
  resetHobbyButtonText: {
    color: COLORS.textPrimary,
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
  card: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    padding: 20,
    backgroundColor: COLORS.cardBackground,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 0,
    marginBottom: 16,
    alignSelf: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});
