import { ShapeGenerator, createRectangle } from './ShapeGenerator';
import type { MassingShape, ShapeDimensions } from '../types';

export class DonutShape extends ShapeGenerator {
  generate(dimensions: ShapeDimensions): MassingShape {
    const dims = this.normalizeDimensions(dimensions);

    const outline = createRectangle(dims.width, dims.height);

    const thickness = Math.min(dims.width, dims.height) * 0.2;

    const innerWidth = dims.width - 2 * thickness;
    const innerHeight = dims.height - 2 * thickness;

    const hole = createRectangle(innerWidth, innerHeight);

    return {
      type: 'donut',
      outline,
      interior: [hole]
    };
  }
}
