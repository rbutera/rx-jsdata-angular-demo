'use strict';
var gulp = require('gulp');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var transform = require('vinyl-transform');
var exorcist = require('exorcist');
var path = require('path');
var buffer = require('vinyl-buffer');
var watchify = require('watchify');
var browserify = require('browserify');
var envify = require('envify/custom');
var chalk = require('chalk');
var gmux = require('gulp-mux');
var gulpif = require('gulp-if');
var mkdirp = require('mkdirp');
var XML = require('node-jsxml').XML;
var collapse = require('bundle-collapser/plugin');
var constants = require('../common/constants')();
var helper = require('../common/helper');

var bundleShare = function(b, dest, bundleName, mode, sourceMap, done) {

    var rootUrl = '';
    var basePath = path.join(constants.clientFolder, constants.browserify.dest);

    b.bundle()
        .on('error', function(err) {
            gutil.beep();
            gutil.log(gutil.colors.red('Browserify failed'));
            gutil.log(gutil.colors.red(err.message));
        })
        .pipe(source(bundleName))
        .pipe(buffer())
        .pipe(gulpif(mode === 'prod', transform(function() {
            // in prod mode we save the source map file in a special folder
            // we first need to make sure the destination folder exists
            mkdirp.sync(constants.exorcist.dest);
            return exorcist(path.join(constants.exorcist.dest, sourceMap), sourceMap, rootUrl, basePath);
        }), transform(function() {
            // in dev mode we save the source map file along with bundle.js
            // we first need to make sure the destination folder exists
            mkdirp.sync(dest);
            return exorcist(path.join(dest, sourceMap), sourceMap, rootUrl, basePath);
        })))
        .pipe(gulp.dest(dest))
        .on('end', function() {
            if(done) {
                done();
            }
        });
};

var browserifyShare = function(shouldWatch, src, dest, bundleName, mode, target, done) {
    var version = helper.readJsonFile('./package.json').version;
    bundleName = bundleName || 'bundle.js';
    var releaseName = target + '-v' + version;
    var sourceMap = releaseName + '.map.js';
    var envifyVars = {
        APP_VERSION: version,
        SENTRY_CLIENT_KEY: constants.sentry.targetKeys[target],
        SENTRY_RELEASE_NAME: releaseName,
        SENTRY_MODE: mode,
        SENTRY_NORMALIZED_URL: constants.sentry.normalizedURL
    };
    if(helper.isMobile(constants)) {
        var srcxml = './' + constants.clientFolder + '/config' + constants.targetSuffix + '.xml';
        var configFileContent = helper.readTextFile(srcxml);
        var xml = new XML(configFileContent);
        envifyVars.APP_NAME = xml.child('name').getValue();
        envifyVars.APP_ID = xml.child('widget').attribute('id').getValue();
        envifyVars.APP_AUTHOR = xml.child('author').getValue();
    } else {
        envifyVars.APP_NAME = constants.appname;
    }

    // we need to pass these config options to browserify
    var b = browserify({
        debug: true,
        cache: {},
        packageCache: {},
        fullPaths: mode === 'prod' ? false : true
    });

    if(shouldWatch) {
        b = watchify(b);
    }
    if(mode === 'prod') {
        b.transform({
            'global': true,
            'exts': ['.js']
        }, 'uglifyify');

        // convert bundle paths to IDSs to save bytes in browserify bundles
        b.plugin(collapse);
    }
    b.transform(envify(envifyVars));
    b.on('update', function() {
        bundleShare(b, dest, bundleName, mode, sourceMap);
    });

    b.on('log', function(msg) {
        gutil.log(chalk.green('browserify'), msg);
    });

    b.add(src);
    bundleShare(b, dest, bundleName, mode, sourceMap, done);

};

var taskBrowserify = function(constants, done) {
    //browserifyShare(false, constants.browserify.src, constants.browserify.dest, constants.browserify.bundleName, constants.mode);

    var dest = constants.dist.distFolder;
    dest = helper.isMobile(constants) ? dest + '/www/' + constants.browserify.dest : dest + '/' + constants.browserify.dest;
    browserifyShare(false, constants.browserify.src, dest, constants.browserify.bundleName, constants.mode, constants.targetName, done);

};

var taskWatchify = function(constants, done) {
    //browserifyShare(true, constants.browserify.src, constants.browserify.dest, constants.browserify.bundleName, constants.mode);

    var dest = constants.dist.distFolder;
    dest = helper.isMobile(constants) ? dest + '/www/' + constants.browserify.dest : dest + '/' + constants.browserify.dest;
    browserifyShare(true, constants.browserify.src, dest, constants.browserify.bundleName, constants.mode, constants.targetName, done);

};

gulp.task('browserify', 'Generates a bundle javascript file with browserify.', function(done) {
    var taskname = 'browserify';
    gmux.targets.setClientFolder(constants.clientFolder);
    if(global.options === null) {
        global.options = gmux.targets.askForMultipleTargets(taskname);
    }
    return gmux.createAndRunTasks(gulp, taskBrowserify, taskname, global.options.target, global.options.mode, constants, done);

});

gulp.task('watchify', 'Generates a bundle javascript file with watchify.', function(done) {
    var taskname = 'watchify';
    gmux.targets.setClientFolder(constants.clientFolder);
    if(global.options === null) {
        global.options = gmux.targets.askForSingleTarget(taskname);
    }
    return gmux.createAndRunTasks(gulp, taskWatchify, taskname, global.options.target, global.options.mode, constants, done);

});
