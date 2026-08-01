import { Notice, Plugin } from "obsidian";
import { AppearanceGenerator } from "./src/appearance-generator";
import { mergeData } from "./src/defaults";
import { FishInfoPopover } from "./src/dialogs";
import { BETTA_ASSET_URLS } from "./src/fish-assets";
import { FishRenderer } from "./src/fish-renderer";
import { GraphConfigImporter } from "./src/graph-config-importer";
import { GrowthRecorder } from "./src/growth-recorder";
import { VaultAquariumSettingTab } from "./src/settings-tab";
import type { FishAppearance, VaultAquariumData } from "./src/types";
import { lerpAppearance } from "./src/utils";
import { RuleBasedVaultAnalyzer } from "./src/vault-analyzer";

const APPEARANCE_TIME_CONSTANT_MS = 6 * 60 * 60 * 1000;
const ANALYSIS_DEBOUNCE_MS = 1500;
const LEGACY_SAMPLE_RULE_IDS = new Set([
  "sample-path-development",
  "sample-tag-trpg",
]);

export default class VaultAquariumPlugin extends Plugin {
  data!: VaultAquariumData;
  private analyzer!: RuleBasedVaultAnalyzer;
  private graphConfigImporter!: GraphConfigImporter;
  private readonly appearanceGenerator = new AppearanceGenerator();
  private readonly growthRecorder = new GrowthRecorder();
  private renderer: FishRenderer | null = null;
  private readonly infoPopover = new FishInfoPopover();
  private analysisTimer: number | null = null;
  private saveInProgress = false;

  async onload(): Promise<void> {
    this.data = mergeData(await this.loadData());
    this.advanceAppearanceForClosedTime();
    this.analyzer = new RuleBasedVaultAnalyzer(this.app);
    this.graphConfigImporter = new GraphConfigImporter(this.app);
    await this.importGraphRulesForInitialSetup();
    this.addSettingTab(new VaultAquariumSettingTab(this));

    this.app.workspace.onLayoutReady(() => {
      void this.initializeRenderer();
      void this.reanalyzeNow();
    });

    this.registerEvent(
      this.app.vault.on("create", () => this.scheduleAnalysis()),
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.scheduleAnalysis()),
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.scheduleAnalysis()),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.scheduleAnalysis()),
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.scheduleAnalysis()),
    );
    this.registerInterval(
      window.setInterval(() => {
        void this.persistRuntimeState();
        void this.recordMonthlyGrowthIfDue();
      }, 60_000),
    );
  }

  onunload(): void {
    if (this.analysisTimer !== null) window.clearTimeout(this.analysisTimer);
    if (this.renderer) {
      this.data.currentAppearance = this.renderer.getCurrentAppearance();
    }
    this.data.appearanceUpdatedAt = new Date().toISOString();
    void this.saveData(this.data);
    this.renderer?.destroy();
    this.renderer = null;
    this.infoPopover.close();
  }

  async saveSettings(): Promise<void> {
    this.renderer?.applySettings(this.data.settings);
    await this.saveData(this.data);
  }

  async reanalyzeNow(): Promise<void> {
    if (this.analysisTimer !== null) {
      window.clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }

    const statistics = this.analyzer.analyze(this.data.settings.rules);
    const target = this.appearanceGenerator.generate(statistics);
    const isInstallationRecord =
      this.data.latestStatistics === null && this.data.growthRecords.length === 0;

    this.data.latestStatistics = statistics;
    this.data.targetAppearance = target;
    if (isInstallationRecord) {
      // 初回だけは任意の初期色から変化させず、導入時の解析結果を現在形にする。
      this.data.currentAppearance = target;
      this.data.appearanceUpdatedAt = new Date().toISOString();
      this.renderer?.setCurrentAppearance(target);
      this.data.growthRecords.push(
        this.growthRecorder.createRecord("installed", target, statistics),
      );
    }
    this.renderer?.setTargetAppearance(target);
    await this.recordMonthlyGrowthIfDue();
    await this.saveData(this.data);
  }

  async importGraphColorGroups(): Promise<boolean> {
    try {
      const rules = await this.graphConfigImporter.loadRules();
      if (rules.length === 0) {
        new Notice("ヴォルト水槽: グラフの色グループが見つかりませんでした");
        return false;
      }
      this.data.settings.rules = rules;
      await this.reanalyzeNow();
      // ルールの明示的な再取り込みはノートの成長変化ではないため、目標色を即時反映する。
      this.data.currentAppearance = {
        ...this.data.targetAppearance,
        accentColors: [...this.data.targetAppearance.accentColors],
      };
      this.data.appearanceUpdatedAt = new Date().toISOString();
      this.renderer?.setCurrentAppearance(this.data.currentAppearance);
      await this.saveData(this.data);
      new Notice(
        `ヴォルト水槽: ${rules.length}グループを取り込み、上位2色を魚へ反映しました`,
      );
      return true;
    } catch (error) {
      console.error("Vault Aquarium: graph.jsonの取り込みに失敗しました", error);
      new Notice(
        "ヴォルト水槽: グラフ設定を読めませんでした。手入力ルールは変更していません",
      );
      return false;
    }
  }

  exportGrowthRecords(): void {
    const payload = {
      plugin: this.manifest.id,
      exportedAt: new Date().toISOString(),
      installedAt: this.data.installedAt,
      settings: this.data.settings,
      currentAppearance:
        this.renderer?.getCurrentAppearance() ?? this.data.currentAppearance,
      targetAppearance: this.data.targetAppearance,
      latestStatistics: this.data.latestStatistics,
      growthRecords: this.data.growthRecords,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `vault-aquarium-growth-${date}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    new Notice("ヴォルト水槽: 成長記録を書き出しました");
  }

  private async initializeRenderer(): Promise<void> {
    this.renderer = new FishRenderer(
      BETTA_ASSET_URLS,
      this.data.settings,
      this.data.currentAppearance,
      this.data.targetAppearance,
      () => this.infoPopover.close(),
      (anchor) => {
        this.infoPopover.open(
          anchor,
          this.data.settings.fishName,
          this.renderer?.getCurrentAppearance() ?? this.data.currentAppearance,
          this.data.latestStatistics,
          this.data.growthRecords,
        );
      },
      () => {
        this.data.settings.showFish = false;
        void this.saveSettings();
        new Notice("ヴォルト水槽: 魚を隠しました。設定から再表示できます");
      },
      (appearance) => {
        this.data.currentAppearance = appearance;
        this.data.appearanceUpdatedAt = new Date().toISOString();
      },
    );
  }

  private async importGraphRulesForInitialSetup(): Promise<void> {
    const currentRules = this.data.settings.rules;
    const isLegacySample =
      currentRules.length === LEGACY_SAMPLE_RULE_IDS.size &&
      currentRules.every((rule) => LEGACY_SAMPLE_RULE_IDS.has(rule.id));
    if (currentRules.length > 0 && !isLegacySample) return;

    try {
      const graphRules = await this.graphConfigImporter.loadRules();
      if (graphRules.length === 0) return;
      this.data.settings.rules = graphRules;
      if (isLegacySample) {
        // ダミールール由来の色だけは成長変化ではないため、実グラフの姿へ一度だけ補正する。
        const statistics = this.analyzer.analyze(graphRules);
        const appearance = this.appearanceGenerator.generate(statistics);
        this.data.latestStatistics = statistics;
        this.data.currentAppearance = appearance;
        this.data.targetAppearance = appearance;
        this.data.appearanceUpdatedAt = new Date().toISOString();
      }
      await this.saveData(this.data);
    } catch (error) {
      // 内部ファイルが存在しない・形式が変わった場合は、設定画面の手入力へフォールバックする。
      console.warn("Vault Aquarium: graph.jsonの自動取り込みを省略しました", error);
    }
  }

  private scheduleAnalysis(): void {
    if (this.analysisTimer !== null) window.clearTimeout(this.analysisTimer);
    this.analysisTimer = window.setTimeout(() => {
      this.analysisTimer = null;
      void this.reanalyzeNow();
    }, ANALYSIS_DEBOUNCE_MS);
  }

  private advanceAppearanceForClosedTime(): void {
    const elapsed = Math.max(
      0,
      Date.now() - new Date(this.data.appearanceUpdatedAt).getTime(),
    );
    const amount = 1 - Math.exp(-elapsed / APPEARANCE_TIME_CONSTANT_MS);
    this.data.currentAppearance = lerpAppearance(
      this.data.currentAppearance,
      this.data.targetAppearance,
      amount,
    );
    this.data.appearanceUpdatedAt = new Date().toISOString();
  }

  private async persistRuntimeState(): Promise<void> {
    if (this.saveInProgress) return;
    this.saveInProgress = true;
    try {
      if (this.renderer) {
        this.data.currentAppearance = this.renderer.getCurrentAppearance();
      }
      this.data.appearanceUpdatedAt = new Date().toISOString();
      await this.saveData(this.data);
    } finally {
      this.saveInProgress = false;
    }
  }

  private async recordMonthlyGrowthIfDue(): Promise<void> {
    const statistics = this.data.latestStatistics;
    if (
      !statistics ||
      !this.growthRecorder.isMonthlyRecordDue(this.data.growthRecords)
    ) {
      return;
    }
    const appearance: FishAppearance =
      this.renderer?.getCurrentAppearance() ?? this.data.currentAppearance;
    this.data.growthRecords.push(
      this.growthRecorder.createRecord("monthly", appearance, statistics),
    );
    await this.saveData(this.data);
  }
}
