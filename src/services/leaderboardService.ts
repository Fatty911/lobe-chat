// Leaderboard data fetching service for lobe-chat
// Ported from Relay_AI_Chats services/leaderboardService.ts
// Fetches from lmarena.ai LMSYS Chatbot Arena

const LS_FALLBACK_KEY = 'leaderboard_fallback_data';
const LS_FALLBACK_DATE_KEY = 'leaderboard_fallback_date';
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

// Chinese AI providers
const CHINESE_PROVIDERS = new Set([
  'MoonshotAI', 'Zhipu', 'Alibaba', 'DeepSeek', 'Tencent',
  'Bytedance', 'ByteDance', 'Stepfun', 'Minimax', 'MiniMax',
  'InternLM', '01.AI', 'Shengshu', 'Baidu', 'Xiaomi',
]);

// Known org prefixes for parsing
const KNOWN_ORGS = [
  'Anthropic', 'MoonshotAI', 'Bytedance', 'ByteDance', 'Tencent', 'Meta',
  'Google', 'OpenAI', 'xAI', 'Zhipu', 'Baidu', 'Alibaba', 'DeepSeek',
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

async function fetchFromSource(url: string): Promise<any> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function parseApiData(data: any): LeaderboardEntry[] {
  if (!data) return [];
  const models = data.data || data.results || data.models || data.leaderboard || data.rows || data;
  if (!Array.isArray(models)) return [];

  return models
    .filter((m: any) => m && (m.model || m.name || m.model_name || m.modelDisplayName))
    .map((m: any, i: number) => {
      const model = m.model || m.name || m.model_name || m.modelDisplayName || '';
      const org =
        m.organization || m.org || m.provider || m.modelOrganization || detectOrg(model);
      return {
        arena_score: Math.round(m.rating ?? m.arena_score ?? m.score ?? m.elo ?? 0),
        organization: org,
        is_chinese: CHINESE_PROVIDERS.has(org),
        model: String(model).trim(),
        rank: Number(m.rank) || i + 1,
      };
    })
    .filter(e => e.arena_score > 0)
    .slice(0, 50);
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
      return { data: JSON.parse(raw), date };
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