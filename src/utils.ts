import type { FishAppearance } from "./types";

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

const normalizeHex = (hex: string): string => {
  const value = hex.replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return value
      .split("")
      .map((character) => character + character)
      .join("");
  }
  return /^[0-9a-f]{6}$/i.test(value) ? value : "808080";
};

export function lerpColor(from: string, to: string, amount: number): string {
  const start = normalizeHex(from);
  const end = normalizeHex(to);
  const channels = [0, 2, 4].map((index) => {
    const a = Number.parseInt(start.slice(index, index + 2), 16);
    const b = Number.parseInt(end.slice(index, index + 2), 16);
    return Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

export function colorDistance(a: string, b: string): number {
  const left = normalizeHex(a);
  const right = normalizeHex(b);
  return Math.sqrt(
    [0, 2, 4]
      .map((index) => {
        const difference =
          Number.parseInt(left.slice(index, index + 2), 16) -
          Number.parseInt(right.slice(index, index + 2), 16);
        return difference * difference;
      })
      .reduce((sum, value) => sum + value, 0),
  );
}

export function lerpAppearance(
  current: FishAppearance,
  target: FishAppearance,
  amount: number,
): FishAppearance {
  const accentCount = Math.max(
    1,
    current.accentColors.length,
    target.accentColors.length,
  );
  const currentAccents = current.accentColors.length
    ? current.accentColors
    : [current.patternColor];
  const targetAccents = target.accentColors.length
    ? target.accentColors
    : [target.patternColor];

  const result: FishAppearance = {
    bodyColor: lerpColor(current.bodyColor, target.bodyColor, amount),
    finColor: lerpColor(current.finColor, target.finColor, amount),
    patternColor: lerpColor(current.patternColor, target.patternColor, amount),
    accentColors: Array.from({ length: accentCount }, (_, index) =>
      lerpColor(
        currentAccents[index % currentAccents.length],
        targetAccents[index % targetAccents.length],
        amount,
      ),
    ),
    patternAmount:
      current.patternAmount +
      (target.patternAmount - current.patternAmount) * amount,
    patternType: current.patternType,
    boundarySoftness:
      current.boundarySoftness +
      (target.boundarySoftness - current.boundarySoftness) * amount,
    fragmentation:
      current.fragmentation +
      (target.fragmentation - current.fragmentation) * amount,
    structureDetail:
      current.structureDetail +
      (target.structureDetail - current.structureDetail) * amount,
  };

  const closeEnough =
    colorDistance(result.bodyColor, target.bodyColor) < 4 &&
    colorDistance(result.finColor, target.finColor) < 4 &&
    Math.abs(result.patternAmount - target.patternAmount) < 0.02;
  result.patternType = closeEnough ? target.patternType : current.patternType;
  return result;
}

export function copyAppearance(appearance: FishAppearance): FishAppearance {
  return {
    ...appearance,
    accentColors: [...appearance.accentColors],
  };
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatJapaneseDate(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
