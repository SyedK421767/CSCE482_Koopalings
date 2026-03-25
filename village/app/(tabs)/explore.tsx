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
import Slider from '@react-native-community/slider';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

type Post = {
  postid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Tag = {
  tagid: number;
  name: string;
};

type PostTag = {
  postid: number;
  tagid: number;
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

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [radiusEnabled, setRadiusEnabled] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [hasImageOnly, setHasImageOnly] = useState(false);

  // Dynamic tags from DB
  const [tags, setTags] = useState<Tag[]>([]);
  const [postTags, setPostTags] = useState<PostTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null); // null = "All"

  // Build a lookup: postid -> set of tagids
  const postTagMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const pt of postTags) {
      if (!map.has(pt.postid)) {
        map.set(pt.postid, new Set());
      }
      map.get(pt.postid)!.add(pt.tagid);
    }
    return map;
  }, [postTags]);

  const radiusMeters = radiusMiles * 1609.34;

  // Haversine distance in miles
  const getDistanceMiles = (
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 3958.8; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

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

  const fetchTags = async () => {
    try {
      const response = await fetch(`${API_URL}/tags`);
      const data = await response.json();
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  };

  const fetchPostTags = async () => {
    try {
      const response = await fetch(`${API_URL}/tags/post-tags`);
      const data = await response.json();
      setPostTags(data);
    } catch (err) {
      console.error('Failed to fetch post-tags:', err);
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
    fetchTags();
    fetchPostTags();
    requestAndFetchLocation();
  }, []);

  const filteredPosts = useMemo(() => {
    const searchQuery = searchText.toLowerCase().trim();
    const creatorQuery = creatorFilter.toLowerCase().trim();
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

      const matchesCreator = !creatorQuery || creator.includes(creatorQuery);

      const matchesUpcoming =
        !upcomingOnly ||
        (post.start_time && new Date(post.start_time.replace('Z', '')) >= now);

      const matchesImage = !hasImageOnly || !!post.image_url;

      // Tag filtering via post_tags junction table
      const matchesTag =
        selectedTagId === null ||
        (postTagMap.get(post.postid)?.has(selectedTagId) ?? false);

      // Distance filtering
      let matchesDistance = true;
      if (radiusEnabled && coords) {
        const postLat = Number(post.latitude);
        const postLng = Number(post.longitude);
        if (!isNaN(postLat) && !isNaN(postLng)) {
          const dist = getDistanceMiles(
            coords.latitude, coords.longitude,
            postLat, postLng
          );
          matchesDistance = dist <= radiusMiles;
        }
      }

      return (
        matchesSearch &&
        matchesCreator &&
        matchesUpcoming &&
        matchesImage &&
        matchesTag &&
        matchesDistance
      );
    });
  }, [
    posts,
    searchText,
    creatorFilter,
    upcomingOnly,
    hasImageOnly,
    selectedTagId,
    postTagMap,
    radiusEnabled,
    radiusMiles,
    coords,
  ]);

  const eventMarkers: EventMarker[] = useMemo(() => {
    return posts
      .filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map((p) => ({
        postid: p.postid,
        title: p.title,
        location: p.location,
        latitude: p.latitude!,
        longitude: p.longitude!,
      }));
  }, [posts]);

  const filteredEventMarkers = useMemo(() => {
    const filteredPostIds = new Set(filteredPosts.map((post) => post.postid));
    return eventMarkers.filter((marker) => filteredPostIds.has(marker.postid));
  }, [eventMarkers, filteredPosts]);

  const mapKey = useMemo(() => {
    const markerIds = filteredEventMarkers
      .map((marker) => marker.postid)
      .sort((a, b) => a - b)
      .join('-');

    return `${selectedTagId}-${radiusMiles}-${radiusEnabled}-${creatorFilter}-${upcomingOnly}-${hasImageOnly}-${markerIds}`;
  }, [
    filteredEventMarkers,
    selectedTagId,
    radiusMiles,
    radiusEnabled,
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

      {/* Active filter indicators */}
      {(selectedTagId !== null || radiusEnabled) && (
        <View style={styles.activeTagRow}>
          {selectedTagId !== null && (
            <Pressable
              style={styles.activeTagChip}
              onPress={() => setSelectedTagId(null)}
            >
              <Text style={styles.activeTagText}>
                {tags.find((t) => t.tagid === selectedTagId)?.name ?? 'Tag'}
              </Text>
              <Ionicons name="close-circle" size={16} color="#4F46E5" style={{ marginLeft: 4 }} />
            </Pressable>
          )}
          {radiusEnabled && (
            <Pressable
              style={[styles.activeTagChip, selectedTagId !== null && { marginLeft: 8 }]}
              onPress={() => setRadiusEnabled(false)}
            >
              <Text style={styles.activeTagText}>
                Within {radiusMiles} {radiusMiles === 1 ? 'mi' : 'mi'}
              </Text>
              <Ionicons name="close-circle" size={16} color="#4F46E5" style={{ marginLeft: 4 }} />
            </Pressable>
          )}
        </View>
      )}

      {!showMap ? (
        loadingPosts ? (
          <ActivityIndicator size="large" color="#111827" style={styles.loaderLarge} />
        ) : (
          <View style={styles.postCardsContainer}>
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
          </View>
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

      {/* Post detail modal */}
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

      {/* Filter modal */}
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
              <Text style={styles.filterLabel}>Distance</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Filter by distance</Text>
                <Switch value={radiusEnabled} onValueChange={setRadiusEnabled} />
              </View>
              {radiusEnabled && (
                <View style={styles.sliderSection}>
                  {!coords && (
                    <Text style={styles.sliderHint}>
                      Enable location access to use distance filter
                    </Text>
                  )}
                  <Text style={styles.sliderValue}>{radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={50}
                    step={1}
                    value={radiusMiles}
                    onValueChange={setRadiusMiles}
                    minimumTrackTintColor="#4F46E5"
                    maximumTrackTintColor="#e5e7eb"
                    thumbTintColor="#4F46E5"
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelText}>1 mi</Text>
                    <Text style={styles.sliderLabelText}>50 mi</Text>
                  </View>
                </View>
              )}

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

              <Text style={styles.filterLabel}>Tag</Text>
              <View style={styles.tagGrid}>
                <Pressable
                  onPress={() => setSelectedTagId(null)}
                  style={[
                    styles.tagGridChip,
                    selectedTagId === null && styles.tagGridChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagGridChipText,
                      selectedTagId === null && styles.tagGridChipTextSelected,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>
                {tags.map((tag) => {
                  const isSelected = selectedTagId === tag.tagid;
                  return (
                    <Pressable
                      key={tag.tagid}
                      onPress={() => setSelectedTagId(isSelected ? null : tag.tagid)}
                      style={[
                        styles.tagGridChip,
                        isSelected && styles.tagGridChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagGridChipText,
                          isSelected && styles.tagGridChipTextSelected,
                        ]}
                      >
                        {tag.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setRadiusEnabled(false);
                  setRadiusMiles(10);
                  setCreatorFilter('');
                  setUpcomingOnly(false);
                  setHasImageOnly(false);
                  setSelectedTagId(null);
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
    backgroundColor: '#e8f3f8',
    paddingTop: 64,
    paddingHorizontal: 10,
    alignContent: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    margin: 8,
    marginTop: 36,
    marginBottom: 36,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
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
    backgroundColor: '#7eacc3',
    justifyContent: 'center',
    alignItems: 'center',
    // borderWidth: 1,
    // borderColor: '#e5e7eb',
  },
  loaderLarge: {
    marginTop: 24,
  },
  postCardsContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  list: {
    gap: 12,
    paddingBottom: 100,
  },
  postCard: {
    borderWidth: 0,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 25,
    backgroundColor: '#cce6f7',
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
  activeTagRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  activeTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  activeTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  sliderSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#6b7280',
  },
  sliderHint: {
    fontSize: 13,
    color: '#b91c1c',
    marginBottom: 8,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagGridChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tagGridChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  tagGridChipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  tagGridChipTextSelected: {
    color: '#fff',
  },
});