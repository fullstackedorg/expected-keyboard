import { ExpectedKeyboard, LAYOUT_QWERTY } from "./src";

export * from "./src";

function initDemoApp() {
    // Mobile Touch Viewport Setup
    let metaViewport = document.querySelector(
        'meta[name="viewport"]'
    ) as HTMLMetaElement;
    if (!metaViewport) {
        metaViewport = document.createElement("meta");
        metaViewport.name = "viewport";
        document.head.appendChild(metaViewport);
    }
    metaViewport.content =
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

    // Global Reset
    document.documentElement.style.height = "100%";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.boxSizing = "border-box";
    (document.documentElement.style as any).webkitTouchCallout = "none";
    (document.documentElement.style as any).webkitTapHighlightColor =
        "transparent";

    document.body.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.body.style.fontFamily =
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Fira Code', monospace";
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    (document.body.style as any).webkitTouchCallout = "none";
    (document.body.style as any).webkitTapHighlightColor = "transparent";
    (document.body.style as any).touchAction = "none";
    document.body.style.backgroundColor = "#0d1117";
    document.body.style.color = "#f0f6fc";

    // State
    let activeWorkspaceMode: "textarea" | "terminal" | "editor" | "notepad" =
        "textarea";

    // App Layout Container
    const appContainer = document.createElement("div");
    appContainer.id = "expected-demo-app";
    appContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    font-size: 14px;
    background-color: #0d1117;
    color: #f0f6fc;
  `;

    // Top Workspace Container
    const topWorkspace = document.createElement("div");
    topWorkspace.id = "top-workspace";
    topWorkspace.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top, 8px) + 6px) 10px calc(var(--expected-keyboard-height, 0px) + 10px) 10px;
    gap: 8px;
    min-height: 0;
    box-sizing: border-box;
    transition: padding-bottom 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  `;

    // Top Navigation Bar
    const navBar = document.createElement("div");
    navBar.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
    gap: 6px;
  `;

    navBar.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <div style="display: flex; align-items: center; gap: 5px; font-weight: 800; font-size: 14px; letter-spacing: -0.2px;">
        <span style="font-size: 16px;">⚡</span>
        <span id="app-title" style="color: #38bdf8;">Expected Keyboard</span>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 5px;">
      <div id="mode-tabs" style="display: flex; background: rgba(255,255,255,0.05); padding: 2px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <button data-mode="textarea" style="background: #38bdf8; color: #000; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; cursor: pointer;">🧪 Test Area</button>
        <button data-mode="terminal" style="background: transparent; color: #888; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">💻 Term</button>
        <button data-mode="editor" style="background: transparent; color: #888; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">📝 Code</button>
        <button data-mode="notepad" style="background: transparent; color: #888; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">📄 Note</button>
      </div>
    </div>
  `;

    // Workspace Screens Container
    const screenContainer = document.createElement("div");
    screenContainer.id = "screen-container";
    screenContainer.style.cssText = `
    flex: 1;
    border-radius: 10px;
    border: 1.5px solid #30363d;
    background-color: #090d12;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    min-height: 100px;
  `;

    // 1. Real HTML5 Textarea Mode (inputmode="none")
    const textareaContainer = document.createElement("div");
    textareaContainer.id = "view-textarea-container";
    textareaContainer.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    box-sizing: border-box;
    gap: 6px;
  `;

    const realTextarea = document.createElement("textarea");
    realTextarea.id = "target-html5-textarea";
    realTextarea.setAttribute("inputmode", "none");
    realTextarea.setAttribute("autocomplete", "off");
    realTextarea.setAttribute("autocorrect", "off");
    realTextarea.setAttribute("autocapitalize", "off");
    realTextarea.setAttribute("spellcheck", "false");
    realTextarea.placeholder = "Tap here! Virtual keyboard pops up on focus.";
    realTextarea.value = `// Expected Keyboard ✨\nfunction demo() {\n  const symbols = ["~", "@", "!", "#", "$", "%", "^", "&", "*", "(", ")", "{", "}", "[", "]"];\n  console.log("Ready for typing:", symbols);\n}\n\ndemo();`;

    realTextarea.style.cssText = `
    flex: 1;
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: #58a6ff;
    font-family: 'Fira Code', Menlo, monospace;
    font-size: 13.5px;
    line-height: 1.5;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
  `;

    const textareaDebugBar = document.createElement("div");
    textareaDebugBar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px dashed rgba(255,255,255,0.12);
    padding-top: 4px;
    font-size: 11px;
    opacity: 0.75;
    font-family: 'Fira Code', monospace;
  `;
    textareaDebugBar.innerHTML = `
    <span id="textarea-metrics">Selection: [0, 0] | Length: 0</span>
    <button id="btn-quick-sample" style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;">Insert Code</button>
  `;

    textareaContainer.appendChild(realTextarea);
    textareaContainer.appendChild(textareaDebugBar);

    // 2. Terminal Shell Mode
    const terminalView = document.createElement("div");
    terminalView.id = "terminal-view";
    terminalView.tabIndex = 0;
    terminalView.style.cssText = `
    flex: 1;
    padding: 10px 12px;
    font-family: 'Fira Code', monospace;
    font-size: 12.5px;
    line-height: 1.45;
    overflow-y: auto;
    display: none;
    flex-direction: column;
    gap: 3px;
    word-break: break-all;
    outline: none;
    color: #58a6ff;
  `;

    // 3. Code Editor Mode
    const codeEditorContainer = document.createElement("div");
    codeEditorContainer.id = "code-editor-container";
    codeEditorContainer.style.cssText = `
    flex: 1;
    display: none;
    flex-direction: column;
    padding: 10px 12px;
    box-sizing: border-box;
  `;
    const codeTextarea = document.createElement("textarea");
    codeTextarea.id = "code-textarea";
    codeTextarea.setAttribute("inputmode", "none");
    codeTextarea.setAttribute("spellcheck", "false");
    codeTextarea.value = `// JavaScript Playground\nfunction quicksort(arr: number[]): number[] {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[0];\n  const left = arr.slice(1).filter(x => x < pivot);\n  const right = arr.slice(1).filter(x => x >= pivot);\n  return [...quicksort(left), pivot, ...quicksort(right)];\n}\n\nconsole.log(quicksort([38, 27, 43, 3, 9, 82, 10]));`;
    codeTextarea.style.cssText = `
    flex: 1;
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: #f0f6fc;
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.45;
  `;
    codeEditorContainer.appendChild(codeTextarea);

    // 4. Notepad Mode
    const notepadContainer = document.createElement("div");
    notepadContainer.id = "notepad-container";
    notepadContainer.style.cssText = `
    flex: 1;
    display: none;
    flex-direction: column;
    padding: 10px 12px;
    box-sizing: border-box;
  `;
    const notepadTextarea = document.createElement("textarea");
    notepadTextarea.id = "notepad-textarea";
    notepadTextarea.setAttribute("inputmode", "none");
    notepadTextarea.placeholder = "Write notes here with Expected Keyboard...";
    notepadTextarea.value = `Expected Touch Virtual Keyboard ✨\n\n- Modular, lightweight TypeScript component.\n- Automatically appears on input focus & hides on blur.\n- Top action buttons: Esc, Tab, Home, Arrows (←, ↓, ↑, →), End, and Dismiss (▼).\n- Clean, uncluttered corner secondary characters matching standard ergonomics.\n- Large, spacious spacebar with smooth caret gliding.`;
    notepadTextarea.style.cssText = `
    flex: 1;
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: #f0f6fc;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  `;
    notepadContainer.appendChild(notepadTextarea);

    screenContainer.appendChild(textareaContainer);
    screenContainer.appendChild(terminalView);
    screenContainer.appendChild(codeEditorContainer);
    screenContainer.appendChild(notepadContainer);

    // Status Feedback Bar
    const statusBar = document.createElement("div");
    statusBar.id = "status-bar";
    statusBar.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 600;
    gap: 6px;
    font-family: 'Fira Code', monospace;
    background-color: #161b22;
    border: 1px solid #30363d;
  `;
    statusBar.innerHTML = `
    <div id="gesture-tracker" style="color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%;">
      <span id="last-gesture-desc" style="color: #38bdf8;">Ready</span>
    </div>
    <div id="keyboard-state-badge" style="font-size: 10px; opacity: 0.6;">Keyboard: Docked</div>
    <div id="cursor-pos-indicator" style="opacity: 0.75;">
      Ln 1, Col 1
    </div>
  `;

    topWorkspace.appendChild(navBar);
    topWorkspace.appendChild(screenContainer);
    topWorkspace.appendChild(statusBar);
    appContainer.appendChild(topWorkspace);
    document.body.appendChild(appContainer);

    // Terminal Buffer State
    let terminalHistory: string[] = [
        "Expected OS (Modular Touch Virtual Keyboard)",
        "Type 'help' for commands. Focus terminal or test area to open keyboard."
    ];
    let terminalInput = "";
    let terminalCommandHistory: string[] = [];

    function getActiveTextarea(): HTMLTextAreaElement | null {
        if (activeWorkspaceMode === "textarea") return realTextarea;
        if (activeWorkspaceMode === "editor") return codeTextarea;
        if (activeWorkspaceMode === "notepad") return notepadTextarea;
        return null;
    }

    // --- Instantiate Keyboard Component ---
    const keyboard = new ExpectedKeyboard({
        layout: LAYOUT_QWERTY,
        cornerLabelsVisible: true,
        quickNavVisible: true,
        swipeDeadzone: 10,
        autoAttachInputs: true,
        onInput: (char) => {
            if (activeWorkspaceMode === "terminal") {
                if (char === "\n") {
                    executeTerminalCommand(terminalInput);
                    terminalInput = "";
                } else {
                    terminalInput += char;
                }
            }
            syncState();
        },
        onAction: (action) => {
            if (action === "esc") {
                showNotification("[ESC] Escape");
                if (activeWorkspaceMode === "terminal") {
                    terminalHistory.push("[ESC] Cancelled current line");
                    terminalInput = "";
                    syncState();
                }
            } else if (
                action === "backspace" &&
                activeWorkspaceMode === "terminal"
            ) {
                terminalInput = terminalInput.slice(0, -1);
                syncState();
            }
            syncState();
        },
        onKey: (_keyDef, _corner, char) => {
            const tracker = document.getElementById("last-gesture-desc");
            if (tracker) {
                tracker.textContent = char;
            }
        },
        onVisibilityChange: (visible) => {
            const stateBadge = document.getElementById("keyboard-state-badge");
            if (stateBadge) {
                stateBadge.textContent = visible
                    ? "Keyboard: Active"
                    : "Keyboard: Hidden";
                stateBadge.style.color = visible ? "#38bdf8" : "inherit";
            }
        }
    });

    // Attach elements to keyboard
    keyboard.attach(realTextarea);
    keyboard.attach(codeTextarea);
    keyboard.attach(notepadTextarea);
    keyboard.attach(terminalView);

    // Terminal Command Executor
    function executeTerminalCommand(cmdRaw: string) {
        const cmd = cmdRaw.trim();
        terminalHistory.push(`guest@expected:~$ ${cmdRaw}`);

        if (cmd) {
            terminalCommandHistory.push(cmd);
        }

        if (!cmd) {
            syncState();
            return;
        }

        const [mainCmd, ...args] = cmd.split(/\s+/);
        const argStr = args.join(" ");

        switch (mainCmd.toLowerCase()) {
            case "help":
                terminalHistory.push(
                    "Commands: help, ls, echo, clear, date, uname, calc"
                );
                break;
            case "clear":
            case "cls":
                terminalHistory = [];
                break;
            case "ls":
                terminalHistory.push("README.md  src/  index.ts  package.json");
                break;
            case "echo":
                terminalHistory.push(argStr);
                break;
            case "date":
                terminalHistory.push(new Date().toISOString());
                break;
            case "uname":
                terminalHistory.push("Expected Keyboard Modular Web Component");
                break;
            case "calc":
                try {
                    const res = Function(`'use strict'; return (${argStr})`)();
                    terminalHistory.push(`= ${res}`);
                } catch (e: any) {
                    terminalHistory.push(`[Error] ${e.message}`);
                }
                break;
            default:
                terminalHistory.push(
                    `bash: ${mainCmd}: command not found. Type 'help' for commands.`
                );
        }

        syncState();
    }

    function showNotification(msg: string) {
        const tracker = document.getElementById("last-gesture-desc");
        if (tracker) {
            tracker.textContent = msg;
            setTimeout(() => {
                tracker.textContent = "Ready";
            }, 2000);
        }
    }

    function escapeHTML(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // State Synchronization
    function syncState() {
        if (activeWorkspaceMode === "terminal") {
            terminalView.innerHTML = "";
            terminalHistory.forEach((line) => {
                const lineEl = document.createElement("div");
                lineEl.textContent = line;
                if (line.startsWith("guest@expected:~$")) {
                    lineEl.style.color = "#38bdf8";
                } else if (line.startsWith("[Error]")) {
                    lineEl.style.color = "#f87171";
                } else {
                    lineEl.style.color = "#58a6ff";
                }
                terminalView.appendChild(lineEl);
            });

            const activeLine = document.createElement("div");
            activeLine.style.cssText =
                "display: flex; align-items: center; gap: 4px; margin-top: 2px;";
            activeLine.innerHTML = `
        <span style="color: #38bdf8; font-weight: 700;">guest@expected:~$</span>
        <span>${escapeHTML(terminalInput)}</span>
        <span style="display: inline-block; width: 7px; height: 14px; background: #38bdf8; animation: cursorBlink 1s infinite; vertical-align: middle;"></span>
      `;
            terminalView.appendChild(activeLine);
            terminalView.scrollTop = terminalView.scrollHeight;
        }

        // Update Line/Col & Debug Metrics
        const target = getActiveTextarea();
        let curLine = 1;
        let curCol = 1;
        let startPos = 0;
        let endPos = 0;
        let totalLen = 0;

        if (target) {
            startPos = target.selectionStart ?? 0;
            endPos = target.selectionEnd ?? 0;
            totalLen = target.value.length;
            const textUpToCaret = target.value.slice(0, startPos);
            const lines = textUpToCaret.split("\n");
            curLine = lines.length;
            curCol = lines[lines.length - 1].length + 1;
        } else if (activeWorkspaceMode === "terminal") {
            startPos = terminalInput.length;
            endPos = terminalInput.length;
            totalLen = terminalInput.length;
            curLine = 1;
            curCol = terminalInput.length + 1;
        }

        const posIndicator = document.getElementById("cursor-pos-indicator");
        if (posIndicator) {
            posIndicator.textContent = `Ln ${curLine}, Col ${curCol}`;
        }

        const metricsEl = document.getElementById("textarea-metrics");
        if (metricsEl) {
            metricsEl.textContent = `Selection: [${startPos}, ${endPos}] | Length: ${totalLen}`;
        }
    }

    // Event Listeners for Textareas
    [realTextarea, codeTextarea, notepadTextarea].forEach((ta) => {
        ta.addEventListener("input", syncState);
        ta.addEventListener("click", syncState);
        ta.addEventListener("keyup", syncState);
        ta.addEventListener("select", syncState);
    });

    document
        .getElementById("btn-quick-sample")
        ?.addEventListener("click", () => {
            realTextarea.value = `// Clean Code Test\nconst calculate = (a: number, b: number) => {\n  return (a * b) + Math.pow(a, 2);\n};\nconsole.log(calculate(5, 10));`;
            realTextarea.focus();
            realTextarea.setSelectionRange(
                realTextarea.value.length,
                realTextarea.value.length
            );
            syncState();
        });

    // Mode Switch Tabs Handlers
    const modeTabs = document.querySelectorAll("#mode-tabs button");
    modeTabs.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.getAttribute("data-mode") as any;
            activeWorkspaceMode = mode;

            modeTabs.forEach((b) => {
                (b as HTMLElement).style.background = "transparent";
                (b as HTMLElement).style.color = "#888";
            });

            (btn as HTMLElement).style.background = "#38bdf8";
            (btn as HTMLElement).style.color = "#000";

            textareaContainer.style.display =
                mode === "textarea" ? "flex" : "none";
            terminalView.style.display = mode === "terminal" ? "flex" : "none";
            codeEditorContainer.style.display =
                mode === "editor" ? "flex" : "none";
            notepadContainer.style.display =
                mode === "notepad" ? "flex" : "none";

            const active = getActiveTextarea();
            if (active) {
                keyboard.setActiveTarget(active);
            } else if (mode === "terminal") {
                keyboard.setActiveTarget(terminalView);
            }

            syncState();
        });
    });

    // Keyframes Injection
    const styleEl = document.createElement("style");
    styleEl.textContent = `
    @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    .expected-key:active, .unexpected-key:active { transform: scale(0.92); }
  `;
    document.head.appendChild(styleEl);

    syncState();
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDemoApp);
    } else {
        initDemoApp();
    }
}
