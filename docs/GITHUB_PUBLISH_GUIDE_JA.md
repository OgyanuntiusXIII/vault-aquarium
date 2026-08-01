# GitHub公開ガイド（初めての方向け）

このガイドは、Vault AquariumをGitHubへ公開し、Obsidianへ申請する順番をまとめたものです。画面表示はGitHubの更新で多少変わる場合があります。

## 1. GitHubアカウントを作る

1. `https://github.com/signup` を開きます。
2. メールアドレス、パスワード、ユーザー名を入力します。
3. 届いたメールで認証します。
4. 作成したユーザー名 `OgyanuntiusXIII` を確認します。

## 2. 公開リポジトリを作る

1. GitHubへログインします。
2. 右上の `+` から `New repository` を選びます。
3. `Repository name` に `vault-aquarium` と入力します。
4. `Description` に「ヴォルトの情報構造をベタの姿に映すObsidianプラグイン」と入力します。
5. `Public` を選びます。
6. README、.gitignore、Licenseの自動追加は選ばず、`Create repository` を押します。

作成後のURLは `https://github.com/OgyanuntiusXIII/vault-aquarium` です。

## 3. ソースコードを登録する

このプロジェクトの「GitHubリポジトリ用ZIP」を解凍して使用します。`main.js` はソース側へ登録せず、GitHub Releaseだけへ添付します。

空のリポジトリができたら、Codexへ「できた」と伝えてください。ローカルGitの初期化、コミット、接続、アップロードを続けられます。

## 4. GitHub Releaseを作る

1. リポジトリ右側の `Releases` を開きます。
2. `Create a new release` を押します。
3. `Choose a tag` に `1.0.0` と入力し、新しいタグとして作成します。
4. タイトルを `Vault Aquarium 1.0.0` にします。
5. `docs/RELEASE_NOTES_1.0.0.md` の本文を貼り付けます。
6. 次の3ファイルを添付します。
   - `main.js`
   - `manifest.json`
   - `styles.css`
7. `Publish release` を押します。

## 5. Obsidianへ申請する

1. `https://community.obsidian.md` を開き、Obsidianアカウントでログインします。
2. プロフィールへGitHubアカウントを接続します。
3. 左側の `Plugins` から `New plugin` を選びます。
4. GitHubリポジトリのURLを入力します。
5. 開発者ポリシーと継続サポートの確認に同意します。
6. `Submit` を押します。

自動審査で指摘が出た場合は、内容をCodexへ貼り付ければ修正できます。

## 公式資料

- https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
- https://docs.obsidian.md/Developer%20policies
- https://docs.obsidian.md/Plugins/Releasing/Submission%20requirements%20for%20plugins
