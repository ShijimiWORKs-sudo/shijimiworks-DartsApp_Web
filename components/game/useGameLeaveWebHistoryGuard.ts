import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type NavigationGuardRef = {
  current: boolean;
};

type UseGameLeaveWebHistoryGuardParams = {
  isActive: boolean;
  allowNavigationRef: NavigationGuardRef;
  onRequestLeave: () => void;
};

export function useGameLeaveWebHistoryGuard({
  isActive,
  allowNavigationRef,
  onRequestLeave,
}: UseGameLeaveWebHistoryGuardParams) {
  const isActiveRef = useRef(isActive);
  const onRequestLeaveRef = useRef(onRequestLeave);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    onRequestLeaveRef.current = onRequestLeave;
  }, [onRequestLeave]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || !isActive || typeof window === 'undefined') {
        return undefined;
      }

      const guardedUrl = window.location.href;
      window.history.pushState({ dartsAppLeaveGuard: true }, '', guardedUrl);

      const handlePopState = () => {
        if (allowNavigationRef.current || !isActiveRef.current) {
          return;
        }

        window.history.pushState({ dartsAppLeaveGuard: true }, '', guardedUrl);
        onRequestLeaveRef.current();
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }, [allowNavigationRef, isActive]),
  );
}
