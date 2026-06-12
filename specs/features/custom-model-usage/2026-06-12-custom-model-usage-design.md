# 自定义模型本机用量统计 Spec

## 1. 概述

### 1.1 背景

LobsterAI 目前有两类文本模型来源：

| 类型 | 来源 | 统计口径 |
|------|------|----------|
| 套餐模型 | LobsterAI 服务端提供，`providerKey = lobsterai-server` | 服务端已有套餐额度与用量统计 |
| 自定义模型 | 用户在设置中配置的第三方或本地 provider | 目前没有 LobsterAI 侧可见的用量概览 |

用户希望在 LobsterAI 设置中看到自定义模型的使用量，用于了解本机通过自定义模型产生的 token 活动。该统计不应包含套餐模型，因为套餐模型已有服务端统计。

参考 Codex 的个人资料页展示方式，可以展示累计 token、活动热力图、模型排行等信息。但 LobsterAI 当前没有完整的个人资料设置页，账号信息主要在左下角菜单中展示，因此更适合在设置中新增一个独立的“用量统计”页，或作为“自定义模型”附近的设置页。

### 1.2 目标

1. 在设置中展示“自定义模型本机用量”。
2. 只统计 LobsterAI 在本机记录到的自定义模型 token，不包含套餐模型。
3. 明确告知用户该数据是本机估算值，实际用量和费用以模型服务商后台为准。
4. 首版不依赖服务端新增接口，优先复用本地 SQLite 中已持久化的 cowork message metadata。

### 1.3 非目标

1. 不统计 LobsterAI 套餐模型的用量或余额。
2. 不承诺与自定义模型厂商后台账单完全一致。
3. 不计算真实费用、余额、单价或折扣。
4. 不统计用户在其他工具中使用同一个 API key 产生的用量。
5. 不上传自定义模型请求明细到 LobsterAI 服务端。

## 2. 现状与数据来源

### 2.1 模型来源区分

Renderer 模型状态中已经区分套餐模型和用户自定义模型：

- `Model.isServerModel === true`
- `Model.providerKey === ProviderName.LobsteraiServer`

套餐模型由 `auth:getModels` 加载并写入 `modelSlice.setServerModels()`。用户自定义模型由设置中的 providers 配置构建，并通过 `modelSlice.setAvailableModels()` 写入。

### 2.2 已有 usage metadata

OpenClaw runtime adapter 在 `chat.final` 后会把模型返回的 usage 同步到最终 assistant message：

```typescript
metadata: {
  isStreaming: false,
  isFinal: true,
  usage: {
    inputTokens,
    outputTokens,
    cacheReadTokens,
  },
  model,
  contextPercent,
  agentName,
}
```

这些 metadata 已经持久化到 SQLite 的 `cowork_messages.metadata` 字段中，因此首版可以基于本地历史消息聚合统计。

### 2.3 为什么不能称为厂商账单

LobsterAI 本地统计和厂商后台统计可能不一致，原因包括：

| 差异来源 | 说明 |
|----------|------|
| usage 字段不完整 | 部分 OpenAI-compatible 服务不返回 usage，或只返回 input/output |
| 失败与重试 | 厂商可能计入失败、超时或重试前请求，本地只容易统计最终成功消息 |
| cache 计费口径 | 厂商可能区分 cache read/write、prompt cache、reasoning tokens |
| 多入口使用 | 同一个 API key 可能在其他工具中使用，厂商后台统计的是账号/API key 总量 |
| 多模态 token | 图片、音频、视频 token 的字段和计费方式各厂商差异大 |

因此 UI 文案必须使用“本机用量”或“估算用量”，避免使用“账单用量”“费用统计”等表述。

## 3. 用户场景

### 场景 A: 查看自定义模型累计 token

**Given** 用户在 LobsterAI 中配置并使用了 OpenAI、DeepSeek 或其他自定义 provider  
**When** 用户打开设置中的“用量统计”页  
**Then** 页面展示本机累计输入 token、输出 token、总 token 和最近使用时间

### 场景 B: 套餐模型不进入统计

**Given** 用户同时使用过 LobsterAI 套餐模型和自定义模型  
**When** 用户查看“自定义模型本机用量”  
**Then** 统计结果只包含自定义模型，不包含 `lobsterai-server` 套餐模型产生的用量

### 场景 C: 对比厂商后台

**Given** 用户打开第三方模型厂商后台查看 API key 用量  
**When** 厂商后台数据与 LobsterAI 本机统计存在差异  
**Then** LobsterAI 页面应说明“实际用量和费用请以模型服务商后台为准”

### 场景 D: 无历史数据

**Given** 用户尚未使用自定义模型，或历史消息中没有 usage metadata  
**When** 用户打开“用量统计”页  
**Then** 页面展示空状态，并提示开始使用自定义模型后会在本机记录 token 活动

## 4. 功能需求

### FR-1: 新增设置页入口

在设置侧边栏新增“用量统计”Tab，位置建议紧邻“自定义模型”。

建议命名：

- 中文：`用量统计`
- 英文：`Usage`

页面标题建议：

- 中文：`自定义模型本机用量`
- 英文：`Local Custom Model Usage`

### FR-2: 仅统计自定义模型

聚合逻辑必须排除套餐模型：

1. 排除 `metadata.model` 中 provider 为 `lobsterai-server` 的记录。
2. 排除能匹配到当前服务端模型列表的记录。
3. 对历史缺失 provider 信息的记录，优先按 `metadata.model` 的 provider 前缀判断；无法判断时作为 `unknown` 自定义来源展示，但不应归入套餐模型。

### FR-3: 聚合基础指标

首版统计以下指标：

| 指标 | 说明 |
|------|------|
| totalTokens | `inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens` 的可见合计 |
| inputTokens | 输入 token 合计 |
| outputTokens | 输出 token 合计 |
| cacheReadTokens | 缓存读取 token 合计 |
| cacheWriteTokens | 缓存写入 token 合计，若历史无数据则为 0 |
| messageCount | 带 usage 的 assistant message 数 |
| sessionCount | 产生 usage 的 session 数 |
| firstUsedAt | 最早使用时间 |
| lastUsedAt | 最近使用时间 |

### FR-4: 支持时间范围过滤

首版支持以下范围：

| 范围 | 说明 |
|------|------|
| today | 当地自然日 |
| 7d | 最近 7 天 |
| 30d | 最近 30 天 |
| all | 全部本地历史 |

### FR-5: 展示活动趋势

页面展示每日 token 活动热力图或柱状图。

首版数据结构按天聚合：

```typescript
interface CustomModelUsageDailyBucket {
  date: string; // YYYY-MM-DD
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
}
```

### FR-6: 展示模型与 provider 排行

页面展示常用 provider 和模型排行：

```typescript
interface CustomModelUsageBreakdownItem {
  key: string;
  label: string;
  providerKey?: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  sessionCount: number;
  lastUsedAt?: number;
}
```

排行默认按 `totalTokens` 降序。

### FR-7: 展示口径说明

页面必须展示清晰说明：

> 仅统计 LobsterAI 在本机记录到的自定义模型 token，用于趋势参考；实际用量和费用请以模型服务商后台为准。

英文：

> Only custom model tokens recorded locally by LobsterAI are counted. Use this for trend reference; actual usage and billing are determined by your model provider.

## 5. 实现方案

### 5.1 新增共享类型与 IPC 常量

**位置**：`src/shared/usage/constants.ts`

遵循项目“String Literal Constants”规则，新增集中 IPC channel 常量：

```typescript
export const UsageIpcChannel = {
  GetCustomModelUsageSummary: 'usage:getCustomModelUsageSummary',
} as const;
export type UsageIpcChannel =
  typeof UsageIpcChannel[keyof typeof UsageIpcChannel];

export const CustomModelUsageRange = {
  Today: 'today',
  SevenDays: '7d',
  ThirtyDays: '30d',
  All: 'all',
} as const;
export type CustomModelUsageRange =
  typeof CustomModelUsageRange[keyof typeof CustomModelUsageRange];
```

同时定义请求与响应类型：

```typescript
export interface CustomModelUsageSummaryRequest {
  range?: CustomModelUsageRange;
}

export interface CustomModelUsageSummary {
  range: CustomModelUsageRange;
  generatedAt: number;
  totals: CustomModelUsageTotals;
  daily: CustomModelUsageDailyBucket[];
  byProvider: CustomModelUsageBreakdownItem[];
  byModel: CustomModelUsageBreakdownItem[];
}
```

### 5.2 CoworkStore 增加聚合查询

**位置**：`src/main/coworkStore.ts`

新增方法：

```typescript
getCustomModelUsageSummary(
  options: CustomModelUsageSummaryRequest,
): CustomModelUsageSummary
```

查询范围：

- `cowork_messages.type = 'assistant'`
- `metadata IS NOT NULL`
- `created_at >= rangeStart`（当 range 不是 `all`）

解析逻辑：

1. 逐行解析 `metadata` JSON。
2. 跳过没有 `metadata.usage` 的消息。
3. 读取 `inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens`。
4. 读取 `metadata.model`。
5. 判断是否为套餐模型，若是则跳过。
6. 按 day、provider、model 聚合。

由于 SQLite JSON1 扩展在 Electron 打包环境中不一定稳定可依赖，首版建议在 TypeScript 中解析 metadata，而不是写复杂 JSON SQL。

### 5.3 自定义模型识别规则

模型引用可能有多种形态：

| 形态 | 示例 | 处理 |
|------|------|------|
| provider/model | `openai/gpt-4.1` | provider = `openai` |
| OpenClaw provider/model | `qwen-portal/qwen3-coder` | provider = `qwen-portal` |
| 仅模型 ID | `gpt-4.1` | provider = `unknown` |
| 套餐模型 | `lobsterai-server/deepseek-v4` | 排除 |

建议新增工具函数：

```typescript
function parseUsageModelRef(model: string | undefined): {
  providerKey: string;
  modelId: string;
  isServerModel: boolean;
}
```

套餐模型判断规则：

1. providerKey 等于 `ProviderName.LobsteraiServer` 或 `OpenClawProviderId.LobsteraiServer`。
2. modelId 命中当前已缓存的 server model metadata。
3. 其他情况视为自定义模型或 unknown custom。

### 5.4 新增 IPC handler

**位置**：`src/main/main.ts`

新增：

```typescript
ipcMain.handle(
  UsageIpcChannel.GetCustomModelUsageSummary,
  async (_event, options?: CustomModelUsageSummaryRequest) => {
    try {
      const summary = getCoworkStore().getCustomModelUsageSummary(options ?? {});
      return { success: true, summary };
    } catch (error) {
      console.error('[Usage] failed to load custom model usage summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load custom model usage summary.',
      };
    }
  },
);
```

日志需遵守主进程日志规范，错误日志带 `[Usage]` 模块标签，并把 error 对象作为最后一个参数。

### 5.5 Preload 与类型声明

**位置**：

- `src/main/preload.ts`
- `src/renderer/types/electron.d.ts`

在 `window.electron` 下新增：

```typescript
usage: {
  getCustomModelUsageSummary: (
    options?: CustomModelUsageSummaryRequest,
  ) => Promise<{
    success: boolean;
    summary?: CustomModelUsageSummary;
    error?: string;
  }>;
}
```

### 5.6 Renderer service

**位置**：`src/renderer/services/usage.ts`

新增轻量 service：

```typescript
class UsageService {
  async getCustomModelUsageSummary(
    range: CustomModelUsageRange,
  ): Promise<CustomModelUsageSummary | null> {
    const result = await window.electron.usage.getCustomModelUsageSummary({ range });
    return result.success ? result.summary ?? null : null;
  }
}
```

### 5.7 设置页 UI

**位置**：

- `src/renderer/components/Settings.tsx`
- `src/renderer/components/settings/CustomModelUsageSection.tsx`

新增 `CustomModelUsageSection`，由 Settings 当前 active tab 渲染。

页面布局：

1. 顶部说明条：展示统计口径和“以厂商后台为准”说明。
2. 时间范围 segmented control：今日 / 7 天 / 30 天 / 全部。
3. 指标卡片：累计 token、输入、输出、缓存、会话数、最近使用。
4. 活动图：每日 token activity。
5. 排行列表：常用模型、常用 provider。
6. 空状态：无自定义模型 usage 时展示引导。

UI 需要复用现有 Tailwind 和主题变量，不新增独立 CSS。

### 5.8 i18n

**位置**：`src/renderer/services/i18n.ts`

新增中英文 key，至少包括：

- `usageTab`
- `customModelUsageTitle`
- `customModelUsageDescription`
- `usageRangeToday`
- `usageRange7d`
- `usageRange30d`
- `usageRangeAll`
- `usageTotalTokens`
- `usageInputTokens`
- `usageOutputTokens`
- `usageCacheReadTokens`
- `usageSessionCount`
- `usageLastUsedAt`
- `usageModelRanking`
- `usageProviderRanking`
- `usageNoDataTitle`
- `usageNoDataDescription`

## 6. 边界情况

| 场景 | 处理方式 |
|------|---------|
| metadata JSON 损坏 | 跳过该消息，并使用 `console.warn('[Usage] ...')` 记录可诊断信息 |
| usage 字段缺失 | 跳过该消息 |
| usage 字段部分缺失 | 缺失项按 0 处理 |
| usage 字段不是 number | 忽略该字段 |
| model 缺失 | 归入 `unknown` 自定义模型 |
| model 是套餐模型 | 跳过，不进入自定义模型统计 |
| 厂商后台与本机统计不一致 | UI 文案说明实际用量和费用以厂商后台为准 |
| 用户删除会话 | 统计随本地消息删除而减少 |
| 用户切换语言 | 所有 UI 文案通过 i18n 展示 |
| 无自定义模型历史 | 展示空状态，不报错 |

## 7. 涉及文件

- `src/shared/usage/constants.ts` — 新增 usage IPC 常量、范围常量、请求与响应类型
- `src/main/coworkStore.ts` — 新增自定义模型 usage 聚合查询
- `src/main/main.ts` — 新增 usage IPC handler
- `src/main/preload.ts` — 暴露 `window.electron.usage`
- `src/renderer/types/electron.d.ts` — 补充 usage API 类型
- `src/renderer/services/usage.ts` — Renderer usage service
- `src/renderer/components/Settings.tsx` — 新增设置 Tab 和渲染入口
- `src/renderer/components/settings/CustomModelUsageSection.tsx` — 新增用量统计 UI
- `src/renderer/services/i18n.ts` — 新增中英文文案
- `src/main/coworkStore.test.ts` 或相邻 `.test.ts` — 覆盖聚合与过滤逻辑

## 8. 验收标准

1. `npm run lint` 通过。
2. 聚合测试覆盖以下场景：
   - 自定义模型 usage 会被统计。
   - `lobsterai-server` 套餐模型 usage 会被排除。
   - 缺失或损坏 metadata 不会导致查询失败。
   - `today / 7d / 30d / all` 范围过滤正确。
   - provider 与 model 排行按 totalTokens 降序。
3. 设置侧边栏出现“用量统计”入口，位置紧邻“自定义模型”。
4. 无数据时展示空状态。
5. 有数据时展示总量、每日趋势、provider 排行和模型排行。
6. 页面文案明确说明“本机统计，仅供趋势参考，实际用量和费用以模型服务商后台为准”。
7. 使用套餐模型产生的新消息不会改变自定义模型用量统计。
