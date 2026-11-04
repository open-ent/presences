var gulp = require('gulp');
var webpack = require('webpack-stream');
const replace = require('gulp-replace');
var clean = require('gulp-clean');
var args = require('yargs').argv;
var path = require('path');

var apps = ['presences', 'incidents', 'massmailing', 'statistics-presences'];

if (args.targetModule) {
    console.log("using arg:", args.targetModule);
    apps = [args.targetModule];
}

gulp.task('drop-cache', function () {
    var dirs = [];
    apps.forEach(function (app) {
        dirs.push('./' + app + '/src/main/resources/public/dist');
        dirs.push('./' + app + '/build');
    });
    return gulp.src(dirs, {read: false, allowEmpty: true}).pipe(clean());
});

// Appel direct du webpack embarqué par webpack-stream (webpack 1, celui qui a toujours produit
// les bundles) : ses flux « through » ne se raccordent pas à ceux de gulp 5. Les erreurs de
// typage restent signalées sans interrompre le build, comme sous gulp 3.
function webpackApp(app) {
    var task = function (done) {
        var config = require('./' + app + '/webpack.config.js');
        config.output.path = path.resolve(__dirname, './' + app + '/src/main/resources/public/dist');
        webpack.webpack(config, function (err, stats) {
            if (stats) console.log(stats.toString({colors: false, chunks: false}));
            done(err);
        });
    };
    task.displayName = 'webpack:' + app;
    return task;
}

gulp.task('webpack', gulp.series('drop-cache', gulp.parallel(apps.map(webpackApp))));

function viewsApp(app) {
    var task = function () {
        return gulp.src("./" + app + "/src/main/resources/view-src/**/*.+(html|json)")
            .pipe(replace('@@VERSION', Date.now()))
            .pipe(gulp.dest("./" + app + "/src/main/resources/view"));
    };
    task.displayName = 'views:' + app;
    return task;
}

function copyBehavioursApp(app) {
    var task = function () {
        return gulp.src("./" + app + "/src/main/resources/public/dist/behaviours.js")
            .pipe(gulp.dest("./" + app + "/src/main/resources/public/js"));
    };
    task.displayName = 'behaviours:' + app;
    return task;
}

gulp.task('build', gulp.series('webpack', gulp.parallel(apps.map(viewsApp).concat(apps.map(copyBehavioursApp)))));

/* ------------------------------------------------------------------------- *
 * Local development (see dev-server.js and the README's local development section)
 *
 * One module is rebuilt at a time: the 4 bundles share common/ and cross-module
 * aliases, so recompiling all of them on every save would cost ~20s.
 * Target module: --targetModule=<module> or MODULE=<module> (default presences).
 * ------------------------------------------------------------------------- */

var devApp = args.targetModule || process.env.MODULE || 'presences';

gulp.task('copy-behaviours-dev', function () {
    return gulp.src('./' + devApp + '/src/main/resources/public/dist/behaviours.js')
        .pipe(gulp.dest('./' + devApp + '/src/main/resources/public/js'));
});

// No 'drop-cache' here: webpack must overwrite dist/ in place so that
// browser-sync's watcher sees clean "change" events (auto-reload).
// The task never completes: it lives as long as the watchers.
gulp.task('watch-dev', function (done) {
    var config = require('./' + devApp + '/webpack.config.js');
    config.output.path = path.resolve(__dirname, './' + devApp + '/src/main/resources/public/dist');

    console.log('[watch-dev] module: ' + devApp);

    // webpack's own watch mode: incremental compilation (~1s) and real dependency
    // tracking, so a change in common/ or in an aliased module (@incidents,
    // @statistics...) does rebuild the target bundle. Errors are logged, the
    // watch keeps running.
    webpack.webpack(config).watch({}, function (err, stats) {
        if (err) console.error('[watch-dev] ' + (err.message || err));
        else if (stats) console.log(stats.toString({colors: false, chunks: false}));
    });

    gulp.watch('./' + devApp + '/src/main/resources/public/dist/*.js', gulp.series('copy-behaviours-dev'));
});
