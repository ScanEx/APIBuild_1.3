var gmxDeps = require('./build/deps.js'),
	gulp = require('gulp'),
    ncp = require('ncp').ncp,
	fileExists = require('file-exists'),
	cp = require('child_process'),
	execSync = cp.execSync,
    UglifyJS = require('uglify-js'),
    fs = require('fs'),
    uuid = require('node-uuid'),
	buildUUID = uuid.v4().replace(/-/g, ''),
	root = './',
	external = root + 'external/';

function outBuild(name, js, css, skipSymbols) {
	if (js) {
		var buildDate = new Date().toLocaleString(),
			// prefix = '(function () {\n\'use strict\';\nvar buildDate = \'' + buildDate + '\';\nvar buildUUID = \'' + buildUUID + '\';\n',
			prefix = '(function () {\nvar define = null;\nvar buildDate = \'' + buildDate + '\';\nvar buildUUID = \'' + buildUUID + '\';\n',
			postfix = skipSymbols ? '' : '';

		postfix += '\n}());\n';
		// if (type !== 'dev') {
			fs.writeFileSync(name + '.js', prefix + UglifyJS.minify(js, {warnings: true, fromString: true}).code + postfix);
			var type = 'src';
		// }
		fs.writeFileSync(name + '-' + type + '.js', prefix + js + postfix);
	}
	if (css) {
		fs.writeFileSync(name + '.css', css);
	}
}
gulp.task('gmx-pub', [], function(cb) {
    fs.mkdir(root + 'dist/', function() {
		var newJs = '',
			newCss = '',
			distPath = root + 'dist/';

		gmxDeps.apiFiles.forEach(function(it) {
			console.time(it.key || it.name);
			var dir = external + it.key,
				out = it.out,
				jake = it.jake,
				jsFiles = it.js || [],
				cssFiles = it.css || [],
				img = it.img;
			
			if (jake && fileExists(dir + '/Jakefile.js')) {
				var fromDir = process.cwd();
				process.chdir(dir);
				execSync((process.platform === 'win32' ? 'npm.cmd' : 'npm') + ' install');
				execSync(jake);
				process.chdir(fromDir);
			}

			jsFiles.forEach(function(name) {
				var prefix = it.key ? dir + '/' : '';
				newJs += fs.readFileSync( prefix + name, 'utf8') + '\n\n';
			});
			cssFiles.forEach(function(name) {
				var prefix = it.key ? dir + '/' : '';
				newCss += fs.readFileSync(prefix + name, 'utf8') + '\n\n';
			});
			if (img) {
				ncp(dir + '/' + img.src, distPath + img.out);
			}
			console.timeEnd(it.key || it.name);

			if (out) {
				outBuild(distPath + out, newJs, newCss, it.skipSymbols);
			}
		});
		outBuild(distPath + 'geomixer', newJs, newCss);
		var workerFile = 'ImageBitmapLoader-worker.js';
		ncp(external + 'Leaflet-GeoMixer/dist/' + workerFile, distPath + workerFile);
		
		var now = Date.now();
		fs.writeFileSync(distPath + 'version.js', 'var gmxVersion = ' + JSON.stringify({
			jsPath: {
				'//www.kosmosnimki.ru/lib/geomixer/geomixer-src.js': now
			},
			cssPath: {
				'//www.kosmosnimki.ru/lib/geomixer/geomixer.css': now
			}
		}, null, 2) + ';');

		cb();
    });
});
