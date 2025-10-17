import api, { handleApiResponse, handleApiError } from './api';

/**
 * Challenge service
 * Handles coding challenges, submissions, and related operations
 */

class ChallengeService {
  /**
   * Get daily challenges
   * @returns {Promise<Object>} Daily challenges data
   */
  async getDailyChallenges() {
    try {
      const response = await api.get('/challenges/daily');
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const mock = {
          date: new Date().toISOString().slice(0, 10),
          challenges: [
            { id: 'two-sum', title: 'Two Sum', difficulty: 'Easy', category: 'arrays', acceptance: 52, points: 100 },
            { id: 'valid-parentheses', title: 'Valid Parentheses', difficulty: 'Easy', category: 'strings', acceptance: 61, points: 100 },
            { id: 'merge-intervals', title: 'Merge Intervals', difficulty: 'Medium', category: 'sorting', acceptance: 43, points: 200 },
            { id: 'longest-substring', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', category: 'strings', acceptance: 35, points: 200 },
            { id: 'word-ladder', title: 'Word Ladder', difficulty: 'Hard', category: 'graphs', acceptance: 29, points: 300 },
          ],
        };
        return { success: true, data: mock, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get all challenges with pagination and filters
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.difficulty - Difficulty filter (easy, medium, hard)
   * @param {string} params.category - Category filter
   * @param {string} params.search - Search query
   * @returns {Promise<Object>} Challenges list with pagination
   */
  async getChallenges(params = {}) {
    try {
      const response = await api.get('/challenges', { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get challenge by ID
   * @param {string} challengeId - Challenge ID
   * @returns {Promise<Object>} Challenge details
   */
  async getChallengeById(challengeId) {
    try {
      const response = await api.get(`/challenges/${challengeId}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get challenges by category
   * @param {string} category - Challenge category
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>} Challenges in category
   */
  async getChallengesByCategory(category, params = {}) {
    try {
      const response = await api.get(`/challenges/category/${category}`, { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Submit code solution
   * @param {Object} submission - Code submission data
   * @param {string} submission.challengeId - Challenge ID
   * @param {string} submission.code - User's code solution
   * @param {string} submission.language - Programming language
   * @returns {Promise<Object>} Submission result with test cases
   */
  async submitSolution(submission) {
    try {
      const response = await api.post('/challenges/submit', submission);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Run code without submitting (test run)
   * @param {Object} testRun - Test run data
   * @param {string} testRun.challengeId - Challenge ID
   * @param {string} testRun.code - User's code
   * @param {string} testRun.language - Programming language
   * @param {Array} testRun.testCases - Custom test cases (optional)
   * @returns {Promise<Object>} Test run results
   */
  async runCode(testRun) {
    try {
      const response = await api.post('/challenges/run', testRun);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const result = {
          passed: 3,
          total: 3,
          time: Math.floor(Math.random() * 100) + 30,
          memory: (Math.random() * 20 + 10).toFixed(1),
          details: 'Test Case 1: ✅ Passed\nTest Case 2: ✅ Passed\nTest Case 3: ✅ Passed\n\nAll test cases passed! 🎉',
        };
        return { success: true, data: result, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get user's submission history
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.status - Submission status filter
   * @returns {Promise<Object>} User's submissions
   */
  async getUserSubmissions(params = {}) {
    try {
      const response = await api.get('/challenges/submissions', { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get submission details by ID
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} Submission details
   */
  async getSubmissionById(submissionId) {
    try {
      const response = await api.get(`/challenges/submissions/${submissionId}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get challenge statistics
   * @param {string} challengeId - Challenge ID
   * @returns {Promise<Object>} Challenge statistics
   */
  async getChallengeStats(challengeId) {
    try {
      const response = await api.get(`/challenges/${challengeId}/stats`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get user's progress on challenges
   * @returns {Promise<Object>} User progress data
   */
  async getUserProgress() {
    try {
      const response = await api.get('/challenges/progress');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get hints for a challenge
   * @param {string} challengeId - Challenge ID
   * @param {number} hintLevel - Hint level (1, 2, 3)
   * @returns {Promise<Object>} Hint data
   */
  async getHint(challengeId, hintLevel) {
    try {
      const response = await api.get(`/challenges/${challengeId}/hints/${hintLevel}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Save code draft
   * @param {Object} draft - Code draft data
   * @param {string} draft.challengeId - Challenge ID
   * @param {string} draft.code - Code content
   * @param {string} draft.language - Programming language
   * @returns {Promise<Object>} Save response
   */
  async saveDraft(draft) {
    try {
      const response = await api.post('/challenges/drafts', draft);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        return { success: true, data: { saved: true, draft }, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get saved code draft
   * @param {string} challengeId - Challenge ID
   * @returns {Promise<Object>} Draft data
   */
  async getDraft(challengeId) {
    try {
      const response = await api.get(`/challenges/drafts/${challengeId}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get challenge categories
   * @returns {Promise<Object>} Available categories
   */
  async getCategories() {
    try {
      const response = await api.get('/challenges/categories');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get supported programming languages
   * @returns {Promise<Object>} Supported languages
   */
  async getSupportedLanguages() {
    try {
      const response = await api.get('/challenges/languages');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Report a challenge issue
   * @param {Object} report - Issue report data
   * @param {string} report.challengeId - Challenge ID
   * @param {string} report.type - Issue type
   * @param {string} report.description - Issue description
   * @returns {Promise<Object>} Report response
   */
  async reportIssue(report) {
    try {
      const response = await api.post('/challenges/report', report);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }
}

// Export singleton instance
export default new ChallengeService();
