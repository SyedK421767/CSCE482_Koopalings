import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

function normalizePhoneNumber(value: string): string | null {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return digitsOnly.slice(1);
  }
  if (digitsOnly.length === 10) {
    return digitsOnly;
  }
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { setIsSignedIn, setCurrentUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateAccount = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const rawPhoneNumber = phoneNumber.trim();
    const normalizedPhoneNumber = normalizePhoneNumber(rawPhoneNumber);
    const trimmedEmail = email.trim().toLowerCase();
    const enteredPassword = password;

    const fields = [trimmedFirstName, trimmedLastName, rawPhoneNumber, trimmedEmail, enteredPassword];
    if (fields.some((field) => field.length === 0)) {
      Alert.alert('Missing information', 'All fields are required.');
      return;
    }

    if (!normalizedPhoneNumber) {
      Alert.alert('Invalid phone number', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (!PASSWORD_REGEX.test(enteredPassword)) {
      Alert.alert(
        'Weak password',
        'Password must be at least 12 characters and include one uppercase letter, one number, and one special character.'
      );
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone_number: normalizedPhoneNumber,
          email: trimmedEmail,
          password: enteredPassword,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload?.error === 'Phone number is already registered') {
          Alert.alert('Phone already registered', 'That phone number is already registered.');
          return;
        }
        if (payload?.error === 'Please enter a valid 10-digit phone number') {
          Alert.alert('Invalid phone number', 'Please enter a valid 10-digit phone number.');
          return;
        }
        if (payload?.error === 'Email is already registered') {
          Alert.alert('Email already registered', 'That email is already registered.');
          return;
        }
        if (payload?.error === 'Please enter a valid email address') {
          Alert.alert('Invalid email', 'Please enter a valid email address.');
          return;
        }
        if (
          payload?.error ===
          'Password must be at least 12 characters and include one uppercase letter, one number, and one special character'
        ) {
          Alert.alert(
            'Weak password',
            'Password must be at least 12 characters and include one uppercase letter, one number, and one special character.'
          );
          return;
        }
        if (payload?.error === 'All fields are required') {
          Alert.alert('Missing information', 'All fields are required.');
          return;
        }
        Alert.alert('Error', payload?.error || 'Could not create account.');
        return;
      }

      const user = await res.json();
      console.log('Created user:', user);

      setCurrentUser(user);
      setIsSignedIn(true);
      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('Network error:', e);
      Alert.alert('Error', 'Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First Name"
        autoCapitalize="words"
        style={styles.input}
      />
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last Name"
        autoCapitalize="words"
        style={styles.input}
      />
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        style={styles.input}
      />
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
          autoCapitalize="none"
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
      <Pressable style={styles.button} onPress={handleCreateAccount} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? 'Creating...' : 'Create Account'}
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
});
