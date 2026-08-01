import { App, normalizePath } from "obsidian";
import type { GraphColorRule } from "./types";

interface StoredGraphColorGroup {
  query?: unknown;
  color?: unknown;
}

interface StoredGraphSettings {
  colorGroups?: unknown;
}

/**
 * Obsidianのgraph.jsonから色グループを取り込む補助実装。
 * 公開Plugin APIの設定値ではないため、読めない場合は既存ルールを維持する。
 */
export class GraphConfigImporter {
  constructor(private readonly app: App) {}

  async loadRules(): Promise<GraphColorRule[]> {
    const path = normalizePath(`${this.app.vault.configDir}/graph.json`);
    const raw = await this.app.vault.adapter.read(path);
    const parsed = JSON.parse(raw) as StoredGraphSettings;
    if (!Array.isArray(parsed.colorGroups)) return [];

    return parsed.colorGroups.flatMap((entry, index) => {
      if (!this.isColorGroup(entry)) return [];
      const query = entry.query.trim();
      const color = this.toHexColor(entry.color);
      if (!query || !color) return [];
      return [
        {
          id: `graph-color-${index}-${this.hash(query)}`,
          name: this.nameFromQuery(query),
          query,
          color,
          enabled: true,
        },
      ];
    });
  }

  private isColorGroup(value: unknown): value is StoredGraphColorGroup & {
    query: string;
  } {
    return (
      typeof value === "object" &&
      value !== null &&
      "query" in value &&
      typeof value.query === "string"
    );
  }

  private toHexColor(value: unknown): string | null {
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
      return value.toLowerCase();
    }
    if (
      typeof value !== "object" ||
      value === null ||
      !("rgb" in value) ||
      typeof value.rgb !== "number" ||
      !Number.isFinite(value.rgb)
    ) {
      return null;
    }
    const rgb = Math.trunc(value.rgb) & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
  }

  private nameFromQuery(query: string): string {
    const compact = query.trim().replace(/\s+/g, " ");
    const singleRule = compact.match(
      /^(?:path|tag|file|extension):(?:"([^"]+)"|'([^']+)'|(.+))$/i,
    );
    const derived = singleRule?.[1] ?? singleRule?.[2] ?? singleRule?.[3];
    return derived?.trim().replace(/^#/, "") || compact;
  }

  private hash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
}
