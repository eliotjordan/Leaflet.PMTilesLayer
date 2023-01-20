# Leaflet.PMTilesLayer

A Leaflet Plugin for PMTiles formatted vector data. Built on [Leaflet.VectorGrid](https://github.com/Leaflet/Leaflet.VectorGrid) and the PMTiles [javascript package](https://github.com/protomaps/PMTiles/tree/main/js).

[![npm](https://shields.io/npm/v/leaflet-pmtiles-layer)](https://www.npmjs.com/package/leaflet-pmtiles-layer) [![CircleCI](https://dl.circleci.com/status-badge/img/gh/eliotjordan/Leaflet.PMTilesLayer/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/eliotjordan/Leaflet.PMTilesLayer/tree/main)

## Demos

- Points
- Lines
- Polygons

## Installation and setup

With npm:

```
npm install leaflet-pmtiles-layer
```

Script tag:

```
<script src="https://unpkg.com/leaflet-pmtiles-layer@latest/dist/Leaflet.PMTilesLayer.js"></script>
```

## Usage

```
var options = {
  style: {
    weight: 1,
    radius: 4,
    fillColor: '#3388ff',
    fill: true
  }
};

var url = "https://example.com/path/to/dataset.pmtiles"
L.pmtilesLayer(url, options).addTo(map)
```

### Options

Leaflet.PMTilesLayer extends [Leaflet.VectorGrid](https://leaflet.github.io/Leaflet.VectorGrid/vectorgrid-api-docs.html#vectorgrid-option), so many of its options are available.

### Styling

Unlike Leaflet.VectorGrid, layers can be styled using the `style` option with [Path](https://leafletjs.com/reference.html#path-color)-type keys and values.

### Autoscaling

Use the `autoScale` layer option to define auto scaling behavior. If a PMTiles layer has a maxZoom less than maxZoom of the map, tile features can be scaled for display at higher zoom levels.

Option | Value | Description
------ | ------- | -----------
`autoScale` | `'pmtiles'` | Default value. Use algorithms in the plug-in itself.
`autoScale` | `'leaflet'` | Use leaflet's built-in autoscaling.
`autoScale` | `false` | Disable autoscaling.

## Development

Install dependencies

```
yarn install
```

Build the project

```
yarn build
```

Run end-to-end tests

```
yarn cypress run
```

Lint using StandardJS

```
yarn lint
```


## License

[MIT](https://github.com/eliotjordan/Leaflet.PMTilesLayer/blob/main/LICENSE)
