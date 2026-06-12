export const UsageIpcChannel = {
  GetCustomModelUsageSummary: 'usage:getCustomModelUsageSummary',
} as const;

export type UsageIpcChannel = typeof UsageIpcChannel[keyof typeof UsageIpcChannel];

export const CustomModelUsageRange = {
  Today: 'today',
  SevenDays: '7d',
  ThirtyDays: '30d',
  All: 'all',
} as const;

export type CustomModelUsageRange =
  typeof CustomModelUsageRange[keyof typeof CustomModelUsageRange];

export interface CustomModelUsageSummaryRequest {
  range?: CustomModelUsageRange;
}

export interface CustomModelUsageTotals {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
  sessionCount: number;
  firstUsedAt?: number;
  lastUsedAt?: number;
}

export interface CustomModelUsageDailyBucket {
  date: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
}

export interface CustomModelUsageBreakdownItem {
  key: string;
  label: string;
  providerKey?: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
  sessionCount: number;
  lastUsedAt?: number;
}

export interface CustomModelUsageSummary {
  range: CustomModelUsageRange;
  generatedAt: number;
  totals: CustomModelUsageTotals;
  daily: CustomModelUsageDailyBucket[];
  byProvider: CustomModelUsageBreakdownItem[];
  byModel: CustomModelUsageBreakdownItem[];
}
