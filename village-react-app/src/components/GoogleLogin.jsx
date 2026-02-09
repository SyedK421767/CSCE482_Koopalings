// src/GoogleLogin.jsx
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

function GoogleLoginComponent({ onLoginSuccess }) {
  const handleSuccess = async (credentialResponse) => {
    try {
      // Send the credential to your backend
      const response = await fetch('http://localhost:5000/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: credentialResponse.credential
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Login successful:', data.user);
        onLoginSuccess(data.user);
      } else {
        console.error('Login failed:', data.error);
        alert('Login failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error during login');
    }
  };

  const handleError = () => {
    console.log('Login Failed');
    alert('Google login failed');
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap
      />
    </div>
  );
}

// Wrapper component with GoogleOAuthProvider
function GoogleAuth({ onLoginSuccess }) {
  const GOOGLE_CLIENT_ID = '802022146719-dkalut9gqogjertq7m0nrvjnagrivv2v.apps.googleusercontent.com'; // Replace with your Client ID

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <GoogleLoginComponent onLoginSuccess={onLoginSuccess} />
    </GoogleOAuthProvider>
  );
}

export default GoogleAuth;