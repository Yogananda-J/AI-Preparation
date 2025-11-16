from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import base64
import time
import json
import random
import cv2
import numpy as np
try:
    # When running as a package: uvicorn ml_service.main:app
    from .questions import pick_questions
except Exception:
    # When running from the folder directly: uvicorn main:app
    from questions import pick_questions

app = FastAPI(title="AI Prep ML Service", version="0.1.0")

# In-memory session store
SESSIONS: Dict[str, Dict[str, Any]] = {}

class ASRRequest(BaseModel):
    audio_b64: str
    sample_rate: Optional[int] = 16000

class ASRResponse(BaseModel):
    text: str
    final: bool = False
    wpm: Optional[float] = None
    fillers: Optional[int] = None
    pauses: Optional[int] = None

class FERRequest(BaseModel):
    image_b64: str

class FERResponse(BaseModel):
    eye_contact: Optional[float] = None
    emotions: Optional[dict] = None


class VideoAnomalyRequest(BaseModel):
    """Request model for video anomaly analysis.

    For now we only need identifiers and a path to the stored video file.
    The current implementation ignores the content and returns stubbed values
    so the rest of the pipeline can be validated.
    """

    interview_id: str
    question_id: str
    video_path: str


class VideoAnomalyFlags(BaseModel):
    multiFace: bool = False
    deepfakeRisk: bool = False
    livenessIssues: bool = False
    lowQuality: bool = False
    lipSyncIssues: bool = False


class VideoAnomalyResponse(BaseModel):
    anomalyScore: float
    flags: VideoAnomalyFlags
    summary: str = ""

@app.get("/health")
def health():
    return {"status": "ok"}


# ----- Interview session models -----
class StartInterviewRequest(BaseModel):
    session_id: str
    role: str
    duration: int
    topics: List[str]
    experience: str
    resumeName: Optional[str] = ""
    resumeB64: Optional[str] = ""
    num_questions: Optional[int] = 3

class StartInterviewResponse(BaseModel):
    session_id: str
    question: Dict[str, Any]
    question_count: int
    section_type: Optional[str] = None

class NextQuestionRequest(BaseModel):
    session_id: str
    answer_text: Optional[str] = None
    mcq_answer: Optional[str] = None

class NextQuestionResponse(BaseModel):
    done: bool
    question: Optional[Dict[str, Any]] = None
    section_type: Optional[str] = None

class FinishInterviewRequest(BaseModel):
    session_id: str

class FinishInterviewResponse(BaseModel):
    overall: float
    correct_mcq: int
    total_mcq: int
    breakdown: Dict[str, Any]
    feedback: List[str]
    total_points: float
    max_points: float
    per_question: List[Dict[str, Any]]
    strengths: List[str] = []
    improvements: List[str] = []


def _eval_answer(q: Dict[str, Any], answer_text: Optional[str], mcq_answer: Optional[str]) -> Dict[str, Any]:
    t = (q.get("type") or "").lower()
    score = 0.0
    detail = {}
    if t == "mcq":
        correct = (mcq_answer or "").strip() == (q.get("answer") or "").strip()
        score = 1.0 if correct else 0.0
        detail = {"correct": correct}
    else:
        gold = (q.get("solution") or "").lower()
        text = (answer_text or "").lower()
        # crude semantic proxy: keyword overlap ratio
        tokens = [w for w in gold.replace(',', ' ').split() if len(w) > 2]
        hit = sum(1 for w in tokens if w in text)
        ratio = hit / max(1, len(tokens))
        score = min(1.0, ratio + (0.1 if len(text) > 50 else 0.0))
        detail = {"overlap": hit, "total": len(tokens)}
    return {"score": score, "detail": detail}


@app.post("/start_interview", response_model=StartInterviewResponse)
def start_interview(req: StartInterviewRequest):
    qs = pick_questions(req.role, req.topics, req.num_questions or 3)
    SESSIONS[req.session_id] = {
        "meta": req.model_dump(),
        "questions": qs,
        "idx": 0,
        "answers": [],
        # session-level aggregates (legacy)
        "metrics": {"words": 0, "fillers": 0, "pauses": 0, "eye": []},
        # per-question delivery metrics collected during WS
        "collected_metrics": [],
        # store computed per-question scores
        "question_history": [],
        "started": time.time(),
        # Prompt to be sent over WS at the start of each question
        "pending_prompt": f"Good evening. Welcome to your AI mock interview for the {req.role} position. We'll begin with a {qs[0].get('type','Question')} question. Please tell me a bit about yourself." if qs else None,
    }
    first = qs[0] if qs else {}
    sec = (first.get("type") or "").lower()
    sec = "MCQ" if sec == "mcq" else ("Behavioral" if sec in ("behavioral","star") else None)
    return StartInterviewResponse(session_id=req.session_id, question=first, question_count=len(qs), section_type=sec)


@app.post("/next_question", response_model=NextQuestionResponse)
def next_question(req: NextQuestionRequest):
    s = SESSIONS.get(req.session_id)
    if not s:
        return NextQuestionResponse(done=True, question=None, section_type=None)
    idx = s["idx"]
    qs = s["questions"]
    if idx >= len(qs):
        return NextQuestionResponse(done=True, question=None)
    # evaluate current
    q = qs[idx]
    evalr = _eval_answer(q, req.answer_text, req.mcq_answer)
    # Compute delivery score for this question from collected_metrics
    qid = q.get("id")
    q_metrics = next((m for m in s.get("collected_metrics", []) if m.get("question_id") == qid), None)
    delivery_score = 0.0
    if q_metrics:
        # Normalize components to 0..1
        wpm_vals = q_metrics.get("wpm_data", [])
        avg_wpm = sum(wpm_vals)/len(wpm_vals) if wpm_vals else 0
        # Ideal WPM band 110..160 -> map to 1; taper outside
        if avg_wpm <= 60:
            wpm_norm = 0.2
        elif avg_wpm >= 200:
            wpm_norm = 0.2
        else:
            # peak at 135, linear falloff to 60/200
            center = 135
            span = 75  # 135-60 / 200-135
            wpm_norm = max(0.2, 1 - abs(avg_wpm - center)/span)
        fillers = q_metrics.get("filler_word_count", 0)
        fillers_norm = max(0.0, 1 - min(1.0, fillers/10.0))  # 0 fillers ->1, 10+ ->0
        eye_pct = q_metrics.get("eye_contact_duration", 0) / 100.0  # 0..1
        engage = q_metrics.get("facial_engagement_score", 0.5)  # already 0..1
        # Weighted delivery: WPM 30%, Filler 30%, Eye 25%, Engagement 15%
        delivery_score = 0.3*wpm_norm + 0.3*fillers_norm + 0.25*eye_pct + 0.15*engage

    text_score = evalr["score"] if (q.get("type") or "").lower() != "mcq" else None

    s["answers"].append({
        "q_id": q.get("id"),
        "type": q.get("type"),
        "answer_text": req.answer_text,
        "text_score": text_score,
        "delivery_score": delivery_score,
        "mcq_answer": (req.mcq_answer or None),
        "correct_answer": (q.get("answer") if (q.get("type") or "").lower()=="mcq" else None),
        "question_text": q.get("question") or q.get("content") or q.get("text") or "",
    })
    s["question_history"].append({
        "q_id": q.get("id"),
        "type": q.get("type"),
        "text_score": text_score,
        "delivery_score": delivery_score,
    })
    s["idx"] = idx + 1
    if s["idx"] >= len(qs):
        return NextQuestionResponse(done=True, question=None, section_type=None)
    # Set professional prompt for next question and let WS emit it
    nxt = qs[s["idx"]]
    role = (s.get("meta", {}).get("role") or s.get("meta", {}).get("Role") or "")
    s["pending_prompt"] = f"We'll proceed with a {nxt.get('type','Question')} question."
    sec2 = (nxt.get("type") or "").lower()
    sec2 = "MCQ" if sec2 == "mcq" else ("Behavioral" if sec2 in ("behavioral","star") else None)
    return NextQuestionResponse(done=False, question=nxt, section_type=sec2)


@app.post("/finish_interview", response_model=FinishInterviewResponse)
def finish_interview(req: FinishInterviewRequest):
    s = SESSIONS.get(req.session_id)
    if not s:
        return FinishInterviewResponse(overall=0, correct_mcq=0, total_mcq=0, breakdown={}, feedback=["Session not found"]) 
    ans = s.get("answers", [])
    mcq_total = sum(1 for a in ans if (a.get("type") or "").lower() == "mcq")
    mcq_correct = sum(1 for a in ans if (a.get("type") or "").lower() == "mcq" and a.get("score", 0) >= 0.99)

    # Point-based scoring
    per_q: List[Dict[str, Any]] = []
    total_points = 0.0
    max_points = 0.0
    behav_points_total = 0.0
    behav_count = 0
    tech_scores: List[float] = []
    for a in ans:
        t = (a.get("type") or "").lower()
        if t == "mcq":
            pts = 1.0 if (a.get("score", 0) >= 0.99) else 0.0
            per_q.append({
                "q_id": a.get("q_id"),
                "type": "mcq",
                "points": pts,
                "max_points": 1.0,
                "question": a.get("question_text") or "",
                "correct": bool(a.get("score", 0) >= 0.99),
                "chosen": a.get("mcq_answer"),
                "answer": a.get("correct_answer"),
            })
            total_points += pts
            max_points += 1.0
        elif t in ("behavioral", "star"):
            ts = a.get("text_score", 0.0) or 0.0  # 0..1
            ds = a.get("delivery_score", 0.0) or 0.0  # 0..1
            combined = 0.7*ts + 0.3*ds  # 0..1
            pts = round(combined * 5.0, 2)
            per_q.append({
                "q_id": a.get("q_id"),
                "type": "behavioral",
                "points": pts,
                "max_points": 5.0,
                "text_score": round(ts,2),
                "delivery_score": round(ds,2),
                "question": a.get("question_text") or "",
            })
            total_points += pts
            max_points += 5.0
            behav_points_total += combined
            behav_count += 1
        else:
            tech_scores.append(a.get("score", 0.0) or 0.0)

    # Back-compat overall percentage (not displayed by FE but kept)
    behav_avg = (behav_points_total/behav_count) if behav_count else 0.0
    tech_avg = sum(tech_scores)/len(tech_scores) if tech_scores else 0.0
    mcq_acc = (mcq_correct / max(1, mcq_total))
    total_q = len(ans) or 1
    overall = round(100*((behav_count/total_q)*behav_avg + (len(tech_scores)/total_q)*tech_avg + (mcq_total/total_q)*mcq_acc), 1)
    # Narrative feedback
    dm = {
        "avg_wpm": _aggregate_avg_wpm(s.get("collected_metrics", [])),
        "total_fillers": sum(m.get("filler_word_count", 0) for m in s.get("collected_metrics", [])),
        "avg_eye_contact": _aggregate_avg_eye(s.get("collected_metrics", [])),
        "facial_engagement": _aggregate_avg_engage(s.get("collected_metrics", [])),
    }
    fb = []
    if mcq_total:
        fb.append(f"MCQ: {mcq_correct}/{mcq_total} correct.")
    if behav_count:
        fb.append("Behavioral: content (70%) and delivery (30%) combined for scoring.")
    # Delivery summary sentence
    try:
        pace_label = "Excellent" if dm["avg_wpm"] >= 130 else ("Good" if dm["avg_wpm"] >= 100 else "Moderate")
        fb.append(f"Speaking pace {pace_label} (~{int(dm['avg_wpm'] or 0)} WPM). Filler words: {int(dm['total_fillers'] or 0)}. Avg eye contact: {int((dm['avg_eye_contact'] or 0)*100)}%.")
    except Exception:
        pass
    # Build strengths/improvements from metrics and question history
    strengths: List[str] = []
    improvements: List[str] = []
    try:
        if dm["avg_wpm"] >= 130:
            strengths.append("Excellent speaking pace indicating confidence (>=130 WPM).")
        elif dm["avg_wpm"] >= 100:
            strengths.append("Good speaking pace (~100–129 WPM).")
        else:
            improvements.append("Increase speaking pace to improve confidence and engagement.")
        if (dm["total_fillers"] or 0) <= 5:
            strengths.append("Low filler usage helped clarity.")
        elif (dm["total_fillers"] or 0) > 10:
            improvements.append(f"Reduce filler words (Total: {int(dm['total_fillers'])}). Practice brief pauses instead of fillers.")
        if (dm["avg_eye_contact"] or 0) >= 0.7:
            strengths.append("Strong eye contact maintained (>=70%).")
        elif (dm["avg_eye_contact"] or 0) < 0.5:
            improvements.append("Improve eye contact toward camera to convey confidence (<50% detected).")
        if mcq_total:
            acc = mcq_correct / max(1, mcq_total)
            if acc >= 0.8:
                strengths.append(f"High MCQ accuracy ({mcq_correct}/{mcq_total}).")
            elif acc < 0.6:
                improvements.append(f"Reinforce core concepts to improve MCQ accuracy ({mcq_correct}/{mcq_total}).")
        # Behavioral per-question insights
        if behav_count:
            # find weakest behavioral
            bh = [a for a in ans if (a.get("type") or '').lower() in ("behavioral","star")]
            if bh:
                with_scores = [
                    (b.get("q_id"), 0.7*(b.get("text_score") or 0.0)+0.3*(b.get("delivery_score") or 0.0))
                    for b in bh
                ]
                worst = min(with_scores, key=lambda x: x[1])
                if worst and worst[1] < 0.6:
                    improvements.append(f"Behavioral Q {worst[0]}: content/delivery could be deeper (combined < 0.6).")
    except Exception:
        pass

    breakdown = {
        "mcq_accuracy": round(mcq_acc * 100, 1),
        "behavioral": round(behav_avg * 100, 1),
        "technical": round(tech_avg * 100, 1),
        "delivery_metrics": {
            # Delivery summary across questions
            "avg_wpm": _aggregate_avg_wpm(s.get("collected_metrics", [])),
            "total_fillers": sum(m.get("filler_word_count", 0) for m in s.get("collected_metrics", [])),
            "avg_eye_contact": _aggregate_avg_eye(s.get("collected_metrics", [])),
            "facial_engagement": _aggregate_avg_engage(s.get("collected_metrics", [])),
        },
    }
    return FinishInterviewResponse(
        overall=overall,
        correct_mcq=mcq_correct,
        total_mcq=mcq_total,
        breakdown=breakdown,
        feedback=fb,
        total_points=round(total_points,2),
        max_points=round(max_points,2),
        per_question=per_q,
        strengths=strengths,
        improvements=improvements,
    )


@app.post("/video_anomaly", response_model=VideoAnomalyResponse)
def video_anomaly(req: VideoAnomalyRequest):
    """Lightweight OpenCV-based video anomaly endpoint for InterviewV2.

    This version runs real but inexpensive analysis on the uploaded
    video file. It detects faces, estimates motion for liveness, and
    checks basic video quality (brightness/blur). Deepfake and lip-sync
    flags remain stubbed for now.
    """

    video_path = req.video_path
    path = Path(video_path)
    if not path.exists():
        flags = VideoAnomalyFlags(lowQuality=True, livenessIssues=True)
        return VideoAnomalyResponse(
            anomalyScore=100.0,
            flags=flags,
            summary="Video file not found on server; treating as invalid/low-quality recording.",
        )

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        flags = VideoAnomalyFlags(lowQuality=True, livenessIssues=True)
        return VideoAnomalyResponse(
            anomalyScore=100.0,
            flags=flags,
            summary="Unable to open video file for analysis.",
        )

    # Load a simple Haar cascade for face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    frame_idx = 0
    sample_stride = 10  # analyse every 10th frame
    face_counts: List[int] = []
    motion_scores: List[float] = []
    brightness_vals: List[float] = []
    blur_vals: List[float] = []
    prev_gray = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1
        if frame_idx % sample_stride != 0:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Face detection
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
        )
        face_counts.append(len(faces))

        # Simple motion estimate for liveness (frame-to-frame difference)
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            motion = float(np.mean(diff))
            motion_scores.append(motion)
        prev_gray = gray

        # Brightness and blur
        brightness = float(np.mean(gray))
        blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness_vals.append(brightness)
        blur_vals.append(blur)

    cap.release()

    if not face_counts:
        flags = VideoAnomalyFlags(livenessIssues=True, lowQuality=True)
        return VideoAnomalyResponse(
            anomalyScore=80.0,
            flags=flags,
            summary="No reliable face detections in the recording; candidate may be off-camera or camera quality is too low.",
        )

    avg_faces = float(np.mean(face_counts))
    max_faces = int(max(face_counts))
    avg_motion = float(np.mean(motion_scores)) if motion_scores else 0.0
    avg_brightness = float(np.mean(brightness_vals)) if brightness_vals else 0.0
    avg_blur = float(np.mean(blur_vals)) if blur_vals else 0.0

    # Heuristic flags (tune thresholds with real data)
    multi_face = max_faces >= 2
    liveness_issues = avg_motion < 5.0
    low_quality = (avg_brightness < 40.0) or (avg_blur < 20.0)

    flags = VideoAnomalyFlags(
        multiFace=multi_face,
        deepfakeRisk=False,  # real deepfake detection requires heavier models
        livenessIssues=liveness_issues,
        lowQuality=low_quality,
        lipSyncIssues=False,
    )

    # Build anomaly score from heuristics
    score = 0.0
    if multi_face:
        score += 40
    if liveness_issues:
        score += 30
    if low_quality:
        score += 20
    score = min(100.0, score)

    problems = []
    if multi_face:
        problems.append("multiple faces detected (possible collaboration)")
    if liveness_issues:
        problems.append("low liveness / limited natural movement")
    if low_quality:
        problems.append("low video quality (blur/lighting issues)")

    if not problems:
        summary = (
            "No significant anomalies detected. Single face detected consistently with natural movement "
            "and acceptable video quality."
        )
    else:
        summary = "Anomaly indicators: " + "; ".join(problems) + "."

    return VideoAnomalyResponse(anomalyScore=score, flags=flags, summary=summary)

@app.post("/asr", response_model=ASRResponse)
def asr(req: ASRRequest):
    try:
        _ = base64.b64decode(req.audio_b64)
    except Exception:
        pass
    # TODO: integrate faster-whisper + VAD; return partial/final text and metrics
    return ASRResponse(text="...", final=False, wpm=140.0, fillers=0, pauses=0)

@app.post("/fer", response_model=FERResponse)
def fer(req: FERRequest):
    try:
        _ = base64.b64decode(req.image_b64)
    except Exception:
        pass
    # TODO: integrate ONNX FER + gaze/landmarks for eye contact
    return FERResponse(eye_contact=75.0, emotions={"neutral": 0.7, "happy": 0.2, "surprise": 0.1})


# ----- WebSocket for live updates -----
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    params = dict(ws.query_params) if ws.query_params else {}
    session_id = params.get("session_id") or params.get("sessionId") or "unknown"
    if session_id not in SESSIONS:
        # create minimal session if client connected first
        SESSIONS[session_id] = {"meta": {}, "questions": [], "idx": 0, "answers": [], "metrics": {"words": 0, "fillers": 0, "pauses": 0, "eye": []}, "collected_metrics": [], "question_history": [], "started": time.time()}
    try:
        # Emit any pending professional prompt immediately on connect
        pending = SESSIONS[session_id].get("pending_prompt")
        if pending:
            await ws.send_json({"type": "prompt", "text": pending})
            SESSIONS[session_id]["pending_prompt"] = None
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                msg = {"type": "unknown"}
            now = int(time.time() * 1000)
            if msg.get("type") == "audio":
                # mock transcript + metrics
                elapsed_min = max(0.5 / 60, (time.time() - SESSIONS[session_id]["started"]) / 60)
                wpm = min(180, max(80, int(120 / max(0.1, elapsed_min))))
                SESSIONS[session_id]["metrics"]["words"] += int(wpm / 2)
                SESSIONS[session_id]["metrics"]["fillers"] += 0
                SESSIONS[session_id]["metrics"]["pauses"] += 0
                # Attach per-question metric sample
                qlist = SESSIONS[session_id].get("questions", [])
                qidx = SESSIONS[session_id].get("idx", 0)
                qid = qlist[qidx].get("id") if qidx < len(qlist) else None
                if qid is not None:
                    ent = next((m for m in SESSIONS[session_id]["collected_metrics"] if m.get("question_id") == qid), None)
                    if not ent:
                        ent = {"question_id": qid, "wpm_data": [], "filler_word_count": 0, "eye_contact_duration": 0.0, "facial_engagement_score": 0.5, "_eye_samples": []}
                        SESSIONS[session_id]["collected_metrics"].append(ent)
                    ent["wpm_data"].append(wpm)
                    # mock: no filler increment here; real ASR should parse fillers
                await ws.send_json({"type": "transcript", "text": "...", "final": False, "t": now})
                await ws.send_json({"type": "metrics", "wpm": wpm, "fillers": SESSIONS[session_id]["metrics"]["fillers"], "pauses": SESSIONS[session_id]["metrics"]["pauses"]})
            elif msg.get("type") == "video":
                # occasional eye contact sample
                eye = 70
                SESSIONS[session_id]["metrics"]["eye"].append(eye)
                # per-question eye accumulation
                qlist = SESSIONS[session_id].get("questions", [])
                qidx = SESSIONS[session_id].get("idx", 0)
                qid = qlist[qidx].get("id") if qidx < len(qlist) else None
                if qid is not None:
                    ent = next((m for m in SESSIONS[session_id]["collected_metrics"] if m.get("question_id") == qid), None)
                    if not ent:
                        ent = {"question_id": qid, "wpm_data": [], "filler_word_count": 0, "eye_contact_duration": 0.0, "facial_engagement_score": 0.5, "_eye_samples": []}
                        SESSIONS[session_id]["collected_metrics"].append(ent)
                    ent.setdefault("_eye_samples", []).append(eye)
                    # update derived fields
                    samples = ent.get("_eye_samples", [])
                    ent["eye_contact_duration"] = sum(samples)/len(samples) if samples else 0.0
                    ent["facial_engagement_score"] = max(0.0, min(1.0, ent["eye_contact_duration"]/100.0))
                await ws.send_json({"type": "metrics", "eyeContact": eye})
            elif msg.get("type") == "metrics":
                # Generic metrics push from client (e.g., ASR/FER pipeline)
                # Supported fields: wpm, filler_increment, pauses_increment, eye_contact, engagement
                qlist = SESSIONS[session_id].get("questions", [])
                qidx = SESSIONS[session_id].get("idx", 0)
                qid = qlist[qidx].get("id") if qidx < len(qlist) else None
                ent = None
                if qid is not None:
                    ent = next((m for m in SESSIONS[session_id]["collected_metrics"] if m.get("question_id") == qid), None)
                    if not ent:
                        ent = {"question_id": qid, "wpm_data": [], "filler_word_count": 0, "eye_contact_duration": 0.0, "facial_engagement_score": 0.5, "_eye_samples": []}
                        SESSIONS[session_id]["collected_metrics"].append(ent)
                # Update aggregates
                wpm = msg.get("wpm")
                if isinstance(wpm, (int, float)) and ent is not None:
                    ent.setdefault("wpm_data", []).append(int(wpm))
                fill_inc = msg.get("filler_increment") or msg.get("fillers_increment") or 0
                if isinstance(fill_inc, (int, float)):
                    SESSIONS[session_id]["metrics"]["fillers"] += int(fill_inc)
                    if ent is not None:
                        ent["filler_word_count"] = int(ent.get("filler_word_count", 0)) + int(fill_inc)
                pause_inc = msg.get("pauses_increment") or 0
                if isinstance(pause_inc, (int, float)):
                    SESSIONS[session_id]["metrics"]["pauses"] += int(pause_inc)
                eye_contact = msg.get("eye_contact")
                if isinstance(eye_contact, (int, float)) and ent is not None:
                    ent.setdefault("_eye_samples", []).append(float(eye_contact))
                    samples = ent.get("_eye_samples", [])
                    ent["eye_contact_duration"] = sum(samples)/len(samples) if samples else 0.0
                engagement = msg.get("engagement")
                if isinstance(engagement, (int, float)) and ent is not None:
                    ent["facial_engagement_score"] = max(0.0, min(1.0, float(engagement)))
                # Echo compact summary
                await ws.send_json({
                    "type": "metrics",
                    "wpm": (wpm if isinstance(wpm,(int,float)) else None),
                    "fillers": SESSIONS[session_id]["metrics"]["fillers"],
                    "pauses": SESSIONS[session_id]["metrics"]["pauses"],
                    "eyeContact": eye_contact if isinstance(eye_contact,(int,float)) else None,
                    "engagement": engagement if isinstance(engagement,(int,float)) else None,
                })
                # If there is a pending prompt (e.g., after next_question), emit it once
                pend = SESSIONS[session_id].get("pending_prompt")
                if pend:
                    await ws.send_json({"type": "prompt", "text": pend})
                    SESSIONS[session_id]["pending_prompt"] = None
            else:
                await ws.send_json({"type": "info", "ok": True})
    except WebSocketDisconnect:
        return


# ---- Aggregation helpers ----
def _aggregate_avg_wpm(collected: List[Dict[str, Any]]) -> float:
    vals: List[float] = []
    for m in collected:
        vals.extend(m.get("wpm_data", []) or [])
    return round(sum(vals)/len(vals), 1) if vals else 0.0


def _aggregate_avg_eye(collected: List[Dict[str, Any]]) -> float:
    vals = [m.get("eye_contact_duration", 0.0) for m in collected if m]
    return round(sum(vals)/len(vals), 1) if vals else 0.0


def _aggregate_avg_engage(collected: List[Dict[str, Any]]) -> float:
    vals = [m.get("facial_engagement_score", 0.0) for m in collected if m]
    return round(sum(vals)/len(vals), 2) if vals else 0.0

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
