export type SentinelSeverity = 'info' | 'warn' | 'block';

export type SentinelModule = 'forge' | 'personnel' | 'datalab' | 'rolebank' | 'system';

export interface SentinelCheckResult {
  passed: boolean;
  confidence: number;
  message: string;
  details?: Record<string, any>;
}

export interface SentinelRule {
  id: string;
  module: SentinelModule;
  name: string;
  description: string;
  severity: SentinelSeverity;
  check: (data: any) => SentinelCheckResult;
}

export interface SentinelEvent {
  ruleId: string;
  module: SentinelModule;
  severity: SentinelSeverity;
  passed: boolean;
  confidence: number;
  message: string;
  details?: Record<string, any>;
  fingerprint: string;
  endpoint?: string;
  timestamp: Date;
}

export interface SentinelReport {
  module: SentinelModule;
  timestamp: Date;
  totalChecks: number;
  passed: number;
  warnings: number;
  blocks: number;
  events: SentinelEvent[];
}

export interface SentinelIssue {
  fingerprint: string;
  ruleId: string;
  module: SentinelModule;
  severity: SentinelSeverity;
  lastMessage: string;
  firstSeen: Date;
  lastSeen: Date;
  occurrenceCount: number;
  status: 'open' | 'resolved' | 'muted';
}
