import { ArrowPathIcon, ChartBarIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import React from 'react';

import {
  type CustomModelUsageBreakdownItem,
  CustomModelUsageRange,
  type CustomModelUsageRange as CustomModelUsageRangeType,
  type CustomModelUsageSummary,
} from '../../../shared/usage/constants';
import { i18nService } from '../../services/i18n';
import { usageService } from '../../services/usage';
import { formatMessageDateTime, formatTokenCount } from '../../utils/tokenFormat';

const RANGES = [
  CustomModelUsageRange.Today,
  CustomModelUsageRange.SevenDays,
  CustomModelUsageRange.ThirtyDays,
  CustomModelUsageRange.All,
] as const;

const rangeLabelKey: Record<CustomModelUsageRangeType, string> = {
  [CustomModelUsageRange.Today]: 'usageRangeToday',
  [CustomModelUsageRange.SevenDays]: 'usageRange7d',
  [CustomModelUsageRange.ThirtyDays]: 'usageRange30d',
  [CustomModelUsageRange.All]: 'usageRangeAll',
};

const getIntensityClass = (tokens: number, maxTokens: number): string => {
  if (tokens <= 0 || maxTokens <= 0) return 'bg-surface-raised';
  const ratio = tokens / maxTokens;
  if (ratio >= 0.75) return 'bg-primary';
  if (ratio >= 0.45) return 'bg-primary/70';
  if (ratio >= 0.2) return 'bg-primary/40';
  return 'bg-primary/20';
};

const UsageMetric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-border bg-surface px-3 py-3">
    <div className="text-xs text-secondary">{label}</div>
    <div className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{value}</div>
    {hint && <div className="mt-1 truncate text-[11px] text-muted">{hint}</div>}
  </div>
);

const RankingList: React.FC<{
  title: string;
  items: CustomModelUsageBreakdownItem[];
}> = ({ title, items }) => (
  <section className="min-w-0">
    <h4 className="mb-3 text-sm font-medium text-foreground">{title}</h4>
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {items.length > 0 ? items.slice(0, 8).map((item, index) => (
        <div
          key={item.key}
          className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 ${
            index === 0 ? '' : 'border-t border-border-subtle'
          }`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-raised text-[11px] font-medium text-secondary">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">{item.label}</div>
            <div className="mt-0.5 text-[11px] text-secondary">
              {i18nService.t('usageMessagesCount').replace('{count}', String(item.messageCount))}
            </div>
          </div>
          <div className="text-right text-xs font-medium tabular-nums text-foreground">
            {formatTokenCount(item.totalTokens)}
          </div>
        </div>
      )) : (
        <div className="px-3 py-8 text-center text-xs text-secondary">
          {i18nService.t('usageNoRankingData')}
        </div>
      )}
    </div>
  </section>
);

const CustomModelUsageSection: React.FC = () => {
  const [range, setRange] = React.useState<CustomModelUsageRangeType>(CustomModelUsageRange.ThirtyDays);
  const [summary, setSummary] = React.useState<CustomModelUsageSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSummary = React.useCallback(async (nextRange: CustomModelUsageRangeType) => {
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await usageService.getCustomModelUsageSummary(nextRange);
      setSummary(nextSummary);
      if (nextSummary) {
        console.debug(
          `[Usage] rendered custom model usage summary for range ${nextSummary.range}; counted ${nextSummary.totals.messageCount} message(s).`,
        );
      }
    } catch (err) {
      console.error('[Usage] failed to load custom model usage in renderer:', err);
      setError(i18nService.t('usageLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSummary(range);
  }, [loadSummary, range]);

  const totals = summary?.totals;
  const hasData = !!totals && totals.messageCount > 0;
  const maxDailyTokens = Math.max(0, ...(summary?.daily.map(day => day.totalTokens) ?? []));

  return (
    <div className="space-y-5 pb-2">
      <div className="rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-foreground">{i18nService.t('customModelUsageTitle')}</h4>
            <p className="mt-1 text-xs leading-5 text-secondary">
              {i18nService.t('customModelUsageDescription')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-surface-raised p-0.5">
          {RANGES.map(item => {
            const active = item === range;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'bg-background text-foreground shadow-sm' : 'text-secondary hover:text-foreground'
                }`}
              >
                {i18nService.t(rangeLabelKey[item])}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { void loadSummary(range); }}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {i18nService.t('refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !hasData ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/60 px-6 text-center">
          <ChartBarIcon className="h-10 w-10 text-secondary/60" />
          <h4 className="mt-3 text-sm font-medium text-foreground">{i18nService.t('usageNoDataTitle')}</h4>
          <p className="mt-1 max-w-md text-xs leading-5 text-secondary">
            {i18nService.t('usageNoDataDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <UsageMetric
              label={i18nService.t('usageTotalTokens')}
              value={formatTokenCount(totals?.totalTokens ?? 0)}
              hint={i18nService.t('usageMessagesCount').replace('{count}', String(totals?.messageCount ?? 0))}
            />
            <UsageMetric
              label={i18nService.t('usageInputTokens')}
              value={formatTokenCount(totals?.inputTokens ?? 0)}
            />
            <UsageMetric
              label={i18nService.t('usageOutputTokens')}
              value={formatTokenCount(totals?.outputTokens ?? 0)}
            />
            <UsageMetric
              label={i18nService.t('usageCacheReadTokens')}
              value={formatTokenCount(totals?.cacheReadTokens ?? 0)}
              hint={totals?.lastUsedAt ? formatMessageDateTime(totals.lastUsedAt) : i18nService.t('usageNoRecentUse')}
            />
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-medium text-foreground">{i18nService.t('usageActivity')}</h4>
              <span className="text-xs text-secondary">
                {i18nService.t('usageSessionCount').replace('{count}', String(totals?.sessionCount ?? 0))}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap gap-1.5">
                {(summary?.daily ?? []).map(day => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${formatTokenCount(day.totalTokens)} tokens`}
                    className={`h-4 w-4 rounded ${getIntensityClass(day.totalTokens, maxDailyTokens)}`}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <RankingList title={i18nService.t('usageModelRanking')} items={summary?.byModel ?? []} />
            <RankingList title={i18nService.t('usageProviderRanking')} items={summary?.byProvider ?? []} />
          </div>
        </>
      )}
    </div>
  );
};

export default CustomModelUsageSection;
