import { describe, expect, it } from 'vitest';

import { parseArenaLeaderboardPage } from '../leaderboard';

const leaderboardId =
  'leaderboard-sets/public/leaderboards/text-overall-style_control/leaderboard-snapshots/latest';

describe('parseArenaLeaderboardPage', () => {
  it('extracts the text overall leaderboard from escaped Next.js payloads', () => {
    const html = String.raw`<script>self.__next_f.push([1,"{\"id\":\"${leaderboardId}\",\"entries\":[{\"rank\":1,\"modelDisplayName\":\"model-a\",\"rating\":1500.4,\"modelOrganization\":\"Example\"}]}" ])</script>`;

    expect(parseArenaLeaderboardPage(html)).toEqual([
      {
        modelDisplayName: 'model-a',
        modelOrganization: 'Example',
        rank: 1,
        rating: 1500.4,
      },
    ]);
  });

  it('returns an empty array for malformed or unrelated pages', () => {
    expect(parseArenaLeaderboardPage('<html />')).toEqual([]);
    expect(
      parseArenaLeaderboardPage(
        String.raw`{\"id\":\"${leaderboardId}\",\"entries\":[{invalid}]}`,
      ),
    ).toEqual([]);
  });
});
