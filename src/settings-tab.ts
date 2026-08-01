import { Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultAquariumPlugin from "../main";
import type { GraphColorRule } from "./types";
import { GrowthRecordsModal, RuleEditModal } from "./dialogs";

export class VaultAquariumSettingTab extends PluginSettingTab {
  constructor(private readonly aquariumPlugin: VaultAquariumPlugin) {
    super(aquariumPlugin.app, aquariumPlugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.aquariumPlugin.data.settings;
    containerEl.empty();
    new Setting(containerEl).setName("ヴォルト水槽").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "魚の色は手動指定せず、下のグラフ連動ルールとヴォルト構成から自動で決まります。ノート本文を解析したり外部へ送信したりしません。",
    });

    new Setting(containerEl)
      .setName("魚を表示する")
      .setDesc("Markdownノートを開いているとき、ベタを重ねて表示します。")
      .addToggle((toggle) =>
        toggle.setValue(settings.showFish).onChange(async (value) => {
          settings.showFish = value;
          await this.aquariumPlugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("魚の名前")
      .addText((text) =>
        text.setValue(settings.fishName).onChange(async (value) => {
          settings.fishName = value.trim() || "あなたのベタ";
          await this.aquariumPlugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("魚のサイズ")
      .setDesc(`${settings.fishSize}px`)
      .addSlider((slider) =>
        slider
          .setLimits(35, 300, 1)
          .setDynamicTooltip()
          .setValue(settings.fishSize)
          .onChange(async (value) => {
            settings.fishSize = value;
            await this.aquariumPlugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("魚の移動速度")
      .setDesc(`${settings.swimSpeed}px/秒`)
      .addSlider((slider) =>
        slider
          .setLimits(4, 36, 1)
          .setDynamicTooltip()
          .setValue(settings.swimSpeed)
          .onChange(async (value) => {
            settings.swimSpeed = value;
            await this.aquariumPlugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("透明度")
      .setDesc(`${Math.round(settings.opacity * 100)}%`)
      .addSlider((slider) =>
        slider
          .setLimits(0.2, 1, 0.05)
          .setDynamicTooltip()
          .setValue(settings.opacity)
          .onChange(async (value) => {
            settings.opacity = value;
            await this.aquariumPlugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName("グラフ連動ルール").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "上のルールほど優先され、ノートは最初に一致した1グループへ入ります。対応クエリ: path:、tag:、file:、extension:、先頭の - による除外。",
    });

    new Setting(containerEl)
      .setName("グラフビュー設定を取り込む")
      .setDesc(
        "graph.jsonの色グループを同期します。全グループを集計し、一致数の上位2色だけを魚へ反映します。",
      )
      .addButton((button) =>
        button.setButtonText("取り込む").onClick(async () => {
          button.setDisabled(true);
          await this.aquariumPlugin.importGraphColorGroups();
          this.display();
        }),
      );

    const ruleContainer = containerEl.createDiv({
      cls: "vault-aquarium-rule-list",
    });
    settings.rules.forEach((rule, index) =>
      this.renderRule(ruleContainer, rule, index),
    );

    new Setting(containerEl).addButton((button) =>
      button.setButtonText("ルールを追加").setCta().onClick(() => {
        new RuleEditModal(this.app, null, (rule) => {
          settings.rules.push(rule);
          void this.aquariumPlugin.saveSettings().then(() => {
            this.display();
            void this.aquariumPlugin.reanalyzeNow();
          });
        }).open();
      }),
    );

    new Setting(containerEl).setName("解析と成長記録").setHeading();
    new Setting(containerEl)
      .setName("今すぐ再解析")
      .setDesc("現在のルールでノートとリンク構造を集計します。")
      .addButton((button) =>
        button.setButtonText("再解析").onClick(async () => {
          await this.aquariumPlugin.reanalyzeNow();
          new Notice("ヴォルト水槽: 再解析しました");
        }),
      );

    new Setting(containerEl)
      .setName("成長記録を表示")
      .setDesc(`${this.aquariumPlugin.data.growthRecords.length}件の記録`)
      .addButton((button) =>
        button.setButtonText("表示").onClick(() => {
          new GrowthRecordsModal(
            this.app,
            this.aquariumPlugin.data.growthRecords,
          ).open();
        }),
      );

    new Setting(containerEl)
      .setName("成長記録をエクスポート")
      .setDesc("保存済み記録と現在の設定をJSONでダウンロードします。")
      .addButton((button) =>
        button.setButtonText("JSONを書き出す").onClick(() => {
          this.aquariumPlugin.exportGrowthRecords();
        }),
      );
  }

  private renderRule(
    parent: HTMLElement,
    rule: GraphColorRule,
    index: number,
  ): void {
    const settings = this.aquariumPlugin.data.settings;
    const setting = new Setting(parent)
      .setName(`${index + 1}. ${rule.name}${rule.enabled ? "" : "（無効）"}`)
      .setDesc(rule.query);
    const swatch = setting.nameEl.createSpan({
      cls: "vault-aquarium-rule-swatch",
    });
    swatch.style.backgroundColor = rule.color;

    setting.addExtraButton((button) =>
      button
        .setIcon("arrow-up")
        .setTooltip("優先順位を上げる")
        .setDisabled(index === 0)
        .onClick(async () => {
          [settings.rules[index - 1], settings.rules[index]] = [
            settings.rules[index],
            settings.rules[index - 1],
          ];
          await this.aquariumPlugin.saveSettings();
          this.display();
          await this.aquariumPlugin.reanalyzeNow();
        }),
    );
    setting.addExtraButton((button) =>
      button
        .setIcon("arrow-down")
        .setTooltip("優先順位を下げる")
        .setDisabled(index === settings.rules.length - 1)
        .onClick(async () => {
          [settings.rules[index], settings.rules[index + 1]] = [
            settings.rules[index + 1],
            settings.rules[index],
          ];
          await this.aquariumPlugin.saveSettings();
          this.display();
          await this.aquariumPlugin.reanalyzeNow();
        }),
    );
    setting.addExtraButton((button) =>
      button.setIcon("pencil").setTooltip("編集").onClick(() => {
        new RuleEditModal(this.app, rule, (updated) => {
          settings.rules[index] = updated;
          void this.aquariumPlugin.saveSettings().then(() => {
            this.display();
            void this.aquariumPlugin.reanalyzeNow();
          });
        }).open();
      }),
    );
    setting.addExtraButton((button) =>
      button.setIcon("trash-2").setTooltip("削除").onClick(async () => {
        settings.rules.splice(index, 1);
        await this.aquariumPlugin.saveSettings();
        this.display();
        await this.aquariumPlugin.reanalyzeNow();
      }),
    );
  }
}
