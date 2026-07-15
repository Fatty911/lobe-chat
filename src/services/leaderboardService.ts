// Leaderboard data fetching service for lobe-chat
// Ported from Relay_AI_Chats services/leaderboardService.ts
// Fetches from lmarena.ai LMSYS Chatbot Arena

const LS_FALLBACK_KEY = 'leaderboard_fallback_data_v2';
const LS_FALLBACK_DATE_KEY = 'leaderboard_fallback_date_v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export interface LeaderboardEntry {
  arena_score: number;
  is_chinese: boolean;
  model: string;
  organization: string;
  rank: number;
}

interface CacheEntry {
  data: LeaderboardEntry[];
  fallbackDate?: string;
  isLive: boolean;
  timestamp: number;
}

let cache: CacheEntry | null = null;

const normalizeOrgKey = (organization: string) =>
  organization.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

const ORGANIZATION_ALIASES = new Map<string, string>([
  ['spacexai', 'SpaceXAI / xAI'],
  ['spacex', 'SpaceXAI / xAI'],
  ['xai', 'SpaceXAI / xAI'],
  ['zai', 'Z.ai / Zhipu'],
  ['zhipu', 'Z.ai / Zhipu'],
  ['zhipuai', 'Z.ai / Zhipu'],
]);

const CHINESE_PROVIDER_KEYS = new Set([
  '01ai',
  'alibaba',
  'baichuan',
  'baidu',
  'bytedance',
  'deepseek',
  'iflytek',
  'internlm',
  'minimax',
  'moonshot',
  'moonshotai',
  'sensetime',
  'shengshu',
  'shanghaiailab',
  'stepfun',
  'tencent',
  'xiaomi',
  'zai',
  'zaizhipu',
  'zhipu',
  'zhipuai',
]);

const CHINESE_MODEL_PATTERN =
  /^(?:abab|chatglm|deepseek|doubao|ernie|glm|hunyuan|internlm|kimi|mimo|minimax|qwen|qwq|step-|yi-)/i;

// Known org prefixes for parsing
const KNOWN_ORGS = [
  'Anthropic', 'MoonshotAI', 'Bytedance', 'ByteDance', 'Tencent', 'Meta',
  'Google', 'OpenAI', 'SpaceXAI', 'xAI', 'Z.ai', 'Zhipu', 'Baidu', 'Alibaba', 'DeepSeek',
  'Xiaomi', 'Mistral', 'Nvidia', 'Cohere', 'Stepfun', 'Minimax',
  '01.AI', 'InternLM', 'Snowflake', 'AI2', 'Databricks', 'Microsoft',
];

function detectOrg(model: string): string {
  for (const org of KNOWN_ORGS) {
    if (model.toLowerCase().startsWith(org.toLowerCase())) {
      return org;
    }
  }
  const patterns: [RegExp, string][] = [
    [/^claude/i, 'Anthropic'],
    [/^gemini|^gemma/i, 'Google'],
    [/^grok/i, 'xAI'],
    [/^gpt-|^o[1-9]/i, 'OpenAI'],
    [/^glm-|^chatglm/i, 'Zhipu'],
    [/^deepseek/i, 'DeepSeek'],
    [/^qwen|^qwq/i, 'Alibaba'],
    [/^kimi/i, 'MoonshotAI'],
    [/^ernie/i, 'Baidu'],
    [/^hunyuan/i, 'Tencent'],
    [/^llama/i, 'Meta'],
    [/^mixtral|^mistral/i, 'Mistral'],
    [/^minimax/i, 'Minimax'],
    [/^phi-/i, 'Microsoft'],
    [/^command-r/i, 'Cohere'],
    [/^nemotron/i, 'Nvidia'],
    [/^yi-/i, '01.AI'],
    [/^internlm/i, 'InternLM'],
    [/^step-/i, 'Stepfun'],
    [/^seedream|^dola/i, 'Bytedance'],
    [/^mimo/i, 'Xiaomi'],
    [/^snowflake/i, 'Snowflake'],
    [/^dbrx/i, 'Databricks'],
    [/^olmo|^tulu/i, 'AI2'],
  ];
  for (const [p, o] of patterns) {
    if (p.test(model)) return o;
  }
  return 'Other';
}

export function normalizeOrganization(organization: string, model: string): string {
  const detected = !organization || organization === 'Other' || organization === 'Unknown'
    ? detectOrg(model)
    : organization.trim();

  return ORGANIZATION_ALIASES.get(normalizeOrgKey(detected)) || detected;
}

export function isChineseOrganization(organization: string, model: string): boolean {
  return CHINESE_PROVIDER_KEYS.has(normalizeOrgKey(organization)) || CHINESE_MODEL_PATTERN.test(model);
}

export function getChineseProductLabel(organization: string, model: string): string | null {
  if (!isChineseOrganization(organization, model)) return null;

  const organizationKey = normalizeOrgKey(normalizeOrganization(organization, model));
  const modelKey = model.toLowerCase();

  if (organizationKey === 'alibaba' || /^(?:qwen|qwq)/i.test(modelKey)) return '千问';
  if (organizationKey === 'zaizhipu' || /^(?:chatglm|glm)/i.test(modelKey)) return '智谱清言';
  if (organizationKey === 'baidu' || /^ernie/i.test(modelKey)) return '文心一言';
  if (
    organizationKey === 'moonshot' ||
    organizationKey === 'moonshotai' ||
    /^kimi/i.test(modelKey)
  ) {
    return 'Kimi';
  }
  if (organizationKey === 'tencent' || /^hunyuan/i.test(modelKey)) return '腾讯元宝';
  if (organizationKey === 'bytedance' || /^(?:doubao|seed)/i.test(modelKey)) return '豆包';
  if (organizationKey === 'xiaomi' || /^mimo/i.test(modelKey)) return '小米 MiMo';
  if (organizationKey === 'deepseek' || /^deepseek/i.test(modelKey)) return 'DeepSeek';
  if (organizationKey === 'minimax' || /^(?:abab|minimax)/i.test(modelKey)) return '海螺 AI';
  if (organizationKey === '01ai' || /^yi-/i.test(modelKey)) return '万知';
  if (organizationKey === 'stepfun' || /^step-/i.test(modelKey)) return '阶跃 AI';
  if (organizationKey === 'iflytek') return '讯飞星火';
  if (organizationKey === 'internlm' || organizationKey === 'shanghaiailab') return '书生浦语';
  if (organizationKey === 'baichuan') return '百小应';

  return null;
}

export function prepareLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const normalized = entries
    .filter((entry) => entry.arena_score > 0 && entry.model.trim())
    .map((entry, index) => {
      const organization = normalizeOrganization(entry.organization, entry.model);
      return {
        ...entry,
        is_chinese:
          entry.is_chinese || isChineseOrganization(entry.organization, entry.model),
        organization,
        rank: Number(entry.rank) || index + 1,
      };
    })
    .sort((a, b) => a.rank - b.rank || b.arena_score - a.arena_score);

  const firstChineseIndex = normalized.findIndex((entry) => entry.is_chinese);
  const targetCount = firstChineseIndex >= 0
    ? Math.ceil((firstChineseIndex + 1) / 10) * 10 + 10
    : 30;
  const displayCount = normalized.length >= targetCount ? targetCount : normalized.length;

  return normalized.slice(0, displayCount);
}

async function fetchFromSource(url: string): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) return await resp.json();
    } catch {}
  }

  return null;
}

function parseApiData(data: any): LeaderboardEntry[] {
  if (!data) return [];
  const models = data.data || data.results || data.models || data.leaderboard || data.rows || data;
  if (!Array.isArray(models)) return [];

  const entries = models
    .filter((m: any) => m && (m.model || m.name || m.model_name || m.modelDisplayName))
    .map((m: any, i: number) => {
      const model = m.model || m.name || m.model_name || m.modelDisplayName || '';
      const rawOrganization =
        m.organization || m.org || m.provider || m.modelOrganization || detectOrg(model);
      const organization = normalizeOrganization(rawOrganization, model);
      return {
        arena_score: Math.round(m.rating ?? m.arena_score ?? m.score ?? m.elo ?? 0),
        organization,
        is_chinese: isChineseOrganization(rawOrganization, model),
        model: String(model).trim(),
        rank: Number(m.rank) || i + 1,
      };
    })
    .filter(e => e.arena_score > 0);

  return prepareLeaderboardEntries(entries);
}

async function fetchLiveData(): Promise<LeaderboardEntry[] | null> {
  const sources = ['/webapi/leaderboard'];

  for (const url of sources) {
    const data = await fetchFromSource(url);
    if (data) {
      const entries = parseApiData(data);
      if (entries.length >= 10) return entries;
    }
  }
  return null;
}

function getLocalFallback(): { data: LeaderboardEntry[]; date: string } | null {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    const date = localStorage.getItem(LS_FALLBACK_DATE_KEY);
    if (raw && date) {
      return { data: prepareLeaderboardEntries(JSON.parse(raw)), date };
    }
  } catch {}
  return null;
}

function saveLocalFallback(data: LeaderboardEntry[]) {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(data));
    localStorage.setItem(LS_FALLBACK_DATE_KEY, new Date().toLocaleDateString('zh-CN'));
  } catch {}
}

export interface LeaderboardResult {
  data: LeaderboardEntry[];
  fallbackDate?: string;
  isLive: boolean;
}

export async function getLeaderboardData(forceRefresh = false): Promise<LeaderboardResult> {
  // Return cache if fresh
  if (!forceRefresh && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return { data: cache.data, isLive: cache.isLive, fallbackDate: cache.fallbackDate };
  }

  const liveData = await fetchLiveData();

  if (liveData && liveData.length >= 10) {
    cache = { data: liveData, timestamp: Date.now(), isLive: true };
    saveLocalFallback(liveData);
    return { data: liveData, isLive: true };
  }

  // Try cache first, then localStorage fallback
  if (cache) {
    return { data: cache.data, isLive: false, fallbackDate: cache.fallbackDate };
  }

  const local = getLocalFallback();
  if (local) {
    cache = { data: local.data, timestamp: Date.now(), isLive: false, fallbackDate: local.date };
    return { data: local.data, isLive: false, fallbackDate: local.date };
  }

  return { data: [], isLive: false };
}
