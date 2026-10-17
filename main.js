/* ==================================================
   Our Lok'al — shared site behaviour (all pages)
   ================================================== */
(function(){
  /* ---------- NAV / DRAWER ---------- */
  var menuToggle = document.getElementById('menuToggle');
  var drawer = document.getElementById('drawer');
  var drawerClose = document.getElementById('drawerClose');
  if(menuToggle && drawer){
    menuToggle.addEventListener('click', function(){ drawer.classList.add('open'); });
    drawerClose.addEventListener('click', function(){ drawer.classList.remove('open'); });
    drawer.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ drawer.classList.remove('open'); });
    });
  }

  /* ---------- NAV SHADOW ON SCROLL ---------- */
  var nav = document.querySelector('header.nav');
  if(nav){
    var onScrollNav = function(){
      if(window.scrollY > 12){ nav.classList.add('scrolled'); }
      else { nav.classList.remove('scrolled'); }
    };
    window.addEventListener('scroll', onScrollNav, {passive:true});
    onScrollNav();
  }

  /* ---------- HERO VIDEO: graceful fallback ---------- */
  var heroVideo = document.querySelector('.hero-video video');
  var fallbackBg = document.querySelector('.hero-video .fallback-bg');
  if(heroVideo && fallbackBg){
    heroVideo.addEventListener('error', function(){
      heroVideo.style.display = 'none';
      fallbackBg.style.display = 'block';
    });
    // If no playable source resolves quickly, show the fallback too.
    setTimeout(function(){
      if(heroVideo.readyState === 0){
        heroVideo.style.display = 'none';
        fallbackBg.style.display = 'block';
      }
    }, 1800);
  }

  /* ---------- REVEAL ON SCROLL ---------- */
  var revealTargets = document.querySelectorAll('.reveal-up, .reveal-stagger');
  if(revealTargets.length){
    var revealIO = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          en.target.classList.add('in');
          revealIO.unobserve(en.target);
        }
      });
    }, {threshold:0.15, rootMargin:'0px 0px -60px 0px'});
    revealTargets.forEach(function(el){ revealIO.observe(el); });
  }

  /* ---------- CONTACT FORM (client-side only demo) ---------- */
  var contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', function(e){
      e.preventDefault();
      var msg = document.getElementById('contactMsg');
      msg.textContent = "Thanks — we'll get back to you shortly.";
      msg.classList.add('show');
      contactForm.reset();
    });
  }
})();
