# melsec_mc_mock（モック PLC サーバー）

このドキュメントは `melsec_mc_mock` クレートの使い方・目的・実装ノートを日本語でまとめたものです。PLC 実機が無い環境で `melsec_mc` クライアントの `read_words` / `read_bits` / `write_words` / `write_bits` 相当の動作を確認するために使えます。

## 何ができるか

- ローカルで TCP による MC4E 相当の接続を受け、妥当なプロトコル応答を返します。
- プログラムから `DeviceMap` を操作してテスト用のデータを注入できます（`set_words` / `get_words`）。
- `melsec_mc` の `CommandRegistry` が利用可能なら、コマンド仕様に基づくレスポンス構築を行います。

## すぐ試す（クイックスタート）

PowerShell から (リポジトリルート):

1) モックサーバーを起動（デフォルトは 127.0.0.1:5000）

```powershell
cargo run -p melsec_mc_mock --bin mock-server -- --listen 127.0.0.1:5000
```

2) 別のターミナルで既存の example を実行（`examples/simple.rs` など）

```powershell
cargo run --example simple
```

`examples/simple.rs` はデフォルトで 127.0.0.1:5000 を使うので、上の手順でモックに接続して動作を確認できます。

## テスト内で使う（サンプル）

テストコードから直接モックを立ち上げ、状態をセットしてクライアントが正しい値を取得できるか確認する例です。

```rust
use melsec_mc_mock::MockServer;
use melsec_mc::init_defaults;
use melsec_mc::endpoint::ConnectionTarget;
use melsec_mc::mc_client::McClient;

#[tokio::test]
async fn integration_read_words() -> anyhow::Result<()> {
    init_defaults()?;

    let server = MockServer::new();
    server.set_words("D", 0, &[0x1234u16, 0x5678u16]).await;

    // バックグラウンドでリスナーを起動
    let listen = "127.0.0.1:5000".to_string();
    let srv = server.clone();
    tokio::spawn(async move {
        let _ = srv.run_listener(&listen).await;
    });

    // クライアント
    let target = ConnectionTarget::direct("127.0.0.1".into(), 5000);
    let client = McClient::new().with_target(target).with_monitoring_timer(3);

    let res = client.read_words("D", 0, 1).await?;
    assert_eq!(res, vec![0x1234u16]);

    Ok(())
}
```

実行環境によっては起動の順序やポート競合で失敗する場合があります。必要に応じて待機やリトライを入れてください。

## 生のバイト列を投げる（簡易デバッグ）

Python 等を使って生の MC4E 相当のバイト列を送ってレスポンスを得る例。

```python
import socket
sock = socket.create_connection(("127.0.0.1", 5000))
# MC4E 形式のリクエストを hex で指定
req = bytes.fromhex("4D4D...")
sock.send(req)
resp = sock.recv(4096)
print(resp.hex())
sock.close()
```

## 実装のポイント

- `MockServer` (`melsec_mc_mock::MockServer`)
  - `store: Arc<RwLock<DeviceMap>>` を保持
  - `set_words(&self, key: &str, addr: usize, words: &[Word])` / `get_words` を提供
  - `run_listener(&self, bind: &str)` で TCP リスナーを起動
- `device_map.rs` はメモリマップ型の簡易ストレージで、デバイス名（"D" 等）や `0xA8` 形式でアクセス可能
- `handler.rs` に MC のリクエストパースと `DeviceMap` の適用、レスポンス生成ロジックが集約されています

## ログとデバッグ

- 詳細ログが必要な場合は環境変数で `RUST_LOG=debug` を付けて起動してください。
- `melsec_mc` 側のパーサ／フレーム検出のログ（例: STREAM PARSER DEBUG）も参考になります。

## 拡張案（今後）

- HTTP や IPC 経由で DeviceMap を外部から操作できる管理 API
- シナリオ定義（YAML/JSON）で応答シーケンスを定義する仕組み
- より多くの統合テスト（失敗ケース、部分受信、断続接続）

---

改善してほしい点、追加したいサンプルがあれば教えてください。
