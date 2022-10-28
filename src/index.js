import "leaflet.vectorgrid"
import { PMTiles } from "pmtiles"

L.PMTilesLayer = L.VectorGrid.Protobuf.extend({

  createTile: function(coords, done) {
      var storeFeatures = this.options.getFeatureId;
      var tileSize = this.getTileSize();
      var renderer = this.options.rendererFactory(coords, tileSize, this.options);
      var tileBounds = this._tileCoordsToBounds(coords);
      var vectorTilePromise = this._getVectorTilePromise(coords, tileBounds);

      if (storeFeatures) {
        this._vectorTiles[this._tileCoordsToKey(coords)] = renderer;
        renderer._features = {};
      }

      vectorTilePromise.then( function renderTile(vectorTile) {
        if (vectorTile.layers && vectorTile.layers.length !== 0) {
          for (var layerName in vectorTile.layers) {
            this._dataLayerNames[layerName] = true;
            var layer = vectorTile.layers[layerName];
            var pxPerExtent = this.getTileSize().divideBy(layer.extent);

            // Override layerStyle variable to allow passing in
            // non-layer based style from the options.
            var layerStyle = this.options.vectorTileLayerStyles[ layerName ] ||
              this.options.style ||
              L.Path.prototype.options;

            for (var i = 0; i < layer.features.length; i++) {
              var feat = layer.features[i];
              var id;

              if (this.options.filter instanceof Function &&
                !this.options.filter(feat.properties, coords.z)) {
                continue;
              }

              var styleOptions = layerStyle;
              if (storeFeatures) {
                id = this.options.getFeatureId(feat);
                var styleOverride = this._overriddenStyles[id];
                if (styleOverride) {
                  if (styleOverride[layerName]) {
                    styleOptions = styleOverride[layerName];
                  } else {
                    styleOptions = styleOverride;
                  }
                }
              }

              if (styleOptions instanceof Function) {
                styleOptions = styleOptions(feat.properties, coords.z);
              }

              if (!(styleOptions instanceof Array)) {
                styleOptions = [styleOptions];
              }

              if (!styleOptions.length) {
                continue;
              }

              var featureLayer = this._createLayer(feat, pxPerExtent);
              for (var j = 0; j < styleOptions.length; j++) {
                var style = L.extend({}, L.Path.prototype.options, styleOptions[j]);
                featureLayer.render(renderer, style);
                renderer._addPath(featureLayer);
              }

              if (this.options.interactive) {
                featureLayer.makeInteractive();
              }

              if (storeFeatures) {
                // multiple features may share the same id, add them
                // to an array of features
                if (!renderer._features[id]) {
                  renderer._features[id] = [];
                }

                renderer._features[id].push({
                  layerName: layerName,
                  feature: featureLayer
                });
              }
            }
          }
        }

        if (this._map != null) {
          renderer.addTo(this._map);
        }

        L.Util.requestAnimFrame(done.bind(coords, null, null));
      }.bind(this));

      return renderer.getContainer();
    },
})

export default L.pmtilesLayer = function (url, options) {
  return new L.PMTilesLayer(url, options)
};
