import { App, Modal, Setting } from "obsidian";
import type {
  FishAppearance,
  GraphColorRule,
  GrowthRecord,
  VaultStatistics,
} from "./types";
import { createId, formatJapaneseDate, formatPercent } from "./utils";

const PATTERN_LABELS: Record<FishAppearance["patternType"], string> = {
  gradient: "穏やかなグラデーション",
  bicolor: "バイカラー",
  marble: "マーブル",
  spots: "小さな斑点",
};

export class FishInfoPopover {
  private element: HTMLDivElement | null = null;
  private removeOutsideListener: (() => void) | null = null;

  open(
    anchor: HTMLElement,
    fishName: string,
    appearance: FishAppearance,
    statistics: VaultStatistics | null,
    growthRecords: GrowthRecord[],
  ): void {
    this.close();
    const element = document.body.createDiv({
      cls: "vault-aquarium-popover",
      attr: { role: "dialog", "aria-label": `${fishName}の情報` },
    });
    this.element = element;
    element.createEl("h3", { text: fishName });

    if (!statistics) {
      element.createEl("p", { text: "ヴォルトを解析しています…" });
    } else {
      element.createEl("p", {
        cls: "vault-aquarium-summary",
        text: this.summary(appearance, statistics),
      });
      const mapping = element.createDiv({ cls: "vault-aquarium-mapping" });
      const activeGroups = this.visualGroups(statistics);
      this.addMappingRow(mapping, "胴体・元白部分", activeGroups[0]);
      for (const group of activeGroups.slice(1, 2)) {
        this.addMappingRow(mapping, "模様・差し色", group);
      }
      const other = statistics.groups.find(
        (group) => group.isFallback || group.id === "vault-aquarium-other",
      );
      const unmatched = other?.count ? `・未分類 ${other.count}件` : "";
      element.createEl("p", {
        cls: "vault-aquarium-popover-meta",
        text: `ノート ${statistics.noteCount}件・リンク ${statistics.linkCount}件${unmatched}・記録 ${growthRecords.length}件`,
      });
    }

    const latestRecords = growthRecords.slice(-4).reverse();
    element.createEl("h4", { text: "成長記録" });
    if (latestRecords.length === 0) {
      element.createEl("p", { text: "最初の解析後に記録されます。" });
    } else {
      const list = element.createEl("ul");
      for (const record of latestRecords) {
        list.createEl("li", {
          text: `${formatJapaneseDate(record.recordedAt)} — ${record.statistics.noteCount}ノート`,
        });
      }
    }

    const rect = anchor.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    element.style.width = `${width}px`;
    element.style.visibility = "hidden";
    let left = Math.min(
      window.innerWidth - width - 12,
      Math.max(12, rect.left + rect.width / 2 - width / 2),
    );
    const popoverHeight = element.getBoundingClientRect().height;
    const gap = 12;
    const spaceAbove = rect.top - gap;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    let top: number;
    if (spaceAbove >= popoverHeight) {
      top = rect.top - popoverHeight - gap;
    } else if (spaceBelow >= popoverHeight) {
      top = rect.bottom + gap;
    } else if (rect.right + gap + width <= window.innerWidth - 12) {
      left = rect.right + gap;
      top = Math.max(12, Math.min(window.innerHeight - popoverHeight - 12, rect.top));
    } else if (rect.left - gap - width >= 12) {
      left = rect.left - width - gap;
      top = Math.max(12, Math.min(window.innerHeight - popoverHeight - 12, rect.top));
    } else {
      top = spaceAbove >= spaceBelow
        ? Math.max(12, rect.top - popoverHeight - gap)
        : Math.min(window.innerHeight - popoverHeight - 12, rect.bottom + gap);
    }
    element.style.left = `${left}px`;
    element.style.top = `${Math.max(12, top)}px`;
    element.style.visibility = "visible";

    const outside = (event: PointerEvent): void => {
      if (
        this.element &&
        event.target instanceof Node &&
        !this.element.contains(event.target) &&
        !anchor.contains(event.target)
      ) {
        this.close();
      }
    };
    window.setTimeout(() => document.addEventListener("pointerdown", outside), 0);
    this.removeOutsideListener = () =>
      document.removeEventListener("pointerdown", outside);
  }

  close(): void {
    this.removeOutsideListener?.();
    this.removeOutsideListener = null;
    this.element?.remove();
    this.element = null;
  }

  private summary(
    appearance: FishAppearance,
    statistics: VaultStatistics,
  ): string {
    const active = this.visualGroups(statistics);
    const top = active[0];
    const composition = top
      ? `${top.name} ${formatPercent(top.ratio)}が中心`
      : "まだノートがありません";
    return `${composition}。模様は「${PATTERN_LABELS[appearance.patternType]}」です。`;
  }

  private visualGroups(statistics: VaultStatistics): VaultStatistics["groups"] {
    const configured = statistics.groups.filter(
      (group) =>
        !group.isFallback && group.id !== "vault-aquarium-other" && group.count > 0,
    );
    const topTwo = configured.sort((a, b) => b.count - a.count).slice(0, 2);
    const selectedTotal = topTwo.reduce((sum, group) => sum + group.count, 0);
    if (selectedTotal === 0) return [];
    return topTwo.map((group) => ({
      ...group,
      ratio: group.count / selectedTotal,
    }));
  }

  private addMappingRow(
    parent: HTMLElement,
    part: string,
    group:
      | { name: string; color: string; ratio: number; count: number }
      | undefined,
  ): void {
    if (!group) return;
    const row = parent.createDiv({ cls: "vault-aquarium-mapping-row" });
    const swatch = row.createSpan({ cls: "vault-aquarium-color-swatch" });
    swatch.style.backgroundColor = group.color;
    row.createSpan({
      text: `${part}: ${group.name}（${formatPercent(group.ratio)} / ${group.count}件）`,
    });
  }
}

export class GrowthRecordsModal extends Modal {
  constructor(
    app: App,
    private readonly records: GrowthRecord[],
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.setTitle("ヴォルト水槽の成長記録");
    if (this.records.length === 0) {
      this.contentEl.createEl("p", { text: "成長記録はまだありません。" });
      return;
    }

    const list = this.contentEl.createDiv({
      cls: "vault-aquarium-growth-list",
    });
    for (const record of [...this.records].reverse()) {
      const item = list.createDiv({ cls: "vault-aquarium-growth-item" });
      item.createEl("h3", {
        text: `${formatJapaneseDate(record.recordedAt)}${
          record.kind === "installed" ? "（導入時）" : ""
        }`,
      });
      item.createEl("p", {
        text: `${record.statistics.noteCount}ノート・${record.statistics.linkCount}リンク・孤立ノート ${record.statistics.isolatedNoteCount}件`,
      });
      const colors = item.createDiv({ cls: "vault-aquarium-record-colors" });
      for (const [label, color] of [
        ["胴体・元白部分", record.appearance.bodyColor],
        ["模様", record.appearance.patternColor],
      ]) {
        const entry = colors.createSpan();
        const swatch = entry.createSpan({ cls: "vault-aquarium-color-swatch" });
        swatch.style.backgroundColor = color;
        entry.createSpan({ text: label });
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class RuleEditModal extends Modal {
  private draft: GraphColorRule;

  constructor(
    app: App,
    rule: GraphColorRule | null,
    private readonly onSubmit: (rule: GraphColorRule) => void,
  ) {
    super(app);
    this.draft = rule
      ? { ...rule }
      : {
          id: createId("rule"),
          name: "新しいグループ",
          query: "path:",
          color: "#5d8cff",
          enabled: true,
        };
  }

  onOpen(): void {
    this.contentEl.empty();
    this.setTitle("グラフ連動ルール");
    new Setting(this.contentEl)
      .setName("名前")
      .addText((text) =>
        text.setValue(this.draft.name).onChange((value) => {
          this.draft.name = value;
        }),
      );
    new Setting(this.contentEl)
      .setName("クエリ")
      .setDesc("例: path:開発 / tag:#TRPG / -path:アーカイブ")
      .addText((text) =>
        text.setValue(this.draft.query).onChange((value) => {
          this.draft.query = value;
        }),
      );
    new Setting(this.contentEl).setName("色").addColorPicker((picker) =>
      picker.setValue(this.draft.color).onChange((value) => {
        this.draft.color = value;
      }),
    );
    new Setting(this.contentEl).setName("有効").addToggle((toggle) =>
      toggle.setValue(this.draft.enabled).onChange((value) => {
        this.draft.enabled = value;
      }),
    );
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("保存")
        .setCta()
        .onClick(() => {
          if (!this.draft.name.trim() || !this.draft.query.trim()) return;
          this.onSubmit({
            ...this.draft,
            name: this.draft.name.trim(),
            query: this.draft.query.trim(),
          });
          this.close();
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
