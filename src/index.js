/* global L */

import Pbf from 'pbf'
import { VectorTile } from '@mapbox/vector-tile'
import 'leaflet.vectorgrid'
import * as pmtiles from 'pmtiles'

L.PMTilesLayer = L.VectorGrid.Protobuf.extend({
  initialize: function (url, options) {
    this.pmt = new pmtiles.PMTiles(url)
    L.VectorGrid.prototype.initialize.call(this, options)
  },

  // Override _layerAdd so that layer is not added to map until the async
  // getHeader function returns and layer maxZoom is set. Otherwise initial
  // tiles may not load correctly.
  _layerAdd: function (e) {
    this.pmt.getHeader().then((h) => {
      this.maxZoom = h.maxZoom

      // Use leaflet maxNativeZoom autoscaling if option set
      if (this.options.autoScale === 'leaflet') {
        this.options.maxNativeZoom = h.maxZoom
      }
      L.VectorGrid.prototype._layerAdd.call(this, e)
    })
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

    if ((coords.z > this.maxZoom) && this.options.autoScale !== false) {
      // Generate zxy tile coordinates that correspond to the tile in the
      // tilset's max zoomed level that contains the originally requested tile.
      const pixelPoint = this._map.project(tileBounds.getCenter(), this.maxZoom).floor()
      const maxCoords = pixelPoint.unscaleBy(tileSize).floor()
      maxCoords.z = this.maxZoom
      const newTileBounds = this._tileCoordsToBounds(maxCoords)

      // Get this max zoom level vector tile and then process to extract
      // features for the requested tile
      vectorTilePromise = this._getVectorTilePromise(maxCoords, newTileBounds, signal).then(function renderTile (vectorTile) {
        if (vectorTile.layers && vectorTile.layers.length !== 0) {
          for (const layerName in vectorTile.layers) {
            const layer = vectorTile.layers[layerName]

            // Use difference in zoom levels between the requested tile and
            // the parent max zoomed tile to generate a scale value.
            const deltaZoom = Math.abs(coords.z - maxCoords.z)
            const scale = 1 / (Math.pow(2, deltaZoom))

            // The scale value is used to calculate the x and y values of the
            // original tile reqest in the coordinate unit space of the max zoom
            // level parent tile. The default tile size is 4096. See:
            // https://github.com/mapbox/vector-tile-spec/tree/master/2.1#41-layers
            const scaledCoords = coords.scaleBy({ x: scale, y: scale })
            const x = (scaledCoords.x % maxCoords.x) * layer.extent // 4096
            const y = (scaledCoords.y % maxCoords.y) * layer.extent

            // Use these X and Y to generate a bounds object for the requested
            // tile in the max zoom level tile coordinate space.
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
                switch (feat.type) {
                  // Point
                  case 1: {
                    // filter by requested tile bounds
                    if (bounds.contains(x)) {
                      // Transform geometry to fit larger requested tile coordinate space.
                      const point = x[0]
                      point.x = (point.x - bounds.min.x) / scale
                      point.y = (point.y - bounds.min.y) / scale
                      geom.push(point)
                    }
                    break
                  }
                  // Line(2) or Polygon (3)
                  default: {
                    // Map each point in the feature to a Leaflet point object
                    const poly = x.map(x => L.point(x))

                    // clip the feature geometry by requested tile bounds
                    const clippedGeom = L.PolyUtil.clipPolygon(poly, bounds)
                    if (clippedGeom.length === 0) { break }
                    // Transform geometry to fit larger requested tile coordinate space.
                    // Translate x and y to origin of the tile. (x - bounds.min.x).
                    // Unscale so the geometry fits the original tile coordinate space.
                    clippedGeom.map(function (element) {
                      element.x = (element.x - bounds.min.x) / scale
                      element.y = (element.y - bounds.min.y) / scale
                      return element
                    })
                    geom.push(clippedGeom)
                    break
                  }
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
            if (feat.geometry.length === 0) { continue }

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
    // Get vector tile from pmtiles file
    return this.pmt.getZxy(coords.z, coords.x, coords.y, signal).then(function (arr) {
      if (arr) {
        return new Promise(function (resolve) {
          const pbf = new Pbf(arr.data)
          return resolve(new VectorTile(pbf))
        })
      }
    }).then(function (vectorTile) {
      if (vectorTile) {
        // Normalize feature getters into actual instanced features
        for (const layerName in vectorTile.layers) {
          const feats = []

          for (let i = 0; i < vectorTile.layers[layerName].length; i++) {
            const feat = vectorTile.layers[layerName].feature(i)
            feat.geometry = feat.loadGeometry()
            feats.push(feat)
          }

          vectorTile.layers[layerName].features = feats
        }
        return vectorTile
      } else {
        return { }
      }
    })
  }
})

export default L.pmtilesLayer = function (url, options) {
  return new L.PMTilesLayer(url, options)
}
