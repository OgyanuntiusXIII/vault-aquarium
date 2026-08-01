import type {
  FishAppearance,
  GrowthRecord,
  VaultStatistics,
} from "./types";
import { copyAppearance, createId } from "./utils";

export class GrowthRecorder {
  createRecord(
    kind: GrowthRecord["kind"],
    appearance: FishAppearance,
    statistics: VaultStatistics,
    now = new Date(),
  ): GrowthRecord {
    return {
      id: createId("growth"),
      recordedAt: now.toISOString(),
      kind,
      appearance: copyAppearance(appearance),
      statistics: structuredClone(statistics),
    };
  }

  isMonthlyRecordDue(records: GrowthRecord[], now = new Date()): boolean {
    const latest = records[records.length - 1];
    if (!latest) return false;
    const due = new Date(latest.recordedAt);
    due.setMonth(due.getMonth() + 1);
    return now >= due;
  }
}
