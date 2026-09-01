export type ModifierType = "normal" | "modifier" | "action" | "space" | "backspace" | "enter" | "fn" | "tab" | "esc" | "nav";

export interface KeyDef {
  id?: string;
  label: string;
  shiftLabel?: string;
  tl?: string;
  tr?: string;
  bl?: string;
  br?: string;
  type?: ModifierType;
  width?: number; // Flex grow weight
  code?: string;
}

export type KeyboardRow = KeyDef[];
export type KeyboardLayout = KeyboardRow[];

export type ModifierState = "OFF" | "LATCHED" | "LOCKED";

export interface ActiveTouch {
  pointerId: number;
  btnEl: HTMLElement;
  keyDef: KeyDef;
  centerLabel: string;
  startX: number;
  startY: number;
  spacebarLastX: number;
  spacebarLastY: number;
  activeCorner: "tl" | "tr" | "bl" | "br" | "center";
  activeChar: string;
}

export interface KeyboardOptions {
  layout?: KeyboardLayout;
  cornerLabelsVisible?: boolean;
  quickNavVisible?: boolean;
  applePaddingEnabled?: boolean;
  swipeDeadzone?: number;
  container?: HTMLElement;
  autoAttachInputs?: boolean;
  adjustPageScroll?: boolean;
  onInput?: (char: string) => void;
  onAction?: (action: string) => void;
  onKey?: (keyDef: KeyDef, corner: string, char: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
}
