import api, { handleApiResponse, handleApiError } from './api';

/**
 * Authentication service
 * Handles user login, registration, and token management
 */

class AuthService {
  /**
   * User login
   * @param {Object} credentials - User login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<Object>} Login response with user data and token
   */
  async login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      
      // Store token in localStorage
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const mockUser = {
          id: 'dev-user-1',
          username: credentials.email?.split('@')[0] || 'devuser',
          email: credentials.email || 'dev@example.com',
        };
        localStorage.setItem('authToken', 'dev-token');
        localStorage.setItem('user', JSON.stringify(mockUser));
        return { success: true, data: { token: 'dev-token', user: mockUser }, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get detailed submission logs for the authenticated user
   * @param {number} limit - Number of logs to fetch
   */
  async getSubmissionLogs(limit = 50) {
    try {
      const response = await api.get('/profile/submissions', { params: { limit } });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * User registration
   * @param {Object} userData - User registration data
   * @param {string} userData.username - Username
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @returns {Promise<Object>} Registration response
   */
  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      
      // Optionally auto-login after registration
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const mockUser = {
          id: 'dev-user-1',
          username: userData.username || 'newdev',
          email: userData.email || 'dev@example.com',
        };
        localStorage.setItem('authToken', 'dev-token');
        localStorage.setItem('user', JSON.stringify(mockUser));
        return { success: true, data: { token: 'dev-token', user: mockUser }, status: 201 };
      }
      return handleApiError(error);
    }
  }

  /**
   * User logout
   * @returns {Promise<Object>} Logout response
   */
  async logout() {
    try {
      const response = await api.post('/auth/logout');
      
      // Clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      return handleApiResponse(response);
    } catch (error) {
      // Clear local storage even if API call fails
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        return { success: true, data: { loggedOut: true }, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Refresh authentication token
   * @returns {Promise<Object>} Refresh token response
   */
  async refreshToken() {
    try {
      const response = await api.post('/auth/refresh');
      
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get current user profile
   * @returns {Promise<Object>} User profile data
   */
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(response.data));
      
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const user = this.getStoredUser();
        if (user) {
          return { success: true, data: user, status: 200 };
        }
      }
      return handleApiError(error);
    }
  }

  /**
   * Update user profile
   * @param {Object} userData - Updated user data
   * @returns {Promise<Object>} Update response
   */
  async updateProfile(userData) {
    try {
      const response = await api.put('/auth/profile', userData);
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(response.data));
      
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const existing = this.getStoredUser() || {};
        const updated = { ...existing, ...userData };
        localStorage.setItem('user', JSON.stringify(updated));
        return { success: true, data: updated, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Change user password
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise<Object>} Password change response
   */
  async changePassword(passwordData) {
    try {
      const response = await api.put('/auth/change-password', passwordData);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Password reset request response
   */
  async requestPasswordReset(email) {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Reset password with token
   * @param {Object} resetData - Password reset data
   * @param {string} resetData.token - Reset token
   * @param {string} resetData.password - New password
   * @returns {Promise<Object>} Password reset response
   */
  async resetPassword(resetData) {
    try {
      const response = await api.post('/auth/reset-password', resetData);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getRecentActivity(limit = 20) {
    try {
      const response = await api.get('/profile/activity', { params: { limit } });
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const mock = {
          activities: [
            { id: 'a1', date: new Date().toISOString(), problem: 'Two Sum', difficulty: 'Easy', status: 'solved', time: '15m' },
          ]
        };
        return { success: true, data: mock, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    const token = localStorage.getItem('authToken');
    return !!token;
  }

  /**
   * Get stored user data
   * @returns {Object|null} User data or null if not found
   */
  getStoredUser() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Get stored auth token
   * @returns {string|null} Auth token or null if not found
   */
  getToken() {
    return localStorage.getItem('authToken');
  }
}

// Export singleton instance
export default new AuthService();
