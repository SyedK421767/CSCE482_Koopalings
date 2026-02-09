import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import CreatePost from './components/CreatePost'
import GoogleAuth from './components/GoogleLogin'

function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    console.log('Logged in as:', userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <>
      
      {/* Show Google login if not logged in */}
      {!user ? (
        <div>
          <h2>Please log in</h2>
          <GoogleAuth onLoginSuccess={handleLoginSuccess} />
        </div>
      ) : (
        <div>
          <h2>Welcome, {user.name || user.email}!</h2>
          <p>User ID: {user.userId}</p>
          <button onClick={handleLogout} style={{ marginBottom: '20px' }}>
            Logout
          </button>
          
          {/* Pass user ID to CreatePost */}
          <CreatePost userId={user.userId} />
        </div>
      )}
    </>
  )
}

export default App;