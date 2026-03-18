import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Circle, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

type Post = {
  postid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
};

type EventMarker = {
  postid: number;
  title: string;
  location: string;
  latitude: number;
  longitude: number;
};

export default function ExploreScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [searchText, setSearchText] = useState('');
  const [showMap, setShowMap] = useState(false);

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);

  //use-states for filtering through posts
  const [showFilters, setShowFilters] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [hasImageOnly, setHasImageOnly] = useState(false);

  //use-states for hardcoded location pins
  const [eventMarkers, setEventMarkers] = useState<EventMarker[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(false);

  //hard-coded hobbies
  const hobbies = [
    'All',
    'Hiking',
    'Food',
    'Sports',
    'Music',
    'Gaming',
    'Art',
    'Study',
    'Movies',
    'Fitness',
  ];

  const [selectedHobby, setSelectedHobby] = useState('All');

  const radiusMiles = 1;
  const radiusMeters = radiusMiles * 1609.34;

  const fetchPosts = async () => {
    try {
      const response = await fetch(`${API_URL}/posts`);
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const requestAndFetchLocation = async () => {
    setIsLoadingLocation(true);
    setError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission was denied.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCoords(position.coords);
    } catch {
      setError('Could not fetch your location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    requestAndFetchLocation();
  }, []);

  //useEffect for hard-coded pins
  useEffect(() => {
    if (posts.length > 0) {
      geocodePostLocations();
    }
  }, [posts]);
  ///////////////

  //hard-coded location pins
  const geocodePostLocations = async () => {
    setLoadingMarkers(true);

    try {
      const results = await Promise.all(
        posts.map(async (post): Promise<EventMarker | null> => {
          if (!post.location?.trim()) return null;

          try {
            const geo = await Location.geocodeAsync(post.location);

            if (geo.length > 0) {
              const { latitude, longitude } = geo[0];

              if (
                typeof latitude === 'number' &&
                typeof longitude === 'number'
              ) {
                return {
                  postid: post.postid,
                  title: post.title,
                  location: post.location,
                  latitude,
                  longitude,
                };
              }
            }
          } catch {
            console.log('Geocode failed:', post.location);
          }

          return null;
        })
      );

      setEventMarkers(results.filter((marker): marker is EventMarker => marker !== null));
    } catch (err) {
      console.error('Geocoding failed:', err);
    } finally {
      setLoadingMarkers(false);
    }
  };
  //////////

  const filteredPosts = useMemo(() => {
    const searchQuery = searchText.toLowerCase().trim();
    const locationQuery = locationFilter.toLowerCase().trim();
    const creatorQuery = creatorFilter.toLowerCase().trim();
    const hobbyQuery = selectedHobby.toLowerCase().trim();
    const now = new Date();

    return posts.filter((post) => {
      const title = post.title?.toLowerCase() || '';
      const creator = post.displayname?.toLowerCase() || '';
      const location = post.location?.toLowerCase() || '';
      const description = post.description?.toLowerCase() || '';

      const matchesSearch =
        !searchQuery ||
        title.includes(searchQuery) ||
        creator.includes(searchQuery) ||
        location.includes(searchQuery) ||
        description.includes(searchQuery);

      const matchesLocation = !locationQuery || location.includes(locationQuery);

      const matchesCreator = !creatorQuery || creator.includes(creatorQuery);

      const matchesUpcoming =
        !upcomingOnly ||
        (post.start_time && new Date(post.start_time.replace('Z', '')) >= now);

      const matchesImage = !hasImageOnly || !!post.image_url;

      const matchesHobby =
        selectedHobby === 'All' ||
        title.includes(hobbyQuery) ||
        description.includes(hobbyQuery);

      return (
        matchesSearch &&
        matchesLocation &&
        matchesCreator &&
        matchesUpcoming &&
        matchesImage &&
        matchesHobby
      );
    });
  }, [
    posts,
    searchText,
    locationFilter,
    creatorFilter,
    upcomingOnly,
    hasImageOnly,
    selectedHobby,
  ]);

  const filteredEventMarkers = useMemo(() => {
    const filteredPostIds = new Set(filteredPosts.map((post) => post.postid));

    return eventMarkers.filter(
      (marker) =>
        marker &&
        filteredPostIds.has(marker.postid) &&
        typeof marker.latitude === 'number' &&
        typeof marker.longitude === 'number'
    );
  }, [eventMarkers, filteredPosts]);

  const mapKey = useMemo(() => {
    const markerIds = filteredEventMarkers
      .map((marker) => marker.postid)
      .sort((a, b) => a - b)
      .join('-');

    return `${selectedHobby}-${locationFilter}-${creatorFilter}-${upcomingOnly}-${hasImageOnly}-${markerIds}`;
  }, [
    filteredEventMarkers,
    selectedHobby,
    locationFilter,
    creatorFilter,
    upcomingOnly,
    hasImageOnly,
  ]);

  const mapRegion = useMemo(() => {
    if (!coords) return null;

    const latitudeDelta = (radiusMeters * 2.4) / 111320;
    const longitudeDelta =
      (radiusMeters * 2.4) /
      (111320 * Math.max(Math.cos((coords.latitude * Math.PI) / 180), 0.2));

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta,
      longitudeDelta,
    };
  }, [coords, radiusMeters]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search events, hobbies, or places"
          placeholderTextColor="#8b8b8b"
          value={searchText}
          onChangeText={setSearchText}
        />

        <Pressable
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options-outline" size={20} color="#374151" />
        </Pressable>
      </View>
      <View style={styles.hobbyCarouselWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hobbyCarousel}
        >
          {hobbies.map((hobby) => {
            const isSelected = selectedHobby === hobby;

            return (
              <Pressable
                key={hobby}
                onPress={() => {
                  if (selectedHobby !== hobby) {
                    setSelectedHobby(hobby);
                  }
                }}
                style={[styles.hobbyChip, isSelected && styles.hobbyChipSelected]}
              >
                <Text
                  style={[
                    styles.hobbyChipText,
                    isSelected && styles.hobbyChipTextSelected,
                  ]}
                >
                  {hobby}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!showMap ? (
        loadingPosts ? (
          <ActivityIndicator size="large" color="#111827" style={styles.loaderLarge} />
        ) : (
          <FlatList
            data={filteredPosts}
            keyExtractor={(item) => item.postid.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={styles.postCard} onPress={() => setSelectedPost(item)}>
                {item.image_url && (
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                )}
                <Text style={styles.postTitle}>{item.title}</Text>
                <Text style={styles.postAuthor}>by {item.displayname}</Text>
                <Text style={styles.postDetail}>📍 {item.location}</Text>
                <Text style={styles.postDetail}>
                  🕐{' '}
                  {item.start_time
                    ? new Date(item.start_time.replace('Z', '')).toLocaleString()
                    : 'No time set'}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No events match your search.</Text>
            }
          />
        )
      ) : (
        <View style={styles.mapSection}>
          <Pressable
            style={styles.locationButton}
            onPress={requestAndFetchLocation}
            disabled={isLoadingLocation}
          >
            <Text style={styles.locationButtonText}>
              {coords ? 'Refresh Location' : 'Allow Location Access'}
            </Text>
          </Pressable>

          {isLoadingLocation ? <ActivityIndicator size="small" style={styles.loader} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {coords && mapRegion ? (
            <MapView
              key={mapKey}
              style={styles.map}
              initialRegion={mapRegion}
              showsUserLocation
            >
              <Marker
                tracksViewChanges={false}
                coordinate={{
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                }}
                title="You are here"
              />

              <Circle
                center={{
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                }}
                radius={radiusMeters}
                strokeColor="rgba(29, 78, 216, 0.8)"
                fillColor="rgba(59, 130, 246, 0.2)"
              />

              {filteredEventMarkers.map((marker) => {
                if (
                  typeof marker.latitude !== 'number' ||
                  typeof marker.longitude !== 'number'
                ) {
                  return null;
                }

                return (
                  <Marker
                    key={marker.postid}
                    tracksViewChanges={false}
                    coordinate={{
                      latitude: marker.latitude,
                      longitude: marker.longitude,
                    }}
                    title={marker.title}
                    description={marker.location}
                    pinColor="red"
                    onPress={() => {
                      const selected = posts.find((p) => p.postid === marker.postid) || null;
                      setSelectedPost(selected);
                    }}
                  />
                );
              })}
            </MapView>
          ) : (
            <Text style={styles.caption}>
              Grant location access to see your 1-mile radius area.
            </Text>
          )}
        </View>
      )}

      <Pressable
        style={styles.floatingButton}
        onPress={() => setShowMap((prev) => !prev)}
      >
        <Ionicons
          name={showMap ? 'list-outline' : 'map-outline'}
          size={24}
          color="#fff"
        />
      </Pressable>

      <Modal
        visible={selectedPost !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedPost(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={() => setSelectedPost(null)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>

            {selectedPost && (
              <>
                {selectedPost.image_url && (
                  <Image source={{ uri: selectedPost.image_url }} style={styles.modalImage} />
                )}

                <Text style={styles.modalTitle}>{selectedPost.title}</Text>
                <Text style={styles.modalAuthor}>by {selectedPost.displayname}</Text>

                <View style={styles.divider} />

                <Text style={styles.modalDetail}>📍 {selectedPost.location}</Text>
                <Text style={styles.modalDetail}>
                  🕐{' '}
                  {selectedPost.start_time
                    ? new Date(selectedPost.start_time.replace('Z', '')).toLocaleString()
                    : 'No time set'}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.descriptionLabel}>About this event</Text>
                <Text style={styles.description}>
                  {selectedPost.description || 'No description provided.'}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
      
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
          >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Location</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Filter by location"
                placeholderTextColor="#8b8b8b"
                value={locationFilter}
                onChangeText={setLocationFilter}
              />

              <Text style={styles.filterLabel}>Creator</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Filter by creator"
                placeholderTextColor="#8b8b8b"
                value={creatorFilter}
                onChangeText={setCreatorFilter}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Upcoming events only</Text>
                <Switch value={upcomingOnly} onValueChange={setUpcomingOnly} />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Only posts with images</Text>
                <Switch value={hasImageOnly} onValueChange={setHasImageOnly} />
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setLocationFilter('');
                  setCreatorFilter('');
                  setUpcomingOnly(false);
                  setHasImageOnly(false);
                  setSelectedHobby('All');
                }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>

              <Pressable
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 64,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButton: {
    marginLeft: 10,
    height: 48,
    width: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  loaderLarge: {
    marginTop: 24,
  },
  list: {
    gap: 12,
    paddingBottom: 100,
  },
  postCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 10,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  postAuthor: {
    fontSize: 14,
    color: '#4b5563',
  },
  postDetail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyText: {
    marginTop: 24,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  mapSection: {
    //paddingBottom: 100,
    flex: 1,
  },
  locationButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    marginBottom: 8,
  },
  error: {
    color: '#b91c1c',
    marginBottom: 10,
  },
  map: {
    flex: 1,
    borderRadius: 0,
  },
  caption: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  filterModalContent: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  maxHeight: '80%',
},

  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  filterTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },

  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },

  filterInput: {
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  switchLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    marginRight: 12,
  },

  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },

  clearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  applyButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#111827',
  },

  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6b7280',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalAuthor: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginVertical: 12,
  },
  modalDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
  hobbyCarouselWrapper: {
    height: 50,
    marginBottom: 12,
    justifyContent: 'center',
  },

  hobbyCarousel: {
    paddingHorizontal: 2,
    alignItems: 'center',
  },

  hobbyChip: {
    height: 38,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  hobbyChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },

  hobbyChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  hobbyChipTextSelected: {
    color: '#fff',
  },
});