import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { formatEventStartForDisplay, parseEventStart } from '@/lib/event-datetime';
import {
  ActivityIndicator,
  Animated,
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
import { useAuth } from '@/context/auth-context';
import { checkRsvpStatus, formatRsvpCategory, getRsvpInfo, RsvpInfo, toggleRsvp } from '@/lib/rsvp-api';

const API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

// Color Theme - matching home page
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

type Post = {
  postid: number;
  userid: number;
  title: string;
  displayname: string;
  location: string;
  start_time: string;
  description: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  price_min: number | null;
  price_max: number | null;
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
  const { currentUser } = useAuth();
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
  const [priceFilterEnabled, setPriceFilterEnabled] = useState(false);
  const [priceFilterMax, setPriceFilterMax] = useState(200);

  // RSVP state
  const [rsvpInfo, setRsvpInfo] = useState<RsvpInfo | null>(null);
  const [userRsvped, setUserRsvped] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [guestListModalVisible, setGuestListModalVisible] = useState(false);
  const modalSlideAnim = useRef(new Animated.Value(0)).current;

  // Dynamic tags from DB
  const [tags, setTags] = useState<Tag[]>([]);
  const [postTags, setPostTags] = useState<PostTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]); // empty = "All"

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

  const fetchPosts = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoadingPosts(true);
    try {
      const response = await fetch(`${API_URL}/posts`);
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      if (withSpinner) setLoadingPosts(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/tags`);
      const data = await response.json();
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, []);

  const fetchPostTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/tags/post-tags`);
      const data = await response.json();
      setPostTags(data);
    } catch (err) {
      console.error('Failed to fetch post-tags:', err);
    }
  }, []);

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

  const fetchRsvpInfo = useCallback(async (postid: number) => {
    if (!currentUser) return;
    try {
      const info = await getRsvpInfo(postid, currentUser.userid);
      setRsvpInfo(info);
      const rsvped = await checkRsvpStatus(postid, currentUser.userid);
      setUserRsvped(rsvped);
    } catch (err) {
      console.error('Failed to fetch RSVP info:', err);
    }
  }, [currentUser]);

  const handleToggleRsvp = async () => {
    if (!currentUser || !selectedPost) return;
    setRsvpLoading(true);
    try {
      const result = await toggleRsvp(selectedPost.postid, currentUser.userid);
      setUserRsvped(result.rsvped);
      await fetchRsvpInfo(selectedPost.postid);
    } catch (err) {
      console.error('Failed to toggle RSVP:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  const closeModal = () => {
    // Animate modal out
    Animated.timing(modalSlideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectedPost(null);
      setRsvpInfo(null);
      setUserRsvped(false);
      setGuestListModalVisible(false);
    });
  };

  useEffect(() => {
    if (selectedPost) {
      // Animate modal in
      Animated.timing(modalSlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      void fetchRsvpInfo(selectedPost.postid);
    }
  }, [selectedPost, fetchRsvpInfo, modalSlideAnim]);

  const exploreHasLoadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const showSpinner = !exploreHasLoadedOnce.current;
      exploreHasLoadedOnce.current = true;
      void fetchPosts(showSpinner);
      void fetchTags();
      void fetchPostTags();
    }, [fetchPosts, fetchTags, fetchPostTags])
  );

  useEffect(() => {
    requestAndFetchLocation();
  }, []);

  const filteredPosts = useMemo(() => {
    const searchQuery = searchText.toLowerCase().trim();

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

      // Tag filtering via post_tags junction table
      const matchesTag =
        selectedTagIds.length === 0 ||
        selectedTagIds.some((id) => postTagMap.get(post.postid)?.has(id) ?? false);

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

      const matchesPrice =
        !priceFilterEnabled ||
        Number(post.price_min ?? 0) <= priceFilterMax;

      return (
        matchesSearch &&
        matchesTag &&
        matchesDistance &&
        matchesPrice
      );
    });
  }, [
    posts,
    searchText,
    selectedTagIds,
    postTagMap,
    radiusEnabled,
    radiusMiles,
    coords,
    priceFilterEnabled,
    priceFilterMax,
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

    return `${selectedTagIds.join(',')}-${radiusMiles}-${radiusEnabled}-${markerIds}`;
  }, [
    filteredEventMarkers,
    selectedTagIds,
    radiusMiles,
    radiusEnabled,
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
      {(selectedTagIds.length > 0 || radiusEnabled || priceFilterEnabled) && (
        <View style={{ height: 48 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeTagRow}>
          {selectedTagIds.map((id) => {
            const name = tags.find((t) => t.tagid === id)?.name ?? 'Tag';
            return (
              <Pressable
                key={id}
                style={styles.activeTagChip}
                onPress={() => setSelectedTagIds((prev) => prev.filter((tid) => tid !== id))}
              >
                <Text style={styles.activeTagText}>{name}</Text>
                <Ionicons name="close-circle" size={18} color={COLORS.textPrimary} style={{ marginLeft: 6 }} />
              </Pressable>
            );
          })}
          {radiusEnabled && (
            <Pressable
              style={styles.activeTagChip}
              onPress={() => setRadiusEnabled(false)}
            >
              <Text style={styles.activeTagText}>
                Within {radiusMiles} mi
              </Text>
              <Ionicons name="close-circle" size={18} color={COLORS.textPrimary} style={{ marginLeft: 6 }} />
            </Pressable>
          )}
          {priceFilterEnabled && (
            <Pressable
              style={styles.activeTagChip}
              onPress={() => setPriceFilterEnabled(false)}
            >
              <Text style={styles.activeTagText}>
                {priceFilterMax === 0 ? 'Free only' : `Up to $${priceFilterMax}`}
              </Text>
              <Ionicons name="close-circle" size={18} color={COLORS.textPrimary} style={{ marginLeft: 6 }} />
            </Pressable>
          )}
        </ScrollView>
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

              {radiusEnabled && (
                <Circle
                  center={{
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                  }}
                  radius={radiusMeters}
                  strokeColor="rgba(29, 78, 216, 0.8)"
                  fillColor="rgba(59, 130, 246, 0.2)"
                />
              )}

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
          color={COLORS.textPrimary}
        />
      </Pressable>

      {/* Post detail modal */}
      <Modal
        visible={selectedPost !== null}
        animationType="none"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeModal}
        >
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <Animated.View
              style={[
                styles.modalContent,
                {
                  transform: [
                    {
                      translateY: modalSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [600, 0],
                      }),
                    },
                  ],
                  opacity: modalSlideAnim,
                },
              ]}
            >
              <Pressable
                style={{ flex: 1 }}
                onPress={(e) => e.stopPropagation()}
              >
                <Pressable style={styles.closeButton} onPress={closeModal}>
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
                      ? formatEventStartForDisplay(selectedPost.start_time)
                      : 'No time set'}
                  </Text>
                  <Text style={styles.modalDetail}>
                    {(() => {
                      const min = Number(selectedPost.price_min ?? 0);
                      const max = Number(selectedPost.price_max ?? 0);
                      if (min === 0 && max === 0) return '💲 Free';
                      if (min === max) return `💲 $${min}`;
                      return `💲 $${min} – $${max}`;
                    })()}
                  </Text>

                  <View style={styles.divider} />

                  {/* RSVP Section */}
                  {currentUser && selectedPost && (
                    <>
                      <View style={styles.rsvpSection}>
                        {currentUser.userid === selectedPost.userid ? (
                          // Owner view - only show guest list button
                          <>
                            <Pressable
                              style={styles.guestListButton}
                              onPress={() => {
                                console.log('Guest list button pressed');
                                setGuestListModalVisible(true);
                              }}>
                              <Text style={styles.guestListButtonText}>
                                👥 View Guest List
                                {rsvpInfo && rsvpInfo.isOwner && ` (${rsvpInfo.count})`}
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          // Non-owner view - show RSVP button and category
                          <>
                            <Pressable
                              style={[styles.rsvpButton, userRsvped && styles.rsvpButtonActive]}
                              onPress={handleToggleRsvp}
                              disabled={rsvpLoading}>
                              {rsvpLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.rsvpButtonText}>
                                  {userRsvped ? '✓ Attending' : 'RSVP'}
                                </Text>
                              )}
                            </Pressable>

                            {rsvpInfo && !rsvpInfo.isOwner && (
                              <View style={styles.rsvpInfoContainer}>
                                <Text style={styles.rsvpCategoryText}>
                                  👥 {formatRsvpCategory(rsvpInfo.category)}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>

                      <View style={styles.divider} />
                    </>
                  )}

                  <Text style={styles.descriptionLabel}>About this event</Text>
                  <Text style={styles.description}>
                    {selectedPost.description || 'No description provided.'}
                  </Text>
                </>
              )}

              {/* Guest List Overlay - shows inside event modal */}
              {guestListModalVisible && (
                <View style={styles.guestListOverlay}>
                  <View style={styles.guestListModal}>
                    <View style={styles.guestListModalHeader}>
                      <Text style={styles.guestListModalTitle}>Guest List</Text>
                      <Pressable
                        onPress={() => {
                          console.log('Close button pressed');
                          setGuestListModalVisible(false);
                        }}>
                        <Text style={styles.closeButtonText}>✕</Text>
                      </Pressable>
                    </View>

                    {rsvpInfo && rsvpInfo.isOwner ? (
                      rsvpInfo.guests.length > 0 ? (
                        <ScrollView style={styles.guestListScrollView}>
                          {rsvpInfo.guests.map((guest) => (
                            <View key={guest.rsvpid} style={styles.guestListItem}>
                              {guest.profile_picture ? (
                                <Image
                                  source={{ uri: guest.profile_picture }}
                                  style={styles.guestAvatarImage}
                                />
                              ) : (
                                <View style={styles.guestAvatarPlaceholder}>
                                  <Text style={styles.guestAvatarText}>
                                    {guest.first_name?.[0]?.toUpperCase() || '?'}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.guestInfo}>
                                <Text style={styles.guestName}>
                                  {guest.first_name} {guest.last_name}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={styles.emptyGuestList}>
                          <Text style={styles.emptyGuestListText}>No one has RSVP'd yet</Text>
                        </View>
                      )
                    ) : (
                      <View style={styles.emptyGuestList}>
                        <Text style={styles.emptyGuestListText}>Loading...</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              </Pressable>
            </Animated.View>
          </ScrollView>
        </Pressable>
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
              <Text style={styles.filterLabel}>DISTANCE</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Filter by distance</Text>
                <Switch
                  value={radiusEnabled}
                  onValueChange={setRadiusEnabled}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={radiusEnabled ? COLORS.yellow : COLORS.textLight}
                />
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
                    minimumTrackTintColor={COLORS.primary}
                    maximumTrackTintColor={COLORS.border}
                    thumbTintColor={COLORS.yellow}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelText}>1 mi</Text>
                    <Text style={styles.sliderLabelText}>50 mi</Text>
                  </View>
                </View>
              )}

              <Text style={styles.filterLabel}>TAGS</Text>
              <View style={styles.tagGrid}>
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.tagid);
                  return (
                    <Pressable
                      key={tag.tagid}
                      onPress={() =>
                        setSelectedTagIds((prev) =>
                          isSelected ? prev.filter((id) => id !== tag.tagid) : [...prev, tag.tagid]
                        )
                      }
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
              <Text style={styles.filterLabel}>PRICE</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Filter by max price</Text>
                <Switch
                  value={priceFilterEnabled}
                  onValueChange={setPriceFilterEnabled}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={priceFilterEnabled ? COLORS.yellow : COLORS.textLight}
                />
              </View>
              {priceFilterEnabled && (
                <View style={styles.sliderSection}>
                  <Text style={styles.sliderValue}>
                    {priceFilterMax === 0 ? 'Free only' : `Up to $${priceFilterMax}`}
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={200}
                    step={5}
                    value={priceFilterMax}
                    onValueChange={(val) => setPriceFilterMax(Math.round(val / 5) * 5)}
                    minimumTrackTintColor={COLORS.primary}
                    maximumTrackTintColor={COLORS.border}
                    thumbTintColor={COLORS.yellow}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelText}>Free</Text>
                    <Text style={styles.sliderLabelText}>$200</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.filterActions}>
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setRadiusEnabled(false);
                  setRadiusMiles(10);
                  setSelectedTagIds([]);
                  setPriceFilterEnabled(false);
                  setPriceFilterMax(200);
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
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingHorizontal: 16,
    alignContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 3,
    borderColor: COLORS.primary,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  filterButton: {
    marginLeft: 10,
    height: 48,
    width: 48,
    borderRadius: 0,
    backgroundColor: COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  loaderLarge: {
    marginTop: 24,
  },
  postCardsContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  list: {
    gap: 32,
    paddingBottom: 100,
    paddingTop: 12,
  },
  postCard: {
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    backgroundColor: COLORS.cardBackground,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 8,
    borderLeftWidth: 8,
    borderLeftColor: COLORS.red,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: COLORS.cream,
  },
  postTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 20,
    marginHorizontal: 24,
    letterSpacing: -0.8,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  postAuthor: {
    fontSize: 12,
    color: COLORS.textOnDark,
    marginBottom: 16,
    marginHorizontal: 24,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '800',
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postDetail: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 0,
    marginBottom: 10,
    marginHorizontal: 24,
    lineHeight: 24,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 24,
    fontSize: 15,
    color: COLORS.textOnDark,
    textAlign: 'center',
    fontWeight: '600',
  },
  mapSection: {
    flex: 1,
  },
  locationButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  locationButtonText: {
    color: COLORS.textOnDark,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
    borderRadius: 0,
    backgroundColor: COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 8,
    borderWidth: 3,
    borderColor: COLORS.yellow,
  },
  filterModalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    padding: 24,
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
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 12,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBackground,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: COLORS.border,
  },
  switchLabel: {
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    borderWidth: 3,
    borderColor: COLORS.textSecondary,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  applyButton: {
    flex: 1,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    padding: 24,
    width: '100%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: 0,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  modalAuthor: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginVertical: 16,
  },
  modalDetail: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 22,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  activeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  activeTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.yellow,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 3,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  activeTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sliderSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 3,
    borderColor: COLORS.border,
  },
  sliderValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sliderLabelText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sliderHint: {
    fontSize: 13,
    color: COLORS.red,
    marginBottom: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tagGridChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.textSecondary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
  },
  tagGridChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowOpacity: 0.2,
  },
  tagGridChipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagGridChipTextSelected: {
    color: COLORS.textOnDark,
  },
  rsvpSection: {
    marginVertical: 8,
  },
  rsvpButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 0,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 6,
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  rsvpButtonActive: {
    backgroundColor: COLORS.yellow,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.yellow,
  },
  rsvpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  rsvpInfoContainer: {
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rsvpCategoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textOnDark,
  },
  guestListButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 0,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 6,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  guestListButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  guestListOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  guestListModal: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    padding: 24,
    width: '90%',
    maxHeight: '70%',
    elevation: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
  },
  guestListModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  guestListModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  guestListScrollView: {
    maxHeight: 400,
  },
  guestListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  guestAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  guestAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: COLORS.primary,
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  emptyGuestList: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyGuestListText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
