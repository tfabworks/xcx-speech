# 会話 (Voice)
[Xcratch](https://xcratch.github.io/) 用の音声拡張機能です。

「**聞く**（音声認識）」「**訳す**（翻訳）」「**話す**（音声合成）」ができます。マイクの音声を聞き取って文字にし、日本語⇔英語に翻訳し、文字をいろいろな**キャラ声**（ふつう・ねずみ・ロボット・おばけ）で読み上げられます。声は**しゃべる速さ**と**声の高さ**の倍率でチューニングできます。

### ブロック

**聞く（音声認識）**

| ブロック | 説明 |
| --- | --- |
| `聞き取る` | マイクから聞き取りを始め、認識できるまで待ちます。 |
| `聞き取った音声` | 直近に認識した文字を返します。 |
| `[WORD] と聞こえた` | 認識結果に指定した言葉が含まれるかを返します。 |
| `マイクの感度を [LEVEL] にする` | 聞き取りの厳しさを切り替えます（`高い` / `ふつう` / `低い`、初期値：ふつう）。**まわりがうるさいときは `低い`** にすると、自信のある音声だけを採用して雑音を拾いにくくなります。 |
| `音声認識が使える` | この環境で認識が使えるかを返します。 |

**話す（音声合成）**

| ブロック | 説明 |
| --- | --- |
| `[TEXT] としゃべる` | 文字を読み上げ、終わるまで待ちます。 |
| `声を [PRESET] にする` | キャラ声を選びます（ふつう / ねずみ / ロボット / おばけ）。 |
| `しゃべる速さを [RATE] 倍にする` | プリセットに対する速さの倍率（1 = プリセットの標準）。 |
| `声の高さを [PITCH] 倍にする` | プリセットに対する高さの倍率（1 = プリセットの標準）。 |
| `話せる` | この環境で読み上げが使えるか（通信可能か）を返します。 |

**翻訳**

| ブロック | 説明 |
| --- | --- |
| `[TEXT] を [LANGUAGE] に翻訳する` | 文字を指定した言語に翻訳して返します（日本語⇔英語に最適化、原文の言語は自動判定）。 |
| `翻訳が使える` | この環境で翻訳が使えるか（通信可能か）を返します。 |

**言語・自動翻訳**

| ブロック | 説明 |
| --- | --- |
| `聞き取る言語を [LANGUAGE] にする` | 音声認識（聞き取り）の言語（初期値：日本語）。 |
| `しゃべる言語を [LANGUAGE] にする` | 読み上げ（話す）の言語（初期値：日本語）。 |
| `しゃべる時の翻訳を [ON/OFF] にする` | **ON** にすると、`しゃべる` のとき「**聞き取る言語 → しゃべる言語**」へ自動的に翻訳してから読み上げます（初期値：**OFF**）。 |

例：日本語で聞き取り、英語に翻訳して英語で話す（自動翻訳ON）
```
聞き取る言語を [日本語] にする
しゃべる言語を [英語] にする
しゃべる時の翻訳を [ON] にする
...
聞き取る
( 聞き取った音声 ) としゃべる      ← 自動で日本語→英語に翻訳して英語で読み上げ
```

> **メモ：** 音声認識はブラウザ上で動きます。Chromium系ブラウザ（Google Chrome / Microsoft Edge）を使い、マイクのアクセスを許可し、インターネットに接続してください（Chromeは音声をサーバーに送って認識します）。

> **読み上げ（話す）について：** 読み上げは **Scratch標準の音声合成サービス（Amazon Polly）** を使い、高品質・全端末で同じ声になります（英語なども自然で聞き取りやすい）。**インターネット接続が必要**で、**オフライン時は読み上げを行いません（無音）**。鳴らないと分かりにくいので、必要に応じて **`話せる`** ブロックで事前に判定してください（例：`話せる` でなければ文字で表示する）。

> **キャラ声について：** キャラ声プリセットは、**音声の再生速度（playbackRate）で高さと速さを同時に変化**させて表現します。この方式は**Mac・iPad・Chromebook を含むどの端末でも同じように効きます**（端末による差はありません）。`しゃべる速さ` `声の高さ` のブロックも、この再生速度に反映されます。

> **翻訳について（重要）：** 翻訳には無料の [MyMemory](https://mymemory.translated.net/) API（APIキー不要）を使用しています。**ネット接続が必要**です。MyMemory には **1日あたりの無料利用上限（IP単位）** があり、本拡張ではメールアドレスを設定済みのため約 50,000 語/日まで利用できます。**学校などでは複数の端末が同じIPになる（NAT）ため、使いすぎると上限に達して翻訳できなくなる**ことがあります。上限を超えると `翻訳する` ブロックは空文字を返します。さらに上限を引き上げたい場合は、有料キーや自前プロキシへの差し替えも可能です。


## ✨ この拡張機能でできること

[サンプルプロジェクト](https://xcratch.github.io/editor/#https://asondemita.github.io/xcx-voice/projects/example.sb3) を開くと、「会話(Voice)」拡張機能でできることを確認できます。
<iframe src="https://xcratch.github.io/editor/player#https://asondemita.github.io/xcx-voice/projects/example.sb3" width="540px" height="460px"></iframe>


## Xcratch での使い方

この拡張機能は [Xcratch](https://xcratch.github.io/) で他の拡張機能と一緒に使えます。
1. [Xcratch エディター](https://xcratch.github.io/editor) を開く
2. 「拡張機能を追加」ボタンをクリック
3. 「Extension Loader」拡張機能を選ぶ
4. 入力欄にモジュールURLを入力する
   ```
   https://asondemita.github.io/xcx-voice/dist/voice.mjs
   ```
5. 「OK」ボタンをクリック
6. これでこの拡張機能のブロックが使えます


## 開発

### 依存パッケージのインストール

```sh
npm install
```

### 開発環境のセットアップ

`./scripts/setup-dev.js` 内の `vmSrcOrg` をローカルの `scratch-vm` ディレクトリに変更してから、setup-dev スクリプトを実行して開発環境を準備します。

```sh
npm run setup-dev
```

### APM 経由での xcratch-skills のインストール

[APM (Agent Package Manager)](https://github.com/microsoft/apm) をインストールして、次を実行します。

```sh
apm install --target copilot
```

これでエージェント各クライアントにスキルが自動設定されます。インストール後は、次のような自然言語のトリガーフレーズが使えます。

| トリガーフレーズ | 呼び出されるスキル |
|---|---|
| `xcratch-create`, `scaffold extension` | `xcratch-extension-create` — 新しい拡張機能リポジトリを作成し開発環境を準備 |
| `breakpoints not hit`, `debug on dev-server` | `xcratch-extension-debug` — ソースマップやローカルHTTPSの問題を修正 |
| `verify extension loads`, `check console errors` | `xcratch-extension-debug-auto` — エディターを自動操作して読み込んだ拡張機能を検査 |
| `add to stretch3`, `stretch3-install` | `xcratch-extension-stretch3` — stretch3 用のインストールスクリプトとエントリーファイルを生成 |

### モジュールへのバンドル

ビルドスクリプトを実行して、Xcratch で読み込めるモジュールファイルにこの拡張機能をバンドルします。

```sh
npm run build
```

### 監視してバンドル

watch スクリプトを実行すると、ソースファイルの変更を監視して自動でバンドルします。

```sh
npm run watch
```

### テスト

test スクリプトを実行してこの拡張機能をテストします。

```sh
npm run test
```

### バージョン管理とデプロイ

このプロジェクトは npm version コマンドと GitHub Actions を使ってバージョン管理とデプロイを行います。

#### 新しいバージョンを作成する

npm version コマンドでバージョン番号を更新します。これにより自動的に次のことが行われます。
1. `package.json` のバージョンを更新
2. ビルドスクリプトを実行
3. `dist/{version}/` にバージョン別のビルドファイルを作成
4. `dist/versions.json` を新しいバージョン情報で更新
5. git のコミットとタグを作成

```sh
# パッチバージョン (1.3.0 → 1.3.1)
npm version patch

# マイナーバージョン (1.3.1 → 1.4.0)
npm version minor

# メジャーバージョン (1.4.0 → 2.0.0)
npm version major
```

#### GitHub Pages へのデプロイ

新しいバージョンを作成したら、タグをプッシュすると自動デプロイが始まります。

```sh
# バージョンタグをプッシュ
git push origin v1.4.0

# またはすべてのタグをプッシュ
git push --tags
```

GitHub Actions のワークフローは次を行います。
1. 拡張機能をビルド
2. `dist/`、`projects/`、`README.md` を GitHub Pages にデプロイ

GitHub の Actions タブから手動でデプロイを実行することもできます。

#### バージョン情報

すべてのビルドバージョンは `dist/versions.json` に記録されます。

```json
{
  "extensionId": "voice",
  "latest": "1.0.0",
  "versions": [
    {
      "version": "1.0.0",
      "buildDate": "2025-10-19T12:34:56.789Z",
      "module": "1.0.0/voice.mjs"
    }
  ]
}
```


## 🏠 ホームページ

このページは [https://asondemita.github.io/xcx-voice/](https://asondemita.github.io/xcx-voice/) から開けます。


## 🤝 コントリビュート

コントリビュート、Issue、機能リクエストを歓迎します！<br />[Issueページ](https://github.com/asondemita/xcx-voice/issues) もぜひご覧ください。
