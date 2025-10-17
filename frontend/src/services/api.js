import axios from 'axios';

/**
 * Base API configuration
 * Centralized HTTP client with interceptors for request/response handling
 */

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (import.meta.env.VITE_DEV_MODE === 'true') {
      console.log('API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.VITE_DEV_MODE === 'true') {
      console.log('API Response:', {
        status: response.status,
        data: response.data,
      });
    }
    
    return response;
  },
  (error) => {
    // Handle common error scenarios
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          break;
        case 403:
          console.error('Access forbidden:', data.message);
          break;
        case 404:
          console.error('Resource not found:', data.message);
          break;
        case 500:
          console.error('Server error:', data.message);
          break;
        default:
          console.error('API Error:', data.message || 'Unknown error');
      }
    } else if (error.request) {
      console.error('Network error:', error.message);
    } else {
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle API responses
export const handleApiResponse = (response) => {
  return {
    success: true,
    data: response.data,
    status: response.status,
  };
};

// Helper function to handle API errors
export const handleApiError = (error) => {
  return {
    success: false,
    error: error.response?.data?.message || error.message || 'An error occurred',
    status: error.response?.status || 500,
  };
};

export default api;
