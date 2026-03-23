import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { setIsSignedIn, setCurrentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const enteredPassword = password;

    if (!trimmedEmail && !enteredPassword) {
      Alert.alert('Please enter your email and password');
      return;
    }

    if (!trimmedEmail) {
      Alert.alert('Email is required');
      return;
    }

    if (!enteredPassword) {
      Alert.alert('Password is required');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Please enter a valid email address');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password: enteredPassword,
        }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        if (errorPayload?.error === 'Please enter your email and password') {
          Alert.alert('Please enter your email and password');
          return;
        }
        if (errorPayload?.error === 'Email is required') {
          Alert.alert('Email is required');
          return;
        }
        if (errorPayload?.error === 'Password is required') {
          Alert.alert('Password is required');
          return;
        }
        if (errorPayload?.error === 'Please enter a valid email address') {
          Alert.alert('Please enter a valid email address');
          return;
        }
        Alert.alert('Incorrect credentials');
        return;
      }

      const user = await res.json();
      setCurrentUser(user);
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
      <View style={styles.passwordRow}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPassword}
          style={styles.passwordInput}
        />
        <Pressable
          onPress={() => setShowPassword((prev) => !prev)}
          style={styles.eyeButton}
          hitSlop={8}
        >
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
        </Pressable>
      </View>
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
  passwordRow: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  eyeButton: {
    padding: 4,
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
