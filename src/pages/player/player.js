'use strict';

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
