import * as THREE from 'three';
import * as ORE from '@ore-three-ts';

//bloom shader
import bloomBlurFrag from './shaders/bloomBlur.fs';
import bloomBrightFrag from './shaders/bloomBright.fs';

//smaa shaders
import edgeDetectionVert from './shaders/smaa_edgeDetection.vs';
import edgeDetectionFrag from './shaders/smaa_edgeDetection.fs';
import blendingWeightCalculationVert from './shaders/smaa_blendingWeightCalculation.vs';
import blendingWeightCalculationFrag from './shaders/smaa_blendingWeightCalculation.fs';
import neiborhoodBlendingVert from './shaders/smaa_neiborhoodBlending.vs';
import neiborhoodBlendingFrag from './shaders/smaa_neiborhoodBlending.fs';

//composite shader
import compositeFrag from './shaders/composite.fs';

export class RenderPipeline {

	private renderer: THREE.WebGLRenderer;

	//parameters
	private bloomResolutionRatio: number;
	private bloomRenderCount: number;
	private brightness: number;

	//uniforms
	private commonUniforms: ORE.Uniforms;
	private smaaCommonUni: ORE.Uniforms;

	//textures
	private inputTextures: ORE.Uniforms;

	//postprocessing
	private bloomBrightPP: ORE.PostProcessing;
	private bloomBlurPP: ORE.PostProcessing;
	private smaaEdgePP: ORE.PostProcessing;
	private smaaCalcWeighttPP: ORE.PostProcessing;
	private smaaBlendingPP: ORE.PostProcessing;
	private compositePP: ORE.PostProcessing;

	private renderTargets: {
		[keys:string]: THREE.WebGLRenderTarget
	};

	constructor( renderer: THREE.WebGLRenderer, parentUniforms?: ORE.Uniforms ) {

		this.renderer = renderer;
		this.bloomResolutionRatio = 0.4;
		this.bloomRenderCount = 5;
		this.brightness = 0.17;

		this.commonUniforms = ORE.UniformsLib.mergeUniforms( {
		}, parentUniforms );

		/*------------------------
			RenderTargets
		------------------------*/
		this.renderTargets = {
			rt1: new THREE.WebGLRenderTarget( 0, 0, {
				stencilBuffer: false,
				generateMipmaps: false,
				depthBuffer: true,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter
			} ),
			rt2: new THREE.WebGLRenderTarget( 0, 0, {
				depthBuffer: false,
				stencilBuffer: false,
				generateMipmaps: false,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter
			} ),
			rt3: new THREE.WebGLRenderTarget( 0, 0, {
				depthBuffer: false,
				stencilBuffer: false,
				generateMipmaps: false,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter
			} ),
		};

		for ( let i = 0; i < this.bloomRenderCount; i ++ ) {

			this.renderTargets[ 'rtBlur' + i.toString() + '_0' ] = new THREE.WebGLRenderTarget( 0, 0, {
				depthBuffer: false,
				stencilBuffer: false,
				generateMipmaps: true,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter
			} );

			this.renderTargets[ 'rtBlur' + i.toString() + '_1' ] = new THREE.WebGLRenderTarget( 0, 0, {
				depthBuffer: false,
				stencilBuffer: false,
				generateMipmaps: false,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter
			} );

		}

		/*------------------------
			InputTextures
		------------------------*/
		this.inputTextures = {
			areaTex: {
				value: null
			},
			searchTex: {
				value: null
			},
			envMap: {
				value: null
			}
		};

		let loader = new THREE.TextureLoader();
		loader.load( '../assets/gl/flower/smaa/smaa-area.png', ( tex ) => {

			tex.minFilter = THREE.LinearFilter;
			tex.generateMipmaps = false;
			tex.format = THREE.RGBFormat;
			tex.flipY = false;
			this.inputTextures.areaTex.value = tex;

		} );

		loader.load( '../assets/gl/flower/smaa/smaa-search.png', ( tex ) => {

			tex.minFilter = THREE.NearestFilter;
			tex.magFilter = THREE.NearestFilter;
			tex.generateMipmaps = false;
			tex.flipY = false;
			this.inputTextures.searchTex.value = tex;

		} );

		/*------------------------
			Bloom
		------------------------*/
		this.bloomBrightPP = new ORE.PostProcessing( this.renderer, {
			fragmentShader: bloomBrightFrag,
			uniforms: ORE.UniformsLib.mergeUniforms( {
				threshold: {
					value: 0.5,
				},
			}, this.commonUniforms ),
		} );

		this.bloomBlurPP = new ORE.PostProcessing( this.renderer, {
			fragmentShader: bloomBlurFrag,
			uniforms: ORE.UniformsLib.mergeUniforms( {
				backbuffer: {
					value: null
				},
				blurRange: {
					value: 0.8
				},
				renderCount: {
					value: this.bloomRenderCount
				},
				count: {
					value: 0
				},
				direction: { value: false },
			}, this.commonUniforms ),
		} );

		/*------------------------
			SMAA
		------------------------*/

		let defines = {
			"mad(a, b, c)": "(a * b + c)",
			"SMAA_THRESHOLD": "0.1",
			"SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR": "2.0",
			"SMAA_MAX_SEARCH_STEPS": "8",
			"SMAA_AREATEX_MAX_DISTANCE": "16",
			"SMAA_SEARCHTEX_SIZE": "vec2(66.0, 33.0)",
			"SMAA_AREATEX_PIXEL_SIZE": "( 1.0 / vec2( 160.0, 560.0 ) )",
			"SMAA_AREATEX_SUBTEX_SIZE": "( 1.0 / 7.0 )",
			"SMAA_SEARCHTEX_SELECT(sample)": "sample.g",
			"SMAA_AREATEX_SELECT(sample)": "sample.rg",
		};

		this.smaaCommonUni = ORE.UniformsLib.mergeUniforms( {
			SMAA_RT_METRICS: {
				value: new THREE.Vector4()
			}
		}, this.commonUniforms );

		this.smaaEdgePP = new ORE.PostProcessing( this.renderer,
			{
				vertexShader: edgeDetectionVert,
				fragmentShader: edgeDetectionFrag,
				uniforms: ORE.UniformsLib.mergeUniforms( {
				}, this.smaaCommonUni ),
				defines: defines
			}
		);

		this.smaaCalcWeighttPP = new ORE.PostProcessing( this.renderer,
			{
				vertexShader: blendingWeightCalculationVert,
				fragmentShader: blendingWeightCalculationFrag,
				uniforms: ORE.UniformsLib.mergeUniforms( {
					areaTex: this.inputTextures.areaTex,
					searchTex: this.inputTextures.searchTex,
				}, this.smaaCommonUni ),
				defines: defines,
			}
		);

		this.smaaBlendingPP = new ORE.PostProcessing( this.renderer,
			{
				vertexShader: neiborhoodBlendingVert,
				fragmentShader: neiborhoodBlendingFrag,
				uniforms: ORE.UniformsLib.mergeUniforms( {
				}, this.smaaCommonUni ),
				defines: defines
			}
		);

		/*------------------------
			Composite
		------------------------*/
		let compo = compositeFrag.replace( /RENDER_COUNT/g, this.bloomRenderCount.toString() );

		this.compositePP = new ORE.PostProcessing( this.renderer, {
			fragmentShader: compo,
			uniforms: ORE.UniformsLib.mergeUniforms( {
				brightness: {
					value: this.brightness
				},
			}, this.commonUniforms ),
			defines: {
				RENDER_COUNT: this.bloomRenderCount.toString()
			}
		} );

	}

	public render( scene: THREE.Scene, camera: THREE.Camera, renderTarget: THREE.WebGLRenderTarget ) {

		/*------------------------
			Scene
		------------------------*/
		let renderTargetMem = this.renderer.getRenderTarget();

		this.renderer.setRenderTarget( this.renderTargets.rt1 );
		this.renderer.render( scene, camera );
		this.renderer.setRenderTarget( renderTargetMem );

		this.renderer.autoClear = false;

		/*------------------------
			Bloom
		------------------------*/
		this.bloomBrightPP.render( {
			sceneTex: this.renderTargets.rt1.texture
		}, this.renderTargets.rt2 );

		let target: THREE.WebGLRenderTarget;
		let uni = this.bloomBlurPP.effect.material.uniforms;
		uni.backbuffer.value = this.renderTargets.rt2.texture;

		for ( let i = 0; i < this.bloomRenderCount; i ++ ) {

			uni.count.value = i;

			uni.direction.value = true;
			target = this.renderTargets[ 'rtBlur' + i.toString() + '_0' ];
			this.bloomBlurPP.render( null, target );

			uni.direction.value = false;
			uni.backbuffer.value = target.texture;
			target = this.renderTargets[ 'rtBlur' + i.toString() + '_1' ];
			this.bloomBlurPP.render( null, target );

			uni.backbuffer.value = target.texture;

		}

		/*------------------------
			SMAA
		------------------------*/
		this.smaaEdgePP.render( {
			sceneTex: this.renderTargets.rt1.texture,
		}, this.renderTargets.rt2 );

		this.smaaCalcWeighttPP.render( {
			backbuffer: this.renderTargets.rt2.texture,
		}, this.renderTargets.rt3 );

		this.smaaBlendingPP.render( {
			sceneTex: this.renderTargets.rt1.texture,
			backbuffer: this.renderTargets.rt3.texture,
		}, this.renderTargets.rt2 );


		/*------------------------
			Composite
		------------------------*/
		let compositeInputRenderTargets = {
			sceneTex: this.renderTargets.rt2.texture,
			bloomTexs: [] as THREE.Texture[]
		};

		for ( let i = 0; i < this.bloomRenderCount; i ++ ) {

			compositeInputRenderTargets.bloomTexs.push( this.renderTargets[ 'rtBlur' + i.toString() + '_1' ].texture );

		}

		this.compositePP.render( compositeInputRenderTargets, renderTarget );

		this.renderer.autoClear = true;

	}

	public resize( pixelWindowSize: THREE.Vector2 ) {

		this.smaaCommonUni.SMAA_RT_METRICS.value.set( 1 / pixelWindowSize.x, 1 / pixelWindowSize.y, pixelWindowSize.x, pixelWindowSize.y );

		this.renderTargets.rt1.setSize( pixelWindowSize.x, pixelWindowSize.y );
		this.renderTargets.rt2.setSize( pixelWindowSize.x, pixelWindowSize.y );
		this.renderTargets.rt3.setSize( pixelWindowSize.x, pixelWindowSize.y );

		for ( let i = 0; i < this.bloomRenderCount; i ++ ) {

			let size = pixelWindowSize.clone().multiplyScalar( this.bloomResolutionRatio );
			size.divideScalar( ( i + 1.0 ) * 2 );

			this.renderTargets[ 'rtBlur' + i.toString() + '_0' ].setSize( size.x, size.y );
			this.renderTargets[ 'rtBlur' + i.toString() + '_1' ].setSize( size.x, size.y );

		}

	}

}
