/**
 An opinionated attempt to create a static site, fast development environment
 Supported languages are 
 1) Typescript https://www.typescriptlang.org/
 2) Less http://lesscss.org/
 3) Pug https://pugjs.org/api/getting-started.html
 ============================================================================
 npm install --save-dev gulp-merge gulp-prompt gulp-todo gulp-hash-src marked gulp-wrap gulp-markdown-to-json gulp-git gulp-copy gulp-webserver gulp-watch typedoc gulp-typedoc slugify gulp-rename gulp-systemjs-builder gulp-concat gulp-foreach gulp-clean gulp-run-sequence gulp-cached less merge2 gulp-pug imagemin-optipng imagemin-jpegoptim gulp-imagemin typescript systemjs-builder path gulp-sourcemaps gulp-typescript gulp gulp-util gulp-clean gulp-plumber run-sequence gulp-if gulp-less gulp-bless gulp-clean-css gulp-purifycss less-plugin-autoprefix less-plugin-inline-urls less-plugin-clean-css less-plugin-glob
 ============================================================================
 gulp server
 gulp compile --env=prod
 gulp server --env=dev
 gulp docs
 ============================================================================
 docs (general documentation)
 src (source files that will be processed and placed in wwwroot)
 --> *.less files are watched and compiled, _*.less files are ignored
 --> *.ts files are watched and compiled, *.bundle.ts are bundled using SystemJsBuilder
 --> *.pug files are watched and compiled, _*.pug files are ignored
 wwwroot (live-server root folder after running gulp:server)
 wwwassets (assets are copied into wwwroot without modification)
 ===========================================================================
 */
const gulpLoadPlugins = require('gulp-load-plugins');
const plugins = gulpLoadPlugins();
const package = require('./package.json');
const tsConfig = require('./tsconfig.json');
const TMP_DIR = 'tmp';
const DOCS_DIR = 'docs';
const SRC_DIR = !!plugins.util.env.src ? plugins.util.env.src : 'src';
const SVG_SPRITE_SRC_DIR = `${SRC_DIR}/images/sprite`;
const WWWROOT_DIR = !!plugins.util.env.wwwroot ? plugins.util.env.wwwroot : 'wwwroot';
const BROWSER_LIST = !!plugins.util.env.browserlist ? plugins.util.env.browserlist : 'ie >= 9, > 1%, last 3 versions';
const SITEMAP_ROOT = !!plugins.util.env.sitemapRoot ? plugins.util.env.sitemapRoot : 'http://localhost';
const fs = require('fs');
const marked = require('marked');
const gulp = require('gulp');
const path = require('path');
const slugify = require('slugify')
const merge = require('merge2');
const swPrecache = require('sw-precache');
const access = require('gulp-accessibility');
const rename = require('rename');
const htmlv = require('gulp-html-validator');
const csslint = require('gulp-csslint');
const csslintHtmlReporter = require('gulp-csslint-report');
const IS_PRODUCTION = plugins.util.env.env === 'prod';
const DEBUG = plugins.util.env.debug === 'true';
const tsProject = plugins.typescript.createProject('tsconfig.json', {
    typescript: require('typescript')
});
const SystemJsBuilder = require("systemjs-builder");
const imageminJpegoptim = require('imagemin-jpegoptim');
const imageminOptipng = require('imagemin-optipng');
const browserslist = require('browserslist');
const LessAutoprefix = require("less-plugin-autoprefix"),
    LessInlineUrls = require('less-plugin-inline-urls'),
    LessPluginCleanCSS = require("less-plugin-clean-css"),
    LessGlobbing = require("less-plugin-glob"),
    lessAutoprefixInstance = new LessAutoprefix({
        browsers: browserslist(BROWSER_LIST)
    }),
    lessPluginCleanCSSInstance = new LessPluginCleanCSS({
        advanced: true
    });

const log = function () {
    if (DEBUG) {
        plugins.util.log.apply(this, arguments);
    }
};
const CSS_PRECOMPILE_SELECTOR = [`${SRC_DIR}/**/*.less`, `!${SRC_DIR}/**/_*.less`, `!${SRC_DIR}/**/*.src.less`];
const CSS_CORECOMPILE_SELECTOR = [`${SRC_DIR}/**/*.src.less`, `!${SRC_DIR}/**/_*.less`];
const CSS_POSTCOMPILE_SELECTOR = [`${WWWROOT_DIR}/**/*.css`];
const JS_PRECOMPILE_SELECTOR = [`${SRC_DIR}/**/*.ts`, `!${SRC_DIR}/**/*.d.ts`];
const JS_POSTCOMPILE_SELECTOR = [`${TMP_DIR}/**/*.js`, `!${TMP_DIR}/**/_*.js`, `!${TMP_DIR}/**/*.d.ts`];
const HTML_STATIC_COMPILE_SELECTOR = [`${SRC_DIR}/**/*.pug`, `!${SRC_DIR}/**/_*.pug`];
const HTML_DYNAMIC_COMPILE_SELECTOR = [`${SRC_DIR}/**/*.md`, `!${SRC_DIR}/**/_*.md`];
const IMAGES_POSTCOMPILE_SELECTOR = [`${WWWROOT_DIR}/**/*.{jpg,jpeg,png,gif}`];
const ASSETS_PRECOMPILE_SELECTOR = [`${SRC_DIR}/**/*`, `!${SRC_DIR}/**/*.src.css`, `!${SRC_DIR}/**/*.less`, `!${SRC_DIR}/**/*.ts`, `!${SRC_DIR}/**/*.pug`, `!${SRC_DIR}/**/*.md`, `!${SRC_DIR}/**/_*.*`];


// List all gulp plugins automatically loaded by 'gulp-load-plugins'
gulp.task('plugins', function (callback) {
    log('Gulp Plugins', plugins);
    return plugins.util.noop();
});

// Run all docs namespace tasks
gulp.task('docs', ['docs:js', 'docs:changelog', 'docs:todo']);

// Create a CHANGELOG.md from the git history
gulp.task('docs:changelog', function () {
    return plugins.git.exec({
        args: `log --decorate --simplify-merges --pretty=format:"%h -- %ai -- %s" > ${DOCS_DIR}/CHANGELOG.md`
    }, function (err, stdout) {
        if (!!err) {
            log(err);
            throw err;
        }
    });
});

// Generate a TODO.md from your javascript files 
gulp.task('docs:todo', function () {
    return gulp.src(`${SRC_DIR}/**/*.{ts,pug,less}`)
        .pipe(plugins.plumber())
        .pipe(plugins.todo())
        .pipe(gulp.dest(DOCS_DIR)) //output todo.md as markdown 
        .pipe(plugins.todo.reporter('json', { fileName: 'todo.json' }))
        .pipe(gulp.dest(DOCS_DIR)) //output todo.json as json 
});

// Create TypeScript documentation using typedoc
gulp.task('docs:js', ['compile:js:tmp', 'clean:docs'], function () {
    return gulp.src([`${TMP_DIR}/**/*.d.ts`])
        .pipe(plugins.plumber())
        .pipe(plugins.typedoc({
            module: tsConfig.compilerOptions.module,
            target: tsConfig.compilerOptions.target,
            includeDeclarations: true,
            out: `${DOCS_DIR}/typedoc`,
            name: `${package.name} - ${package.version}`
        }));
});

gulp.task('docs:accessibility', function () {
    return gulp.src(WWWROOT_DIR + '/*.html')
        //.pipe(plugins.plumber())
        .pipe(access({
            force: true
        }))
        .on('error', console.log)
        .pipe(access.report({ reportType: 'txt' }))
        .pipe(rename({
            extname: '.txt'
        }))
        .pipe(gulp.dest(`${DOCS_DIR}/accessibility-report`));
});

gulp.task('docs:w3c', function () {
    return gulp.src(`${WWWROOT_DIR}/**/*.html`)
        .pipe(plugins.plumber())
        .pipe(htmlv({ format: 'html' }))
        .pipe(gulp.dest(`${DOCS_DIR}/w3c-report`));
});

gulp.task('docs:csslint', function () {
    return gulp.src(`${WWWROOT_DIR}/**/*.css`)
        .pipe(plugins.plumber())
        .pipe(csslint())
        .pipe(csslintHtmlReporter({
            'directory': `${DOCS_DIR}/csslint-reports/`
        }));
});

// Run all clean namespace tasks
gulp.task('clean', ['clean:wwwroot', 'clean:tmp', 'clean:docs']);

// Remove WWWROOT_DIR
gulp.task('clean:wwwroot', function () {
    return gulp.src(WWWROOT_DIR, { read: false })
        .pipe(plugins.plumber())
        .pipe(plugins.clean());
});

// Remove TMP_DIR
gulp.task('clean:tmp', function () {
    return gulp.src(TMP_DIR, { read: false })
        .pipe(plugins.plumber())
        .pipe(plugins.clean());
});

// Remove DOCS_DIR
gulp.task('clean:docs', function () {
    return gulp.src(`${DOCS_DIR}/typedoc`, { read: false })
        .pipe(plugins.plumber())
        .pipe(plugins.clean());
});

// Runs all compile:css namespace tasks
gulp.task('compile:css', ['compile:css:minify']);

// Remove unused CSS selectors
// Must be done on unminified CSS
gulp.task('compile:css:purify', ['compile:css:minify'], function () {
    return gulp.src(CSS_POSTCOMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.purifycss([`${WWWROOT_DIR}/**/*.{js,html}`]))
        .pipe(gulp.dest(WWWROOT_DIR));
});

// Minify CSS
// Must be done after bless and purify
gulp.task('compile:css:minify', ['compile:css:bless'], function (callback) {
    return gulp.src(CSS_POSTCOMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.cleanCss({
            debug: true,
            inline: ['none']
        }, function (details) {
            log(details.name + ': ' + details.stats.originalSize);
            log(details.name + ': ' + details.stats.minifiedSize);
        }))
        .pipe(IS_PRODUCTION ? plugins.util.noop() : plugins.sourcemaps.write())
        .pipe(gulp.dest(WWWROOT_DIR));
});

// Splits CSS into smaller files :- IE9 max selector limit of 4096
gulp.task('compile:css:bless', ['compile:css:site'], function (callback) {
    return gulp.src(CSS_POSTCOMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.bless())
        .pipe(gulp.dest(WWWROOT_DIR));
});

// CSS compilation
gulp.task('compile:css:site', ['compile:css:src'], function (callback) {
    return gulp.src(CSS_PRECOMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.less({
            paths: [path.join(__dirname, "less", "includes")],
            plugins: [lessAutoprefixInstance, LessGlobbing, LessInlineUrls]
        }).on('error', function (err) {
            console.warn(err);
            this.emit('end');
        }))
        .pipe(gulp.dest(WWWROOT_DIR));
});

// Special CSS Compilation :- long running compilations can be compiled as css then imported
gulp.task('compile:css:src', function (callback) {
    return gulp.src(CSS_CORECOMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.cached('css:src'))
        .pipe(plugins.less({
            paths: [path.join(__dirname, "less", "includes")],
            plugins: [lessAutoprefixInstance, LessGlobbing, LessInlineUrls]
        }).on('error', function (err) {
            console.warn(err);
            this.emit('end');
        }))
        .pipe(gulp.dest(SRC_DIR));
});

// Run all compile:js tasks
gulp.task('compile:js', ['compile:js:bundle']);

// Compile Typescript into TMP_DIR before bundling
gulp.task('compile:js:tmp', function (callback) {
    let tsResult = gulp.src(JS_PRECOMPILE_SELECTOR)
        //.pipe(plugins.cached('js:tmp'))
        .pipe(plugins.plumber())
        .pipe(plugins.sourcemaps.init())
        .on('error', function (err) {
            console.warn(err);
            this.emit('end');
        })
        .pipe(tsProject());
    return merge([
        tsResult
            .js
            .pipe(plugins.sourcemaps.write())
            .pipe(gulp.dest(TMP_DIR)),
        tsResult
            .dts
            .pipe(gulp.dest(TMP_DIR))
    ]).pipe(plugins.plumber()).on('error', function (err) {
        console.warn(err);
        this.emit('end');
    });
});

// Bundle Typescript into bundles using SystemJsBuilder
gulp.task('compile:js:bundle', ['compile:js:tmp'], function (callback) {
    return gulp.src(JS_POSTCOMPILE_SELECTOR.concat([]))
        .pipe(plugins.foreach((stream, file) => {
            let builder = plugins.systemjsBuilder('./');
            builder.loadConfigSync('./systemjs.config.js');
            // convert absolute file url to relative
            let relativePath = file.path.replace(`${__dirname}`, __dirname.startsWith('.') ? '' : '.').replace(/\\/g, '/');
            log(`Normalising IN path '${file.path}' --> '${relativePath}'`);
            return builder
                .buildStatic(relativePath, {
                    runtime: false,
                    minify: IS_PRODUCTION,
                    mangle: IS_PRODUCTION,
                    sourceMaps: false,
                    sourceMapContents: false,
                    lowResSourceMaps: false,
                    globalName: relativePath.replace(/(\.|\\|\/|\s+)/g, '_'),
                    format: 'global',
                    globalDeps: {
                        'jquery': 'jQuery',
                        'jquery.select2': 'jQuery'
                    }
                })
                .pipe(plugins.plumber())
                .pipe(plugins.rename(function (path) {
                    let originalPath = path.dirname;
                    let pathParts = originalPath.replace(/(\\|\/)/g, '/').split('/');
                    pathParts.shift();
                    path.dirname = pathParts.join('/');
                    log(`Normalising OUT path '${originalPath}' --> '${path.dirname}'`);
                })).pipe(gulp.dest(WWWROOT_DIR));
        }));
});

// Run all compile:html namespace tasks
gulp.task('compile:html', [], function (callback) {
    plugins.runSequence('compile:html:pugToHtml', 'compile:html:markdownToPugToHtml', 'compile:service-worker', callback);
});

// Convert *.pug files to *.html
gulp.task('compile:html:pugToHtml', function (callback) {
    return gulp.src(HTML_STATIC_COMPILE_SELECTOR)
        .pipe(plugins.cached('html'))
        .pipe(plugins.plumber())
        .pipe(plugins.pug({
            // Your options in here. 
        }))
        .pipe(plugins.hashSrc({ build_dir: WWWROOT_DIR, src_path: SRC_DIR }))
        .pipe(gulp.dest(WWWROOT_DIR));
});

// Convert *.md data files into *.pug files, then into *.html
gulp.task('compile:html:markdownToPugToHtml:tree', function (callback) {
    return gulp.src(HTML_DYNAMIC_COMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.util.buffer())
        .pipe(plugins.markdownToJson(marked, 'markdown-tree.json', (data, file) => {
            let url = file.path
                // only use the path from the root
                .replace(file.base, '')
                // change dir chars to url type
                .replace('\\', '/')
                // change extension
                .replace(/\.md$/, '.html')
                // prepend a '/'
                .replace(/^(.)/, '/$1');
            let niceUrl = file.path
                // only use the path from the root
                .replace(file.base, '')
                // change dir chars to url type
                .replace('\\', '/')
                // convert to folder urls
                .replace(/index.md$/, '')
                .replace(/([a-zA-Z0-9]+)\.md$/, '$1/')
                // prepend a '/'
                .replace(/^(.)/, '/$1');
            data.niceUrl = niceUrl;
            data.url = url;
            //delete data.template;
            return data;
        }))
        .pipe(gulp.dest(TMP_DIR));
});
gulp.task('compile:html:markdownToPugToHtml', ['compile:html:markdownToPugToHtml:tree'], function (callback) {
    let treeDataUrl = `${TMP_DIR.startsWith('.') ? TMP_DIR : './' + TMP_DIR}/markdown-tree.json`;
    let treeData = require(treeDataUrl);
    return gulp.src(HTML_DYNAMIC_COMPILE_SELECTOR)
        .pipe(plugins.plumber())
        .pipe(plugins.markdownToJson(marked))
        .pipe(plugins.wrap(function (data) {
            // read correct pug template from disk
            let template = data.file.path.replace(/[a-zA-Z0-9\-_\.]+\.json$/, '') + data.contents.template;
            log(`Normalising template path '${data.file.path}' --> '${template}'`);
            return fs.readFileSync(template).toString();
        }, {
                tree: treeData
            }, function (file) {
                // allow relative includes
                let baseDir = file.path.replace(/[a-zA-Z0-9\-_\.]+\.json$/, '').split(SRC_DIR)[0] + SRC_DIR;
                let template = file.path.replace(/([a-zA-Z0-9\-_\.]+)\.json$/, '$1.html');
                log(`Normalising transform path '${file.path}' --> '${template}'`, baseDir);
                return { engine: 'pug', filename: template, basedir: SRC_DIR };
            }))
        .pipe(plugins.rename({ extname: '.html' }))
        .pipe(plugins.hashSrc({ build_dir: WWWROOT_DIR, src_path: SRC_DIR }))
        .pipe(gulp.dest(WWWROOT_DIR));
});

gulp.task('compile:html:sitemap', function () {
    gulp.src([`${WWWROOT_DIR}/**/*.html`, `!${WWWROOT_DIR}/images/**/*.html`], {
        read: false
    })
        .pipe(plugins.plumber())
        .pipe(plugins.sitemap({
            siteUrl: SITEMAP_ROOT

        }))
        .pipe(gulp.dest(WWWROOT_DIR));
});

// Run all compile:assets namespace tasks
gulp.task('compile:assets', ['compile:assets:images', 'compile:assets:sprites:svg', 'compile:assets:sprites:png']);

// Optimise images
gulp.task('compile:assets:images', ['compile:assets:copy'], function () {
    return gulp.src(IMAGES_POSTCOMPILE_SELECTOR)
        .pipe(plugins.cached('images'))
        .pipe(plugins.imagemin({
            use: [
                imageminJpegoptim({
                    progressive: true,
                    max: 80
                }),
                imageminOptipng({
                    optimizationLevel: 3,
                    bitDepthReduction: true,
                    colorTypeReduction: true,
                    paletteReduction: true
                })
            ]
        }))
        .pipe(gulp.dest(WWWROOT_DIR))
});

// Create SVG sprites
gulp.task('compile:assets:sprites:svg', function (callback) {
    return gulp.src(SVG_SPRITE_SRC_DIR + '/*.svg')
        .pipe(plugins.svgSprite({
            shape: {
                spacing: {
                    padding: 0
                },
            },
            mode: {
                symbol: {
                    bust: false,
                    dir: '../',
                    sprite: 'sprite.symbol.svg',
                    example: true,
                    inline: true
                }
            }
        }))
        .on('error', function (error) {
            gutil.log(err);
            this.emit('end');
        })
        .pipe(gulp.dest(SVG_SPRITE_SRC_DIR));
});

// Create PNG sprites
gulp.task('compile:assets:sprites:png', function (callback) {
    let spriteData = gulp.src(SVG_SPRITE_SRC_DIR + '/*.png').pipe(plugins.spritesmith({
        imgName: 'sprite.png',
        cssName: 'sprite.png.css',
        padding: 4
    }));
    return spriteData
        .on('error', function (error) {
            gutil.log(err);
            this.emit('end');
        })
        .pipe(gulp.dest(SVG_SPRITE_SRC_DIR + '/png-sprite'));
});

// Copy assets to WWWROOT_DIR
gulp.task('compile:assets:copy', function (callback) {
    return gulp.src(ASSETS_PRECOMPILE_SELECTOR)
        .pipe(plugins.cached('assets'))
        .pipe(plugins.copy(WWWROOT_DIR, { prefix: 1 }));
});

gulp.task('compile:resourcehints', [], function (callback) {
    return gulp.src(`${WWWROOT_DIR}/**/*.html`)
        .pipe(plugins.debug({ title: 'resourcehints:' }))
        .pipe(plugins.resourceHints({}))
        .pipe(gulp.dest(WWWROOT_DIR + '/'))
});

gulp.task('compile:service-worker', [], function (callback) {
    swPrecache.write(path.join(WWWROOT_DIR, 'service-worker.js'), {
        staticFileGlobs: [WWWROOT_DIR + '/**/*.{js,css,png,jpg,gif,svg,eot,ttf,woff,woff2,json}'],
        stripPrefix: WWWROOT_DIR + '/',
        maximumFileSizeToCacheInBytes: (2097152 * 2),
        runtimeCaching: []
    }, callback);
});

gulp.task('compile:html:conditional', [], function (callback) {
    return gulp.src(`${WWWROOT_DIR}/**/*.html`)
        .pipe(plugins.htmlReplace({
            serviceworker: {
                src: ['/service-worker-registration.js'],
                tpl: '<script src="%s"></script>'
            }
        }))
        .pipe(gulp.dest(WWWROOT_DIR));
});

gulp.task('compile:production', [], function (callback) {
    plugins.runSequence('compile:assets', 'compile:css', 'compile:js', 'compile:html', 'compile:resourcehints', 'compile:html:sitemap', 'compile:service-worker', 'compile:html:conditional', callback);
});

gulp.task('compile:development', [], function (callback) {
    plugins.runSequence('compile:assets', 'compile:css:site', 'compile:js', 'compile:html', callback);
});

// Run all compile namespace tasks
gulp.task('compile', ['clean'], function (callback) {
    plugins.runSequence(IS_PRODUCTION ? 'compile:production' : 'compile:development', callback);
});

// Watch all files in SRC_DIR
gulp.task('watch', function (callback) {
    plugins.runSequence(['watch:html', 'watch:assets', 'watch:css', 'watch:js']);
});

// Watch all files in SRC_DIR
gulp.task('watch:html', function (callback) {
    return gulp.watch([`${SRC_DIR}/**/*.md`, `${SRC_DIR}/**/*.pug`], ['compile:html']);
});

// Watch all files in SRC_DIR
gulp.task('watch:assets', function (callback) {
    return gulp.watch(ASSETS_PRECOMPILE_SELECTOR, ['compile:assets']);
});

// Watch all files in SRC_DIR
gulp.task('watch:css', function (callback) {
    return gulp.watch([`${SRC_DIR}/**/*.less`, `${SRC_DIR}/**/*.css`], ['compile:css:site']);
});

// Watch all files in SRC_DIR
gulp.task('watch:js', function (callback) {
    return gulp.watch([[`${SRC_DIR}/**/*.ts`, `!${SRC_DIR}/**/*.d.ts`]], ['compile:js']);
});

gulp.task('server', function (callback) {
    return gulp.src([`package.json`])
        .pipe(plugins.prompt.prompt([
            {
                type: 'input',
                name: 'port',
                message: 'Port?',
                default: '7777'
            },
            {
                name: 'https',
                message: 'HTTPS?',
                default: false
            },
            {
                name: 'livereload',
                message: 'Live Reload?',
                default: false
            }], function (res) {
                plugins.runSequence('watch', 'compile:css:src');
                gulp.src(['.', 'wwwroot'])
                    .pipe(plugins.plumber())
                    .pipe(plugins.webserver({
                        livereload: res.livereload,
                        directoryListing: false,
                        open: `${res.https ? 'https' : 'http'}://127.0.0.1:${res.port}/`,
                        port: parseFloat(res.port),
                        path: '/',
                        https: res.https,
                        fallback: '404.html'
                    })).on('error', function (err) {
                        log(err);
                    });
            }));
});

// Starts a local WebServer
gulp.task('server:full', ['compile', 'server'], function (callback) { });

gulp.task('default', function () {
    log(`###################################`);
    log(`### Generic Static Site Builder ###`);
    log(`###################################`);
    log(`### Tasks:-                     ###`);
    log(`### gulp docs                   ###`);
    log(`### gulp server                 ###`);
    log(`### gulp compile --env=prod     ###`);
    log(`###################################`);
});