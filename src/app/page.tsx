'use client';

import { API_CONFIG, EBackendStatus } from '@dittopedia/shared';
import { useEffect, useRef, useState } from 'react';

type HealthResponse = {
  status?: string;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export default function Home() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const [backendStatus, setBackendStatus] = useState<EBackendStatus>(
    EBackendStatus.DOWN,
  );
  const [isChecking, setIsChecking] = useState(false);
  const isMountedRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);

  const checkBackendConnection = async () => {
    if (!isMountedRef.current) {
      return;
    }

    activeControllerRef.current?.abort();

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const requestId = ++latestRequestIdRef.current;

    setIsChecking(true);

    try {
      const response = await fetch(`${apiBaseUrl}/health/live`, {
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        requestId !== latestRequestIdRef.current
      ) {
        return;
      }

      if (!response.ok) {
        setBackendStatus(EBackendStatus.DOWN);
        return;
      }

      const payload: HealthResponse = await response.json();

      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        requestId !== latestRequestIdRef.current
      ) {
        return;
      }

      setBackendStatus(
        payload.status === 'ok' ? EBackendStatus.UP : EBackendStatus.DOWN,
      );
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        requestId !== latestRequestIdRef.current ||
        isAbortError(error)
      ) {
        return;
      }

      setBackendStatus(EBackendStatus.DOWN);
    } finally {
      if (
        !controller.signal.aborted &&
        isMountedRef.current &&
        requestId === latestRequestIdRef.current
      ) {
        setIsChecking(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    checkBackendConnection();

    return () => {
      isMountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, [apiBaseUrl]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Dittopedia</h1>
      <p className="text-lg text-gray-600">
        API version : <code className="font-mono">{API_CONFIG.VERSION}</code>
      </p>
      <span
        className={`rounded-full px-3 py-1 text-sm ${
          backendStatus === EBackendStatus.UP
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        Backend status: {backendStatus}
      </span>
      <button
        type="button"
        onClick={() => checkBackendConnection()}
        disabled={isChecking}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isChecking ? 'Vérification...' : 'Re-tester la connexion'}
      </button>
    </main>
  );
}
