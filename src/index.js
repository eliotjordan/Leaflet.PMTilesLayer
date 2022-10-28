import Pbf from 'pbf'
import {VectorTile} from '@mapbox/vector-tile'
import "leaflet.vectorgrid"
import * as pmtiles from "pmtiles"

L.PMTilesLayer = L.VectorGrid.Protobuf.extend({
  initialize: function(url, options) {
    this.pmt = new pmtiles.PMTiles(url)
    this.pmt.getHeader().then((h) => {
      this.maxZoom = h.maxZoom
    })
    L.VectorGrid.prototype.initialize.call(this, options);
  },

  createTile: function(coords, done) {
      let vectorTilePromise
      const storeFeatures = this.options.getFeatureId,
             tileSize = this.getTileSize(),
             renderer = this.options.rendererFactory(coords, tileSize, this.options),
             tileBounds = this._tileCoordsToBounds(coords),
             controller = new AbortController(),
             signal = controller.signal

      if (storeFeatures) {
        this._vectorTiles[this._tileCoordsToKey(coords)] = renderer
        renderer._features = {}
      }

      // code for loading tiles with higher zoom levels
      if(coords.z > this.maxZoom) {
        const pixelPoint = this._map.project(tileBounds.getCenter(), this.maxZoom).floor(),
              newCoords = pixelPoint.unscaleBy(tileSize).floor()

        newCoords.z = this.maxZoom
        const newTileBounds = this._tileCoordsToBounds(newCoords)

        vectorTilePromise = this._getVectorTilePromise(newCoords, newTileBounds, signal).then(function renderTile(vectorTile) {
          if (vectorTile.layers && vectorTile.layers.length !== 0) {
            for (layerName in vectorTile.layers) {
              let layer = vectorTile.layers[layerName]
              const deltaZoom = Math.abs(coords.z - newCoords.z),
                    scale = 1/(Math.pow(2, deltaZoom)),
                    scaledCoords = coords.scaleBy({x: scale, y: scale})

              const x = (scaledCoords.x % newCoords.x) * layer.extent, // extent = 4096 according to spec
                    y = (scaledCoords.y % newCoords.y) * layer.extent,
                    segLen = layer.extent * scale,
                    n = y,
                    w = x,
                    s = n + segLen,
                    e = w + segLen,
                    bounds = L.bounds(L.point(w, n), L.point(e, s))
              for (var i = 0; i < layer.features.length; i++) {
                let geom = []
                const feat = layer.features[i],
                      featGeom = feat.loadGeometry()
                featGeom.forEach((x) => {
                  const poly = x.map(x => L.point(x))
                  let clippedGeom = L.PolyUtil.clipPolygon(poly, bounds).filter(n => n)
                  if(clippedGeom.length > 0) {
                    // Transform geometry to fit larger original tile
                    // Translate x and y to origin of tile. e.g (x - bounds.min.x)
                    // Unscale so the geometry fits the original tile space
                    clippedGeom.map(function(element) {
                      element.x = (element.x - bounds.min.x) / scale
                      element.y = (element.y - bounds.min.y) / scale
                      return element
                    })
                    geom.push(clippedGeom)
                  }
                })

                layer.features[i].geometry = geom
              }
            }
          }
          return new Promise(function(resolve){
            return resolve(vectorTile)
          })
        })
      } else {
        vectorTilePromise = this._getVectorTilePromise(coords, tileBounds, signal)
      }

      vectorTilePromise.then( function renderTile(vectorTile) {
        if (vectorTile.layers && vectorTile.layers.length !== 0) {
          for (layerName in vectorTile.layers) {
            this._dataLayerNames[layerName] = true
            let layer = vectorTile.layers[layerName]
            const pxPerExtent = this.getTileSize().divideBy(layer.extent);

            // Override layerStyle variable to allow passing in
            // non-layer based style from the options.
            const layerStyle = this.options.vectorTileLayerStyles[ layerName ] ||
              this.options.style ||
              L.Path.prototype.options;

            for (var i = 0; i < layer.features.length; i++) {
              const feat = layer.features[i];

              if (this.options.filter instanceof Function &&
                !this.options.filter(feat.properties, coords.z)) {
                continue
              }

              let styleOptions = layerStyle
              if (styleOptions instanceof Function) {
                styleOptions = styleOptions(feat.properties, coords.z)
              }

              if (!(styleOptions instanceof Array)) {
                styleOptions = [styleOptions]
              }

              if (!styleOptions.length) {
                continue
              }

              const featureLayer = this._createLayer(feat, pxPerExtent);
              for (j = 0; j < styleOptions.length; j++) {
                const style = L.extend({}, L.Path.prototype.options, styleOptions[j])
                featureLayer.render(renderer, style)
                renderer._addPath(featureLayer)
              }

              if (this.options.interactive) {
                featureLayer.makeInteractive()
              }
            }
          }
        }

        if (this._map != null) {
          renderer.addTo(this._map)
        }

        L.Util.requestAnimFrame(done.bind(coords, null, null))
      }.bind(this))

      return renderer.getContainer()
    },

    _getVectorTilePromise: function(coords, tileBounds, signal) {
        const key = `${coords.x}:${coords.y}:${coords.z}`

        return this.pmt.getZxy(coords.z, coords.x, coords.y, signal).then(function(arr){
          if (arr) {
            return new Promise(function(resolve){
              var pbf = new Pbf( arr.data );
              return resolve(new VectorTile( pbf ));
            })
          }
        }.bind(this)).then(function(json){
          if (json) {
            // Normalize feature getters into actual instanced features
            for (layerName in json.layers) {
              let feats = [];

              for (i=0; i<json.layers[layerName].length; i++) {
                let feat = json.layers[layerName].feature(i)
                feat.geometry = feat.loadGeometry()
                feats.push(feat)
              }

              json.layers[layerName].features = feats
            }
            return json
          } else {
            return { }
          }
        }.bind(this))
      }
})

export default L.pmtilesLayer = function (url, options) {
  return new L.PMTilesLayer(url, options)
};
