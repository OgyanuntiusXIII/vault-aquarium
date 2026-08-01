import type {
  FishAppearance,
  GroupShare,
  PatternType,
  VaultStatistics,
} from "./types";
import { clamp } from "./utils";

const FALLBACK_BODY = "#4f8fd8";

export class AppearanceGenerator {
  generate(statistics: VaultStatistics): FishAppearance {
    const groups = this.visualGroups(statistics.groups);
    const first = groups[0];
    const second = groups[1];
    const patternGroups = groups.slice(1);
    const entropy = this.normalizedEntropy(groups);
    const minorityRatio = patternGroups.reduce(
      (sum, group) => sum + group.ratio,
      0,
    );

    const bodyColor = first?.color ?? FALLBACK_BODY;
    return {
      bodyColor,
      // 元素材で白い領域はすべて胴体色。第2グループ以降は模様専用。
      finColor: bodyColor,
      patternColor: second?.color ?? bodyColor,
      accentColors: this.accentColors(patternGroups, bodyColor),
      patternAmount: clamp(
        0.08 + minorityRatio * 0.9 + statistics.isolatedRatio * 0.12,
        0.08,
        0.78,
      ),
      patternType: this.patternType(groups, entropy),
      boundarySoftness: clamp(0.25 + statistics.linkDensity * 0.75),
      fragmentation: clamp(
        statistics.isolatedRatio * 0.8 + Math.max(0, groups.length - 3) * 0.06,
      ),
      // 同じグループへ1ノート増えた場合も、飽和的な微細度として必ず小さく反映する。
      structureDetail: clamp(1 - Math.exp(-statistics.noteCount / 180)),
    };
  }

  /**
   * 「その他」は未分類数の表示専用。魚の色は登録ルール間の一致数だけで決める。
   * まだ1件も一致しない場合は、優先順位1位の登録色を穏やかな初期色として使う。
   */
  private visualGroups(groups: GroupShare[]): GroupShare[] {
    const configured = groups.filter(
      (group) =>
        !group.isFallback && group.id !== "vault-aquarium-other",
    );
    const matched = configured.filter((group) => group.count > 0);
    if (matched.length === 0) {
      return configured[0] ? [{ ...configured[0], ratio: 1 }] : [];
    }
    const topTwo = matched.sort((a, b) => b.count - a.count).slice(0, 2);
    const selectedTotal = topTwo.reduce((sum, group) => sum + group.count, 0);
    return topTwo.map((group) => ({
        ...group,
        ratio: group.count / selectedTotal,
      }));
  }

  private accentColors(
    patternGroups: GroupShare[],
    fallbackColor: string,
  ): string[] {
    const colors = patternGroups.map((group) => group.color);
    if (colors.length === 0) colors.push(fallbackColor);
    return colors.slice(0, 6);
  }

  private patternType(groups: GroupShare[], entropy: number): PatternType {
    const first = groups[0]?.ratio ?? 1;
    const second = groups[1]?.ratio ?? 0;
    if (first >= 0.65 || groups.length <= 1) return "gradient";
    if (groups.length === 2 && Math.abs(first - second) <= 0.15) {
      return "bicolor";
    }
    if (groups.length >= 4 && entropy < 0.84) return "spots";
    if (groups.length >= 3 && entropy >= 0.72) return "marble";
    return groups.length >= 4 ? "spots" : "bicolor";
  }

  private normalizedEntropy(groups: GroupShare[]): number {
    if (groups.length <= 1) return 0;
    const entropy = groups.reduce(
      (sum, group) =>
        group.ratio > 0 ? sum - group.ratio * Math.log(group.ratio) : sum,
      0,
    );
    return entropy / Math.log(groups.length);
  }
}
