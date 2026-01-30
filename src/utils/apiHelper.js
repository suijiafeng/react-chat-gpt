import axios from 'axios';

// Create a function that returns an axios instance with custom options
export const createApiInstance = (baseURL, timeout) => {
  const api = axios.create({
    baseURL,
    timeout,
    // 后端用 httpOnly cookie 存 session，必须带上凭据浏览器才会附带/接受这个 cookie；
    // 服务端 CORS 也要求 Access-Control-Allow-Credentials，两边缺一不可
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to include token if available
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = token;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for global error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        if (error.response.status === 401) {
          // Handle unauthorized access (e.g., redirect to login page)
          // Example: window.location = '/login';
        }
      } else if (error.request) {
        console.error('Request error:', error.request);
      } else {
        console.error('Error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return api;
};
