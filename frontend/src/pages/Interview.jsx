import { useState } from 'react';
import { Play, Clock, CheckCircle, AlertCircle, MessageSquare, Code } from 'lucide-react';
import interviewService from '../services/interviewService';

/**
 * Mock Interview page component
 * Simulates AI-powered coding interviews with random questions
 */
const Interview = () => {
  const [interviewState, setInterviewState] = useState('setup'); // setup, active, completed
  const [session, setSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(45 * 60); // 45 minutes in seconds
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startInterview = async () => {
    setIsLoading(true);
    try {
      const res = await interviewService.startInterview({ type: 'mixed', difficulty: 'mixed', duration: 45, topics: [] });
      if (res.success) {
        setSession(res.data);
        const nq = await interviewService.getNextQuestion(res.data.id);
        if (nq.success) {
          setCurrentQuestion(nq.data);
          setInterviewState('active');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    const answerValue = document.getElementById('answer-input').value;
    if (!currentQuestion || !session) return;
    setIsLoading(true);
    try {
      await interviewService.submitAnswer({
        sessionId: session.id,
        questionId: currentQuestion.id,
        answer: answerValue,
        code: undefined,
        timeSpent: 0,
      });

      const newAnswers = { ...answers, [currentQuestion.id]: answerValue };
      setAnswers(newAnswers);

      // Try to fetch next question
      const nq = await interviewService.getNextQuestion(session.id);
      if (nq.success && nq.data) {
        setCurrentQuestion(nq.data);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        // No more questions, complete interview
        await completeInterview();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const completeInterview = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      await interviewService.completeInterview(session.id);
      const fb = await interviewService.getAIFeedback(session.id);
      if (fb.success) setFeedback(fb.data);
      setInterviewState('completed');
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getQuestionIcon = (type) => {
    switch (type) {
      case 'coding': return <Code className="h-5 w-5" />;
      case 'system-design': return <MessageSquare className="h-5 w-5" />;
      case 'behavioral': return <MessageSquare className="h-5 w-5" />;
      default: return <MessageSquare className="h-5 w-5" />;
    }
  };

  if (interviewState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              🎯 AI Mock Interview
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Practice with our AI interviewer to prepare for real coding interviews. 
              Get instant feedback and improve your performance.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Interview Setup</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Interview Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">45 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Questions:</span>
                    <span className="font-medium">{interviewQuestions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Difficulty:</span>
                    <span className="font-medium">Mixed</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="font-medium">Coding + System Design + Behavioral</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">What to Expect</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Real-time coding challenges</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>System design questions</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Behavioral interview questions</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>AI-powered feedback and scoring</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Interview Tips</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Think out loud and explain your approach</li>
                    <li>• Ask clarifying questions when needed</li>
                    <li>• Consider edge cases and optimize your solutions</li>
                    <li>• Stay calm and take your time to think</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={startInterview}
                className="btn-primary text-lg px-8 py-3 inline-flex items-center"
              >
                <Play className="mr-2 h-5 w-5" />
                Start Interview
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (interviewState === 'active') {
    const question = currentQuestion;
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Interview Header */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">
                    Time Remaining: {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="text-gray-400">|</div>
                <div className="text-sm text-gray-600">
                  Question {currentQuestionIndex + 1}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getQuestionIcon(question.type)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Question Panel */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  {getQuestionIcon(question.type)}
                  <h2 className="text-xl font-semibold text-gray-900 capitalize">
                    {question.type.replace('-', ' ')} Question
                  </h2>
                </div>
                <p className="text-gray-700 text-lg mb-6">{question.question}</p>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Time Limit</h3>
                  <p className="text-gray-600">{question.timeLimit} minutes</p>
                </div>
              </div>

              {/* Answer Input */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Answer</h3>
                <textarea
                  id="answer-input"
                  rows={12}
                  className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  placeholder={
                    question.type === 'coding' 
                      ? '// Write your code here...\nfunction solution() {\n    \n}'
                      : 'Type your answer here...'
                  }
                />
                <div className="mt-4 flex justify-between">
                  <button className="btn-secondary">
                    Save Draft
                  </button>
                  <button
                    onClick={submitAnswer}
                    className="btn-primary"
                  >
                    {currentQuestion < interviewQuestions.length - 1 ? 'Next Question' : 'Finish Interview'}
                  </button>
                </div>
              </div>
            </div>

            {/* Hints Panel */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Hints</h3>
                <div className="space-y-3">
                  {question.hints?.map((hint, index) => (
                    <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">{hint}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress</h3>
                <div className="space-y-3">
                  {[{id:'1'}, {id:'2'}, {id:'3'}].map((q, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        index < currentQuestion 
                          ? 'bg-green-100 text-green-600' 
                          : index === currentQuestion 
                            ? 'bg-primary-100 text-primary-600' 
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index < currentQuestion ? '✓' : index + 1}
                      </div>
                      <span className={`text-sm ${
                        index === currentQuestion ? 'font-medium text-gray-900' : 'text-gray-600'
                      }`}>
                        {q.type.replace('-', ' ')} Question
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (interviewState === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Interview Completed! 🎉
            </h1>
            <p className="text-xl text-gray-600">
              Great job! Here's your performance summary and AI feedback.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Performance Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">85%</div>
                <div className="text-gray-600">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">38m</div>
                <div className="text-gray-600">Time Taken</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">A-</div>
                <div className="text-gray-600">Grade</div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">AI Feedback</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800">
                    <strong>Strengths:</strong> You demonstrated strong problem-solving skills and provided 
                    well-structured solutions. Your approach to the linked list problem was efficient and 
                    you handled edge cases well.
                  </p>
                  <p className="text-blue-800 mt-2">
                    <strong>Areas for Improvement:</strong> Consider optimizing time complexity in your 
                    solutions and practice explaining your thought process more clearly during system design questions.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Detailed Breakdown</h3>
                <div className="space-y-3">
                  {interviewQuestions.map((q, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getQuestionIcon(q.type)}
                        <span className="font-medium text-gray-900 capitalize">
                          {q.type.replace('-', ' ')} Question
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-green-600 font-medium">
                          {index === 0 ? '90%' : index === 1 ? '80%' : '85%'}
                        </span>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setInterviewState('setup');
                  setCurrentQuestion(0);
                  setAnswers({});
                }}
                className="btn-primary"
              >
                Take Another Interview
              </button>
              <button className="btn-secondary">
                View Detailed Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default Interview;
