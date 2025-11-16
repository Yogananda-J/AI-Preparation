import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { env } from '../config/env.js';
import { InterviewResponseV2, InterviewRecordV2 } from '../models/InterviewV2.js';

export const uploadInterviewVideo = async (req, res, next) => {
  try {
    const { interviewId, questionId, videoB64, durationSec } = req.body || {};
    if (!interviewId || !questionId || !videoB64) {
      return res.status(400).json({ error: 'interviewId, questionId and videoB64 are required' });
    }

    const baseDir = env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const dir = path.join(baseDir, 'interviews', String(interviewId));
    await fs.promises.mkdir(dir, { recursive: true });

    const fileName = `${questionId}_${Date.now()}.webm`;
    const fullPath = path.join(dir, fileName);
    const buf = Buffer.from(videoB64, 'base64');
    await fs.promises.writeFile(fullPath, buf);

    const storagePath = fullPath;
    const filter = { interviewId, questionId };
    const update = {
      interviewId,
      questionId,
      type: 'VIDEO',
      videoInfo: {
        storagePath,
        durationSec: Number(durationSec || 0) || undefined,
      },
    };

    // Call ML service for stubbed anomaly analysis (non-blocking for core flow)
    try {
      const mlBase = env.ML_SERVICE_URL || 'http://localhost:8001';
      const resp = await axios.post(`${mlBase}/video_anomaly`, {
        interview_id: String(interviewId),
        question_id: String(questionId),
        video_path: storagePath,
      });
      if (resp?.data) {
        const payload = resp.data;
        update.anomaly = {
          overallAnomalyScore: typeof payload.anomalyScore === 'number' ? payload.anomalyScore : undefined,
          summary: typeof payload.summary === 'string' ? payload.summary : undefined,
          flags: Array.isArray(payload.flags)
            ? payload.flags
            : Object.entries(payload.flags || {})
                .filter(([, v]) => !!v)
                .map(([k]) => k),
        };
      }
    } catch (e) {
      // If ML service is down, we still store the video and proceed
      // eslint-disable-next-line no-console
      console.warn('video_anomaly ML call failed:', e.message || e);
    }

    const saved = await InterviewResponseV2.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    return res.json({ success: true, data: { storagePath, responseId: saved._id } });
  } catch (err) {
    next(err);
  }
};

export const uploadOverallInterviewVideo = async (req, res, next) => {
  try {
    const { interviewId, videoB64, durationSec } = req.body || {};
    if (!interviewId || !videoB64) {
      return res.status(400).json({ error: 'interviewId and videoB64 are required' });
    }

    const record = await InterviewRecordV2.findById(interviewId);
    if (!record) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const baseDir = env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const dir = path.join(baseDir, 'interviews', String(interviewId));
    await fs.promises.mkdir(dir, { recursive: true });

    const fileName = `overall_${Date.now()}.webm`;
    const fullPath = path.join(dir, fileName);
    const buf = Buffer.from(videoB64, 'base64');
    await fs.promises.writeFile(fullPath, buf);

    const storagePath = fullPath;

    // Call ML service for stubbed anomaly analysis on the full session video
    let anomalyScore = 0;
    let flagsObj = null;
    let summaryText = '';
    try {
      const mlBase = env.ML_SERVICE_URL || 'http://localhost:8001';
      const resp = await axios.post(`${mlBase}/video_anomaly`, {
        interview_id: String(interviewId),
        question_id: 'overall',
        video_path: storagePath,
      });
      if (resp?.data) {
        const payload = resp.data;
        if (typeof payload.anomalyScore === 'number') {
          anomalyScore = payload.anomalyScore;
        }
        if (payload.flags && typeof payload.flags === 'object' && !Array.isArray(payload.flags)) {
          flagsObj = payload.flags;
        }
        if (typeof payload.summary === 'string') {
          summaryText = payload.summary;
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('overall video_anomaly ML call failed:', e.message || e);
    }

    record.videoAnomalyScore = Math.round(anomalyScore || 0);
    record.reportSummary = record.reportSummary || {};
    if (typeof record.reportSummary.mcqAccuracy !== 'number') {
      record.reportSummary.mcqAccuracy = record.mcqScore || 0;
    }
    if (!record.reportSummary.videoAnomalyFlags) {
      record.reportSummary.videoAnomalyFlags = {
        multiFace: false,
        deepfakeRisk: false,
        livenessIssues: false,
        lowQuality: false,
        lipSyncIssues: false,
      };
    }
    if (flagsObj) {
      const f = record.reportSummary.videoAnomalyFlags;
      f.multiFace = !!flagsObj.multiFace;
      f.deepfakeRisk = !!flagsObj.deepfakeRisk;
      f.livenessIssues = !!flagsObj.livenessIssues;
      f.lowQuality = !!flagsObj.lowQuality;
      f.lipSyncIssues = !!flagsObj.lipSyncIssues;
    }
    if (summaryText && !record.reportSummary.audioVisualSummary) {
      record.reportSummary.audioVisualSummary = summaryText;
    }
    await record.save();

    return res.json({
      success: true,
      data: {
        storagePath,
        anomalyScore: record.videoAnomalyScore,
        flags: record.reportSummary.videoAnomalyFlags,
        summary: record.reportSummary.audioVisualSummary,
      },
    });
  } catch (err) {
    next(err);
  }
};
