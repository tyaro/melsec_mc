IMPORTANT: The public crate distributed on crates.io is the root `melsec_mc` in this repository (the top-level `Cargo.toml` + `src/`). The previous `melsec_mc_public/` snapshot has been removed to avoid confusion — please use the root crate for publishing and consumption.

[![crates.io](https://img.shields.io/crates/v/melsec_mc.svg)](https://crates.io/crates/melsec_mc) [![docs.rs](https://docs.rs/melsec_mc/badge.svg)](https://docs.rs/melsec_mc) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Publish Workflow](https://github.com/tyaro/melsec_com/actions/workflows/publish.yml/badge.svg)](https://github.com/tyaro/melsec_com/actions/workflows/publish.yml)

# melsec_mc

軽量な Rust ライブラリで、三菱電機 PLC の MC プロトコル（Ethernet / MC4E に相当）への送受信と簡易クライアントを提供します。

## 特徴

- Tokio ベースの非同期トランスポート
- MC フレームの送受信とパーサ
- 再利用可能な `McClient` と型付き読み書きのサポート（`FromWords` / `ToWords`）

## ドキュメントと公開

- crates.io: https://crates.io/crates/melsec_mc
- docs.rs: https://docs.rs/melsec_mc

## クイックスタート

1. リポジトリをクローンしてビルドします:

```powershell
git clone https://github.com/tyaro/melsec_com.git
cd melsec_com
cargo build
```

2. サンプルを実行します（`examples` を参照して PLC アドレスを設定してください）:

```powershell
cargo run --example simple
```

## インストール

crates.io から利用する場合、`Cargo.toml` に追加してください:

```toml
[dependencies]
melsec_mc = "^0.4"
```

開発中にリポジトリから直接参照する場合:

```toml
[dependencies]
melsec_mc = { git = "https://github.com/tyaro/melsec_com", branch = "main" }
```

## 使い方（簡単な例）

```rust
use melsec_mc::{McClient, ConnectionTarget};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let target = ConnectionTarget::direct("192.168.1.40", 4020);
    let client = McClient::new()
        .with_target(target)
        .with_mc_format(melsec_mc::mc_define::McFrameFormat::MC4E);

    // 例: ビット読み出し（M100 から 10 ビット）
    let bits = client.read_bits("M100", 10).await?;
    println!("bits: {:?}", bits);

    Ok(())
}
```

## 貢献

- プルリクエスト歓迎です。大きな API 変更は事前に Issue で相談してください。
- バグ報告や機能要望は GitHub Issues を利用してください。

## ライセンス

MIT

---
