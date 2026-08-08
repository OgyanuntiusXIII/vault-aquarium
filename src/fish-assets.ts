import bodyBase from "../assets/fish/betta/10_body_base.png";
import bodyLine from "../assets/fish/betta/11_body_line.png";
import finsBase from "../assets/fish/betta/20_fins_base.png";
import finsLine from "../assets/fish/betta/21_fins_line.png";
import patternBase from "../assets/fish/betta/30_pattern_base.png";
import pectoralBase from "../assets/fish/betta/40_pectoral_base.png";
import pectoralLine from "../assets/fish/betta/41_pectoral_line.png";
import type { FishAssetUrls } from "./fish-renderer";

/** 公式配布が取得するmain.jsだけで描画できるよう、PNGをData URLとしてバンドルする。 */
export const BETTA_ASSET_URLS: FishAssetUrls = {
  bodyBase,
  bodyLine,
  finsBase,
  finsLine,
  patternBase,
  pectoralBase,
  pectoralLine,
};
