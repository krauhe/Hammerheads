/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian R. Harreby. See LICENSE for terms.
 *
 * The Blue Deep: a standalone, continuous WebGL scene with modelled hammerheads.
 * Three.js is local. No images, network requests, server or installation are needed.
 * Shark geometry is reused. Water and swimming are calculated on the GPU,
 * keeping memory use stable even when the page stays open for hours.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const errorBox = document.getElementById('error');
  const loading = document.getElementById('loading');
  function showError(message) {
    loading.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
    document.body.classList.remove('immersed');
  }
  if (!window.THREE) {
    showError('The 3D library is missing. Keep three.min.js in the same folder as index.html.');
    return;
  }
  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (error) {
    showError('The browser could not start 3D. Open index.html in Chrome or Edge with graphics acceleration enabled.');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.autoClear = false;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x073653, 0.021);
  const camera = new T.PerspectiveCamera(49, 1, 0.1, 190);
  camera.position.set(0, 3.5, 27);
  const lookAt = new T.Vector3(0, 0.4, -9);
  const ambient = new T.HemisphereLight(0xa1d2e1, 0x102b42, 1.75);
  scene.add(ambient);
  const sun = new T.DirectionalLight(0xffe6b2, 3.5);
  sun.position.set(4, 82, -57);
  scene.add(sun);
  const rim = new T.DirectionalLight(0x62b5dc, 1.65);
  rim.position.set(-7, 16, -30);
  scene.add(rim);
  // A broad overhead fill represents combined starlight. Its brightness is
  // intentionally boosted for visibility rather than astronomical accuracy.
  const starlight=new T.DirectionalLight(0x9bbcff,0);
  starlight.position.set(-12,60,-20);
  scene.add(starlight);
  const timeMode=document.getElementById('time-mode');
  const lightTime=document.getElementById('light-time');
  let customHour=12;

  // The surface is a wavy 3D mesh at Y = 15. The depth buffer selects
  // the wave closest to the camera, avoiding jumps between multiple
  // possible intersections when viewing almost horizontally along the surface.
  const waterUniforms = {
    time: { value: 0 }, aspect: { value: 1 },
    resolution: { value: new T.Vector2(1,1) }, surfacePass: { value: 0 },
    inverseProjection: { value: camera.projectionMatrixInverse },
    cameraWorld: { value: camera.matrixWorld },
    eyePosition: { value: camera.position },
    solarDirection: { value: new T.Vector3() },
    lightDirection: { value: new T.Vector3() },
    solarProjection: { value: new T.Vector3() },
    sunColor: { value: new T.Color() },
    sunPower: { value: 1 }, daylight: { value: 1 }, twilight: { value: 0 }
  };

  // A gentle visual day cycle follows the computer's local clock. Sunrise
  // is at 06:00 and sunset at 18:00, with a peak elevation of 65 degrees at noon.
  // This is a fixed artistic cycle, not a location- or season-based calculation.
  // The clock is independent of the swimming speed slider.
  const sunriseColor = new T.Color(0xff633b);
  const middayColor = new T.Color(0xfff1d8);
  const dayFogColor = new T.Color(0x073653);
  const nightFogColor = new T.Color(0x082340);
  const projectedSun = new T.Vector4();
  function updateDaylight(date) {
    const customTime=timeMode.value==='custom';
    const parts=lightTime.value.split(':').map(Number);
    // Keep the last valid setting while a time field is temporarily empty.
    if(customTime && /^\d{2}:\d{2}$/.test(lightTime.value))customHour=parts[0]+parts[1]/60;
    const hour = customTime ? customHour : date.getHours() + date.getMinutes()/60
      + date.getSeconds()/3600 + date.getMilliseconds()/3600000;
    if(!customTime)lightTime.value=String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
    const phase = (hour-6)*Math.PI/12;
    const elevation = T.MathUtils.degToRad(65)*Math.sin(phase);
    const azimuth = T.MathUtils.degToRad(-75)*Math.cos(phase);
    const daylight = T.MathUtils.smoothstep(elevation, -.14, .25);
    const sunPower = T.MathUtils.smoothstep(elevation, -.025, .09)
      * (.42 + .58*T.MathUtils.smoothstep(elevation, 0, .95));
    const warmth = 1-T.MathUtils.smoothstep(elevation, .03, .65);
    waterUniforms.daylight.value = daylight;
    waterUniforms.sunPower.value = sunPower;
    waterUniforms.twilight.value = warmth*daylight;
    waterUniforms.sunColor.value.copy(middayColor).lerp(sunriseColor, warmth);
    waterUniforms.solarDirection.value.set(Math.cos(elevation)*Math.sin(azimuth),
      Math.sin(elevation), -Math.cos(elevation)*Math.cos(azimuth));

    // Snell's law bends rays from the air towards the normal as they enter
    // the water. Shark illumination and the beam vanishing point share a direction.
    const air = waterUniforms.solarDirection.value;
    const eta = 1.00029/1.333;
    waterUniforms.lightDirection.value.set(air.x*eta,
      Math.sqrt(1-eta*eta*(air.x*air.x+air.z*air.z)), air.z*eta);
    sun.position.copy(waterUniforms.lightDirection.value).multiplyScalar(100);
    sun.color.copy(waterUniforms.sunColor.value);
    sun.intensity = 3.5*sunPower;
    ambient.intensity = 1.35+.40*daylight;
    rim.intensity = .95+.70*daylight;
    starlight.intensity = 1.65*(1-daylight);
    scene.fog.color.copy(nightFogColor).lerp(dayFogColor, daylight);
  }
  const waterMaterial = new T.ShaderMaterial({
    uniforms: waterUniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec3 surfaceWorldPosition;
      void main(){surfaceWorldPosition=vec3(0.);gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      precision highp float;
      varying vec3 surfaceWorldPosition;
      uniform float time;
      uniform float aspect;
      uniform vec2 resolution;
      uniform float surfacePass;
      uniform mat4 inverseProjection;
      uniform mat4 cameraWorld;
      uniform vec3 eyePosition;
      uniform vec3 solarDirection;
      uniform vec3 solarProjection;
      uniform vec3 sunColor;
      uniform float sunPower;
      uniform float daylight;
      uniform float twilight;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      // Quintic interpolated noise with analytical derivatives. Both the value
      // and slope remain continuous when a wave crosses a noise cell.
      vec3 noiseGradient(vec2 p){
        vec2 cell=floor(p),f=fract(p);
        vec2 u=f*f*f*(f*(f*6.-15.)+10.);
        vec2 du=30.*f*f*(f*(f-2.)+1.);
        float a=hash(cell),b=hash(cell+vec2(1,0));
        float c=hash(cell+vec2(0,1)),d=hash(cell+vec2(1,1));
        float crossTerm=a-b-c+d;
        return vec3(a+(b-a)*u.x+(c-a)*u.y+crossTerm*u.x*u.y,
          du.x*((b-a)+crossTerm*u.y),du.y*((c-a)+crossTerm*u.x));
      }
      float noise(vec2 p){return noiseGradient(p).x;}

      // Ten wave trains with different directions, wavelengths and phases have
      // no shared short repetition period. A slowly varying amplitude also
      // makes wave groups uneven. Dispersion follows omega = sqrt(g*k).
      // Gradients come from exactly the same height field as the geometry.
      vec3 waveField(vec2 p,float footprint){
        vec3 weather=noiseGradient(p*.037+vec2(time*.005,-time*.003));
        float envelope=.68+weather.x*.32;
        vec2 envelopeGradient=weather.yz*.037*.32;
        vec3 field=vec3(0.);
        for(int i=0;i<10;i++){
          float seed=float(i);
          float angle=hash(vec2(seed,12.71))*6.283185;
          vec2 heading=vec2(cos(angle),sin(angle));
          float frequency=.38*pow(1.53,seed)*(1.+hash(vec2(seed,3.83))*.18);
          float amplitude=.76*pow(.54,seed);
          float phase=dot(p,heading)*frequency-sqrt(9.81*frequency)*time*.18
            +hash(vec2(seed,5.19))*6.283185;
          float filtered=1.-smoothstep(.65,2.0,footprint*frequency);
          field.x+=amplitude*filtered*sin(phase);
          field.yz+=amplitude*filtered*cos(phase)*heading*frequency;
        }
        return vec3(field.x*envelope,field.yz*envelope+field.x*envelopeGradient);
      }

      // Exact unpolarised Fresnel for light viewed FROM water TOWARDS air.
      // Snell's law determines total internal reflection. Normal incidence gives R around 2%;
      // above the critical angle of about 48.6 degrees, all light is reflected.
      // The reference and limitations of the environment model are in GUIDE.md.
      float fresnelWaterToAir(float cosineIncident){
        const float waterIOR=1.333;
        const float airIOR=1.00029;
        const float eta=waterIOR/airIOR;
        float cosine=clamp(cosineIncident,0.,1.);
        float sineSquaredTransmitted=eta*eta*max(0.,1.-cosine*cosine);
        if(sineSquaredTransmitted>=1.)return 1.;
        float cosineTransmitted=sqrt(1.-sineSquaredTransmitted);
        float s=(waterIOR*cosine-airIOR*cosineTransmitted)/(waterIOR*cosine+airIOR*cosineTransmitted);
        float p=(airIOR*cosine-waterIOR*cosineTransmitted)/(airIOR*cosine+waterIOR*cosineTransmitted);
        return .5*(s*s+p*p);
      }

      vec3 oceanRadiance(vec3 direction){
        float elevation=pow(clamp(direction.y*.85+.54,0.,1.),2.);
        return mix(vec3(.0004,.003,.013),vec3(.010,.078,.17),elevation)*(.50+.50*daylight);
      }
      vec3 skyRadiance(vec3 direction){
        float elevation=clamp(direction.y,0.,1.);
        vec3 horizon=mix(vec3(.23,.32,.38),vec3(.58,.16,.065),twilight);
        vec3 zenith=mix(vec3(.10,.25,.43),vec3(.10,.10,.22),twilight*.65);
        vec3 sky=mix(horizon,zenith,sqrt(elevation))*daylight;
        sky+=vec3(.013,.026,.061)*(1.-daylight);
        vec2 cloudPosition=direction.xz/max(.20,direction.y)*1.35;
        float clouds=noise(cloudPosition+vec2(time*.002,0.))*.65
          +noise(cloudPosition*2.23+vec2(7.3,time*.003))*.35;
        vec3 cloudLight=mix(vec3(.54,.59,.61),sunColor*.48,twilight)*daylight;
        float cloudCover=smoothstep(.49,.77,clouds);
        sky=mix(sky,cloudLight+vec3(.010,.021,.045)*(1.-daylight),cloudCover*.55);
        // Fixed stars live in sky directions, so wave refraction makes their
        // highlights shimmer naturally. Pixel derivatives soften tiny stars.
        vec2 starCoordinates=vec2(atan(direction.z,direction.x),asin(clamp(direction.y,-1.,1.)))*40.;
        vec2 starCell=floor(starCoordinates);
        vec2 starCentre=vec2(hash(starCell+13.7),hash(starCell+81.2))*.6+.2;
        float starDistance=length(fract(starCoordinates)-starCentre);
        float starPixel=clamp(length(fwidth(starCoordinates)),.025,.3);
        float star=1.-smoothstep(.07,.14+starPixel,starDistance);
        star*=step(.97,hash(starCell))*smoothstep(0.,.15,direction.y);
        sky+=vec3(.72,.83,1.)*star*2.5*(1.-daylight)*(1.-cloudCover*.8);
        float alignment=max(dot(direction,solarDirection),0.);
        sky+=sunColor*sunPower*(pow(alignment,28.)*.40+pow(alignment,1300.)*4.);
        return sky;
      }

      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;
        vec4 view=inverseProjection*vec4(uv*2.-1.,1.,1.);
        vec3 direction=normalize((cameraWorld*vec4(view.xyz/view.w,0.)).xyz);
        vec3 color=oceanRadiance(direction);

        // Homogeneous coordinates preserve the shared vanishing point, even
        // when the sun is so high that the point passes through infinity.
        // Beams follow the refracted solar direction from morning to evening.
        vec2 centered=(uv-.5)*vec2(aspect,1.);
        vec2 source=(solarProjection.xy-.5*solarProjection.z)*vec2(aspect,1.);
        float sourceDistance=max(length(source),.0001);
        vec2 axis=source/sourceDistance;
        vec2 perpendicular=vec2(-axis.y,axis.x);
        float perspectiveScale=(sourceDistance-solarProjection.z*dot(centered,axis))/sourceDistance;
        float shaftCoordinate=dot(centered,perpendicular)/max(.08,perspectiveScale);
        float rayStrength=0.;
        for(int i=0;i<12;i++){
          float seed=float(i);
          float beamCenter=-1.3+(seed+hash(vec2(seed,3.71))*.65)*.23;
          beamCenter+=noise(vec2(seed*6.3,time*.065))*.028;
          float width=.012+hash(vec2(seed,7.13))*.020;
          float offset=(shaftCoordinate-beamCenter)/width;
          float beam=exp(-offset*offset*.5)+exp(-offset*offset*.085)*.045;
          float modulation=.20+.80*noise(vec2(seed*4.71,time*.105));
          rayStrength+=beam*modulation;
        }
        float depthFade=pow(clamp(uv.y+.04,0.,1.),1.35);
        color+=sunColor*rayStrength*depthFade*sunPower*.052;
        color+=vec3(.003,.012,.024)*depthFade*daylight;

        // The same shader renders the background and the actual water surface.
        // The height field moves mesh vertices; the analytical normal retains
        // fine detail. The pixel footprint attenuates waves smaller than one pixel.
        float footprint=max(length(dFdx(surfaceWorldPosition.xz)),length(dFdy(surfaceWorldPosition.xz)));
        if(surfacePass>.5){
          float distanceToSurface=length(surfaceWorldPosition-eyePosition);
          vec3 wave=waveField(surfaceWorldPosition.xz,footprint);
          vec3 surfaceNormal=normalize(vec3(-wave.y,1.,-wave.z));
          float cosineIncident=max(dot(direction,surfaceNormal),0.);
          float reflectance=fresnelWaterToAir(cosineIncident);
          vec3 reflectedDirection=reflect(direction,surfaceNormal);
          // Total internal reflection shows the water environment, not an arbitrary silver colour.
          vec3 reflectedLight=oceanRadiance(reflectedDirection)*1.25;
          vec3 transmittedLight=vec3(0.);
          if(reflectance<1.){
            vec3 transmittedDirection=refract(direction,-surfaceNormal,1.333/1.00029);
            transmittedLight=skyRadiance(transmittedDirection);
          }
          vec3 surfaceLight=reflectance*reflectedLight+(1.-reflectance)*transmittedLight;
          vec3 transmission=exp(-vec3(.027,.014,.009)*distanceToSurface);
          vec3 waterPath=oceanRadiance(direction);
          vec3 ceiling=surfaceLight*transmission+waterPath*(1.-transmission);
          float visibility=1.-smoothstep(105.,165.,distanceToSurface);
          color=mix(color,ceiling,visibility);
        }
        // Colours are mixed as light above and converted to display colours only here.
        color=pow(max(vec3(0.),1.-exp(-color*1.3)),vec3(1./2.2));
        float grain=(hash(gl_FragCoord.xy)-.5)/255.;
        gl_FragColor=vec4(color+grain,1.);
      }`
  });
  const background = new T.Scene();
  background.add(new T.Mesh(new T.PlaneGeometry(2, 2), waterMaterial));
  const backgroundCamera = new T.Camera();

  // Wave mathematics is reused verbatim in the vertex shader so heights and
  // the normal used for lighting cannot drift out of sync.
  const waveFunctions=waterMaterial.fragmentShader.slice(
    waterMaterial.fragmentShader.indexOf('float hash('),
    waterMaterial.fragmentShader.indexOf('float fresnelWaterToAir(')
  );
  const surfaceMaterial=new T.ShaderMaterial({
    uniforms:{...waterUniforms,surfacePass:{value:1}},
    side:T.DoubleSide,depthWrite:true,depthTest:true,toneMapped:false,
    vertexShader:`uniform float time;varying vec3 surfaceWorldPosition;
      ${waveFunctions}
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        world.y+=waveField(world.xz,0.).x;
        surfaceWorldPosition=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:waterMaterial.fragmentShader
  });
  const surfaceGeometry=new T.PlaneGeometry(300,260,220,190);
  surfaceGeometry.rotateX(-Math.PI/2);
  const waterSurface=new T.Mesh(surfaceGeometry,surfaceMaterial);
  waterSurface.position.set(0,15,-65);
  waterSurface.frustumCulled=false;
  scene.add(waterSurface);

  // The model points along +X. Cross-sections form a smooth body with a narrow tail base.
  // Belly and back colours make the three-dimensional shape readable in blue light.
  const parts = [];
  let bodyProfile;
  const backColor = new T.Color(0x5c6a70);
  const bellyColor = new T.Color(0xe0ddd0);
  function addPart(geometry, solidColor) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = flat.getAttribute('position');
    const normals = flat.getAttribute('normal');
    const colors = new Float32Array(positions.count * 3);
    const color = new T.Color();
    for (let i = 0; i < positions.count; i++) {
      if (solidColor !== undefined) color.setHex(solidColor);
      else {
        // An uneven but continuous boundary between the grey back and ivory belly.
        const edge = Math.sin(positions.getX(i)*11+positions.getZ(i)*8)*.047
          +Math.sin(positions.getX(i)*24-positions.getZ(i)*13)*.022;
        const underside = T.MathUtils.smoothstep(-normals.getY(i)+edge, .14, .36)
          *(1-T.MathUtils.smoothstep(positions.getY(i),.06,.30));
        color.copy(backColor).lerp(bellyColor, underside);
        const variation = .97 + .025 * Math.sin(positions.getX(i) * 8 + positions.getZ(i) * 11);
        color.multiplyScalar(variation);
      }
      colors.set([color.r, color.g, color.b], i * 3);
    }
    flat.setAttribute('color', new T.BufferAttribute(colors, 3));
    // Eyes, mouth and gills have smooth surfaces; only skin receives microtexture.
    flat.setAttribute('skinDetail', new T.BufferAttribute(new Float32Array(positions.count).fill(solidColor === undefined ? 1 : 0), 1));
    parts.push(flat);
    if (flat !== geometry) geometry.dispose();
  }
  function bodyGeometry() {
    // X position, half-width and half-height. A fuller forebody and narrow tail base.
    const sections = [
      [-3.52,.035,.06],[-3.18,.09,.13],[-2.8,.15,.22],
      [-2.3,.235,.30],[-1.7,.36,.41],[-.85,.51,.55],
      [-.05,.59,.60],[.65,.575,.555],[1.20,.46,.40],
      [1.7,.35,.28],[2.10,.30,.21],[2.29,.16,.11]
    ];
    const curve = new T.CatmullRomCurve3(sections.map(s => new T.Vector3(s[0],s[1],s[2])));
    bodyProfile=curve;
    const vertices = [], indices = [];
    const rings = 112, sides = 48;
    for (let i = 0; i <= rings; i++) {
      const cross = curve.getPoint(i / rings);
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        vertices.push(cross.x, Math.cos(angle)*cross.z, Math.sin(angle)*cross.y);
      }
    }
    for (let i=0;i<rings;i++) for(let j=0;j<sides;j++) {
      const a=i*(sides+1)+j,b=a+sides+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  addPart(bodyGeometry());

  // Find a point on the same cross-section as the body mesh. Small details
  // sit precisely on the skin, so the gills neither float nor disappear.
  function bodySurface(x,angle,side,offset=.006){
    let low=0,high=1;
    for(let i=0;i<16;i++){
      const middle=(low+high)/2;
      if(bodyProfile.getPoint(middle).x<x)low=middle;else high=middle;
    }
    const section=bodyProfile.getPoint((low+high)/2);
    return new T.Vector3(x,(section.z+offset)*Math.cos(angle),side*(section.y+offset)*Math.sin(angle));
  }

  // The hammer is a rounded wing across the body, with eyes at the tips.
  // Its curved leading edge and thin tips create the characteristic head silhouette.
  function hammerGeometry() {
    const vertices=[],indices=[],rings=96,sides=40;
    for(let i=0;i<=rings;i++) {
      const z=(i/rings*2-1)*1.78;
      const lateral=Math.abs(z)/1.78;
      const cap=Math.sqrt(Math.max(.003,1-Math.pow(lateral,24)));
      // A shallow central notch and two smaller side notches form an
      // organic leading edge. The trailing edge meets the broad neck without a tubular snout.
      const front=2.55-.075*Math.exp(-z*z/.035)
        -.065*Math.exp(-Math.pow(Math.abs(z)-.93,2)/.022)-.18*Math.pow(lateral,4);
      const rear=1.95-.36*Math.exp(-lateral*4)+.045*lateral;
      const centerX=(front+rear)/2;
      const radiusX=(front-rear)/2*cap;
      const radiusY=(.11+.115*Math.exp(-lateral*3.8))*cap;
      for(let j=0;j<=sides;j++) {
        const angle=j/sides*Math.PI*2;
        vertices.push(centerX+Math.cos(angle)*radiusX,Math.sin(angle)*radiusY-.005,z);
      }
    }
    for(let i=0;i<rings;i++) for(let j=0;j<sides;j++) {
      const a=i*(sides+1)+j,b=a+sides+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
  addPart(hammerGeometry());

  // Fins use smooth, wing-like cross-sections instead of flat triangles.
  // Each cross-section defines span, leading edge and trailing edge. A thin elliptical
  // profile gives a rounded front, pointed tip and curved surface.
  function sweptFin(sections, horizontal=false, side=1, thickness=.09) {
    const curve=new T.CatmullRomCurve3(sections.map(s=>new T.Vector3(...s)));
    const vertices=[],indices=[],centers=[];
    const rings=38,sides=20;
    for(let i=0;i<=rings;i++) {
      const section=curve.getPoint(i/rings);
      const span=section.x,mid=(section.y+section.z)*.5;
      const halfChord=Math.max(.003,(section.y-section.z)*.5);
      const droop=horizontal?-.17-.15*Math.pow(Math.abs(span),1.25):0;
      centers.push(horizontal?new T.Vector3(mid,droop,span*side):new T.Vector3(mid,span,0));
      for(let j=0;j<=sides;j++) {
        const angle=j/sides*Math.PI*2;
        const x=mid+Math.cos(angle)*halfChord;
        const cross=Math.sin(angle)*halfChord*thickness;
        if(horizontal)vertices.push(x,droop+cross,span*side);
        else vertices.push(x,span,cross);
      }
    }
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
      const a=i*(sides+1)+j,b=a+sides+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    // The same function creates left/right and upper/lower fins.
    // Check the direction against the cross-section centre so the skin always faces outwards.
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    let outward=0;
    for(let i=1;i<rings;i++){
      const index=i*(sides+1)+5,c=centers[i];
      outward+=(p.getX(index)-c.x)*n.getX(index)+(p.getY(index)-c.y)*n.getY(index)+(p.getZ(index)-c.z)*n.getZ(index);
    }
    if(outward<0){
      for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      geometry.setIndex(indices);geometry.computeVertexNormals();
    }
    addPart(geometry);
  }
  sweptFin([[.46,.45,-1.22],[.80,.21,-.71],[1.22,-.04,-.55],[1.75,-.27,-.48],[2.15,-.42,-.435]],false,1,.20);
  for(const side of [-1,1]){
    sweptFin([[.36,.90,-.52],[.72,.60,-.70],[1.20,.05,-.95],[1.75,-.64,-1.20],[2.18,-1.27,-1.28]],true,side,.15);
    sweptFin([[.23,-1.64,-2.34],[.51,-1.86,-2.38],[.79,-2.31,-2.40],[.85,-2.42,-2.425]],true,side,.15);
  }
  sweptFin([[.22,-2.17,-2.80],[.45,-2.33,-2.64],[.66,-2.49,-2.50]],false,1,.15);
  sweptFin([[-.15,-2.53,-3.0],[-.38,-2.73,-2.96],[-.54,-2.96,-2.97]],false,1,.15);
  // Two separate, continuous tail lobes preserve the deep fork in the tail.
  sweptFin([[.00,-3.30,-4.08],[.40,-3.53,-4.11],[.88,-3.83,-4.31],[1.36,-4.15,-4.48],[1.95,-4.68,-4.69]],false,1,.15);
  sweptFin([[.02,-3.31,-4.08],[-.36,-3.57,-4.12],[-.70,-3.90,-4.30],[-1.10,-4.35,-4.36]],false,1,.15);

  for(const side of [-1,1]) {
    const socket=new T.SphereGeometry(.139,24,16);
    socket.scale(1.2,.75,.8);socket.translate(2.21,.035,side*1.72);addPart(socket);
    const eye=new T.SphereGeometry(.089,24,16);
    eye.scale(1,.88,.7); eye.translate(2.23,.041,side*1.81);
    addPart(eye,0x09141a);
    const iris=new T.TorusGeometry(.079,.009,8,24);
    iris.translate(2.23,.041,side*1.85);addPart(iris,0x667b79);
    const glint=new T.SphereGeometry(.018,10,8);
    glint.translate(2.255,.074,side*1.865); addPart(glint,0xd6e5df);
    const nostril=new T.SphereGeometry(1,16,10);
    nostril.scale(.065,.012,.027);nostril.translate(2.37,-.102,side*1.37);addPart(nostril,0x38474a);
    // Five gill slits on each side of the body.
    for(let g=0;g<5;g++) {
      const x=1.35-g*.119;
      const gillPoints=Array.from({length:13},(_,i)=>{
        const fraction=i/12;
        return bodySurface(x-.052*Math.sin(fraction*Math.PI),.83+fraction*1.42,side,.008);
      });
      const curve=new T.CatmullRomCurve3(gillPoints);
      addPart(new T.TubeGeometry(curve,22,.011,6,false),0x354a53);
      const lip=new T.CatmullRomCurve3(gillPoints.map((p,i)=>bodySurface(p.x-.022,.83+i/12*1.42,side,.009)));
      addPart(new T.TubeGeometry(lip,18,.007,5,false),0x8d9a9b);
    }
    for(let i=0;i<19;i++){
      const z=side*(.36+i*.069);
      const pore=new T.SphereGeometry(.008,6,4);
      pore.translate(2.35+.017*Math.sin(i*2.3),-.085-Math.exp(-Math.abs(z)*3)*.055,z);
      addPart(pore,0x718080);
    }
  }
  const mouth=new T.CatmullRomCurve3([
    new T.Vector3(2.09,-.174,-.48),new T.Vector3(1.93,-.227,-.27),
    new T.Vector3(1.85,-.251,0),new T.Vector3(1.93,-.227,.27),new T.Vector3(2.09,-.174,.48)
  ]);
  addPart(new T.TubeGeometry(mouth,36,.026,8,false),0x27363c);
  const lowerLip=mouth.clone();lowerLip.points.forEach(p=>{p.x-=.025;p.y-=.006;});
  addPart(new T.TubeGeometry(lowerLip,36,.009,6,false),0xb6c0b8);

  // Merge all parts into one geometry so each shark needs only one draw call.
  function mergeParts(geometries) {
    const merged=new T.BufferGeometry();
    for(const attribute of ['position','normal','color','skinDetail']) {
      const length=geometries.reduce((sum,g)=>sum+g.getAttribute(attribute).array.length,0);
      const values=new Float32Array(length); let offset=0;
      for(const geometry of geometries) {
        const array=geometry.getAttribute(attribute).array;
        values.set(array,offset); offset+=array.length;
      }
      merged.setAttribute(attribute,new T.BufferAttribute(values,attribute==='skinDetail'?1:3));
    }
    merged.computeBoundingSphere();
    // Swimming bends the tail beyond the original bounding volume.
    merged.boundingSphere.radius+=1.4;
    geometries.forEach(g=>g.dispose());
    return merged;
  }
  const sharkGeometry=mergeParts(parts);
  const sharks=[];
  function createShark(config) {
    const uniforms={ swimTime:{value:0}, swimPhase:{value:config.phase}, swimPower:{value:config.power||1},
      dragBend:{value:new T.Vector2()}, waterTime:waterUniforms.time, sunColor:waterUniforms.sunColor,
      sunPower:waterUniforms.sunPower, lightDirection:waterUniforms.lightDirection };
    const material=new T.MeshStandardMaterial({
      vertexColors:true,roughness:.48,metalness:.035,side:T.DoubleSide
    });
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=`uniform float swimTime; uniform float swimPhase; uniform float swimPower;
        uniform vec2 dragBend;
        attribute float skinDetail;
        varying float sharkDetail;
        varying vec3 sharkPosition;
        varying vec3 sharkWorldPosition;
        varying vec3 sharkWorldNormal;
        float bend(float x){
          float tail=clamp((1.8-x)/6.2,0.,1.2);
          return sin(swimTime*1.9+x*.91+swimPhase)*tail*tail*.57*swimPower;
        }
        float bendSlope(float x){return (bend(x+.01)-bend(x-.01))/.02;}
        float elasticWeight(float x){float tail=clamp((1.8-x)/6.2,0.,1.2);return tail*tail;}
        float elasticSlope(float x){return (elasticWeight(x+.01)-elasticWeight(x-.01))/.02;}
        ${shader.vertexShader}`;
      // Normals turn with the surface so lighting follows the moving tail.
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal.x-=bendSlope(position.x)*objectNormal.z+elasticSlope(position.x)*dot(dragBend,objectNormal.yz);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.z+=bend(position.x);
        transformed.yz+=dragBend*elasticWeight(position.x);
        sharkPosition=position;
        sharkDetail=skinDetail;
        sharkWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;
        sharkWorldNormal=normalize(mat3(modelMatrix)*objectNormal);`);
      // Procedural skin follows the model, not the screen. Colour variation, fine
      // denticles and uneven gloss preserve detail without external image files.
      shader.fragmentShader=`
        uniform float waterTime;
        uniform vec3 sunColor;
        uniform vec3 lightDirection;
        uniform float sunPower;
        varying float sharkDetail;
        varying vec3 sharkPosition;
        varying vec3 sharkWorldPosition;
        varying vec3 sharkWorldNormal;
        float skinHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float skinNoise(vec3 p){
          vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(skinHash(i),skinHash(i+vec3(1,0,0)),f.x),
                         mix(skinHash(i+vec3(0,1,0)),skinHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(skinHash(i+vec3(0,0,1)),skinHash(i+vec3(1,0,1)),f.x),
                         mix(skinHash(i+vec3(0,1,1)),skinHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        ${shader.fragmentShader}`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        float skinFine=skinNoise(sharkPosition*87.);
        float skinMottle=skinNoise(sharkPosition*vec3(6.,11.,11.));
        float detailVisibility=1.-smoothstep(.025,.09,max(length(dFdx(sharkPosition)),length(dFdy(sharkPosition))));
        diffuseColor.rgb*=1.+sharkDetail*((skinMottle-.5)*.14+(skinFine-.5)*.12*detailVisibility);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor=mix(.18,.43+skinFine*.17,sharkDetail);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        float skinHeight=skinFine*.013*sharkDetail*detailVisibility;
        vec3 sigmaX=normalize(dFdx(-vViewPosition));
        vec3 sigmaY=normalize(dFdy(-vViewPosition));
        vec3 gradientX=cross(sigmaY,normal);
        vec3 gradientY=cross(normal,sigmaX);
        float determinant=dot(sigmaX,gradientX)*faceDirection;
        vec3 skinGradient=sign(determinant)*(dFdx(skinHeight)*gradientX+dFdy(skinHeight)*gradientY);
        normal=normalize(abs(determinant)*normal-skinGradient);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        // Wave caustics move across the back and the upper surfaces of the fins.
        vec2 causticPosition=sharkWorldPosition.xz*.61;
        float causticField=skinNoise(vec3(causticPosition+vec2(waterTime*.09,-waterTime*.06),waterTime*.055));
        float causticLine=pow(1.-abs(causticField*2.-1.),16.);
        float illuminatedBack=max(dot(normalize(sharkWorldNormal),lightDirection),0.)*sharkDetail;
        outgoingLight+=diffuseColor.rgb*sunColor*sunPower*causticLine*illuminatedBack*.55;
        #include <opaque_fragment>
      `);
    };
    const mesh=new T.Mesh(sharkGeometry,material);
    mesh.name='hammerhead';
    // Picking uses the same bent surface that is displayed. Three.js
    // calls this method during raycasting, so a moving tail can also be grabbed.
    mesh.getVertexPosition=function(index,target){
      T.Mesh.prototype.getVertexPosition.call(this,index,target);
      const tail=T.MathUtils.clamp((1.8-target.x)/6.2,0,1.2);
      target.y+=uniforms.dragBend.value.x*tail*tail;
      target.z+=(Math.sin(uniforms.swimTime.value*1.9+target.x*.91+uniforms.swimPhase.value)
        *.57*uniforms.swimPower.value+uniforms.dragBend.value.y)*tail*tail;
      return target;
    };
    mesh.scale.setScalar(config.scale);
    scene.add(mesh); sharks.push({mesh,uniforms,...config,
      offset:new T.Vector3(),velocity:new T.Vector3(),
      rotationOffset:new T.Quaternion(),angularVelocity:new T.Vector3()});
  }
  // Asymmetric paths and different orbit periods avoid synchronised movement.
  // There are no visible restarts: sharks follow continuous curves.
  const configurations=[
    {scale:1.22,rx:14,rz:24,z:-10,y:1.6,phase:-.62,rate:.023,direction:1},
    {scale:1.02,rx:23,rz:10,z:-10,y:4.8,phase:1.9,rate:.023,direction:-1},
    {scale:.88,rx:26,rz:10,z:-13,y:-4.2,phase:.48,rate:.026,direction:1},
    {scale:1.08,rx:26,rz:13,z:-19,y:1.7,phase:3.7,rate:.020,direction:-1},
    {scale:.95,rx:27,rz:10,z:-23,y:8,phase:4.4,rate:.022,direction:1},
    {scale:1.02,rx:29,rz:11,z:-27,y:-6,phase:5.5,rate:.018,direction:-1},
    {scale:.85,rx:30,rz:12,z:-32,y:3,phase:2.8,rate:.021,direction:1},
    {scale:.93,rx:27,rz:9,z:-35,y:8,phase:.15,rate:.019,direction:1},
    {scale:.9,rx:33,rz:12,z:-43,y:-1.5,phase:5.9,rate:.019,direction:-1},
    {scale:1,rx:37,rz:10,z:-48,y:7,phase:1.2,rate:.017,direction:1},
    {scale:.92,rx:37,rz:11,z:-50,y:-8,phase:3.2,rate:.016,direction:-1},
    {scale:.95,rx:35,rz:11,z:-56,y:8,phase:4.7,rate:.018,direction:1}
  ];
  configurations.forEach(createShark);
  // A distant, loose group gives the ocean scale without crowding the foreground.
  for(let i=0;i<9;i++) createShark({scale:.57+(i%3)*.1,rx:32,rz:7,z:-62-(i%3)*4,
    y:4+Math.sin(i*2.3)*6,phase:1.8+i*.12,rate:.014,direction:1});

  // Extra sharks are created only when first needed. They share the model
  // and are hidden/reused as the slider moves back and forth.
  // This creates at most 40 sharks, regardless of how long the page runs.
  const sharkCountInput=document.getElementById('shark-count');
  function setSharkCount(value){
    const count=T.MathUtils.clamp(Math.round(Number(value)),0,40);
    while(sharks.length<count){
      const i=sharks.length-21;
      createShark({scale:.66+(i%4)*.10,rx:25+(i%5)*3,rz:9+(i%3)*2,
        z:-16-(i%7)*6,y:-6+(i%6)*2.65,phase:.7+i*2.39996,
        rate:.016+(i%5)*.002,direction:i%2?1:-1});
    }
    sharks.forEach((shark,index)=>{shark.mesh.visible=index<count;});
    sharkCountInput.value=String(count);
    document.getElementById('shark-count-value').value=String(count);
    redrawNeeded=true;
  }

  // Small drifting particles are individual GPU points. Fog attenuates
  // them with distance, and their positions are reused throughout the run.
  const particleCount=950;
  const particlePositions=new Float32Array(particleCount*3);
  const particleSizes=new Float32Array(particleCount);
  let randomSeed=391;
  function random(){randomSeed=(randomSeed*16807)%2147483647;return (randomSeed-1)/2147483646;}
  for(let i=0;i<particleCount;i++) {
    particlePositions.set([(random()-.5)*115,(random()-.5)*68,random()*-105+16],i*3);
    particleSizes[i]=.035+random()*.065;
  }
  const particleGeometry=new T.BufferGeometry();
  particleGeometry.setAttribute('position',new T.BufferAttribute(particlePositions,3));
  particleGeometry.setAttribute('size',new T.BufferAttribute(particleSizes,1));
  const particleUniforms={time:{value:0},pixelRatio:{value:renderer.getPixelRatio()},daylight:waterUniforms.daylight};
  const particleMaterial=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:particleUniforms,
    vertexShader:`uniform float time;uniform float pixelRatio;attribute float size;varying float alpha;
      void main(){vec3 p=position;
        p.x+=sin(time*.045+position.y*.17)*.6;
        p.y=mod(position.y+time*.07+34.,68.)-34.;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(size*240.*pixelRatio/-mv.z,1.,4.5);
        alpha=exp(-length(mv.xyz)*.028)*.31;
      }`,
    fragmentShader:`uniform float daylight;varying float alpha;void main(){
      float radius=length(gl_PointCoord-.5);
      gl_FragColor=vec4(.40,.70,.9,(1.-smoothstep(.08,.5,radius))*alpha*(.15+.85*daylight));
    }`
  });
  const particles=new T.Points(particleGeometry,particleMaterial);
  particles.frustumCulled=false;scene.add(particles);

  // Background fish use instancing: many fish, one draw call.
  const fishGeometry=new T.ConeGeometry(.11,.58,4);
  fishGeometry.rotateZ(-Math.PI/2);
  const fishMaterial=new T.MeshStandardMaterial({color:0x5a899e,roughness:.8});
  const fishCount=90,fish=new T.InstancedMesh(fishGeometry,fishMaterial,fishCount);
  fish.instanceMatrix.setUsage(T.DynamicDrawUsage); fish.frustumCulled=false;
  scene.add(fish);
  const fishTransform=new T.Object3D();
  const fishSeeds=Array.from({length:fishCount},()=>[random(),random(),random()]);

  let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed=Number(document.getElementById('speed').value);
  let animationTime=0;
  let lastFrame=performance.now();
  let lastRendered=0;
  let lastLightingUpdate=-Infinity;
  let animationRequest=0;
  let contextLost=false;
  let redrawNeeded=true;
  function changeLightingTime(){
    lightTime.disabled=timeMode.value!=='custom';
    if(!lightTime.disabled && !/^\d{2}:\d{2}$/.test(lightTime.value))return;
    updateDaylight(new Date());
    redrawNeeded=true;
    revealControls();
  }
  timeMode.addEventListener('change',changeLightingTime);
  lightTime.addEventListener('input',changeLightingTime);
  setSharkCount(sharkCountInput.value);
  sharkCountInput.addEventListener('input',event=>setSharkCount(event.target.value));
  const pointer=new T.Vector2();
  const easedPointer=new T.Vector2();
  const raycaster=new T.Raycaster();
  const dragTarget=new T.Vector3();
  const gripLocal=new T.Vector3();
  const dragNormal=new T.Vector3();
  const dragNdc=new T.Vector2();
  const gripArm=new T.Vector3();
  const gripVelocity=new T.Vector3();
  const appliedForce=new T.Vector3();
  const appliedTorque=new T.Vector3();
  const rotationStep=new T.Quaternion();
  const baseRotation=new T.Quaternion();
  const localVelocity=new T.Vector3();
  const inverseRotation=new T.Quaternion();
  let gripDepth=0,depthDirection=0,gripTorque=0;
  let heldShark=null,heldPointer=null,lastSharkGrab=-Infinity;

  // The pointer selects a viewing ray. The right button pulls the contact point towards
  // the camera; the left pushes it deeper into the water. Mouse motion also
  // steers sideways. The contact point follows the shark's rotation.
  function pointerRay(event){
    const rect=canvas.getBoundingClientRect();
    dragNdc.set((event.clientX-rect.left)/rect.width*2-1,
      1-(event.clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(dragNdc,camera);
  }
  function releaseShark(){
    const wasHeld=heldShark!==null;
    const pointerId=heldPointer;
    heldShark=null;heldPointer=null;
    canvas.classList.remove('grabbing','pushing');
    if(pointerId!==null && canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
    if(wasHeld)revealControls();
  }
  canvas.addEventListener('pointerdown',event=>{
    if(![0,2].includes(event.button) || heldShark || contextLost)return;
    pointerRay(event);
    const hits=raycaster.intersectObjects(sharks.filter(s=>s.mesh.visible).map(s=>s.mesh),false);
    if(!hits.length)return;
    heldShark=sharks.find(s=>s.mesh===hits[0].object);
    heldPointer=event.pointerId;lastSharkGrab=performance.now();
    dragTarget.copy(hits[0].point);
    gripLocal.copy(hits[0].point);heldShark.mesh.worldToLocal(gripLocal);
    gripDepth=hits[0].distance;
    depthDirection=event.pointerType==='touch'?0:(event.button===2?-1:1);
    // A soft zone around the body centre makes translation easy, while
    // the head, tail and fins provide clear lever arms for torque.
    gripTorque=T.MathUtils.smoothstep(gripLocal.length(),.8,1.55);
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('grabbing');
    canvas.classList.toggle('pushing',depthDirection>0);
    event.preventDefault();redrawNeeded=true;
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==heldPointer)return;
    pointerRay(event);
    redrawNeeded=true;
  });
  // The browser menu would interrupt right-button dragging. Controls outside
  // the ocean canvas retain normal browser context menus.
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  for(const eventName of ['pointerup','pointercancel','lostpointercapture']){
    canvas.addEventListener(eventName,event=>{if(event.pointerId===heldPointer)releaseShark();});
  }
  window.addEventListener('blur',releaseShark);
  function resize(){
    const width=innerWidth,height=innerHeight;
    renderer.setSize(width,height,false);
    renderer.getDrawingBufferSize(waterUniforms.resolution.value);
    camera.aspect=width/height;
    // Portrait layouts get a wider field of view so whole sharks remain visible.
    camera.fov=camera.aspect<.85?62:49;
    camera.updateProjectionMatrix();
    waterUniforms.aspect.value=width/height;
    redrawNeeded=true;
  }
  window.addEventListener('resize',resize);
  resize();

  function renderScene(elapsed=0){
    waterUniforms.time.value=animationTime;
    particleUniforms.time.value=animationTime;
    if(!paused && !heldShark)easedPointer.lerp(pointer,.015);
    camera.position.x=Math.sin(animationTime*.027)*.75+easedPointer.x*.65;
    camera.position.y=3.5+Math.sin(animationTime*.039)*.24+easedPointer.y*.35;
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    if(heldShark){
      raycaster.setFromCamera(dragNdc,camera);
      gripDepth=T.MathUtils.clamp(gripDepth+depthDirection*4*elapsed,8,135);
      raycaster.ray.at(gripDepth,dragTarget);
    }
    // Project a direction (w = 0) instead of an arbitrary point near
    // the camera. Perspective gives parallel sunbeams a shared vanishing point.
    const light=waterUniforms.lightDirection.value;
    projectedSun.set(light.x,light.y,light.z,0)
      .applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    waterUniforms.solarProjection.value.set((projectedSun.x+projectedSun.w)*.5,
      (projectedSun.y+projectedSun.w)*.5,projectedSun.w);
    for(const shark of sharks){
      if(!shark.mesh.visible){if(shark===heldShark)releaseShark();continue;}
      const phase=shark.phase+animationTime*shark.rate*shark.direction;
      const x=Math.sin(phase)*shark.rx;
      const z=shark.z+Math.cos(phase)*shark.rz;
      const y=shark.y+Math.sin(phase*2+shark.phase)*.85;
      const dx=Math.cos(phase)*shark.rx*shark.direction;
      const dz=-Math.sin(phase)*shark.rz*shark.direction;
      shark.mesh.rotation.set(0,Math.atan2(-dz,dx),0);
      shark.mesh.rotateX(Math.sin(phase)*.20*shark.direction+Math.sin(animationTime*.11+shark.phase)*.055);
      shark.mesh.rotateZ(Math.cos(phase*2+shark.phase)*.045);
      baseRotation.copy(shark.mesh.quaternion);
      // Force at the contact point moves the body and produces torque
      // r cross F. An elongated body has less inertia around its longitudinal axis.
      // Small substeps and water resistance damp both translation and rotation.
      const steps=Math.max(1,Math.ceil(elapsed*120)),dt=elapsed/steps;
      for(let step=0;step<steps;step++){
        shark.mesh.quaternion.copy(baseRotation).premultiply(shark.rotationOffset);
        if(shark===heldShark){
          gripArm.copy(gripLocal).multiplyScalar(shark.scale).applyQuaternion(shark.mesh.quaternion);
          gripVelocity.crossVectors(shark.angularVelocity,gripArm).add(shark.velocity);
          appliedForce.copy(dragTarget).sub(gripArm);
          appliedForce.x-=x+shark.offset.x;
          appliedForce.y-=y+shark.offset.y;
          appliedForce.z-=z+shark.offset.z;
          appliedForce.multiplyScalar(45).addScaledVector(gripVelocity,-9).clampLength(0,80);
          shark.velocity.addScaledVector(appliedForce,dt);
          shark.velocity.clampLength(0,40);
          appliedTorque.crossVectors(gripArm,appliedForce).multiplyScalar(gripTorque);
          inverseRotation.copy(shark.mesh.quaternion).invert();
          appliedTorque.applyQuaternion(inverseRotation);
          appliedTorque.x/=.6*shark.scale*shark.scale;
          appliedTorque.y/=3.8*shark.scale*shark.scale;
          appliedTorque.z/=3.8*shark.scale*shark.scale;
          appliedTorque.applyQuaternion(shark.mesh.quaternion);
          shark.angularVelocity.addScaledVector(appliedTorque,dt).clampLength(0,2.5);
        }else shark.velocity.multiplyScalar(Math.exp(-5.5*dt));
        shark.angularVelocity.multiplyScalar(Math.exp(-5*dt));
        shark.offset.addScaledVector(shark.velocity,dt);
        const angularSpeed=shark.angularVelocity.length();
        if(angularSpeed>0){
          dragNormal.copy(shark.angularVelocity).divideScalar(angularSpeed);
          rotationStep.setFromAxisAngle(dragNormal,angularSpeed*dt);
          shark.rotationOffset.premultiply(rotationStep).normalize();
        }
      }
      if(shark!==heldShark && shark.velocity.lengthSq()<.00001)shark.velocity.set(0,0,0);
      if(shark!==heldShark && shark.angularVelocity.lengthSq()<.00001)shark.angularVelocity.set(0,0,0);
      shark.mesh.position.set(x,y,z).add(shark.offset);
      shark.mesh.quaternion.copy(baseRotation).premultiply(shark.rotationOffset);
      // The tail yields against movement, including when direction changes.
      // The deformation is filtered so it straightens gently after release.
      inverseRotation.copy(shark.mesh.quaternion).invert();
      localVelocity.copy(shark.velocity).applyQuaternion(inverseRotation).divideScalar(shark.scale);
      const elasticity=1-Math.exp(-8*elapsed);
      const bend=shark.uniforms.dragBend.value;
      bend.x+= (T.MathUtils.clamp(-localVelocity.y*.055,-.85,.85)-bend.x)*elasticity;
      bend.y+= (T.MathUtils.clamp(-localVelocity.z*.055,-.85,.85)-bend.y)*elasticity;
      if(shark.velocity.lengthSq()===0 && bend.lengthSq()<.00001)bend.set(0,0);
      shark.uniforms.swimTime.value=animationTime*(.83+shark.rate*7);
    }
    for(let i=0;i<fishCount;i++) {
      const seed=fishSeeds[i],school=i<45?0:1;
      const phase=animationTime*.019+school*2.7;
      fishTransform.position.set(
        Math.sin(phase)*26+(seed[0]-.5)*17,
        (school? -5:11)+(seed[1]-.5)*5+Math.sin(animationTime*.5+i)*.08,
        -38-school*21+(seed[2]-.5)*10
      );
      fishTransform.rotation.set(0,Math.cos(phase)>.0?0:Math.PI,Math.sin(i+animationTime)*.04);
      fishTransform.scale.setScalar(.45+seed[1]*.8);
      fishTransform.updateMatrix();fish.setMatrixAt(i,fishTransform.matrix);
    }
    fish.instanceMatrix.needsUpdate=true;
    renderer.clear();
    renderer.render(background,backgroundCamera);
    renderer.clearDepth();
    renderer.render(scene,camera);
  }
  function frame(now){
    animationRequest=requestAnimationFrame(frame);
    // A 40 fps cap limits GPU usage while preserving calm, fluid motion.
    if(now-lastRendered<1000/40 || contextLost) return;
    const elapsed=Math.min((now-lastFrame)/1000,.12);
    lastFrame=now; lastRendered=now;
    if(!paused){
      animationTime+=elapsed*speed;
      // A one-second update interval is sufficient for the smooth day cycle. Pause freezes
      // both movement and lighting; resuming fetches the current local time.
      if(now-lastLightingUpdate>=1000){updateDaylight(new Date());lastLightingUpdate=now;}
    }
    const interacting=heldShark || sharks.some(s=>s.mesh.visible &&
      (s.velocity.lengthSq()>0 || s.angularVelocity.lengthSq()>0 || s.uniforms.dragBend.value.lengthSq()>0));
    if(!paused || redrawNeeded || interacting){renderScene(elapsed);redrawNeeded=false;}
  }
  updateDaylight(new Date());
  renderScene();
  animationRequest=requestAnimationFrame(frame);
  loading.hidden=true;
  document.body.dataset.ready='true';

  // Hidden tabs do not need rendering. The scene resumes without jumps
  // when the tab becomes visible again; a visible scene has no time limit.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)releaseShark();
    cancelAnimationFrame(animationRequest);
    if(!document.hidden){lastFrame=performance.now();lastLightingUpdate=-Infinity;animationRequest=requestAnimationFrame(frame);}
  });
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();releaseShark();contextLost=true;
    showError('The 3D display was interrupted. It will resume when the browser graphics are ready.');
  });
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;errorBox.hidden=true;redrawNeeded=true;lastFrame=performance.now();});

  const pauseButton=document.getElementById('pause');
  function updatePauseButton(){
    document.getElementById('pause-label').textContent=paused?'Resume':'Pause';
    document.getElementById('pause-icon').setAttribute('d',paused?'M8 5l11 7-11 7V5':'M9 5v14M15 5v14');
    pauseButton.setAttribute('aria-label',paused?'Resume animation':'Pause animation');
    pauseButton.setAttribute('aria-pressed',String(paused));
  }
  function togglePause(){paused=!paused;lastLightingUpdate=-Infinity;redrawNeeded=true;updatePauseButton();revealControls();}
  pauseButton.addEventListener('click',togglePause);
  updatePauseButton();
  document.getElementById('speed').addEventListener('input',event=>{speed=Number(event.target.value);});

  // Fullscreen requires a click or keypress. The screen wake lock is
  // active only in fullscreen and is released when fullscreen ends.
  let wakeLock=null;
  let noticeTimer;
  function notice(message){
    const element=document.getElementById('notice');
    element.textContent=message;element.classList.add('visible');
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>element.classList.remove('visible'),4500);
  }
  async function requestWakeLock(){
    if(document.fullscreenElement && 'wakeLock' in navigator && !document.hidden){
      try{wakeLock=await navigator.wakeLock.request('screen');}catch(error){/* Normal browser power management applies if denied. */}
    }
  }
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notice('Use your browser fullscreen option to fill the screen.');
    }catch(error){notice('Press F11 to enter browser fullscreen.');}
  }
  document.getElementById('fullscreen').addEventListener('click',toggleFullscreen);
  canvas.addEventListener('dblclick',()=>{if(performance.now()-lastSharkGrab>650)toggleFullscreen();});
  document.addEventListener('fullscreenchange',async()=>{
    document.querySelector('#fullscreen span').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';
    if(document.fullscreenElement) await requestWakeLock();
    else if(wakeLock){await wakeLock.release();wakeLock=null;}
    revealControls();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) requestWakeLock();});

  let hideTimer;
  function revealControls(){
    document.body.classList.remove('immersed');
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      if(heldShark || !errorBox.hidden)return;
      document.body.classList.add('immersed');
    },5000);
  }
  document.addEventListener('pointermove',event=>{
    pointer.set((event.clientX/innerWidth-.5)*2,(.5-event.clientY/innerHeight)*2);
    revealControls();
  },{passive:true});
  document.addEventListener('pointerdown',revealControls,{passive:true});
  document.addEventListener('input',revealControls);
  document.addEventListener('change',revealControls);
  document.addEventListener('keydown',event=>{
    revealControls();
    if(event.repeat || event.ctrlKey || event.metaKey || event.altKey)return;
    if(event.target.matches('input,select,textarea'))return;
    if(event.key.toLowerCase()==='f'){event.preventDefault();toggleFullscreen();return;}
    if(event.target.matches('button'))return;
    if(event.code==='Space'){event.preventDefault();togglePause();}
  });
  document.addEventListener('focusin',revealControls);
  revealControls();
})();
