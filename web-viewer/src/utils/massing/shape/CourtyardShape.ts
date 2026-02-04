import { ShapeGenerator, createRectangle } from './ShapeGenerator';
import type { MassingShape, ShapeDimensions } from '../types';

export class CourtyardShape extends ShapeGenerator {
  generate(dimensions: ShapeDimensions): MassingShape {
    const dims = this.normalizeDimensions(dimensions);

    const outline = createRectangle(dims.width, dims.height);

    const courtyard = createRectangle(
      dims.courtyardWidth,
      dims.courtyardDepth
    );

    return {
      type: 'courtyard',
      outline,
      interior: [courtyard]
    };
  }
}
