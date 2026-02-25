import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

type Profile = {
  profileid: number;
  userid: number;
  displayname: string;
  profilepicture: string | null;
  bio: string | null;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/profiles`);
      const text = await response.text();
      if (!response.ok) {
        console.error('Profiles fetch failed:', response.status, text.slice(0, 100));
        return;
      }
      const data = text.startsWith('[') || text.startsWith('{') ? JSON.parse(text) : null;
      setProfile(Array.isArray(data) ? data[0] ?? null : null);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.emptyText}>No profile data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        {profile.profilepicture && (
          <Image source={{ uri: profile.profilepicture }} style={styles.profileImage} />
        )}
        <Text style={styles.label}>Display name</Text>
        <Text style={styles.value}>{profile.displayname || '—'}</Text>

        <Text style={styles.label}>Bio</Text>
        <Text style={styles.value}>{profile.bio || 'No bio yet.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
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
