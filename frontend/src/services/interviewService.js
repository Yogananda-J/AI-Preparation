import api, { handleApiResponse, handleApiError } from './api';

/**
 * Interview service
 * Handles mock interviews, AI evaluation, and interview-related operations
 */

class InterviewService {
  /**
   * Start a new mock interview session
   * @param {Object} config - Interview configuration
   * @param {string} config.type - Interview type (technical, behavioral, system-design)
   * @param {string} config.difficulty - Difficulty level (easy, medium, hard)
   * @param {number} config.duration - Duration in minutes
   * @param {Array} config.topics - Specific topics to focus on
   * @returns {Promise<Object>} Interview session data
   */
  async startInterview(config) {
    try {
      const response = await api.post('/interviews/start', config);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const session = {
          id: 'dev-session-1',
          startedAt: new Date().toISOString(),
          config,
        };
        return { success: true, data: session, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get interview session by ID
   * @param {string} sessionId - Interview session ID
   * @returns {Promise<Object>} Interview session details
   */
  async getInterviewSession(sessionId) {
    try {
      const response = await api.get(`/interviews/${sessionId}`);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        return { success: true, data: { id: sessionId }, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get next question in interview
   * @param {string} sessionId - Interview session ID
   * @returns {Promise<Object>} Next question data
   */
  async getNextQuestion(sessionId) {
    try {
      const response = await api.get(`/interviews/${sessionId}/next-question`);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const pool = [
          { id: 'q1', type: 'coding', question: 'Implement a function to reverse a linked list', difficulty: 'Medium', timeLimit: 15, hints: ['Iterative vs recursive', 'Use three pointers', 'Handle empty list'] },
          { id: 'q2', type: 'system-design', question: 'Design a URL shortening service like bit.ly', difficulty: 'Hard', timeLimit: 20, hints: ['Scalability', 'Database design', 'Custom URLs'] },
          { id: 'q3', type: 'behavioral', question: 'Tell me about a time you debugged a complex production issue', difficulty: 'Medium', timeLimit: 10, hints: ['STAR method', 'Problem-solving', 'Lessons learned'] },
        ];
        const q = pool[Math.floor(Math.random() * pool.length)];
        return { success: true, data: q, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Submit answer to interview question
   * @param {Object} submission - Answer submission
   * @param {string} submission.sessionId - Interview session ID
   * @param {string} submission.questionId - Question ID
   * @param {string} submission.answer - User's answer
   * @param {string} submission.code - Code solution (for coding questions)
   * @param {number} submission.timeSpent - Time spent on question (seconds)
   * @returns {Promise<Object>} Submission response
   */
  async submitAnswer(submission) {
    try {
      const response = await api.post('/interviews/submit-answer', submission);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        return { success: true, data: { received: true }, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Complete interview session
   * @param {string} sessionId - Interview session ID
   * @returns {Promise<Object>} Interview completion data with results
   */
  async completeInterview(sessionId) {
    try {
      const response = await api.post(`/interviews/${sessionId}/complete`);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const summary = { score: 85, time: 38 * 60, grade: 'A-' };
        return { success: true, data: summary, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get AI feedback for interview performance
   * @param {string} sessionId - Interview session ID
   * @returns {Promise<Object>} AI feedback and evaluation
   */
  async getAIFeedback(sessionId) {
    try {
      const response = await api.get(`/interviews/${sessionId}/feedback`);
      return handleApiResponse(response);
    } catch (error) {
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        const feedback = {
          strengths: ['Clear problem-solving', 'Handles edge cases', 'Good structure'],
          improvements: ['Explain trade-offs', 'Optimize time complexity'],
          perQuestion: [90, 80, 85],
        };
        return { success: true, data: feedback, status: 200 };
      }
      return handleApiError(error);
    }
  }

  /**
   * Get user's interview history
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.type - Interview type filter
   * @param {string} params.status - Status filter (completed, in-progress, abandoned)
   * @returns {Promise<Object>} Interview history
   */
  async getInterviewHistory(params = {}) {
    try {
      const response = await api.get('/interviews/history', { params });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get interview statistics and analytics
   * @param {string} timeframe - Timeframe (week, month, year, all-time)
   * @returns {Promise<Object>} Interview statistics
   */
  async getInterviewStats(timeframe = 'all-time') {
    try {
      const response = await api.get('/interviews/stats', {
        params: { timeframe }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get interview performance trends
   * @param {string} metric - Performance metric (score, time, accuracy)
   * @param {string} period - Time period (daily, weekly, monthly)
   * @returns {Promise<Object>} Performance trend data
   */
  async getPerformanceTrends(metric = 'score', period = 'weekly') {
    try {
      const response = await api.get('/interviews/trends', {
        params: { metric, period }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get available interview templates
   * @param {string} type - Interview type filter
   * @returns {Promise<Object>} Available templates
   */
  async getInterviewTemplates(type = null) {
    try {
      const response = await api.get('/interviews/templates', {
        params: type ? { type } : {}
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Create custom interview template
   * @param {Object} template - Template configuration
   * @param {string} template.name - Template name
   * @param {string} template.description - Template description
   * @param {Array} template.questions - Questions in template
   * @param {Object} template.settings - Template settings
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(template) {
    try {
      const response = await api.post('/interviews/templates', template);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Pause interview session
   * @param {string} sessionId - Interview session ID
   * @returns {Promise<Object>} Pause response
   */
  async pauseInterview(sessionId) {
    try {
      const response = await api.post(`/interviews/${sessionId}/pause`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Resume paused interview session
   * @param {string} sessionId - Interview session ID
   * @returns {Promise<Object>} Resume response
   */
  async resumeInterview(sessionId) {
    try {
      const response = await api.post(`/interviews/${sessionId}/resume`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get interview question hints
   * @param {string} sessionId - Interview session ID
   * @param {string} questionId - Question ID
   * @param {number} hintLevel - Hint level (1, 2, 3)
   * @returns {Promise<Object>} Hint data
   */
  async getHint(sessionId, questionId, hintLevel) {
    try {
      const response = await api.get(`/interviews/${sessionId}/questions/${questionId}/hints/${hintLevel}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Save interview progress (draft)
   * @param {Object} progress - Progress data
   * @param {string} progress.sessionId - Interview session ID
   * @param {Object} progress.currentState - Current interview state
   * @returns {Promise<Object>} Save response
   */
  async saveProgress(progress) {
    try {
      const response = await api.post('/interviews/save-progress', progress);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get interview recommendations based on performance
   * @returns {Promise<Object>} Personalized recommendations
   */
  async getRecommendations() {
    try {
      const response = await api.get('/interviews/recommendations');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Rate interview experience
   * @param {Object} rating - Rating data
   * @param {string} rating.sessionId - Interview session ID
   * @param {number} rating.score - Rating score (1-5)
   * @param {string} rating.feedback - Optional feedback text
   * @returns {Promise<Object>} Rating response
   */
  async rateInterview(rating) {
    try {
      const response = await api.post('/interviews/rate', rating);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Report interview issue
   * @param {Object} report - Issue report
   * @param {string} report.sessionId - Interview session ID
   * @param {string} report.type - Issue type
   * @param {string} report.description - Issue description
   * @returns {Promise<Object>} Report response
   */
  async reportIssue(report) {
    try {
      const response = await api.post('/interviews/report', report);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get interview preparation resources
   * @param {string} type - Resource type (articles, videos, tips)
   * @returns {Promise<Object>} Preparation resources
   */
  async getPreparationResources(type = null) {
    try {
      const response = await api.get('/interviews/resources', {
        params: type ? { type } : {}
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  // ----- Interview V2 (MCQ + video) helpers -----

  /**
   * Start a new InterviewV2 session (MCQ + video based) using a backend config.
   * @param {Object} payload
   * @param {string} payload.configId - InterviewConfigV2 ID
   * @param {{given:boolean, at?:string}} payload.consent - Consent info
   */
  async startInterviewV2(payload) {
    try {
      const response = await api.post('/interviews-v2', payload);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get InterviewV2 session details.
   * @param {string} interviewId
   */
  async getInterviewSessionV2(interviewId) {
    try {
      const response = await api.get(`/interviews-v2/${interviewId}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Submit or update a response for an InterviewV2 question.
   * Handles both MCQ and VIDEO types.
   * @param {string} interviewId
   * @param {Object} body
   */
  async submitResponseV2(interviewId, body) {
    try {
      const response = await api.post(`/interviews-v2/${interviewId}/responses`, body);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Complete an InterviewV2 session and get MCQ summary (video analysis is async).
   * @param {string} interviewId
   */
  async completeInterviewV2(interviewId) {
    try {
      const response = await api.post(`/interviews-v2/${interviewId}/complete`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get the final InterviewV2 report (MCQ + video anomaly + recommendation).
   * @param {string} interviewId
   */
  async getInterviewReportV2(interviewId) {
    try {
      const response = await api.get(`/interviews-v2/${interviewId}/report`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Upload a recorded interview video (base64) and attach it to InterviewV2 response.
   * @param {Object} payload
   * @param {string} payload.interviewId
   * @param {string} payload.questionId
   * @param {string} payload.videoB64 - Base64 encoded video blob (without data URL prefix)
   * @param {number} payload.durationSec
   */
  async uploadInterviewVideoV2(payload) {
    try {
      const response = await api.post('/upload/interview-video', payload);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Upload a single overall interview video for the entire InterviewV2 session.
   * This is used when the webcam is recording throughout the MCQ test.
   * @param {Object} payload
   * @param {string} payload.interviewId
   * @param {string} payload.videoB64
   * @param {number} payload.durationSec
   */
  async uploadOverallInterviewVideoV2(payload) {
    try {
      const response = await api.post('/upload/interview-overall-video', payload);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  }
}

/**
 * Export singleton instance
 */
export default new InterviewService();
