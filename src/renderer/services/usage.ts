import {
  CustomModelUsageRange,
  type CustomModelUsageRange as CustomModelUsageRangeType,
  type CustomModelUsageSummary,
} from '../../shared/usage/constants';

class UsageService {
  async getCustomModelUsageSummary(
    range: CustomModelUsageRangeType = CustomModelUsageRange.ThirtyDays,
  ): Promise<CustomModelUsageSummary | null> {
    const result = await window.electron.usage.getCustomModelUsageSummary({ range });
    return result.success ? result.summary ?? null : null;
  }
}

export const usageService = new UsageService();
