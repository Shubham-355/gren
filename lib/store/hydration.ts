"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAppStore } from "./useAppStore";

const subscribe = (onChange: () => void) =>
  useAppStore.persist.onFinishHydration(onChange);
const getSnapshot = () => useAppStore.persist.hasHydrated();
const getServerSnapshot = () => false;

/**
 * Persistence is deliberately deferred: the store is created with
 * `skipHydration`, so the first client render matches the server output and
 * only then does localStorage get merged in. Screens use this to avoid
 * flashing seed values over the user's real progress.
 */
export function useHydratedStore(): boolean {
  useEffect(() => {
    if (!useAppStore.persist.hasHydrated()) {
      void Promise.resolve(useAppStore.persist.rehydrate()).then(() => {
        useAppStore.setState({ hydrated: true });
      });
    } else {
      useAppStore.setState({ hydrated: true });
    }
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
