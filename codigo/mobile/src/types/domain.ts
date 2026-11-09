export type RiskLevel = 'normal' | 'attention' | 'alert';
export type ReportCategory = 'passable' | 'partial' | 'blocked';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type UserAccount = {
  id: string;
  name: string;
  password: string;
  phone: string;
  address: string;
  profilePhotoUri?: string;
  createdAt: string;
  username?: string;
  role?: 'user' | 'moderator';
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Station = {
  id: string;
  name: string;
  neighborhood: string;
  coordinates: Coordinates;
  rainfallMm: number;
  accumulationPeriodHours: number;
  observedAt: string;
  source: 'CEMADEN' | 'Prefeitura de Santos';
  status: RiskLevel;
};

export type FloodReport = {
  id: string;
  clientId: string;
  category: ReportCategory;
  description: string;
  address: string;
  neighborhood: string;
  coordinates: Coordinates;
  observedAt: string;
  createdAt: string;
  status: SyncStatus;
  source: 'community';
  confirmations: number;
  authorId: string;
  photoUri?: string;
  uploadedPhotoUri?: string;
  locationMode?: 'gps' | 'map' | 'reference';
  sequence?: number;
  lastError?: string;
  retryable?: boolean;
  lifecycle?: 'active' | 'resolved';
  visibility?: 'visible' | 'hidden' | 'removed';
  stateNote?: string;
  stateUpdatedAt?: string;
};

export type OfficialObservation = {
  id: string;
  source: string;
  sourceUrl: string;
  scopeName: string;
  value: number | null;
  unit: string;
  observationDate: string;
  period: string;
  importedAt: string;
};

export type SourceState = {
  source: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type CreateReportInput = Pick<
  FloodReport,
  'clientId' | 'category' | 'description' | 'address' | 'coordinates' | 'observedAt' | 'authorId'
> & {
  photoUri?: string;
  locationMode?: 'gps' | 'map' | 'reference';
};

export type UpdateReportInput = Pick<
  FloodReport,
  'category' | 'description' | 'address' | 'coordinates' | 'observedAt'
> & {
  photoUri?: string;
  locationMode?: 'gps' | 'map' | 'reference';
};

export type ReportDispute = {
  id: string;
  reportId: string;
  authorId: string;
  justification: string;
  photoUri?: string;
  createdAt: string;
  status: 'sent' | 'pending';
  uploadedPhotoUri?: string;
  lastError?: string;
  reviewStatus?: 'pending' | 'kept' | 'hidden';
  moderationNote?: string | null;
  reviewedAt?: string | null;
};

export type ReportState = {
  reportId: string;
  lifecycle: 'active' | 'resolved';
  visibility: 'visible' | 'hidden' | 'removed';
  stateNote: string;
  stateUpdatedAt: string;
};
export type PendingReportUpdate = {
  operationId: string;
  reportId: string;
  authorId: string;
  lifecycle: 'active' | 'resolved';
  note: string;
};
export type PendingModeration = {
  operationId: string;
  disputeId: string;
  authorId: string;
  action: 'keep' | 'hide';
  note: string;
};
export type ModerationItem = {
  id: string;
  reportId: string;
  justification: string;
  evidencePhotoUri?: string | null;
  createdAt: string;
  reviewStatus: 'pending' | 'kept' | 'hidden';
  moderationNote?: string | null;
  description: string;
  address: string;
  reportPhotoUri?: string | null;
};

export type AppNotification = {
  id: number;
  reportId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
export type AccountSession = {
  user: UserAccount;
  token: string;
  expiresAt: string;
  recoveryCode?: string;
};
export type CommunityState = {
  confirmations: Array<{ reportId: string; count: number }>;
  confirmedReportIds: string[];
  disputes: ReportDispute[];
  notifications: AppNotification[];
  reportStates?: ReportState[];
};

export type CitySummary = {
  city: string;
  status: RiskLevel;
  rainfall24hMm: number;
  activeReports: number;
  stationsOnline: number;
  updatedAt: string;
};

export type SyncPullResponse = {
  cursor: string;
  stations: Station[];
  reports: FloodReport[];
  serverTime: string;
  serverId: string;
  hasMore: boolean;
};

export type SyncPushRequest = {
  deviceId: string;
  operations: Array<{
    operationId: string;
    type: 'CREATE_REPORT';
    payload: CreateReportInput;
  }>;
};
