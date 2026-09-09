import "leaflet";

declare module "leaflet.heat";

declare module "leaflet" {
  interface HeatLayerOptions {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    max?: number;
    minOpacity?: number;
    gradient?: Record<number, string>;
  }

  class HeatLayer extends Layer {
    setLatLngs(latlngs: Array<LatLngExpression | [number, number, number]>): this;
  }

  function heatLayer(
    latlngs: Array<LatLngExpression | [number, number, number]>,
    options?: HeatLayerOptions,
  ): HeatLayer;
}