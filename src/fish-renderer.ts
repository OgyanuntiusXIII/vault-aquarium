import type { FishAppearance, VaultAquariumSettings } from "./types";
import { clamp, copyAppearance, lerpAppearance } from "./utils";

export interface FishAssetUrls {
  bodyBase: string;
  bodyLine: string;
  finsBase: string;
  finsLine: string;
  patternBase: string;
  pectoralBase: string;
  pectoralLine: string;
}

type AppearanceListener = (appearance: FishAppearance) => void;

interface DartMotion {
  startedAt: number;
  duration: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  startX: number;
  startY: number;
  moved: boolean;
}

const APPEARANCE_TIME_CONSTANT_MS = 6 * 60 * 60 * 1000;
const DRAG_THRESHOLD_PX = 5;
// 素材PNGは実魚領域(1753x1316)へクロップ済みなので、キャンバスは表示枠と一致する。
// 旧素材(3489x2617・余白込み)時代はここでオフセットしてクロップしていた。
const CANVAS_TO_CROP_WIDTH = 1;
const CANVAS_TO_CROP_HEIGHT = 1316 / 1753;
const CROP_LEFT = 0;
const CROP_TOP = 0;

export class FishRenderer {
  private readonly overlayEl: HTMLDivElement;
  private readonly fishButtonEl: HTMLButtonElement;
  private readonly visualEl: HTMLDivElement;
  private readonly canvasEl: HTMLDivElement;
  private readonly actionMenuEl: HTMLDivElement;
  private readonly patternEls: HTMLDivElement[] = [];
  private animationFrame = 0;
  private previousFrameAt = performance.now();
  private lastAppearanceNotificationAt = 0;
  private x = Math.max(24, window.innerWidth * 0.18);
  private baseY = Math.max(90, window.innerHeight * 0.62);
  private direction: 1 | -1 = 1;
  private visible = true;
  private actionOpen = false;
  private dartMotion: DartMotion | null = null;
  private dragState: DragState | null = null;
  private settings: VaultAquariumSettings;
  private currentAppearance: FishAppearance;
  private targetAppearance: FishAppearance;

  constructor(
    assets: FishAssetUrls,
    settings: VaultAquariumSettings,
    currentAppearance: FishAppearance,
    targetAppearance: FishAppearance,
    private readonly onDartStart: () => void,
    private readonly onStatus: (anchor: HTMLElement) => void,
    private readonly onHide: () => void,
    private readonly onAppearanceChanged: AppearanceListener,
  ) {
    this.settings = settings;
    this.currentAppearance = copyAppearance(currentAppearance);
    this.targetAppearance = copyAppearance(targetAppearance);

    this.overlayEl = document.body.createDiv({ cls: "vault-aquarium-overlay" });
    this.fishButtonEl = this.overlayEl.createEl("button", {
      cls: "vault-aquarium-fish-button",
      attr: {
        type: "button",
        "aria-label": `${settings.fishName}の情報を表示`,
      },
    });
    this.visualEl = this.fishButtonEl.createDiv({
      cls: "vault-aquarium-fish-visual",
    });
    this.canvasEl = this.visualEl.createDiv({
      cls: "vault-aquarium-canvas",
    });
    this.actionMenuEl = this.overlayEl.createDiv({
      cls: "vault-aquarium-action-menu",
      attr: { "aria-hidden": "true" },
    });
    const statusButton = this.actionMenuEl.createEl("button", {
      cls: "vault-aquarium-action-button is-primary",
      text: "ベタのステータス",
      attr: { type: "button" },
    });
    const hideButton = this.actionMenuEl.createEl("button", {
      cls: "vault-aquarium-action-button",
      text: "隠す",
      attr: { type: "button" },
    });

    this.buildLayers(assets);
    this.fishButtonEl.addEventListener("pointerdown", this.handlePointerDown);
    this.fishButtonEl.addEventListener("pointermove", this.handlePointerMove);
    this.fishButtonEl.addEventListener("pointerup", this.handlePointerUp);
    this.fishButtonEl.addEventListener("pointercancel", this.handlePointerCancel);
    this.fishButtonEl.addEventListener("click", this.handleClick);
    statusButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.setActionOpen(false);
      this.onStatus(this.fishButtonEl);
    });
    hideButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.setActionOpen(false);
      this.onHide();
    });
    document.addEventListener("pointerdown", this.handleOutsidePointer);
    this.applySettings(settings);
    this.applyAppearance(this.currentAppearance);
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.fishButtonEl.removeEventListener("pointerdown", this.handlePointerDown);
    this.fishButtonEl.removeEventListener("pointermove", this.handlePointerMove);
    this.fishButtonEl.removeEventListener("pointerup", this.handlePointerUp);
    this.fishButtonEl.removeEventListener("pointercancel", this.handlePointerCancel);
    this.fishButtonEl.removeEventListener("click", this.handleClick);
    document.removeEventListener("pointerdown", this.handleOutsidePointer);
    this.overlayEl.remove();
  }

  applySettings(settings: VaultAquariumSettings): void {
    this.settings = settings;
    const { width: viewportWidth } = this.getViewportSize();
    const size = Math.min(settings.fishSize, viewportWidth * 0.72);
    this.visualEl.style.width = `${size}px`;
    this.visualEl.style.height = `${size * (1316 / 1753)}px`;
    this.canvasEl.style.width = `${size * CANVAS_TO_CROP_WIDTH}px`;
    this.canvasEl.style.height = `${size * CANVAS_TO_CROP_HEIGHT}px`;
    this.canvasEl.style.left = `${-size * CROP_LEFT}px`;
    this.canvasEl.style.top = `${-size * CROP_TOP}px`;
    // 線画は常に黒・不透明。透明度設定は着色レイヤーだけへ適用する。
    this.fishButtonEl.setCssStyles({ opacity: "1" });
    this.canvasEl.style.setProperty("--fish-fill-opacity", `${settings.opacity}`);
    this.fishButtonEl.setAttribute(
      "aria-label",
      `${settings.fishName}の情報を表示`,
    );
    this.updateDisplay();
  }

  setContextVisible(visible: boolean): void {
    this.visible = visible;
    this.updateDisplay();
  }

  setTargetAppearance(appearance: FishAppearance): void {
    this.targetAppearance = copyAppearance(appearance);
  }

  setCurrentAppearance(appearance: FishAppearance): void {
    this.currentAppearance = copyAppearance(appearance);
    this.applyAppearance(this.currentAppearance);
  }

  getCurrentAppearance(): FishAppearance {
    return copyAppearance(this.currentAppearance);
  }

  private updateDisplay(): void {
    if (!this.settings.showFish || !this.visible) this.setActionOpen(false);
    this.overlayEl.toggleClass(
      "is-hidden",
      !this.settings.showFish || !this.visible,
    );
  }

  private readonly handleOutsidePointer = (event: PointerEvent): void => {
    if (
      this.actionOpen &&
      event.target instanceof Node &&
      !this.actionMenuEl.contains(event.target) &&
      !this.fishButtonEl.contains(event.target)
    ) {
      this.setActionOpen(false);
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0) return;
    this.dartMotion = null;
    this.fishButtonEl.removeClass("is-darting");
    this.dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      startX: this.x,
      startY: this.baseY,
      moved: false,
    };
    this.fishButtonEl.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const drag = this.dragState;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
      drag.moved = true;
      this.setActionOpen(false);
      this.onDartStart();
      this.fishButtonEl.addClass("is-dragging");
    }
    if (!drag.moved) return;

    const width = this.visualEl.getBoundingClientRect().width;
    const height = this.visualEl.getBoundingClientRect().height;
    const { width: viewportWidth, height: viewportHeight } =
      this.getViewportSize();
    this.x = clamp(drag.startX + deltaX, 16, viewportWidth - width - 16);
    this.baseY = clamp(
      drag.startY + deltaY,
      72,
      viewportHeight - height - 24,
    );
    const horizontalStep = event.clientX - drag.lastClientX;
    if (Math.abs(horizontalStep) >= 0.5) {
      this.direction = horizontalStep > 0 ? 1 : -1;
    }
    drag.lastClientX = event.clientX;
    event.preventDefault();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const drag = this.dragState;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (this.fishButtonEl.hasPointerCapture(event.pointerId)) {
      this.fishButtonEl.releasePointerCapture(event.pointerId);
    }
    this.dragState = null;
    this.fishButtonEl.removeClass("is-dragging");
    if (!drag.moved) this.startDart(performance.now());
    event.preventDefault();
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.dragState?.pointerId !== event.pointerId) return;
    this.dragState = null;
    this.fishButtonEl.removeClass("is-dragging");
  };

  private readonly handleClick = (event: MouseEvent): void => {
    event.stopPropagation();
    // ポインター操作はpointerupで処理済み。detail=0のキーボード操作だけ補完する。
    if (event.detail === 0) this.startDart(performance.now());
  };

  private setActionOpen(open: boolean): void {
    this.actionOpen = open;
    this.actionMenuEl.toggleClass("is-open", open);
    this.actionMenuEl.setAttribute("aria-hidden", open ? "false" : "true");
    this.fishButtonEl.setAttribute("aria-expanded", open ? "true" : "false");
  }

  private startDart(now: number): void {
    if (this.dartMotion) return;
    this.setActionOpen(false);
    this.onDartStart();
    const size = this.visualEl.getBoundingClientRect().width;
    const height = this.visualEl.getBoundingClientRect().height;
    const { width: viewportWidth, height: viewportHeight } =
      this.getViewportSize();
    const minimumX = 16;
    const maximumX = Math.max(minimumX, viewportWidth - size - 16);
    const maximumY = Math.max(72, viewportHeight - height - 24);
    const midpointX = (minimumX + maximumX) / 2;
    const targetX =
      this.x < midpointX
        ? minimumX + (maximumX - minimumX) * 0.78
        : minimumX + (maximumX - minimumX) * 0.16;
    const verticalShift = this.baseY < viewportHeight / 2 ? 120 : -120;
    const targetY = clamp(this.baseY + verticalShift, 72, maximumY);
    this.direction = targetX > this.x ? 1 : -1;
    this.dartMotion = {
      startedAt: now,
      duration: 720,
      startX: this.x,
      startY: this.baseY,
      targetX,
      targetY,
    };
    this.fishButtonEl.addClass("is-darting");
  }

  private buildLayers(assets: FishAssetUrls): void {
    const finsMotion = this.canvasEl.createDiv({
      cls: "vault-aquarium-layer-group vault-aquarium-fins-motion",
    });
    this.addMaskLayer(finsMotion, assets.finsBase, [
      "vault-aquarium-layer",
      "vault-aquarium-fins-base",
    ]);
    this.patternEls.push(
      this.addMaskLayer(finsMotion, assets.patternBase, [
        "vault-aquarium-layer",
        "vault-aquarium-pattern",
      ]),
    );
    this.addMaskLayer(this.canvasEl, assets.bodyBase, [
      "vault-aquarium-layer",
      "vault-aquarium-body-base",
    ]);

    const pectoralMotion = this.canvasEl.createDiv({
      cls: "vault-aquarium-layer-group vault-aquarium-pectoral-motion",
    });
    this.addMaskLayer(pectoralMotion, assets.pectoralBase, [
      "vault-aquarium-layer",
      "vault-aquarium-pectoral-base",
    ]);
    this.patternEls.push(
      this.addMaskLayer(pectoralMotion, assets.pectoralLine, [
        "vault-aquarium-layer",
        "vault-aquarium-pattern",
        "vault-aquarium-pectoral-pattern",
      ]),
    );
    // 線画レイヤーはすべての塗り・模様より後に追加して最前面へ置く。
    const finsLineMotion = this.canvasEl.createDiv({
      cls: "vault-aquarium-layer-group vault-aquarium-fins-line-motion",
    });
    this.addMaskLayer(finsLineMotion, assets.finsLine, [
      "vault-aquarium-layer",
      "vault-aquarium-line",
    ]);
    this.addMaskLayer(this.canvasEl, assets.bodyLine, [
      "vault-aquarium-layer",
      "vault-aquarium-line",
    ]);
  }

  private addMaskLayer(
    parent: HTMLElement,
    url: string,
    classes: string[],
  ): HTMLDivElement {
    const element = parent.createDiv({ cls: classes.join(" ") });
    const image = `url(\"${url}\")`;
    element.style.maskImage = image;
    element.style.setProperty("-webkit-mask-image", image);
    return element;
  }

  private readonly tick = (now: number): void => {
    const deltaMs = Math.min(100, Math.max(0, now - this.previousFrameAt));
    this.previousFrameAt = now;
    this.moveFish(now, deltaMs);

    const blend = 1 - Math.exp(-deltaMs / APPEARANCE_TIME_CONSTANT_MS);
    this.currentAppearance = lerpAppearance(
      this.currentAppearance,
      this.targetAppearance,
      blend,
    );
    this.applyAppearance(this.currentAppearance);

    if (now - this.lastAppearanceNotificationAt >= 5000) {
      this.lastAppearanceNotificationAt = now;
      this.onAppearanceChanged(copyAppearance(this.currentAppearance));
    }
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private moveFish(now: number, deltaMs: number): void {
    const size = this.visualEl.getBoundingClientRect().width;
    const { width: viewportWidth, height: viewportHeight } =
      this.getViewportSize();
    const minimumX = 16;
    const maximumX = Math.max(minimumX, viewportWidth - size - 16);
    const height = this.visualEl.getBoundingClientRect().height;
    const maxY = Math.max(72, viewportHeight - height - 24);
    if (this.dartMotion) {
      const progress = clamp(
        (now - this.dartMotion.startedAt) / this.dartMotion.duration,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      this.x =
        this.dartMotion.startX +
        (this.dartMotion.targetX - this.dartMotion.startX) * eased;
      this.baseY =
        this.dartMotion.startY +
        (this.dartMotion.targetY - this.dartMotion.startY) * eased;
      if (progress >= 1) {
        this.x = this.dartMotion.targetX;
        this.baseY = this.dartMotion.targetY;
        this.dartMotion = null;
        this.fishButtonEl.removeClass("is-darting");
        this.setActionOpen(true);
      }
    } else if (!this.dragState?.moved) {
      this.x += this.direction * this.settings.swimSpeed * (deltaMs / 1000);
      if (this.x >= maximumX) {
        this.x = maximumX;
        this.direction = -1;
      } else if (this.x <= minimumX) {
        this.x = minimumX;
        this.direction = 1;
      }
      this.baseY = clamp(this.baseY, 72, maxY);
    } else {
      this.x = clamp(this.x, minimumX, maximumX);
      this.baseY = clamp(this.baseY, 72, maxY);
    }
    const bob = Math.sin(now / 2200) * 7;
    const renderedY = this.baseY + bob;
    this.fishButtonEl.style.transform = `translate3d(${this.x}px, ${renderedY}px, 0)`;
    // 元絵は左向き。進行方向に合わせて反転する。
    this.visualEl.style.transform = `scaleX(${this.direction === -1 ? 1 : -1})`;
    if (this.actionOpen) {
      const menuWidth = this.actionMenuEl.getBoundingClientRect().width;
      const menuHeight = this.actionMenuEl.getBoundingClientRect().height;
      const menuX = clamp(
        this.x + size / 2 - menuWidth / 2,
        8,
        viewportWidth - menuWidth - 8,
      );
      const belowY = renderedY + height + 8;
      const menuY =
        belowY + menuHeight <= viewportHeight - 8
          ? belowY
          : Math.max(8, renderedY - menuHeight - 8);
      this.actionMenuEl.style.transform = `translate3d(${menuX}px, ${menuY}px, 0)`;
    }
  }

  private getViewportSize(): { width: number; height: number } {
    return {
      width: this.overlayEl.clientWidth || window.innerWidth,
      height: this.overlayEl.clientHeight || window.innerHeight,
    };
  }

  private applyAppearance(appearance: FishAppearance): void {
    this.canvasEl.style.setProperty("--fish-body", appearance.bodyColor);
    this.canvasEl.style.setProperty("--fish-fin", appearance.finColor);
    this.canvasEl.setCssProps({ "--fish-line": "var(--text-normal)" });
    this.canvasEl.style.setProperty(
      "--fish-detail",
      `${appearance.structureDetail}`,
    );
    this.canvasEl.style.setProperty(
      "--fish-softness",
      `${appearance.boundarySoftness * 0.65}px`,
    );

    const background = this.patternBackground(appearance);
    for (const element of this.patternEls) {
      element.style.background = background;
      // 模様PNG自体が完成形なので、量パラメータでは切らず薄めず全表示する。
      element.setCssStyles({
        opacity: "var(--fish-fill-opacity)",
        clipPath: "none",
      });
      element.style.filter = `blur(${appearance.boundarySoftness * 0.55}px)`;
      element.style.backgroundSize = this.patternSize(appearance);
    }
    this.canvasEl.dataset.patternType = appearance.patternType;
  }

  private patternBackground(appearance: FishAppearance): string {
    const colors = appearance.accentColors.length
      ? appearance.accentColors
      : [appearance.patternColor];
    const first = colors[0] ?? appearance.patternColor;
    const second = colors[1] ?? appearance.patternColor;
    const third = colors[2] ?? first;

    if (appearance.patternType === "bicolor") {
      return `linear-gradient(105deg, ${first} 0 49%, ${second} 51% 100%)`;
    }
    if (appearance.patternType === "marble") {
      return `conic-gradient(from 35deg at 55% 50%, ${first}, ${second}, ${third}, ${first})`;
    }
    if (appearance.patternType === "spots") {
      const spot = Math.round(7 + appearance.fragmentation * 9);
      return [
        `radial-gradient(circle at 28% 40%, ${first} 0 ${spot}%, transparent ${spot + 2}%)`,
        `radial-gradient(circle at 68% 58%, ${second} 0 ${spot - 1}%, transparent ${spot + 1}%)`,
        `radial-gradient(circle at 48% 76%, ${third} 0 ${spot - 2}%, transparent ${spot}%)`,
        `linear-gradient(110deg, ${appearance.patternColor}, ${first})`,
      ].join(", ");
    }
    return `linear-gradient(105deg, ${appearance.patternColor}, ${first}, ${second})`;
  }

  private patternSize(appearance: FishAppearance): string {
    if (appearance.patternType !== "spots") return "100% 100%";
    const scale = Math.round(
      94 - appearance.fragmentation * 38 - appearance.structureDetail * 12,
    );
    return `${scale}% ${scale}%`;
  }
}
