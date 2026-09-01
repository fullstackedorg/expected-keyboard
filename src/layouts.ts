import { KeyboardLayout, KeyboardRow } from "./types";

export const LAYOUT_QWERTY: KeyboardLayout = [
  // Row 1 (10 keys)
  [
    { label: "q", tr: "1", bl: "Esc", shiftLabel: "Q" },
    { label: "w", tl: "~", tr: "2", bl: "@", shiftLabel: "W" },
    { label: "e", tl: "!", tr: "3", bl: "#", shiftLabel: "E" },
    { label: "r", tr: "4", bl: "$", shiftLabel: "R" },
    { label: "t", tr: "5", bl: "%", shiftLabel: "T" },
    { label: "y", tr: "6", bl: "^", shiftLabel: "Y" },
    { label: "u", tr: "7", bl: "&", shiftLabel: "U" },
    { label: "i", tr: "8", bl: "*", shiftLabel: "I" },
    { label: "o", tr: "9", bl: "(", br: ")", shiftLabel: "O" },
    { label: "p", tr: "0", shiftLabel: "P" },
  ],
  // Row 2 (9 keys)
  [
    { label: "a", tl: "⇄", tr: "`", shiftLabel: "A" },
    { label: "s", shiftLabel: "S" },
    { label: "d", shiftLabel: "D" },
    { label: "f", shiftLabel: "F" },
    { label: "g", tr: "-", bl: "_", shiftLabel: "G" },
    { label: "h", tr: "=", bl: "+", shiftLabel: "H" },
    { label: "j", bl: "{", br: "}", shiftLabel: "J" },
    { label: "k", bl: "[", br: "]", shiftLabel: "K" },
    { label: "l", tr: "|", bl: "\\", shiftLabel: "L" },
  ],
  // Row 3 (9 keys)
  [
    { label: "⇧", tl: "⇪", type: "modifier", code: "Shift", width: 1.35 },
    { label: "z", shiftLabel: "Z" },
    { label: "x", shiftLabel: "X" },
    { label: "c", tr: "<", bl: ".", shiftLabel: "C" },
    { label: "v", tr: ">", bl: ",", shiftLabel: "V" },
    { label: "b", tr: "?", bl: "/", shiftLabel: "B" },
    { label: "n", tr: ":", bl: ";", shiftLabel: "N" },
    { label: "m", tr: "\"", bl: "'", shiftLabel: "M" },
    { label: "⌫", tl: "w⌫", tr: "⌦", type: "backspace", width: 1.35 },
  ],
  // Row 4
  [
    { label: "Ctrl", tl: "🔒", bl: "Alt", type: "modifier", code: "Control", width: 1.3 },
    { label: "␣ Space", tl: "_", type: "space", width: 6.4 },
    { label: "Enter", tl: "↵", tr: "▶", type: "enter", width: 1.5 },
  ],
];

export const LAYOUT_PROGRAMMER_QWERTY = LAYOUT_QWERTY;
export const DEFAULT_LAYOUT = LAYOUT_QWERTY;
