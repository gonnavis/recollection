import * as THREE from 'three';
import * as ORE from '@ore-three-ts';

import bgFrag from './shaders/bg.fs';

export class Background extends THREE.Object3D {

	private bg: ORE.Background;
	private uni: any;

	constructor() {

		super();

		this.uni = {
			time: {
				value: 0
			}
		};

		this.bg = new ORE.Background( { fragmentShader: bgFrag, uniforms: this.uni } );

		this.add( this.bg );

	}

	public update( time:number ) {

		this.uni.time.value = time;

	}

}
