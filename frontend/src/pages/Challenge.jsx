import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, RotateCcw, Save, Clock } from 'lucide-react';
import CodeEditor from '../components/CodeEditor';
import challengeService from '../services/challengeService';

/**
 * Challenge page component
 * Displays coding challenges with code editor (placeholder for Monaco)
 */
const Challenge = () => {
  const { id } = useParams();
  const [language, setLanguage] = useState('javascript');
  const TEMPLATES = {
    javascript: `// Write your solution here\nfunction solution(nums, target) {\n  // TODO\n  return [];\n}`,
    python: `# Write your solution here\ndef solution(nums, target):\n    # TODO\n    return []`,
    java: `// Write your solution here\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // TODO\n        return new int[]{};\n    }\n}`,
    cpp: `// Write your solution here\n#include <vector>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    // TODO\n    return {};\n}`,
  };
  const [code, setCode] = useState(TEMPLATES[language]);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');

  // Mock challenge data - will be replaced with API call
  const challenge = {
    id: id || '1',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1,2]',
        explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].'
      }
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ]
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running code...');
    try {
      const res = await challengeService.runCode({
        challengeId: challenge.id,
        code,
        language,
      });
      if (res.success) {
        const r = res.data;
        const report = `Test Cases: ${r.passed}/${r.total}\nExecution Time: ${r.time}ms\nMemory Usage: ${r.memory}MB\n\n${r.details}`;
        setOutput(report);
      } else {
        setOutput(`Error: ${res.error || 'Unknown error'}`);
      }
    } catch (e) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleResetCode = () => {
    setCode('// Write your solution here\nfunction solution() {\n    \n}');
    setOutput('');
  };

  const handleSaveCode = async () => {
    try {
      await challengeService.saveDraft({ challengeId: challenge.id, code, language });
      alert('Code saved successfully!');
    } catch (e) {
      alert('Failed to save draft.');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Problem Description */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{challenge.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(challenge.difficulty)}`}>
                {challenge.difficulty}
              </span>
            </div>

            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Problem Description</h3>
              <p className="text-gray-700 mb-6 whitespace-pre-line">{challenge.description}</p>

              <h3 className="text-lg font-semibold text-gray-900 mb-3">Examples</h3>
              {challenge.examples.map((example, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="font-medium text-gray-900">Example {index + 1}:</p>
                  <p className="text-gray-700 mt-1">
                    <strong>Input:</strong> {example.input}
                  </p>
                  <p className="text-gray-700">
                    <strong>Output:</strong> {example.output}
                  </p>
                  {example.explanation && (
                    <p className="text-gray-600 text-sm mt-2">
                      <strong>Explanation:</strong> {example.explanation}
                    </p>
                  )}
                </div>
              ))}

              <h3 className="text-lg font-semibold text-gray-900 mb-3">Constraints</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {challenge.constraints.map((constraint, index) => (
                  <li key={index}>{constraint}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Code Editor and Output */}
          <div className="space-y-6">
            {/* Code Editor */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Code Editor</h2>
                <div className="flex items-center space-x-2">
                  <select
                    value={language}
                    onChange={(e) => { const lang = e.target.value; setLanguage(lang); setCode(TEMPLATES[lang]); }}
                    className="input-field h-9"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button
                    onClick={handleResetCode}
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={handleSaveCode}
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
              
              {/* Monaco Editor */}
              <div className="p-4">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={language === 'cpp' ? 'cpp' : language}
                  height="360px"
                  theme="vs-dark"
                />
              </div>

              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="btn-primary w-full flex items-center justify-center space-x-2"
                >
                  {isRunning ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Run Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Output</h2>
              </div>
              <div className="p-4">
                {output ? (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-md">
                    {output}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm">Run your code to see the output here.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Challenge;
