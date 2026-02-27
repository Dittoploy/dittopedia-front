import { API_CONFIG, BackendStatus } from '@dittopedia/shared';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Dittopedia</h1>
      <p className="text-lg text-gray-600">
        API version : <code className="font-mono">{API_CONFIG.VERSION}</code>
      </p>
      <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
        {BackendStatus.UP}
      </span>
    </main>
  );
}
