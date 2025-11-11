# Tauri + Vanilla

フロントエンドは typecript で記述しているので事前にビルドが必要です。

```bash
cd melsec_mc_mock_gui
npm install
npm run build
cd ..
```

## build 時の注意

MELSEC MC Rust クレートのビルド成果物（バイナリやライブラリ）は `target` ディレクトリに出力されます。
この `target` ディレクトリはプロジェクトごとに生成され、多くのファイルが含まれるため、Git リポジトリに含めるべきではありません。
そのため、`.gitignore` ファイルに `target/` を追加して、Git がこのディレクトリを無視するように設定しています。
もし、既にリポジトリに `target` ディレクトリが含まれている場合は、以下の手順で対応してください。

1. **Git のキャッシュから `target` ディレクトリを削除**:

    ```bash
    git rm -r --cached --ignore-unmatch melsec_mc_mock/target
    ```

2. **`.gitignore` ファイルを更新**:

    ```plaintext
    target/
    ```

3. **変更をコミット**:
  
    ```bash
    git add .gitignore
    git commit -m "Stop tracking melsec_mc_mock/target and update .gitignore"
    ```

これにより、今後 `target` ディレクトリが Git によって追跡されなくなります。
