/* global L */

import Pbf from 'pbf'
import { VectorTile } from '@mapbox/vector-tile'
import 'leaflet.vectorgrid'
import * as pmtiles from 'pmtiles'

L.PMTilesLayer = L.VectorGrid.Protobuf.extend({
  initialize: function (url, options) {
    this.pmt = new pmtiles.PMTiles(url)
    this.pmt.getHeader().then((h) => {
      this.maxZoom = h.maxZoom
    })
    L.VectorGrid.prototype.initialize.call(this, options)
  },

  createTile: function (coords, done) {
    let vectorTilePromise
    const storeFeatures = this.options.getFeatureId
    const tileSize = this.getTileSize()
    const renderer = this.options.rendererFactory(coords, tileSize, this.options)
    const tileBounds = this._tileCoordsToBounds(coords)
    const controller = new AbortController()
    const signal = controller.signal

    if (storeFeatures) {
      this._vectorTiles[this._tileCoordsToKey(coords)] = renderer
      renderer._features = {}
    }

    // code for loading tiles with higher zoom levels
    if (coords.z > this.maxZoom) {
      const pixelPoint = this._map.project(tileBounds.getCenter(), this.maxZoom).floor()
      const newCoords = pixelPoint.unscaleBy(tileSize).floor()

      newCoords.z = this.maxZoom
      const newTileBounds = this._tileCoordsToBounds(newCoords)

      vectorTilePromise = this._getVectorTilePromise(newCoords, newTileBounds, signal).then(function renderTile (vectorTile) {
        if (vectorTile.layers && vectorTile.layers.length !== 0) {
          for (const layerName in vectorTile.layers) {
            const layer = vectorTile.layers[layerName]
            const deltaZoom = Math.abs(coords.z - newCoords.z)
            const scale = 1 / (Math.pow(2, deltaZoom))
            const scaledCoords = coords.scaleBy({ x: scale, y: scale })

            const x = (scaledCoords.x % newCoords.x) * layer.extent // extent = 4096 according to spec
            const y = (scaledCoords.y % newCoords.y) * layer.extent
            const segLen = layer.extent * scale
            const n = y
            const w = x
            const s = n + segLen
            const e = w + segLen
            const bounds = L.bounds(L.point(w, n), L.point(e, s))
            for (let i = 0; i < layer.features.length; i++) {
              const geom = []
              const feat = layer.features[i]
              const featGeom = feat.loadGeometry()
              featGeom.forEach((x) => {
                const poly = x.map(x => L.point(x))
                const clippedGeom = L.PolyUtil.clipPolygon(poly, bounds).filter(n => n)
                if (clippedGeom.length > 0) {
                  // Transform geometry to fit larger original tile
                  // Translate x and y to origin of tile. e.g (x - bounds.min.x)
                  // Unscale so the geometry fits the original tile space
                  clippedGeom.map(function (element) {
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
        return new Promise(function (resolve) {
          return resolve(vectorTile)
        })
      })
    } else {
      vectorTilePromise = this._getVectorTilePromise(coords, tileBounds, signal)
    }

    vectorTilePromise.then(function renderTile (vectorTile) {
      if (vectorTile.layers && vectorTile.layers.length !== 0) {
        for (const layerName in vectorTile.layers) {
          this._dataLayerNames[layerName] = true
          const layer = vectorTile.layers[layerName]
          const pxPerExtent = this.getTileSize().divideBy(layer.extent)

          // Override layerStyle variable to allow passing in
          // non-layer based style from the options.
          const layerStyle = this.options.vectorTileLayerStyles[layerName] ||
              this.options.style ||
              L.Path.prototype.options

          for (let i = 0; i < layer.features.length; i++) {
            const feat = layer.features[i]

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

            const featureLayer = this._createLayer(feat, pxPerExtent)
            for (let j = 0; j < styleOptions.length; j++) {
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

  _getVectorTilePromise: function (coords, tileBounds, signal) {
    return this.pmt.getZxy(coords.z, coords.x, coords.y, signal).then(function (arr) {
      if (arr) {
        return new Promise(function (resolve) {
          const pbf = new Pbf(arr.data)
          return resolve(new VectorTile(pbf))
        })
      }
    }).then(function (json) {
      if (json) {
        // Normalize feature getters into actual instanced features
        for (const layerName in json.layers) {
          const feats = []

          for (let i = 0; i < json.layers[layerName].length; i++) {
            const feat = json.layers[layerName].feature(i)
            feat.geometry = feat.loadGeometry()
            feats.push(feat)
          }

          json.layers[layerName].features = feats
        }
        return json
      } else {
        return { }
      }
    })
  }
})

export default L.pmtilesLayer = function (url, options) {
  return new L.PMTilesLayer(url, options)
}
