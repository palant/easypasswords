/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";
import url from "url";

import del from "del";
import gulp from "gulp";
import eslint from "gulp-eslint";
import htmlhint from "gulp-htmlhint";
import sass from "gulp-sass";
import stylelint from "gulp-stylelint";
import zip from "gulp-zip";
import merge from "merge-stream";
import alias from "@rollup/plugin-alias";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import vue from "rollup-plugin-vue";

import globalLoader from "./globalLoader.js";
import * as utils from "./gulp-utils.js";
import iife from "./iifeChunks.js";
import localeLoader from "./localeLoader.js";
import replace from "./replacePlugin.js";
import workerLoader from "./workerLoader.js";

const VERSION = JSON.parse(fs.readFileSync("./manifest.json")).version;
const __dirname = process.cwd(); // import.meta unsupported by current eslint version

function rollup(overrides = {})
{
  let prePlugins = overrides.plugins || [];
  let postPlugins = overrides.postPlugins || [];
  delete overrides.plugins;
  delete overrides.postPlugins;

  return utils.rollupStream({
    plugins: [
      ...prePlugins,
      globalLoader({
        jsqr: "JSQR",
        zxcvbn: "zxcvbn"
      }),
      alias({
        entries: [
          {
            find: "vue",
            replacement: (
              utils.hasArg("--dev")
                ? "vue/dist/vue.runtime.esm-browser.js"
                : "vue/dist/vue.runtime.esm-browser.prod.js"
            )
          }
        ]
      }),
      resolve(),
      commonjs({
        include: ["node_modules/**"]
      }),
      vue({
        template: {
          compilerOptions: {
            whitespace: "condense"
          }
        }
      }),
      ...postPlugins
    ]
  }, Object.assign({
    format: "iife",
    compact: true
  }, overrides));
}

gulp.task("eslint", function()
{
  return gulp.src(["*.js", "*.json", "ui/**/*.js", "ui/**/*.vue", "lib/**/*.js",
                   "test/**/*.js", "test-lib/**/*.js", "web/**/*.js",
                   "contentScript/**/*.js", "worker/**/*.js",
                   "locale/**/*.json", "!ui/third-party/**"])
             .pipe(eslint())
             .pipe(eslint.format())
             .pipe(eslint.failAfterError());
});

gulp.task("htmlhint", function()
{
  return gulp.src(["ui/**/*.html", "web/**/*.html"])
             .pipe(htmlhint(".htmlhintrc"))
             .pipe(htmlhint.failReporter());
});

gulp.task("stylelint", function()
{
  return gulp.src(["ui/**/*.scss"])
             .pipe(stylelint({
               "failAfterError": true,
               "syntax": "scss",
               "reporters": [
                 {
                   "formatter": "string",
                   "console": true
                 }
               ]
             }));
});

gulp.task("validate", gulp.parallel("eslint", "htmlhint", "stylelint"));

function buildWorkers(targetdir)
{
  return gulp.src(["worker/scrypt.js"])
             .pipe(rollup())
             .pipe(gulp.dest(`${targetdir}`));
}

function buildCommon(targetdir)
{
  return merge(
    gulp.src("LICENSE.txt")
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src("ui/**/*.html")
        .pipe(gulp.dest(`${targetdir}/ui`)),
    gulp.src("ui/images/**")
        .pipe(gulp.dest(`${targetdir}/ui/images`)),
    gulp.src("ui/third-party/**")
        .pipe(gulp.dest(`${targetdir}/ui/third-party`)),
    gulp.src("contentScript/fillIn.js")
        .pipe(rollup())
        .pipe(gulp.dest(`${targetdir}/contentScript`)),
    gulp.src("ui/*/main.js")
        .pipe(rollup({
          format: "es",
          manualChunks(id)
          {
            if (id.endsWith("/vue.js") || id.endsWith("/clipboard.js") || id.indexOf("/ui/components/") >= 0)
              return "shared";
            return null;
          },
          dir: "",
          chunkFileNames: "ui/[name].js",
          postPlugins: [iife()]
        }))
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["ui/**/*.scss"])
        .pipe(sass())
        .pipe(gulp.dest(`${targetdir}/ui`)),
    gulp.src("locale/**/*.json")
        .pipe(utils.combineLocales())
        .pipe(utils.toChromeLocale())
        .pipe(gulp.dest(`${targetdir}/_locales`)),
    gulp.src("lib/main.js")
        .pipe(rollup({
          file: "background.js"
        }))
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["lib/reloader.js"])
        .pipe(gulp.dest(`${targetdir}`)),
    buildWorkers(`${targetdir}/worker`)
  );
}

function touchReloader(targetdir)
{
  fs.writeFileSync(path.join(targetdir, "random.json"), String(Math.random()));
}

function removeReloader(data)
{
  let index = data.background.scripts.indexOf("reloader.js");
  if (index >= 0)
    data.background.scripts.splice(index, 1);
}

gulp.task("build-chrome", gulp.series("validate", function buildChrome()
{
  let stream = merge(
    buildCommon("build-chrome"),
    gulp.src("manifest.json")
        .pipe(utils.jsonModify(data =>
        {
          delete data.applications;
        }))
        .pipe(gulp.dest("build-chrome"))
  );
  stream.on("finish", () => touchReloader("build-chrome"));
  return stream;
}));

gulp.task("watch-chrome", gulp.series("build-chrome", function watchChrome()
{
  gulp.watch(["*.js", "*.json", "ui/**/*", "lib/**/*", "contentScript/**/*", "worker/**/*", "locale/**/*"], ["build-chrome"]);
}));

gulp.task("build-firefox", gulp.series("validate", function buildFirefox()
{
  let stream = merge(
    buildCommon("build-firefox"),
    gulp.src("manifest.json")
        .pipe(utils.jsonModify(data =>
        {
          delete data.minimum_chrome_version;
          delete data.minimum_opera_version;
          delete data.background.persistent;

          data.browser_action.browser_style = false;
        }))
        .pipe(gulp.dest("build-firefox"))
  );
  stream.on("finish", () => touchReloader("build-firefox"));
  return stream;
}));

gulp.task("watch-firefox", gulp.series("build-firefox", function watchFirefox()
{
  gulp.watch(["*.js", "*.json", "ui/**/*", "lib/**/*", "contentScript/**/*", "worker/**/*", "locale/**/*"], ["build-firefox"]);
}));

gulp.task("build-web", gulp.series("validate", function buildWeb()
{
  let targetdir = "build-web";
  return merge(
    gulp.src("LICENSE.txt")
        .pipe(gulp.dest(targetdir)),
    gulp.src(["ui/images/**"])
        .pipe(gulp.dest(`${targetdir}/images`)),
    gulp.src("ui/third-party/**")
        .pipe(gulp.dest(`${targetdir}/third-party`)),
    gulp.src(["ui/**/*.scss", "!ui/options/options.scss"])
        .pipe(sass())
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/index.js")
        .pipe(rollup({
          plugins: [
            replace({
              [path.resolve(__dirname, "lib", "browserAPI.js")]: path.resolve(__dirname, "web", "backgroundBrowserAPI.js"),
              [path.resolve(__dirname, "ui", "browserAPI.js")]: path.resolve(__dirname, "web", "contentBrowserAPI.js")
            }),
            workerLoader(/\/scrypt\.js$/),
            localeLoader(path.resolve(__dirname, "locale", "en_US"))
          ],
          postPlugins: [
            babel.default({
              retainLines: true,
              compact: false,
              babelrc: false,
              babelHelpers: "runtime",
              extensions: [".js", ".vue"],
              presets: ["@babel/preset-env"],
              plugins: [
                ["@babel/transform-runtime"]
              ]
            })
          ]
        }))
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/**/*.scss")
        .pipe(sass())
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/**/*.html")
        .pipe(gulp.dest(targetdir))
  );
}));

gulp.task("crx", gulp.series("build-chrome", function buildCRX()
{
  return merge(
    gulp.src([
      "build-chrome/**",
      "!build-chrome/manifest.json", "!build-chrome/reloader.js", "!build-chrome/random.json",
      "!build-chrome/**/.*", "!build-chrome/**/*.zip", "!build-chrome/**/*.crx"
    ]),
    gulp.src("build-chrome/manifest.json").pipe(utils.jsonModify(removeReloader))
  ).pipe(zip("pfp-" + VERSION + ".zip")).pipe(gulp.dest("build-chrome"));
}));

gulp.task("xpi", gulp.series("build-firefox", function buildXPI()
{
  return merge(
    gulp.src([
      "build-firefox/**",
      "!build-firefox/manifest.json", "!build-firefox/reloader.js", "!build-firefox/random.json",
      "!build-firefox/**/.*", "!build-firefox/**/*.xpi"
    ]),
    gulp.src("build-firefox/manifest.json").pipe(utils.jsonModify(removeReloader))
  ).pipe(zip("pfp-" + VERSION + ".xpi")).pipe(gulp.dest("build-firefox"));
}));

gulp.task("web", gulp.series("build-web", function zipWeb()
{
  return gulp.src([
    "build-web/**",
    "!build-web/**/.*", "!build-web/**/*.zip"
  ]).pipe(zip("pfp-web-" + VERSION + ".zip")).pipe(gulp.dest("build-web"));
}));

gulp.task("test", gulp.series("validate", function doTest()
{
  let testFile = utils.readArg("--test=");
  if (!testFile)
    testFile = "**/*.js";
  else if (!testFile.endsWith(".js"))
    testFile += ".js";

  return gulp.src("test/" + testFile)
             .pipe(utils.runTests());
}));

gulp.task("clean", function()
{
  return del(["build-chrome", "build-firefox", "build-web"]);
});

gulp.task("all", gulp.parallel("xpi", "crx", "web"));
gulp.task("default", gulp.parallel("all"));
