import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { InterviewConfigV2, InterviewQuestionV2, InterviewRecordV2, InterviewResponseV2 } from '../models/InterviewV2.js';
import { User } from '../models/User.js';

export const createInterviewSession = async (req, res, next) => {
  try {
    const userId = req.user?.sub || req.user?.id || req.user?._id || null;
    const { configId, consent, numQuestions, difficulty } = req.body || {};
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    let cfg = null;
    if (configId) {
      cfg = await InterviewConfigV2.findById(configId).lean();
      if (!cfg) {
        return res.status(404).json({ error: 'Interview config not found' });
      }
    } else {
      // Auto-select or create a sensible default configuration so the frontend
      // does not need to manage config IDs manually.
      cfg = await InterviewConfigV2.findOne().lean();
      if (!cfg) {
        const created = await InterviewConfigV2.create({
          name: 'Default Technical Interview',
          description: 'Auto-created default configuration for InterviewV2',
          numQuestions: 20,
          topicMix: { oop: 5, cn: 5, csCore: 5, general: 5 },
          videoQuestionRatio: 0.2,
          mcqTimerSec: 60,
          videoTimerSec: 90,
        });
        cfg = created.toObject();
      }
    }

    // Ensure we have at least a default MCQ bank populated from JSON
    const existingCount = await InterviewQuestionV2.estimatedDocumentCount();
    if (!existingCount) {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const jsonPath = path.join(__dirname, '..', 'data', 'interview_mcq_v2.json');
        const raw = await fs.promises.readFile(jsonPath, 'utf8');
        const items = JSON.parse(raw);
        const docs = [];
        for (const q of items || []) {
          if (!q || q.type !== 'MCQ') continue;
          let category = 'CS_CORE';
          if (q.topic === 'OOPs') category = 'OOP';
          else if (q.topic === 'Computer Networks') category = 'CN';
          else if (q.topic === 'Core CS Fundamentals') category = 'CS_CORE';
          docs.push({
            category,
            type: 'MCQ',
            difficulty: 'medium',
            text: q.question,
            options: Array.isArray(q.options) ? q.options : [],
            correctOption: q.answer,
            explanation: q.explanation || '',
            defaultTimeSec: 60,
          });
        }
        if (docs.length) {
          await InterviewQuestionV2.insertMany(docs);
          // Ensure each technical category has at least 50 MCQs by
          // duplicating existing questions if the bank is smaller.
          const categories = ['OOP', 'CN', 'CS_CORE'];
          for (const cat of categories) {
            const count = await InterviewQuestionV2.countDocuments({ category: cat, type: 'MCQ' });
            if (count < 50) {
              const need = 50 - count;
              const base = await InterviewQuestionV2.find({ category: cat, type: 'MCQ' }).lean();
              const clones = [];
              for (let i = 0; i < need && base.length; i += 1) {
                const src = base[i % base.length];
                clones.push({
                  category: cat,
                  type: 'MCQ',
                  difficulty: src.difficulty || 'medium',
                  text: src.text,
                  options: src.options || [],
                  correctOption: src.correctOption,
                  defaultTimeSec: src.defaultTimeSec || 60,
                });
              }
              if (clones.length) {
                await InterviewQuestionV2.insertMany(clones);
              }
            }
          }
        }
      } catch (e) {
        // Fallback: no-op, controller will continue but there may be 0 questions
      }
    }

    const topicCounts = cfg.topicMix || {};
    // Always keep the interview length between 20 and 25 questions. If the client
    // passes numQuestions, use it but clamp to this range.
    let totalNeeded = Number(numQuestions) || cfg.numQuestions || 20;
    if (totalNeeded < 20) totalNeeded = 20;
    if (totalNeeded > 25) totalNeeded = 25;

    const topicMap = [
      { key: 'oop', category: 'OOP' },
      { key: 'cn', category: 'CN' },
      { key: 'csCore', category: 'CS_CORE' },
      { key: 'general', category: 'GENERAL_TECH' },
    ];

    const qIds = [];
    for (const { key, category } of topicMap) {
      const count = Number(topicCounts[key] || 0);
      if (!count) continue;
      // Randomly sample questions per category so each interview gets a different set.
      // If a difficulty is provided, filter by it; otherwise use all difficulties.
      const matchStage = { category, type: 'MCQ' };
      if (difficulty && typeof difficulty === 'string') {
        matchStage.difficulty = difficulty;
      }
      const items = await InterviewQuestionV2.aggregate([
        { $match: matchStage },
        { $sample: { size: count } },
        { $project: { _id: 1 } },
      ]);
      items.forEach((q) => qIds.push(q._id));
    }

    if (qIds.length < totalNeeded) {
      const remaining = totalNeeded - qIds.length;
      const more = await InterviewQuestionV2.aggregate([
        { $match: { _id: { $nin: qIds } } },
        { $sample: { size: remaining } },
        { $project: { _id: 1 } },
      ]);
      more.forEach((q) => qIds.push(q._id));
    }

    const shuffled = [...qIds].sort(() => Math.random() - 0.5).slice(0, totalNeeded);

    const record = await InterviewRecordV2.create({
      userId,
      configId: cfg._id,
      questionIds: shuffled,
      consent: {
        given: !!consent?.given,
        at: consent?.at || new Date(),
        ip: req.ip || '',
      },
    });

    const questions = await InterviewQuestionV2.find({ _id: { $in: shuffled } })
      .select('_id type text options defaultTimeSec category difficulty')
      .lean();

    const questionMap = new Map(questions.map((q) => [String(q._id), q]));
    const ordered = shuffled
      .map((id, idx) => {
        const q = questionMap.get(String(id));
        if (!q) return null;
        const timerSec = q.defaultTimeSec || (q.type === 'VIDEO' ? cfg.videoTimerSec : cfg.mcqTimerSec);
        return {
          id: q._id,
          index: idx,
          type: q.type,
          text: q.text,
          options: q.type === 'MCQ' ? q.options || [] : undefined,
          timerSec,
          category: q.category,
          difficulty: q.difficulty,
        };
      })
      .filter(Boolean);

    return res.json({
      success: true,
      data: {
        id: record._id,
        status: record.status,
        startedAt: record.startedAt,
        config: {
          id: cfg._id,
          name: cfg.name,
        },
        questions: ordered,
        mcqCount: ordered.filter((q) => q.type === 'MCQ').length,
        videoCount: ordered.filter((q) => q.type === 'VIDEO').length,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getInterviewSessionV2 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await InterviewRecordV2.findById(id).lean();
    if (!record) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    const questions = await InterviewQuestionV2.find({ _id: { $in: record.questionIds } })
      .select('_id type text options defaultTimeSec category difficulty')
      .lean();
    return res.json({ success: true, data: { record, questions } });
  } catch (err) {
    next(err);
  }
};

export const upsertResponseV2 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, index, type, mcqSelectedOption, timeTakenSec, videoInfo } = req.body || {};
    if (!questionId && typeof index !== 'number') {
      return res.status(400).json({ error: 'questionId or index is required' });
    }

    const record = await InterviewRecordV2.findById(id);
    if (!record) return res.status(404).json({ error: 'Interview not found' });

    let qId = questionId;
    if (!qId && typeof index === 'number' && Array.isArray(record.questionIds)) {
      qId = record.questionIds[index];
    }
    if (!qId) {
      return res.status(400).json({ error: 'Unable to resolve question for response' });
    }

    const q = await InterviewQuestionV2.findById(qId).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });

    const qType = type || q.type;
    const query = { interviewId: record._id, questionId: q._id };

    const update = {
      interviewId: record._id,
      questionId: q._id,
      index: typeof index === 'number' ? index : record.questionIds.findIndex((x) => String(x) === String(q._id)),
      type: qType,
      timing: { timeTakenSec: Number(timeTakenSec || 0) },
    };

    if (qType === 'MCQ') {
      const selected = mcqSelectedOption || null;
      const correct = selected != null && selected === q.correctOption;
      update.mcqSelectedOption = selected;
      update.mcqCorrect = correct;
      update.videoInfo = undefined;
    } else if (qType === 'VIDEO') {
      update.videoInfo = {
        storagePath: videoInfo?.storagePath || null,
        durationSec: Number(videoInfo?.durationSec || 0) || undefined,
      };
    }

    const saved = await InterviewResponseV2.findOneAndUpdate(query, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    return res.json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
};

export const completeInterviewV2 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await InterviewRecordV2.findById(id);
    if (!record) return res.status(404).json({ error: 'Interview not found' });

    const responses = await InterviewResponseV2.find({ interviewId: record._id }).lean();
    const mcqResponses = responses.filter((r) => r.type === 'MCQ');
    const videoResponses = responses.filter((r) => r.type === 'VIDEO');

    const totalMcq = mcqResponses.length || 1;
    const correctMcq = mcqResponses.filter((r) => r.mcqCorrect).length;
    const mcqAccuracy = (correctMcq / totalMcq) * 100;

    record.mcqScore = Math.round(mcqAccuracy);
    record.status = 'completed';
    record.completedAt = new Date();
    record.reportSummary = record.reportSummary || {};
    record.reportSummary.mcqAccuracy = Math.round(mcqAccuracy);
    // If there are per-question VIDEO responses with anomaly data (legacy mode),
    // aggregate them. Otherwise keep any overall anomaly score/flags already
    // computed by uploadOverallInterviewVideo.
    if (videoResponses.length) {
      const videoScores = videoResponses
        .map((r) => r.anomaly?.overallAnomalyScore)
        .filter((v) => typeof v === 'number' && !Number.isNaN(v));
      const overallVideoScore = videoScores.length
        ? videoScores.reduce((a, b) => a + b, 0) / videoScores.length
        : 0;

      const flagCounts = {
        multiFace: 0,
        deepfakeRisk: 0,
        livenessIssues: 0,
        lowQuality: 0,
        lipSyncIssues: 0,
      };
      const summaries = [];
      for (const r of videoResponses) {
        const flags = r.anomaly?.flags;
        if (Array.isArray(flags)) {
          for (const f of flags) {
            if (flagCounts[f] !== undefined) flagCounts[f] += 1;
          }
        }
        if (r.anomaly?.summary) summaries.push(r.anomaly.summary);
      }

      record.videoAnomalyScore = Math.round(overallVideoScore || 0);
      record.reportSummary.videoAnomalyFlags = {
        multiFace: flagCounts.multiFace > 0,
        deepfakeRisk: flagCounts.deepfakeRisk > 0,
        livenessIssues: flagCounts.livenessIssues > 0,
        lowQuality: flagCounts.lowQuality > 0,
        lipSyncIssues: flagCounts.lipSyncIssues > 0,
      };
      if (!record.reportSummary.audioVisualSummary && summaries.length) {
        record.reportSummary.audioVisualSummary = summaries.join('\n');
      }
    }
    await record.save();

    return res.json({
      success: true,
      data: {
        id: record._id,
        mcqScore: record.mcqScore,
        mcqCorrect: correctMcq,
        mcqTotal: totalMcq,
        status: record.status,
        message: 'Interview completed. Video analysis will run asynchronously.',
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getInterviewReportV2 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await InterviewRecordV2.findById(id).lean();
    if (!record) return res.status(404).json({ error: 'Interview not found' });

    const responses = await InterviewResponseV2.find({ interviewId: record._id }).lean();

    const mcqResponses = responses.filter((r) => r.type === 'MCQ');
    const totalMcq = mcqResponses.length || 1;
    const correctMcq = mcqResponses.filter((r) => r.mcqCorrect).length;
    const mcqAccuracy = (correctMcq / totalMcq) * 100;

    const videoResponses = responses.filter((r) => r.type === 'VIDEO');

    // Build a detailed per-question MCQ breakdown including question text,
    // selected option, correct option, and explanation.
    const questionIds = mcqResponses.map((r) => r.questionId);
    const mcqQuestions = await InterviewQuestionV2.find({ _id: { $in: questionIds } })
      .select('_id text options correctOption explanation')
      .lean();
    const qMap = new Map(mcqQuestions.map((q) => [String(q._id), q]));

    const mcqDetails = mcqResponses
      .map((r) => {
        const q = qMap.get(String(r.questionId));
        if (!q) return null;
        return {
          questionId: q._id,
          text: q.text,
          options: q.options || [],
          selectedOption: r.mcqSelectedOption || null,
          correctOption: q.correctOption || null,
          correct: !!r.mcqCorrect,
          explanation: q.explanation || null,
          index: r.index,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    return res.json({
      success: true,
      data: {
        interview: record,
        mcq: {
          correct: correctMcq,
          total: totalMcq,
          score: record.mcqScore || Math.round(mcqAccuracy),
          details: mcqDetails,
        },
        video: {
          responses: videoResponses,
          anomalyScore: record.videoAnomalyScore,
          flags: record.reportSummary?.videoAnomalyFlags || null,
        },
        reportSummary: record.reportSummary || null,
        recommendation: record.recommendation || null,
      },
    });
  } catch (err) {
    next(err);
  }
};
