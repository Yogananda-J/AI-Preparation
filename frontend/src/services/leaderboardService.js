import api, { handleApiResponse, handleApiError } from './api';

/**
 * Leaderboard service
 * Handles leaderboard data, rankings, and user statistics
 */

class LeaderboardService {
  /**
   * Get global leaderboard
   * @param {Object} params - Query parameters
   * @param {string} params.timeframe - Timeframe (all-time, monthly, weekly, daily)
   * @param {string} params.category - Category (overall, problems, streak, speed)
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Leaderboard data
   */
  async getGlobalLeaderboard(params = {}) {
    try {
      const response = await api.get('/leaderboard/global', { params });
      const parsed = handleApiResponse(response);
      const needsMock = () => {
        if (!parsed?.success) return false;
        const arr = parsed.data?.users;
        if (!Array.isArray(arr) || arr.length === 0) return true;
        // If all entries are zero-like, also mock
        const allZero = arr.every(u => (!u.score && !u.problemsSolved && !u.streak));
        return allZero || arr.length < 3;
      };
      if (import.meta.env.VITE_USE_MOCKS === 'true' && needsMock()) {
        const mock = {
          total: 5,
          users: [
            { rank: 1, username: 'Alice', score: 2850, problemsSolved: 145, streak: 21, country: 'USA' },
            { rank: 2, username: 'Bob', score: 2720, problemsSolved: 132, streak: 18, country: 'India' },
            { rank: 3, username: 'Charlie', score: 2610, problemsSolved: 127, streak: 12, country: 'UK' },
            { rank: 4, username: 'Diana', score: 2490, problemsSolved: 116, streak: 9, country: 'Germany' },
            { rank: 5, username: 'Ethan', score: 2415, problemsSolved: 110, streak: 6, country: 'Canada' },
          ],
        };
        return { success: true, data: mock, status: 200 };
      }
      return parsed;
    } catch (error) {
      if (import.meta.env.VITE_USE_MOCKS === 'true') {
        const mock = {
          total: 8,
          users: [
            { rank: 1, username: 'CodeMaster2024', score: 2850, problemsSolved: 145, streak: 28, country: 'USA' },
            { rank: 2, username: 'AlgoNinja', score: 2720, problemsSolved: 132, streak: 15, country: 'India' },
            { rank: 3, username: 'DevQueen', score: 2680, problemsSolved: 128, streak: 22, country: 'Canada' },
            { rank: 4, username: 'ByteHunter', score: 2540, problemsSolved: 119, streak: 12, country: 'Germany' },
            { rank: 5, username: 'StackOverflow', score: 2480, problemsSolved: 115, streak: 8, country: 'UK' },
            { rank: 6, username: 'RecursiveGenius', score: 2420, problemsSolved: 112, streak: 18, country: 'Japan' },
            { rank: 7, username: 'BinaryBeast', score: 2380, problemsSolved: 108, streak: 5, country: 'Australia' },
            { rank: 8, username: 'CodeCrusher', score: 2340, problemsSolved: 105, streak: 14, country: 'France' },
          ],
        };
        return { success: true, data: mock, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get user's rank and position
   * @param {string} timeframe - Timeframe filter
   * @param {string} category - Category filter
   * @returns {Promise<Object>} User rank data
   */
  async getUserRank(timeframe = 'all-time', category = 'overall') {
    try {
      const response = await api.get('/leaderboard/my-rank', {
        params: { timeframe, category }
      });
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const mock = { rank: 247, totalUsers: 8247, score: 1850 };
        return { success: true, data: mock, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get leaderboard by country
   * @param {string} country - Country code
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Country leaderboard
   */
  async getCountryLeaderboard(country, params = {}) {
    try {
      const response = await api.get(`/leaderboard/country/${country}`, { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get leaderboard by skill category
   * @param {string} skill - Skill category (arrays, strings, trees, etc.)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Skill-based leaderboard
   */
  async getSkillLeaderboard(skill, params = {}) {
    try {
      const response = await api.get(`/leaderboard/skill/${skill}`, { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get friends leaderboard
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Friends leaderboard
   */
  async getFriendsLeaderboard(params = {}) {
    try {
      const response = await api.get('/leaderboard/friends', { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get leaderboard statistics
   * @returns {Promise<Object>} Leaderboard statistics
   */
  async getLeaderboardStats() {
    try {
      const response = await api.get('/leaderboard/stats');
      const parsed = handleApiResponse(response);
      if (import.meta.env.VITE_USE_MOCKS === 'true' && (!parsed?.data || !parsed.data.activeCompetitors)) {
        // Try to infer from mock user count used above
        const fallback = 5;
        return { success: true, data: { activeCompetitors: fallback }, status: 200 };
      }
      return parsed;
    } catch (error) {
      if (import.meta.env.VITE_USE_MOCKS === 'true') {
        const mock = { activeCompetitors: 5 };
        return { success: true, data: mock, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get user's detailed statistics
   * @param {string} userId - User ID (optional, defaults to current user)
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats(userId = null) {
    try {
      const endpoint = userId ? `/leaderboard/user/${userId}/stats` : '/leaderboard/my-stats';
      const response = await api.get(endpoint);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get user's rank history
   * @param {string} timeframe - Timeframe for history
   * @returns {Promise<Object>} Rank history data
   */
  async getRankHistory(timeframe = 'monthly') {
    try {
      const response = await api.get('/leaderboard/rank-history', {
        params: { timeframe }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get top performers in specific categories
   * @param {string} category - Performance category
   * @param {number} limit - Number of top performers to fetch
   * @returns {Promise<Object>} Top performers data
   */
  async getTopPerformers(category, limit = 10) {
    try {
      const response = await api.get('/leaderboard/top-performers', {
        params: { category, limit }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get achievement leaderboard
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Achievement-based rankings
   */
  async getAchievementLeaderboard(params = {}) {
    try {
      const response = await api.get('/leaderboard/achievements', { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get contest leaderboard
   * @param {string} contestId - Contest ID
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Contest leaderboard
   */
  async getContestLeaderboard(contestId, params = {}) {
    try {
      const response = await api.get(`/leaderboard/contest/${contestId}`, { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Search users in leaderboard
   * @param {string} query - Search query (username)
   * @param {Object} params - Additional parameters
   * @returns {Promise<Object>} Search results
   */
  async searchUsers(query, params = {}) {
    try {
      const response = await api.get('/leaderboard/search', {
        params: { query, ...params }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Follow/unfollow a user
   * @param {string} userId - User ID to follow/unfollow
   * @param {boolean} follow - True to follow, false to unfollow
   * @returns {Promise<Object>} Follow action result
   */
  async toggleFollow(userId, follow = true) {
    try {
      const endpoint = follow ? '/leaderboard/follow' : '/leaderboard/unfollow';
      const response = await api.post(endpoint, { userId });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get user's followers
   * @param {string} userId - User ID (optional, defaults to current user)
   * @returns {Promise<Object>} Followers list
   */
  async getFollowers(userId = null) {
    try {
      const endpoint = userId ? `/leaderboard/user/${userId}/followers` : '/leaderboard/my-followers';
      const response = await api.get(endpoint);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get users that the user is following
   * @param {string} userId - User ID (optional, defaults to current user)
   * @returns {Promise<Object>} Following list
   */
  async getFollowing(userId = null) {
    try {
      const endpoint = userId ? `/leaderboard/user/${userId}/following` : '/leaderboard/my-following';
      const response = await api.get(endpoint);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get available leaderboard categories
   * @returns {Promise<Object>} Available categories
   */
  async getCategories() {
    try {
      const response = await api.get('/leaderboard/categories');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get available countries for country leaderboard
   * @returns {Promise<Object>} Available countries
   */
  async getCountries() {
    try {
      const response = await api.get('/leaderboard/countries');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }
}

// Export singleton instance
export default new LeaderboardService();
