'use client';

import { type ReactNode } from 'react';

import { useWakeLock } from '@/hooks/useWakeLock';

export const WakeLockProvider = ({ children }: { children: ReactNode }) => {
  useWakeLock();
  return children;
};
