"use strict";
(() => {
  // src/components/monitor.ts
  var invoke = window && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke ? window.__TAURI__.core.invoke.bind(window.__TAURI__.core) : async () => {
    throw new Error("Tauri invoke not available in test environment");
  };
  var latestWords = {};
  var currentFormatInternal = "U16";
  function getCurrentFormat() {
    return currentFormatInternal;
  }
  function setCurrentFormat(fmt) {
    currentFormatInternal = fmt;
    refreshAllRows();
    try {
      if (window.localStorage) window.localStorage.setItem("displayFormat", currentFormatInternal);
    } catch (e) {
    }
  }
  function refreshAllRows() {
    for (const k in latestWords) {
      const [key, addrStr] = k.split(":");
      const addr = parseInt(addrStr, 10);
      const w = latestWords[k];
      renderRowForWord(key, addr, w);
    }
    if (["U32", "I32", "F32"].includes(currentFormatInternal)) {
      for (const k in latestWords) {
        const [key, addrStr] = k.split(":");
        const addr = parseInt(addrStr, 10);
        if (addr % 2 === 0) {
          const trOdd = document.getElementById(`row-${key}-${addr + 1}`);
          if (trOdd) trOdd.classList.add("paired-empty");
        }
      }
    } else {
      document.querySelectorAll("#monitor-tbody tr.paired-empty").forEach((r) => r.classList.remove("paired-empty"));
    }
  }
  function uiLog(msg) {
    try {
      const out = document.getElementById("monitor-log");
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      if (out) out.textContent = `${ts} ${msg}
` + out.textContent;
      else console.log("[MON]", ts, msg);
    } catch (e) {
      try {
        console.log("[MON]", msg, e);
      } catch (_) {
      }
    }
  }
  function parseTarget(s) {
    if (!s) return null;
    const up = s.toUpperCase().trim();
    let i = 0;
    while (i < up.length && /[A-Z]/.test(up[i])) i++;
    if (i === 0) return null;
    let key = up.slice(0, i);
    let numPart = up.slice(i).trim();
    if (!numPart && key.length > 1) {
      numPart = key.slice(1);
      key = key[0];
    }
    if (!numPart) return null;
    const isHex = /[A-F]/i.test(numPart);
    const addr = isHex ? parseInt(numPart, 16) : parseInt(numPart, 10);
    if (Number.isNaN(addr)) return null;
    return { key, addr };
  }
  function setWordRow(key, addr, word) {
    try {
      latestWords[`${key}:${addr}`] = word & 65535;
      renderRowForWord(key, addr, word & 65535);
      if (["U32", "I32", "F32"].includes(currentFormatInternal)) {
        if (addr % 2 === 1) {
          const evenAddr = addr - 1;
          const evenKey = `${key}:${evenAddr}`;
          if (latestWords[evenKey] !== void 0) renderRowForWord(key, evenAddr, latestWords[evenKey]);
        } else {
          const oddKey = `${key}:${addr + 1}`;
          if (latestWords[oddKey] !== void 0) renderRowForWord(key, addr + 1, latestWords[oddKey]);
        }
      }
    } catch (err) {
      console.warn("setWordRow failed", err);
    }
  }
  function renderRowForWord(key, addr, word) {
    try {
      const tbody = document.getElementById("monitor-tbody");
      if (!tbody) return;
      const rowId = `row-${key}-${addr}`;
      let tr = document.getElementById(rowId);
      if (!tr) {
        tr = document.createElement("tr");
        tr.id = rowId;
        const tdLabel = document.createElement("td");
        tdLabel.className = "device-label";
        tdLabel.textContent = `${key}${addr}`;
        tr.appendChild(tdLabel);
        for (let b = 15; b >= 0; b--) {
          const td = document.createElement("td");
          td.className = "bit-cell bit-off";
          td.dataset.bitIndex = b.toString();
          tr.appendChild(td);
        }
        const tdFormat = document.createElement("td");
        tdFormat.className = "format-cell";
        tr.appendChild(tdFormat);
        const tdRaw = document.createElement("td");
        tdRaw.className = "raw-cell";
        tr.appendChild(tdRaw);
        tbody.appendChild(tr);
        tr.addEventListener("click", () => {
          try {
            selectRow(key, addr);
          } catch (e) {
          }
        });
      }
      const bitCells = tr.querySelectorAll("td.bit-cell");
      if (!bitCells || bitCells.length < 16) return;
      for (let i = 0; i < 16; i++) {
        const b = 15 - i;
        const on = (word >> b & 1) === 1;
        const cell = bitCells[i];
        if (cell) {
          if (on) {
            cell.classList.remove("bit-off");
            cell.classList.add("bit-on");
          } else {
            cell.classList.remove("bit-on");
            cell.classList.add("bit-off");
          }
        }
      }
      const formatCell = tr.querySelector("td.format-cell");
      const rawCell = tr.querySelector("td.raw-cell");
      const u16 = word & 65535;
      const hex = `0x${u16.toString(16).toUpperCase().padStart(4, "0")}`;
      let s16 = u16;
      if ((u16 & 32768) !== 0) s16 = u16 - 65536;
      tr.classList.remove("paired-empty");
      if (["U32", "I32", "F32"].includes(currentFormatInternal)) {
        if (addr % 2 === 0) {
          const keyHigh = `${key}:${addr + 1}`;
          const low = latestWords[`${key}:${addr}`] !== void 0 ? latestWords[`${key}:${addr}`] : u16;
          const high = latestWords[keyHigh] !== void 0 ? latestWords[keyHigh] : void 0;
          if (high === void 0) {
            if (formatCell) formatCell.textContent = "";
            if (rawCell) rawCell.textContent = hex;
          } else {
            const low32 = low & 65535;
            const high32 = high & 65535;
            const u32 = high32 << 16 >>> 0 | low32 & 65535;
            if (currentFormatInternal === "U32") {
              if (formatCell) formatCell.textContent = `${u32 >>> 0}`;
            } else if (currentFormatInternal === "I32") {
              const i32 = u32 & 2147483648 ? u32 - 4294967296 : u32;
              if (formatCell) formatCell.textContent = `${i32}`;
            } else if (currentFormatInternal === "F32") {
              const buf = new ArrayBuffer(4);
              const dv = new DataView(buf);
              dv.setUint32(0, u32 >>> 0, true);
              const f = dv.getFloat32(0, true);
              if (formatCell) formatCell.textContent = `${f}`;
            }
            if (rawCell) rawCell.textContent = `0x${u32.toString(16).toUpperCase().padStart(8, "0")}`;
          }
          const trOdd = document.getElementById(`row-${key}-${addr + 1}`);
          if (trOdd) trOdd.classList.add("paired-empty");
        } else {
          if (formatCell) formatCell.textContent = "";
          if (rawCell) rawCell.textContent = "";
          tr.classList.add("paired-empty");
        }
      } else {
        if (currentFormatInternal === "BIN") {
          if (formatCell) formatCell.textContent = `0b${u16.toString(2).padStart(16, "0")}`;
        } else if (currentFormatInternal === "U16") {
          if (formatCell) formatCell.textContent = `${u16}`;
        } else if (currentFormatInternal === "I16") {
          if (formatCell) formatCell.textContent = `${s16}`;
        } else if (currentFormatInternal === "HEX") {
          if (formatCell) formatCell.textContent = `${hex}`;
        } else if (currentFormatInternal === "ASCII") {
          const hi = u16 >> 8 & 255;
          const lo = u16 & 255;
          const a = hi >= 32 && hi <= 126 ? String.fromCharCode(hi) : ".";
          const b = lo >= 32 && lo <= 126 ? String.fromCharCode(lo) : ".";
          if (formatCell) formatCell.textContent = `${a}${b}`;
        } else {
          if (formatCell) formatCell.textContent = `${u16}`;
        }
        if (rawCell) rawCell.textContent = hex;
      }
    } catch (err) {
      console.warn("renderRowForWord failed", err);
    }
  }
  var eventApiAvailable = false;
  var monitorFallbackId = null;
  async function startFallbackPolling(key, addr, intervalMs) {
    stopFallbackPolling();
    const count = 30;
    uiLog(`startFallbackPolling ${key}${addr} interval=${intervalMs}`);
    monitorFallbackId = setInterval(async () => {
      try {
        const vals = await invoke("get_words", { key, addr, count });
        for (let i = 0; i < vals.length; i++) setWordRow(key, addr + i, vals[i] & 65535);
      } catch (e) {
        console.warn("fallback get_words failed", e);
        uiLog(`fallback get_words failed: ${e}`);
      }
    }, intervalMs);
  }
  function stopFallbackPolling() {
    if (monitorFallbackId) {
      clearInterval(monitorFallbackId);
      monitorFallbackId = null;
      uiLog("stopFallbackPolling");
    }
  }
  function selectRow(key, addr, retries = 6) {
    const prev = document.querySelector("#monitor-tbody tr.selected-row");
    if (prev) prev.classList.remove("selected-row");
    const id = `row-${key}-${addr}`;
    const tr = document.getElementById(id);
    if (!tr) {
      if (retries > 0) {
        setTimeout(() => {
          try {
            selectRow(key, addr, retries - 1);
          } catch (e) {
          }
        }, 60);
      }
      return;
    }
    tr.classList.add("selected-row");
    try {
      tr.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (e) {
    }
    try {
      const mt = document.getElementById("monitor-table");
      if (mt && typeof mt.focus === "function") try {
        mt.focus();
      } catch (e) {
      }
    } catch (e) {
    }
    try {
      const ev = new CustomEvent("melsec_row_selected", { detail: { key, addr } });
      document.dispatchEvent(ev);
    } catch (e) {
    }
  }
  function isEventApiAvailable() {
    return eventApiAvailable;
  }
  async function initEventListeners() {
    if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) {
      try {
        uiLog("initEventListeners: Tauri event API available, registering listeners");
        await window.__TAURI__.event.listen("monitor", (event) => {
          const payload = event.payload;
          try {
            const addr = payload.addr;
            const key = payload.key;
            const vals = payload.vals || [];
            try {
              uiLog(`monitor event received key=${key} addr=${addr} vals0=${vals.length > 0 ? vals[0] : "<empty>"} len=${vals.length}`);
            } catch (e) {
            }
            if (vals.length === 0) setWordRow(key, addr, 0);
            else for (let i = 0; i < vals.length; i++) setWordRow(key, addr + i, vals[i] & 65535);
          } catch (e) {
          }
        });
        await window.__TAURI__.event.listen("server-status", (event) => {
          const payload = event.payload;
          const status = document.getElementById("server-status");
          if (status) {
            status.textContent = payload;
            status.style.color = payload === "\u8D77\u52D5\u4E2D" ? "green" : "black";
          }
          try {
            uiLog(`server-status event: ${payload}`);
          } catch (e) {
          }
          try {
            if (payload === "\u8D77\u52D5\u4E2D") {
              const mt = document.getElementById("monitor-table");
              if (mt && typeof mt.focus === "function") try {
                mt.focus();
              } catch (e) {
              }
              try {
                const rawEl = document.getElementById("mon-target");
                const raw = rawEl ? rawEl.value || "D" : "D";
                let parsed = parseTarget(raw.toString().trim().toUpperCase());
                if (!parsed) parsed = { key: raw.replace(/[^A-Z]/g, ""), addr: 0 };
                if (parsed) try {
                  selectRow(parsed.key, parsed.addr);
                } catch (e) {
                }
              } catch (e) {
              }
            }
          } catch (e) {
          }
        });
        eventApiAvailable = true;
      } catch (e) {
        console.warn("event.listen not allowed, falling back to frontend polling", e);
        uiLog(`event.listen not allowed, falling back to polling: ${e}`);
        eventApiAvailable = false;
      }
    } else {
      console.warn("Tauri event API not available");
      uiLog("Tauri event API not available");
      eventApiAvailable = false;
    }
  }

  // src/main.ts
  var { invoke: invoke2 } = window.__TAURI__.core;
  var els = {};
  function logMonitor(msg) {
    const out = document.getElementById("monitor-log");
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    if (out) {
      out.textContent = `${ts} ${msg}
` + out.textContent;
    } else {
      console.log("[LOG]", ts, msg);
    }
  }
  async function startMock(tcpPort, udpPort, timAwaitMs) {
    const ip = "0.0.0.0";
    try {
      await invoke2("start_mock", { ip, tcpPort, udpPort, timAwaitMs });
      logMonitor(`[TS] start_mock invoked ip=${ip} tcp=${tcpPort} udp=${udpPort} tim=${timAwaitMs}`);
      const status = document.getElementById("server-status");
      if (status) {
        status.textContent = "\u8D77\u52D5\u4E2D";
        status.style.color = "green";
      }
    } catch (e) {
      logMonitor(`[TS] start_mock error: ${e}`);
      const status = document.getElementById("server-status");
      if (status) {
        status.textContent = "\u8D77\u52D5\u5931\u6557";
        status.style.color = "red";
      }
    }
  }
  async function startMonitorForTarget(targetKey, addr) {
    const backendTarget = `${targetKey}${addr}`;
    const interval_ms = 500;
    try {
      await invoke2("start_monitor", { target: backendTarget, intervalMs: interval_ms });
      logMonitor(`[TS] start_monitor ${backendTarget} interval=${interval_ms}`);
    } catch (e) {
      logMonitor(`[TS] start_monitor error: ${e}`);
    }
  }
  async function stopMonitor() {
    try {
      await invoke2("stop_monitor");
      logMonitor("[TS] stop_monitor invoked");
    } catch (e) {
      logMonitor(`[TS] stop_monitor error: ${e}`);
    }
  }
  window.addEventListener("DOMContentLoaded", () => {
    ["tcp-port", "udp-port", "tim-await", "mock-toggle", "mon-target", "mon-toggle", "auto-start-next"].forEach((id) => {
      els[id] = document.getElementById(id);
    });
    window.addEventListener("keydown", async (ev) => {
      if (ev.key !== "Enter") return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
      const selected = document.querySelector("#monitor-tbody tr.selected-row");
      if (!selected) return;
      const m = selected.id.match(/^row-(.+)-(\d+)$/);
      if (!m) return;
      ev.preventDefault();
      const k = m[1];
      const a = parseInt(m[2], 10);
      try {
        showEditModal(k, a);
      } catch (err) {
        console.warn("showEditModal failed", err);
      }
    });
    ["set-key", "set-addr", "set-val", "set-word"].forEach((id) => {
      els[id] = document.getElementById(id);
    });
    let mockRunning = false;
    const mockBtn = els["mock-toggle"];
    if (mockBtn) {
      mockBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const tcp_port = parseInt(els["tcp-port"].value || "5000", 10);
        const udp_port = parseInt(els["udp-port"].value || "5001", 10);
        const tim_await_ms = parseInt(els["tim-await"].value || "5000", 10);
        if (!mockRunning) {
          await startMock(tcp_port, udp_port, tim_await_ms);
          mockRunning = true;
          mockBtn.textContent = "Stop Mock";
          mockBtn.style.background = "#d9534f";
          try {
            const autoEl = els["auto-start-next"];
            if (autoEl && window.localStorage) {
              if (autoEl.checked) window.localStorage.setItem("autoStartNext", "1");
              else window.localStorage.removeItem("autoStartNext");
            }
          } catch (e) {
          }
          const rawTarget = (els["mon-target"].value || "D").toString().trim().toUpperCase();
          let parsed = parseTarget3(rawTarget);
          if (!parsed) parsed = { key: rawTarget.replace(/[^A-Z]/g, ""), addr: 0 };
          try {
            createInitialRows2(parsed.key, parsed.addr, 30);
          } catch (e) {
          }
          await startMonitorForTarget(parsed.key, parsed.addr);
          if (!isEventApiAvailable()) startFallbackPolling(parsed.key, parsed.addr, 500);
          try {
            selectRow(parsed.key, parsed.addr);
            const mt = document.getElementById("monitor-table");
            if (mt && typeof mt.focus === "function") mt.focus();
          } catch (e) {
          }
        } else {
          try {
            await stopMonitor();
          } catch (e) {
          }
          try {
            await invoke2("stop_mock");
          } catch (e) {
            logMonitor(`[TS] stop_mock error: ${e}`);
          }
          mockRunning = false;
          mockBtn.textContent = "Start Mock";
          mockBtn.style.background = "#4da6ff";
          stopFallbackPolling();
          const status = document.getElementById("server-status");
          if (status) {
            status.textContent = "\u505C\u6B62\u4E2D";
            status.style.color = "black";
          }
        }
      });
      try {
        mockBtn.focus();
      } catch (e) {
      }
      try {
        const autoEl = els["auto-start-next"];
        if (autoEl && autoEl.checked) {
          setTimeout(() => {
            try {
              if (!mockRunning) mockBtn.click();
            } catch (e) {
            }
          }, 150);
        }
      } catch (e) {
      }
    }
    try {
      const autoEl = els["auto-start-next"];
      if (autoEl && window.localStorage) {
        const saved = window.localStorage.getItem("autoStartNext");
        if (saved === "1") autoEl.checked = true;
      }
    } catch (e) {
    }
    const monTargetEl = els["mon-target"];
    if (monTargetEl) {
      monTargetEl.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          const raw = (monTargetEl.value || "").toString().trim().toUpperCase();
          let parsed = parseTarget3(raw);
          if (!parsed) parsed = { key: raw.replace(/[^A-Z]/g, ""), addr: 0 };
          try {
            createInitialRows2(parsed.key, parsed.addr, 30);
          } catch (err) {
          }
          if (mockRunning) {
            try {
              await stopMonitor();
            } catch (err) {
            }
            await startMonitorForTarget(parsed.key, parsed.addr);
            if (!isEventApiAvailable()) startFallbackPolling(parsed.key, parsed.addr, 500);
          }
        }
      });
    }
    async function setWord() {
      try {
        const key = (els["set-key"].value || "D").toString();
        const addr = parseInt(els["set-addr"].value || "0", 10);
        const raw = (els["set-val"].value || "0").toString().trim();
        const parts = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        const words = parts.map((p) => {
          if (/^0x/i.test(p)) return parseInt(p.substring(2), 16) & 65535;
          if (/^[0-9]+$/.test(p)) return parseInt(p, 10) & 65535;
          const v = parseInt(p, 10);
          return Number.isNaN(v) ? 0 : v & 65535;
        });
        await invoke2("set_words", { key, addr, words });
        logMonitor(`[TS] set_words invoked key=${key} addr=${addr} words=${JSON.stringify(words)}`);
        if (words.length > 0) setWordRow(key, addr, words[0]);
      } catch (e) {
        logMonitor(`[TS] set_words error: ${e}`);
      }
    }
    if (els["set-word"]) els["set-word"].addEventListener("click", (e) => {
      e.preventDefault();
      setWord();
    });
    try {
      const saved = window.localStorage ? window.localStorage.getItem("displayFormat") : null;
      if (saved) setCurrentFormat(saved);
    } catch (e) {
    }
    try {
      const btns = document.querySelectorAll("#display-toolbar .fmt-btn");
      btns.forEach((b) => {
        if (!b || typeof b.addEventListener !== "function") return;
        const fmt = b.getAttribute("data-fmt") || "";
        if (fmt === getCurrentFormat()) b.classList.add("active");
        b.addEventListener("click", () => {
          document.querySelectorAll("#display-toolbar .fmt-btn").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          setCurrentFormat(fmt);
          try {
            document.querySelectorAll("#edit-modal .write-type").forEach((x) => x.classList.remove("active"));
            const pb = document.querySelector(`#edit-modal .write-type[data-typ="${fmt}"]`);
            if (pb) pb.classList.add("active");
            selectedWriteType = fmt;
          } catch (e) {
          }
        });
      });
    } catch (e) {
      console.warn("failed to init toolbar", e);
    }
    const editModal = document.getElementById("edit-modal");
    const editTitle = document.getElementById("edit-modal-title");
    const editValue = document.getElementById("edit-value");
    const editCancel = document.getElementById("edit-cancel");
    const editWrite = document.getElementById("edit-write");
    let editTarget = null;
    let selectedWriteType = "U16";
    document.addEventListener("melsec_row_selected", (ev) => {
      try {
        const d = ev.detail;
        if (!d) return;
        editTarget = { key: d.key, addr: d.addr };
        try {
          if (editTitle) editTitle.textContent = `Write ${d.key}${d.addr}`;
          if (editModal && editModal.style.display && editModal.style.display !== "none") {
            if (editValue) {
              editValue.value = "";
              try {
                editValue.focus();
              } catch (e) {
              }
            }
          }
        } catch (e) {
        }
      } catch (e) {
      }
    });
    function showEditModal(key, addr) {
      editTarget = { key, addr };
      if (editTitle) editTitle.textContent = `Write ${key}${addr}`;
      if (editValue) editValue.value = "";
      selectedWriteType = getCurrentFormat() || "U16";
      document.querySelectorAll("#edit-modal .write-type").forEach((b) => b.classList.remove("active"));
      const btn = document.querySelector(`#edit-modal .write-type[data-typ="${selectedWriteType}"]`);
      if (btn) btn.classList.add("active");
      if (editModal) editModal.style.display = "block";
      try {
        setTimeout(() => {
          if (editValue) {
            editValue.focus();
            editValue.select();
          }
        }, 0);
      } catch (e) {
      }
    }
    (function setupEditDrag() {
      const box = document.getElementById("edit-modal-box");
      const title = document.getElementById("edit-modal-title");
      if (!box || !title) return;
      title.style.cursor = "grab";
      let dragging = false;
      let offsetX = 0, offsetY = 0;
      function onMouseMove(ev) {
        if (!dragging) return;
        const x = ev.clientX - offsetX;
        const y = ev.clientY - offsetY;
        box.style.left = `${Math.max(0, x)}px`;
        box.style.top = `${Math.max(0, y)}px`;
        box.style.right = "";
        box.style.bottom = "";
        box.style.transform = "none";
      }
      function onMouseUp() {
        if (!dragging) return;
        dragging = false;
        title.style.cursor = "grab";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        try {
          savePopupPos();
        } catch (e) {
        }
      }
      title.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        const rect = box.getBoundingClientRect();
        offsetX = ev.clientX - rect.left;
        offsetY = ev.clientY - rect.top;
        dragging = true;
        title.style.cursor = "grabbing";
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
      title.addEventListener("touchstart", (ev) => {
        const t = ev.touches[0];
        if (!t) return;
        const rect = box.getBoundingClientRect();
        offsetX = t.clientX - rect.left;
        offsetY = t.clientY - rect.top;
        dragging = true;
        window.addEventListener("touchmove", touchMoveHandler, { passive: false });
        window.addEventListener("touchend", touchEndHandler);
      });
      function touchMoveHandler(ev) {
        if (!dragging) return;
        ev.preventDefault();
        const t = ev.touches[0];
        if (!t) return;
        const x = t.clientX - offsetX;
        const y = t.clientY - offsetY;
        box.style.left = `${Math.max(0, x)}px`;
        box.style.top = `${Math.max(0, y)}px`;
        box.style.right = "";
        box.style.bottom = "";
        box.style.transform = "none";
      }
      function touchEndHandler() {
        dragging = false;
        window.removeEventListener("touchmove", touchMoveHandler);
        window.removeEventListener("touchend", touchEndHandler);
        try {
          savePopupPos();
        } catch (e) {
        }
      }
      try {
        loadPopupPos();
      } catch (e) {
      }
    })();
    function savePopupPos() {
      try {
        const box = document.getElementById("edit-modal-box");
        if (!box) return;
        const rect = box.getBoundingClientRect();
        const pos = { left: Math.max(0, Math.round(rect.left)), top: Math.max(0, Math.round(rect.top)) };
        try {
          if (window.localStorage) window.localStorage.setItem("editPopupPos", JSON.stringify(pos));
        } catch (e) {
        }
      } catch (e) {
      }
    }
    function loadPopupPos() {
      try {
        const raw = window.localStorage ? window.localStorage.getItem("editPopupPos") : null;
        if (!raw) return;
        const pos = JSON.parse(raw);
        if (!pos) return;
        const box = document.getElementById("edit-modal-box");
        if (!box) return;
        const bw = box.offsetWidth || 300;
        const bh = box.offsetHeight || 120;
        const maxLeft = Math.max(0, (window.innerWidth || 800) - bw);
        const maxTop = Math.max(0, (window.innerHeight || 600) - bh);
        const left = Math.min(maxLeft, Math.max(0, pos.left));
        const top = Math.min(maxTop, Math.max(0, pos.top));
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.right = "";
        box.style.bottom = "";
        box.style.transform = "none";
        try {
          if (window.localStorage) window.localStorage.setItem("editPopupPos", JSON.stringify({ left, top }));
        } catch (e) {
        }
      } catch (e) {
      }
    }
    function clampAndSavePopupPos() {
      try {
        const box = document.getElementById("edit-modal-box");
        if (!box) return;
        const rect = box.getBoundingClientRect();
        const bw = box.offsetWidth || 300;
        const bh = box.offsetHeight || 120;
        const maxLeft = Math.max(0, (window.innerWidth || 800) - bw);
        const maxTop = Math.max(0, (window.innerHeight || 600) - bh);
        const left = Math.min(maxLeft, Math.max(0, Math.round(rect.left)));
        const top = Math.min(maxTop, Math.max(0, Math.round(rect.top)));
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.right = "";
        box.style.bottom = "";
        box.style.transform = "none";
        try {
          if (window.localStorage) window.localStorage.setItem("editPopupPos", JSON.stringify({ left, top }));
        } catch (e) {
        }
      } catch (e) {
      }
    }
    window.addEventListener("resize", () => {
      try {
        clampAndSavePopupPos();
      } catch (e) {
      }
    });
    function hideEditModal() {
      if (editModal) editModal.style.display = "none";
      try {
        savePopupPos();
      } catch (e) {
      }
      editTarget = null;
    }
    document.querySelectorAll("#edit-modal .write-type").forEach((el) => {
      if (!el || typeof el.addEventListener !== "function") return;
      el.addEventListener("click", (_ev) => {
        const t = el.getAttribute("data-typ") || "U16";
        selectedWriteType = t;
        document.querySelectorAll("#edit-modal .write-type").forEach((b) => b.classList.remove("active"));
        el.classList.add("active");
        try {
          document.querySelectorAll("#display-toolbar .fmt-btn").forEach((x) => x.classList.remove("active"));
          const mainBtn = document.querySelector(`#display-toolbar .fmt-btn[data-fmt="${t}"]`);
          if (mainBtn) mainBtn.classList.add("active");
          setCurrentFormat(t);
        } catch (e) {
        }
      });
    });
    if (editCancel) editCancel.addEventListener("click", (e) => {
      e.preventDefault();
      hideEditModal();
    });
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        if (editModal && editModal.style.display && editModal.style.display !== "none") hideEditModal();
      }
    });
    window.addEventListener("keydown", (ev) => {
      try {
        if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
        const popupVisible = !!(editModal && editModal.style.display && editModal.style.display !== "none");
        const active = document.activeElement;
        const mt = document.getElementById("monitor-table");
        const mtHasFocus = mt && active === mt;
        if (!popupVisible && !mtHasFocus) return;
        ev.preventDefault();
        ev.stopPropagation();
        const rows = Array.from(document.querySelectorAll("#monitor-tbody tr"));
        if (!rows || rows.length === 0) return;
        const sel = document.querySelector("#monitor-tbody tr.selected-row");
        let idx = sel ? rows.indexOf(sel) : -1;
        if (idx === -1) {
          idx = 0;
        } else {
          if (ev.key === "ArrowUp") idx = Math.max(0, idx - 1);
          else if (ev.key === "ArrowDown") idx = Math.min(rows.length - 1, idx + 1);
        }
        const next = rows[idx];
        if (!next) return;
        const m = next.id.match(/^row-(.+)-(\d+)$/);
        if (!m) return;
        const k = m[1];
        const a = parseInt(m[2], 10);
        try {
          selectRow(k, a);
        } catch (e) {
          console.warn("selectRow failed", e);
        }
      } catch (e) {
      }
    });
    if (editWrite) editWrite.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!editTarget) return;
      const { key, addr } = editTarget;
      const raw = editValue && editValue.value ? editValue.value.trim() : "";
      try {
        let words = [];
        if (selectedWriteType === "U16") {
          const v = /^0x/i.test(raw) ? parseInt(raw.substring(2), 16) : parseInt(raw, 10);
          words = [(v & 65535) >>> 0];
        } else if (selectedWriteType === "I16") {
          const v = parseInt(raw, 10);
          words = [(v & 65535) >>> 0];
        } else if (selectedWriteType === "HEX") {
          const v = /^0x/i.test(raw) ? parseInt(raw.substring(2), 16) : parseInt(raw, 16);
          words = [(v & 65535) >>> 0];
        } else if (selectedWriteType === "BIN") {
          const v = parseInt(raw.replace(/^0b/i, ""), 2);
          words = [(v & 65535) >>> 0];
        } else if (selectedWriteType === "ASCII") {
          const s = raw.padEnd(2, "\0").slice(0, 2);
          const hi = s.charCodeAt(0) & 255;
          const lo = s.charCodeAt(1) & 255;
          const w = (hi << 8 | lo) >>> 0;
          words = [w & 65535];
        } else if (selectedWriteType === "U32" || selectedWriteType === "I32" || selectedWriteType === "F32") {
          let u32 = 0;
          if (selectedWriteType === "F32") {
            const f = parseFloat(raw);
            const buf = new ArrayBuffer(4);
            const dv = new DataView(buf);
            dv.setFloat32(0, f, true);
            u32 = dv.getUint32(0, true);
          } else if (selectedWriteType === "U32") {
            u32 = Number(BigInt(raw));
          } else {
            let iv = parseInt(raw, 10);
            if (iv < 0) iv = iv >>> 0;
            u32 = iv >>> 0;
          }
          const low = u32 & 65535;
          const high = u32 >>> 16 & 65535;
          const baseAddr = addr % 2 === 0 ? addr : addr - 1;
          words = [low, high];
          try {
            logMonitor(`[TS] invoking set_words key=${key} addr=${baseAddr} words=${JSON.stringify(words)}`);
            console.log("[TS] invoking set_words", { key, addr: baseAddr, words });
            await invoke2("set_words", { key, addr: baseAddr, words });
          } catch (e2) {
            logMonitor(`[TS] set_words error (U32 path): ${e2}`);
            console.error("set_words error (U32 path)", e2);
          }
          setWordRow(key, baseAddr, low);
          setWordRow(key, baseAddr + 1, high);
          return;
        }
        try {
          logMonitor(`[TS] invoking set_words key=${key} addr=${addr} words=${JSON.stringify(words)}`);
          console.log("[TS] invoking set_words", { key, addr, words });
          await invoke2("set_words", { key, addr, words });
        } catch (e2) {
          logMonitor(`[TS] set_words error: ${e2}`);
          console.error("set_words error", e2);
        }
        setWordRow(key, addr, words.length > 0 ? words[0] & 65535 : 0);
      } catch (err) {
        console.warn("write failed", err);
      }
    });
    if (editValue) {
      editValue.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          if (editWrite) editWrite.click();
        }
      });
    }
    const tbody = document.getElementById("monitor-tbody");
    if (tbody) {
      tbody.addEventListener("dblclick", (ev) => {
        let el = ev.target;
        while (el && el.tagName !== "TR") el = el.parentElement;
        if (!el) return;
        const id = el.id;
        if (!id) return;
        const m = id.match(/^row-(.+)-(\d+)$/);
        if (!m) return;
        const key = m[1];
        const addr = parseInt(m[2], 10);
        showEditModal(key, addr);
      });
    }
    function parseTarget3(s) {
      if (!s) return null;
      const up = s.toUpperCase().trim();
      let i = 0;
      while (i < up.length && /[A-Z]/.test(up[i])) i++;
      if (i === 0) return null;
      const key = up.slice(0, i);
      const numPart = up.slice(i).trim();
      if (!numPart) return null;
      const isHex = /[A-F]/i.test(numPart);
      const addr = isHex ? parseInt(numPart, 16) : parseInt(numPart, 10);
      if (Number.isNaN(addr)) return null;
      return { key, addr };
    }
    function createInitialRows2(key, addr, count) {
      for (let i = 0; i < count; i++) setWordRow(key, addr + i, 0);
    }
    (async () => {
      try {
        const rawTarget = (els["mon-target"].value || "D").toString().trim().toUpperCase();
        let parsed = parseTarget3(rawTarget);
        if (!parsed) parsed = { key: rawTarget.replace(/[^A-Z]/g, ""), addr: 0 };
        const count = 30;
        try {
          const vals = await invoke2("get_words", { key: parsed.key, addr: parsed.addr, count });
          if (Array.isArray(vals) && vals.length > 0) {
            for (let i = 0; i < vals.length; i++) setWordRow(parsed.key, parsed.addr + i, vals[i] & 65535);
            if (vals.length < count) createInitialRows2(parsed.key, parsed.addr + vals.length, count - vals.length);
            logMonitor(`[TS] initial get_words populated ${vals.length} rows for ${parsed.key}${parsed.addr}`);
          } else {
            createInitialRows2(parsed.key, parsed.addr, count);
            logMonitor(`[TS] initial get_words returned empty; created ${count} empty rows for ${parsed.key}${parsed.addr}`);
          }
        } catch (e) {
          createInitialRows2(parsed.key, parsed.addr, count);
          logMonitor(`[TS] initial get_words failed; created ${count} empty rows for ${parsed.key}${parsed.addr}: ${e}`);
        }
      } catch (e) {
      }
      try {
        await initEventListeners();
      } catch (e) {
        console.warn("initEventListeners failed", e);
      }
    })();
    const monToggleEl = els["mon-toggle"];
    if (monToggleEl) {
      monToggleEl.addEventListener("click", (_e) => {
        setTimeout(() => {
          const btn = els["mon-toggle"];
          const isRunning = btn && btn.textContent && btn.textContent.includes("\u505C\u6B62");
          if (!isEventApiAvailable() && isRunning) {
            try {
              const raw = els["mon-target"].value || "D";
              let parsed = parseTarget3(raw);
              if (!parsed) parsed = { key: raw.replace(/[^A-Z]/g, ""), addr: 0 };
              if (parsed) startFallbackPolling(parsed.key, parsed.addr, 500);
            } catch (e) {
              console.warn("failed to start fallback polling", e);
            }
          } else if (!isEventApiAvailable() && !isRunning) stopFallbackPolling();
        }, 50);
      });
    }
  });
})();
//# sourceMappingURL=main.js.map
