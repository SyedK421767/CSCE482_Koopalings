import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/lib/config';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Color Theme - matching home and explore pages
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Login</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={COLORS.textLight}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.passwordRow}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry={!showPassword}
            style={styles.passwordInput}
          />
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeButton}
            hitSlop={8}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.textSecondary} />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    marginBottom: 24,
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  input: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: COLORS.cardBackground,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  passwordRow: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    backgroundColor: COLORS.cardBackground,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    marginTop: 12,
    backgroundColor: COLORS.red,
    borderRadius: 0,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  buttonText: {
    color: COLORS.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  registerLink: {
    marginTop: 16,
    textAlign: 'center',
    color: COLORS.textOnDark,
    fontSize: 15,
    fontWeight: '600',
  },
  registerLinkAccent: {
    color: COLORS.yellow,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
