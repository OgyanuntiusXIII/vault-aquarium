import type {
  FishAppearance,
  VaultAquariumData,
  VaultAquariumSettings,
} from "./types";

export const DEFAULT_APPEARANCE: FishAppearance = {
  bodyColor: "#4f8fd8",
  finColor: "#78c6d0",
  patternColor: "#f4a261",
  accentColors: ["#f4a261"],
  patternAmount: 0.18,
  patternType: "gradient",
  boundarySoftness: 0.5,
  fragmentation: 0,
  structureDetail: 0,
};

export const DEFAULT_SETTINGS: VaultAquariumSettings = {
  fishName: "あなたのベタ",
  showFish: true,
  fishSize: 53,
  swimSpeed: 12,
  opacity: 1,
  rules: [],
};

export function createDefaultData(now = new Date()): VaultAquariumData {
  const iso = now.toISOString();
  return {
    dataVersion: 7,
    settings: structuredClone(DEFAULT_SETTINGS),
    installedAt: iso,
    currentAppearance: structuredClone(DEFAULT_APPEARANCE),
    targetAppearance: structuredClone(DEFAULT_APPEARANCE),
    appearanceUpdatedAt: iso,
    latestStatistics: null,
    growthRecords: [],
  };
}

export function mergeData(
  saved: Partial<VaultAquariumData> | null | undefined,
): VaultAquariumData {
  const defaults = createDefaultData();
  if (!saved) return defaults;

  const merged: VaultAquariumData = {
    ...defaults,
    ...saved,
    settings: {
      ...defaults.settings,
      ...(saved.settings ?? {}),
      rules: saved.settings?.rules ?? defaults.settings.rules,
    },
    currentAppearance: {
      ...defaults.currentAppearance,
      ...(saved.currentAppearance ?? {}),
    },
    targetAppearance: {
      ...defaults.targetAppearance,
      ...(saved.targetAppearance ?? {}),
    },
    growthRecords: saved.growthRecords ?? [],
  };

  const savedDataVersion = saved.dataVersion ?? 0;
  // 0.1.2以前の既存ユーザー向け。一度だけ現在サイズを半分へ移行する。
  if (savedDataVersion < 2) {
    merged.settings.fishSize = Math.max(70, merged.settings.fishSize / 2);
  }
  // 0.1.4以前の半透明初期値を、一度だけ完全不透明へ移行する。
  if (savedDataVersion < 3) merged.settings.opacity = 1;
  // 0.1.6以前の誤ったマスク色を補間中の現在色から一度だけ除去する。
  if (savedDataVersion < 4) {
    merged.currentAppearance = {
      ...merged.targetAppearance,
      accentColors: [...merged.targetAppearance.accentColors],
    };
    merged.appearanceUpdatedAt = new Date().toISOString();
  }
  // 0.1.9以前のサイズを、ユーザー指定どおり一度だけ3分の2へ縮小する。
  if (savedDataVersion < 5) {
    merged.settings.fishSize = Math.max(50, merged.settings.fishSize * (2 / 3));
  }
  // 0.2.2以前のサイズを、現在値の3分の2へ一度だけ縮小する。
  if (savedDataVersion < 6) {
    merged.settings.fishSize = Math.max(
      35,
      Math.round(merged.settings.fishSize * (2 / 3)),
    );
  }
  // グラフ設定取り込み直後に胴体色と同化した旧模様色を、一度だけ目標色へ補正する。
  if (savedDataVersion < 7) {
    merged.currentAppearance = {
      ...merged.targetAppearance,
      accentColors: [...merged.targetAppearance.accentColors],
    };
    merged.appearanceUpdatedAt = new Date().toISOString();
  }
  merged.dataVersion = 7;
  return merged;
}
