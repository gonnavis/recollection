const gulp = require( 'gulp' );
const gulpIf = require( 'gulp-if' );
const pug = require( 'gulp-pug' );
const autoprefixer = require( 'gulp-autoprefixer' );
const plumber = require( 'gulp-plumber' );
const sass = require( 'gulp-sass' );
const cssmin = require( 'gulp-cssmin' );
const minimist = require( 'minimist' );
const webpackStream = require( 'webpack-stream' );
const webpack = require( 'webpack' );
const browserSync = require( 'browser-sync' );
const eslint = require( 'gulp-eslint' );
const del = require( 'del' );
const fs = require( 'fs' );

const options = minimist( process.argv.slice( 2 ), {
	default: {
		name: null,
		P: false,
	}
});

const srcPath = './src';
const publicPath = './public';

function isFixed( file ) {

	return file.eslint != null && file.eslint.fixed;

}

function esLint( cb ) {

	let paths = [
		'./src/gl',
		'./src/topVisual'
	];

	for ( let i = 0; i < paths.length; i ++ ) {

		gulp.src( paths[ i ] + '**/*.js' )
			.pipe( eslint( { useEslintrc: true, fix: true } ) ) // .eslintrc を参照
			.pipe( eslint.format() )
			.pipe( gulpIf( isFixed, gulp.dest( paths[ i ] ) ) )
			.pipe( eslint.failAfterError() );

	}

	cb();

}

/*-------------------
	Production
--------------------*/

const glDir = srcPath + '/gl/';
const distGLDir =  publicPath + '/gl/';

function buildAllGLs( cb ){

	fs.readdir( glDir, ( err, files ) => {

		if ( err ) throw err;

		let conf = require( './webpack/buildAllGL.config' );
		conf.mode = options.P ? 'production' : 'development';

		for ( let i = 0; i < files.length; i++ ) {

			if( files[i] == '.DS_Store' ) continue;
			
			let glItemDir = glDir + files[i];
			let distGLItemDir = distGLDir + files[i];

			//set webpack entry files
			conf.entry[files[i]] = glItemDir + '/ts/main.ts';	 

			//pug
			gulp.src([ glItemDir + '/pug/**/*.pug', '!' + glItemDir + '/pug/**/_*.pug'] )
				.pipe(plumber())
				.pipe(pug({
					pretty: true,
					locals: {
						title: files[i],
					}
				}))
				.pipe(gulp.dest( distGLItemDir ));

			//sass
			gulp.src( glItemDir + "/scss/style.scss" )
				.pipe( plumber() )
				.pipe( autoprefixer() )
				.pipe( sass() )
				.pipe( cssmin() )
				.pipe( gulp.dest( distGLItemDir + "/css/" ) )

			//copy files
			gulp.src( glDir + files[i] + '/assets/**/*' ).pipe( gulp.dest( distGLItemDir + '/assets/' ) );

			gulp.src( glItemDir + '/' + files[i] + '.jpg', { allowEmpty: true } ).pipe( gulp.dest( distGLItemDir) );
			
		}
		
		conf.output.filename = '[name]/js/main.js';

		//webpack
		webpackStream( conf, webpack )
			.pipe( gulp.dest( distGLDir ) )
			.on( 'end', cb )

	});

}

function cleanAllFiles( cb ){

	del([

		publicPath
		
	],{

		force: true,

	}).then( ( paths ) => {

		cb();

	});

}

/*-------------------
	Development
--------------------*/

let srcDir = '';
let distDir = '';

function copyFiles( cb ){

	gulp.src( srcDir + '/assets/**/*' ).pipe( gulp.dest( distDir + '/assets/' ) );
	gulp.src( './src/conf/**/*' ).pipe( gulp.dest( distDir ) );

	browserSync.reload();
	
	cb();

}

function cleanDevFiles( cb ){

	del([

		distDir
		
	],{

		force: true,

	}).then( ( paths ) => {

		cb();

	});

}

function webpackDev(){

	let conf = require( './webpack/dev.config' );
	conf.entry.main = srcDir + '/ts/main.ts';
	conf.output.filename = 'main.js';
	conf.mode = options.P ? 'production' : 'development';
	
	return webpackStream( conf, webpack )
		.on( 'error', function() { this.emit( 'end' ) } )
		.pipe( gulp.dest( distDir + "/js/" ) )
		.on( 'end', browserSync.reload );
}

function pugDev(){

	let title = options.name || 'Recollection';
	
	return gulp.src([ srcDir + '/pug/**/*.pug', '!' + srcDir + '/pug/**/_*.pug'] )
		.pipe(plumber())
		.pipe(pug({
			pretty: true,
			locals: {
				title: title,
			}
		}))
		.pipe( gulp.dest( distDir ) )
		.unpipe( browserSync.reload() );
	
}

function sassDev(){

	return gulp.src( srcDir + "/scss/style.scss" )
		.pipe( plumber() )
		.pipe( sass() )
		.pipe( autoprefixer() )
		.pipe( cssmin() )
		.pipe( gulp.dest( distDir + "/css/" ) )
		.pipe( browserSync.stream() )

}

function brSync(){

	browserSync.init({
		server: {
			baseDir: distDir,
			index: "index.html",
		},
		notify: false
	});

}

function watch(){

	gulp.watch( srcDir + '/ts/**/*', gulp.series( webpackDev ) );
	gulp.watch( srcDir + '/pug/**/*', gulp.series( pugDev ) );
	gulp.watch( srcDir + '/scss/**/*', gulp.series( sassDev ) );
	gulp.watch( srcDir + '/html/**/*', gulp.series( copyFiles ) );
	gulp.watch( srcDir + '/assets/**/*', gulp.series( copyFiles ) );
	
	let commonDir = './src/common';
	gulp.watch( commonDir + '/ts/**/*', gulp.series( webpackDev ) );
	gulp.watch( commonDir + '/pug/**/*', gulp.series( pugDev ) );

}

function setDevGLPath( cb ){
	
	srcDir = srcPath + '/gl/' + options.name;
	distDir = publicPath + '/gl/' + options.name + '/public';

	cb();
}

function setDevMainVisualPath( cb ){

	srcDir = srcPath + '/MainVisual';
	distDir = publicPath;

	cb();

}

let develop = gulp.series( 
	copyFiles,
	gulp.parallel( pugDev, webpackDev, sassDev ),
	gulp.parallel( brSync, watch ),
);

let build = gulp.series( 
	copyFiles,
	gulp.parallel( pugDev, webpackDev, sassDev ),
);


//build topVisual
exports.default = gulp.series( cleanAllFiles, buildAllGLs, setDevMainVisualPath, develop );

//build GLs
exports.gl = gulp.series( setDevGLPath, cleanDevFiles, develop );

exports.lint = gulp.series( esLint );

exports.build = gulp.series( cleanAllFiles, buildAllGLs, setDevMainVisualPath, build );
