(function() {
  'use strict';

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
    ANIMATION_DURATION: 8000,
    PAUSE_BETWEEN: 1500,
    BASE_PLANE_HEIGHT: 3,
    CAMERA_Z: 10,
    CORNER_Z_FAR: -5,
    CENTER_Z_NEAR: 5,
    FADE_ZONE: 0.15
  };

  var CORNERS = {
    TOP_LEFT:     { x: -8, y:  5, z: CONFIG.CORNER_Z_FAR },
    TOP_RIGHT:    { x:  8, y:  5, z: CONFIG.CORNER_Z_FAR },
    BOTTOM_LEFT:  { x: -8, y: -5, z: CONFIG.CORNER_Z_FAR },
    BOTTOM_RIGHT: { x:  8, y: -5, z: CONFIG.CORNER_Z_FAR }
  };

  var CORNER_KEYS = Object.keys(CORNERS);

  var canvas, renderer, scene, camera;
  var textureLoader, loadedTextures = [];
  var currentPlane = null;
  var currentCurve = null;
  var animationStartTime = null;
  var lastStartCorner = null;
  var currentImageIndex = 0;
  var isAnimating = false;

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
    var ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
  }

  function setupResizeHandler() {
    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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

  function getOppositeCorner(corner) {
    var opposites = {
      TOP_LEFT: 'BOTTOM_RIGHT',
      TOP_RIGHT: 'BOTTOM_LEFT',
      BOTTOM_LEFT: 'TOP_RIGHT',
      BOTTOM_RIGHT: 'TOP_LEFT'
    };
    return opposites[corner];
  }

  function selectStartCorner() {
    var availableCorners = CORNER_KEYS.filter(function(corner) {
      return corner !== lastStartCorner;
    });
    var selected = availableCorners[
      Math.floor(Math.random() * availableCorners.length)
    ];
    lastStartCorner = selected;
    return selected;
  }

  function createCurve(startCornerKey, endCornerKey) {
    var start = CORNERS[startCornerKey];
    var end = CORNERS[endCornerKey];

    var control = new THREE.Vector3(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      CONFIG.CENTER_Z_NEAR
    );

    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start.x, start.y, start.z),
      control,
      new THREE.Vector3(end.x, end.y, end.z)
    );
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

  function createPlane(texture) {
    if (!texture || !texture.image) return null;

    var aspectRatio = texture.image.width / texture.image.height;
    var height = CONFIG.BASE_PLANE_HEIGHT;
    var width = height * aspectRatio;

    var geometry = new THREE.PlaneGeometry(width, height);
    var material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });

    return new THREE.Mesh(geometry, material);
  }

  function removePlane(plane) {
    if (plane) {
      scene.remove(plane);
      plane.geometry.dispose();
      plane.material.dispose();
    }
  }

  function startAnimation() {
    loadedTextures = loadedTextures.filter(function(t) {
      return t !== null;
    });

    if (loadedTextures.length === 0) {
      animate();
      return;
    }

    launchNextImage();
    animate();
  }

  function launchNextImage() {
    if (currentPlane) {
      removePlane(currentPlane);
      currentPlane = null;
    }

    if (loadedTextures.length === 0) return;

    var texture = loadedTextures[currentImageIndex];
    currentImageIndex = (currentImageIndex + 1) % loadedTextures.length;

    currentPlane = createPlane(texture);
    if (!currentPlane) {
      setTimeout(launchNextImage, 100);
      return;
    }

    var startCorner = selectStartCorner();
    var endCorner = getOppositeCorner(startCorner);
    currentCurve = createCurve(startCorner, endCorner);

    var startPos = currentCurve.getPoint(0);
    currentPlane.position.copy(startPos);
    currentPlane.material.opacity = 0;

    scene.add(currentPlane);

    animationStartTime = performance.now();
    isAnimating = true;
  }

  function animate() {
    requestAnimationFrame(animate);

    if (isAnimating && currentPlane && currentCurve) {
      var elapsed = performance.now() - animationStartTime;
      var t = Math.min(elapsed / CONFIG.ANIMATION_DURATION, 1);

      var position = currentCurve.getPoint(t);
      currentPlane.position.copy(position);

      currentPlane.material.opacity = calculateOpacity(t);

      currentPlane.lookAt(camera.position);

      if (t >= 1) {
        isAnimating = false;
        setTimeout(launchNextImage, CONFIG.PAUSE_BETWEEN);
      }
    }

    renderer.render(scene, camera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
