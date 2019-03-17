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

let ws;

function openWebsocket() {
  // const pwd = btoa(prompt('Password:'))
  //   .replace('==', '')
  //   .replace('=', '');
  // ws = new WebSocket(`ws://${window.location.host}/dm_socket?password=${pwd}`);
  ws = new WebSocket(`ws://${window.location.host}/dm_socket`);

  ws.onerror = onWebsocketError;
  ws.onopen = onWebsocketInit;
  ws.onmessage = onWebsocketMessage;
}

function onWebsocketError(e) {
  e.target.close();
  openWebsocket();
}

function onWebsocketInit() {
  send('init');
}

function onWebsocketMessage(e) {
  const { data, type } = JSON.parse(e.data);

  if (type == 'msg') {
    addMessage(data);
  } else if (type == 'data') {
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
      $('#map-bg').value = data.map.bg_image;
      $("#grid-size").value = map.grid_size;
      $("#grid-x").value = map.grid_x;
      $("#grid-y").value = map.grid_y;
      requestAnimationFrame(renderMap);
    }
    if (data.maps) {
      maps = data.maps;
    }
    closeDialog();
  }
}

function send(type, data) {
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
    lines: map.lines,
    grid_size: map.grid_size,
    grid_x: map.grid_x,
    grid_y: map.grid_y,
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
    console.error(
      `No template for '${name}' dialog. It should be called ${name}-dialog-template.`
    );
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
    name: $('.dialog .name').value,
    cls: $('.dialog .cls').value,
    xp: toInt($('.dialog .xp').value),
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

  values.xp = toInt($('.dialog .xp').value);
  values.name = $('.dialog .name').value;
  values.cls = $('.dialog .cls').value;

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

  if (row == 'diff') {
    $('.dialog .total').$(key).value = currVal + val;
  } else {
    $('.dialog .diff').$(key).value = val - currVal;
  }
}

function showPlayerDialog(e) {
  const target = e.target.closest('.player');
  showDialog('player');

  $('.dialog .player-id').value = target.id;

  $('.dialog .name').value = target.$('name').innerText;
  $('.dialog .cls').value = target.$('cls').innerText;
  $('.dialog .xp').value = target.$('xp').innerText;

  const keys = [
    'hp',
    'hp_total',
    'hitdice',
    'hitdice_total',
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
  $$('.dialog .per-person input').forEach(
    e => (values[e.classList[0]] = toInt(e.value))
  );
  closeDialog();
  send('reward', values);
}

function onRewardsDialogChange(e) {
  const row = e.target.closest('tr').classList[0];
  const key = e.target.classList[0];
  const val = toInt(e.target.value);
  const playerCount = $$('.player').length;

  if (row == 'per-person') {
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

let canvas;
let ctx;
let dragging = false;
let drawing = false;
let last_x = 0;
let last_y = 0;
let mouse_x, mouse_y;
let last_touches;
let maps = [];
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
};

function drawLine(x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

function drawGrid() {
  const SIZE = map.grid_size;
  const SIZE_ZOOM = SIZE * map.zoom;
  const NUM_X = Math.ceil(canvas.width / map.zoom / SIZE) + 2;
  const NUM_Y = Math.ceil(canvas.height / map.zoom / SIZE) + 2;

  ctx.save();
  ctx.translate(
    (map.offset_x % SIZE_ZOOM) - SIZE_ZOOM + map.grid_x * map.zoom,
    (map.offset_y % SIZE_ZOOM) - SIZE_ZOOM + map.grid_y * map.zoom
  );
  ctx.scale(map.zoom, map.zoom);
  ctx.beginPath();

  for (let i = 1; i < NUM_X; i++) drawLine(i * SIZE, 0, i * SIZE, NUM_Y * SIZE);
  for (let i = 1; i < NUM_Y; i++) drawLine(0, i * SIZE, NUM_X * SIZE, i * SIZE);

  ctx.strokeStyle = `rgba(0,0,0,${map.grid_opacity / 100})`;
  ctx.stroke();
  ctx.restore();
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
    ctx.drawImage(map.bg_image, 0, 0);
  }
  ctx.beginPath();
  for (let line of map.lines) {
    drawLine(...line);
  }
  if (drawing && (last_x !== 0 || last_y !== 0))
    drawLine(last_x, last_y, to_canvas_x(mouse_x), to_canvas_y(mouse_y));
  ctx.stroke();

  ctx.restore();
  drawGrid();
}

function canvas_mousedown(event) {
  if (drawing) return;
  event.preventDefault();
  dragging = true;
  last_x = event.pageX || event.touches[0].pageX;
  last_y = event.pageY || event.touches[0].pageY;
  last_touches = event.touches;
}

function canvas_mouseup(event) {
  if (drawing) return;
  event.preventDefault();
  dragging = false;
}

function to_canvas_x(x) {
  return (x - map.offset_x) / map.zoom;
}

function to_canvas_y(y) {
  return (y - map.offset_y) / map.zoom;
}

function canvas_click(event) {
  if (!drawing) return;
  event.preventDefault();

  if (last_x === 0 && last_y === 0) {
    last_x = align_to_grid(to_canvas_x(event.offsetX));
    last_y = align_to_grid(to_canvas_y(event.offsetY));
  } else {
    map.lines.push([
      last_x,
      last_y,
      align_to_grid(to_canvas_x(event.offsetX)),
      align_to_grid(to_canvas_y(event.offsetY)),
    ]);
    send_map();
    last_x = last_y = 0;
  }
  requestAnimationFrame(renderMap);
}

function canvas_rightclick(event) {
  event.preventDefault();
  if (!drawing) return;

  if (last_x === 0 && last_y === 0) {
    last_x = align_to_grid(to_canvas_x(event.offsetX));
    last_y = align_to_grid(to_canvas_y(event.offsetY));
  } else {
    const curr_x = align_to_grid(to_canvas_x(event.offsetX));
    const curr_y = align_to_grid(to_canvas_y(event.offsetY));
    for (let i = 0; i < map.lines.length; i++) {
      const [x1, y1, x2, y2] = map.lines[i];
      if (
        (last_x == x1 || last_x == x2) &&
        (last_y == y1 || last_y == y2) &&
        (curr_x == x1 || curr_x == x2) &&
        (curr_y == y1 || curr_y == y2)
      ) {
        map.lines.splice(i, 1);
        i--;
      }
    }
    send_map();
    last_x = last_y = 0;
  }
  requestAnimationFrame(renderMap);
}

function canvas_keyup(event) {
  event.preventDefault();
  if (!drawing) return;
  if (event.key === 'Escape') {
    last_x = last_y = 0;
    requestAnimationFrame(renderMap);
  }
}

function canvas_mousemove(event) {
  if (drawing) {
    mouse_x = event.offsetX;
    mouse_y = event.offsetY;
    requestAnimationFrame(renderMap);
    return;
  }
  if (!dragging) return;
  event.preventDefault();

  let new_x = last_x,
    new_y = last_y;

  if (event.type === 'touchmove') {
    if (last_touches && last_touches.length == 2 && event.touches.length == 2) {
      const last_diff_x = last_touches[0].pageX - last_touches[1].pageX;
      const last_diff_y = last_touches[0].pageY - last_touches[1].pageY;
      const last_diff = Math.sqrt(
        last_diff_x * last_diff_x + last_diff_y * last_diff_y
      );
      last_x = (last_touches[0].pageX + last_touches[1].pageX) / 2;
      last_y = (last_touches[0].pageY + last_touches[1].pageY) / 2;

      const curr_diff_x = event.touches[0].pageX - event.touches[1].pageX;
      const curr_diff_y = event.touches[0].pageY - event.touches[1].pageY;
      const curr_diff = Math.sqrt(
        curr_diff_x * curr_diff_x + curr_diff_y * curr_diff_y
      );
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

/////////////////////
/////////////////////
// Event Listeners //
/////////////////////
/////////////////////

document.addEventListener('DOMContentLoaded', function() {
  dialog_backdrop = $('.dialog-backdrop');
  dialog_backdrop.addEventListener('click', function(e) {
    if (e.target == dialog_backdrop) closeDialog();
  });

  canvas = $('canvas');
  ctx = canvas.getContext('2d');

  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width;
  canvas.height = height;

  canvas.addEventListener('mousedown', canvas_mousedown);
  canvas.addEventListener('touchstart', canvas_mousedown);
  canvas.addEventListener('mouseup', canvas_mouseup);
  canvas.addEventListener('touchend', canvas_mouseup);
  canvas.addEventListener('mousemove', canvas_mousemove);
  canvas.addEventListener('touchmove', canvas_mousemove);
  canvas.addEventListener('contextmenu', canvas_rightclick);
  canvas.addEventListener('click', canvas_click);
  window.addEventListener('keyup', canvas_keyup);

  $('#map-bg').addEventListener('change', e => {
    map.bg_image.src = e.target.value;
    send_map(e.target.value);
  });
  $('#grid-size').addEventListener('input', e => {
    if (e.target.value && parseFloat(e.target.value) >= 10)
      map.grid_size = parseFloat(e.target.value);
    send_map();
    requestAnimationFrame(renderMap);
  });
  $('#grid-x').addEventListener('input', e => {
    if (e.target.value) map.grid_x = parseFloat(e.target.value);
    send_map();
    requestAnimationFrame(renderMap);
  });
  $('#grid-y').addEventListener('input', e => {
    if (e.target.value) map.grid_y = parseFloat(e.target.value);
    send_map();
    requestAnimationFrame(renderMap);
  });
  $('#grid-opacity').addEventListener('input', e => {
    map.grid_opacity = toInt(e.target.value);
    requestAnimationFrame(renderMap);
  });
  $('#drawing').addEventListener('change', () => {
    drawing = !drawing;
    last_x = last_y = 0;
  });

  map.bg_image.onload = () => requestAnimationFrame(renderMap);
});
window.addEventListener('load', openWebsocket);
