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
          if (key == 'cls') continue;
          const el = pEl.$(key);
          if (!el.classList.contains('currency')) el.innerText = p[key];
        }
      }
    }
  } else if (type == 'reward') {
    if (data.xp > 0) {
      showRewardXpDialog(data.xp);
    }
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

////////////
////////////
// Canvas //
////////////
////////////

let canvas;
let ctx;
let particles;
let alive;
let time;
let particlesArrived;
let originalXp;
let additionalXp;
let playerCount;
let targets;

const DIFFS = [[-1, 0], [1, 0], [0, 0], [0, 1], [0, -1]];

class Particle {
  constructor(x, y, dest, center, p) {
    this.x = x;
    this.y = y;

    const xdiff = x - center.y;
    const ydiff = y - center.y;
    this.vx = Math.sign(xdiff) * (Math.log((Math.abs(xdiff) + 1) / 5) * Math.random());
    this.vy = Math.sign(ydiff) * (Math.log((Math.abs(ydiff) + 1) / 5) * Math.random());
    this.friction = Math.random() * 0.05 + 0.95;

    this.p = p;
    this.alive = true;
    this.dest = {
      x: dest.x + Math.random() * 10 - 5,
      y: dest.y + Math.random() * 10 - 5,
    };
  }

  render(imageData) {
    if (!this.alive) return false;

    for (const [xd, yd] of DIFFS) {
      const pos = (~~this.x + xd + (~~this.y + yd) * imageData.width) * 4;
      const w = xd == 0 && yd == 0 ? 1 : Math.exp(time / 100) - 1;
      imageData.data[pos] += 0x58 * w;
      imageData.data[pos + 1] += 0x18 * w;
      imageData.data[pos + 2] += 0x0d * w;
      imageData.data[pos + 3] = 0xff;
    }

    const diffX = this.dest.x - this.x;
    const diffY = this.dest.y - this.y;
    const ampl = Math.sqrt(diffX * diffX + diffY * diffY);
    const speed = time / 5;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx + (ampl > 0 ? diffX * (speed / ampl) : 0);
    this.y += this.vy + (ampl > 0 ? diffY * (speed / ampl) : 0);

    const [x1, y1, x2, y2] = targets[this.p];
    if (x1 <= this.x && this.x <= x2 && y1 <= this.y && this.y <= y2) {
      particlesArrived[this.p]++;
      return (this.alive = false);
    }

    return true;
  }
}

function render() {
  if (alive) requestAnimationFrame(render);

  alive = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    if (p.render(imageData)) alive = true;
  }

  ctx.putImageData(imageData, 0, 0);
  time += 1;

  if (time > 500) alive = false;

  for (let i = 0; i < playerCount; i++) {
    const arrivedPercent = (particlesArrived[i] * playerCount) / particles.length;
    const arrivedXp = Math.ceil(additionalXp * arrivedPercent * 1.1);
    $$('.player .xp')[i].innerText = originalXp[i] + Math.min(additionalXp, arrivedXp);
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

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '4rem Requiem';
  ctx.textAlign = 'center';

  const baselinePadding = getBaselinePadding($('.dialog .xp'));

  for (let p = 0; p < playerCount; p++) {
    let rect = $$('.dialog .xp')[p].getBoundingClientRect();
    const x = Math.floor(rect.x);
    const y = Math.floor(rect.y);
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    ctx.save();
    if (p == 0) ctx.translate(x + width / 2, y + height - baselinePadding);
    else if (p == 1) ctx.translate(x + width - baselinePadding, y + height / 2);
    else ctx.translate(x + width / 2, y + baselinePadding);
    ctx.rotate((-p * Math.PI) / 2);

    ctx.fillText(xpAmount, 0, 0);
    ctx.restore();

    const data = ctx.getImageData(x, y, width, height).data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const targetRect = $$('.player .xp')[p].getBoundingClientRect();
    const dest = { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 };
    const center = { x: x + width / 2, y: y + height / 2 };

    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        if (data[(i + j * width) * 4 + 3] > 150) {
          particles.push(new Particle(x + i, y + j, dest, center, p));
        }
      }
    }
  }

  time = 0;
  alive = true;
  targets = [];
  originalXp = [];
  additionalXp = xpAmount;
  particlesArrived = [0, 0, 0];
  $$('.players .xp').forEach(el => {
    originalXp.push(toInt(el.innerText));
    const { x, y, width, height } = el.getBoundingClientRect();
    targets.push([x, y, x + width, y + height]);
  });

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
      console.error(`No template for '${name}' dialog. It should be called ${name}-dialog-template.`);
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
    if (e.target == dialog_backdrop) closeDialog();
  });

  canvas = $('canvas');
  ctx = canvas.getContext('2d');
});
