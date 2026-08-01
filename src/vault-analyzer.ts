import { App, getAllTags, TFile } from "obsidian";
import type {
  GraphColorRule,
  GroupShare,
  VaultStatistics,
} from "./types";
import { clamp } from "./utils";

const OTHER_GROUP_ID = "vault-aquarium-other";

interface NoteContext {
  path: string;
  basename: string;
  tags: Set<string>;
}

export interface VaultStructureAnalyzer {
  analyze(rules: GraphColorRule[]): VaultStatistics;
}

/**
 * 公開APIだけでヴォルトを解析するMVP実装。
 * 将来グラフ設定の公開APIが追加された場合は、このクラスを差し替えられる。
 */
export class RuleBasedVaultAnalyzer implements VaultStructureAnalyzer {
  constructor(private readonly app: App) {}

  analyze(rules: GraphColorRule[]): VaultStatistics {
    const files = this.app.vault.getMarkdownFiles();
    const contexts = files.map((file) => this.createContext(file));
    const activeRules = rules.filter((rule) => rule.enabled);
    const counts = new Map<string, number>();

    for (const context of contexts) {
      const matchedRule = activeRules.find((rule) =>
        this.matches(context, rule.query),
      );
      const id = matchedRule?.id ?? OTHER_GROUP_ID;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const noteCount = contexts.length;
    const groups: GroupShare[] = activeRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      color: rule.color,
      count: counts.get(rule.id) ?? 0,
      ratio: noteCount ? (counts.get(rule.id) ?? 0) / noteCount : 0,
      query: rule.query,
      isFallback: false,
    }));

    const otherCount = counts.get(OTHER_GROUP_ID) ?? 0;
    if (otherCount > 0 || groups.length === 0) {
      groups.push({
        id: OTHER_GROUP_ID,
        name: "その他",
        color: "#7aa2a8",
        count: otherCount,
        ratio: noteCount ? otherCount / noteCount : 0,
        query: "どのルールにも一致しないノート",
        isFallback: true,
      });
    }

    groups.sort((a, b) => b.count - a.count);
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    let linkCount = 0;
    const connectedPaths = new Set<string>();
    for (const [source, targets] of Object.entries(resolvedLinks)) {
      const targetEntries = Object.entries(targets);
      if (targetEntries.length > 0) connectedPaths.add(source);
      for (const [target, count] of targetEntries) {
        linkCount += count;
        connectedPaths.add(target);
      }
    }

    const isolatedNoteCount = contexts.filter(
      ({ path }) => !connectedPaths.has(path),
    ).length;

    return {
      analyzedAt: new Date().toISOString(),
      noteCount,
      linkCount,
      // 1ノートあたり2リンクで十分に滑らかになる、見た目用の正規化値。
      linkDensity: clamp(linkCount / Math.max(1, noteCount * 2)),
      isolatedNoteCount,
      isolatedRatio: noteCount ? isolatedNoteCount / noteCount : 0,
      groups,
    };
  }

  private createContext(file: TFile): NoteContext {
    const cache = this.app.metadataCache.getFileCache(file);
    return {
      path: file.path.toLocaleLowerCase("ja-JP"),
      basename: file.basename.toLocaleLowerCase("ja-JP"),
      tags: new Set(
        (cache ? getAllTags(cache) ?? [] : []).map((tag) =>
          tag.toLocaleLowerCase("ja-JP"),
        ),
      ),
    };
  }

  private matches(context: NoteContext, query: string): boolean {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return false;
    return tokens.every((rawToken) => {
      const negated = rawToken.startsWith("-");
      const token = negated ? rawToken.slice(1) : rawToken;
      const matched = this.matchesToken(context, token);
      return negated ? !matched : matched;
    });
  }

  private matchesToken(context: NoteContext, token: string): boolean {
    const separator = token.indexOf(":");
    const key = separator >= 0 ? token.slice(0, separator).toLowerCase() : "";
    const rawValue = separator >= 0 ? token.slice(separator + 1) : token;
    const value = rawValue.replace(/^['\"]|['\"]$/g, "").toLocaleLowerCase("ja-JP");

    if (!value) return false;
    if (key === "path") return context.path.includes(value);
    if (key === "file") {
      return context.basename.includes(value) || context.path.includes(value);
    }
    if (key === "tag") {
      const tag = value.startsWith("#") ? value : `#${value}`;
      return [...context.tags].some(
        (candidate) => candidate === tag || candidate.startsWith(`${tag}/`),
      );
    }
    if (key === "extension") return value === "md" || value === ".md";

    const tagValue = value.startsWith("#") ? value : `#${value}`;
    return (
      context.path.includes(value) ||
      [...context.tags].some(
        (candidate) =>
          candidate === tagValue || candidate.startsWith(`${tagValue}/`),
      )
    );
  }

  private tokenize(query: string): string[] {
    return (
      query.match(
        /-?(?:(?:path|tag|file|extension):(?:"[^"]*"|'[^']*'|[^\s]+)|"[^"]*"|'[^']*'|[^\s]+)/gi,
      ) ?? []
    );
  }
}
