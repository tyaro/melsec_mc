このリポジトリは下記の構成となります


- `melsec_mc` : 三菱電機の MC プロトコル（MC プロトコル3E/MC プロトコル4E）を扱う Rust ライブラリのコア部分
- `melsec_mc_mock` : `melsec_mc` を使った MC プロトコルのモックサーバー実装(PLC実機の代わり)
- `melsec_mc_mock_gui` : `melsec_mc_mock` の状態を GUI で操作するためのアプリケーション
  