import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';

export default function RegisterScreen() {
  const router = useRouter();
  const { setIsSignedIn } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateAccount = async () => {
      console.log('Using API_URL:', API_URL);

    const fields = [firstName, lastName, phoneNumber, email, password];
    const hasEmptyField = fields.some((field) => field.trim().length === 0);

    if (hasEmptyField) {
      Alert.alert('Missing information', 'All fields are required.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phoneNumber.trim(),
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log('User create failed:', txt);
        Alert.alert('Error', 'Could not create account.');
        return;
      }

      const user = await res.json();
      console.log('Created user:', user); // should have userid from DB

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
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        autoCapitalize="none"
        secureTextEntry
        style={styles.input}
      />
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
