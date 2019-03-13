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
  const pwd = btoa(prompt('Password:'))
    .replace('==', '')
    .replace('=', '');
  ws = new WebSocket(`ws://${window.location.host}/dm_socket?password=${pwd}`);

  ws.onerror = onWebsocketError;
  ws.onopen = () => send('init');
  ws.onmessage = onWebsocketMessage;
}

function onWebsocketError(e) {
  e.target.close();
  openWebsocket();
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
    name: $('.dialog .name').value,
    cls: $('.dialog .cls').value,
    xp: toInt($('.dialog .xp').value),
  };
  closeDialog();
  send('add-player', data);
}

function updatePlayer() {
  const keys = ['hp', 'hp_total', 'hitdice', 'hitdice_total', 'copper', 'silver', 'gold', 'electrum', 'platin'];
  let values = {};
  for (const key of keys) {
    values[key] = toInt($('.dialog .total').$(key).value);
  }

  values.xp = toInt($('.dialog .xp').value);
  values.name = $('.dialog .name').value;
  values.cls = $('.dialog .cls').value;

  data = {
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

  const keys = ['hp', 'hp_total', 'hitdice', 'hitdice_total', 'copper', 'silver', 'gold', 'electrum', 'platin'];
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

document.addEventListener('DOMContentLoaded', function() {
  dialog_backdrop = $('.dialog-backdrop');
  dialog_backdrop.addEventListener('click', function(e) {
    if (e.target == dialog_backdrop) closeDialog();
  });
});
window.addEventListener('load', openWebsocket);
