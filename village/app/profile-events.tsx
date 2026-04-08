import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/context/auth-context';
import { formatEventStartForDisplay } from '@/lib/event-datetime';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

type Post = {
  postid: number;
  userid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
};

const COLORS = {
  background: '#062f66',
  cardBackground: '#FFFFFF',
  primary: '#2743bc',
  textPrimary: '#062f66',
  textSecondary: '#5a6c8c',
  textOnDark: '#FFFFFF',
  border: '#E5E7EB',
  shadow: '#000000',
};

export default function ProfileEventsScreen() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/posts`);
      if (!res.ok) {
        console.error('Failed to fetch events');
        return;
      }
      const data = (await res.json()) as Post[];
      const now = new Date();
      const mine = data
        .filter(
          (p) => p.userid === currentUser.userid && p.start_time && new Date(p.start_time) >= now
        )
        .sort((a, b) => {
          const aTime = new Date(a.start_time).getTime();
          const bTime = new Date(b.start_time).getTime();
          return aTime - bTime;
        });
      setEvents(mine);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      void fetchEvents();
    }, [fetchEvents])
  );

  const renderItem = ({ item }: { item: Post }) => (
    <View style={styles.eventCard}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
      <View style={styles.eventCardBody}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDetail}>📍 {item.location}</Text>
        <Text style={styles.eventDetail}>
          🕐 {formatEventStartForDisplay(item.start_time)}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'All Events',
          headerBackTitleVisible: false,
        }}
      />
      <View style={styles.container}>
        {loading && events.length === 0 ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.postid.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>You have no upcoming events.</Text>
                <Text style={styles.emptyStateSubText}>Create one from the Post tab.</Text>
              </View>
            }
            renderItem={renderItem}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  eventCard: {
    backgroundColor: COLORS.cardBackground,
    borderLeftWidth: 8,
    borderLeftColor: COLORS.primary,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.primary,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.cardBackground,
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
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textOnDark,
    marginBottom: 6,
  },
  emptyStateSubText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
