import mongoose from 'mongoose';

const { Schema } = mongoose;

const InterviewQuestionSchema = new Schema(
  {
    category: { type: String, enum: ['OOP', 'CN', 'CS_CORE', 'GENERAL_TECH'], required: true },
    type: { type: String, enum: ['MCQ', 'VIDEO'], required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    text: { type: String, required: true },
    options: [{ type: String }],
    correctOption: { type: String },
    explanation: { type: String },
    defaultTimeSec: { type: Number, default: 60 },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

const InterviewConfigSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    numQuestions: { type: Number, default: 20 },
    topicMix: {
      oop: { type: Number, default: 5 },
      cn: { type: Number, default: 5 },
      csCore: { type: Number, default: 5 },
      general: { type: Number, default: 5 },
    },
    videoQuestionRatio: { type: Number, default: 0.2 },
    mcqTimerSec: { type: Number, default: 60 },
    videoTimerSec: { type: Number, default: 90 },
    anomalyThresholds: {
      livenessMin: { type: Number, default: 0.5 },
      deepfakeMax: { type: Number, default: 0.6 },
      multiFaceMax: { type: Number, default: 0.4 },
      lowQualityMax: { type: Number, default: 0.4 },
      lipSyncMax: { type: Number, default: 0.4 },
    },
  },
  { timestamps: true }
);

const InterviewRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    configId: { type: Schema.Types.ObjectId, ref: 'InterviewConfigV2', required: true },
    status: { type: String, enum: ['in_progress', 'completed', 'expired'], default: 'in_progress' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    consent: {
      given: { type: Boolean, default: false },
      at: { type: Date },
      ip: { type: String },
    },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'InterviewQuestionV2' }],
    mcqScore: { type: Number, default: 0 },
    videoAnomalyScore: { type: Number, default: 0 },
    recommendation: { type: String, enum: ['Pass', 'Review', 'Flagged', null], default: null },
    reportSummary: {
      confidenceIndex: { type: Number, default: 0 },
      consistencyIndex: { type: Number, default: 0 },
      audioVisualSummary: { type: String, default: '' },
      mcqAccuracy: { type: Number, default: 0 },
      videoAnomalyFlags: {
        multiFace: { type: Boolean, default: false },
        deepfakeRisk: { type: Boolean, default: false },
        livenessIssues: { type: Boolean, default: false },
        lowQuality: { type: Boolean, default: false },
        lipSyncIssues: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true }
);

const InterviewResponseSchema = new Schema(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: 'InterviewRecordV2', required: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'InterviewQuestionV2', required: true },
    index: { type: Number, required: true },
    type: { type: String, enum: ['MCQ', 'VIDEO'], required: true },
    mcqSelectedOption: { type: String },
    mcqCorrect: { type: Boolean },
    videoInfo: {
      storagePath: { type: String },
      durationSec: { type: Number },
    },
    timing: {
      timeTakenSec: { type: Number, default: 0 },
    },
    anomaly: {
      livenessScore: { type: Number },
      deepfakeScore: { type: Number },
      multiFaceScore: { type: Number },
      qualityScore: { type: Number },
      lipSyncScore: { type: Number },
      overallAnomalyScore: { type: Number },
      flags: [{ type: String }],
    },
  },
  { timestamps: true }
);

const RetentionRuleSchema = new Schema(
  {
    retentionDays: { type: Number, default: 30 },
    autoDeleteEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const InterviewQuestionV2 = mongoose.model('InterviewQuestionV2', InterviewQuestionSchema);
export const InterviewConfigV2 = mongoose.model('InterviewConfigV2', InterviewConfigSchema);
export const InterviewRecordV2 = mongoose.model('InterviewRecordV2', InterviewRecordSchema);
export const InterviewResponseV2 = mongoose.model('InterviewResponseV2', InterviewResponseSchema);
export const InterviewRetentionRule = mongoose.model('InterviewRetentionRule', RetentionRuleSchema);
