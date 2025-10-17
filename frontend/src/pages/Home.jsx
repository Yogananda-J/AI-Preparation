import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code, Trophy, MessageSquare, ArrowRight, Star, Users, Target } from 'lucide-react';
import challengeService from '../services/challengeService';
import { getDifficultyColor } from '../utils/helpers';

/**
 * Home page component
 * Landing page with hero section, features, and call-to-action
 */

const Home = () => {
  const [daily, setDaily] = useState({ date: '', challenges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDaily = async () => {
      try {
        setLoading(true);
        const res = await challengeService.getDailyChallenges();
        if (res.success) {
          setDaily(res.data);
        } else {
          setError(res.error || 'Failed to load daily challenges');
        }
      } catch (err) {
        setError('Failed to load daily challenges');
      } finally {
        setLoading(false);
      }
    };
    fetchDaily();
  }, []);
  const features = [
    {
      icon: Code,
      title: 'AI-Powered Challenges',
      description: 'Get personalized coding challenges based on your skill level and learning progress.',
    },
    {
      icon: MessageSquare,
      title: 'Mock Interviews',
      description: 'Practice with AI-conducted mock interviews to prepare for real coding interviews.',
    },
    {
      icon: Trophy,
      title: 'Leaderboard & Progress',
      description: 'Track your progress and compete with other developers on our global leaderboard.',
    },
  ];

  const stats = [
    { label: 'Active Users', value: '10K+', icon: Users },
    { label: 'Challenges Solved', value: '50K+', icon: Target },
    { label: 'Success Rate', value: '95%', icon: Star },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 to-secondary-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Master Coding with{' '}
              <span className="text-primary-600">AI-Powered</span> Practice
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Enhance your programming skills with personalized challenges, real-time coding environment, 
              and AI-driven interview preparation. Perfect for competitive programming and job interviews.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/challenge"
                className="btn-primary text-lg px-8 py-3 inline-flex items-center"
              >
                Start Coding
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/interview"
                className="btn-secondary text-lg px-8 py-3 inline-flex items-center"
              >
                Try Mock Interview
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Challenges Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Daily Challenges
            </h2>
            <div className="text-sm text-gray-600">
              {daily.date && (
                <span>For {new Date(daily.date).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 h-40 rounded-lg" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {daily.challenges.map((c) => (
                <div key={c.id} className="card">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 pr-2">
                      {c.title}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(c.difficulty)}`}>
                      {c.difficulty}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center text-sm text-gray-600 gap-4">
                    <span className="inline-flex items-center gap-1">
                      <Code className="h-4 w-4 text-primary-600" />
                      {c.category}
                    </span>
                    <span>{c.acceptance}% acceptance</span>
                    <span>{c.points} pts</span>
                  </div>
                  <div className="mt-4">
                    <Link to={`/challenge/${c.id}`} className="btn-primary inline-flex items-center">
                      Solve Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="bg-primary-100 p-3 rounded-full">
                      <Icon className="h-8 w-8 text-primary-600" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                  <div className="text-gray-600">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Excel
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our platform provides comprehensive tools and features to help you become a better programmer.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="card text-center hover:shadow-lg transition-shadow duration-300">
                  <div className="flex justify-center mb-6">
                    <div className="bg-primary-100 p-4 rounded-full">
                      <Icon className="h-8 w-8 text-primary-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Level Up Your Coding Skills?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of developers who are already improving their skills with our AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-primary-600 hover:bg-gray-100 font-medium py-3 px-8 rounded-lg transition-colors duration-200 inline-flex items-center"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/leaderboard"
              className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-medium py-3 px-8 rounded-lg transition-colors duration-200"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
