import { describe, expect, it } from 'vitest';

import type { LeaderboardEntry } from './leaderboardService';
import {
  getChineseProductLabel,
  isChineseOrganization,
  normalizeOrganization,
  prepareLeaderboardEntries,
} from './leaderboardService';

describe('leaderboard organization normalization', () => {
  it('treats xAI and SpaceXAI as the same provider family', () => {
    expect(normalizeOrganization('xAI', 'grok-4.5')).toBe('SpaceXAI / xAI');
    expect(normalizeOrganization('SpaceXAI', 'grok-4.5')).toBe('SpaceXAI / xAI');
    expect(normalizeOrganization('SpaceX', 'grok-4.5')).toBe('SpaceXAI / xAI');
  });

  it('marks Z.ai and GLM aliases as Chinese models', () => {
    expect(normalizeOrganization('Z.ai', 'glm-5.2')).toBe('Z.ai / Zhipu');
    expect(isChineseOrganization('Z.ai', 'glm-5.2')).toBe(true);
    expect(isChineseOrganization('Unknown', 'chatglm-4')).toBe(true);
  });

  it('maps Chinese providers to their domestic products', () => {
    expect(getChineseProductLabel('Alibaba', 'qwen3.7-max-preview')).toBe('千问');
    expect(getChineseProductLabel('Z.ai', 'glm-5.2')).toBe('智谱清言');
    expect(getChineseProductLabel('Baidu', 'ernie-5.1')).toBe('文心一言');
    expect(getChineseProductLabel('Anthropic', 'claude-opus-4.8')).toBeNull();
  });
});

const createEntries = (length: number, chineseRank: number): LeaderboardEntry[] =>
  Array.from({ length }, (_, index) => ({
    arena_score: 1500 - index,
    is_chinese: false,
    model: index + 1 === chineseRank ? 'glm-5.2' : `model-${index + 1}`,
    organization: index + 1 === chineseRank ? 'Z.ai' : 'Example',
    rank: index + 1,
  }));

describe('prepareLeaderboardEntries', () => {
  it('shows 30 entries when the first Chinese model is rank 16', () => {
    const prepared = prepareLeaderboardEntries(createEntries(200, 16));

    expect(prepared).toHaveLength(30);
    expect(prepared.at(-1)?.rank).toBe(30);
  });

  it('extends through the next full ten after the first Chinese model', () => {
    const entries = createEntries(50, 25);

    const prepared = prepareLeaderboardEntries(entries);

    expect(prepared).toHaveLength(40);
    expect(prepared.length % 10).toBe(0);
    expect(prepared[24]).toMatchObject({
      is_chinese: true,
      organization: 'Z.ai / Zhipu',
    });
  });

  it('keeps all available entries when the next full interval is unavailable', () => {
    const prepared = prepareLeaderboardEntries(createEntries(25, 25));

    expect(prepared).toHaveLength(25);
    expect(prepared.at(-1)).toMatchObject({ is_chinese: true, model: 'glm-5.2' });
  });

  it('can extend beyond 50 entries when the first Chinese model ranks later', () => {
    expect(prepareLeaderboardEntries(createEntries(200, 45))).toHaveLength(60);
  });

  it('matches the 200-entry reference positions for Grok and GLM', () => {
    const entries = createEntries(200, 25);
    entries[18] = {
      ...entries[18],
      model: 'grok-4.20-beta1',
      organization: 'SpaceX',
    };

    const prepared = prepareLeaderboardEntries(entries);

    expect(prepared).toHaveLength(40);
    expect(prepared[18].organization).toBe('SpaceXAI / xAI');
    expect(prepared[24]).toMatchObject({ is_chinese: true, organization: 'Z.ai / Zhipu' });
  });
});
