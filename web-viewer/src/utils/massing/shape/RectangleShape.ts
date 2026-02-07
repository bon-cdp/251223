import { ShapeGenerator, createRectangle } from './ShapeGenerator';
import type { MassingShape, ShapeDimensions } from '../types';

export class RectangleShape extends ShapeGenerator {
  generate(dimensions: ShapeDimensions): MassingShape {
    const dims = this.normalizeDimensions(dimensions);

    const outline = createRectangle(dims.width, dims.height);

    return {
      type: 'rectangle',
      outline,
      interior: undefined
    };
  }
}
