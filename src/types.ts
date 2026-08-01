export type PatternType = "gradient" | "bicolor" | "marble" | "spots";

export interface GraphColorRule {
  id: string;
  name: string;
  query: string;
  color: string;
  enabled: boolean;
}

export interface GroupShare {
  id: string;
  name: string;
  color: string;
  count: number;
  ratio: number;
  query: string;
  isFallback: boolean;
}

export interface VaultStatistics {
  analyzedAt: string;
  noteCount: number;
  linkCount: number;
  linkDensity: number;
  isolatedNoteCount: number;
  isolatedRatio: number;
  groups: GroupShare[];
}

export interface FishAppearance {
  bodyColor: string;
  finColor: string;
  patternColor: string;
  accentColors: string[];
  patternAmount: number;
  patternType: PatternType;
  boundarySoftness: number;
  fragmentation: number;
  structureDetail: number;
}

export interface GrowthRecord {
  id: string;
  recordedAt: string;
  kind: "installed" | "monthly";
  appearance: FishAppearance;
  statistics: VaultStatistics;
}

export interface VaultAquariumSettings {
  fishName: string;
  showFish: boolean;
  fishSize: number;
  swimSpeed: number;
  opacity: number;
  rules: GraphColorRule[];
}

export interface VaultAquariumData {
  dataVersion: number;
  settings: VaultAquariumSettings;
  installedAt: string;
  currentAppearance: FishAppearance;
  targetAppearance: FishAppearance;
  appearanceUpdatedAt: string;
  latestStatistics: VaultStatistics | null;
  growthRecords: GrowthRecord[];
}
