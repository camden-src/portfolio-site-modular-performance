import * as THREE from 'three';

var artworkImages = [
    'four-techs.jpg',
    'gateway-to-the-giant-stairs.jpg',
    'pareidolia-untitled.jpg',
    'pathological-defensive-pessimism.jpg',
    'soul-in-solstice.jpg',
    'ten-drills.jpg',
    'theres-no-art-in-money.jpg'
  ];

  var CONFIG = {
    DESCENT_DURATION: 10000,      // 10 seconds top to bottom
    DEFAULT_BPM: 60,              // 1 rotation/sec when no audio
    MAX_ACTIVE_IMAGES: 3,         // 3 descending images max
    BASE_PLANE_HEIGHT: 3,
    CAMERA_Z: 10,
    IMAGE_Z: 1.5,                 // All images on same Z plane
    FRAME_WIDTH: 0.04,            // Medium frames
    FRAME_DEPTH: 0.12,            // Medium depth for bevel
    FRAME_COLOR: 0x6B4A3A,        // 
    FADE_ZONE: 0.15,              // 15% fade at start/end
    RULE_OF_THIRDS: {
      UPPER: 1 / 3,
      LOWER: 2 / 3
    }
  };

  var canvas, renderer, scene, camera;
  var textureLoader, loadedTextures = [];
  var activeImages = [];
  var currentImageIndex = 0;
  var lastFrameTime = 0;
  var viewportBounds = null;

  function init() {
    canvas = document.getElementById('webgl-bg');
    if (!canvas) {
      console.error('WebGL canvas not found');
      return;
    }

    setupRenderer();
    setupScene();
    setupCamera();
    setupLighting();
    setupResizeHandler();
    calculateViewportBounds();

    textureLoader = new THREE.TextureLoader();

    if (artworkImages.length > 0) {
      preloadTextures(startAnimation);
    } else {
      animate();
    }
  }

  function setupRenderer() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  function setupScene() {
    scene = new THREE.Scene();
  }

  function setupCamera() {
    camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = CONFIG.CAMERA_Z;
  }

  function setupLighting() {
    // Dim ambient for base visibility
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(ambientLight);

    // Target: middle center of rule of thirds (stage at z=1.5)
    var stageCenter = new THREE.Vector3(0, 0, CONFIG.IMAGE_Z);

    // Mastercard trio - 3 lights in front of camera illuminating vertical middle
    var mastercardLights = [
      { pos: [-2.5, 0, 6], intensity: 1.5, penumbra: 0.5, angle: Math.PI / 3 },   // Left circle
      { pos: [2.5, 0, 6],  intensity: 1.5, penumbra: 0.5, angle: Math.PI / 3 },   // Right circle
      { pos: [0, 0, 5],    intensity: 2.5, penumbra: 0.4, angle: Math.PI / 4 }    // Center high intensity
    ];

    // Clover - 4 lights from viewport corners, lower intensity
    var cloverLights = [
      { pos: [-8, 6, 6],  intensity: 0.6, penumbra: 0.7, angle: Math.PI / 5 },   // Top-left
      { pos: [8, 6, 6],   intensity: 0.6, penumbra: 0.7, angle: Math.PI / 5 },   // Top-right
      { pos: [-8, -6, 6], intensity: 0.6, penumbra: 0.7, angle: Math.PI / 5 },   // Bottom-left
      { pos: [8, -6, 6],  intensity: 0.6, penumbra: 0.7, angle: Math.PI / 5 }    // Bottom-right
    ];

    // Top light - directly above camera, tight penumbra, high intensity
    var topLight = [
      { pos: [0, 10, 10], intensity: 3.0, penumbra: 0.25, angle: Math.PI / 5 }
    ];

    var allLights = mastercardLights.concat(cloverLights).concat(topLight);

    allLights.forEach(function(config) {
      var spot = new THREE.SpotLight(0xffffff, config.intensity);
      spot.position.set(config.pos[0], config.pos[1], config.pos[2]);
      spot.target.position.copy(stageCenter);
      spot.angle = config.angle;
      spot.penumbra = config.penumbra;
      spot.decay = 1.0;
      spot.distance = 30;
      scene.add(spot);
      scene.add(spot.target);
    });
  }

  function setupResizeHandler() {
    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    calculateViewportBounds();
  }

  function calculateViewportBounds() {
    var vFov = camera.fov * Math.PI / 180;
    var distance = CONFIG.CAMERA_Z - CONFIG.IMAGE_Z;
    var height = 2 * Math.tan(vFov / 2) * distance;
    var width = height * camera.aspect;

    viewportBounds = {
      top: height / 2,
      bottom: -height / 2,
      left: -width / 2,
      right: width / 2,
      height: height,
      width: width
    };
  }

  function preloadTextures(callback) {
    var loaded = 0;
    var total = artworkImages.length;

    artworkImages.forEach(function(filename, index) {
      textureLoader.load(
        'img/' + filename,
        function(texture) {
          loadedTextures[index] = texture;
          loaded++;
          if (loaded === total) {
            callback();
          }
        },
        undefined,
        function(error) {
          console.error('Failed to load texture:', filename);
          loadedTextures[index] = null;
          loaded++;
          if (loaded === total) {
            callback();
          }
        }
      );
    });
  }

  function getRandomXPosition() {
    if (!viewportBounds) calculateViewportBounds();
    var padding = CONFIG.BASE_PLANE_HEIGHT * 0.6;
    var minX = viewportBounds.left + padding;
    var maxX = viewportBounds.right - padding;
    return minX + Math.random() * (maxX - minX);
  }

  function calculateOpacity(t) {
    var fadeZone = CONFIG.FADE_ZONE;

    if (t < fadeZone) {
      return t / fadeZone;
    } else if (t > 1 - fadeZone) {
      return (1 - t) / fadeZone;
    }
    return 1.0;
  }

  function setGroupOpacity(group, opacity) {
    if (group.userData && group.userData.materials) {
      group.userData.materials.forEach(function(mat) {
        mat.opacity = opacity;
      });
    }
  }

  function createBeveledFrameShape(width, height, frameWidth) {
    var shape = new THREE.Shape();
    var outerW = width + frameWidth * 2;
    var outerH = height + frameWidth * 2;

    // Outer rectangle
    shape.moveTo(-outerW / 2, -outerH / 2);
    shape.lineTo(outerW / 2, -outerH / 2);
    shape.lineTo(outerW / 2, outerH / 2);
    shape.lineTo(-outerW / 2, outerH / 2);
    shape.lineTo(-outerW / 2, -outerH / 2);

    // Inner rectangle (hole for image)
    var hole = new THREE.Path();
    hole.moveTo(-width / 2, -height / 2);
    hole.lineTo(-width / 2, height / 2);
    hole.lineTo(width / 2, height / 2);
    hole.lineTo(width / 2, -height / 2);
    hole.lineTo(-width / 2, -height / 2);
    shape.holes.push(hole);

    return shape;
  }

  function createFrameMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0xB87333,        // Copper
      metalness: 0.9,
      roughness: 0.35,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
  }

  function createPlane(texture) {
    if (!texture || !texture.image) return null;

    var aspectRatio = texture.image.width / texture.image.height;
    var height = CONFIG.BASE_PLANE_HEIGHT;
    var width = height * aspectRatio;
    var fw = CONFIG.FRAME_WIDTH;
    var fd = CONFIG.FRAME_DEPTH;

    var group = new THREE.Group();

    // Image plane - responds to spotlight
    var imageGeometry = new THREE.PlaneGeometry(width, height);
    var imageMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.8
    });
    var imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
    imageMesh.position.z = fd / 2;
    group.add(imageMesh);

    // Beveled frame using ExtrudeGeometry
    var frameShape = createBeveledFrameShape(width, height, fw);
    var extrudeSettings = {
      depth: fd,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelOffset: 0,
      bevelSegments: 4
    };

    var frameMaterial = createFrameMaterial();
    var frameGeometry = new THREE.ExtrudeGeometry(frameShape, extrudeSettings);
    var frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
    frameMesh.rotation.x = Math.PI;
    frameMesh.position.z = fd / 2;
    group.add(frameMesh);

    group.userData.materials = [imageMaterial, frameMaterial];

    return group;
  }

  function removeImage(imgData) {
    if (imgData.group) {
      scene.remove(imgData.group);
      imgData.group.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    var index = activeImages.indexOf(imgData);
    if (index > -1) {
      activeImages.splice(index, 1);
    }
  }

  function getNextTexture() {
    var validTextures = loadedTextures.filter(function(t) {
      return t !== null;
    });
    if (validTextures.length === 0) return null;

    var texture = validTextures[currentImageIndex % validTextures.length];
    currentImageIndex++;
    return texture;
  }

  function spawnNewImage() {
    if (activeImages.length >= CONFIG.MAX_ACTIVE_IMAGES) return;

    var texture = getNextTexture();
    if (!texture) return;

    var group = createPlane(texture);
    if (!group) return;

    var xPos = getRandomXPosition();
    var yStart = viewportBounds.top + CONFIG.BASE_PLANE_HEIGHT;

    group.position.set(xPos, yStart, CONFIG.IMAGE_Z);
    setGroupOpacity(group, 0);

    scene.add(group);

    activeImages.push({
      group: group,
      startTime: performance.now(),
      xPosition: xPos,
      hasTriggeredSpawn: false
    });
  }

  function getRotationSpeed() {
    var bpm = CONFIG.DEFAULT_BPM;

    if (window.camdenAudio && window.camdenAudio.isPlaying()) {
      var bassIntensity = window.camdenAudio.getBassIntensity();
      // Map bass intensity to BPM range (60-180)
      var minBPM = 60;
      var maxBPM = 180;
      bpm = minBPM + bassIntensity * (maxBPM - minBPM);
    }

    // Convert BPM to radians per second (full rotation = 2*PI)
    return (bpm / 60) * Math.PI * 2;
  }

  function startAnimation() {
    loadedTextures = loadedTextures.filter(function(t) {
      return t !== null;
    });

    if (loadedTextures.length === 0) {
      animate();
      return;
    }

    // Start with first image
    spawnNewImage();
    lastFrameTime = performance.now();
    animate();
  }

  function animate() {
    requestAnimationFrame(animate);

    var now = performance.now();
    var deltaTime = (now - lastFrameTime) / 1000; // Convert to seconds
    lastFrameTime = now;

    var rotationSpeed = getRotationSpeed();

    // Process each active image
    var imagesToRemove = [];

    activeImages.forEach(function(imgData) {
      var elapsed = now - imgData.startTime;
      var t = elapsed / CONFIG.DESCENT_DURATION;

      if (t >= 1) {
        imagesToRemove.push(imgData);
        return;
      }

      // Calculate Y position (descending from top to bottom)
      var yStart = viewportBounds.top + CONFIG.BASE_PLANE_HEIGHT;
      var yEnd = viewportBounds.bottom - CONFIG.BASE_PLANE_HEIGHT;
      var y = yStart - t * (yStart - yEnd);

      imgData.group.position.y = y;

      // Rotation logic based on rule of thirds
      if (t < CONFIG.RULE_OF_THIRDS.UPPER) {
        // Top third: rotating
        imgData.group.rotation.y += rotationSpeed * deltaTime;
      } else if (t > CONFIG.RULE_OF_THIRDS.LOWER) {
        // Bottom third: rotating
        imgData.group.rotation.y += rotationSpeed * deltaTime;
      } else {
        // Middle third: complete rotation forward to face camera
        var currentRotation = imgData.group.rotation.y;
        // Always round up to complete rotation in same direction
        var fullRotations = Math.ceil(currentRotation / (Math.PI * 2));
        var targetRotation = fullRotations * Math.PI * 2;
        imgData.group.rotation.y += (targetRotation - currentRotation) * 0.1;
      }

      // Opacity
      setGroupOpacity(imgData.group, calculateOpacity(t));

      // Spawn next image at halfway point
      if (!imgData.hasTriggeredSpawn && t >= 0.5) {
        imgData.hasTriggeredSpawn = true;
        spawnNewImage();
      }
    });

    // Remove completed images
    imagesToRemove.forEach(function(imgData) {
      removeImage(imgData);
    });

    // Ensure at least one image is always descending
    if (activeImages.length === 0 && loadedTextures.length > 0) {
      spawnNewImage();
    }

    renderer.render(scene, camera);
  }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
