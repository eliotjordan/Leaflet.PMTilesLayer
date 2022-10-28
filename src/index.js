import Pbf from 'pbf'
import {VectorTile} from '@mapbox/vector-tile'
import "leaflet.vectorgrid"
import * as pmtiles from "pmtiles"

L.PMTilesLayer = L.VectorGrid.Protobuf.extend({
  initialize: function(url, options) {
    this._url = url;
    this.p = new pmtiles.PMTiles("https://pul-tile-images.s3.amazonaws.com/pmtiles/parcels.pmtiles")
    this.controllers = [];
    L.VectorGrid.prototype.initialize.call(this, options);
    this.p.getHeader().then((h) => {
      this.header = h
    })
  },

  createTile: function(coords, done) {
      var storeFeatures = this.options.getFeatureId;
      var tileSize = this.getTileSize();
      var renderer = this.options.rendererFactory(coords, tileSize, this.options);
      var tileBounds = this._tileCoordsToBounds(coords);

      if (storeFeatures) {
        this._vectorTiles[this._tileCoordsToKey(coords)] = renderer;
        renderer._features = {};
      }

      // this.controllers = this.controllers.filter((cont) => {
      //   if (cont[0] != coords.z) {
      //     cont[1].abort();
      //     return false;
      //   }
      //   return true;
      // });

      const controller = new AbortController();
      // this.controllers.push([coords.z, controller]);
      const signal = controller.signal;

      var vectorTilePromise = this._getVectorTilePromise(coords, tileBounds, signal);

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

    _isCurrentTile : function(coords, tileBounds) {

      if (!this._map) {
        return true;
      }

      var zoom = this._map._animatingZoom ? this._map._animateToZoom : this._map._zoom;
      var currentZoom = zoom === coords.z;

      var tileBounds = this._tileCoordsToBounds(coords);
      var currentBounds = this._map.getBounds().overlaps(tileBounds); 

      return currentZoom && currentBounds;

    },

    _removeTile: function (key) {
        const tileZoom = key.split(':')[2]
        if (tileZoom < (this.header.maxZoom)) {
          const tile = this._tiles[key];
          if (!tile) { return; }

          L.DomUtil.remove(tile.el);

          delete this._tiles[key];

          this.fire('tileunload', {
            tile: tile.el,
            coords: this._keyToTileCoords(key)
          });
        }
    },

    _getVectorTilePromise: function(coords, tileBounds, signal) {
        var data = {
          s: this._getSubdomain(coords),
          x: coords.x,
          y: coords.y,
          z: coords.z
        };
        if (this._map && !this._map.options.crs.infinite) {
          var invertedY = this._globalTileRange.max.y - coords.y;
          if (this.options.tms) { // Should this option be available in Leaflet.VectorGrid?
            data['y'] = invertedY;
          }
          data['-y'] = invertedY;
        }

        if (!this._isCurrentTile(coords, tileBounds)) {
          return Promise.resolve({layers:[]});
        }

        return this.p.getZxy(coords.z, coords.x, coords.y, signal).then(function(arr){
          if (arr) {
            return new Promise(function(resolve){
              var pbf = new Pbf( arr.data );
              return resolve(new VectorTile( pbf ));
            })
          }
        }.bind(this)).then(function(json){
          if (json) {
            // Normalize feature getters into actual instanced features
            for (var layerName in json.layers) {
              var feats = [];

              for (var i=0; i<json.layers[layerName].length; i++) {
                var feat = json.layers[layerName].feature(i);
                feat.geometry = feat.loadGeometry();
                feats.push(feat);
              }

              json.layers[layerName].features = feats;
            }
            return json;
          } else {
            return { }
          }
        })
      }
})

export default L.pmtilesLayer = function (url, options) {
  return new L.PMTilesLayer(url, options)
};
