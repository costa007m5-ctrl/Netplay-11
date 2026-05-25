import { useState, useEffect, useCallback } from 'react';

const SETTINGS_KEY = 'disabled_player_apis';
const LOCAL_CACHE_KEY = 'netplay_disabled_player_apis_cache';

let cachedDisabled: Set<string> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export async function loadGlobalPlayerApiSettings(): Promise<void> {
  if (isLoaded) return;
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data: Record<string, string> = await res.json();
      const raw = data[SETTINGS_KEY];
      if (raw) {
        cachedDisabled = new Set(JSON.parse(raw) as string[]);
      } else {
        cachedDisabled = new Set();
      }
    }
  } catch {
    const local = localStorage.getItem(LOCAL_CACHE_KEY);
    cachedDisabled = local ? new Set(JSON.parse(local) as string[]) : new Set();
  }
  isLoaded = true;
  notifyListeners();
}

export function getGlobalDisabledApis(): Set<string> {
  if (!cachedDisabled) {
    try {
      const local = localStorage.getItem(LOCAL_CACHE_KEY);
      return local ? new Set(JSON.parse(local) as string[]) : new Set();
    } catch { return new Set(); }
  }
  return cachedDisabled;
}

export async function setGlobalPlayerApiEnabled(id: string, enabled: boolean): Promise<void> {
  const current = getGlobalDisabledApis();
  if (enabled) current.delete(id);
  else current.add(id);
  cachedDisabled = current;
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify([...current]));
  notifyListeners();
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [SETTINGS_KEY]: JSON.stringify([...current]) }),
    });
  } catch {
  }
}

export function useGlobalPlayerApiSettings() {
  const [disabledApis, setDisabledApis] = useState<Set<string>>(() => getGlobalDisabledApis());
  const [loading, setLoading] = useState(!isLoaded);

  useEffect(() => {
    const refresh = () => setDisabledApis(new Set(getGlobalDisabledApis()));
    listeners.add(refresh);

    if (!isLoaded) {
      loadGlobalPlayerApiSettings().then(() => {
        setDisabledApis(new Set(getGlobalDisabledApis()));
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => { listeners.delete(refresh); };
  }, []);

  const toggleApi = useCallback(async (id: string) => {
    const enabled = disabledApis.has(id);
    await setGlobalPlayerApiEnabled(id, enabled);
  }, [disabledApis]);

  return { disabledApis, loading, toggleApi };
}
