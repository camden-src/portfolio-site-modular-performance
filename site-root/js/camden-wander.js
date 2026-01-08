var hls = null;
var audio = document.getElementById('player');
var playPauseBtn = document.getElementById('play-pause-btn');
var playPauseBtnSvgText = document.getElementById('player-text');
var timeline = document.getElementById('timeline');
var timelinePlayed = document.getElementById('timeline-played');

var PLAY_ICON = '\u25B6';
var PAUSE_ICON = '\u23F8';

var currentTrackData = null;

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  var mins = Math.floor(seconds / 60);
  var secs = Math.floor(seconds % 60);
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function loadTrack(src, trackId, trackTitle) {
  if (hls) {
    hls.destroy();
  }
  currentTrackData = { id: trackId, title: trackTitle, src: src };
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

function initializeTrackListeners() {
  var trackItems = document.querySelectorAll('.track-item');
  trackItems.forEach(function(item) {
    var queuer = item.querySelector('.track-queuer');
    var infoToggle = item.querySelector('.track-info-toggle');
    var trackId = item.getAttribute('data-id');
    var src = item.getAttribute('data-src');
    var title = item.querySelector('.track-name').textContent;

    queuer.addEventListener('click', function(e) {
      e.preventDefault();
      var wasActive = item.classList.contains('track-active');

      document.querySelectorAll('.track-active').forEach(function(el) {
        el.classList.remove('track-active');
        el.querySelector('.track-queuer').textContent = PLAY_ICON;
      });

      if (wasActive && !audio.paused) {
        audio.pause();
      } else {
        item.classList.add('track-active');
        queuer.textContent = PAUSE_ICON;
        if (currentTrackData && currentTrackData.id === trackId && audio.paused) {
          audio.play();
        } else {
          loadTrack(src, trackId, title);
        }
      }
    });

    infoToggle.addEventListener('click', function(e) {
      e.preventDefault();
      var infoPanel = document.querySelector('.track-info-panel[data-track-id="' + trackId + '"]');
      if (infoPanel) {
        if (infoPanel.style.display === 'none') {
          infoPanel.style.display = 'block';
          infoPanel.style.maxHeight = '0px';
          infoPanel.style.overflow = 'hidden';
          infoPanel.style.transformOrigin = 'top';
          infoPanel.style.transition = 'max-height 0.3s ease-out';
          setTimeout(function() {
            infoPanel.style.maxHeight = '200px';
          }, 10);
        } else {
          infoPanel.style.maxHeight = '0px';
          setTimeout(function() {
            infoPanel.style.display = 'none';
          }, 300);
        }
      }
    });
  });

  var closeBtns = document.querySelectorAll('.info-panel-close');
  closeBtns.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var panel = this.closest('.track-info-panel');
      if (panel) {
        panel.style.maxHeight = '0px';
        setTimeout(function() {
          panel.style.display = 'none';
        }, 300);
      }
    });
  });
}

playPauseBtn.addEventListener('click', function() {
  if (this.disabled) return;
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

audio.addEventListener('play', function() {
  playPauseBtnSvgText.textContent = PAUSE_ICON;
  playPauseBtn.classList.add('playing');

  if (currentTrackData) {
    var activeItem = document.querySelector('.track-item[data-id="' + currentTrackData.id + '"]');
    if (activeItem) {
      activeItem.classList.add('track-active');
      activeItem.querySelector('.track-queuer').textContent = PAUSE_ICON;
    }
  }
});

audio.addEventListener('pause', function() {
  playPauseBtnSvgText.textContent = PLAY_ICON;
  playPauseBtn.classList.remove('playing');

  if (currentTrackData) {
    var activeItem = document.querySelector('.track-item[data-id="' + currentTrackData.id + '"]');
    if (activeItem) {
      activeItem.querySelector('.track-queuer').textContent = PLAY_ICON;
    }
  }
});

audio.addEventListener('timeupdate', function() {
  if (audio.duration && !isNaN(audio.duration)) {
    var percent = (audio.currentTime / audio.duration) * 100;
    timelinePlayed.style.width = percent + '%';
    updateTimelineText();
  }
});

function updateTimelineText() {
  if (!currentTrackData || !audio.duration || isNaN(audio.duration)) {
    timelinePlayed.textContent = '';
    timeline.setAttribute('data-remaining', '');
    return;
  }

  var timeRemaining = audio.duration - audio.currentTime;
  var timePlayed = audio.currentTime;
  var trackTitle = currentTrackData.title;
  var percent = (audio.currentTime / audio.duration) * 100;

  var playedWidth = timeline.offsetWidth * (percent / 100);
  var unplayedWidth = timeline.offsetWidth - playedWidth;

  var playedText = trackTitle + ' -' + formatTime(timeRemaining);
  var remainingText = formatTime(timePlayed) + ' ' + trackTitle;

  var showPlayed = playedWidth > 120;
  var showRemaining = unplayedWidth > 120;

  timelinePlayed.textContent = '';
  timeline.setAttribute('data-remaining', '');

  if (showPlayed) {
    timelinePlayed.textContent = playedText;
  }
  if (showRemaining) {
    timeline.setAttribute('data-remaining', remainingText);
  }
}

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
    el.querySelector('.track-queuer').textContent = PLAY_ICON;
  });
  playPauseBtnSvgText.textContent = PLAY_ICON;
  playPauseBtn.classList.remove('playing');
  playPauseBtn.disabled = true;
  timelinePlayed.style.width = '0%';
  currentTrackData = null;
});

initializeTrackListeners();
