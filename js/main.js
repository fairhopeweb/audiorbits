/**
 * @author D.Thiele @https://hexxon.me
 * 
 * @license
 * Copyright (c) 2020 D.Thiele All rights reserved.  
 * Licensed under the GNU GENERAL PUBLIC LICENSE.
 * See LICENSE file in the project root for full license information.  
 * 
 * @see
 * AudiOrbits project	(https://steamcommunity.com/sharedfiles/filedetails/?id=1396475780)
 * for Wallpaper Engine (https://steamcommunity.com/app/431960)
 * by Hexxon 			(https://hexxon.me)
 * 
 * You don't own Wallper Engine but want to see this in action?
 * Go here:	https://experiment.hexxon.me
 * 
 * @description
 * Audiorbits for Wallpaper Engine
 * 
 * If you're reading this you're either pretty interested in the code or just bored :P
 * Either way thanks for using this Wallpaper I guess.
 * Leave me some feedback on the Workshop-Page for this item if you like!
 * 
*/

// custom logging function
function print(arg, force) {
	if (!audiOrbits.initialized || audiOrbits.debug || force) console.log("AudiOrbits: " + JSON.stringify(arg));
}

// base object for wallpaper
var audiOrbits = {
	// webvr user input data
	userData: {
		isSelecting: false,
		controller1: null,
		controller2: null
	},
	// holds default wallpaper settings
	// these basically connect 1:1 to wallpaper engine settings.
	// for more explanation on settings visit the Workshop-Item-Forum (link above)
	settings: {
		schemecolor: "0 0 0",
		parallax_option: 0,
		parallax_angle: 180,
		parallax_strength: 3,
		auto_parallax_speed: 2,
		color_fade_speed: 2,
		default_brightness: 60,
		default_saturation: 10,
		zoom_val: 1,
		rotation_val: 0,
		custom_fps: false,
		fps_value: 60,
		minimum_volume: 1,
		minimum_brightness: 10,
		minimum_saturation: 10,
		audio_multiplier: 2,
		audio_smoothing: 75,
		audiozoom_val: 2,
		audiozoom_smooth: false,
		alg_a_min: -25,
		alg_a_max: 25,
		alg_b_min: 0.3,
		alg_b_max: 1.7,
		alg_c_min: 5,
		alg_c_max: 16,
		alg_d_min: 1,
		alg_d_max: 9,
		alg_e_min: 1,
		alg_e_max: 10,
		generate_tunnel: false,
		tunnel_inner_radius: 5,
		tunnel_outer_radius: 5,
		base_texture_path: "./img/galaxy.png",
		texture_size: 7,
		stats_option: -1,
		field_of_view: 90,
		fog_thickness: 3,
		scaling_factor: 1800,
		camera_bound: 1000,
		num_points_per_subset: 4000,
		num_subsets_per_level: 16,
		num_levels: 4,
		level_depth: 600,
		level_shifting: false,
		bloom_filter: false,
		lut_filter: -1,
		mirror_shader: 0,
		mirror_invert: true,
		color_mode: 0,
		user_color_a: "1 0.5 0",
		user_color_b: "0 0.5 1",
		seizure_warning: true,
	},
	// context?
	isWebContext: false,

	// started yet?
	initialized: false,

	// paused?
	PAUSED: false,

	// debugging
	debug: false,
	debugTimeout: null,

	// relevant html elements
	container: null,
	mainCanvas: null,
	helperContext: null,
	// these are set once 
	resetBar: null,
	resetText: null,

	// Seconds & interval for reloading the wallpaper
	resetTimespan: 5,
	resetTimeout: null,

	// render relevant stuff
	lastFrame: performance.now(),
	renderTimeout: null,

	// interval for swirlHandler
	swirlInterval: null,

	// extended  user settings
	colorObject: null,
	// mouse over canvas
	mouseX: 0,
	mouseY: 0,
	// window half size
	windowHalfX: window.innerWidth / 2,
	windowHalfY: window.innerHeight / 2,

	// Three.js relevant objects
	renderer: null,
	composer: null,
	camera: null,
	scene: null,
	// main orbit data
	levels: [],
	moveBacks: [],
	hueValues: [],
	// actions to perform after render
	afterRenderQueue: [],

	// generator holder
	levelWorker: null,
	levelWorkersRunning: 0,
	levelWorkerCall: null,

	///////////////////////////////////////////////
	// APPLY SETTINGS
	///////////////////////////////////////////////

	// Apply settings from the project.json "properties" object and takes certain actions
	applyCustomProps: function (props) {
		print("applying settings: " + Object.keys(props).length);

		var _ignore = ["debugging", "audioprocessing", "img_overlay",
			"img_background", "base_texture", "mirror_invalid_val"];

		var _reInit = ["texture_size", "stats_option", "field_of_view", "fog_thickness", "scaling_factor",
			"camera_bound", "num_points_per_subset", "num_subsets_per_level", "num_levels", "level_depth",
			"level_shifting", "bloom_filter", "lut_filter", "mirror_shader", "mirror_invert", "custom_fps"];

		var self = audiOrbits;
		var sett = self.settings;
		var reInitFlag = false;

		// possible apply-targets
		var settStorage = [sett, weas.settings, weicue.settings];

		// loop all settings for updated values
		for (var setting in props) {
			// ignore this setting or apply it manually
			if (_ignore.includes(setting) || setting.startsWith("HEADER_")) continue;
			// get the updated setting
			var prop = props[setting];
			// check typing
			if (!prop || !prop.type || prop.type == "text") continue;

			var found = false;
			// process all storages
			for (var storage of settStorage) {
				if (storage[setting] != null) {
					// save b4
					found = true;
					var b4Setting = storage[setting];
					// apply prop value
					if (prop.type == "bool")
						storage[setting] = prop.value == true;
					else
						storage[setting] = prop.value;

					// set re-init flag if value changed and included in list
					reInitFlag = reInitFlag || b4Setting != storage[setting] && _reInit.includes(setting);
				}
			}
			// invalid?
			if (!found) print("Unknown setting: " + setting);
		}

		// update preview visbility after setting possibly changed
		weicue.updatePreview();

		// Custom user images
		var setImgSrc = function (imgID, srcVal) {
			$(imgID).fadeOut(1000, () => {
				if (srcVal && srcVal !== "") {
					$(imgID).attr("src", "file:///" + srcVal);
					$(imgID).fadeIn(1000);
				}
			});
		};
		if (props["img_background"])
			setImgSrc("#img_back", props["img_background"].value);
		if (props["img_overlay"])
			setImgSrc("#img_over", props["img_overlay"].value);

		// intitialize texture splash
		if (props["base_texture"]) {
			var val = props["base_texture"].value;
			switch (val) {
				default: sett.base_texture_path = "./img/galaxy.png"; break;
				case 1: sett.base_texture_path = "./img/cuboid.png"; break;
				case 2: sett.base_texture_path = "./img/fractal.png"; break;
			}
			reInitFlag = true;
		}

		// re-initialize colors if mode or user value changed
		if (props["color_mode"] || props["user_color_a"] || props["user_color_b"]) {
			self.initHueValues();
		}

		// debug logging
		if (props["debugging"]) self.debug = props["debugging"].value == true;
		if (!self.debug && self.debugTimeout) {
			clearTimeout(self.debugTimeout);
			self.debugTimeout = null;
		}
		if (self.debug && !self.debugTimeout) self.debugTimeout = setTimeout(() => self.applyCustomProps({ "debugging": { value: false } }), 1000 * 60);
		$("#debugwnd").css("visibility", self.debug ? "visible" : "hidden");

		// fix for centered camera on Parallax "none"
		if (sett.parallax_option == 0) self.mouseX = self.mouseY = 0;
		// set Cursor for "fixed" parallax mode
		if (sett.parallax_option == 3) self.positionMouseAngle(sett.parallax_angle);

		// have render-relevant settings been changed?
		return reInitFlag;
	},


	///////////////////////////////////////////////
	// INITIALIZE
	///////////////////////////////////////////////

	initOnce: function () {
		print("initializing...", true);
		var self = audiOrbits;
		var sett = self.settings;

		// No WebGL ? o.O
		if (!THREE || !Detector.webgl) {
			Detector.addGetWebGLMessage();
			return;
		}
		// set global caching
		THREE.Cache.enabled = true;

		// get static elements
		self.resetBar = document.getElementById("reload-bar");
		self.resetText = document.getElementById("reload-text");
		self.container = document.getElementById("renderContainer");

		// add global mouse (parallax) listener
		var mouseUpdate = (event) => {
			if (sett.parallax_option != 1) return;
			if (event.touches.length == 1) {
				event.preventDefault();
				self.mouseX = event.touches[0].pageX - self.windowHalfX;
				self.mouseY = event.touches[0].pageY - self.windowHalfY;
			}
			else if (event.clientX) {
				self.mouseX = event.clientX - self.windowHalfX;
				self.mouseY = event.clientY - self.windowHalfY;
			}
		}
		document.addEventListener("touchstart", mouseUpdate, false);
		document.addEventListener("touchmove", mouseUpdate, false);
		document.addEventListener("mousemove", mouseUpdate, false);

		// scaling listener
		window.addEventListener("resize", (event) => {
			self.windowHalfX = window.innerWidth / 2;
			self.windowHalfY = window.innerHeight / 2;
			if (!self.camera || !self.renderer) return;
			self.camera.aspect = window.innerWidth / window.innerHeight;
			self.camera.updateProjectionMatrix();
			self.renderer.setSize(window.innerWidth, window.innerHeight);
		}, false);

		// setup lookuptable textures once
		lutSetup.run();
		
		// real initializer
		self.initSystem();

		//
		var initWrap = () => {
			$("#triggerwarn").fadeOut(1000, () => {
				$("#renderContainer").fadeIn(5000);
				self.popupMessage("<h1>" + document.title + "</h1>", true);
			});
		};

		// initialize now or after a delay?
		if (!sett.seizure_warning) initWrap();
		else {
			$("#triggerwarn").fadeIn(1000);
			setTimeout(initWrap, 10000);
		}
	},

	// re-initialies the walpaper after some time
	reInitSystem: function () {
		print("re-initializing...");
		// Lifetime variables
		var self = audiOrbits;

		// hide reload indicator
		$("#reload-bar, #reload-text").removeClass("show").addClass("done");
		// kill intervals
		clearInterval(self.swirlInterval);
		// kill stats
		if (self.stats) self.stats.dispose();
		self.stats = null;
		// kill shader processor
		if (self.composer) self.composer.reset();
		self.composer = null;
		// kill frame animation and webgl
		self.setRenderer(null);
		self.renderer.forceContextLoss();
		// recreate webgl canvas
		self.container.removeChild(self.mainCanvas);
		var mainCvs = document.createElement("canvas");
		mainCvs.id = "mainCvs";
		self.container.appendChild(mainCvs);

		// actual re-init
		self.initSystem();
	},

	// initialize the geometric & grpahics system
	// => starts rendering loop afterwards
	initSystem: function () {
		// Lifetime variables
		var self = audiOrbits;
		var sett = self.settings;

		// reset rendering
		self.speedVelocity = 0;
		self.swirlStep = 0;
		// reset Orbit data
		self.levels = [];
		self.moveBacks = [];
		self.hueValues = [];
		self.afterRenderQueue = [];

		// setup level generator
		self.levelWorker = new Worker('./js/worker/levelWorker.js');
		self.levelWorker.addEventListener('message', self.levelGenerated, false);
		self.levelWorker.addEventListener('error', self.levelError, false);

		// init stats
		if (sett.stats_option >= 0) {
			print("Init stats: " + sett.stats_option);
			self.stats = new Stats();
			self.stats.showPanel(sett.stats_option); // 0: fps, 1: ms, 2: mb, 3+: custom
			document.body.appendChild(self.stats.dom);
		}

		// get canvases & contexts
		// ensure the canvas sizes are set !!!
		// these are independent from the style sizes
		self.mainCanvas = document.getElementById("mainCvs");
		self.mainCanvas.width = window.innerWidth;
		self.mainCanvas.height = window.innerHeight;

		// set function to be called when all levels are generated
		// will trigger to load the texture
		self.levelWorkerCall = () => {
			// apply data
			while (self.afterRenderQueue.length > 0) {
				self.afterRenderQueue.shift()();
			}

			print("loading Texture: " + sett.base_texture_path);
			// load main texture
			// path, onLoad, onProgress, onError
			new THREE.TextureLoader().load(sett.base_texture_path,
				self.textureInit, undefined, self.textureError
			);
		};

		// setup vertexdata-array objects
		for (var l = 0; l < sett.num_levels; l++) {
			var sets = [];
			for (var i = 0; i < sett.num_subsets_per_level; i++) {
				sets[i] = [];
				for (var j = 0; j < sett.num_points_per_subset; j++) {
					sets[i][j] = new THREE.Vector3(0, 0, 0);
				}
			}
			// set subset moveback counter
			self.moveBacks[l] = 0;
			// create level object
			self.levels[l] = {
				myLevel: l,
				subsets: sets
			};
			// generate subset data for the first time
			self.generateLevel(l);
		}
	},

	/// continue intialisation affter texture was loaded
	textureInit: function (texture) {
		var self = audiOrbits;
		var sett = self.settings;

		// create camera
		self.camera = new THREE.PerspectiveCamera(sett.field_of_view, window.innerWidth / window.innerHeight, 1, 3 * sett.scaling_factor);
		self.camera.position.z = sett.scaling_factor / 2;
		// create distance fog
		self.scene = new THREE.Scene();
		self.scene.fog = new THREE.FogExp2(0x000000, sett.fog_thickness / 10000);
		// generate random hue vals
		self.initHueValues();
		// material properties
		var matprops = {
			map: texture,
			size: sett.texture_size,
			blending: THREE.AdditiveBlending,
			depthTest: false,
			transparent: true
		};
		var subsetDist = sett.level_depth / sett.num_subsets_per_level;

		// Create WEBGL objects for each level and subset
		for (var k = 0; k < sett.num_levels; k++) {
			for (var s = 0; s < sett.num_subsets_per_level; s++) {
				// create particle geometry from orbit vertex data
				var geometry = new THREE.Geometry();
				for (var i = 0; i < sett.num_points_per_subset; i++) {
					geometry.vertices.push(self.levels[k].subsets[s][i]);
				}
				geometry.dynamic = true;
				// create particle material with map & size
				var material = new THREE.PointsMaterial(matprops);
				// set material defaults
				material.color.setHSL(self.hueValues[s], sett.default_saturation, sett.default_brightness / 100);
				// create particle system from geometry and material
				var particles = new THREE.Points(geometry, material);
				particles.myMaterial = material;
				particles.myLevel = k;
				particles.mySubset = s;
				particles.position.x = 0;
				particles.position.y = 0;
				if (sett.level_shifting) {
					particles.position.z = - sett.level_depth * k - (s * subsetDist * 2) + sett.scaling_factor / 2;
					if (k % 2 != 0) particles.position.z -= subsetDist;
				}
				else particles.position.z = - sett.level_depth * k - (s * subsetDist) + sett.scaling_factor / 2;
				// euler angle 45 deg in radians
				particles.rotation.z = -0.785398;
				particles.needsUpdate = false;
				// add to scene
				self.scene.add(particles);
			}
		}

		// Setup renderer and effects
		self.renderer = new THREE.WebGLRenderer({
			canvas: self.mainCanvas,
			clearColor: 0x000000,
			clearAlpha: 1,
			alpha: true,
			antialias: true
		});
		self.renderer.setSize(window.innerWidth, window.innerHeight);

		// TODO enable web-vr context
		if (self.isWebContext) {
			self.initWebVR();
		}

		// initialize Shaders

		// add import Pass from real renderer
		self.composer = new THREE.EffectComposer(self.renderer);
		self.composer.addPass(new THREE.RenderPass(self.scene, self.camera, null, 0x000000, 1));
		// last added filter
		var lastEffect = null;
		// bloom
		if (sett.bloom_filter) {
			var urBloomPass = new THREE.UnrealBloomPass(512);
			lastEffect = urBloomPass;
			urBloomPass.renderToScreen = false;
			self.composer.addPass(urBloomPass);
		}
		// lookuptable filter
		if (sett.lut_filter >= 0) {
			// add normal or filtered LUT shader
			var lutInfo = lutSetup.Textures[sett.lut_filter];
			// get normal or filtered LUT shader
			var lutPass = new THREE.ShaderPass(lutInfo.filter ?
				THREE.LUTShader : THREE.LUTShaderNearest);
			// prepare render queue
			lastEffect = lutPass;
			lutPass.renderToScreen = false;
			self.composer.addPass(lutPass);
			// set shader uniform values
			lutPass.uniforms.lutMap.value = lutInfo.texture;
			lutPass.uniforms.lutMapSize.value = lutInfo.size;
		}
		// fractal mirror shader
		if (sett.mirror_shader > 1) {
			var mirrorPass = new THREE.ShaderPass(THREE.FractalMirrorShader);
			lastEffect = mirrorPass;
			mirrorPass.renderToScreen = false;
			self.composer.addPass(mirrorPass);
			// set shader uniform values
			mirrorPass.uniforms.invert.value = sett.mirror_invert;
			mirrorPass.uniforms.numSides.value = sett.mirror_shader;
			mirrorPass.uniforms.iResolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
		}

		// render last effect
		if (lastEffect) lastEffect.renderToScreen = true;

		// prepare new orbit levels for the first reset/moveBack when a subset passes the camera
		for (var l = 0; l < sett.num_levels; l++) {
			self.generateLevel(l);
		}

		// init plugins
		weicue.init(self.mainCanvas);

		// start auto parallax handler
		swirlInterval = setInterval(self.swirlHandler, 1000 / 60);

		// start rendering
		self.setRenderer(self.renderLoop);

		// print
		print("init complete.", true);
	},
	// failed to load texture
	textureError: function (err) {
		print("texture loading error:", true);
		print(err, true);
	},

	// initialize hue-values by color mode
	initHueValues: function () {
		print("init hues", true);
		var self = audiOrbits;
		var sett = self.settings;
		var cobj = self.colorObject = self.getColorObject();
		//print("initHueV: a=" + cobj.hsla + ", b=" + cobj.hslb);
		for (var s = 0; s < sett.num_subsets_per_level; s++) {
			var col = Math.random();
			switch (sett.color_mode) {
				case 1:
				case 4: col = cobj.hsla; break;
				case 2: col = cobj.min + (s / sett.num_subsets_per_level * cobj.range); break;
				case 3: col = cobj.min + (col * cobj.range); break;
			}
			self.hueValues[s] = col;
		}
	},
	// returns the processed user color object
	getColorObject: function () {
		var self = audiOrbits;
		var sett = self.settings;
		var a = self.rgbToHue(sett.user_color_a.split(" "));
		var b = self.rgbToHue(sett.user_color_b.split(" "));
		var mi = Math.min(a, b);
		var ma = Math.max(a, b);
		return {
			hsla: a,
			hslb: b,
			min: mi,
			max: ma,
			range: ma - mi
		}
	},
	// get HUE val
	rgbToHue: function (arr) {
		var r1 = arr[0];
		var g1 = arr[1];
		var b1 = arr[2];
		var maxColor = Math.max(r1, g1, b1);
		var minColor = Math.min(r1, g1, b1);
		var L = (maxColor + minColor) / 2;
		var S = 0;
		var H = 0;
		if (maxColor != minColor) {
			if (L < 0.5) {
				S = (maxColor - minColor) / (maxColor + minColor);
			} else {
				S = (maxColor - minColor) / (2.0 - maxColor - minColor);
			}
			if (r1 == maxColor) {
				H = (g1 - b1) / (maxColor - minColor);
			} else if (g1 == maxColor) {
				H = 2.0 + (b1 - r1) / (maxColor - minColor);
			} else {
				H = 4.0 + (r1 - g1) / (maxColor - minColor);
			}
		}
		L = L * 100;
		S = S * 100;
		H = H * 60;
		if (H < 0) {
			H += 360;
		}
		return H / 360;
	},


	///////////////////////////////////////////////
	// RENDERING
	///////////////////////////////////////////////

	// start or stop rendering
	setRenderer: function (renderFunc) {
		var self = audiOrbits;
		var sett = self.settings;
		// clear all old renderers
		if (self.renderer) {
			self.renderer.setAnimationLoop(null);
		}
		if (self.renderTimeout) {
			clearTimeout(self.renderTimeout);
			self.renderTimeout = null;
		}
		// call new renderer ?
		if (renderFunc != null) {
			if (sett.custom_fps) {
				self.renderTimeout = setTimeout(self.renderLoop, 1000 / sett.fps_value);
			}
			else if (self.renderer) {
				self.renderer.setAnimationLoop(renderFunc);
			}
		}
	},

	// root render frame call
	renderLoop: function () {

		//try {
			var self = audiOrbits;
			var sett = self.settings;
			// paused - stop render
			if (self.PAUSED) return;
			// custom rendering needs manual re-call
			if (self.renderTimeout)
				self.renderTimeout = setTimeout(self.renderLoop, 1000 / sett.fps_value);

			// track FPS, mem etc.
			if (self.stats) self.stats.begin();

			// Figure out how much time passed since the last animation
			var now = performance.now();
			var ellapsed = Math.max(1, Math.min(10000, now - self.lastFrame));

			// calc delta
			var delta = Math.max(0.001, Math.min(10, ellapsed / 16.6667));

			// render canvas
			self.renderFrame(ellapsed / 1000, delta);

			// set lastFrame time
			self.lastFrame = performance.now();

			// ICUE PROCESSING
			// its better to do this every frame instead of seperately timed
			weicue.updateCanvas();

			// TODO: WEBVR PROCESSING
			if (self.isWebContext) {
				self.handleVRController(self.userData.controller1);
				self.handleVRController(self.userData.controller1);
			}

			// randomly do one after-render-aqction
			// yes this is intended: "()()"
			if (self.afterRenderQueue.length > 0 && Math.random() > 0.69)
				self.afterRenderQueue.shift()();

			// stats
			if (self.stats) self.stats.end();

		/*
		} catch (ex) {
			console.log("renderLoop exception: " + ex, true);
		}
		*/

	},

	// render a single frame with the given delta
	renderFrame: function (ellapsed, deltaTime) {
		//print("| render | ellapsed: " + ellapsed + ", delta: " + deltaTime);
		// stats
		var self = audiOrbits;
		var sett = self.settings;
		var cObj = self.colorObject;
		// local vars are faster
		var flmult = (15 + sett.audio_multiplier) * 0.02;
		var spvn = sett.zoom_val;
		var rot = sett.rotation_val / 5000;
		var camera = self.camera;
		var scene = self.scene;
		var scenelen = scene.children.length;
		var hueValues = self.hueValues;
		var spvel = self.speedVelocity;
		var moveBacks = self.moveBacks;

		// calculate camera parallax with smoothing
		var clampCam = (axis) => Math.min(sett.camera_bound, Math.max(-sett.camera_bound, axis));
		var newCamX = clampCam(self.mouseX * sett.parallax_strength / 50);
		var newCamY = clampCam(self.mouseY * sett.parallax_strength / -50);
		if (camera.position.x != newCamX) camera.position.x += (newCamX - camera.position.x) * deltaTime * 0.05;
		if (camera.position.y != newCamY) camera.position.y += (newCamY - camera.position.y) * deltaTime * 0.05;

		// shift hue values
		if (sett.color_mode == 0) {
			var hueAdd = (sett.color_fade_speed / 4000) * deltaTime;
			for (var s = 0; s < sett.num_subsets_per_level - 1; s++) {
				hueValues[s] += hueAdd;
				if (hueValues[s] >= 1)
					hueValues[s] -= 2;
			}
		}

		// set camera view-target to scene-center
		camera.lookAt(scene.position);

		// calculate boost strength & step size if data given
		var hasAudio = weas.hasAudio();
		var lastAudio, boost, step;
		if (hasAudio) {
			spvn = spvn + sett.audiozoom_val / 1.5;
			// get 
			lastAudio = weas.lastAudio;
			// calc audio boost
			boost = lastAudio.intensity * flmult;
			// calculate step distance between levels
			step = (sett.num_levels * sett.level_depth * 1.2) / 128;
			// speed velocity calculation
			if (sett.audiozoom_val > 0)
				spvn += sett.zoom_val * boost * 0.02 + boost * sett.audiozoom_val * 0.05;
		}

		// apply smoothing or direct value
		if (!hasAudio || sett.audiozoom_smooth) {
			self.speedVelocity += ((spvn - spvel) * sett.audio_smoothing / 1000);
		}
		else self.speedVelocity = spvn;

		// rotation calculation
		if (hasAudio)
			rot *= spvn * 0.1;

		// position all objects
		for (i = 0; i < scenelen; i++) {
			var child = scene.children[i];
			// reset if out of bounds
			if (child.position.z > camera.position.z) {
				// offset to back
				print("moved back child: " + i);
				child.position.z -= sett.num_levels * sett.level_depth;
				moveBacks[child.myLevel]++;
				// update the child visually
				if (child.needsUpdate) {
					child.geometry.verticesNeedUpdate = true;
					child.needsUpdate = false;
				}
				// process subset generation
				if (moveBacks[child.myLevel] == sett.num_subsets_per_level) {
					moveBacks[child.myLevel] = 0;
					self.generateLevel(child.myLevel);
				}
			}
			// velocity & rotation
			child.position.z += spvel * deltaTime;
			child.rotation.z -= rot * deltaTime;
		}

		// HSL calculation with audio?
		if (hasAudio) {
			// move as many calculations out of loop as possible
			var minSat = sett.minimum_saturation / 100;
			var minBri = sett.minimum_brightness / 100;
			// iterate through all objects
			for (i = 0; i < scenelen; i++) {
				var child = scene.children[i];
				// use obj to camera distance with step to get frequency from data >> do some frequency calculations
				var freqIndx = Math.round((camera.position.z - child.position.z) / step) + 4;
				// get & process frequency data
				var cfreq = parseFloat(lastAudio.data[freqIndx]);
				var rFreq = (cfreq * flmult / 3) / lastAudio.max;
				var cHue = Math.abs(hueValues[child.mySubset]);
				// uhoh ugly special case
				if (sett.color_mode == 4) {
					var tHue = cObj.hslb;
					cHue += (tHue - cHue) * cfreq / lastAudio.max;
				}
				else if (sett.color_mode == 0)
					cHue += rFreq;
				// quick maths
				var nhue = cHue % 1.0;
				var nsat = Math.abs(minSat + rFreq + rFreq * boost * 0.07);
				var nlight = Math.min(0.7, minBri + rFreq + rFreq * boost * 0.01);
				// update dat shit
				//print("setHSL | child: " + i + " | h: " + nhue + " | s: " + nsat + " | l: " + nlight);
				child.myMaterial.color.setHSL(nhue, nsat, nlight);
			}
		}
		else {
			// get targeted saturation & brightness
			var defSat = sett.default_saturation / 100;
			var defBri = sett.default_brightness / 100;
			var sixtyDelta = deltaTime * 300;
			// iterate through all objects
			for (i = 0; i < scenelen; i++) {
				var child = scene.children[i];
				// get current HSL
				var hsl = child.myMaterial.color.getHSL({});
				var cHue = hsl.h, cSat = hsl.s, cLight = hsl.l;
				// targeted HUE
				var hue = Math.abs(hueValues[child.mySubset]);
				if (Math.abs(hue - cHue) > 0.01)
					cHue += (hue - cHue) / sixtyDelta;
				// targeted saturation
				if (Math.abs(defSat - cSat) > 0.01)
					cSat += (defSat - cSat) / sixtyDelta;
				// targeted brightness
				if (Math.abs(defBri - cLight) > 0.01)
					cLight += (defBri - cLight) / sixtyDelta;
				// update dat shit
				child.myMaterial.color.setHSL(cHue, cSat, cLight);
			}
		}

		// effect render
		self.composer.render(ellapsed);
	},

	///////////////////////////////////////////////
	// FRACTAL GENERATOR
	///////////////////////////////////////////////

	// web worker has finished generating the level
	levelGenerated: function (e) {
		let ldata = e.data;
		print("generated level: " + ldata.id);

		let self = audiOrbits;
		let sett = self.settings;
		self.levelWorkersRunning--;
		// update calculated objects
		let llevel = self.levels[ldata.id];
		let lxBuf = new Float64Array(ldata.xBuff);
		let lyBuf = new Float64Array(ldata.yBuff);

		// spread over time for less thread blocking
		for (let s = 0; s < sett.num_subsets_per_level; s++) {
			self.afterRenderQueue.push(() => {
				for (let i = 0; i < sett.num_points_per_subset; i++) {
					let idx = s * sett.num_points_per_subset + i;
					llevel.subsets[s][i].x = lxBuf[idx];
					llevel.subsets[s][i].y = lyBuf[idx];
				}
			});
		}

		if (self.scene && self.scene.children) {
			var children = self.scene.children;
			var scenelen = children.length;
			// ensure this happens affter all subsets are updated
			self.afterRenderQueue.push(() => {
				// loop all scene children and set flag that new vertex data is available
				// means the shape will update once the subset gets moved back to the end.
				for (var i = 0; i < scenelen; i++) {
					var child = children[i];
					if (child.myLevel == ldata.id) {
						child.needsUpdate = true;
					}
				}
			});
		}

		// if all workers finished and we have a queued event, trigger it
		// this is used as "finished"-trigger for initial level generation...
		if (self.levelWorkersRunning == 0 && self.levelWorkerCall) {
			self.levelWorkerCall();
			self.levelWorkerCall = null;
		}
	},
	// uh oh
	levelError: function (e) {
		print("level error: [" + e.filename + ", Line: " + e.lineno + "] " + e.message, true);
	},
	// queue worker event
	generateLevel: function (level) {
		print("generating level: " + level);
		audiOrbits.levelWorkersRunning++;
		audiOrbits.levelWorker.postMessage({
			id: level,
			settings: audiOrbits.settings
		});
	},


	///////////////////////////////////////////////
	// EVENT HANDLER & TIMERS
	///////////////////////////////////////////////

	// Auto Parallax handler
	swirlHandler: function () {
		var self = audiOrbits;
		var sett = self.settings;
		if (sett.parallax_option != 2) return;
		self.swirlStep += sett.auto_parallax_speed / 8;
		if (self.swirlStep > 360) self.swirlStep -= 360;
		else if (self.swirlStep < 0) self.swirlStep += 360;
		self.positionMouseAngle(self.swirlStep);
	},
	// position Mouse with angle
	positionMouseAngle: function (degrees) {
		var self = audiOrbits;
		var ang = degrees * Math.PI / 180;
		var w = window.innerHeight;
		if (window.innerWidth < w) w = window.innerWidth;
		w /= 2;
		self.mouseX = w * Math.sin(ang);
		self.mouseY = w * Math.cos(ang);
	},
	// popup message handler
	popupMessage: function (msg, hideAfter) {
		$("#txtholder").html(msg);
		$("#txtholder").fadeIn({ queue: false, duration: "slow" });
		$("#txtholder").animate({ bottom: "40px" }, "slow");
		if (hideAfter) setTimeout(() => {
			$("#txtholder").fadeOut({ queue: false, duration: "slow" });
			$("#txtholder").animate({ bottom: "-40px" }, "slow");
		}, 15000);
	},


	///////////////////////////////////////////////
	// WEB-VR INTEGRATION
	///////////////////////////////////////////////

	// will initialize webvr components and rendering
	initWebVR: function () {
		var self = audiOrbits;
		var scene = self.scene;
		var renderer = self.renderer;
		var userData = self.userData;

		self.renderer.vr.enabled = true;
		document.body.appendChild(VRButton.createButton(self.renderer));

		userData.controller1 = renderer.vr.getController(0);
		userData.controller1.addEventListener("selectstart", self.onVRSelectStart);
		userData.controller1.addEventListener("selectend", self.onVRSelectEnd);
		scene.add(userData.controller1);
		userData.controller2 = renderer.vr.getController(1);
		userData.controller2.addEventListener("selectstart", self.onVRSelectStart);
		userData.controller2.addEventListener("selectend", self.onVRSelectEnd);
		scene.add(userData.controller2);
	},
	// controller starts selecting
	onVRSelectStart: function () {
		this.userData.isSelecting = true;
	},
	// controller stops selecting
	onVRSelectEnd: function () {
		this.userData.isSelecting = false;
	},
	// use VR controller like mouse & parallax
	handleVRController: function (controller) {
		/** @TODO
		controller.userData.isSelecting
		controller.position
		controller.quaternion
		*/
	}
};


///////////////////////////////////////////////
// Actual Initialisation
///////////////////////////////////////////////

print("Begin init...");

// will apply settings edited in Wallpaper Engine
// this will also cause initialization for the first time
window.wallpaperPropertyListener = {
	applyGeneralProperties: (props) => { },
	applyUserProperties: (props) => {
		var initFlag = audiOrbits.applyCustomProps(props);
		// very first initialization
		if (!audiOrbits.initialized) {
			audiOrbits.initialized = true;
			$(() => audiOrbits.initOnce());
		}
		else if (initFlag) {
			print("got reInit-flag from applying settings!");
			if (audiOrbits.resetTimeout) clearTimeout(audiOrbits.resetTimeout);
			audiOrbits.resetTimeout = setTimeout(audiOrbits.reInitSystem, audiOrbits.resetTimespan * 1000);
			$("#reload-bar, #reload-text").removeClass("done").addClass("show");
		}
	},
	setPaused: (isPaused) => {
		if (audiOrbits.PAUSED == isPaused) return;
		console.log("Set pause: " + isPaused);
		audiOrbits.PAUSED = isPaused;
		audiOrbits.lastFrame = performance.now();
		audiOrbits.setRenderer(isPaused ? null : audiOrbits.renderLoop);
	}
};

// will be called first when wallpaper is run from web(with wewwa)
window.wewwaListener = {
	initWebContext: function () {
		audiOrbits.isWebContext = true;
	}
};

// after the page finished loading: if the wallpaper context is not given
// AND wewwa fails for some reason => start wallpaper manually
$(() => {
	if (!window.wallpaperRegisterAudioListener) {
		print("wallpaperRegisterAudioListener not defined. We are probably outside of wallpaper engine. Manual init..");
		audiOrbits.applyCustomProps({});
		audiOrbits.initialized = true;
		audiOrbits.initOnce();
	}
});
