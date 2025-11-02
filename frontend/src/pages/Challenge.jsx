import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, RotateCcw, Save, Clock, List, X } from 'lucide-react';
import CodeEditor from '../components/CodeEditor';
import challengeService from '../services/challengeService';
import authService from '../services/authService';

/**
 * Challenge page component
 * Displays coding challenges with code editor (placeholder for Monaco)
 */
const Challenge = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState('python');
  const [challengeList, setChallengeList] = useState([]);
  const [nextChallengeId, setNextChallengeId] = useState(null);
  const [leftTab, setLeftTab] = useState('description'); // description | editorial | solutions | submissions | hints
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const GENERIC_TEMPLATES = {
    javascript: `// Write your solution here\n// Read inputs from stdin if needed and print output\n`,
    python: `# Write your solution here\n# Read inputs from stdin if needed and print output\n`,
    java: `// Write your solution here\nclass Solution {\n    public static void main(String[] args) throws Exception {\n        // Read stdin and print output\n    }\n}\n`,
    cpp: `// Write your solution here\n#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n  // Read stdin and print output\n  return 0;\n}\n`,
  };

  // Load submissions for the current user and challenge when Submissions tab is active or after a submit
  useEffect(() => {
    const loadSubs = async () => {
      if (leftTab !== 'submissions') return;
      setLoadingSubs(true);
      try {
        const res = await authService.getSubmissionLogs(100);
        if (res.success && res.data?.logs) {
          const items = res.data.logs.filter((x) => x.challengeId === (id || '1'));
          setSubmissions(items);
        } else {
          setSubmissions([]);
        }
      } finally {
        setLoadingSubs(false);
      }
    };
    loadSubs();
  }, [leftTab, id]);

  const handleSubmitSolution = async () => {
    try {
      const res = await challengeService.submitSolution({ challengeId: challenge.id, code, language });
      if (!res.success) return alert(res.error || 'Submission failed');

      // Async pipeline: if 202 with submissionId, start polling
      if (res.status === 202 && res.data?.submissionId) {
        const subId = res.data.submissionId;
        setLeftTab('submissions');
        setHasSubmitted(true);
        setRunResult(null);
        setSubmissionResult({ id: subId, verdict: 'PENDING', timeMs: 0, memoryMB: 0 });

        let attempts = 0;
        const maxAttempts = 90; // ~3 minutes at 2s interval
        const timer = setInterval(async () => {
          attempts += 1;
          const stat = await challengeService.getSubmissionStatus(subId);
          if (stat.success) {
            const d = stat.data;
            if (d.status === 'DONE' || d.status === 'ERROR') {
              clearInterval(timer);
              setSubmissionResult({ id: d.id, verdict: d.verdict, timeMs: d.timeMs, memoryMB: d.memoryMB, caseResults: d.caseResults });
              setOutput(`Verdict: ${d.verdict}\nTime: ${d.timeMs}ms\nMemory: ${d.memoryMB}MB`);
              setActiveTab('final');
              // Optionally refresh profile
              try { await authService.getCurrentUser(); } catch (_) {}
            }
          }
          if (attempts >= maxAttempts) {
            clearInterval(timer);
            alert('Submission polling timed out. Please check Submissions later.');
          }
        }, 2000);
        return;
      }

      // Legacy immediate response path (201) remains supported
      if (res.data?.submission) {
        const s = res.data.submission;
        setSubmissionResult(s);
        setOutput(`Verdict: ${s.verdict}\nScore: ${s.score}\nTime: ${s.timeMs}ms\nMemory: ${s.memoryMB}MB`);
        if (res.data.updatedStats) {
          const stored = localStorage.getItem('user');
          if (stored) {
            try { const user = JSON.parse(stored); user.stats = res.data.updatedStats; localStorage.setItem('user', JSON.stringify(user)); } catch (_) {}
          }
        }
        try { await authService.getCurrentUser(); } catch (_) {}
        if (res.data.nextChallengeId) setNextChallengeId(res.data.nextChallengeId);
        setHasSubmitted(true);
        setActiveTab('final');
        setLeftTab('submissions');
        setRunResult(null);
      }
    } catch (e) {
      alert('You must be logged in to submit.');
    }
  };
  const [code, setCode] = useState(GENERIC_TEMPLATES[language]);
  const [codesByLang, setCodesByLang] = useState({ python: GENERIC_TEMPLATES.python, java: GENERIC_TEMPLATES.java });
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [lastRunCases, setLastRunCases] = useState([]);
  const [activeTab, setActiveTab] = useState('case1'); // dynamic: caseX | final
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [userEdited, setUserEdited] = useState(false);
  const [testCases, setTestCases] = useState([]); // [{id:'case1', fields:[{name,value}]}]
  const [testCaseValues, setTestCaseValues] = useState({}); // { caseId: [{name,value}] }

  const parseRunDetails = (details) => {
    if (!details || typeof details !== 'string') return [];
    const lines = details.split('\n').filter(Boolean);
    const cases = [];
    for (const line of lines) {
      const m = line.match(/Test Case\s*(\d+)\s*:\s*(✅|❌)\s*(Passed|Failed)/i);
      if (m) {
        cases.push({
          id: m[1],
          ok: m[2] === '✅' || /passed/i.test(m[3]),
          label: /passed/i.test(m[3]) ? 'Passed' : 'Failed',
        });
      }
    }
    return cases;
  };

  // Load saved draft on mount (per-user)
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const res = await challengeService.getDraft(id || '1');
        if (res.success && res.data) {
          if (res.data.language) setLanguage(['python','java'].includes(res.data.language) ? res.data.language : 'python');
          if (typeof res.data.code === 'string') {
            setCode(res.data.code);
            setCodesByLang((prev) => ({ ...prev, [res.data.language || 'python']: res.data.code }));
          }
        }
      } catch (e) {
        // Ignore errors (e.g., 404 when no draft exists)
      }
    };
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load all challenges for navigation
  useEffect(() => {
    const fetchAll = async () => {
      const res = await challengeService.getAllChallenges();
      if (res.success && res.data?.challenges) {
        const sorted = [...res.data.challenges].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
        setChallengeList(sorted);
      }
    };
    fetchAll();
  }, []);

  // Challenge data loaded from backend
  const [challenge, setChallenge] = useState({ id: id || '1', title: 'Loading...', difficulty: 'Easy', description: '', examples: [], constraints: [], topics: [], hints: [], codeSnippets: {} });

  // Fetch challenge details when id changes
  useEffect(() => {
    const loadChallenge = async () => {
      const challengeId = id || '1';
      try {
        const res = await challengeService.getChallengeById(challengeId);
        if (res.success && res.data) {
          setChallenge(res.data);
          // Load default test cases if present (dynamic form fields)
          const d = Array.isArray(res.data.defaultTestCases) ? res.data.defaultTestCases : [];
          setTestCases(d);
          const values = {};
          d.forEach((c) => { values[c.id] = (c.fields || []).map((f) => ({ name: f.name, value: f.value })); });
          setTestCaseValues(values);
          if (d.length) setActiveTab(d[0].id);
          // If user hasn't edited code, prefer backend-provided starterCode/snippet for current language
          // Reset per-language code cache for this problem using backend-provided snippets
          const snippets = res.data.codeSnippets || {};
          const starter = res.data.starterCode || {};
          const py = (starter.python || snippets.python?.code) || GENERIC_TEMPLATES.python;
          const ja = (starter.java || snippets.java?.code) || GENERIC_TEMPLATES.java;
          setCodesByLang({ python: py, java: ja });
          // If user hasn't edited, apply current language snippet
          if (!userEdited) {
            const snippet = language === 'java' ? ja : py;
            if (snippet !== undefined) setCode(snippet);
          }
        } else {
          // fallback minimal
          setChallenge((c) => ({ ...c, id: challengeId, title: `Challenge ${challengeId}` }));
          setTestCases([]);
          setTestCaseValues({});
        }
      } catch (_) {
        setChallenge((c) => ({ ...c, id: challengeId, title: `Challenge ${challengeId}` }));
        setTestCases([]);
        setTestCaseValues({});
      }
    };
    setNextChallengeId(null);
    setHasSubmitted(false);
    setSubmissionResult(null);
    // Important: clear edit flag so the new problem can load its snippet/draft
    setUserEdited(false);
    setActiveTab('final');
    setRunResult(null);
    setOutput('');
    setLastRunCases([]);
    loadChallenge();
  }, [id]);

  // Keep editor code in sync when language changes outside of the dropdown handler
  useEffect(() => {
    const snippets = challenge.codeSnippets || {};
    const starter = challenge.starterCode || {};
    const py = (starter.python || snippets.python?.code) || GENERIC_TEMPLATES.python;
    const ja = (starter.java || snippets.java?.code) || GENERIC_TEMPLATES.java;
    const next = language === 'java' ? (codesByLang.java ?? ja) : (codesByLang.python ?? py);
    if (typeof next === 'string' && code !== next) {
      setCode(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, challenge.id, codesByLang]);

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running code...');
    try {
      const inputs = testCaseValues[activeTab] || [];
      const res = await challengeService.runCode({
        challengeId: challenge.id,
        code,
        language,
        inputs,
      });
      if (res.success) {
        // Clear any prior submission UI context to keep Run Output transient-only
        setSubmissionResult(null);
        setHasSubmitted(false);
        setNextChallengeId(null);
        const r = res.data || {};
        const caseArr = Array.isArray(r.caseResults) ? r.caseResults : (Array.isArray(r.details) ? r.details : []);
        // Normalize runResult so renderer always reads from details (array) and rawDetails (string)
        setRunResult({
          passed: r.passed,
          total: r.total,
          time: r.time,
          memory: r.memory,
          details: caseArr,
          rawDetails: r.rawDetails || (!caseArr.length ? (typeof r.details === 'string' ? r.details : '') : ''),
          verdict: r.verdict,
        });
        setLastRunCases(caseArr);
        // Build a simple text report for the legacy Raw panel
        const report = caseArr.length
          ? `Test Cases: ${r.passed}/${r.total}\n` + caseArr.map(c => `Case ${c.index}: ${c.verdict}\ninput: ${c.input || ''}\nexpected: ${c.expected || ''}\nactual: ${c.actual || ''}`).join('\n')
          : `Test Cases: ${r.passed}/${r.total}\nExecution Time: ${r.time}ms\nMemory Usage: ${r.memory}MB\n\n${r.rawDetails || (typeof r.details === 'string' ? r.details : '') || ''}`;
        setOutput(report);
        // Show results in Test Result tab
        setActiveTab('final');
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
    setUserEdited(false);
    const snippets = challenge.codeSnippets || {};
    const starter = challenge.starterCode || {};
    const py = (starter.python || snippets.python?.code) || GENERIC_TEMPLATES.python;
    const ja = (starter.java || snippets.java?.code) || GENERIC_TEMPLATES.java;
    const next = language === 'java' ? ja : py;
    setCode(next || '// Write your solution here');
    setCodesByLang((prev) => ({ ...prev, [language]: next }));
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

  const handleRestoreDraft = async () => {
    try {
      const res = await challengeService.getDraft(challenge.id);
      if (res.success && res.data) {
        if (res.data.language) setLanguage(res.data.language);
        if (typeof res.data.code === 'string') setCode(res.data.code);
      } else {
        alert('No saved draft found.');
      }
    } catch (e) {
      alert('Failed to retrieve draft.');
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
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowListModal(true)} className="flex items-center space-x-2 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100">
              <List className="h-4 w-4" />
              <span className="text-sm">Challenges List</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{challenge.title}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(challenge.difficulty)}`}>{challenge.difficulty}</span>
            {Array.isArray(challenge.topics) && challenge.topics.length > 0 && (
              <div className="flex items-center flex-wrap gap-1 ml-2">
                {challenge.topics.slice(0, 4).map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={language}
              onChange={(e) => {
                const lang = e.target.value;
                const snippets = challenge.codeSnippets || {};
                const starter = challenge.starterCode || {};
                const py = (starter.python || snippets.python?.code) || GENERIC_TEMPLATES.python;
                const ja = (starter.java || snippets.java?.code) || GENERIC_TEMPLATES.java;
                // Atomically cache current code and compute next from the updated cache
                setCodesByLang((prev) => {
                  const updated = { ...prev, [language]: code };
                  const next = lang === 'java' ? (updated.java ?? ja) : (updated.python ?? py);
                  setCode(next || '');
                  return updated;
                });
                setLanguage(lang);
              }}
              className="input-field h-9"
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <button onClick={handleSaveCode} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 flex items-center space-x-1">
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Description tabs */}
        <div className="bg-white border border-gray-200 rounded-md">
          <div className="border-b border-gray-200 px-4">
            <nav className="flex space-x-6">
              {['description','hints','editorial','solutions','submissions'].map((t) => (
                <button key={t} onClick={() => setLeftTab(t)} className={`py-3 text-sm font-medium border-b-2 -mb-px ${leftTab===t? 'border-primary-600 text-primary-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </nav>
          </div>
          <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {leftTab === 'description' && (
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                {(() => {
                  const raw = challenge.description || '';
                  const lines = raw.split('\n');
                  const out = [];
                  let skip = false;
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (/^\s*Example\s*\d+\s*:/.test(line) || /^\s*Constraints\s*:/.test(line)) continue;
                    if (!skip && /Custom\s+Judge\s*:?/i.test(line)) { skip = true; continue; }
                    if (skip) {
                      if (/^\s*$/.test(line)) { skip = false; }
                      continue;
                    }
                    // Drop judge-like code lines from description
                    if (/assert\s*\(/i.test(line) || /for\s*\(.*;.*;.*\)/i.test(line) || /expectedNums/i.test(line) || /sort\s*\(/i.test(line) || /remove(Element|Duplicates)/i.test(line)) continue;
                    out.push(line);
                  }
                  const cleaned = out.join('\n');
                  return <div className="text-gray-800 leading-relaxed whitespace-pre-line mb-6">{cleaned}</div>;
                })()}

                {Array.isArray(challenge.notes) && challenge.notes.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 mb-6">
                      {challenge.notes.map((n, i) => (<li key={i}><span className="whitespace-pre-line">{n}</span></li>))}
                    </ul>
                  </>
                )}

                <h3 className="text-lg font-semibold text-gray-900 mb-3">Examples</h3>
                {challenge.examples.map((example, index) => (
                  <div key={index} className="border border-gray-200 bg-white p-4 rounded-md mb-4 shadow-sm">
                    {/* Omitting 'Example N:' label as requested */}
                    {example.input && (
                      <>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Input</div>
                        <pre className="mt-1 mb-2 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-mono text-gray-800 whitespace-pre-wrap">{example.input}</pre>
                      </>
                    )}
                    {example.output && (
                      <>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Output</div>
                        <pre className="mt-1 mb-2 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-mono text-gray-800 whitespace-pre-wrap">{example.output}</pre>
                      </>
                    )}
                    {example.explanation && (
                      <>
                        <div className="text-xs uppercase tracking-wide text-gray-500">Explanation</div>
                        <div className="mt-1 text-gray-700 text-sm whitespace-pre-line">{example.explanation}</div>
                      </>
                    )}
                    {Array.isArray(example.images) && example.images.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {example.images.map((src, i) => (
                          <img key={i} src={src} alt={`example-${index + 1}-${i}`} className="w-full border border-gray-200 rounded" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Constraints */}
                {Array.isArray(challenge.constraints) && challenge.constraints.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Constraints</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {challenge.constraints.map((c, i) => (<li key={i}>{c}</li>))}
                    </ul>
                  </>
                )}

                {Array.isArray(challenge.followUps) && challenge.followUps.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">Follow-ups</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {challenge.followUps.map((f, i) => (<li key={i}>{f}</li>))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {leftTab === 'hints' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Hints</h3>
                {Array.isArray(challenge.hints) && challenge.hints.length ? (
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    {challenge.hints.map((h, i) => (<li key={i}>{h}</li>))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">No hints available for this problem.</div>
                )}
              </div>
            )}
            {leftTab === 'editorial' && (
              <div className="text-sm text-gray-500">Editorial coming soon.</div>
            )}
            {leftTab === 'solutions' && (
              <div className="text-sm text-gray-500">Community solutions coming soon.</div>
            )}
            {leftTab === 'submissions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Submissions</h3>
                {loadingSubs ? (
                  <div className="text-sm text-gray-500">Loading...</div>
                ) : submissions.length ? (
                  <div className="space-y-3">
                    {/* Latest submission summary with combined breakdown */}
                    <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">Latest Result</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${submissions[0].status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {submissions[0].verdict || (submissions[0].status === 'success' ? 'Accepted' : 'Rejected')}
                        </span>
                      </div>
                      {/* Combined Test Case Breakdown */}
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-700 mb-1">Test Case Summary</div>
                        <div className="space-y-1">
                          {lastRunCases && lastRunCases.length > 0 && (
                            <div className="space-y-1">
                              {lastRunCases.map((c) => (
                                <div key={c.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border border-gray-200 rounded">
                                  <span className="text-xs text-gray-700">Test Case {c.id}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border border-gray-200 rounded">
                            <span className="text-xs text-gray-700">Hidden Test Cases</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${submissions[0].status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {submissions[0].status === 'success' ? 'Passed' : 'Some Failed'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Official metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="text-xs text-gray-500">Score</div>
                          <div className="text-sm font-medium text-gray-900">{submissions[0].score ?? '-'}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="text-xs text-gray-500">Time</div>
                          <div className="text-sm font-medium text-gray-900">{submissions[0].timeMs ?? '-'} ms</div>
                        </div>
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="text-xs text-gray-500">Memory</div>
                          <div className="text-sm font-medium text-gray-900">{submissions[0].memoryMB ?? '-'} MB</div>
                        </div>
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="text-xs text-gray-500">Submitted</div>
                          <div className="text-sm font-medium text-gray-900">{new Date(submissions[0].submissionTime).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* History list */}
                    <div className="border border-gray-200 rounded-md">
                      <div className="px-4 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">History</div>
                      <div className="divide-y divide-gray-100">
                        {submissions.map((s) => (
                          <div key={s.id} className="px-4 py-2 flex items-center justify-between">
                            <div className="text-sm text-gray-700">
                              <span className="mr-2 font-mono text-xs text-gray-500">{new Date(s.submissionTime).toLocaleString()}</span>
                              <span className="mr-2">{s.language?.toUpperCase?.() || ''}</span>
                              <span className="mr-2">Score: {s.score ?? '-'}</span>
                              <span className="mr-2">Time: {s.timeMs ?? '-'} ms</span>
                              <span>Mem: {s.memoryMB ?? '-'} MB</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.verdict || (s.status === 'success' ? 'Accepted' : 'Rejected')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No submissions yet for this challenge.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor + Bottom panel */}
        <div className="flex flex-col space-y-4">
          <div className="bg-white border border-gray-200 rounded-md">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <button onClick={handleResetCode} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 flex items-center space-x-1">
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset</span>
                </button>
                <button onClick={handleRestoreDraft} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 flex items-center space-x-1">
                  <RotateCcw className="h-4 w-4" />
                  <span>Restore</span>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={handleRunCode} disabled={isRunning} className="btn-primary px-4 py-2 flex items-center space-x-2">
                  {isRunning ? (<><Clock className="h-4 w-4 animate-spin" /><span>Running...</span></>) : (<><Play className="h-4 w-4" /><span>Run</span></>)}
                </button>
                <button onClick={handleSubmitSolution} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center space-x-2">
                  <Play className="h-4 w-4" />
                  <span>Submit</span>
                </button>
              </div>
            </div>
            <div className="p-3">
              <CodeEditor
                key={`${id}-${language}`}
                value={code}
                onChange={(val) => { setUserEdited(true); setCode(val); setCodesByLang((prev) => ({ ...prev, [language]: val })); }}
                language={language}
                height="420px"
                theme="light"
              />
            </div>
          </div>

          {/* Bottom: Testcases / Result */}
          <div className="bg-white border border-gray-200 rounded-md">
            <div className="border-b border-gray-200 px-3">
              <nav className="flex space-x-6 items-center overflow-x-auto">
                {testCases.map((c) => (
                  <button key={c.id} onClick={() => setActiveTab(c.id)} className={`py-2 text-sm font-medium border-b-2 -mb-px ${activeTab===c.id? 'border-primary-600 text-primary-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{c.id.replace('case','Case ')}</button>
                ))}
                <button
                  onClick={() => (submissionResult || runResult) && setActiveTab('final')}
                  disabled={!(submissionResult || runResult)}
                  className={`ml-auto py-2 text-sm font-medium border-b-2 -mb-px ${activeTab==='final'? 'border-primary-600 text-primary-700':'border-transparent'} ${(submissionResult || runResult)? 'text-gray-700 hover:text-gray-900':'text-gray-400 cursor-not-allowed'}`}
                >
                  Run Output
                </button>
              </nav>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
              {(activeTab !== 'final') && testCases.find((c) => c.id === activeTab) && (
                <>
                  {(testCaseValues[activeTab] || []).map((f, idx) => (
                    <div key={idx}>
                      <label className="block mb-1 text-xs font-medium text-gray-600">{f.name} =</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                        value={String(f.value || '')}
                        onChange={(e) => {
                          setTestCaseValues((prev) => {
                            const next = { ...prev };
                            const arr = [...(next[activeTab] || [])];
                            arr[idx] = { ...arr[idx], value: e.target.value };
                            next[activeTab] = arr;
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
                  {((testCaseValues[activeTab] || []).length === 0) && (
                    <div className="text-xs text-gray-500">No default inputs provided for this problem.</div>
                  )}
                </>
              )}

              {/* Case tabs show inputs only. Run results are shown under Test Result tab. */}

              {/* Run Output tab content: show only transient run results */}
              {activeTab === 'final' && (runResult || submissionResult) ? (
                <div className="mt-1 border border-gray-200 rounded-md p-4 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">{submissionResult ? 'Final Submission' : 'Run Result'}</h4>
                    {runResult && (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${runResult.verdict === 'AC' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {runResult.verdict || 'N/A'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {runResult.passed}/{runResult.total} Passed
                        </span>
                      </div>
                    )}
                    {submissionResult && !runResult && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${submissionResult.verdict === 'AC' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {submissionResult.verdict || 'PENDING'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {runResult && (
                      <>
                        {Array.isArray(runResult.details) && runResult.details.length > 0 ? (
                          runResult.details.map((c, idx) => (
                            <div key={idx} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Case {c.index ?? idx + 1}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.verdict === 'AC' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.verdict || 'N/A'}</span>
                              </div>
                              {c.input && (
                                <div className="mt-1">
                                  <div className="text-[11px] text-gray-600">Input</div>
                                  <pre className="whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 text-[11px] text-gray-800">{String(c.input)}</pre>
                                </div>
                              )}
                              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <div className="text-gray-600">Output</div>
                                  <pre className="bg-white border border-gray-200 rounded p-2">{String(c.actual ?? '')}</pre>
                                </div>
                                <div>
                                  <div className="text-gray-600">Expected</div>
                                  <pre className="bg-white border border-gray-200 rounded p-2">{String(c.expected ?? '')}</pre>
                                </div>
                              </div>
                              {(c.stderr || c.compile) && (
                                <pre className="mt-1 whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 text-[11px] text-gray-800">{c.stderr ? `stderr:\n${c.stderr}\n` : ''}{c.compile ? `compile:\n${c.compile}` : ''}</pre>
                              )}
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="text-xs text-gray-700">Verdict: {runResult.verdict || 'N/A'}</div>
                            {(runResult.rawDetails || runResult.details) && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-gray-600 mb-1">Raw Details</div>
                                <pre className="whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-800">{runResult.rawDetails || runResult.details}</pre>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {submissionResult && submissionResult.caseResults && submissionResult.caseResults.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs font-medium text-gray-600">Hidden Test Cases</div>
                        {submissionResult.caseResults.map((cr, idx) => (
                          <div key={idx} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">Case {cr.index}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cr.verdict === 'AC' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{cr.verdict}</span>
                            </div>
                            {cr.verdict !== 'AC' && (cr.expected !== undefined || cr.actual !== undefined) && (
                              <div className="mt-1">
                                <div className="text-[11px] text-gray-600">Expected vs Actual</div>
                                <pre className="whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 text-[11px] text-gray-800">expected: {String(cr.expected ?? '')}\nactual: {String(cr.actual ?? '')}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Run to see case results, or Submit to view the final judgement here</div>
              )}
              {/* Next Challenge button intentionally omitted from Run Output */}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: challenge list */}
      {showListModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowListModal(false)} />
          <div className="absolute top-0 left-0 h-full w-full max-w-sm bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Challenges List</h3>
              <button onClick={() => setShowListModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 54px)' }}>
              {challengeList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (userEdited) {
                      const ok = window.confirm('You have unsaved changes in the editor. Switching problems will load default code for the new problem and clear run output. Continue?');
                      if (!ok) return;
                    }
                    setUserEdited(false);
                    setShowListModal(false);
                    navigate(`/challenge/${c.id}`);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 border-b border-gray-100`}
                >
                  <div className="text-left">
                    <div className="text-sm text-gray-900">{c.id}. {c.title}</div>
                    <div className="text-xs text-gray-500">{c.category}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(c.difficulty)}`}>{c.difficulty}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Challenge;
