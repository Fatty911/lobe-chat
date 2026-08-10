interface ArenaLeaderboardRecord {
  modelDisplayName: string;
  modelOrganization: string;
  rank: number;
  rating: number;
}

const TEXT_OVERALL_LEADERBOARD_ID =
  'leaderboard-sets/public/leaderboards/text-overall-style_control/leaderboard-snapshots/latest';

const findJsonArrayEnd = (source: string, start: number): number => {
  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = start; index < source.length; index++) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '[') {
      depth++;
    } else if (character === ']') {
      depth--;
      if (depth === 0) return index;
    }
  }

  return -1;
};

export const parseArenaLeaderboardPage = (html: string): ArenaLeaderboardRecord[] => {
  const normalized = html.replaceAll(String.raw`\"`, '"');
  const marker = `"id":"${TEXT_OVERALL_LEADERBOARD_ID}","entries":`;
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return [];

  const arrayStart = normalized.indexOf('[', markerIndex + marker.length);
  if (arrayStart < 0) return [];

  const arrayEnd = findJsonArrayEnd(normalized, arrayStart);
  if (arrayEnd < 0) return [];

  try {
    const records = JSON.parse(normalized.slice(arrayStart, arrayEnd + 1)) as unknown;
    if (!Array.isArray(records)) return [];

    return records.filter(
      (record): record is ArenaLeaderboardRecord =>
        typeof record === 'object' &&
        record !== null &&
        typeof (record as ArenaLeaderboardRecord).modelDisplayName === 'string' &&
        typeof (record as ArenaLeaderboardRecord).modelOrganization === 'string' &&
        typeof (record as ArenaLeaderboardRecord).rank === 'number' &&
        typeof (record as ArenaLeaderboardRecord).rating === 'number',
    );
  } catch {
    return [];
  }
};
