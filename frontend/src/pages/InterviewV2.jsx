import { useEffect, useRef, useState } from 'react';
import { Play, Video, Mic, Clock } from 'lucide-react';
import interviewService from '../services/interviewService';

const InterviewV2 = () => {
  const [stage, setStage] = useState('welcome'); // welcome | hardware | active | completed
  const [consentGiven, setConsentGiven] = useState(false);
  const [checkingCam, setCheckingCam] = useState(false);
  const [checkingMic, setCheckingMic] = useState(false);
  const [camAllowed, setCamAllowed] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [mcqSelection, setMcqSelection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [videoRecording, setVideoRecording] = useState(false);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const questionStartRef = useRef(null);
  const overallStartRef = useRef(null);

  // Configurable options before starting the interview
  const [numQuestions, setNumQuestions] = useState(20); // user choice, clamped 20-25 on backend
  const [difficulty, setDifficulty] = useState('mixed'); // mixed | easy | medium | hard

  // Results / report after completion
  const [resultSummary, setResultSummary] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!activeQuestion) return;
    setTimeLeft(activeQuestion.timerSec || 60);
    questionStartRef.current = Date.now();
  }, [activeQuestion]);

  // Ensure the live preview keeps working when we move between stages
  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      try {
        // Attach the existing media stream to the current video element
        videoRef.current.srcObject = streamRef.current;
      } catch (_) {
        // no-op
      }
    }
  }, [stage]);

  useEffect(() => {
    if (!activeQuestion || stage !== 'active') return;
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft, activeQuestion, stage]);

  const stopMedia = () => {
    try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch (_) {}
    try { streamRef.current?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
    streamRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => () => stopMedia(), []);
  useEffect(() => {
    if (stage === 'completed') {
      stopMedia();
    }
  }, [stage]);

  const testHardware = async () => {
    setCheckingCam(true);
    setCheckingMic(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setCamAllowed(true);
      setMicAllowed(true);
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let rms = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            rms += v * v;
          }
          rms = Math.sqrt(rms / data.length);
          setMicLevel(Math.min(1, rms * 3));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (_) {}
    } catch (_) {
      setCamAllowed(false);
      setMicAllowed(false);
    } finally {
      setCheckingCam(false);
      setCheckingMic(false);
    }
  };

  const startSession = async () => {
    if (!consentGiven) return;
    if (!camAllowed || !micAllowed) return;
    const payload = {
      consent: { given: true, at: new Date().toISOString() },
      numQuestions,
    };
    if (difficulty && difficulty !== 'mixed') {
      payload.difficulty = difficulty;
    }
    const res = await interviewService.startInterviewV2(payload);
    if (!res.success) {
      alert(res.error || 'Failed to start interview');
      return;
    }
    setSession(res.data);
    setQuestions(res.data.questions || []);
    if (Array.isArray(res.data.questions) && res.data.questions.length) {
      setCurrentIdx(0);
      setActiveQuestion(res.data.questions[0]);
      setStage('active');
      // Start continuous recording for the whole interview session
      startOverallRecording();
    }
  };

  const handleNext = async () => {
    if (!session || !activeQuestion) return;
    setIsSubmitting(true);
    try {
      const now = Date.now();
      const timeTakenSec = questionStartRef.current ? Math.round((now - questionStartRef.current) / 1000) : 0;
      if (activeQuestion.type === 'MCQ') {
        if (!mcqSelection) {
          alert('Please select an option.');
          setIsSubmitting(false);
          return;
        }
        await interviewService.submitResponseV2(session.id, {
          questionId: activeQuestion.id,
          index: currentIdx,
          type: 'MCQ',
          mcqSelectedOption: mcqSelection,
          timeTakenSec,
        });
        setMcqSelection('');
      }
      // VIDEO submission handled on stopRecording
      const nextIdx = currentIdx + 1;
      if (nextIdx < questions.length) {
        setCurrentIdx(nextIdx);
        setActiveQuestion(questions[nextIdx]);
      } else {
        // Last question: stop continuous recording, upload once, then complete interview
        // eslint-disable-next-line no-console
        console.log('[InterviewV2] Last question reached, stopping overall recording & uploading...');
        await stopOverallRecordingAndUpload();
        const done = await interviewService.completeInterviewV2(session.id);
        if (done.success) {
          setResultSummary(done.data);
          // Try to fetch the richer report including anomaly info
          const rep = await interviewService.getInterviewReportV2(session.id);
          if (rep.success) {
            setReport(rep.data);
          }
          setStage('completed');
        } else {
          alert(done.error || 'Failed to complete interview');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startOverallRecording = () => {
    if (!streamRef.current) {
      alert('Camera/mic not ready');
      return;
    }
    try {
      recordedChunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.start();
      overallStartRef.current = Date.now();
      setVideoRecording(true);
    } catch (e) {
      console.error(e);
      alert('Failed to start recording');
    }
  };

  const stopOverallRecordingAndUpload = () => {
    if (!session) return Promise.resolve(null);
    setVideoRecording(false);

    const finishUpload = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('[InterviewV2] Preparing overall interview video upload, chunks:', recordedChunksRef.current.length);
        const blob = recordedChunksRef.current.length
          ? new Blob(recordedChunksRef.current, { type: 'video/webm' })
          : new Blob([], { type: 'video/webm' });
        const end = Date.now();
        const durationSec = overallStartRef.current
          ? Math.max(1, Math.round((end - overallStartRef.current) / 1000))
          : 0;
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        // eslint-disable-next-line no-console
        console.log('[InterviewV2] Sending /upload/interview-overall-video payload, durationSec:', durationSec);
        const up = await interviewService.uploadOverallInterviewVideoV2({
          interviewId: session.id,
          videoB64: b64,
          durationSec,
        });
        if (!up.success) {
          alert(up.error || 'Failed to upload overall interview video');
        }
        return up;
      } catch (e) {
        console.error(e);
        return null;
      }
    };

    const rec = recorderRef.current;
    if (!rec) {
      // Recorder never started; still trigger upload so backend anomaly pipeline runs.
      return finishUpload();
    }

    return new Promise((resolve) => {
      try {
        rec.stop();
      } catch (_) {
        finishUpload().then(resolve);
        return;
      }
      rec.onstop = async () => {
        const result = await finishUpload();
        resolve(result);
      };
    });
  };

  if (stage === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">Professional Proctored Interview</h1>
          <p className="text-sm text-gray-300 mb-4">
            This interview will record your camera, microphone, and screen activity for integrity checks including
            liveness, anomaly detection, and MCQ scoring. By continuing, you consent to this processing in
            accordance with our privacy policy.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <label className="block text-gray-200 mb-1">Number of questions</label>
              <select
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value) || 20)}
                className="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 px-3 py-2 text-sm"
              >
                <option value={20}>20 questions</option>
                <option value={25}>25 questions</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-200 mb-1">Difficulty level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 px-3 py-2 text-sm"
              >
                <option value="mixed">Mixed (easy/medium/hard)</option>
                <option value="easy">Easy only</option>
                <option value="medium">Medium only</option>
                <option value="hard">Hard only</option>
              </select>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-200 mb-6">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
            />
            <span>
              I understand and consent to the collection and processing of my audio/video and response data for the
              purpose of this assessment.
            </span>
          </label>
          <button
            disabled={!consentGiven}
            onClick={() => setStage('hardware')}
            className={`inline-flex items-center px-5 py-2.5 rounded-md text-sm font-medium ${
              consentGiven ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Play className="h-4 w-4 mr-2" /> Continue to camera & mic check
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'hardware') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-3xl w-full bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Camera & Mic Check</h2>
            <p className="text-sm text-gray-300 mb-4">
              Allow access to your camera and microphone. We will run a quick pre-check to ensure everything works
              before starting.
            </p>
            <div className="space-y-3 text-sm text-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Video className="h-4 w-4" /> Camera</div>
                <span>{camAllowed ? 'Detected' : 'Not detected'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Mic className="h-4 w-4" /> Microphone</div>
                <span>{micAllowed ? 'Detected' : 'Not detected'}</span>
              </div>
            </div>
            <button
              onClick={testHardware}
              disabled={checkingCam || checkingMic}
              className="mt-6 inline-flex items-center px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium"
            >
              Run hardware test
            </button>
            <button
              onClick={startSession}
              disabled={!camAllowed || !micAllowed}
              className={`mt-3 inline-flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                camAllowed && micAllowed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Start Interview
            </button>
          </div>
          <div>
            <div className="aspect-video w-full rounded-md overflow-hidden border border-gray-800 bg-gray-800">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-1">Mic level</div>
              <div className="h-1.5 bg-gray-800 rounded">
                <div className="h-1.5 rounded bg-emerald-500" style={{ width: `${Math.round(micLevel * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'active' && activeQuestion) {
    const isVideo = activeQuestion.type === 'VIDEO';
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">Time left: {timeLeft}s</span>
              </div>
              <span className="text-sm text-gray-600">
                Question {currentIdx + 1} / {questions.length}
              </span>
            </div>
            <div>
              {videoRecording ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-300">
                  <span className="h-2 w-2 rounded-full bg-red-600 mr-2 animate-pulse" />
                  Recording interview video
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                  Camera ready for proctoring
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {isVideo ? 'Video Response Question' : 'Multiple Choice Question'}
                </h2>
                <p className="text-gray-800 mb-4 whitespace-pre-line">{activeQuestion.text}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                {!isVideo ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Select your answer</h3>
                    <div className="space-y-2">
                      {(activeQuestion.options || []).map((opt, idx) => (
                        <label
                          key={idx}
                          className="flex items-center gap-3 text-sm text-gray-800 p-3 border rounded-md hover:bg-gray-50"
                        >
                          <input
                            type="radio"
                            name="mcq"
                            value={opt}
                            checked={mcqSelection === opt}
                            onChange={(e) => setMcqSelection(e.target.value)}
                          />
                          <span className="select-none">{opt}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="inline-flex items-center px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
                      >
                        {currentIdx < questions.length - 1 ? 'Next question' : 'Finish interview'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Record your answer</h3>
                    <p className="text-xs text-gray-600 mb-2">
                      When you are ready, start recording and speak clearly into the camera. Stop when you have
                      finished your response.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={videoRecording ? stopRecording : startRecording}
                        className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                          videoRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
                        }`}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        {videoRecording ? 'Stop recording' : 'Start recording'}
                      </button>
                      <span className="text-xs text-gray-600">
                        Recording status: {videoRecording ? 'Recording...' : 'Idle'}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="inline-flex items-center px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
                      >
                        {currentIdx < questions.length - 1 ? 'Next question' : 'Finish interview'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Live preview</h3>
                <div className="aspect-video w-full rounded-md overflow-hidden border border-gray-200 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">Mic level</div>
                  <div className="h-1.5 bg-gray-200 rounded">
                    <div
                      className="h-1.5 rounded bg-emerald-500"
                      style={{ width: `${Math.round(micLevel * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'completed') {
    const mcq = report?.mcq;
    const interview = report?.interview;
    const video = report?.video;
    const mcqScore = mcq?.score ?? resultSummary?.mcqScore ?? null;
    const mcqCorrect = mcq?.correct ?? resultSummary?.mcqCorrect ?? null;
    const mcqTotal = mcq?.total ?? resultSummary?.mcqTotal ?? null;
    const anomalyScore = video?.anomalyScore ?? interview?.videoAnomalyScore ?? null;
    const videoFlags = interview?.reportSummary?.videoAnomalyFlags || null;
    const mcqDetails = mcq?.details || [];
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-5xl w-full bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-4 text-center">Interview summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-2">MCQ performance</h3>
              {mcqScore != null ? (
                <>
                  <p className="text-3xl font-bold text-sky-400 mb-1">{mcqScore}%</p>
                  {mcqCorrect != null && mcqTotal != null && (
                    <p className="text-sm text-gray-300 mb-1">
                      {mcqCorrect} / {mcqTotal} questions correct
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">MCQ score will be available shortly.</p>
              )}
            </div>
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-2">Video anomaly overview</h3>
              {anomalyScore != null ? (
                <p className="text-sm text-gray-300 mb-1">Overall anomaly score: {Math.round(anomalyScore)}</p>
              ) : (
                <p className="text-sm text-gray-400 mb-1">Video anomaly analysis is processing in the background.</p>
              )}
              {interview?.reportSummary && (
                <p className="text-xs text-gray-400 mt-2 whitespace-pre-line">
                  {interview.reportSummary.audioVisualSummary || 'Detailed anomaly summary will appear here once ready.'}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 bg-gray-950 border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Question-by-question breakdown</h3>
            {mcqDetails.length === 0 ? (
              <p className="text-xs text-gray-400">Detailed MCQ breakdown is not available for this interview.</p>
            ) : (
              <div className="max-h-80 overflow-auto text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-gray-300">
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Question</th>
                      <th className="px-2 py-1 text-left">Your answer</th>
                      <th className="px-2 py-1 text-left">Correct answer</th>
                      <th className="px-2 py-1 text-left">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcqDetails.map((item, idx) => {
                      const isCorrect = item.correct;
                      return (
                        <tr key={item.questionId || idx} className="border-t border-gray-800 align-top">
                          <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-2 py-2 text-gray-100">
                            <div className="mb-1 whitespace-pre-line">{item.text}</div>
                            {item.explanation && (
                              <div className="text-[11px] text-gray-400">Explanation: {item.explanation}</div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-gray-200">
                            {item.selectedOption ?? <span className="text-gray-500">Not answered</span>}
                          </td>
                          <td className="px-2 py-2 text-gray-200">{item.correctOption ?? '-'}</td>
                          <td className="px-2 py-2">
                            <span
                              className={
                                isCorrect
                                  ? 'inline-flex px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300'
                                  : 'inline-flex px-2 py-0.5 rounded-full bg-rose-900/60 text-rose-300'
                              }
                            >
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            You can close this window. If anomaly analysis is still running, refresh the report later from the admin
            dashboard or reports section.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default InterviewV2;
