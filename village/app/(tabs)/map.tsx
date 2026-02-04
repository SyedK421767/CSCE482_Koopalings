import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Circle, Marker } from 'react-native-maps';

export default function MapScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);

  const radiusMiles = 1;
  const radiusMeters = radiusMiles * 1609.34;

  const mapRegion = useMemo(() => {
    if (!coords) return null;

    // Fit about a 1-mile radius circle with slight breathing room.
    const latitudeDelta = (radiusMeters * 2.4) / 111320;
    const longitudeDelta =
      (radiusMeters * 2.4) / (111320 * Math.max(Math.cos((coords.latitude * Math.PI) / 180), 0.2));

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta,
      longitudeDelta,
    };
  }, [coords, radiusMeters]);

  const requestAndFetchLocation = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    requestAndFetchLocation();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Pressable style={styles.button} onPress={requestAndFetchLocation} disabled={isLoading}>
        <Text style={styles.buttonText}>
          {coords ? 'Refresh Location' : 'Allow Location Access'}
        </Text>
      </Pressable>

      {isLoading ? <ActivityIndicator size="small" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {coords && mapRegion ? (
        <>
          <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion} showsUserLocation>
            <Marker coordinate={{ latitude: coords.latitude, longitude: coords.longitude }} title="You are here" />
            <Circle
              center={{ latitude: coords.latitude, longitude: coords.longitude }}
              radius={radiusMeters}
              strokeColor="rgba(29, 78, 216, 0.8)"
              fillColor="rgba(59, 130, 246, 0.2)"
            />
          </MapView>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Center: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
            <Text style={styles.infoText}>Radius: {radiusMiles} mile</Text>
          </View>
        </>
      ) : (
        <Text style={styles.caption}>Grant location access to see your 1-mile radius area.</Text>
      )}
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
  button: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
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
    height: 300,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  infoCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    backgroundColor: '#f9fafb',
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
  },
  caption: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
});
