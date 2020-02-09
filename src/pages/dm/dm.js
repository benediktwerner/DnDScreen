'use strict';

const $ = q => document.querySelector(q);
const $$ = q => document.querySelectorAll(q);

Element.prototype.$ = function(cls) {
  return this.getElementsByClassName(cls)[0];
};

CanvasRenderingContext2D.prototype.fillCircle = function(x, y, r, color = null) {
  this.beginPath();
  this.arc(x, y, r, 0, TWO_PI);
  if (color !== null) this.fillStyle = color;
  this.fill();
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

let ws;

function openWebsocket() {
  ws = new WebSocket(`ws://${window.location.host}/dm_socket`);

  ws.onopen = onWebsocketInit;
  ws.onclose = () => addMessage('WebSocket closed');
  ws.onmessage = onWebsocketMessage;
}

function onWebsocketInit() {
  send('init');
}

function onWebsocketMessage(e) {
  const { data, type } = JSON.parse(e.data);

  if (type === 'msg') {
    addMessage(data);
  } else if (type === 'data') {
    if (data.players) {
      let money = { copper: 0, silver: 0, gold: 0, electrum: 0, platin: 0 };

      $$('.player').forEach(p => p.remove());
      const playerTemplate = $('#player-template').content;
      for (const i in data.players) {
        const p = data.players[i];

        const newPlayer = playerTemplate.cloneNode(true);
        const node = newPlayer.firstElementChild;
        node.id = 'player-' + i;

        for (const key in p) {
          node.$(key).innerText = p[key];
          if (key in money) money[key] += p[key];
        }

        $('.players').appendChild(newPlayer);
      }

      for (const key in money) {
        $('.total').$(key).innerText = money[key];
      }
    }
    if (data.map_images) {
      $$('#map-bg option:not(.default)').forEach(el => el.remove());

      for (let bg of data.map_images) {
        const el = document.createElement('option');
        el.value = '/img/maps/' + bg;
        el.innerText = bg
          .split('.')
          .slice(0, -1)
          .join(' ');
        $('#map-bg').appendChild(el);
      }
    }
    if (data.map) {
      map.lines = data.map.lines;
      map.bg_image.src = data.map.bg_image;
      map.grid_size = data.map.grid_size;
      map.grid_x = data.map.grid_x;
      map.grid_y = data.map.grid_y;
      map.units = data.map.units;
      map.visible_areas = data.map.visible_areas;
      $('#map-bg').value = data.map.bg_image;
      $('#grid-size').value = map.grid_size;
      $('#grid-x').value = map.grid_x;
      $('#grid-y').value = map.grid_y;
      requestAnimationFrame(renderMap);
    }
    if (data.maps) {
      maps = data.maps;
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
      const activeUnit = $(`.initiative-bar .initiative-cell:nth-child(${activeIndex})`);
      if (activeUnit) activeUnit.classList.add('active');
    }
    closeDialog();
  } else if (type === 'initiative-index') {
    $$('.initiative-bar .initiative-cell').forEach(el => el.classList.remove('active'));
    $(`.initiative-bar .initiative-cell:nth-child(${data + 1})`).classList.add('active');
  }
}

function send(type, data) {
  if (ws.readyState !== WebSocket.OPEN) {
    addMessage('WebSocket ist geschlossen');
    return;
  }
  if (data === undefined) {
    ws.send(type);
  } else {
    const msg = '!' + JSON.stringify({ type, data });
    console.log('Sending: ' + msg);
    ws.send(msg);
  }
}

function send_map(bg_image_url) {
  const data = {
    bg_dm_only: map.bg_dm_only,
    lines: map.lines,
    grid_size: map.grid_size,
    grid_x: map.grid_x,
    grid_y: map.grid_y,
    units: map.units,
    visible_areas: map.visible_areas,
  };
  if (bg_image_url) data.bg_image = bg_image_url;
  send('update-map', data);
}

function addMessage(msg) {
  const newMessage = document.createElement('div');
  newMessage.innerText = msg;
  $('.messages-container').appendChild(newMessage);
  $('.messages-container').scrollTop = $('.messages-container').scrollHeight;
  $('.messages button').hidden = false;
}

function clearMessages() {
  $$('.messages-container div').forEach(e => e.remove());
  $('.messages button').hidden = true;
}

////////////
////////////
// Dialog //
////////////
////////////

let dialog_backdrop;

function showDialog(name) {
  const content = $('.dialog');
  for (const child of Array.from(content.children)) {
    content.removeChild(child);
  }

  const template = $('#' + name + '-dialog-template');
  if (template === null) {
    console.error(`No template for '${name}' dialog. It should be called ${name}-dialog-template.`);
    return;
  }

  content.appendChild(template.content.cloneNode(true));
  $('.dialog-backdrop').classList.remove('hidden');
}

function closeDialog() {
  $('.dialog-backdrop').classList.add('hidden');
}

function addPlayer() {
  let data = {
    name: $('.dialog #name').value,
    cls: $('.dialog #cls').value,
    xp: toInt($('.dialog #xp').value),
  };
  closeDialog();
  send('add-player', data);
}

function updatePlayer() {
  const keys = [
    'hp',
    'hp_total',
    'hitdice',
    'hitdice_total',
    'passive_perception',
    'copper',
    'silver',
    'gold',
    'electrum',
    'platin',
  ];
  let values = {};
  for (const key of keys) {
    values[key] = toInt($('.dialog .total').$(key).value);
  }

  values.xp = toInt($('.dialog #xp').value);
  values.name = $('.dialog #name').value;
  values.cls = $('.dialog #cls').value;

  let data = {
    id: toInt(
      $('.dialog .player-id')
        .value.match(/\d+/g)
        .join('')
    ),
    values,
  };
  closeDialog();
  send('update-player', data);
}

function onPlayerDialogChange(e) {
  const row = e.target.closest('tr').classList[0];
  const key = e.target.classList[0];
  const val = toInt(e.target.value);
  const currVal = toInt($('.dialog .current').$(key).innerText);

  if (row === 'diff') {
    $('.dialog .total').$(key).value = currVal + val;
  } else {
    $('.dialog .diff').$(key).value = val - currVal;
  }
}

function showPlayerDialog(e) {
  const target = e.target.closest('.player');
  showDialog('player');

  $('.dialog .player-id').value = target.id;

  $('.dialog #name').value = target.$('name').innerText;
  $('.dialog #cls').value = target.$('cls').innerText;
  $('.dialog #xp').value = target.$('xp').innerText;

  const keys = [
    'hp',
    'hp_total',
    'hitdice',
    'hitdice_total',
    'passive_perception',
    'copper',
    'silver',
    'gold',
    'electrum',
    'platin',
  ];
  for (const key of keys) {
    const val = toInt(target.$(key).innerText);
    $('.dialog .current').$(key).innerText = val;
    $('.dialog .total').$(key).value = val;
  }

  $$('.dialog table input').forEach(e => {
    e.addEventListener('change', onPlayerDialogChange);
    e.addEventListener('click', e => e.target.select());
  });
}

function giveReward() {
  const values = {};
  $$('.dialog .per-person input').forEach(e => (values[e.classList[0]] = toInt(e.value)));
  closeDialog();
  send('reward', values);
}

function onRewardsDialogChange(e) {
  const row = e.target.closest('tr').classList[0];
  const key = e.target.classList[0];
  const val = toInt(e.target.value);
  const playerCount = $$('.player').length;

  if (row === 'per-person') {
    $('.dialog .total').$(key).value = val * playerCount;
  } else {
    $('.dialog .per-person').$(key).value = Math.round(val / playerCount);
  }
}

function showRewardsDialog() {
  showDialog('reward');
  $$('.dialog input').forEach(e => {
    e.addEventListener('change', onRewardsDialogChange);
    e.addEventListener('click', e => e.target.select());
  });
}

function showInitiativeDialog() {
  showDialog('initiative');
  let currentInitiative = '';
  $$('.initiative-cell').forEach(el => {
    currentInitiative += el.$('initiative').innerText + ' ';
    currentInitiative += el.$('name').innerText + '\n';
  });
  $('.dialog .initiative').value = currentInitiative;
}

function saveInitiative() {
  const text = $('.dialog .initiative').value;
  const result = [];
  text.split('\n').forEach(line => {
    if (!line) return;
    const values = line.split(' ');
    result.push({
      initiative: toInt(values[0]),
      name: values.slice(1).join(' '),
    });
  });
  closeDialog();
  send('update-initiative', { initiative: result });
}

function confirm(action) {
  showDialog('confirm');
  $('.dialog button.action').addEventListener('click', function() {
    closeDialog();
    action();
  });
}

/////////
/////////
// Map //
/////////
/////////

const TWO_PI = Math.PI * 2;
const HANDLE_RADIUS = 20;

let canvas;
let ctx, vctx;
let visibility_canvas;
let dragging = false;
let map_action = 'move';
let last_x;
let last_y;
let dragstart_x, dragstart_y;
let mouse_x, mouse_y, mouse_button;
let last_touches;
let selected_unit = null;
let selected_corner = null;
let maps = [];
let map = {
  bg_image: new Image(),
  bg_dm_only: false,
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

function handle_radius() {
  return HANDLE_RADIUS / map.zoom;
}

function fix_rect(rect) {
  if (rect[2] < 0) {
    rect[0] += rect[2];
    rect[2] = -rect[2];
  }
  if (rect[3] < 0) {
    rect[1] += rect[3];
    rect[3] = -rect[3];
  }
  return rect;
}

function to_canvas_x(x) {
  return (x - map.offset_x) / map.zoom;
}

function to_canvas_y(y) {
  return (y - map.offset_y) / map.zoom;
}

function dist2(x1, y1, x2, y2) {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}
function distToLineSquared(x, y, line) {
  const [lx1, ly1, lx2, ly2] = line;
  const line_dist = dist2(lx1, ly1, lx2, ly2);

  if (line_dist === 0) return dist2(x, y, lx1, ly1);

  let t = ((x - lx1) * (lx2 - lx1) + (y - ly1) * (ly2 - ly1)) / line_dist;
  t = Math.max(0, Math.min(1, t));
  return dist2(x, y, lx1 + t * (lx2 - lx1), ly1 + t * (ly2 - ly1));
}
function distToLine(x, y, line) {
  return Math.sqrt(distToLineSquared(x, y, line));
}
function insideRect(x, y, rect) {
  const [rx, ry, rw, rh] = rect;
  return rx <= x && x <= rx + rw && ry <= y && y <= ry + rh;
}
function rectContained(rect, rects) {
  const [ax, ay, aw, ah] = rect;
  for (const [bx, by, bw, bh] of rects) {
    if (bx <= ax && ax + aw <= bx + bw && by <= ay && ay + ah <= by + bh) return true;
  }
  return false;
}

function selectCorner(x, y, corners) {
  selected_corner = null;

  for (const i in corners) {
    const [cx, cy] = corners[i];
    if ((cx - x) ** 2 + (cy - y) ** 2 <= handle_radius() ** 2) {
      selected_corner = i;
      return;
    }
  }
}

function selectLine(x, y) {
  let closest = handle_radius() ** 2;
  selected_unit = null;

  for (const i in map.lines) {
    const line = map.lines[i];
    const dist = distToLineSquared(x, y, line);
    if (dist < closest) {
      closest = dist;
      selected_unit = i;
    }
  }
}

function selectVisibilityArea(x, y) {
  selected_unit = null;

  for (const i in map.visible_areas) {
    if (insideRect(x, y, map.visible_areas[i])) {
      selected_unit = i;
      break;
    }
  }
}

function drawLine(x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

function drawGrid() {
  const SIZE = map.grid_size;
  const SIZE_ZOOM = SIZE * map.zoom;
  const NUM_X = Math.ceil(canvas.width / SIZE_ZOOM) + 2;
  const NUM_Y = Math.ceil(canvas.height / SIZE_ZOOM) + 2;

  ctx.save();
  ctx.resetTransform();
  ctx.translate((map.offset_x % SIZE_ZOOM) - SIZE_ZOOM, (map.offset_y % SIZE_ZOOM) - SIZE_ZOOM);
  ctx.scale(map.zoom, map.zoom);

  ctx.beginPath();
  for (let i = 1; i < NUM_X; i++) drawLine(i * SIZE, 0, i * SIZE, NUM_Y * SIZE);
  for (let i = 1; i < NUM_Y; i++) drawLine(0, i * SIZE, NUM_X * SIZE, i * SIZE);
  ctx.strokeStyle = `rgba(0,0,0,${map.grid_opacity / 100})`;
  ctx.stroke();
  ctx.restore();
}

function drawUnit(unit) {
  const x = (unit.x + unit.size / 2) * map.grid_size;
  const y = (unit.y + unit.size / 2) * map.grid_size;
  const r = (unit.size * map.grid_size) / 2.5;

  ctx.fillCircle(x, y, r, unit.color);

  if (unit.symbol) {
    const font_size = (12 * unit.size * map.grid_size) / 20;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = font_size + 'px sans-serif';
    ctx.fillText(unit.symbol, x, y + 0.37 * font_size);
  }
  if (unit.max_hp > 0) {
    ctx.fillStyle = '#051e3e';
    ctx.font = '10px sans-serif';
    ctx.fillText(unit.hp + '/' + unit.max_hp, x, y - r - 5);
  }
}

function drawUnits() {
  if (map_action === 'move' && selected_unit !== null && selected_unit < map.units.length) {
    const unit = map.units[selected_unit];
    drawUnit({
      x: unit.x - 0.25,
      y: unit.y - 0.25,
      size: unit.size + 0.5,
      color: 'gold',
    });
  }

  for (const unit of map.units) drawUnit(unit);

  if (map_action === 'units') {
    drawUnit({
      x: Math.floor(to_canvas_x(mouse_x) / map.grid_size),
      y: Math.floor(to_canvas_y(mouse_y) / map.grid_size),
      size: toInt($('#unit-size').value),
      color: $('#unit-color').value,
      symbol: $('#unit-symbol').value,
    });
  }
}

function drawLines() {
  ctx.beginPath();
  for (let line of map.lines) {
    drawLine(...line);
  }
  if (map_action === 'draw' && dragging && mouse_button === 0 && selected_unit === null)
    drawLine(
      align_to_grid(to_canvas_x(dragstart_x)),
      align_to_grid(to_canvas_y(dragstart_y)),
      to_canvas_x(mouse_x),
      to_canvas_y(mouse_y)
    );
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawVisibility() {
  vctx.clearRect(0, 0, visibility_canvas.width, visibility_canvas.height);

  if (map.visible_areas.length > 0 || map_action === 'visibility') {
    vctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    vctx.fillRect(0, 0, visibility_canvas.width, visibility_canvas.height);
  }

  vctx.save();
  vctx.translate(map.offset_x, map.offset_y);
  vctx.scale(map.zoom, map.zoom);
  for (const area of map.visible_areas) {
    vctx.clearRect(...area);
  }
  if (map_action === 'visibility') {
    if (dragging && mouse_button === 0 && selected_unit === null) {
      vctx.clearRect(
        align_to_grid(to_canvas_x(dragstart_x)),
        align_to_grid(to_canvas_y(dragstart_y)),
        align_to_grid(to_canvas_x(mouse_x) - to_canvas_x(dragstart_x)),
        align_to_grid(to_canvas_y(mouse_y) - to_canvas_y(dragstart_y))
      );
    } else if (selected_unit !== null) {
      const [x, y, w, h] = map.visible_areas[selected_unit];
      vctx.fillStyle = 'black';
      vctx.fillCircle(x, y, handle_radius(), vctx);
      vctx.fillCircle(x + w, y, handle_radius(), vctx);
      vctx.fillCircle(x, y + h, handle_radius(), vctx);
      vctx.fillCircle(x + w, y + h, handle_radius(), vctx);
    }
  }
  if (map_action === 'draw' && selected_unit !== null) {
    const [x1, y1, x2, y2] = map.lines[selected_unit];
    vctx.fillStyle = 'black';
    vctx.fillCircle(x1, y1, handle_radius(), vctx);
    vctx.fillCircle(x2, y2, handle_radius(), vctx);
  }
  vctx.restore();
  ctx.drawImage(visibility_canvas, 0, 0);
}

function align_to_grid(val) {
  return Math.round(val / map.grid_size) * map.grid_size;
}

function renderMap() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(map.offset_x, map.offset_y);
  ctx.scale(map.zoom, map.zoom);

  if (map.bg_image.src !== null) {
    ctx.save();
    ctx.translate(map.grid_x, map.grid_y);
    ctx.drawImage(map.bg_image, 0, 0);
    ctx.restore();
  }
  drawLines();
  drawGrid();
  drawUnits();
  ctx.restore();

  drawVisibility();
}

function canvas_mousedown(event) {
  event.preventDefault();
  mouse_button = event.button || 0;

  if (dragging) {
    if (mouse_button === 2) {
      dragging = false;
    }
    return;
  }

  dragging = true;
  last_x = event.pageX || event.touches[0].pageX;
  last_y = event.pageY || event.touches[0].pageY;
  mouse_x =
    event.offsetX !== undefined ? event.offsetX : event.touches[0].pageX - canvas.offsetLeft;
  mouse_y = event.offsetY !== undefined ? event.offsetY : event.touches[0].pageY - canvas.offsetTop;
  dragstart_x = mouse_x;
  dragstart_y = mouse_y;
  last_touches = event.touches;

  const click_x = to_canvas_x(dragstart_x);
  const click_y = to_canvas_y(dragstart_y);

  if (map_action === 'draw' && mouse_button === 0) {
    if (selected_unit !== null) {
      const line = map.lines[selected_unit];
      const [x1, y1, x2, y2] = line;
      selectCorner(click_x, click_y, [
        [x1, y1],
        [x2, y2],
      ]);
      if (
        selected_corner === null &&
        distToLineSquared(click_x, click_y, line) > handle_radius() ** 2
      ) {
        selected_unit = null;
      }
    }
  } else if (map_action === 'visibility' && mouse_button === 0) {
    if (selected_unit !== null) {
      const rect = map.visible_areas[selected_unit];
      const [x, y, w, h] = rect;
      selectCorner(click_x, click_y, [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ]);
      if (selected_corner === null && !insideRect(click_x, click_y, rect)) {
        selected_unit = null;
      }
    }
  }
}

function canvas_mouseup(event) {
  event.preventDefault();
  if (!dragging) return;

  dragging = false;

  mouse_x =
    event.offsetX !== undefined ? event.offsetX : event.changedTouches[0].pageX - canvas.offsetLeft;
  mouse_y =
    event.offsetY !== undefined ? event.offsetY : event.changedTouches[0].pageY - canvas.offsetTop;
  const x = to_canvas_x(mouse_x);
  const y = to_canvas_y(mouse_y);

  if (map_action === 'draw' && mouse_button === 0) {
    if (selected_unit === null) {
      const x1 = align_to_grid(to_canvas_x(dragstart_x));
      const y1 = align_to_grid(to_canvas_y(dragstart_y));
      const x2 = align_to_grid(x);
      const y2 = align_to_grid(y);
      if (x1 !== x2 || y1 !== y2) {
        map.lines.push([x1, y1, x2, y2]);
        send_map();
      } else selectLine(x, y);
    } else {
      const [x1, y1, x2, y2] = map.lines[selected_unit];
      if (x1 === x2 && y1 === y2) {
        map.lines.splice(selected_unit, 1);
        selected_unit = null;
        send_map();
      }
    }
  } else if (map_action === 'visibility' && mouse_button === 0) {
    if (selected_unit === null) {
      const new_area = [
        align_to_grid(to_canvas_x(dragstart_x)),
        align_to_grid(to_canvas_y(dragstart_y)),
        align_to_grid(x - to_canvas_x(dragstart_x)),
        align_to_grid(y - to_canvas_y(dragstart_y)),
      ];
      if (new_area[2] != 0 && new_area[3] != 0 && !rectContained(new_area, map.visible_areas)) {
        map.visible_areas.push(fix_rect(new_area));
        send_map();
      } else selectVisibilityArea(x, y);
    } else {
      const [x, y, w, h] = map.visible_areas[selected_unit];
      if (w == 0 || h == 0) {
        map.visible_areas.splice(selected_unit, 1);
        selected_unit = null;
      }
      send_map();
    }
  }

  if (mouse_button === 0) canvas_click(x, y);
  else if (mouse_button === 2) canvas_rightclick(x, y);

  requestAnimationFrame(renderMap);
}

function canvas_click(x, y) {
  if (map_action === 'move') {
    x = Math.floor(x / map.grid_size);
    y = Math.floor(y / map.grid_size);
    let new_selection = null;
    for (const i in map.units) {
      const unit = map.units[i];
      if (unit.x <= x && x < unit.x + unit.size && unit.y <= y && y < unit.y + unit.size) {
        new_selection = i;
        break;
      }
    }
    if (new_selection === null) {
      if (selected_unit !== null) {
        map.units[selected_unit].x = x;
        map.units[selected_unit].y = y;
        send_map();
        selected_unit = null;
      }
    } else if (new_selection === selected_unit) {
      selected_unit = null;
    } else {
      selected_unit = new_selection;
      $('#unit-size').value = map.units[selected_unit].size;
      $('#unit-color').value = map.units[selected_unit].color;
      $('#unit-symbol').value = map.units[selected_unit].symbol;
      $('#unit-hp').value = map.units[selected_unit].hp;
      $('#unit-max-hp').value = map.units[selected_unit].max_hp;
    }
  } else if (map_action === 'units') {
    map.units.push({
      x: Math.floor(x / map.grid_size),
      y: Math.floor(y / map.grid_size),
      size: toInt($('#unit-size').value),
      color: $('#unit-color').value,
      symbol: $('#unit-symbol').value,
      hp: toInt($('#unit-hp').value || $('#unit-max-hp').value),
      max_hp: toInt($('#unit-max-hp').value),
    });
    send_map();
  }
}

function canvas_rightclick(x, y) {
  if (map_action === 'move') {
    x = Math.floor(x / map.grid_size);
    y = Math.floor(y / map.grid_size);
    for (const i in map.units) {
      const unit = map.units[i];
      if (unit.x <= x && x < unit.x + unit.size && unit.y <= y && y < unit.y + unit.size) {
        map.units.splice(i, 1);
        selected_unit = null;
        send_map();
        break;
      }
    }
  } else if (map_action === 'draw') {
    if (
      selected_unit === null ||
      distToLineSquared(x, y, map.lines[selected_unit]) > handle_radius() ** 2
    ) {
      selectLine(x, y);
    }
    if (selected_unit !== null) {
      map.lines.splice(selected_unit, 1);
      selected_unit = null;
      send_map();
    }
  } else if (map_action === 'visibility') {
    if (selected_unit === null || !insideRect(x, y, map.visible_areas[selected_unit])) {
      selectVisibilityArea(x, y);
    }
    if (selected_unit !== null) {
      map.visible_areas.splice(selected_unit, 1);
      selected_unit = null;
      send_map();
    }
  }
}

function canvas_keyup(event) {
  event.preventDefault();

  if (map_action === 'draw' && event.key === 'Escape') {
    dragging = false;
  } else if (event.key === 'r') {
    map.offset_x = 0;
    map.offset_y = 0;
    map.zoom = 1;
  }

  requestAnimationFrame(renderMap);
}

function canvas_mousemove(event) {
  event.preventDefault();

  mouse_x =
    event.offsetX !== undefined ? event.offsetX : event.touches[0].pageX - canvas.offsetLeft;
  mouse_y = event.offsetY !== undefined ? event.offsetY : event.touches[0].pageY - canvas.offsetTop;

  if (dragging) {
    if (map_action === 'move' || mouse_button === 1) {
      let new_x, new_y;

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
            ((new_x - canvas.offsetLeft - map.offset_x) * (zoom_change - 1)) / zoom_change;
          map.offset_y -=
            ((new_y - canvas.offsetTop - map.offset_y) * (zoom_change - 1)) / zoom_change;
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
    } else if (map_action === 'draw' && selected_unit !== null) {
      let [x1, y1, x2, y2] = map.lines[selected_unit];
      const new_x = align_to_grid(to_canvas_x(mouse_x));
      const new_y = align_to_grid(to_canvas_y(mouse_y));
      switch (selected_corner) {
        case '0':
          x1 = new_x;
          y1 = new_y;
          break;
        case '1':
          x2 = new_x;
          y2 = new_y;
          break;
        default:
          x1 += new_x - align_to_grid(to_canvas_x(dragstart_x));
          y1 += new_y - align_to_grid(to_canvas_y(dragstart_y));
          x2 += new_x - align_to_grid(to_canvas_x(dragstart_x));
          y2 += new_y - align_to_grid(to_canvas_y(dragstart_y));
          dragstart_x = mouse_x;
          dragstart_y = mouse_y;
      }
      map.lines[selected_unit] = [x1, y1, x2, y2];
    } else if (map_action === 'visibility' && selected_unit !== null) {
      let [x, y, w, h] = map.visible_areas[selected_unit];
      const new_x = align_to_grid(to_canvas_x(mouse_x));
      const new_y = align_to_grid(to_canvas_y(mouse_y));
      switch (selected_corner) {
        case '0':
          w += x - new_x;
          h += y - new_y;
          x = new_x;
          y = new_y;
          break;
        case '1':
          w = new_x - x;
          h += y - new_y;
          y = new_y;
          break;
        case '2':
          w += x - new_x;
          h = new_y - y;
          x = new_x;
          break;
        case '3':
          w = new_x - x;
          h = new_y - y;
          break;
        default:
          x += new_x - align_to_grid(to_canvas_x(dragstart_x));
          y += new_y - align_to_grid(to_canvas_y(dragstart_y));
          dragstart_x = mouse_x;
          dragstart_y = mouse_y;
      }
      map.visible_areas[selected_unit] = fix_rect([x, y, w, h]);
    }
  }

  requestAnimationFrame(renderMap);
}

function canvas_wheel(event) {
  let zoom_change = 1;
  if (event.deltaY < 0) {
    zoom_change = 1.25;
  } else if (event.deltaY > 0) {
    zoom_change = 0.8;
  }
  map.zoom *= zoom_change;
  map.offset_x -= (event.offsetX - map.offset_x) * (zoom_change - 1);
  map.offset_y -= (event.offsetY - map.offset_y) * (zoom_change - 1);
  requestAnimationFrame(renderMap);
}

function saveMap() {
  if ($('.dialog .map-name').value) {
    send('save-map', { name: $('.dialog .map-name').value });
    closeDialog();
  }
}

function showLoadMapDialog() {
  showDialog('load-map');
  for (const map of maps) {
    const optionEl = document.createElement('option');
    optionEl.value = map;
    optionEl.innerText = map
      .split('.')
      .slice(0, -1)
      .join(' ');
    $('.dialog .map-name').appendChild(optionEl);
  }
}

function loadMap() {
  if ($('.dialog .map-name').value) {
    send('load-map', { name: $('.dialog .map-name').value });
    closeDialog();
  }
}

function newMap() {
  send('new-map');
}

function clearLines() {
  map.lines = [];
  selected_unit = null;
  selected_corner = null;
  send_map();
  requestAnimationFrame(renderMap);
}

function clearVisibility() {
  map.visible_areas = [];
  selected_unit = null;
  selected_corner = null;
  send_map();
  requestAnimationFrame(renderMap);
}

function showImage() {
  const url = prompt('URL:');
  if (url) send('show-image', { url });
}

/////////////////////
/////////////////////
// Event Listeners //
/////////////////////
/////////////////////

document.addEventListener('DOMContentLoaded', function() {
  dialog_backdrop = $('.dialog-backdrop');
  dialog_backdrop.addEventListener('click', function(e) {
    if (e.target === dialog_backdrop) closeDialog();
  });

  canvas = $('canvas');
  ctx = canvas.getContext('2d');

  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width;
  canvas.height = height;
  visibility_canvas = document.createElement('canvas');
  visibility_canvas.width = width;
  visibility_canvas.height = height;
  vctx = visibility_canvas.getContext('2d');

  canvas.addEventListener('mousedown', canvas_mousedown);
  canvas.addEventListener('touchstart', canvas_mousedown);
  canvas.addEventListener('mouseup', canvas_mouseup);
  canvas.addEventListener('touchend', canvas_mouseup);
  canvas.addEventListener('mousemove', canvas_mousemove);
  canvas.addEventListener('touchmove', canvas_mousemove);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', canvas_wheel);
  window.addEventListener('keyup', canvas_keyup);

  $('#map-bg').addEventListener('change', e => {
    map.bg_image.src = e.target.value;
    send_map(e.target.value);
  });
  $('#grid-size').addEventListener('input', e => {
    if (e.target.value && parseFloat(e.target.value) >= 10) {
      map.grid_size = parseFloat(e.target.value);
      send_map();
      requestAnimationFrame(renderMap);
    }
  });
  $('#grid-x').addEventListener('input', e => {
    if (e.target.value) {
      map.grid_x = parseFloat(e.target.value);
      send_map();
      requestAnimationFrame(renderMap);
    }
  });
  $('#grid-y').addEventListener('input', e => {
    if (e.target.value) {
      map.grid_y = parseFloat(e.target.value);
      send_map();
      requestAnimationFrame(renderMap);
    }
  });
  $('#grid-opacity').addEventListener('input', e => {
    map.grid_opacity = toInt(e.target.value);
    requestAnimationFrame(renderMap);
  });
  $$('.map-actions .toggle').forEach(el =>
    el.addEventListener('click', e => {
      $$('.map-actions .toggle').forEach(e => e.classList.remove('active'));

      let target = e.target;
      while (target.tagName !== 'BUTTON') target = target.parentElement;

      target.classList.add('active');
      canvas.classList.remove(map_action);
      map_action = target.dataset['action'];
      canvas.classList.add(map_action);

      selected_unit = null;
      selected_corner = null;

      requestAnimationFrame(renderMap);
    })
  );
  for (const attr of ['size', 'color', 'symbol', 'hp', 'max-hp']) {
    $('#unit-' + attr).addEventListener('change', e => {
      if (map_action === 'move' && selected_unit !== null) {
        if (attr === 'color' || attr === 'symbol')
          map.units[selected_unit][attr.replace('-', '_')] = e.target.value;
        else map.units[selected_unit][attr.replace('-', '_')] = toInt(e.target.value);
        send_map();
        requestAnimationFrame(renderMap);
      }
    });
  }
  $('#unit-hp').addEventListener('change', e => {
    const val = toInt(e.target.value);
    const unit_max_hp = $('#unit-max-hp');
    if (val > toInt(unit_max_hp.value)) unit_max_hp.value = val;
  });
  $('#unit-max-hp').addEventListener('change', e => {
    const val = toInt(e.target.value);
    const unit_hp = $('#unit-hp');
    if (val < toInt(unit_hp.value)) unit_hp.value = val;
  });
  $('button.btn-more').addEventListener('click', e => {
    const mapMoreEl = $('#map-more');
    if (mapMoreEl.classList.contains('collapsed')) {
      mapMoreEl.classList.remove('collapsed');
      e.target.innerText = 'Weniger';
    } else {
      mapMoreEl.classList.add('collapsed');
      e.target.innerText = 'Mehr';
    }
  });
  $('.initiative-bar').addEventListener('click', () => send('next-initiative'));
  $('#map-bg-dm-only').addEventListener('click', e => {
    map.bg_dm_only = e.target.checked;
    send_map();
  });

  map.bg_image.onload = () => requestAnimationFrame(renderMap);
});
window.addEventListener('load', openWebsocket);
