var SystemJsConfig = (function (global) {
    var paths = {
        // paths serve as alias
        'npm:': './node_modules/',
        'src:': './src/',
        'jquery.select2': 'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.3/js/select2.min.js',
        'jquery': 'https://code.jquery.com/jquery-1.12.4.min.js'
    };

    // map tells the System loader where to look for things
    var map = {
        'tslib': 'npm:tslib/tslib.js',
        'blazy': 'npm:blazy/blazy.js',
        'barba.js': 'npm:barba.js/dist/barba.js',
        //'jquery': 'npm:jquery/dist/jquery.js',
        'jquery.scrollspy': 'npm:jquery-scrollspy/jquery-scrollspy.js',
        'jquery.equalise': 'src:scripts/jquery.equalise.js',
        'jquery.wordbreak': 'src:scripts/jquery.wordbreak.js',
        'leaflet': 'npm:leaflet/dist/leaflet-src.js',
        'leaflet.markercluster': 'npm:leaflet.markercluster/dist/leaflet.markercluster-src.js',
        'slick': 'npm:slick-carousel/slick/slick.js',
        'featherlight': 'npm:featherlight/src/featherlight.js',
        'svg4everybody': 'npm:svg4everybody/dist/svg4everybody.js',
        'mediaelement': 'npm:mediaelement/full.js',
        'velocity-animate': 'npm:velocity-animate/velocity.js',
        'velocity': 'npm:velocity-animate/velocity.ui.js'
    };

    // packages tells the System loader how to load when no filename and/or no extension
    var packages = {
        'leaflet': {
            main: 'leaflet.js',
            defaultExtension: 'js'
        },
        'leaflet.markercluster': {
            main: 'leaflet.markercluster-src.js',
            defaultExtension: 'js'
        }
    };

    var packageNames = [];
    var meta = {
        'jquery.scrollspy': {
            deps: ['jquery']
        },
        'jquery.equalise': {
            deps: ['jquery']
        },
        'jquery.select2': {
            deps: ['jquery']
        },
        'jquery.wordbreak': {
            deps: ['jquery']
        },
        'svg4everybody': {
            deps: [],
            format: 'global',
            exports: 'svg4everybody'
        },
        'leaflet': {
            format: 'amd',
            exports: 'L'
        },
        'leaflet.markercluster': {
            deps: ['leaflet']
        },
        'velocity': {
            deps: ['velocity-animate']
        }
    };
    var bundles = {};

    // add package entries for angular packages in the form '@angular/common': { main: 'index.js', defaultExtension: 'js' }
    packageNames.forEach(function (pkgName) {
        packages[pkgName] = {
            main: 'index.js',
            defaultExtension: 'js'
        };
    });

    var config = {
        baseURL: '',
        defaultJSExtensions: true,
        map: map,
        packages: packages,
        bundles: bundles,
        meta: meta,
        paths: paths
    };

    // filterSystemConfig - index.html's chance to modify config before we register it.
    if (global.filterSystemConfig) {
        global.filterSystemConfig(config);
    }

    if (global.System) {
        global.define = global.System.amdDefine;
        global.require = global.requirejs = global.System.amdRequire;
        global.System.config(config);
    }

    return config;

})(this);

if (typeof module === 'object' && module.exports) {
    module.exports = SystemJsConfig;
}