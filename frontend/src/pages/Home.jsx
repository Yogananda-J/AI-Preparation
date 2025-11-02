import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code, Trophy, MessageSquare, ArrowRight, Star, Users, Target } from 'lucide-react';

/**
 * Home page component
 * Landing page with hero section, features, and call-to-action
 */

const Home = () => {
  // Daily challenges removed per requirements
  const features = [
    {
      icon: Code,
      title: 'AI-Powered Challenges',
      description: 'Get personalized coding challenges based on your skill level and learning progress.',
      href: '/challenge',
    },
    {
      icon: MessageSquare,
      title: 'Mock Interviews',
      description: 'Practice with AI-conducted mock interviews to prepare for real coding interviews.',
      href: '/interview',
    },
    {
      icon: Trophy,
      title: 'Leaderboard & Progress',
      description: 'Track your progress and compete with other developers on our global leaderboard.',
      href: '/leaderboard',
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
            <p className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">UpSkill</p>
            <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
              Practice coding challenges, track progress, and prepare with structured mock interviews.
              Build confidence and improve consistently with a simple, focused workflow.
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

      {/* Daily Challenges removed */}

      {/* Features Section moved above Stats */}
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
                <Link key={index} to={feature.href} className="card text-center hover:shadow-lg transition-shadow duration-300 group">
                  <div className="flex justify-center mb-6">
                    <div className="bg-primary-100 p-4 rounded-full group-hover:bg-primary-200">
                      <Icon className="h-8 w-8 text-primary-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section moved below Features */}
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
