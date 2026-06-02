import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  campaigns as seedCampaigns,
  type Campaign,
} from "./mock-data";

interface State {
  balance: number;
  campaigns: Campaign[];
  addCampaign: (c: Campaign) => void;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  topup: (amount: number) => void;
  charge: (amount: number) => void;
  wipeAll: () => void;
}

const INITIAL_BALANCE = 50;

export const useAppStore = create<State>()(
  persist(
    (set) => ({
      balance: INITIAL_BALANCE,
      campaigns: seedCampaigns,
      addCampaign: (c) =>
        set((s) => ({ campaigns: [c, ...s.campaigns] })),
      updateCampaign: (id, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((x) =>
            x.id === id ? { ...x, ...patch } : x,
          ),
        })),
      topup: (amount) => set((s) => ({ balance: s.balance + amount })),
      charge: (amount) =>
        set((s) => ({ balance: Math.max(0, s.balance - amount) })),
      wipeAll: () => set({ balance: 0, campaigns: [] }),
    }),
    { name: "robo-de-lucro-store", version: 2 },
  ),
);

export const computeSummary = (campaigns: Campaign[]) => {
  const totalSpent = campaigns.reduce((a, c) => a + c.spent, 0);
  const totalClicks = campaigns.reduce((a, c) => a + c.clicks, 0);
  const totalImpressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const avgCpc =
    totalClicks > 0 ? totalSpent / totalClicks : 0;
  const avgCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  return {
    totalSpent,
    totalClicks,
    totalImpressions,
    avgCpc,
    avgCtr,
    running: campaigns.filter((c) => c.status === "running").length,
    analyzing: campaigns.filter((c) => c.status === "analyzing").length,
    paused: campaigns.filter((c) => c.status === "paused").length,
  };
};