import { useEffect, useState } from 'react';
import { User, Calendar, Trophy, Target, TrendingUp, Edit, Settings } from 'lucide-react';
import authService from '../services/authService';

/**
 * Profile page component
 * Displays user statistics, solved challenges, and progress tracking
 */
const Profile = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await authService.getCurrentUser();
        if (res.success) {
          const base = res.data || {};
          // Merge with defaults for demo stats if backend not present
          const merged = {
            username: base.username || 'john_coder',
            email: base.email || 'john@example.com',
            joinDate: base.joinDate || '2024-01-15',
            avatar: null,
            stats: base.stats || {
              totalSolved: 87,
              currentStreak: 12,
              maxStreak: 28,
              totalScore: 1850,
              rank: 247,
              accuracy: 85
            },
            recentActivity: base.recentActivity || [
              { date: '2024-10-17', problem: 'Two Sum', difficulty: 'Easy', status: 'solved', time: '15m' },
              { date: '2024-10-16', problem: 'Binary Tree Inorder', difficulty: 'Medium', status: 'solved', time: '32m' },
              { date: '2024-10-15', problem: 'Merge Intervals', difficulty: 'Medium', status: 'attempted', time: '45m' },
              { date: '2024-10-14', problem: 'Valid Parentheses', difficulty: 'Easy', status: 'solved', time: '8m' },
              { date: '2024-10-13', problem: 'Longest Substring', difficulty: 'Medium', status: 'solved', time: '28m' }
            ],
            skillProgress: base.skillProgress || {
              'Arrays': 85,
              'Strings': 78,
              'Trees': 65,
              'Dynamic Programming': 45,
              'Graphs': 52,
              'Sorting': 90
            }
          };
          setUserData(merged);
        } else {
          setError(res.error || 'Failed to load profile');
        }
      } catch (e) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'solved': return 'text-green-600';
      case 'attempted': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: User },
    { id: 'activity', name: 'Recent Activity', icon: Calendar },
    { id: 'skills', name: 'Skills', icon: Target },
    { id: 'settings', name: 'Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-40 bg-gray-100 rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  const data = userData;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="h-12 w-12 text-gray-600" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {data.username}
                  </h1>
                  <p className="text-gray-600 mb-2">{data.email}</p>
                  <p className="text-sm text-gray-500">
                    Member since {new Date(data.joinDate).toLocaleDateString()}
                  </p>
                </div>
                <button className="btn-secondary mt-4 md:mt-0 flex items-center space-x-2">
                  <Edit className="h-4 w-4" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{data.stats.totalSolved}</div>
            <div className="text-sm text-gray-600">Problems Solved</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{data.stats.currentStreak}</div>
            <div className="text-sm text-gray-600">Current Streak</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">#{data.stats.rank}</div>
            <div className="text-sm text-gray-600">Global Rank</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-2xl font-bold text-gray-900">{data.stats.accuracy}%</div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Solving Streak</h4>
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold text-green-600">
                          {userData.stats.currentStreak}
                        </div>
                        <div className="text-sm text-gray-600">
                          Max: {userData.stats.maxStreak} days
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Total Score</h4>
                      <div className="text-2xl font-bold text-primary-600">
                        {userData.stats.totalScore.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity Tab */}
            {activeTab === 'activity' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {data.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-500">
                          {new Date(activity.date).toLocaleDateString()}
                        </div>
                        <div className="font-medium text-gray-900">{activity.problem}</div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(activity.difficulty)}`}>
                          {activity.difficulty}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">{activity.time}</div>
                        <div className={`font-medium ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Tab */}
            {activeTab === 'skills' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Progress</h3>
                <div className="space-y-4">
                  {Object.entries(data.skillProgress).map(([skill, progress]) => (
                    <div key={skill} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{skill}</span>
                        <span className="text-sm text-gray-600">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      defaultValue={userData.username}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={userData.email}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notifications
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input type="checkbox" className="mr-2" defaultChecked />
                        <span className="text-sm text-gray-700">Daily challenge reminders</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="mr-2" defaultChecked />
                        <span className="text-sm text-gray-700">Leaderboard updates</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="mr-2" />
                        <span className="text-sm text-gray-700">Marketing emails</span>
                      </label>
                    </div>
                  </div>
                  <button className="btn-primary">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
