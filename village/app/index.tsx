import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';

export default function LoginScreen() {
  const router = useRouter();
  const { setIsSignedIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Incorrect credentials');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      if (!res.ok) {
        Alert.alert('Incorrect credentials');
        return;
      }

      setIsSignedIn(true);
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert('Incorrect credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={handleSignIn} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Signing In...' : 'Sign In'}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/register')}>
        <Text style={styles.registerLink}>
          New here? <Text style={styles.registerLinkAccent}>Register here</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    marginTop: 8,
    textAlign: 'center',
    color: '#374151',
    fontSize: 14,
  },
  registerLinkAccent: {
    color: '#2563eb',
    fontWeight: '700',
  },
});
