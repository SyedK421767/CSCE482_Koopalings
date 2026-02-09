// src/CreatePost.jsx
import { useState } from 'react';

function CreatePost({ userId }) {  // ← Add userId as a prop here
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: ''
  });

  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Get current date and time in ISO format
    const currentDateTime = new Date().toISOString();
    
    // Add current date/time to form data
    const dataToSend = {
      userId: userId,  // Now userId is available from props
      ...formData,
      dateAndTime: currentDateTime
    };
    
    try {
      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Post created successfully! ID: ' + data.postId);
        // Reset form
        setFormData({
          title: '',
          description: '',
          location: ''
        });
      } else {
        setMessage('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error connecting to server');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Create New Post</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label>Title:</label>
          <input
            type="text"
            name="title"
            placeholder="Enter Title"
            value={formData.title}
            onChange={handleChange}
            maxLength="100"
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div>
          <label>Description:</label>
          <input
            type="text"
            name="description"
            placeholder="Enter Description"
            value={formData.description}
            onChange={handleChange}
            maxLength="100"
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div>
          <label>Location:</label>
          <input
            type="text"
            name="location"
            placeholder="Enter Location"
            value={formData.location}
            onChange={handleChange}
            maxLength="100"
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <button 
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            marginTop: '10px'
          }}
        >
          Submit Post
        </button>
      </form>

      {message && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: message.includes('Error') ? '#ffcccc' : '#ccffcc',
          borderRadius: '5px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default CreatePost;