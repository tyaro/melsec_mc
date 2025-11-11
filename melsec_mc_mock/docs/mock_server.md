# Mock server (melsec_mc_mock)

This document describes the minimal mock PLC server included in the workspace.

Overview

- The mock server provides a programmatic `DeviceMap` (word storage keyed by device name) and
  a simple TCP listener placeholder.

- The implementation is intentionally minimal; the next steps are wiring the existing
  `melsec_mc` parser/response builders to accept MC payloads and return protocol-correct replies.

Quick start

```bash
cargo run -p melsec_mc_mock --bin mock-server -- --listen 127.0.0.1:5000
```

Programmatic API (tests)

- `melsec_mc_mock::MockServer::new()`
- `set_words(&self, key: &str, addr: usize, words: &[u16])`
- `get_words(&self, key: &str, addr: usize, count: usize) -> Vec<u16>`

Admin HTTP API

The admin HTTP API has been removed from the mock server. Use the programmatic
`MockServer` API (`set_words` / `get_words`) or the UDP/TCP interfaces for
interacting with the mock server. If you relied on the admin endpoints in CI
scripts, update those scripts to use the provided programmatic APIs or send
MC frames directly to the mock server.
