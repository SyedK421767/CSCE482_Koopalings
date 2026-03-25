import { FlatList, Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';

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
    backgroundColor: '#e8f3f8',
    paddingTop: 64,
    paddingHorizontal: 10,
    alignContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  profileBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  hobbiesBox: {
    // borderWidth: 1,
    // borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    // height: 500,
  },
  currentHobbiesBox: {
    // borderWidth: 1,
    // borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    // borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    backgroundColor: '#e5eef4',
  },
  hobbyText: {
    color: '#111827',
    fontWeight: '600',
  },
  emptyHobbyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  hobbySelected: {
    borderColor: '#2563eb',
    backgroundColor: '#7eacc3',
  },
  hobbySelectedText: {
    color: '#fff',
  },
  hobbyButtonsRow: {
    flexDirection: 'row',
  },
  saveHobbyButton: {
    flex: 1,
    backgroundColor: '#7eacc3',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveHobbyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  resetHobbyButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginLeft: 8,
  },
  resetHobbyButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignSelf: 'center',
    alignItems: 'center',
    width: '50%',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    // color: '#6b7280',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    alignSelf: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#111827',
  },
});
