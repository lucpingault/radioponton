/**
 * Radio Ponton — Barre flottante + popup player
 * À inclure avant </body> sur toutes les pages.
 */
(function () {
  'use strict';

  const STREAM  = 'https://radio.radioponton.net:8000/radio.mp3';
  const API     = 'https://radio.radioponton.net/api/nowplaying/radio-ponton';
  const POPUP_W = 380;
  const POPUP_H = 200;

  // ── Styles ──────────────────────────────────────────────────────────────
  const css = `
    #rp-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: rgba(11,20,34,0.97);
      border-top: 1px solid #222a39;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex; align-items: center; gap: 12px;
      padding: 0 16px;
      height: 56px;
      font-family: 'Space Grotesk', sans-serif;
      color: #dae3f7;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
      transition: transform 0.3s ease;
    }
    #rp-bar.hidden { transform: translateY(100%); }

    #rp-live-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #434653; flex-shrink: 0;
      transition: background 0.3s;
    }
    #rp-live-dot.active { background: #ef4444; animation: rp-pulse 1.5s infinite; }
    @keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    #rp-station {
      font-size: 12px; font-weight: 600;
      color: #ffb95d; letter-spacing: 0.5px;
      flex-shrink: 0; white-space: nowrap;
    }

    #rp-np-wrap {
      flex: 1; overflow: hidden; min-width: 0;
    }
    #rp-np {
      font-size: 12px; color: #8d909e;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    #rp-play {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #ffb95d, #c78213);
      border: none; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 0 12px rgba(255,185,93,0.35);
    }
    #rp-play:hover { transform: scale(1.08); box-shadow: 0 0 18px rgba(255,185,93,0.5); }
    #rp-play:active { transform: scale(0.94); }
    #rp-play svg { pointer-events: none; }

    #rp-popup-btn {
      font-size: 11px; font-weight: 500;
      color: #434653; white-space: nowrap;
      background: none; border: 1px solid #2c3544;
      border-radius: 4px; padding: 4px 10px;
      cursor: pointer; flex-shrink: 0;
      transition: color 0.2s, border-color 0.2s;
    }
    #rp-popup-btn:hover { color: #ffb95d; border-color: #ffb95d; }

    #rp-hide-btn {
      background: none; border: none; cursor: pointer;
      color: #434653; font-size: 16px; flex-shrink: 0;
      line-height: 1; padding: 4px;
      transition: color 0.2s;
    }
    #rp-hide-btn:hover { color: #dae3f7; }

    #rp-show-btn {
      position: fixed; bottom: 12px; right: 16px; z-index: 9998;
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg, #ffb95d, #c78213);
      border: none; cursor: pointer;
      display: none; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(255,185,93,0.45);
      transition: transform 0.15s;
    }
    #rp-show-btn.visible { display: flex; }
    #rp-show-btn:hover { transform: scale(1.08); }
    #rp-show-btn svg { pointer-events: none; }

    @media (max-width: 480px) {
      #rp-popup-btn { display: none; }
      #rp-station { font-size: 11px; }
    }
  `;

  // ── DOM ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'rp-bar';
  bar.innerHTML = `
    <div id="rp-live-dot"></div>
    <span id="rp-station">RADIO PONTON</span>
    <div id="rp-np-wrap"><span id="rp-np">En direct 24h/24</span></div>
    <button id="rp-play" title="Play / Pause" aria-label="Play">
      <svg id="rp-play-icon" width="14" height="14" viewBox="0 0 24 24" fill="#0b1422">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    </button>
    <button id="rp-popup-btn" title="Ouvrir le player dans une fenêtre séparée">⧉ Popup</button>
    <button id="rp-hide-btn" title="Masquer la barre" aria-label="Masquer">✕</button>
  `;
  document.body.appendChild(bar);

  // Bouton pour réafficher la barre après fermeture
  const showBtn = document.createElement('button');
  showBtn.id = 'rp-show-btn';
  showBtn.title = 'Ouvrir le player Radio Ponton';
  showBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#0b1422"><polygon points="5,3 19,12 5,21"/></svg>`;
  document.body.appendChild(showBtn);

  // ── State ────────────────────────────────────────────────────────────────
  const audio     = new Audio();
  audio.preload   = 'none';
  let isPlaying   = false;
  let isLoading   = false;
  let popupWin    = null;

  const liveDot   = document.getElementById('rp-live-dot');
  const npEl      = document.getElementById('rp-np');
  const playBtn   = document.getElementById('rp-play');
  const playIcon  = document.getElementById('rp-play-icon');
  const popupBtn  = document.getElementById('rp-popup-btn');
  const hideBtn   = document.getElementById('rp-hide-btn');

  // ── Icons ────────────────────────────────────────────────────────────────
  const ICON_PLAY   = '<polygon points="5,3 19,12 5,21"/>';
  const ICON_PAUSE  = '<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
  const ICON_SPIN   = '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#0b1422" stroke-width="2.5" stroke-linecap="round" fill="none"/>';

  function setPlayIcon(state) {
    if (state === 'loading') {
      playIcon.innerHTML = ICON_SPIN;
      playIcon.style.animation = 'rp-pulse 0.8s linear infinite';
    } else {
      playIcon.innerHTML = state === 'playing' ? ICON_PAUSE : ICON_PLAY;
      playIcon.style.animation = '';
    }
  }

  function setPlaying(v) {
    isPlaying = v; isLoading = false;
    liveDot.classList.toggle('active', v);
    setPlayIcon(v ? 'playing' : 'stopped');
    playBtn.setAttribute('aria-label', v ? 'Pause' : 'Play');
  }

  // ── Playback ─────────────────────────────────────────────────────────────
  playBtn.addEventListener('click', function () {
    if (isLoading) return;
    if (isPlaying) {
      audio.pause(); audio.src = '';
      setPlaying(false);
    } else {
      isLoading = true;
      setPlayIcon('loading');
      audio.src = STREAM + '?_=' + Date.now();
      audio.volume = 0.8;
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  });
  audio.addEventListener('error', () => setPlaying(false));

  // ── Popup ────────────────────────────────────────────────────────────────
  popupBtn.addEventListener('click', function () {
    if (popupWin && !popupWin.closed) { popupWin.focus(); return; }
    const left = Math.round(screen.width / 2 - POPUP_W / 2);
    const top  = Math.round(screen.height / 2 - POPUP_H / 2);
    popupWin = window.open(
      'player-popup.html',
      'rp_player',
      `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},resizable=no,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );
    // Mettre en pause la barre si le popup prend le relais
    if (isPlaying) { audio.pause(); audio.src = ''; setPlaying(false); }
  });

  // ── Masquer / afficher ───────────────────────────────────────────────────
  hideBtn.addEventListener('click', function () {
    bar.classList.add('hidden');
    setTimeout(() => { showBtn.classList.add('visible'); }, 300);
  });
  showBtn.addEventListener('click', function () {
    bar.classList.remove('hidden');
    showBtn.classList.remove('visible');
  });

  // ── Now playing poll ─────────────────────────────────────────────────────
  async function pollNowPlaying() {
    try {
      const r = await fetch(API);
      if (!r.ok) return;
      const d = await r.json();
      const np   = d.now_playing?.song || {};
      const live = d.live || {};
      const title  = np.title || '';
      const artist = np.artist || '';
      npEl.textContent = live.is_live
        ? (live.streamer_name || 'Radio Ponton') + ' · En direct'
        : artist ? `${artist} — ${title}` : title || 'En direct 24h/24';
    } catch {}
  }
  pollNowPlaying();
  setInterval(pollNowPlaying, 15000);

})();
