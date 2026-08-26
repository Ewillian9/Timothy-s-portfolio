document.addEventListener('DOMContentLoaded', () => {
  const track = document.querySelector('.carousel-track');
  const slides = document.querySelectorAll('.carousel-slide');
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');
  const dotsContainer = document.querySelector('.carousel-dots');
  if (!track || !slides.length) return;

  let current = 0;
  const total = slides.length;

  const platformsData = [
    {
      label: 'Stream Arctic Eyes on',
      links: [
        { href: 'https://open.spotify.com/track/0f858Tv5lqvBkJzZuuSHed', icon: 'assets/icons/spotify.svg', alt: 'Spotify' },
        { href: 'https://music.apple.com/us/song/arctic-eyes/6789503937', icon: 'assets/icons/apple-music.svg', alt: 'Apple Music' },
        { href: 'https://music.youtube.com/watch?v=OPV2sNcmSuc&list=OLAK5uy_lqWewJAYblczilDdoKp_6btmX5j7UQv1s', icon: 'assets/icons/youtube-music.svg', alt: 'YouTube Music' },
        { href: 'https://music.amazon.com/albums/B0H8D2GTXM', icon: 'assets/icons/amazon-music.svg', alt: 'Amazon Music' },
        { href: 'https://tidal.com/album/541878355', icon: 'assets/icons/tidal.svg', alt: 'Tidal' },
      ]
    },
    {
      label: 'Stream Akaalaye on',
      links: [
        { href: 'https://open.spotify.com/album/3Wz6p7cQdFck6ID5VZJcHZ', icon: 'assets/icons/spotify.svg', alt: 'Spotify' },
        { href: 'https://music.apple.com/us/album/akaalaye-single/1843887424', icon: 'assets/icons/apple-music.svg', alt: 'Apple Music' },
        { href: 'https://music.youtube.com/watch?v=cNU_81ld8Rc', icon: 'assets/icons/youtube-music.svg', alt: 'YouTube Music' },
        { href: 'https://music.amazon.com/albums/B0FTT4D9JB', icon: 'assets/icons/amazon-music.svg', alt: 'Amazon Music' },
        { href: 'https://soundcloud.com/isaactimothy/akaalaye', icon: 'assets/icons/soundcloud.svg', alt: 'SoundCloud' },
        { href: 'https://www.deezer.com/us/album/831969221', icon: 'assets/icons/deezer.svg', alt: 'Deezer' },
        { href: 'https://tidal.com/album/464686077', icon: 'assets/icons/tidal.svg', alt: 'Tidal' },
      ]
    },
    {
      label: 'Watch on',
      links: [
        { href: 'https://www.youtube.com/watch?v=KHES7V8NitE&t=761s', icon: 'assets/icons/youtube.svg', alt: 'YouTube' },
      ]
    },
    {
      label: 'Watch on',
      links: [
        { href: 'https://www.youtube.com/watch?v=lJmENTzfmZc&t=645s', icon: 'assets/icons/youtube.svg', alt: 'YouTube' },
      ]
    },
    {
      label: 'Watch on',
      links: [
        { href: 'https://www.youtube.com/watch?v=0uJ6y27soEI&t=122s', icon: 'assets/icons/youtube.svg', alt: 'YouTube' },
      ]
    },
  ];

  const platformsLabel = document.getElementById('carousel-platforms-label');
  const platformsLogos = document.getElementById('carousel-platforms-logos');

  function renderPlatforms(index) {
    if (!platformsLabel || !platformsLogos) return;
    const data = platformsData[index];
    if (!data) return;
    platformsLabel.textContent = data.label;
    platformsLogos.innerHTML = data.links.map(l => `<a href="${l.href}" target="_blank" aria-label="${l.alt}"><img src="${l.icon}" alt="${l.alt}"></a>`).join('');
  }

  // create dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' is-active' : '');
    dot.setAttribute('aria-label', `Go to video ${i + 1}`);
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });
  const dots = document.querySelectorAll('.carousel-dot');

  function update() {
    track.style.transform = `translateX(-${current * 100}%)`;
    slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
    dots.forEach((d, i) => {
      d.classList.toggle('is-active', i === current);
      d.setAttribute('aria-selected', i === current ? 'true' : 'false');
    });
    renderPlatforms(current);
  }

  function goTo(index) {
    current = (index + total) % total;
    update();
  }

  update();

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  // swipe support
  let startX = 0;
  let isDragging = false;
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  });
  track.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goTo(current - 1);
      else goTo(current + 1);
    }
    isDragging = false;
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });
});
