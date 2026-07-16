'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Outlet } from 'react-router';

import { LeaderboardPanel } from '@/features/Leaderboard';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    display: flex;
    overflow: hidden;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: ${cssVar.colorBgLayout};

    @media (max-width: 767px) {
      display: block;
      overflow: visible;
      height: auto;
    }
  `,
  left: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 0;

    padding: 32px;

    @media (max-width: 767px) {
      min-height: 74svh;
      padding: 20px 16px;
    }
  `,
  right: css`
    display: flex;
    flex-direction: column;

    height: 100%;
    min-height: 0;
    width: clamp(520px, 46vw, 880px);
    min-width: min(520px, 46vw);
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};

    @media (max-width: 767px) {
      height: auto;
      width: 100%;
      min-width: 0;
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      border-inline-start: 0;
    }
  `,
}));

const SignInLayout = () => {
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <Flexbox style={{ width: '100%', maxWidth: 400 }}>
          <Outlet />
        </Flexbox>
      </div>
      <div className={styles.right}>
        <LeaderboardPanel />
      </div>
    </div>
  );
};

export default SignInLayout;
