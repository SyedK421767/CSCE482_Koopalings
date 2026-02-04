import { StyleSheet, Text, View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Map view placeholder</Text>
      </View>
      <Text style={styles.caption}>You can plug in a real map library here later.</Text>
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
  mapPlaceholder: {
    height: 300,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  caption: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
});
