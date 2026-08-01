# Vault Aquarium / ヴォルト水槽

Vault Aquarium adds one gently swimming betta fish to Obsidian. Its body, fins, and pattern colors reflect the color-group structure of your vault, turning changes in your notes and links into a slowly evolving appearance.

## Features

- Shows one animated betta fish over the Obsidian workspace.
- Uses the leading graph color groups for the fish body, fins, and patterns.
- Smoothly interpolates appearance changes instead of switching colors immediately.
- Supports clicking, quick swimming, dragging, hiding, and a status popover.
- Saves local monthly growth records with note, link, and color-group statistics.
- Provides Japanese settings for size, speed, opacity, visibility, and graph rules.

## Privacy

Vault Aquarium does not analyze the meaning of note contents and does not send vault data to external services. Settings and growth records stay in the vault as Obsidian plugin data.

## Usage and limitations

Enable the plugin, then open **Settings → Vault Aquarium**. The plugin attempts to read graph color groups from `.obsidian/graph.json`. Because Obsidian does not currently expose graph color groups through a stable public API, compatible manual rules such as `path:Development` and `tag:#TRPG` are also supported.

## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release and place them in:

```text
<vault>/.obsidian/plugins/vault-aquarium/
```

Restart Obsidian, then enable **Vault Aquarium** under Community plugins.

## 日本語

Vault Aquariumは、ヴォルトの色グループ構成を一匹のベタの姿に反映するObsidianプラグインです。魚は画面上をゆっくり泳ぎ、ノートやリンクの変化に合わせて体色・ヒレ色・模様が少しずつ変化します。

- 魚をクリックすると素早く泳ぎ、ステータス・非表示メニューを開きます。
- ドラッグで好きな位置へ移動できます。
- ノート本文の意味解析や外部送信は行いません。
- グラフ色グループを公開APIから直接取得できないため、`.obsidian/graph.json`の読み取りと手動ルールを併用します。

## Development

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

The release `main.js` embeds the fish PNG assets as data URLs.

## Author and license

[Ogyanuntius XIII](https://github.com/OgyanuntiusXIII) · [MIT License](LICENSE)
