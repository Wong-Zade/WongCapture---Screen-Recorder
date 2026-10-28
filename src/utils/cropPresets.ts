import type { CropRegion, SelectionPreset } from '../types';

const TARGET_ASPECTS: Partial<Record<SelectionPreset, number>> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
};

/**
 * The area a preset selects, as fractions (0..1) of the captured source.
 * The box has the preset's true shape in PIXELS whatever shape the source is (16:9 screen, ultrawide, a 4:3 window...),
 * fills ~85% of the source and sits in the centre.
 */
export function presetRegion(preset: SelectionPreset, sourceWidth: number, sourceHeight: number): CropRegion {
  if (preset === 'full') {
    return { enabled: false, preset: 'full', x: 0, y: 0, width: 1, height: 1 };
  }

  const target = TARGET_ASPECTS[preset];
  let width = 0.8;
  let height = 0.7;

  if (target) {
    const sourceAspect = sourceWidth / (sourceHeight || 1);
    if (target < sourceAspect) {
      height = 0.85;
      width = (height * target) / sourceAspect;
    } else {
      width = 0.85;
      height = (width * sourceAspect) / target;
    }
  }

  return {
    enabled: true,
    preset,
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  };
}
