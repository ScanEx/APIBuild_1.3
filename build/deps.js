var apiFiles = [
	{
		name: 'es6-promise',
		js: ['external/es6-promise/dist/es6-promise.auto.js']		// es6-promise polyfill
	},
	{
		name: 'classList',
		js: ['external/classList/classList.js']			// classList polyfill
	},
	{
		name: 'fetch',
		out: 'polyfill',								// build for polyfill
		skipSymbols: true,
		js: ['external/fetch/fetch.js']					// fetch polyfill		
	},
	{
		key: 'Leaflet-1.3',						// path in external
		js: ['leaflet-src.js'],
		css: ['leaflet.css', 'gmx-external.css'],
		img: { src: 'images', out: 'images' }
	},
	{
		key: 'Leaflet-GeoMixer',
		out: 'mobiles',								// build for mobiles
		deps: 'build/deps.js',
		srcPath: 'src/',
		css: ['dist/gmxStyles.css'],
		js: ['dist/leaflet-geomixer-src.js']
	},
	{
		key: 'gmxControls',
		deps: 'build/deps.js',
		js: ['dist/gmxControls-src.js'],
		css: ['dist/css/gmxControls.css'],
		img: { src: 'dist/css/img', out: 'img'}
	},
	{
		key: 'gmxDrawing',
		deps: 'build/deps.js',
		js: ['dist/gmxDrawing-src.js'],
		css: ['dist/css/gmxDrawing.css']
	},
	{
		key: 'Leaflet.gmxGrid',
		js: ['src/Leaflet.gmxGrid.js']
	},
	{
		key: 'Leaflet.imageTransform',
		js: ['src/L.ImageTransform.js']
	},
	{
		key: 'L.TileLayer.Mercator',
		js: ['src/L.TileLayer.Mercator.js']
	},
	{
		key: 'Leaflet.gmxBaseLayersManager',
		js: ['src/gmxBaseLayersManager.js', 'src/initBaseLayerManager.js']
	}
	,
	{
		key: 'Leaflet.contextmenu',
		js: ['dist/leaflet.contextmenu.js'],
		css: ['dist/leaflet.contextmenu.css']
	},
	{
		key: 'Leaflet.markercluster',
		js: ['leaflet.markercluster-src.js'],
		css: ['MarkerCluster.css', 'MarkerCluster.Default.css']
	},
	{
		key: 'Leaflet.GeometryUtil',
		js: ['src/leaflet.geometryutil.js']
	},
	{
		key: 'Leaflet.heat',
		js: ['dist/leaflet-heat.js']
	},
	{
		key: 'leaflet-bing-layer',
		js: ['leaflet-bing-layer.js']
	},
	{
		key: 'GMXVirtualTileLayer',
		js: ['GmxVirtualTileLayer.js'],
		css: ['GmxVirtualTileLayer.css']
	},
	{
		key: 'Leaflet.rastersBgTiles',
		js: ['src/L.RastersBgTiles.js'],
		css: ['src/L.RastersBgTiles.css']
	}
/*
	},
	{
		key: 'Leaflet.MapboxVectorTile',
		js: ['dist/Leaflet.MapboxVectorTile.js']
	}
	*/
];

module.exports = {
    apiFiles: apiFiles
}
