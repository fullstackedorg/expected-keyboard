import {
  ActiveTouch,
  KeyDef,
  KeyboardLayout,
  KeyboardOptions,
  ModifierState,
} from "./types";
import { LAYOUT_QWERTY } from "./layouts";

export function isApplePlatform(): boolean {
  try {
    if (typeof (globalThis as any).os !== "undefined" && typeof (globalThis as any).os.platform === "function") {
      const p = String((globalThis as any).os.platform()).toLowerCase();
      if (p === "darwin" || p === "ios" || p === "mac" || p === "apple") return true;
    }
    const platform = (navigator.platform || "").toLowerCase();
    if (/iphone|ipad|ipod|macintosh|macintel/.test(platform)) return true;
    const ua = (navigator.userAgent || "").toLowerCase();
    if (/iphone|ipad|ipod|macintosh|mac os x/.test(ua)) return true;
    if (navigator.maxTouchPoints > 1 && /macintosh/.test(ua)) return true;
  } catch {}
  return false;
}

export class ExpectedKeyboard {
  private options: KeyboardOptions;
  private currentLayout: KeyboardLayout;
  private isVisibleState: boolean = false;

  // Modifier States
  private shiftState: ModifierState = "OFF";
  private ctrlState: ModifierState = "OFF";
  private altState: ModifierState = "OFF";
  private lastShiftTapTime = 0;
  private lastCtrlTapTime = 0;
  private lastAltTapTime = 0;
  private lastHideTimestamp = 0;

  // Attached Target Input / Textarea
  private activeTarget: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null = null;
  private attachedElements: Set<HTMLElement> = new Set();

  // DOM Elements
  private hostContainer: HTMLElement;
  private keyboardRoot!: HTMLElement;
  private gestureBubble!: HTMLElement;
  private quickNavStrip!: HTMLElement;
  private keyboardWrapper!: HTMLElement;

  // Active Multi-Touch map
  private activeTouches = new Map<number, ActiveTouch>();

  // Global event cleanups
  private globalPointerMoveHandler: (e: PointerEvent) => void;
  private globalPointerUpHandler: (e: PointerEvent) => void;
  private globalPointerCancelHandler: (e: PointerEvent) => void;
  private globalFocusInHandler: (e: FocusEvent) => void;
  private globalFocusOutHandler: (e: FocusEvent) => void;
  private globalPointerDownOutsideHandler: (e: PointerEvent) => void;

  constructor(options: Partial<KeyboardOptions> = {}) {
    this.options = {
      layout: LAYOUT_QWERTY,
      cornerLabelsVisible: true,
      quickNavVisible: true,
      applePaddingEnabled: isApplePlatform(),
      swipeDeadzone: 10,
      autoAttachInputs: true,
      adjustPageScroll: true,
      ...options,
    };

    this.currentLayout = JSON.parse(
      JSON.stringify(this.options.layout || LAYOUT_QWERTY)
    );

    this.hostContainer = this.options.container || document.body;

    // Build DOM
    this.initDOM();

    // Bind Global Pointer Listeners
    this.globalPointerMoveHandler = this.handlePointerMove.bind(this);
    this.globalPointerUpHandler = this.handlePointerUp.bind(this);
    this.globalPointerCancelHandler = this.handlePointerCancel.bind(this);
    this.globalFocusInHandler = this.handleGlobalFocusIn.bind(this);
    this.globalFocusOutHandler = this.handleGlobalFocusOut.bind(this);
    this.globalPointerDownOutsideHandler = this.handlePointerDownOutside.bind(this);

    window.addEventListener("pointermove", this.globalPointerMoveHandler, { passive: false });
    window.addEventListener("pointerup", this.globalPointerUpHandler, { passive: false });
    window.addEventListener("pointercancel", this.globalPointerCancelHandler, { passive: false });
    document.addEventListener("pointerup", this.globalPointerUpHandler, { passive: false });
    document.addEventListener("pointercancel", this.globalPointerCancelHandler, { passive: false });
    document.addEventListener("focusin", this.globalFocusInHandler, { capture: true });
    document.addEventListener("focusout", this.globalFocusOutHandler, { capture: true });
    document.addEventListener("pointerdown", this.globalPointerDownOutsideHandler, { capture: true });

    // Render Initial State
    this.renderKeyboard();

    // Auto-attach existing inputs if enabled
    if (this.options.autoAttachInputs) {
      this.scanAndAttachInputs();
    }
  }

  private initDOM() {
    // 1. Gesture Magnifier Bubble
    this.gestureBubble = document.createElement("div");
    this.gestureBubble.id = "expected-gesture-bubble";
    this.gestureBubble.style.cssText = `
      position: fixed;
      z-index: 100000;
      pointer-events: none;
      display: none;
      transform: translate(-50%, -100%);
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 20px;
      font-weight: 700;
      font-family: 'Fira Code', monospace;
      box-shadow: 0 6px 20px rgba(0,0,0,0.6);
      border: 2px solid #38bdf8;
      background-color: #161b22;
      color: #38bdf8;
      backdrop-filter: blur(8px);
      transition: transform 0.05s ease-out;
    `;
    document.body.appendChild(this.gestureBubble);

    // 2. Keyboard Root Container
    this.keyboardRoot = document.createElement("div");
    this.keyboardRoot.id = "expected-keyboard-root";
    this.keyboardRoot.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99990;
      display: flex;
      flex-direction: column;
      background-color: #0d1117;
      border-top: 1.5px solid #30363d;
      box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.45);
      box-sizing: border-box;
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none;
      user-select: none;
      overscroll-behavior: none;
      transform: translateY(100%);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      opacity: 0;
      pointer-events: none;
    `;

    // Prevent any mousedown or pointerdown on keyboard from stealing focus from target text inputs
    this.keyboardRoot.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    this.keyboardRoot.addEventListener("touchstart", (e) => {
      e.stopPropagation();
    }, { passive: false });
    this.keyboardRoot.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });

    // 3. Top Quick Nav Action Strip (ESC, TAB, and 4 arrows only)
    this.quickNavStrip = document.createElement("div");
    this.quickNavStrip.id = "expected-quick-nav-strip";
    this.quickNavStrip.style.cssText = `
      display: ${this.options.quickNavVisible ? "flex" : "none"};
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 5px 8px 3px 8px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    `;

    this.quickNavStrip.innerHTML = `
      <button type="button" tabindex="-1" data-action="esc" style="flex:1; height:32px; background: #181d24; border: 1px solid #30363d; color: #f0f6fc; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">ESC</button>
      <button type="button" tabindex="-1" data-action="tab" style="flex:1; height:32px; background: #181d24; border: 1px solid #30363d; color: #f0f6fc; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">TAB</button>
      <button type="button" tabindex="-1" data-action="left" style="flex:1.2; height:32px; background: #21262d; border: 1px solid #30363d; color: #f0f6fc; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">←</button>
      <button type="button" tabindex="-1" data-action="down" style="flex:1.2; height:32px; background: #21262d; border: 1px solid #30363d; color: #f0f6fc; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">↓</button>
      <button type="button" tabindex="-1" data-action="up" style="flex:1.2; height:32px; background: #21262d; border: 1px solid #30363d; color: #f0f6fc; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">↑</button>
      <button type="button" tabindex="-1" data-action="right" style="flex:1.2; height:32px; background: #21262d; border: 1px solid #30363d; color: #f0f6fc; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">→</button>
      <button type="button" tabindex="-1" data-action="dismiss" title="Close Keyboard" style="flex:0.85; height:32px; background: #181d24; border: 1px solid #30363d; color: #38bdf8; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; display:flex; align-items:center; justify-content:center;">▼</button>
    `;

    this.attachQuickNavEvents();

    // 4. Virtual Keyboard Rows Wrapper
    this.keyboardWrapper = document.createElement("div");
    this.keyboardWrapper.id = "expected-keys-grid";
    this.keyboardWrapper.style.cssText = `
      width: 100%;
      padding: 4px 6px calc(env(safe-area-inset-bottom, 16px) + 8px) 6px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 5px;
      touch-action: none;
    `;

    this.keyboardRoot.appendChild(this.quickNavStrip);
    this.keyboardRoot.appendChild(this.keyboardWrapper);
    this.hostContainer.appendChild(this.keyboardRoot);
  }

  private attachQuickNavEvents() {
    this.quickNavStrip.querySelectorAll("button").forEach((btn) => {
      const triggerAction = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();

        const action = btn.getAttribute("data-action");
        if (!action) return;

        if (action === "dismiss") {
          this.hide();
          if (this.options.onAction) {
            this.options.onAction("dismiss");
          }
          return;
        }

        this.handleNavAction(action);
        if (this.options.onAction) {
          this.options.onAction(action);
        }
      };

      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });
      btn.addEventListener("pointerdown", (e) => {
        triggerAction(e);
      });
      btn.addEventListener("touchstart", (e) => {
        e.stopPropagation();
      }, { passive: false });
      btn.addEventListener("touchend", (e) => {
        e.stopPropagation();
      }, { passive: false });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
  }

  public handleNavAction(action: string) {
    if (action === "esc") {
      this.executeEscAction();
    } else if (action === "tab") {
      this.insertText("  ");
    } else if (action === "left") {
      this.moveCursor(-1, this.shiftState !== "OFF");
    } else if (action === "right") {
      this.moveCursor(1, this.shiftState !== "OFF");
    } else if (action === "up") {
      this.moveCursorVertical(-1);
    } else if (action === "down") {
      this.moveCursorVertical(1);
    } else if (action === "home") {
      this.moveCursorToBoundary("home");
    } else if (action === "end") {
      this.moveCursorToBoundary("end");
    }
  }

  // --- Show & Hide Animation Control ---

  public show(target?: HTMLElement | null) {
    if (target) {
      this.activeTarget = target;
    }
    this.isVisibleState = true;
    this.keyboardRoot.style.pointerEvents = "auto";
    this.keyboardRoot.style.transform = "translateY(0)";
    this.keyboardRoot.style.opacity = "1";

    const kbHeight = this.getHeight() || 290;
    document.documentElement.style.setProperty("--expected-keyboard-height", `${kbHeight}px`);
    document.documentElement.style.setProperty("--keyboard-height", `${kbHeight}px`);

    if (this.options.adjustPageScroll) {
      if (this.hostContainer && this.hostContainer !== document.body) {
        this.hostContainer.style.paddingBottom = `${kbHeight}px`;
      }
      document.body.style.paddingBottom = `${kbHeight}px`;
    }

    if (this.activeTarget) {
      setTimeout(() => {
        try {
          this.activeTarget?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch {}
      }, 100);
    }

    if (this.options.onVisibilityChange) {
      this.options.onVisibilityChange(true);
    }
  }

  public hide() {
    this.lastHideTimestamp = Date.now();
    this.isVisibleState = false;
    this.keyboardRoot.style.transform = "translateY(100%)";
    this.keyboardRoot.style.opacity = "0";
    this.keyboardRoot.style.pointerEvents = "none";
    this.hideGestureBubble();

    document.documentElement.style.setProperty("--expected-keyboard-height", "0px");
    document.documentElement.style.setProperty("--keyboard-height", "0px");

    if (this.options.adjustPageScroll) {
      if (this.hostContainer && this.hostContainer !== document.body) {
        this.hostContainer.style.paddingBottom = "";
      }
      document.body.style.paddingBottom = "";
    }

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && typeof activeEl.blur === "function" && activeEl !== document.body) {
      try {
        activeEl.blur();
      } catch {}
    }
    if (this.activeTarget && typeof (this.activeTarget as any).blur === "function" && this.activeTarget !== document.body) {
      try {
        (this.activeTarget as any).blur();
      } catch {}
    }
    this.activeTarget = null;

    // Reset Latched Modifiers
    if (this.shiftState === "LATCHED") this.shiftState = "OFF";
    if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
    if (this.altState === "LATCHED") this.altState = "OFF";
    this.updateKeyboardVisuals();

    if (this.options.onVisibilityChange) {
      this.options.onVisibilityChange(false);
    }
  }

  public getHeight(): number {
    return this.keyboardRoot.offsetHeight || this.keyboardRoot.getBoundingClientRect().height || 0;
  }

  public toggle() {
    if (this.isVisibleState) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isVisible(): boolean {
    return this.isVisibleState;
  }

  // --- Target Input Attachment & Eligibility ---

  public isEligibleTarget(target: HTMLElement | null): boolean {
    if (!target) return false;
    if (this.keyboardRoot && this.keyboardRoot.contains(target)) return false;
    if (this.gestureBubble && this.gestureBubble.contains(target)) return false;
    if (
      target.closest &&
      target.closest("#expected-keyboard-root, #expected-gesture-bubble")
    ) {
      return false;
    }

    if (target.tagName === "TEXTAREA") return true;
    if (target.tagName === "INPUT") {
      const input = target as HTMLInputElement;
      const nonTextTypes = [
        "checkbox",
        "radio",
        "button",
        "submit",
        "reset",
        "image",
        "file",
        "range",
        "color",
        "hidden",
      ];
      if (nonTextTypes.includes((input.type || "").toLowerCase())) return false;
      if (input.hasAttribute("switch")) return false;
      return true;
    }
    if (target.getAttribute("contenteditable") === "true" || target.isContentEditable) return true;
    if (target.id === "terminal-view" || target.classList.contains("terminal-container")) return true;
    return false;
  }

  public getTargetElement(): HTMLInputElement | HTMLTextAreaElement | null {
    if (this.activeTarget && this.isEligibleTarget(this.activeTarget)) {
      if (this.activeTarget.tagName === "TEXTAREA" || this.activeTarget.tagName === "INPUT") {
        return this.activeTarget as HTMLInputElement | HTMLTextAreaElement;
      }
    }

    if (document.activeElement && this.isEligibleTarget(document.activeElement as HTMLElement)) {
      if (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT") {
        this.activeTarget = document.activeElement as HTMLElement;
        return document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      }
    }

    for (const el of this.attachedElements) {
      if (this.isEligibleTarget(el) && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
        this.activeTarget = el;
        return el as HTMLInputElement | HTMLTextAreaElement;
      }
    }

    return null;
  }

  public attach(element: HTMLElement) {
    if (!this.isEligibleTarget(element) && element.id !== "terminal-view") return;
    if (this.attachedElements.has(element)) return;
    this.attachedElements.add(element);

    const onFocus = () => {
      this.activeTarget = element;
      this.show(element);
    };

    const onPointerDown = () => {
      this.activeTarget = element;
      this.show(element);
    };

    const onBlur = () => {
      setTimeout(() => {
        const activeEl = document.activeElement as HTMLElement | null;
        if (!this.isEligibleTarget(activeEl)) {
          this.hide();
        }
      }, 60);
    };

    element.addEventListener("focus", onFocus);
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("blur", onBlur);
  }

  public detach(element?: HTMLElement) {
    if (element) {
      this.attachedElements.delete(element);
      if (this.activeTarget === element) {
        this.activeTarget = null;
      }
    } else {
      this.attachedElements.clear();
      this.activeTarget = null;
    }
  }

  public setActiveTarget(target: HTMLElement | null) {
    if (target && this.isEligibleTarget(target)) {
      this.activeTarget = target;
    } else if (!target) {
      this.activeTarget = null;
    }
  }

  public getActiveTarget(): HTMLElement | null {
    return this.activeTarget;
  }

  private scanAndAttachInputs() {
    if (typeof document === "undefined") return;
    const inputs = document.querySelectorAll("input, textarea, [contenteditable='true']");
    inputs.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (this.isEligibleTarget(htmlEl)) {
        this.attach(htmlEl);
      }
    });
  }

  private handleGlobalFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;

    if (this.keyboardRoot && this.keyboardRoot.contains(target)) return;
    if (this.gestureBubble && this.gestureBubble.contains(target)) return;
    if (target.closest && target.closest("#expected-keyboard-root, #expected-gesture-bubble")) return;

    if (this.isEligibleTarget(target)) {
      this.activeTarget = target;
      this.show(target);
    }
  }

  private handleGlobalFocusOut(e: FocusEvent) {
    if (!this.isVisibleState) return;

    setTimeout(() => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (!this.isEligibleTarget(activeEl)) {
        this.hide();
      }
    }, 40);
  }

  private handlePointerDownOutside(e: PointerEvent) {
    if (!this.isVisibleState) return;
    const target = e.target as HTMLElement;
    if (!target) return;

    if (
      (this.keyboardRoot && this.keyboardRoot.contains(target)) ||
      (this.gestureBubble && this.gestureBubble.contains(target)) ||
      (target.closest && target.closest("#expected-keyboard-root, #expected-gesture-bubble"))
    ) {
      return;
    }

    if (
      this.isEligibleTarget(target) ||
      this.attachedElements.has(target) ||
      (this.activeTarget && this.activeTarget === target)
    ) {
      return;
    }

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && typeof activeEl.blur === "function") {
      try {
        activeEl.blur();
      } catch {}
    }
    if (this.activeTarget && typeof (this.activeTarget as any).blur === "function") {
      try {
        (this.activeTarget as any).blur();
      } catch {}
    }

    this.hide();
  }

  public setCornerLabelsVisible(visible: boolean) {
    this.options.cornerLabelsVisible = visible;
    this.renderKeyboard();
  }

  public setQuickNavVisible(visible: boolean) {
    this.options.quickNavVisible = visible;
    this.quickNavStrip.style.display = visible ? "flex" : "none";
  }

  public setApplePaddingEnabled(enabled: boolean) {
    this.options.applePaddingEnabled = enabled;
    this.renderKeyboard();
  }

  public setSwipeDeadzone(px: number) {
    this.options.swipeDeadzone = px;
  }

  // --- Keyboard Rendering ---

  public renderKeyboard() {
    this.keyboardWrapper.innerHTML = "";
    const isShiftActive = this.shiftState !== "OFF";
    const layout = this.currentLayout;
    const isApple = this.options.applePaddingEnabled;

    this.keyboardWrapper.style.padding = isApple
      ? "4px 6px calc(env(safe-area-inset-bottom, 28px) + 26px) 6px"
      : "4px 6px calc(env(safe-area-inset-bottom, 8px) + 6px) 6px";

    layout.forEach((rowDef) => {
      const rowEl = document.createElement("div");
      rowEl.style.cssText = `
        display: flex;
        gap: 4px;
        width: 100%;
        justify-content: center;
        align-items: stretch;
      `;

      rowDef.forEach((keyDef) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "expected-key unexpected-key";
        const isSpecial = [
          "modifier",
          "action",
          "space",
          "backspace",
          "enter",
          "fn",
          "tab",
          "esc",
          "nav",
        ].includes(keyDef.type || "");

        btn.setAttribute("data-label", keyDef.label);
        btn.setAttribute("data-shift-label", keyDef.shiftLabel || "");
        btn.setAttribute("data-type", keyDef.type || "normal");
        btn.setAttribute("data-code", keyDef.code || "");

        let centerLabel = keyDef.label;
        if (isShiftActive && keyDef.shiftLabel) {
          centerLabel = keyDef.shiftLabel;
        } else if (
          isShiftActive &&
          !isSpecial &&
          centerLabel.length === 1 &&
          /[a-z]/.test(centerLabel)
        ) {
          centerLabel = centerLabel.toUpperCase();
        }

        let isModifierActive = false;
        let isModifierLocked = false;
        if (keyDef.code === "Shift" && this.shiftState !== "OFF") {
          isModifierActive = true;
          isModifierLocked = this.shiftState === "LOCKED";
        } else if (keyDef.code === "Control" && this.ctrlState !== "OFF") {
          isModifierActive = true;
          isModifierLocked = this.ctrlState === "LOCKED";
        } else if (keyDef.code === "Alt" && this.altState !== "OFF") {
          isModifierActive = true;
          isModifierLocked = this.altState === "LOCKED";
        }

        const flexGrow = keyDef.width || 1;

        btn.style.cssText = `
          flex: ${flexGrow};
          height: 48px;
          min-width: 0;
          border-radius: 7px;
          border: 1px solid ${
            isModifierActive
              ? "#38bdf8"
              : isSpecial
              ? "#30363d"
              : "#30363d"
          };
          background-color: ${
            isModifierLocked
              ? "#38bdf8"
              : isModifierActive
              ? "rgba(56, 189, 248, 0.2)"
              : isSpecial
              ? "#181d24"
              : "#21262d"
          };
          color: ${
            isModifierLocked
              ? "#0d1117"
              : isModifierActive
              ? "#38bdf8"
              : "#f0f6fc"
          };
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: none;
          box-shadow: 0 1.5px 3px rgba(0, 0, 0, 0.35);
          transition: transform 0.05s ease, background-color 0.1s ease, border-color 0.1s ease;
          padding: 0;
          overflow: hidden;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          font-family: inherit;
        `;

        btn.tabIndex = -1;
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });

        // Corner glyphs
        if (this.options.cornerLabelsVisible) {
          const corners = [
            { pos: "tl", val: keyDef.tl, style: "top: 2.5px; left: 3.5px;" },
            { pos: "tr", val: keyDef.tr, style: "top: 2.5px; right: 3.5px;" },
            { pos: "bl", val: keyDef.bl, style: "bottom: 2.5px; left: 3.5px;" },
            { pos: "br", val: keyDef.br, style: "bottom: 2.5px; right: 3.5px;" },
          ];

          corners.forEach(({ pos, val, style }) => {
            if (val) {
              const cornerEl = document.createElement("span");
              cornerEl.className = `key-corner key-corner-${pos}`;
              const isMultiChar = val.length > 1;
              cornerEl.style.cssText = `
                position: absolute;
                font-size: ${isMultiChar ? "8px" : "10px"};
                line-height: 1;
                font-weight: 700;
                font-family: 'Fira Code', monospace;
                color: #8b949e;
                pointer-events: none;
                opacity: 0.8;
                transition: color 0.1s, transform 0.1s;
                ${style}
              `;
              cornerEl.textContent = val;
              btn.appendChild(cornerEl);
            }
          });
        }

        // Center Label
        const centerSpan = document.createElement("span");
        centerSpan.className = "key-center-label";
        centerSpan.style.cssText = `
          font-size: ${
            keyDef.type === "space"
              ? "12px"
              : centerLabel.length > 2
              ? "12px"
              : "17px"
          };
          font-weight: 700;
          font-family: ${
            keyDef.type === "space"
              ? "-apple-system, sans-serif"
              : "'Fira Code', monospace"
          };
          pointer-events: none;
          letter-spacing: -0.2px;
          line-height: 1;
        `;
        centerSpan.textContent = centerLabel;
        btn.appendChild(centerSpan);

        this.attachKeyPointerEvents(btn, keyDef, centerLabel);
        rowEl.appendChild(btn);
      });

      this.keyboardWrapper.appendChild(rowEl);
    });

    // Native Bottom Spacing / Accessory Bar on Apple Platform
    if (isApple) {
      this.renderBottomAccessoryBar();
    }
  }

  private renderBottomAccessoryBar() {
    const bottomBar = document.createElement("div");
    bottomBar.id = "keyboard-bottom-accessory-bar";
    bottomBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px 0 12px;
      min-height: 36px;
      margin-top: 2px;
      pointer-events: none;
    `;

    const centerHint = document.createElement("div");
    centerHint.style.cssText = `
      font-size: 11px;
      opacity: 0.4;
      font-weight: 600;
      letter-spacing: 0.3px;
      pointer-events: none;
      color: #8b949e;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    centerHint.textContent = "Expected Keyboard";

    bottomBar.appendChild(centerHint);
    this.keyboardWrapper.appendChild(bottomBar);
  }

  public updateKeyboardVisuals() {
    const isShiftActive = this.shiftState !== "OFF";
    const keys = this.keyboardWrapper.querySelectorAll(
      ".unexpected-key"
    ) as NodeListOf<HTMLButtonElement>;

    keys.forEach((btn) => {
      const code = btn.getAttribute("data-code") || "";
      const defaultLabel = btn.getAttribute("data-label") || "";
      const shiftLabel = btn.getAttribute("data-shift-label") || "";
      const type = btn.getAttribute("data-type") || "normal";
      const isSpecial = [
        "modifier",
        "action",
        "space",
        "backspace",
        "enter",
        "fn",
        "tab",
        "esc",
        "nav",
      ].includes(type);

      let isModifierActive = false;
      let isModifierLocked = false;

      if (code === "Shift" && this.shiftState !== "OFF") {
        isModifierActive = true;
        isModifierLocked = this.shiftState === "LOCKED";
      } else if (code === "Control" && this.ctrlState !== "OFF") {
        isModifierActive = true;
        isModifierLocked = this.ctrlState === "LOCKED";
      } else if (code === "Alt" && this.altState !== "OFF") {
        isModifierActive = true;
        isModifierLocked = this.altState === "LOCKED";
      }

      let centerLabel = defaultLabel;
      if (isShiftActive && shiftLabel) {
        centerLabel = shiftLabel;
      } else if (
        isShiftActive &&
        !isSpecial &&
        centerLabel.length === 1 &&
        /[a-z]/.test(centerLabel)
      ) {
        centerLabel = centerLabel.toUpperCase();
      }

      const centerSpan = btn.querySelector(".key-center-label");
      if (centerSpan) {
        centerSpan.textContent = centerLabel;
      }

      btn.style.borderColor = isModifierActive
        ? "#38bdf8"
        : isSpecial
        ? "#30363d"
        : "#30363d";
      btn.style.backgroundColor = isModifierLocked
        ? "#38bdf8"
        : isModifierActive
        ? "rgba(56, 189, 248, 0.2)"
        : isSpecial
        ? "#181d24"
        : "#21262d";
      btn.style.color = isModifierLocked
        ? "#0d1117"
        : isModifierActive
        ? "#38bdf8"
        : "#f0f6fc";
    });
  }

  // --- Pointer & Touch Gesture Handling Engine ---

  private attachKeyPointerEvents(
    btnEl: HTMLElement,
    keyDef: KeyDef,
    defaultCenterLabel: string
  ) {
    const getCurrentCenterLabel = (): string => {
      const isShiftActive = this.shiftState !== "OFF";
      const isSpecial = [
        "modifier",
        "action",
        "space",
        "backspace",
        "enter",
        "fn",
        "tab",
        "esc",
        "nav",
      ].includes(keyDef.type || "");

      if (isShiftActive && keyDef.shiftLabel) {
        return keyDef.shiftLabel;
      }
      if (
        isShiftActive &&
        !isSpecial &&
        defaultCenterLabel.length === 1 &&
        /[a-z]/.test(defaultCenterLabel)
      ) {
        return defaultCenterLabel.toUpperCase();
      }
      if (
        !isShiftActive &&
        !isSpecial &&
        defaultCenterLabel.length === 1 &&
        /[A-Z]/.test(defaultCenterLabel)
      ) {
        return defaultCenterLabel.toLowerCase();
      }
      return defaultCenterLabel;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = this.getTargetElement();
      if (target) {
        try {
          target.focus({ preventScroll: true });
        } catch {}
      }

      const centerLabel = getCurrentCenterLabel();
      const touch: ActiveTouch = {
        pointerId: e.pointerId,
        btnEl,
        keyDef,
        centerLabel,
        startX: e.clientX,
        startY: e.clientY,
        spacebarLastX: e.clientX,
        spacebarLastY: e.clientY,
        activeCorner: "center",
        activeChar: centerLabel,
      };
      this.activeTouches.set(e.pointerId, touch);

      btnEl.style.transform = "scale(0.92)";
      btnEl.style.backgroundColor = "#38bdf8";
      btnEl.style.color = "#0d1117";

      this.showGestureBubble(e.clientX, e.clientY, centerLabel);
    };

    btnEl.addEventListener("pointerdown", onPointerDown);
    btnEl.addEventListener("pointerup", (e) => this.handlePointerUp(e));
    btnEl.addEventListener("pointercancel", (e) => this.handlePointerCancel(e));
  }

  private handlePointerMove(e: PointerEvent) {
    const touch = this.activeTouches.get(e.pointerId);
    if (!touch) return;

    // Spacebar Glide
    if (touch.keyDef.type === "space") {
      const deltaX = e.clientX - touch.spacebarLastX;
      const deltaY = e.clientY - touch.spacebarLastY;

      if (Math.abs(deltaX) > 12) {
        const step = deltaX > 0 ? 1 : -1;
        this.moveCursor(step, this.shiftState !== "OFF");
        touch.spacebarLastX = e.clientX;
        this.showGestureBubble(
          e.clientX,
          e.clientY,
          step > 0 ? "Caret ➔" : "⬅ Caret"
        );
      } else if (Math.abs(deltaY) > 18) {
        const stepY = deltaY > 0 ? 1 : -1;
        this.moveCursorVertical(stepY);
        touch.spacebarLastY = e.clientY;
        this.showGestureBubble(
          e.clientX,
          e.clientY,
          stepY > 0 ? "Line ▼" : "Line ▲"
        );
      }
      return;
    }

    // Corner Detection
    const dx = e.clientX - touch.startX;
    const dy = e.clientY - touch.startY;
    const dist = Math.hypot(dx, dy);
    const deadzone = this.options.swipeDeadzone || 10;

    if (dist > deadzone) {
      let detectedCorner: "tl" | "tr" | "bl" | "br" = "tl";
      if (dx < 0 && dy < 0) {
        detectedCorner = "tl";
      } else if (dx >= 0 && dy < 0) {
        detectedCorner = "tr";
      } else if (dx < 0 && dy >= 0) {
        detectedCorner = "bl";
      } else {
        detectedCorner = "br";
      }

      touch.activeCorner = detectedCorner;
      touch.activeChar =
        touch.keyDef[detectedCorner] || touch.centerLabel;
      this.highlightKeyCorner(touch.btnEl, detectedCorner);
    } else {
      touch.activeCorner = "center";
      touch.activeChar = touch.centerLabel;
      this.highlightKeyCorner(touch.btnEl, null);
    }

    this.showGestureBubble(e.clientX, e.clientY, touch.activeChar);
  }

  private handlePointerUp(e: PointerEvent) {
    const touch = this.activeTouches.get(e.pointerId);
    if (!touch) return;
    this.activeTouches.delete(e.pointerId);

    this.hideGestureBubble();
    touch.btnEl.style.transform = "scale(1)";
    this.highlightKeyCorner(touch.btnEl, null);
    this.updateKeyboardVisuals();

    if (this.handleShortcut(touch.activeChar)) return;
    this.executeKeyOutput(touch.keyDef, touch.activeCorner, touch.activeChar);

    if (this.options.onKey) {
      this.options.onKey(touch.keyDef, touch.activeCorner, touch.activeChar);
    }
  }

  private handlePointerCancel(e: PointerEvent) {
    const touch = this.activeTouches.get(e.pointerId);
    if (!touch) return;
    this.activeTouches.delete(e.pointerId);

    this.hideGestureBubble();
    touch.btnEl.style.transform = "scale(1)";
    this.highlightKeyCorner(touch.btnEl, null);
    this.updateKeyboardVisuals();

    const dx = e.clientX - touch.startX;
    const dy = e.clientY - touch.startY;
    if (Math.hypot(dx, dy) < 30) {
      if (this.handleShortcut(touch.activeChar)) return;
      this.executeKeyOutput(touch.keyDef, touch.activeCorner, touch.activeChar);
      if (this.options.onKey) {
        this.options.onKey(touch.keyDef, touch.activeCorner, touch.activeChar);
      }
    }
  }

  private highlightKeyCorner(
    btnEl: HTMLElement,
    corner: "tl" | "tr" | "bl" | "br" | null
  ) {
    const cornerEls = btnEl.querySelectorAll(".key-corner");
    cornerEls.forEach((el) => {
      (el as HTMLElement).style.color = "#8b949e";
      (el as HTMLElement).style.transform = "scale(1)";
      (el as HTMLElement).style.textShadow = "none";
    });

    if (corner) {
      const activeEl = btnEl.querySelector(
        `.key-corner-${corner}`
      ) as HTMLElement;
      if (activeEl) {
        activeEl.style.color = "#38bdf8";
        activeEl.style.transform = "scale(1.4)";
        activeEl.style.textShadow = "0 0 8px #38bdf8";
      }
    }
  }

  private showGestureBubble(x: number, y: number, text: string) {
    this.gestureBubble.style.display = "block";
    this.gestureBubble.style.left = `${x}px`;
    this.gestureBubble.style.top = `${y - 34}px`;
    this.gestureBubble.textContent = text;
  }

  private hideGestureBubble() {
    this.gestureBubble.style.display = "none";
  }

  // --- Output & Execution Engine ---

  private executeKeyOutput(
    keyDef: KeyDef,
    corner: string,
    targetValue: string
  ) {
    if (keyDef.type === "modifier" && keyDef.code && corner === "center") {
      this.handleModifierPress(keyDef.code);
      return;
    }

    if (targetValue === "Alt") {
      this.handleModifierPress("Alt");
      return;
    }

    if (targetValue === "🔒" && keyDef.code) {
      if (keyDef.code === "Shift")
        this.shiftState = this.shiftState === "LOCKED" ? "OFF" : "LOCKED";
      if (keyDef.code === "Control")
        this.ctrlState = this.ctrlState === "LOCKED" ? "OFF" : "LOCKED";
      if (keyDef.code === "Alt")
        this.altState = this.altState === "LOCKED" ? "OFF" : "LOCKED";
      this.updateKeyboardVisuals();
      return;
    }

    if (keyDef.type === "esc" || targetValue === "Esc") {
      this.executeEscAction();
      return;
    }

    if (
      keyDef.type === "tab" ||
      targetValue === "⇄" ||
      targetValue === "⇥" ||
      targetValue === "Tab"
    ) {
      this.insertText("  ");
      return;
    }

    if (keyDef.type === "backspace") {
      if (targetValue === "w⌫" || corner === "tl") {
        this.deleteText("word");
      } else if (targetValue === "⌦" || corner === "tr") {
        this.deleteText("forward");
      } else if (targetValue === "≡⌫" || corner === "bl") {
        this.deleteText("line");
      } else if (targetValue === "🗑" || corner === "br") {
        this.deleteText("all");
      } else {
        this.deleteText("char");
      }
      return;
    }

    if (keyDef.type === "space") {
      if (corner === "tl" && keyDef.tl) {
        this.insertText(keyDef.tl);
      } else if (corner === "tr" && keyDef.tr) {
        this.insertText(keyDef.tr);
      } else if (corner === "bl" && keyDef.bl) {
        this.insertText(keyDef.bl);
      } else if (corner === "br" && keyDef.br) {
        this.insertText(keyDef.br);
      } else {
        this.insertText(" ");
      }
      return;
    }

    if (keyDef.type === "enter") {
      this.insertText("\n");
      return;
    }

    if (targetValue) {
      this.insertText(targetValue);
    }
  }

  private executeEscAction() {
    if (this.options.onAction) {
      this.options.onAction("esc");
    }
  }

  private handleModifierPress(code: string) {
    const now = Date.now();

    if (code === "Shift") {
      if (now - this.lastShiftTapTime < 350) {
        this.shiftState = this.shiftState === "LOCKED" ? "OFF" : "LOCKED";
      } else {
        this.shiftState = this.shiftState === "OFF" ? "LATCHED" : "OFF";
      }
      this.lastShiftTapTime = now;
    } else if (code === "Control") {
      if (now - this.lastCtrlTapTime < 350) {
        this.ctrlState = this.ctrlState === "LOCKED" ? "OFF" : "LOCKED";
      } else {
        this.ctrlState = this.ctrlState === "OFF" ? "LATCHED" : "OFF";
      }
      this.lastCtrlTapTime = now;
    } else if (code === "Alt") {
      if (now - this.lastAltTapTime < 350) {
        this.altState = this.altState === "LOCKED" ? "OFF" : "LOCKED";
      } else {
        this.altState = this.altState === "OFF" ? "LATCHED" : "OFF";
      }
      this.lastAltTapTime = now;
    }

    this.updateKeyboardVisuals();
  }

  private handleShortcut(keyChar: string): boolean {
    if (this.ctrlState === "OFF") return false;
    const lower = keyChar.toLowerCase();

    if (lower === "c") {
      const target = this.getTargetElement();
      let textToCopy = "";
      if (target && "value" in target) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        textToCopy = start !== end ? target.value.slice(start, end) : target.value;
      }
      if (navigator.clipboard && textToCopy) {
        navigator.clipboard.writeText(textToCopy);
      }
      if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
      this.updateKeyboardVisuals();
      return true;
    } else if (lower === "v") {
      if (navigator.clipboard) {
        navigator.clipboard.readText().then((clip) => {
          if (clip) this.insertText(clip);
        });
      }
      if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
      this.updateKeyboardVisuals();
      return true;
    } else if (lower === "a") {
      const target = this.getTargetElement();
      if (target && "select" in target) {
        target.focus();
        target.select();
      }
      if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
      this.updateKeyboardVisuals();
      return true;
    } else if (lower === "w") {
      this.deleteText("word");
      if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
      this.updateKeyboardVisuals();
      return true;
    } else if (lower === "u") {
      this.deleteText("line");
      if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
      this.updateKeyboardVisuals();
      return true;
    }

    return false;
  }

  // --- Text & Caret Manipulation Methods ---

  public insertText(text: string) {
    const target = this.getTargetElement();
    if (target && "value" in target) {
      try {
        target.focus({ preventScroll: true });
      } catch {}

      const val = target.value ?? "";
      let start = target.selectionStart;
      let end = target.selectionEnd;

      if (start === null || start === undefined || start < 0) start = val.length;
      if (end === null || end === undefined || end < 0) end = val.length;

      let inserted = false;
      if (typeof target.setRangeText === "function") {
        try {
          target.setRangeText(text, start, end, "end");
          inserted = true;
        } catch {}
      }

      if (!inserted) {
        target.value = val.slice(0, start) + text + val.slice(end);
        const newPos = start + text.length;
        if (typeof target.setSelectionRange === "function") {
          try {
            target.setSelectionRange(newPos, newPos);
          } catch {}
        }
      }

      target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      target.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    }

    if (this.shiftState === "LATCHED") this.shiftState = "OFF";
    if (this.ctrlState === "LATCHED") this.ctrlState = "OFF";
    if (this.altState === "LATCHED") this.altState = "OFF";

    this.updateKeyboardVisuals();

    if (this.options.onInput) {
      this.options.onInput(text);
    }
  }

  public deleteText(type: "char" | "word" | "line" | "all" | "forward") {
    const target = this.getTargetElement();
    if (!target || !("value" in target)) {
      if (this.options.onAction) {
        this.options.onAction("backspace");
      }
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch {}

    const val = target.value ?? "";
    let start = target.selectionStart;
    let end = target.selectionEnd;

    if (start === null || start === undefined || start < 0) start = val.length;
    if (end === null || end === undefined || end < 0) end = val.length;

    let newStart = start;
    let newEnd = end;

    if (start !== end) {
      newStart = start;
      newEnd = end;
    } else if (type === "char") {
      if (start > 0) newStart = start - 1;
    } else if (type === "forward") {
      if (start < val.length) newEnd = start + 1;
    } else if (type === "word") {
      const left = val.slice(0, start);
      const match = left.match(/(\s*\S+\s*)$/);
      const delLen = match ? match[0].length : 1;
      newStart = Math.max(0, start - delLen);
    } else if (type === "line" || type === "all") {
      const left = val.slice(0, start);
      const lastNL = left.lastIndexOf("\n");
      newStart = lastNL === -1 ? 0 : lastNL + 1;
    }

    let deleted = false;
    if (typeof target.setRangeText === "function") {
      try {
        target.setRangeText("", newStart, newEnd, "end");
        deleted = true;
      } catch {}
    }

    if (!deleted) {
      target.value = val.slice(0, newStart) + val.slice(newEnd);
      if (typeof target.setSelectionRange === "function") {
        try {
          target.setSelectionRange(newStart, newStart);
        } catch {}
      }
    }

    target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

    if (this.options.onAction) {
      this.options.onAction("backspace");
    }
  }

  public moveCursor(delta: number, expandSelection = false) {
    const target = this.getTargetElement();
    if (!target || !("value" in target) || typeof target.setSelectionRange !== "function") return;

    target.focus();
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const val = target.value;

    if (expandSelection || this.shiftState !== "OFF") {
      const newEnd = Math.max(0, Math.min(val.length, end + delta));
      target.setSelectionRange(start, newEnd);
    } else {
      const basePos = delta > 0 ? end : start;
      const newPos = Math.max(0, Math.min(val.length, basePos + delta));
      target.setSelectionRange(newPos, newPos);
    }
  }

  public moveCursorVertical(lines: number) {
    const target = this.getTargetElement();
    if (!target || !("value" in target) || typeof target.setSelectionRange !== "function") return;

    const val = target.value;
    const pos = target.selectionStart ?? 0;
    const textBefore = val.slice(0, pos);
    const currentLines = textBefore.split("\n");
    const currentLineIndex = currentLines.length - 1;
    const currentCol = currentLines[currentLineIndex].length;
    const allLines = val.split("\n");

    const targetLineIndex = Math.max(
      0,
      Math.min(allLines.length - 1, currentLineIndex + lines)
    );
    let newPos = 0;
    for (let i = 0; i < targetLineIndex; i++) {
      newPos += allLines[i].length + 1;
    }
    newPos += Math.min(currentCol, allLines[targetLineIndex].length);

    target.focus();
    target.setSelectionRange(newPos, newPos);
  }

  public moveCursorToBoundary(boundary: "home" | "end") {
    const target = this.getTargetElement();
    if (!target || !("value" in target) || typeof target.setSelectionRange !== "function") return;

    const val = target.value;
    const pos = target.selectionStart ?? 0;

    if (boundary === "home") {
      const lineStart = val.lastIndexOf("\n", pos - 1);
      const newPos = lineStart === -1 ? 0 : lineStart + 1;
      target.setSelectionRange(newPos, newPos);
    } else {
      const lineEnd = val.indexOf("\n", pos);
      const newPos = lineEnd === -1 ? val.length : lineEnd;
      target.setSelectionRange(newPos, newPos);
    }
  }

  public destroy() {
    window.removeEventListener("pointermove", this.globalPointerMoveHandler);
    window.removeEventListener("pointerup", this.globalPointerUpHandler);
    window.removeEventListener("pointercancel", this.globalPointerCancelHandler);
    document.removeEventListener("pointerup", this.globalPointerUpHandler);
    document.removeEventListener("pointercancel", this.globalPointerCancelHandler);
    document.removeEventListener("focusin", this.globalFocusInHandler, { capture: true });
    document.removeEventListener("focusout", this.globalFocusOutHandler, { capture: true });
    document.removeEventListener("pointerdown", this.globalPointerDownOutsideHandler, { capture: true });

    this.keyboardRoot.remove();
    this.gestureBubble.remove();
    this.attachedElements.clear();
  }
}

export const UnexpectedKeyboard = ExpectedKeyboard;

