/**
 * Metrics Sidebar - displays building metrics, costs, and unit counts
 * Updated for V3 with full configuration support
 */

import type { FullBuildingConfig, MassingMetrics } from '../types/building';

interface MetricsSidebarProps {
  config: FullBuildingConfig;
  metrics: MassingMetrics;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function MetricsSidebar({ config, metrics }: MetricsSidebarProps) {
  const placementRate = (metrics.placementRate * 100).toFixed(1);
  const efficiency = (metrics.efficiency * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* Project Info */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Project</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Address</span>
            <span className="text-gray-900 font-medium text-right max-w-[180px] truncate">
              {config.address}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Build Mode</span>
            <span className={`font-medium ${config.buildMode === 'new' ? 'text-blue-600' : 'text-green-600'}`}>
              {config.buildMode === 'new' ? 'New Construction' : 'Repurpose'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Construction</span>
            <span className="text-gray-900 font-medium">Type {config.constructionType}</span>
          </div>
        </div>
      </div>

      {/* Building Metrics */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Building</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Stories</span>
            <span className="text-gray-900">{config.storiesAbove} above / {config.storiesBelow} below</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Lot Size</span>
            <span className="text-gray-900">{config.lotSize.toLocaleString()} SF</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Floor Plate</span>
            <span className="text-gray-900">{Math.round(config.floorPlateArea).toLocaleString()} SF</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">GBA</span>
            <span className="text-gray-900">{Math.round(config.gba).toLocaleString()} SF</span>
          </div>
        </div>
      </div>

      {/* Unit Mix */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Unit Mix</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Studios</span>
            <span className="text-gray-900">
              <span className={metrics.unitsPlaced.studio < config.units.studio.count ? 'text-amber-600' : ''}>
                {metrics.unitsPlaced.studio}
              </span>
              <span className="text-gray-400"> / {config.units.studio.count}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">1 Bedroom</span>
            <span className="text-gray-900">
              <span className={metrics.unitsPlaced.oneBed < config.units.oneBed.count ? 'text-amber-600' : ''}>
                {metrics.unitsPlaced.oneBed}
              </span>
              <span className="text-gray-400"> / {config.units.oneBed.count}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">2 Bedroom</span>
            <span className="text-gray-900">
              <span className={metrics.unitsPlaced.twoBed < config.units.twoBed.count ? 'text-amber-600' : ''}>
                {metrics.unitsPlaced.twoBed}
              </span>
              <span className="text-gray-400"> / {config.units.twoBed.count}</span>
            </span>
          </div>
          {config.units.threeBed.count > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">3 Bedroom</span>
              <span className="text-gray-900">
                <span className={metrics.unitsPlaced.threeBed < config.units.threeBed.count ? 'text-amber-600' : ''}>
                  {metrics.unitsPlaced.threeBed}
                </span>
                <span className="text-gray-400"> / {config.units.threeBed.count}</span>
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-900 font-medium">Total</span>
            <span className="font-medium">
              <span className={metrics.unitsPlaced.total < config.totalUnits ? 'text-amber-600' : 'text-green-600'}>
                {metrics.unitsPlaced.total}
              </span>
              <span className="text-gray-400"> / {config.totalUnits}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Performance</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Placement Rate</span>
            <span className={`font-medium ${
              parseFloat(placementRate) >= 95 ? 'text-green-600' :
              parseFloat(placementRate) >= 75 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {placementRate}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Efficiency</span>
            <span className="text-gray-900">{efficiency}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Net-to-Gross</span>
            <span className="text-gray-900">{(config.netToGross * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Cost Analysis</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Cost/SF</span>
            <span className="text-gray-900">${config.costPerSF}/SF</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Cost</span>
            <span className="text-gray-900 font-medium">{formatCurrency(metrics.totalCost)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-gray-500">Cost/Unit</span>
            <span className="text-indigo-600 font-semibold">{formatCurrency(metrics.costPerUnit)}</span>
          </div>
        </div>
      </div>

      {/* Space Breakdown */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Space Breakdown</h3>
        <div className="space-y-2">
          {config.circulation > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Circulation</span>
              <span className="text-gray-900">{Math.round(config.circulation).toLocaleString()} SF</span>
            </div>
          )}
          {config.retail > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Retail</span>
              <span className="text-gray-900">{Math.round(config.retail).toLocaleString()} SF</span>
            </div>
          )}
          {(config.amenitiesIndoor > 0 || config.amenitiesOutdoor > 0) && (
            <div className="flex justify-between">
              <span className="text-gray-500">Amenities</span>
              <span className="text-gray-900">{Math.round(config.amenitiesIndoor + config.amenitiesOutdoor).toLocaleString()} SF</span>
            </div>
          )}
          {config.supportAreas > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Support</span>
              <span className="text-gray-900">{Math.round(config.supportAreas).toLocaleString()} SF</span>
            </div>
          )}
          {config.parking > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Parking</span>
              <span className="text-gray-900">{Math.round(config.parking).toLocaleString()} SF</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
