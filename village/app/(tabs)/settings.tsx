import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { setIsSignedIn } = useAuth();

  const handleLogout = () => {
    setIsSignedIn(false);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
