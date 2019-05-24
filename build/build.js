var fs = require('fs'),
    ncp = require('ncp').ncp,
    uuid = require('node-uuid'),
	buildUUID = uuid.v4().replace(/-/g, ''),
    UglifyJS = require('uglify-js'),
    deps = require('../build/deps.js'),
    apiFiles = deps.apiFiles;

var depsJS = [],
    depsCSS = [];

apiFiles.forEach(function(it) {
	let prefix = it.key ? 'external/' + it.key + '/' : '';
	if (it.js) {
		it.js.forEach(function(name) {
			depsJS.push(prefix + name);
		});
	}
	if (it.css) {
		it.css.forEach(function(name) {
			depsCSS.push(prefix + name);
		});
	}
});

function combineFiles(files) {
	var content = '';
	for (var i = 0, len = files.length; i < len; i++) {
		content += fs.readFileSync(files[i], 'utf8') + '\n\n';
	}
	return content;
}
function chkDistPath() {
	if (!fs.existsSync('dist')) { 
		fs.mkdirSync('dist');
    }
    
    // if (!fs.existsSync('../dist/css')) {
		// fs.mkdirSync('../dist/css');
	// }
}

exports.build = function () {

	console.log('Concatenating ' + depsJS.length + ' JS files...');
	chkDistPath();

	var buildDate = new Date().toLocaleString(),
		prefix = '(function () {\nvar define = null;\nvar buildDate = \'' + buildDate + '\';\nvar buildUUID = \'' + buildUUID + '\';\n',
		postfix = '\n}());\n';
		
	var copy = '',
	// var copy = fs.readFileSync('../external/Leaflet-GeoMixer/src/copyright.js', 'utf8'),
        intro = '(function () {\n"use strict";\n',
        // intro = '',
	    outro = '}());',
	    // outro = '',
	    newSrc = prefix + combineFiles(depsJS) + postfix,
	    pathPart = 'dist/geomixer',
	    srcPath = pathPart + '-src.js';

	console.log('\tUncompressed size: ' + newSrc.length + ' bytes');

	fs.writeFileSync(srcPath, newSrc);
	console.log('\tSaved to ' + srcPath);

	console.log('Compressing...');

	var path = pathPart + '.js',
		newCompressed = copy + UglifyJS.minify(newSrc, {
			warnings: true,
			fromString: true
		}).code;

	console.log('\tCompressed size: ' + newCompressed.length + ' bytes');
	fs.writeFileSync(path, newCompressed);
	console.log('\tSaved to ' + path);

	console.log('Concatenating ' + depsCSS.length + ' CSS files...');

	ncp('external/gmxControls/src/css/img', 'dist/img');
	ncp('external/Leaflet-1.3/images', 'dist/images');

	var newSrc = combineFiles(depsCSS),
	    srcPath = pathPart + '.css';

	console.log('\tCSS size: ' + newSrc.length + ' bytes');

	fs.writeFileSync(srcPath, newSrc);
	console.log('\tSaved to ' + srcPath);
/*
	*/
};