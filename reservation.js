/* ==================================================
   Our Lok'al — Reservation page behaviour
   Gate (date/time/guests) -> 3D seat selection
   ================================================== */
(function(){
  var gateForm = document.getElementById('gateForm');
  var gateCard = gateForm;
  var summaryBar = document.getElementById('resSummary');
  var summaryText = document.getElementById('resSummaryText');
  var editBtn = document.getElementById('resEdit');
  var stageWrap = document.getElementById('stageWrap');

  var booking = { date:null, time:null, guests:2 };

  var gateDate = document.getElementById('gDate');
  var gateTime = document.getElementById('gTime');
  var gateGuests = document.getElementById('gGuests');
  var todayStr = new Date().toISOString().slice(0,10);
  gateDate.min = todayStr;
  gateDate.value = todayStr;

  function formatSummary(){
    var d = new Date(booking.date + 'T00:00:00');
    var dateStr = d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
    return dateStr + ' at ' + booking.time + ' \u00b7 ' + booking.guests + (booking.guests === 1 ? ' guest' : ' guests');
  }

  gateForm.addEventListener('submit', function(e){
    e.preventDefault();
    booking.date = gateDate.value;
    booking.time = gateTime.value;
    booking.guests = parseInt(gateGuests.value, 10) || 2;

    gateCard.style.display = 'none';
    summaryText.textContent = formatSummary();
    summaryBar.style.display = 'flex';
    stageWrap.classList.add('unlocked');

    if(!window.__lokalStageStarted){
      window.__lokalStageStarted = true;
      initStage();
    }
    setTimeout(function(){
      stageWrap.scrollIntoView({behavior:'smooth', block:'start'});
    }, 80);
  });

  editBtn.addEventListener('click', function(){
    gateCard.style.display = 'block';
    summaryBar.style.display = 'none';
    stageWrap.classList.remove('unlocked');
    gateCard.scrollIntoView({behavior:'smooth', block:'start'});
  });

  /* ================= 3D SEAT SELECTION ================= */
  function initStage(){
    var stage = document.getElementById('stage');
    var loadingOverlay = document.getElementById('loadingOverlay');
    var panel = document.getElementById('panel');
    var toastEl = document.getElementById('toast');
    var panelMsg = document.getElementById('panelMsg');

    var STORAGE_KEY = 'lokal-reservations-v1';
    function loadReservations(){
      try{
        var raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      }catch(e){ return {}; }
    }
    function saveReservation(tableId, data){
      try{
        var all = loadReservations();
        all[tableId] = data;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }catch(e){ /* storage unavailable, continue without persistence */ }
    }
    var existingReservations = loadReservations();

    var TABLES = [
      {id:'T1', zone:'Window Row', shape:'round', seats:2, x:-11, z:-6, r:0},
      {id:'T2', zone:'Window Row', shape:'round', seats:2, x:-11, z:-1, r:0},
      {id:'T3', zone:'Window Row', shape:'round', seats:4, x:-11, z:4,  r:0, forceReserved:true},
      {id:'T4', zone:'Main Floor', shape:'round', seats:4, x:-3, z:-5, r:0},
      {id:'T5', zone:'Main Floor', shape:'round', seats:4, x:-3, z:1,  r:0},
      {id:'T6', zone:'Main Floor', shape:'rect',  seats:6, x:-3, z:7,  r:0},
      {id:'T7', zone:'Garden Patio', shape:'round', seats:2, x:6, z:-7, r:0},
      {id:'T8', zone:'Garden Patio', shape:'round', seats:4, x:10, z:-3, r:0, forceReserved:true},
      {id:'T9', zone:'Garden Patio', shape:'round', seats:4, x:6, z:2, r:0},
      {id:'T10', zone:'Private Nook', shape:'rect', seats:6, x:9, z:8, r:0.35}
    ];

    var scene, camera, renderer, controls, raycaster, pointer;
    var tableMeshes = [];
    var tablesById = {};
    var canvasEl;
    var selectedId = null;
    var isTweening = false;
    var tweenStart = 0, tweenDur = 700;
    var camFrom = new THREE.Vector3(), camTo = new THREE.Vector3();
    var tgtFrom = new THREE.Vector3(), tgtTo = new THREE.Vector3();
    var overviewCam = new THREE.Vector3(0, 15.5, 17);
    var overviewTarget = new THREE.Vector3(-1, 0, 1);

    var COLORS = { available: 0xB08948, selected: 0x6E7F5C, reserved: 0x9C9488 };

    function boot(){
      scene = new THREE.Scene();
      scene.background = new THREE.Color(getComputedBg());

      var w = stage.clientWidth, h = stage.clientHeight;
      camera = new THREE.PerspectiveCamera(42, w/h, 0.1, 100);
      camera.position.copy(overviewCam);

      renderer = new THREE.WebGLRenderer({antialias:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      canvasEl = renderer.domElement;
      stage.insertBefore(canvasEl, stage.firstChild);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 9;
      controls.maxDistance = 26;
      controls.maxPolarAngle = Math.PI/2 - 0.04;
      controls.minPolarAngle = 0.35;
      controls.target.copy(overviewTarget);
      controls.update();

      var amb = new THREE.AmbientLight(0xfff4e6, 0.75);
      scene.add(amb);
      var dir = new THREE.DirectionalLight(0xfff0dc, 0.9);
      dir.position.set(8, 16, 6);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024,1024);
      dir.shadow.camera.left = -20; dir.shadow.camera.right = 20;
      dir.shadow.camera.top = 20; dir.shadow.camera.bottom = -20;
      scene.add(dir);
      var fill = new THREE.DirectionalLight(0xcdd8ff, 0.25);
      fill.position.set(-10,10,-8);
      scene.add(fill);

      buildFloor();
      buildCounter();
      TABLES.forEach(buildTable);
      buildPlants();

      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();

      canvasEl.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('resize', onResize);
      var ro = new ResizeObserver(onResize);
      ro.observe(stage);

      animate();
      setTimeout(function(){
        loadingOverlay.style.opacity = '0';
        setTimeout(function(){ loadingOverlay.style.display='none'; }, 420);
      }, 350);
    }

    function getComputedBg(){
      var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'light');
      return dark ? 0x171512 : 0xDCE2D2;
    }

    function buildFloor(){
      var floorMat = new THREE.MeshStandardMaterial({color:0xEFE7D6, roughness:0.9});
      var floor = new THREE.Mesh(new THREE.CircleGeometry(17, 48), floorMat);
      floor.rotation.x = -Math.PI/2;
      floor.receiveShadow = true;
      scene.add(floor);

      var ringGeo = new THREE.RingGeometry(16.6, 17, 64);
      var ringMat = new THREE.MeshBasicMaterial({color:0x48543A, transparent:true, opacity:0.25, side:THREE.DoubleSide});
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI/2;
      ring.position.y = 0.01;
      scene.add(ring);
    }

    function buildCounter(){
      var counterMat = new THREE.MeshStandardMaterial({color:0x3E362B, roughness:0.6});
      var counter = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 1.4), counterMat);
      counter.position.set(-3, 0.55, 12.5);
      counter.castShadow = true; counter.receiveShadow = true;
      scene.add(counter);

      var topMat = new THREE.MeshStandardMaterial({color:0xB08948, roughness:0.4});
      var top = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.12, 1.6), topMat);
      top.position.set(-3, 1.16, 12.5);
      top.castShadow = true;
      scene.add(top);

      for(var i=0;i<4;i++){
        var stool = makeStool();
        stool.position.set(-6.5 + i*2.2, 0, 10.9);
        scene.add(stool);
      }
    }

    function makeStool(){
      var g = new THREE.Group();
      var seatMat = new THREE.MeshStandardMaterial({color:0x6E7F5C, roughness:0.7});
      var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.14,20), seatMat);
      seat.position.y = 0.68;
      seat.castShadow = true;
      var legMat = new THREE.MeshStandardMaterial({color:0x2E2A22});
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.68,10), legMat);
      leg.position.y = 0.34;
      g.add(seat, leg);
      return g;
    }

    function buildPlants(){
      var spots = [[-15,-9],[-15,9],[13,-10],[14,10],[0,15.5]];
      spots.forEach(function(p){
        var g = new THREE.Group();
        var potMat = new THREE.MeshStandardMaterial({color:0xC1703C, roughness:0.8});
        var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.32,0.55,16), potMat);
        pot.position.y = 0.275;
        pot.castShadow = true; pot.receiveShadow = true;
        var leafMat = new THREE.MeshStandardMaterial({color:0x6E7F5C, roughness:0.8});
        var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 10), leafMat);
        leaf.scale.set(1,1.3,1);
        leaf.position.y = 1.05;
        leaf.castShadow = true;
        g.add(pot, leaf);
        g.position.set(p[0], 0, p[1]);
        scene.add(g);
      });
    }

    function makeTextSprite(text){
      var cv = document.createElement('canvas');
      var size = 128;
      cv.width = size; cv.height = size/2;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(33,28,21,0.92)';
      roundRect(ctx, 4, 4, size-8, size/2-8, 10);
      ctx.fill();
      ctx.font = '600 34px Inter, sans-serif';
      ctx.fillStyle = '#F6F0E4';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, size/2, size/4 + 2);
      var tex = new THREE.CanvasTexture(cv);
      var mat = new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false});
      var sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.5, 0.75, 1);
      sprite.renderOrder = 10;
      return sprite;
    }
    function roundRect(ctx,x,y,w,h,r){
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.arcTo(x+w,y,x+w,y+h,r);
      ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);
      ctx.arcTo(x,y,x+w,y,r);
      ctx.closePath();
    }

    function statusFor(t){
      if(t.forceReserved) return 'reserved';
      if(existingReservations[t.id]) return 'reserved';
      return 'available';
    }

    function buildTable(t){
      var group = new THREE.Group();
      var status = statusFor(t);
      var mat = new THREE.MeshStandardMaterial({color: COLORS[status], roughness:0.55});
      var top;
      if(t.shape === 'round'){
        var radius = t.seats <= 2 ? 0.65 : 0.85;
        top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.1, 28), mat);
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,0.72,12), new THREE.MeshStandardMaterial({color:0x2E2A22}));
        leg.position.y = 0.36;
        group.add(leg);
        top.position.y = 0.75;
        placeChairsRound(group, radius + 0.55, t.seats);
      } else {
        var wid = t.seats >= 6 ? 2.1 : 1.4;
        top = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.1, 1.0), mat);
        top.rotation.y = t.r || 0;
        var legMat = new THREE.MeshStandardMaterial({color:0x2E2A22});
        [[-wid/2+0.15,-0.35],[wid/2-0.15,-0.35],[-wid/2+0.15,0.35],[wid/2-0.15,0.35]].forEach(function(off){
          var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.72,8), legMat);
          var lx = off[0]*Math.cos(t.r||0) - off[1]*Math.sin(t.r||0);
          var lz = off[0]*Math.sin(t.r||0) + off[1]*Math.cos(t.r||0);
          leg.position.set(lx, 0.36, lz);
          group.add(leg);
        });
        top.position.y = 0.75;
        placeChairsRect(group, wid, 1.0, t.seats, t.r||0);
      }
      top.castShadow = true; top.receiveShadow = true;
      top.userData = {tableId: t.id};
      group.add(top);

      var label = makeTextSprite(t.id);
      label.position.set(0, 1.7, 0);
      group.add(label);

      group.position.set(t.x, 0, t.z);
      scene.add(group);

      tableMeshes.push(top);
      tablesById[t.id] = {def:t, group:group, top:top, label:label, status:status};
    }

    function placeChairsRound(group, dist, seats){
      for(var i=0;i<seats;i++){
        var ang = (i/seats)*Math.PI*2;
        var c = makeChair();
        c.position.set(Math.cos(ang)*dist, 0, Math.sin(ang)*dist);
        c.rotation.y = -ang + Math.PI;
        group.add(c);
      }
    }
    function placeChairsRect(group, w, d, seats, rot){
      var positions = [];
      for(var side=0; side<2; side++){
        var zOff = side===0 ? -(d/2+0.5) : (d/2+0.5);
        var n = side===0 ? Math.ceil(seats/2) : Math.floor(seats/2);
        for(var i=0;i<n;i++){
          var xOff = (i+1)*(w/(n+1)) - w/2;
          positions.push([xOff, zOff, side===0 ? Math.PI : 0]);
        }
      }
      positions.forEach(function(p){
        var c = makeChair();
        var lx = p[0]*Math.cos(rot) - p[1]*Math.sin(rot);
        var lz = p[0]*Math.sin(rot) + p[1]*Math.cos(rot);
        c.position.set(lx, 0, lz);
        c.rotation.y = p[2] + rot;
        group.add(c);
      });
    }
    function makeChair(){
      var g = new THREE.Group();
      var seatMat = new THREE.MeshStandardMaterial({color:0x8B7355, roughness:0.7});
      var seat = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.08,0.42), seatMat);
      seat.position.y = 0.46;
      seat.castShadow = true;
      var back = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.06), seatMat);
      back.position.set(0,0.68,-0.19);
      back.castShadow = true;
      var legMat = new THREE.MeshStandardMaterial({color:0x2E2A22});
      [[-0.17,-0.17],[0.17,-0.17],[-0.17,0.17],[0.17,0.17]].forEach(function(o){
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.46,8), legMat);
        leg.position.set(o[0], 0.23, o[1]);
        g.add(leg);
      });
      g.add(seat, back);
      return g;
    }

    function onResize(){
      if(!renderer) return;
      var w = stage.clientWidth, h = stage.clientHeight;
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    function onPointerDown(e){
      if(isTweening) return;
      var rect = canvasEl.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
      pointer.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(tableMeshes);
      if(hits.length === 0) return;
      var hit = hits[0].object;
      var id = hit.userData.tableId;
      var entry = tablesById[id];
      if(entry.status === 'reserved'){
        showToast('That table is already reserved for this session.');
        return;
      }
      if(entry.def.seats < booking.guests){
        showToast('Table ' + id.replace('T','') + ' seats up to ' + entry.def.seats + ' \u2014 you need room for ' + booking.guests + '.');
        return;
      }
      selectTable(id);
    }

    function selectTable(id){
      if(selectedId && selectedId !== id){ resetTableColor(selectedId); }
      selectedId = id;
      var entry = tablesById[id];
      entry.top.material.color.setHex(COLORS.selected);

      var pos = entry.group.position;
      camFrom.copy(camera.position);
      tgtFrom.copy(controls.target);
      var dir = new THREE.Vector3(pos.x, 0, pos.z).normalize();
      if(dir.length() === 0) dir.set(0,0,1);
      camTo.set(pos.x + dir.x*3.2, 4.6, pos.z + dir.z*3.2 + 2.2);
      tgtTo.set(pos.x, 0.7, pos.z);
      startTween();

      document.getElementById('pName').textContent = 'Table ' + id.replace('T','');
      document.getElementById('pZone').textContent = entry.def.zone + ' \u00b7 Seats ' + entry.def.seats;
      document.getElementById('pBooking').textContent = formatSummary();
      panelMsg.classList.remove('show','ok','err');
      panel.classList.add('open');
    }

    function resetTableColor(id){
      var entry = tablesById[id];
      if(entry && entry.status !== 'reserved'){
        entry.top.material.color.setHex(COLORS.available);
      }
    }

    function deselect(){
      if(selectedId){ resetTableColor(selectedId); }
      selectedId = null;
      panel.classList.remove('open');
      camFrom.copy(camera.position);
      tgtFrom.copy(controls.target);
      camTo.copy(overviewCam);
      tgtTo.copy(overviewTarget);
      startTween();
    }

    function startTween(){
      isTweening = true;
      tweenStart = performance.now();
      controls.enabled = false;
    }
    function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

    function animate(){
      requestAnimationFrame(animate);
      if(isTweening){
        var now = performance.now();
        var p = Math.min(1, (now - tweenStart)/tweenDur);
        var e = easeInOutCubic(p);
        camera.position.lerpVectors(camFrom, camTo, e);
        controls.target.lerpVectors(tgtFrom, tgtTo, e);
        if(p >= 1){ isTweening = false; controls.enabled = true; }
      }
      controls.update();
      renderer.render(scene, camera);
    }

    function showToast(msg){
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      setTimeout(function(){ toastEl.classList.remove('show'); }, 2400);
    }

    document.getElementById('panelClose').addEventListener('click', deselect);

    document.getElementById('confirmBtn').addEventListener('click', function(){
      if(!selectedId) return;
      var name = document.getElementById('rName').value.trim();
      if(!name){
        panelMsg.textContent = 'Please add your name to confirm.';
        panelMsg.className = 'panel-msg show err';
        return;
      }
      var entry = tablesById[selectedId];
      var data = {
        date: booking.date, time: booking.time, party: booking.guests,
        name: name, email: document.getElementById('rEmail').value.trim()
      };
      saveReservation(selectedId, data);
      existingReservations[selectedId] = data;
      entry.status = 'reserved';
      entry.top.material.color.setHex(COLORS.reserved);
      panelMsg.textContent = "You're booked, " + name.split(' ')[0] + " \u2014 see you at Our Lok'al!";
      panelMsg.className = 'panel-msg show ok';
      setTimeout(function(){ deselect(); }, 1800);
    });

    document.getElementById('fsBtn').addEventListener('click', function(){
      try{
        if(!document.fullscreenElement){ stage.requestFullscreen && stage.requestFullscreen(); }
        else { document.exitFullscreen && document.exitFullscreen(); }
      }catch(e){}
    });

    boot();
  }
})();
