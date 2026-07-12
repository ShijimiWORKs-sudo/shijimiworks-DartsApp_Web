export type SkillLevelId = 'beginner' | 'intermediate' | 'advanced';

export type DartMachine = 'DARTSLIVE' | 'PHOENIX' | 'BOTH';

export type PracticeGame = 'COUNT-UP' | '01' | 'CRICKET' | 'OTHER';

export type Condition = 'good' | 'normal' | 'bad';

export type ConsultCategory =
  | 'stance'
  | 'grip'
  | 'takeback'
  | 'release'
  | 'followThrough'
  | 'aiming'
  | 'rhythm'
  | 'mental'
  | 'yips'
  | 'practicePlan'
  | 'other';

export type ConsultSeverity = 'light' | 'normal' | 'serious';

export type AnalysisPeriod = 'last7Days' | 'last30Days' | 'last90Days' | 'all';

export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export type UiTheme = 'light' | 'gray';

export type BackgroundTheme = 'black' | 'brown' | 'purple' | 'orange' | 'white';

export type BoardType = 'DARTSLIVE_ZERO' | 'QUIET_SOFT' | 'CORK' | 'OTHER';

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type BoardCalibration = {
  boardType: BoardType;
  center: NormalizedPoint;
  topNumberPoint: NormalizedPoint;
  outerPoint?: NormalizedPoint;
  outerRadius: number;
  ringPreset: 'soft' | 'steelLike' | 'custom';
};

export type BoardReferenceImage = {
  id: string;
  boardType: BoardType;
  imageUri: string;
  calibration: BoardCalibration;
  createdAt: string;
  note?: string;
  imageWidth?: number;
  imageHeight?: number;
};

export type DartHitArea = 'single' | 'double' | 'triple' | 'singleBull' | 'doubleBull' | 'out';

export type PhotoScoreDetectionSource =
  'autoCandidate' | 'imageAnalysisCandidate' | 'manualTap' | 'adjusted';

export type PhotoScoreCandidate = {
  id: string;
  point: NormalizedPoint;
  confidence: number;
  reason: string;
  selected: boolean;
  source?: Extract<PhotoScoreDetectionSource, 'autoCandidate' | 'imageAnalysisCandidate'>;
};

export type PhotoScoreDetectionMode = 'manual' | 'semiAuto';

export type PhotoDetectionQuality = {
  isUsable: boolean;
  centerDistance: number;
  radiusDifference: number;
  rotationDifferenceDegrees: number;
  aspectRatioDifference: number;
  scaleDifference: number;
  brightnessDifference?: number;
  warnings: string[];
};

export type DifferenceDetectionResult = {
  candidates: PhotoScoreCandidate[];
  quality: PhotoDetectionQuality;
  detectionMethod: 'referenceDifference' | 'singleImageHeuristic' | 'calibrationFallback';
  warnings: string[];
};

export type PhotoDetectionFeedback = {
  quality: PhotoDetectionQuality;
  detectionMethod: DifferenceDetectionResult['detectionMethod'];
  warnings: string[];
};

export type PhotoScoreVerticalBias = 'high' | 'low' | 'centered' | 'unknown';

export type PhotoScoreHorizontalBias = 'left' | 'right' | 'centered' | 'unknown';

export type PhotoScoreSpreadPattern = 'tight' | 'vertical' | 'horizontal' | 'wide' | 'unknown';

export type PhotoScoreGroupingQuality = 'good' | 'normal' | 'needsWork' | 'unknown';

export type PhotoScoreAdviceCategory =
  'release' | 'stance' | 'followThrough' | 'grip' | 'aiming' | 'rhythm' | 'mental' | 'practicePlan';

export type PhotoScoreGroupingAnalysis = {
  centerPoint: NormalizedPoint;
  spreadRadius: number;
  averageDistanceFromBoardCenter: number;
  verticalBias: PhotoScoreVerticalBias;
  horizontalBias: PhotoScoreHorizontalBias;
  spreadPattern: PhotoScoreSpreadPattern;
  groupingQuality: PhotoScoreGroupingQuality;
  summaryText: string;
  adviceTexts: string[];
  adviceCategories: PhotoScoreAdviceCategory[];
  recommendedPracticeMenuIds: string[];
};

export type DartHitResult = {
  id: string;
  point: NormalizedPoint;
  number: number | null;
  multiplier: 0 | 1 | 2 | 3;
  area: DartHitArea;
  score: number;
  detectionSource?: PhotoScoreDetectionSource;
  candidateId?: string;
  confidence?: number;
};

export type PhotoScoreEntry = {
  imageUri?: string;
  boardType: BoardType;
  calibration: BoardCalibration;
  hits: DartHitResult[];
  totalScore: number;
  bullCount: number;
  tripleCount: number;
  doubleCount: number;
  groupingAnalysis?: PhotoScoreGroupingAnalysis;
  detectionFeedback?: PhotoDetectionFeedback;
};

export type PracticeInputMethod = 'manual' | 'photoTap';

export type FormPhotoType = 'front' | 'side' | 'releaseAfter';

export type ThrowingHand = 'right' | 'left';

export type FormSelfCheckAnswer = 'yes' | 'no' | 'unknown';

export type FormSelfCheck = {
  stanceFeelsStable: FormSelfCheckAnswer;
  shoulderLineFeelsAligned: FormSelfCheckAnswer;
  elbowHeightFeelsStable: FormSelfCheckAnswer;
  releaseFeelsClean: FormSelfCheckAnswer;
  followThroughGoesToTarget: FormSelfCheckAnswer;
  bodyOpensEarly: FormSelfCheckAnswer;
  gripFeelsTooStrong: FormSelfCheckAnswer;
  feelsRushed: FormSelfCheckAnswer;
};

export type FormPhotoEntry = {
  type: FormPhotoType;
  imageUri?: string;
  note?: string;
};

export type FormAdviceCategory =
  | 'stance'
  | 'shoulderLine'
  | 'elbow'
  | 'release'
  | 'followThrough'
  | 'grip'
  | 'rhythm'
  | 'aiming'
  | 'practicePlan';

export type FormPhotoAdviceResult = {
  id: string;
  date: string;
  throwingHand: ThrowingHand;
  photos: FormPhotoEntry[];
  selfCheck: FormSelfCheck;
  linkedPracticeRecordId?: string;
  linkedPhotoScoreSummary?: string;
  adviceCategories: FormAdviceCategory[];
  summaryText: string;
  adviceTexts: string[];
  checkPoints: string[];
  recommendedPracticeMenuIds: string[];
};

export type PracticeMenu = {
  id: string;
  title: string;
  level: SkillLevelId;
  machineTypes: DartMachine[];
  gameTypes: PracticeGame[];
  targetProblems: string[];
  durationMinutes: number;
  purpose: string;
  steps: string[];
  recordItems: string[];
  evaluationPoints: string[];
  adviceText: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  sourceNotes?: string[];
  relatedKnowledgeIds?: string[];
};

export type UserProfile = {
  rating: number;
  level: SkillLevelId;
  machineType: DartMachine;
  mainProblems: string[];
};

export type PracticeRecord = {
  id: string;
  date: string;
  practiceMenuId: string;
  practiceMenuName: string;
  machineType: Exclude<DartMachine, 'BOTH'>;
  gameType: PracticeGame;
  score: number;
  bullCount: number;
  cricketMarks: number;
  condition: Condition;
  memo: string;
  inputMethod?: PracticeInputMethod;
  photoScore?: PhotoScoreEntry;
};

export type PracticeRecordInput = Omit<PracticeRecord, 'id' | 'date'>;

export type PracticeFilterState = {
  level?: SkillLevelId | 'all';
  machineType?: DartMachine | 'all';
  gameType?: PracticeGame | 'all';
  problemTag?: string | null;
};

export type AppState = {
  schemaVersion: 9;
  profile: UserProfile | null;
  records: PracticeRecord[];
  favoritePracticeMenuIds: string[];
  practiceFilterState: PracticeFilterState;
  consultHistories: ConsultHistory[];
  formPhotoAdviceResults: FormPhotoAdviceResult[];
  boardReferenceImages: BoardReferenceImage[];
  uiTheme: UiTheme;
  backgroundTheme: BackgroundTheme;
};

export type LegacyStoredState = {
  profile: UserProfile | null;
  records: PracticeRecord[];
  favoritePracticeMenuIds?: string[];
  practiceFilterState?: PracticeFilterState;
  consultHistories?: ConsultHistory[];
  formPhotoAdviceResults?: FormPhotoAdviceResult[];
  boardReferenceImages?: BoardReferenceImage[];
  uiTheme?: UiTheme;
  backgroundTheme?: BackgroundTheme;
};

export type AnalysisSummary = {
  period: AnalysisPeriod;
  totalPracticeCount: number;
  countUpAverage: number | null;
  bullAverage: number | null;
  cricketMarksAverage: number | null;
  bestScore: number | null;
  latestPracticeDate: string | null;
  conditionCounts: Record<Condition, number>;
  gameTypeCounts: Record<PracticeGame, number>;
  machineTypeCounts: Record<Exclude<DartMachine, 'BOTH'>, number>;
  trendDirection: TrendDirection;
  improvementComments: string[];
  recommendedPracticeMenuIds: string[];
};

export type GameTypeSummary = {
  gameType: PracticeGame;
  count: number;
  averageScore: number | null;
  averageBullCount: number | null;
  averageCricketMarks: number | null;
};

export type WeeklySummary = {
  weekLabel: string;
  practiceCount: number;
  averageScore: number | null;
  averageBullCount: number | null;
};

export type LibraryCategory = {
  id: string;
  title: string;
  articles: {
    id: string;
    title: string;
    summary: string;
  }[];
};

export type ConsultAdvice = {
  id: string;
  category: ConsultCategory;
  title: string;
  problemKeywords: string[];
  symptoms: string[];
  possibleCauses: string[];
  adviceSummary: string;
  checkPoints: string[];
  recommendedPracticeMenuIds: string[];
  relatedKnowledgeIds: string[];
  cautionText?: string;
  severity?: ConsultSeverity;
};

export type KnowledgeArticle = {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  relatedPracticeMenuIds: string[];
  relatedAdviceIds: string[];
  sourceNotes?: string[];
};

export type ConsultHistory = {
  id: string;
  date: string;
  category: ConsultCategory;
  severity: ConsultSeverity;
  userText: string;
  mainAdvice: string;
  causes: string[];
  checkPoints: string[];
  recommendedPracticeMenuIds: string[];
  relatedKnowledgeIds: string[];
  cautionText?: string;
  nextAction: string;
  memo?: string;
};
