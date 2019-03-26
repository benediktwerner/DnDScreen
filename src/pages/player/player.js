'use strict';

const $ = q => document.querySelector(q);
const $$ = q => document.querySelectorAll(q);

Element.prototype.$ = function(cls) {
  return this.getElementsByClassName(cls)[0];
};

function toInt(val) {
  const result = parseInt(val);
  if (isNaN(result)) return 0;
  return result;
}

///////////////
///////////////
// Websocket //
///////////////
///////////////

const ws = new WebSocket('ws://' + window.location.host + '/player_socket');

ws.onopen = function() {
  ws.send('init');
};

ws.onmessage = function(e) {
  const { data, type } = JSON.parse(e.data);

  if (type === 'msg') {
    alert(data);
  } else if (type === 'data') {
    if (data.players) {
      for (const i of [0, 1, 2]) {
        const p = data.players[i];
        const pEl = $('#player-' + i);

        if (p === undefined) {
          pEl.classList.add('hidden');
          continue;
        }

        pEl.classList.remove('hidden');
        for (const key in p) {
          if (key === 'cls') continue;
          const el = pEl.$(key);
          if (!el.classList.contains('currency')) el.innerText = p[key];
        }
      }
    }
    if (data.map) {
      updateMapData(data.map);
    }
    if (data.initiative) {
      $$('.initiative-bar .initiative-cell').forEach(el => el.remove());
      const template = $('#initiative-cell-template');

      for (const unit of data.initiative.units) {
        const newEl = template.content.cloneNode(true);
        newEl.firstElementChild.$('name').innerText = unit.name;
        newEl.firstElementChild.$('initiative').innerText = unit.initiative;
        $('.initiative-bar').appendChild(newEl);
      }

      const activeIndex = data.initiative.activeIndex + 1;
      $(`.initiative-bar .initiative-cell:nth-child(${activeIndex})`).classList.add('active');
    }
  } else if (type === 'reward') {
    if (data.xp > 0) {
      showRewardXpDialog(data.xp);
    } else {
      delete data.xp;
      showRewardMoneyDialog(data);
    }
  } else if (type === 'initiative-index') {
    $$('.initiative-bar .initiative-cell').forEach(el => el.classList.remove('active'));
    $(`.initiative-bar .initiative-cell:nth-child(${data + 1})`).classList.add('active');
  } else {
    alert(`Invalid message type: ${type}\n${JSON.stringify(data)}`);
  }
};

function send(type, data) {
  if (data === undefined) {
    ws.send(type);
  } else {
    const msg = '!' + JSON.stringify({ type, data });
    console.log('Sending: ' + msg);
    ws.send(msg);
  }
}

/////////////
/////////////
// Players //
/////////////
/////////////

let playerDrag = null;

function getNum(classList) {
  for (const cls of classList) {
    if (cls === 'one' || cls === 'two' || cls === 'three') return cls;
  }
  return null;
}

function handlePlayerDragStart(e) {
  this.style.opacity = 0.4;
  playerDrag = this;
  e.dataTransfer.effectAllowed = 'move';
}

function handlePlayerDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }

  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handlePlayerDragEnter() {
  this.entercounter += 1;
  this.classList.add('dragover');
}

function handlePlayerDragLeave() {
  this.entercounter -= 1;
  if (this.entercounter <= 0) {
    this.classList.remove('dragover');
  }
}

function handlePlayerDrop(e) {
  if (e.stopPropagation) e.stopPropagation();
  if (this != playerDrag) {
    const cls1 = getNum(this.classList);
    const cls2 = getNum(playerDrag.classList);
    this.classList.remove(cls1);
    this.classList.add(cls2);
    playerDrag.classList.remove(cls2);
    playerDrag.classList.add(cls1);
  }

  return false;
}

function handlePlayerDragEnd() {
  this.style.opacity = 1;
  $$('.player').forEach(p => {
    p.classList.remove('dragover');
    p.entercounter = 0;
  });
}

/////////////
/////////////
// Effects //
/////////////
/////////////

const PARTICLE_XP = 1;
const PARTICLE_MONEY = 2;
let effectsCanvas;
let effectsCtx;
let particles;
let alive;
let time;
let particlesPerKey;
let particlesArrived;
let originalVals;
let additionalVals;
let playerCount;
let targets;
let particleType;

const DIFFS = [[-1, 0], [1, 0], [0, 0], [0, 1], [0, -1]];

class Particle {
  constructor(x, y, dest, center, img = null) {
    this.x = x;
    this.y = y;
    this.img = img;

    if (center === null) {
      this.vx = Math.random() * 2 - 1;
      this.vy = Math.random() * 2 - 1;
    } else {
      const xdiff = x - center.x;
      const ydiff = y - center.y;
      this.vx = Math.sign(xdiff) * (Math.log((Math.abs(xdiff) + 1) / 5) * Math.random());
      this.vy = Math.sign(ydiff) * (Math.log((Math.abs(ydiff) + 1) / 5) * Math.random());
    }
    this.friction = Math.random() * 0.05 + 0.95;

    this.alive = true;
    this.dest = dest;
  }

  render(imageData) {
    if (!this.alive) return false;

    const [x1, y1, x2, y2, p, key] = this.dest;
    let diffX, diffY;

    if (this.img === null) {
      for (const [xd, yd] of DIFFS) {
        const pos = (~~this.x + xd + (~~this.y + yd) * imageData.width) * 4;
        const w = xd === 0 && yd === 0 ? 1 : Math.exp(time / 100) - 1;
        imageData.data[pos] += 0x58 * w;
        imageData.data[pos + 1] += 0x18 * w;
        imageData.data[pos + 2] += 0x0d * w;
        imageData.data[pos + 3] = 0xff;
      }

      diffX = (x1 + x2) / 2 - this.x;
      diffY = (y1 + y2) / 2 - this.y;
    } else {
      const size = Math.max(-(15 / 50) * time + 40, 25);
      effectsCtx.drawImage(this.img, this.x, this.y, size, size);

      diffX = x1 - this.x;
      diffY = y1 - this.y;
    }

    const ampl = Math.sqrt(diffX * diffX + diffY * diffY);
    const speed = time / 4;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx + (ampl > 0 ? diffX * (speed / ampl) : 0);
    this.y += this.vy + (ampl > 0 ? diffY * (speed / ampl) : 0);

    if (x1 - 5 <= this.x && this.x <= x2 && y1 - 5 <= this.y && this.y <= y2) {
      particlesArrived[p][key]++;
      return (this.alive = false);
    }

    return true;
  }
}

function render() {
  if (alive) requestAnimationFrame(render);
  else ws.send('update');

  alive = false;

  effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
  const imageData = effectsCtx.getImageData(0, 0, effectsCanvas.width, effectsCanvas.height);

  for (const p of particles) {
    if (p.render(imageData)) alive = true;
  }

  if (particleType === PARTICLE_XP) effectsCtx.putImageData(imageData, 0, 0);
  time += 1;

  if (time > 500) {
    alive = false;
    effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
  }

  for (let i = 0; i < playerCount; i++) {
    for (const key in particlesArrived[i]) {
      if (additionalVals[key] <= 0) continue;

      const arrivedPercent = particlesArrived[i][key] / particlesPerKey[i][key];
      const arrivedVals = Math.ceil(additionalVals[key] * arrivedPercent * 1.1);

      if (key === 'xp')
        $$('.player .xp')[i].innerText =
          originalVals[i][key] + Math.min(additionalVals[key], arrivedVals);
      else {
        $$('.player td.' + key)[i].innerText =
          originalVals[i][key] + Math.min(additionalVals[key], arrivedVals);
      }
    }
  }
}

function getBaselinePadding(e) {
  e.style['verticalAlign'] = 'text-top';
  const y1 = e.getBoundingClientRect().y;
  e.style['verticalAlign'] = 'text-bottom';
  const y2 = e.getBoundingClientRect().y;
  e.style['verticalAlign'] = '';
  return y1 - y2;
}

function showXpParticles(xpAmount) {
  playerCount = $$('.player:not(.hidden)').length;
  particles = [];

  effectsCanvas.width = window.innerWidth;
  effectsCanvas.height = window.innerHeight;

  effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
  effectsCtx.font = '4rem Requiem';
  effectsCtx.textAlign = 'center';

  const baselinePadding = getBaselinePadding($('.dialog .xp'));
  particlesPerKey = [];

  for (let p = 0; p < playerCount; p++) {
    let rect = $$('.dialog .xp')[p].getBoundingClientRect();
    const x = Math.floor(rect.x);
    const y = Math.floor(rect.y);
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    effectsCtx.save();
    if (p === 0) effectsCtx.translate(x + width / 2, y + height - baselinePadding);
    else if (p === 1) effectsCtx.translate(x + width - baselinePadding, y + height / 2);
    else effectsCtx.translate(x + width / 2, y + baselinePadding);
    effectsCtx.rotate((-p * Math.PI) / 2);

    effectsCtx.fillText(xpAmount, 0, 0);
    effectsCtx.restore();

    const data = effectsCtx.getImageData(x, y, width, height).data;
    effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);

    const targetRect = $$('.player .xp')[p].getBoundingClientRect();
    const dest = [
      targetRect.x,
      targetRect.y,
      targetRect.x + targetRect.width,
      targetRect.y + targetRect.height,
      p,
      'xp',
    ];
    const center = { x: x + width / 2, y: y + height / 2 };
    let count = 0;

    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        if (data[(i + j * width) * 4 + 3] > 150) {
          particles.push(new Particle(x + i, y + j, dest, center));
          count++;
        }
      }
    }
    particlesPerKey.push({ xp: count });
  }

  originalVals = [];
  additionalVals = { xp: xpAmount };
  particlesArrived = [];
  for (let p = 0; p < playerCount; p++) {
    originalVals.push({ xp: toInt($$('.players .xp')[p].innerText) });
    particlesArrived.push({ xp: 0 });
  }

  time = 0;
  alive = true;
  particleType = PARTICLE_XP;

  requestAnimationFrame(render);
}

function showMoneyParticles(money) {
  playerCount = $$('.player:not(.hidden)').length;
  particles = [];

  effectsCanvas.width = window.innerWidth;
  effectsCanvas.height = window.innerHeight;
  particlesPerKey = [];

  for (let p = 0; p < playerCount; p++) {
    let perKeyCount = {};
    for (const key in money) {
      if (money[key] <= 0) continue;

      const originEl = $$('.dialog th .' + key)[p];
      const { x, y } = originEl.getBoundingClientRect();
      const targetRect = $$('.player th .' + key)[p].getBoundingClientRect();
      const dest = [
        targetRect.x,
        targetRect.y,
        targetRect.x + targetRect.width,
        targetRect.y + targetRect.height,
        p,
        key,
      ];

      const num = Math.min(money[key], 1000);
      perKeyCount[key] = num;
      for (let i = 0; i < num; i++) {
        particles.push(new Particle(x, y, dest, null, originEl));
      }
    }
    particlesPerKey.push(perKeyCount);
  }

  originalVals = [];
  additionalVals = money;
  particlesArrived = [];
  for (let i = 0; i < playerCount; i++) {
    const vals = {};
    const arrived = {};
    for (const key in money) {
      vals[key] = toInt($$('.player')[i].$(key).innerText);
      arrived[key] = 0;
    }
    originalVals.push(vals);
    particlesArrived.push(arrived);
  }

  time = 0;
  alive = true;
  particleType = PARTICLE_MONEY;

  requestAnimationFrame(render);
}

let dialog_backdrop;
let onDialogClose = null;
let isAnimatingDialog = false;

function showDialog(name) {
  $$('.dialog').forEach(dialog => {
    for (const child of Array.from(dialog.children)) {
      dialog.removeChild(child);
    }

    const template = $('#' + name + '-dialog-template');
    if (template === null) {
      console.error(
        `No template for '${name}' dialog. It should be called ${name}-dialog-template.`
      );
      return;
    }

    dialog.appendChild(template.content.cloneNode(true));
  });
  $('.dialog-backdrop').classList.remove('hidden');
  isAnimatingDialog = true;
  setTimeout(() => (isAnimatingDialog = false), 1000);
}

function closeDialog() {
  if (isAnimatingDialog) return;
  $('.dialog-backdrop').classList.add('hidden');
  if (onDialogClose !== null) {
    onDialogClose();
  }
}

function showRewardXpDialog(xp) {
  showDialog('xp-reward');
  $$('.dialog .xp').forEach(el => (el.innerText = xp));
  onDialogClose = () => showXpParticles(xp);
}

function showRewardMoneyDialog(money) {
  showDialog('money-reward');
  for (const key in money) {
    if (money[key] > 0) {
      $$('.dialog td.' + key).forEach(el => (el.innerText = money[key]));
    } else {
      $$('.dialog td.' + key).forEach(el => el.remove());
      $$('.dialog th .' + key).forEach(el => el.parentElement.remove());
    }
  }
  onDialogClose = () => showMoneyParticles(money);
}

/////////
/////////
// Map //
/////////
/////////

const TWO_PI = Math.PI * 2;

let mapCanvas;
let mapCtx;
let visibilityCanvas;
let visibilityCtx;
let dragging = false;
let last_x = 0;
let last_y = 0;
let last_touches;
let selected_unit = -1;
let map = {
  bg_image: new Image(),
  offset_x: 0,
  offset_y: 0,
  zoom: 1,
  grid_size: 20,
  grid_x: 0,
  grid_y: 0,
  grid_opacity: 20,
  lines: [],
  units: [],
  visible_areas: [],
};

function updateMapData(data) {
  map.lines = data.lines;
  map.units = data.units;
  map.bg_image.src = data.bg_image;
  map.grid_size = data.grid_size;
  map.grid_x = data.grid_x;
  map.grid_y = data.grid_y;
  map.visible_areas = data.visible_areas;
  requestAnimationFrame(renderMap);
}

function drawLine(x1, y1, x2, y2) {
  mapCtx.moveTo(x1, y1);
  mapCtx.lineTo(x2, y2);
}

function drawLines() {
  mapCtx.beginPath();
  for (let line of map.lines) {
    drawLine(...line);
  }
  mapCtx.lineWidth = 2;
  mapCtx.stroke();
  mapCtx.lineWidth = 1;
}

function drawGrid() {
  const SIZE = map.grid_size;
  const SIZE_ZOOM = SIZE * map.zoom;
  const NUM_X = Math.ceil(mapCanvas.width / SIZE_ZOOM) + 2;
  const NUM_Y = Math.ceil(mapCanvas.height / SIZE_ZOOM) + 2;

  mapCtx.save();
  mapCtx.resetTransform();
  mapCtx.translate((map.offset_x % SIZE_ZOOM) - SIZE_ZOOM, (map.offset_y % SIZE_ZOOM) - SIZE_ZOOM);
  mapCtx.scale(map.zoom, map.zoom);

  mapCtx.beginPath();
  for (let i = 1; i < NUM_X; i++) drawLine(i * SIZE, 0, i * SIZE, NUM_Y * SIZE);
  for (let i = 1; i < NUM_Y; i++) drawLine(0, i * SIZE, NUM_X * SIZE, i * SIZE);
  mapCtx.strokeStyle = `rgba(0,0,0,${map.grid_opacity / 100})`;
  mapCtx.stroke();
  mapCtx.restore();
}

function fillCircle(x, y, r, color = null) {
  mapCtx.beginPath();
  mapCtx.arc(x, y, r, 0, TWO_PI);
  if (color !== null) mapCtx.fillStyle = color;
  mapCtx.fill();
}

function drawUnit(unit) {
  const x = (unit.x + unit.size / 2) * map.grid_size;
  const y = (unit.y + unit.size / 2) * map.grid_size;
  const r = (unit.size * map.grid_size) / 2.5;

  fillCircle(x, y, r, unit.color);

  if (unit.symbol) {
    const font_size = (12 * unit.size * map.grid_size) / 20;
    mapCtx.fillStyle = 'white';
    mapCtx.textAlign = 'center';
    mapCtx.font = font_size + 'px sans-serif';
    mapCtx.fillText(unit.symbol, x, y + 0.37 * font_size);
  }
}

function drawUnits() {
  if (selected_unit >= 0 && selected_unit < map.units.length) {
    const unit = map.units[selected_unit];
    const ring_size = Math.log2(unit.size + 1) * 0.5;
    drawUnit({
      x: unit.x - ring_size / 2,
      y: unit.y - ring_size / 2,
      size: unit.size + ring_size,
      color: 'gold',
    });
  }

  for (const unit of map.units) drawUnit(unit);
}

function to_canvas_x(x) {
  return (x - map.offset_x) / map.zoom;
}

function to_canvas_y(y) {
  return (y - map.offset_y) / map.zoom;
}

function renderMap() {
  mapCtx.save();
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.translate(map.offset_x, map.offset_y);
  mapCtx.scale(map.zoom, map.zoom);

  if (map.bg_image.src !== null) {
    mapCtx.drawImage(map.bg_image, 0, 0);
  }
  drawLines();
  drawGrid();
  drawUnits();
  mapCtx.restore();

  if (map.visible_areas.length > 0) {
    visibilityCtx.clearRect(0, 0, visibilityCanvas.width, visibilityCanvas.height);

    visibilityCtx.save();
    visibilityCtx.translate(map.offset_x, map.offset_y);
    visibilityCtx.scale(map.zoom, map.zoom);
    for (const area of map.visible_areas) {
      visibilityCtx.fillRect(...area);
    }
    visibilityCtx.restore();

    mapCtx.globalCompositeOperation = 'destination-in';
    mapCtx.drawImage(visibilityCanvas, 0, 0);
    mapCtx.globalCompositeOperation = 'source-over';
  }
}

function canvas_mousedown(event) {
  dragging = true;
  last_x = event.pageX || event.touches[0].pageX;
  last_y = event.pageY || event.touches[0].pageY;
  last_touches = event.touches;
}

function canvas_mouseup(event) {
  dragging = false;
}

function canvas_click(event) {
  const x = Math.floor(to_canvas_x(event.offsetX) / map.grid_size);
  const y = Math.floor(to_canvas_y(event.offsetY) / map.grid_size);
  let new_selection = -1;

  for (const i in map.units) {
    const unit = map.units[i];
    if (unit.x <= x && x < unit.x + unit.size && unit.y <= y && y < unit.y + unit.size) {
      new_selection = +i;
      break;
    }
  }
  if (new_selection === -1) {
    if (selected_unit >= 0 && selected_unit < map.units.length) {
      map.units[selected_unit].x = x;
      map.units[selected_unit].y = y;
      send('move-unit', { unit: selected_unit, x: x, y: y });
    }
    selected_unit = -1;
  } else {
    selected_unit = new_selection === selected_unit ? -1 : new_selection;
  }
  requestAnimationFrame(renderMap);
}

function canvas_mousemove(event) {
  if (!dragging) return;
  event.preventDefault();

  let new_x = last_x,
    new_y = last_y;

  if (event.type === 'touchmove') {
    if (last_touches && last_touches.length === 2 && event.touches.length === 2) {
      const last_diff_x = last_touches[0].pageX - last_touches[1].pageX;
      const last_diff_y = last_touches[0].pageY - last_touches[1].pageY;
      const last_diff = Math.sqrt(last_diff_x * last_diff_x + last_diff_y * last_diff_y);
      last_x = (last_touches[0].pageX + last_touches[1].pageX) / 2;
      last_y = (last_touches[0].pageY + last_touches[1].pageY) / 2;

      const curr_diff_x = event.touches[0].pageX - event.touches[1].pageX;
      const curr_diff_y = event.touches[0].pageY - event.touches[1].pageY;
      const curr_diff = Math.sqrt(curr_diff_x * curr_diff_x + curr_diff_y * curr_diff_y);
      new_x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
      new_y = (event.touches[0].pageY + event.touches[1].pageY) / 2;

      const zoom_change = Math.pow(curr_diff / last_diff, 2);
      map.zoom *= zoom_change;

      map.offset_x -=
        ((new_x - mapCanvas.offsetLeft - map.offset_x) * (zoom_change - 1)) / zoom_change;
      map.offset_y -=
        ((new_y - mapCanvas.offsetTop - map.offset_y) * (zoom_change - 1)) / zoom_change;
    } else {
      new_x = event.touches[0].pageX;
      new_y = event.touches[0].pageY;
    }
    last_touches = event.touches;
  } else {
    new_x = event.pageX;
    new_y = event.pageY;
  }
  map.offset_x += new_x - last_x;
  map.offset_y += new_y - last_y;
  last_x = new_x;
  last_y = new_y;

  requestAnimationFrame(renderMap);
}

function canvas_keyup(event) {
  event.preventDefault();
  if (event.key === 'r') {
    map.offset_x = 0;
    map.offset_y = 0;
    map.zoom = 1;
  }
  requestAnimationFrame(renderMap);
}

/////////////////////
/////////////////////
// Event Listeners //
/////////////////////
/////////////////////

document.addEventListener('DOMContentLoaded', function() {
  $$('.player').forEach(p => {
    p.entercounter = 0;
    p.addEventListener('dragstart', handlePlayerDragStart, false);
    p.addEventListener('dragover', handlePlayerDragOver, false);
    p.addEventListener('dragenter', handlePlayerDragEnter, false);
    p.addEventListener('dragleave', handlePlayerDragLeave, false);
    p.addEventListener('drop', handlePlayerDrop, false);
    p.addEventListener('dragend', handlePlayerDragEnd, false);
  });

  dialog_backdrop = $('.dialog-backdrop');
  dialog_backdrop.addEventListener('click', function(e) {
    if (e.target === dialog_backdrop) closeDialog();
  });

  effectsCanvas = $('#effects');
  effectsCtx = effectsCanvas.getContext('2d');

  mapCanvas = $('#map');
  mapCtx = mapCanvas.getContext('2d');
  visibilityCanvas = document.createElement('canvas');
  visibilityCtx = visibilityCanvas.getContext('2d');

  const { width, height } = mapCanvas.getBoundingClientRect();
  mapCanvas.width = width;
  mapCanvas.height = height;
  visibilityCanvas.width = width;
  visibilityCanvas.height = height;

  mapCanvas.addEventListener('mousedown', canvas_mousedown);
  mapCanvas.addEventListener('touchstart', canvas_mousedown);
  mapCanvas.addEventListener('mouseup', canvas_mouseup);
  mapCanvas.addEventListener('touchend', canvas_mouseup);
  mapCanvas.addEventListener('mousemove', canvas_mousemove);
  mapCanvas.addEventListener('touchmove', canvas_mousemove);
  mapCanvas.addEventListener('click', canvas_click);
  window.addEventListener('keyup', canvas_keyup);

  $('#grid-opacity').addEventListener('input', e => {
    map.grid_opacity = toInt(e.target.value);
    requestAnimationFrame(renderMap);
  });

  if (window.navigator.standalone) {
    $('button.fullscreen').hidden = true;
    $('button.reload').hidden = false;
    $('button.reload').addEventListener('click', () => {
      location.reload();
    });
  } else {
    $('button.fullscreen').addEventListener('click', () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.cancelFullScreen) document.cancelFullScreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitCancelFullScreen) document.webkitCancelFullScreen();
      } else {
        const el = document.documentElement;
        if (el.requestFullscreen) e.requestFullscreen();
        else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      }
    });
  }

  map.bg_image.onload = () => requestAnimationFrame(renderMap);
});
