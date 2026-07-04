import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  getAppData,
  createCampaign as createCampaignFn,
  updateCampaign as updateCampaignFn,
  wipeAll as wipeAllFn,
  type CampaignRow,
  type CreateCampaignResult,
} from "./data.functions";

export type Campaign = CampaignRow;

const APP_DATA_KEY = ["app-data"] as const;

interface AppState {
  balance: number;
  campaigns: Campaign[];
  displayName: string | null;
  addCampaign: (
    c: Omit<Campaign, "id" | "total_paid"> & { id?: string },
  ) => Promise<CreateCampaignResult>;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  wipeAll: () => void;
}

export function useAppData(): AppState & { isLoading: boolean } {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: APP_DATA_KEY,
    queryFn: () => getAppData(),
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: APP_DATA_KEY }), [qc]);

  const createMut = useMutation({
    mutationFn: (c: Omit<Campaign, "id" | "total_paid"> & { id?: string }) => {
      const { id: _drop, ...rest } = c;
      void _drop;
      return createCampaignFn({ data: rest });
    },
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Campaign> }) =>
      updateCampaignFn({ data: { id, patch } }),
    onSuccess: invalidate,
  });

  const wipeMut = useMutation({ mutationFn: () => wipeAllFn(), onSuccess: invalidate });

  return {
    balance: data?.balance ?? 0,
    campaigns: data?.campaigns ?? [],
    displayName: data?.displayName ?? null,
    isLoading,
    addCampaign: (c) => createMut.mutateAsync(c),
    updateCampaign: (id, patch) => { updateMut.mutate({ id, patch }); },
    wipeAll: () => { wipeMut.mutate(); },
  };
}

export function useAppStore<T>(selector: (s: AppState) => T): T {
  const state = useAppData();
  return selector(state);
}

export const computeSummary = (campaigns: Campaign[]) => {
  const running = campaigns.filter((c) => c.status === "running" || c.status === "rodando");
  const totalSpent = running.reduce((a, c) => a + c.spent, 0);
  const totalClicks = running.reduce((a, c) => a + c.clicks, 0);
  const totalImpressions = running.reduce((a, c) => a + c.impressions, 0);
  const totalPaid = campaigns.reduce((a, c) => a + (c.total_paid || 0), 0);
  const avgCpc = totalClicks > 0 ? totalSpent / totalClicks : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  return {
    totalSpent,
    totalClicks,
    totalImpressions,
    totalPaid,
    avgCpc,
    avgCtr,
    running: running.length,
    analyzing: campaigns.filter((c) => c.status === "analyzing" || c.status === "aguardando_vinculo_meta").length,
    paused: campaigns.filter((c) => c.status === "paused").length,
  };
};
