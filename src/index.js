import vectorTileLayer from 'leaflet-vector-tile-layer'
import {} from 'pmtiles'


class PMTilesLayer extends vectorTileLayer { }

L.pmtilesLayer = function (url, options) {
  return new PMTilesLayer(url, options);
};
