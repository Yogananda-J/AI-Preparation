import { useEffect, useRef, useState } from 'react';
import { Play, Clock, CheckCircle, AlertCircle, MessageSquare, Code, Video, Mic } from 'lucide-react';
import interviewService from '../services/interviewService';

/**
 * Mock Interview page component
 * Simulates AI-powered coding interviews with random questions
 */
const Interview = () => {
  const [interviewState, setInterviewState] = useState('setup'); // setup, active, section_gate, completed
  const [session, setSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(45 * 60); // 45 minutes in seconds
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const totalQuestions = session?.questionCount || 3;

  // Setup selections
  const ROLE_OPTIONS = ['Software Engineer','Data Scientist','Product Manager','DevOps Engineer','Frontend Developer','Backend Developer','Other'];
  const [role, setRole] = useState('');
  const [experience] = useState('Entry-Level');
  const [duration, setDuration] = useState(30);
  // Platform constraint: only MCQ then Behavioral
  const QUESTION_TYPES = ['MCQ','Behavioral'];
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeB64, setResumeB64] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(['MCQ','Behavioral']);
  const [questionCount, setQuestionCount] = useState(20);
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [camAllowed, setCamAllowed] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [checkingCam, setCheckingCam] = useState(false);
  const [checkingMic, setCheckingMic] = useState(false);

  // Media + ASR state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);
  const recognitionRef = useRef(null);
  const [transcript, setTranscript] = useState([]); // {t, text, final}
  const [metrics, setMetrics] = useState({ wpm: 0, fillers: 0, pauses: 0 });
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const videoTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const [mcqSelection, setMcqSelection] = useState('');
  const [phase, setPhase] = useState('mcq'); // mcq -> behavioral
  const [pendingQuestion, setPendingQuestion] = useState(null);

  const FILLERS = ['um', 'uh', 'like', 'you know', 'so', 'actually'];

  const renderWithFillerHighlight = (text) => {
    if (!text) return '';
    try {
      const parts = String(text).split(/(\s+)/);
      return parts.map((p, i) => {
        const w = p.trim().toLowerCase();
        const isFiller = FILLERS.includes(w);
        return (
          <span key={i} className={isFiller ? 'text-gray-400' : undefined}>{p}</span>
        );
      });
    } catch (_) {
      return text;
    }
  };

  useEffect(() => {
    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        const mics = devices.filter((d) => d.kind === 'audioinput');
        setCameras(cams);
        setMicrophones(mics);
        if (!cameraId && cams[0]) setCameraId(cams[0].deviceId);
        if (!micId && mics[0]) setMicId(mics[0].deviceId);
      } catch (_) {}
    };
    enumerate();
  }, [cameraId, micId]);

  const requestCamera = async () => {
    setCheckingCam(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamAllowed(true);
      try { s.getTracks().forEach(t=>t.stop()); } catch (_) {}
    } catch (_) {
      setCamAllowed(false);
    } finally {
      setCheckingCam(false);
    }
  };

  const requestMic = async () => {
    setCheckingMic(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicAllowed(true);
      try { s.getTracks().forEach(t=>t.stop()); } catch (_) {}
    } catch (_) {
      setMicAllowed(false);
    } finally {
      setCheckingMic(false);
    }
  };

  const testHardware = async () => {
    setCheckingCam(true);
    setCheckingMic(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCamAllowed(true);
      setMicAllowed(true);
      try { if (videoRef.current) videoRef.current.srcObject = s; } catch (_) {}
      // Setup analyser for mic level visualization
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        const source = ctx.createMediaStreamSource(s);
        source.connect(analyser);
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let rms = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; rms += v * v; }
          rms = Math.sqrt(rms / data.length);
          setMicLevel(Math.min(1, rms * 3));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (_) {}
      // Keep preview stream until Start Interview
      streamRef.current = s;
    } catch (_) {
      // ignore
    } finally {
      setCheckingCam(false);
      setCheckingMic(false);
    }
  };

  const onResumeChange = async (e) => {
    const f = e.target.files?.[0];
    setResumeFile(f || null);
    setResumeB64('');
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      // limit to ~2MB to keep request light
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      setResumeB64(b64);
    } catch (_) {}
  };

  const stopMedia = () => {
    try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch (_) {}
    try { if (recognitionRef.current) { recognitionRef.current.onresult = null; recognitionRef.current.stop?.(); recognitionRef.current = null; } } catch (_) {}
    try { if (recorderRef.current) { recorderRef.current.ondataavailable = null; recorderRef.current.stop?.(); recorderRef.current = null; } } catch (_) {}
    try { if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; } } catch (_) {}
    try { if (wsRef.current && wsRef.current.readyState <= 1) { wsRef.current.close(); } } catch (_) {}
    try { streamRef.current?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
    streamRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => () => stopMedia(), []);

  // Auto-suggest duration based on question count
  useEffect(() => {
    if (questionCount >= 30 && duration < 60) setDuration(60);
    else if (questionCount >= 20 && duration < 45) setDuration(45);
  }, [questionCount]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startInterview = async () => {
    setIsLoading(true);
    try {
      // Prepare media
      const constraints = {
        video: cameraId ? { deviceId: { exact: cameraId }, width: { ideal: 640 }, height: { ideal: 480 } } : true,
        audio: micId ? { deviceId: { exact: micId }, channelCount: 1, noiseSuppression: true, echoCancellation: true } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Mic level analyser
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser); analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let rms = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; rms += v * v; }
        rms = Math.sqrt(rms / data.length); setMicLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();

      // Start session
      // Stop any prior preview stream
      try { if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); } catch (_) {}
      const res = await interviewService.startInterview({
        type: 'mixed',
        difficulty: 'mixed',
        duration: Number(duration) || 30,
        topics: selectedTypes,
        role,
        experience,
        questionCount: Number(questionCount) || 20,
        resumeName: resumeFile?.name || '',
        resumeB64: resumeB64 || ''
      });
      if (res.success) {
        setSession(res.data);
        const firstQ = (res.data?.questions && res.data.questions[0]) || null;
        if (firstQ) {
          setCurrentQuestion(firstQ);
          setCurrentQuestionIndex(0);
          setInterviewState('active');
          setPhase(firstQ.type === 'mcq' ? 'mcq' : 'behavioral');
        } else {
          const nq = await interviewService.getNextQuestion(res.data.id);
          if (nq.success) {
            setCurrentQuestion(nq.data);
            setInterviewState('active');
            setPhase(nq.data?.type === 'mcq' ? 'mcq' : 'behavioral');
          }
        }
      }

      // WebSocket streaming
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
        const base = apiBase.replace(/\/(api)\/?$/, '');
        const wsUrl = base.replace(/^http/, 'ws') + '/api/interviews/stream?sessionId=' + encodeURIComponent(res.data.id);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'transcript') {
              setTranscript((prev) => [...prev.filter((x) => x.final), { t: msg.t || Date.now(), text: msg.text || '', final: !!msg.final }]);
            } else if (msg.type === 'metrics') {
              setMetrics((m) => ({
                wpm: Math.round(msg.wpm ?? m.wpm ?? 0),
                fillers: msg.fillers ?? m.fillers ?? 0,
                pauses: msg.pauses ?? m.pauses ?? 0,
                eyeContact: msg.eyeContact ?? m.eyeContact,
              }));
            } else if (msg.type === 'prompt' && msg.text) {
              setTranscript((prev) => [...prev, { t: Date.now(), text: '[Interviewer] ' + msg.text, final: true }]);
            }
          } catch (_) {}
        };
        ws.onerror = () => {};
        ws.onopen = () => {
          // Start audio recorder
          try {
            const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            recorderRef.current = rec;
            rec.ondataavailable = async (e) => {
              if (!e.data || e.data.size === 0) return;
              const buf = await e.data.arrayBuffer();
              const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
              try { ws.send(JSON.stringify({ type: 'audio', payload: b64, ts: Date.now() })); } catch (_) {}
            };
            try { rec.start(1000); } catch (_) { rec.start(); }
          } catch (_) {}

          // Start video keyframes ~1 FPS
          try {
            const canvas = canvasRef.current || document.createElement('canvas');
            canvasRef.current = canvas;
            videoTimerRef.current = setInterval(() => {
              const vid = videoRef.current;
              if (!vid || vid.readyState < 2) return;
              const w = vid.videoWidth || 640, h = vid.videoHeight || 480;
              canvas.width = w; canvas.height = h;
              const ctx2d = canvas.getContext('2d');
              ctx2d.drawImage(vid, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              const b64 = dataUrl.split(',')[1] || '';
              try { ws.send(JSON.stringify({ type: 'video', payload: b64, ts: Date.now() })); } catch (_) {}
            }, 1000);
          } catch (_) {}
        };
      } catch (_) {}

      // Local ASR fallback (dev only); production will use backend WS ASR
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
        recognitionRef.current = rec;
        let lastFinalAt = Date.now();
        rec.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) {
              const text = r[0].transcript.trim();
              setTranscript((prev) => [...prev, { t: Date.now(), text, final: true }]);
              // Metrics: fillers, wpm, pauses
              const words = text.split(/\s+/).filter(Boolean);
              const fillers = words.filter((w) => FILLERS.includes(w.toLowerCase())).length;
              const durationMin = Math.max(0.5 / 60, (Date.now() - (prevTimeRef.current || Date.now())) / 60000);
              const wpm = Math.round(words.length / durationMin);
              const pause = Date.now() - lastFinalAt > 2000 ? 1 : 0; // >2s
              lastFinalAt = Date.now();
              setMetrics((m) => ({ wpm, fillers: m.fillers + fillers, pauses: m.pauses + pause }));
              prevTimeRef.current = Date.now();
            } else {
              interim += r[0].transcript;
            }
          }
          if (interim) setTranscript((prev) => [...prev.filter((x) => x.final), { t: Date.now(), text: interim, final: false }]);
        };
        try { rec.start(); } catch (_) {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    let answerValue = '';
    try {
      const ta = document.getElementById('answer-input');
      if (ta) answerValue = ta.value || '';
    } catch (_) {}
    // If behavioral (no textarea), aggregate transcript as the spoken answer
    if (!(Array.isArray(currentQuestion?.options) && currentQuestion.options.length > 0)) {
      const finals = transcript.filter((s) => s && s.final).map((s) => s.text);
      if (finals.length) answerValue = finals.join(' ');
      else if (transcript.length) answerValue = transcript.map((s)=>s.text).join(' ');
    }
    if (!currentQuestion || !session) return;
    if (Array.isArray(currentQuestion?.options) && currentQuestion.options.length > 0 && !mcqSelection) {
      alert('Please select an option to proceed.');
      return;
    }
    setIsLoading(true);
    try {
      await interviewService.submitAnswer({
        sessionId: session.id,
        questionId: currentQuestion.id,
        answer: answerValue,
        mcqAnswer: currentQuestion?.options ? mcqSelection : undefined,
        code: undefined,
        timeSpent: 0,
      });

      const newAnswers = { ...answers, [currentQuestion.id]: answerValue };
      setAnswers(newAnswers);

      // Try to fetch next question
      const nq = await interviewService.getNextQuestion(session.id);
      if (nq.success && nq.data) {
        // If moving from MCQ block into Behavioral, show section gate
        if (phase === 'mcq' && (nq.data.type === 'behavioral')) {
          setPendingQuestion(nq.data);
          setInterviewState('section_gate');
          setPhase('behavioral');
          setTranscript([]);
          setMcqSelection('');
        } else {
          setCurrentQuestion(nq.data);
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setTranscript([]);
          setMcqSelection('');
        }
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
      stopMedia();
    }
  };

  // track elapsed for WPM baseline
  const prevTimeRef = useRef(Date.now());

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
      case 'mcq': return <CheckCircle className="h-5 w-5" />;
      case 'behavioral': return <MessageSquare className="h-5 w-5" />;
      default: return <MessageSquare className="h-5 w-5" />;
    }
  };

  if (interviewState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Configure Your AI Interview</h1>
            <p className="text-sm text-gray-400">MCQ and Behavioral Questions only. Choose your role, set experience, and run a quick hardware test.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-5">Start Mock Interview</h2>
                <div className="space-y-5">
                  {/* Role (Dropdown) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Job Title / Role</label>
                    <select
                      className="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 p-3 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      value={role}
                      onChange={(e)=>setRole(e.target.value)}
                    >
                      <option value="">Select a role</option>
                      {ROLE_OPTIONS.map((r)=> (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {role && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-600/20 text-sky-300 border border-sky-600 text-xs">Selected Role: {role}</div>
                    )}
                  </div>

                  {/* Experience - Entry-Level only */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Experience Level</label>
                    <div className="px-4 py-2 inline-flex rounded-md bg-gray-800 border border-gray-700 text-gray-200">Entry-Level</div>
                  </div>

                  {/* Resume Upload (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Upload Resume (Optional)</label>
                    <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={onResumeChange} className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-sky-600 file:text-white hover:file:bg-sky-500" />
                    {resumeFile && (
                      <div className="mt-1 text-xs text-gray-400">Selected: {resumeFile.name}</div>
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
                    <select className="w-48 rounded-md bg-gray-800 border border-gray-700 text-gray-100 p-3 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" value={duration} onChange={(e)=>setDuration(Number(e.target.value))}>
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins</option>
                    </select>
                  </div>

                  {/* Number of Questions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Number of Questions</label>
                    <select className="w-48 rounded-md bg-gray-800 border border-gray-700 text-gray-100 p-3 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" value={questionCount} onChange={(e)=>setQuestionCount(Number(e.target.value))}>
                      <option value={20}>20</option>
                      <option value={25}>25</option>
                      <option value={30}>30</option>
                    </select>
                  </div>

                  {/* Question types (checkboxes MCQ + Behavioral) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Question Types</label>
                    <div className="flex flex-col gap-2 p-3 rounded-md bg-gray-800 border border-gray-700 w-fit">
                      {QUESTION_TYPES.map((t)=> (
                        <label key={t} className="flex items-center gap-2 text-gray-200 text-sm">
                          <input type="checkbox" checked={selectedTypes.includes(t)} onChange={()=>{}} disabled />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Start */}
                  <div className="pt-2">
                    <button onClick={startInterview} disabled={!role || !camAllowed || !micAllowed} className={`w-full md:w-auto inline-flex items-center justify-center rounded-md px-6 py-3 font-medium ${(!role || !camAllowed || !micAllowed) ? 'bg-sky-700/40 text-sky-200 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white'} transition`}>
                      <Play className="mr-2 h-5 w-5" /> Start Interview
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hardware Panel */}
            <div>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-200 mb-4">Camera & Mic Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-300"><Video className="h-4 w-4" /><span>Camera</span></div>
                    <button onClick={requestCamera} disabled={checkingCam} className={`text-sm ${camAllowed ? 'text-emerald-400' : 'text-sky-400'}`}>{camAllowed ? 'Allowed ✓' : 'Allow Camera'}</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-300"><Mic className="h-4 w-4" /><span>Microphone</span></div>
                    <button onClick={requestMic} disabled={checkingMic} className={`text-sm ${micAllowed ? 'text-emerald-400' : 'text-sky-400'}`}>{micAllowed ? 'Allowed ✓' : 'Allow Microphone'}</button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="aspect-video w-full rounded-md overflow-hidden border border-gray-800 bg-gray-800">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-800 rounded">
                    <div className="h-1.5 rounded bg-emerald-500" style={{ width: `${Math.round(micLevel*100)}%` }} />
                  </div>
                </div>
                <div className="mt-4">
                  <button onClick={testHardware} className="w-full rounded-md bg-sky-700 text-white hover:bg-sky-600 px-4 py-2 text-sm font-medium shadow">Test Hardware (Pre-check)</button>
                </div>
              </div>
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
          <div className="bg-white rounded-lg shadow-md p-4 mb-6 sticky top-0 z-10">
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
                  Question {currentQuestionIndex + 1} / {totalQuestions}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getQuestionIcon(question.type)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty}
                </span>
                {role && (
                  <span className="ml-2 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border">{role}</span>
                )}
                { (question.section_type || (question.type === 'mcq' ? 'MCQ' : 'Behavioral')) && (
                  <span className="ml-2 px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-700 border border-sky-200">Section: {question.section_type || (question.type === 'mcq' ? 'MCQ' : 'Behavioral')}</span>
                )}
              </div>
            </div>
            {/* progress */}
            <div className="mt-3 h-2 w-full bg-gray-200 rounded">
              <div className="h-2 bg-sky-500 rounded" style={{ width: `${Math.min(100, Math.round(((currentQuestionIndex+1)/totalQuestions)*100))}%` }} />
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
                {Array.isArray(question?.options) && question.options.length > 0 ? (
                  <div className="space-y-3">
                    {question.options.map((opt, idx) => (
                      <label key={idx} className="flex items-center gap-3 text-sm text-gray-800 p-3 border rounded-md hover:bg-gray-50">
                        <input
                          type="radio"
                          name="mcq"
                          value={opt}
                          checked={mcqSelection === opt}
                          onChange={(e)=>setMcqSelection(e.target.value)}
                        />
                        <span className="select-none">{opt}</span>
                      </label>
                    ))}
                    <textarea id="answer-input" rows={1} className="hidden" />
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Speak your answer. Live transcript:</div>
                    <div className="h-40 overflow-auto border rounded p-2 bg-gray-50 text-sm">
                      {transcript.map((seg, idx) => (
                        <div key={idx} className={seg.final ? 'text-gray-900' : 'text-gray-500 italic'}>
                          {new Date(seg.t).toLocaleTimeString()} — {renderWithFillerHighlight(seg.text)}
                        </div>
                      ))}
                      {transcript.length === 0 && (
                        <div className="text-xs text-gray-500">Speak to see live transcript here.</div>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={submitAnswer}
                    className="btn-primary"
                  >
                    {currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'Finish Interview'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Capture / Metrics / Hints */}
            <div className="space-y-6">
              {streamRef.current ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🎥 Live Capture</h3>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded border" />
                  <div className="mt-3">
                    <div className="text-xs text-gray-600 mb-1">Mic Level</div>
                    <div className="h-2 bg-gray-200 rounded">
                      <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.round(micLevel*100)}%` }} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Live Metrics</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{metrics.wpm}</div>
                    <div className="text-xs text-gray-600">WPM</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{metrics.fillers}</div>
                    <div className="text-xs text-gray-600">Filler Words</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{metrics.pauses}</div>
                    <div className="text-xs text-gray-600">Long Pauses</div>
                  </div>
                </div>
              </div>

              {/* Transcript moved into Your Answer card */}

              {/* Removed Hints and sidebar progress to declutter */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (interviewState === 'section_gate') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Behavioral Section</h2>
            <p className="text-gray-600 mb-6">MCQ section completed. Continue to Behavioral questions focused on communication and delivery.</p>
            <button
              className="btn-primary"
              onClick={() => {
                if (pendingQuestion) {
                  setCurrentQuestion(pendingQuestion);
                  setPendingQuestion(null);
                  setInterviewState('active');
                  setTranscript([]);
                }
              }}
            >
              Begin Behavioral
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (interviewState === 'completed') {
    const points = feedback?.total_points ?? 0;
    const maxPts = feedback?.max_points ?? 0;
    const perQ = feedback?.per_question || [];
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
                <div className="text-3xl font-bold text-green-600 mb-2">{points}/{maxPts} Points</div>
                <div className="text-gray-600">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">38m</div>
                <div className="text-gray-600">Time Taken</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">{Math.round(((points||0)/(maxPts||1))*100)}%</div>
                <div className="text-gray-600">Percent Equivalent</div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">AI Feedback</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 whitespace-pre-line">
                  {(feedback?.feedback || []).join('\n') || 'Detailed AI feedback will appear here.'}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Detailed Breakdown</h3>
                <div className="space-y-3">
                  {perQ.map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getQuestionIcon(q.type)}
                        <span className="font-medium text-gray-900 capitalize">
                          {q.type} Question {idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-green-600 font-medium">
                          {q.points}/{q.max_points} Points
                        </span>
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
