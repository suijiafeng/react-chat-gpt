import axios from 'axios';

// Create a new Axios instance
const api = axios.create({
  baseURL: '/',
  timeout: 1000,
  headers: {
    'Content-Type': 'application/json'
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add logic here to include auth tokens, etc.
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // You can add global handling for successful responses here
    return response;
  },
  (error) => {
    // Global error handling
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // console.error('Response error:', error.response.data);
      if (error.response.status === 401) {
        // Handle unauthorized access
        // For example, redirect to login page or refresh token
      }
    } else if (error.request) {
      // The request was made but no response was received
      // console.error('Request error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      // console.error('Error:', error.message);
    }
    return Promise.reject(error.response);
  }
);

export default api;