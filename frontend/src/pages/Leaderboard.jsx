import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, User } from 'lucide-react';
import leaderboardService from '../services/leaderboardService';

/**
 * Leaderboard page component
 * Displays top users ranked by their coding performance
 */
const Leaderboard = () => {
  const [timeframe, setTimeframe] = useState('all-time');
  const [category, setCategory] = useState('overall');

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [activeCompetitors, setActiveCompetitors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lb, stats] = await Promise.all([
          leaderboardService.getGlobalLeaderboard({ timeframe, category }),
          leaderboardService.getLeaderboardStats(),
        ]);
        if (lb.success) setLeaderboardData(lb.data.users || []);
        else setError(lb.error || 'Failed to load leaderboard');
        if (stats.success) setActiveCompetitors(stats.data.activeCompetitors || 0);
      } catch (e) {
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeframe, category]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            🏆 Global Leaderboard
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how you rank among the best coders worldwide. Compete, learn, and climb to the top!
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="input-field"
                >
                  <option value="all-time">All Time</option>
                  <option value="monthly">This Month</option>
                  <option value="weekly">This Week</option>
                  <option value="daily">Today</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                >
                  <option value="overall">Overall Score</option>
                  <option value="problems">Problems Solved</option>
                  <option value="streak">Current Streak</option>
                  <option value="speed">Fastest Solutions</option>
                </select>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{activeCompetitors.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Active Competitors</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">{error}</div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {leaderboardData.slice(0, 3).map((user) => (
            <div
              key={user.rank}
              className={`card text-center ${
                user.rank === 1 ? 'ring-2 ring-yellow-400 transform scale-105' : ''
              }`}
            >
              <div className="flex justify-center mb-4">
                {getRankIcon(user.rank)}
              </div>
              <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {user.username}
              </h3>
              <div className="text-2xl font-bold text-primary-600 mb-2">
                {user.score.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>{user.problemsSolved} problems solved</div>
                <div className="flex items-center justify-center space-x-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>{user.streak} day streak</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Full Leaderboard Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Rankings</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Problems
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Streak
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaderboardData.map((user) => (
                  <tr key={user.rank} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getRankBadgeColor(user.rank)}`}>
                        {user.rank <= 3 ? getRankIcon(user.rank) : user.rank}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-primary-600">
                        {user.score.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.problemsSolved}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-900">{user.streak}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.country}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Your Rank Section */}
        <div className="mt-8 bg-primary-50 border border-primary-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary-900 mb-2">
                Your Current Rank
              </h3>
              <p className="text-primary-700">
                Keep solving problems to climb the leaderboard!
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">#247</div>
              <div className="text-sm text-primary-700">out of 8,247</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
