import { NextResponse } from 'next/server';

import { parseArenaLeaderboardPage } from '@/server/services/leaderboard';

const ARENA_LEADERBOARD_URL = 'https://arena.ai/leaderboard';

export const GET = async () => {
  try {
    const response = await fetch(ARENA_LEADERBOARD_URL, {
      cache: 'force-cache',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LobeHub-Leaderboard/1.0)' },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Leaderboard source unavailable' }, { status: 502 });
    }

    const data = parseArenaLeaderboardPage(await response.text());
    if (data.length < 10) {
      return NextResponse.json({ error: 'Leaderboard source returned invalid data' }, { status: 502 });
    }

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ error: 'Leaderboard source unavailable' }, { status: 502 });
  }
};
