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

  if (type == 'msg') {
    alert(data);
  } else if (type == 'data') {
  }
};

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
});
