var hls = null;
var audio = document.getElementById('player');
var playPauseBtn = document.getElementById('play-pause-btn');
var timeline = document.getElementById('timeline');
var timelinePlayed = document.getElementById('timeline-played');

var PLAY_ICON = '\u25B6';   // ▶
var PAUSE_ICON = '\u23F8';  // ⏸

// Track folders - add new tracks here (kebab-case folder names)
var producedTracks = [
  'creeping-insolence',
  'multiplicitous-incidents-of-trauma',
  'rude-introduction',
  'wading-in'
];

var livePerformances = [
  // Add live performance folder names here
];

var djMixes = [
  // Add DJ mix folder names here
];

// Transform kebab-case to Title Case
function toTitleCase(str) {
  return str.split('-').map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function buildTrackList(tracks, containerId, basePath) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var ul = container.querySelector('ul');
  ul.innerHTML = '';

  if (tracks.length === 0) {
    var li = document.createElement('li');
    li.className = 'coming-soon';
    li.textContent = 'Coming soon...';
    ul.appendChild(li);
    return;
  }

  tracks.forEach(function(track) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.className = 'track-btn';
    btn.setAttribute('data-src', basePath + track + '/master.m3u8');
    btn.textContent = toTitleCase(track);
    btn.addEventListener('click', handleTrackClick);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function loadTrack(src) {
  if (hls) {
    hls.destroy();
  }
  hls = new Hls();
  hls.attachMedia(audio);
  hls.on(Hls.Events.MANIFEST_PARSED, function() {
    playPauseBtn.disabled = false;
    audio.play();
  });
  hls.on(Hls.Events.ERROR, function(event, data) {
    console.error('HLS error:', data.type, data.details, data.fatal ? '(fatal)' : '');
  });
  hls.loadSource(src);
}

function handleTrackClick() {
  document.querySelectorAll('.track-active').forEach(function(el) {
    el.classList.remove('track-active');
  });
  this.parentElement.classList.add('track-active');
  var src = this.getAttribute('data-src');
  loadTrack(src);
}

playPauseBtn.addEventListener('click', function() {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

audio.addEventListener('play', function() {
  playPauseBtn.textContent = PAUSE_ICON;
  playPauseBtn.classList.add('playing');
});

audio.addEventListener('pause', function() {
  playPauseBtn.textContent = PLAY_ICON;
  playPauseBtn.classList.remove('playing');
});

audio.addEventListener('timeupdate', function() {
  if (audio.duration && !isNaN(audio.duration)) {
    var percent = (audio.currentTime / audio.duration) * 100;
    timelinePlayed.style.width = percent + '%';
  }
});

timeline.addEventListener('click', function(e) {
  if (!audio.duration || isNaN(audio.duration)) return;
  var rect = timeline.getBoundingClientRect();
  var clickX = e.clientX - rect.left;
  var percent = clickX / rect.width;
  audio.currentTime = percent * audio.duration;
});

audio.addEventListener('ended', function() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  document.querySelectorAll('.track-active').forEach(function(el) {
    el.classList.remove('track-active');
  });
  playPauseBtn.textContent = PLAY_ICON;
  playPauseBtn.classList.remove('playing');
  playPauseBtn.disabled = true;
  timelinePlayed.style.width = '0%';
});

buildTrackList(producedTracks, 'produced-tracks', 'hls/production/');
buildTrackList(livePerformances, 'live-performances', 'hls/live-performances/');
buildTrackList(djMixes, 'dj-mixes', 'hls/mixes/');
