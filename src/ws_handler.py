import atexit
import json
import os
from typing import List

import aiohttp

from data import Data, Player


data = Data.load()
atexit.register(lambda: data.dump(backup=True))

player_websockets: List[aiohttp.web.WebSocketResponse] = []
dm_websockets: List[aiohttp.web.WebSocketResponse] = []


async def send(ws, data):
    if isinstance(data, str):
        data = {"type": "msg", "data": data}
    elif isinstance(data, Data):
        data = {"type": "data", "data": data.to_json()}

    try:
        await ws.send_str(json.dumps(data))
    except Exception as e:
        print("Exception during send:")
        print(e)


async def send_dm(msg):
    for dm in dm_websockets:
        await send(dm, msg)


async def send_players(msg):
    for player in player_websockets:
        await send(player, msg)


async def send_all(msg):
    await send_dm(msg)
    await send_players(msg)


async def _handle_move_unit(ws, unit, x, y):
    data.map.units[unit].move(x, y)
    await send_all(data)


async def handle_player(ws, msg):
    if msg[0] == "!":
        msg = json.loads(msg[1:])
        msg_type, msg_data = msg["type"], msg["data"]

        if msg_type == "move-unit":
            await _handle_move_unit(ws, **msg_data)
        else:
            await send(ws, f"Invalid msg type: '{msg_type}'")
    elif msg in ("init", "update"):
        await send(ws, data)
    else:
        await send(ws, f"Error: Invalid msg '{msg}'")


async def _handle_init(ws):
    await send(ws, data)


async def _handle_save(ws):
    data.dump()
    await send(ws, "Gespeichert")


async def _handle_long_rest(ws):
    data.long_rest()
    await send_all(data)


async def _handle_new_map(ws):
    data.new_map()
    await send_all(data)


async def _handle_next_initiative(ws):
    if data.initiative.next():
        await send_all({"type": "initiative-index", "data": data.initiative.activeIndex})


async def _handle_add_player(ws, **player):
    data.players.append(Player(player))
    await send_all(data)


async def _handle_update_player(ws, id, values):
    data.players[id].update(values)
    await send_all(data)


async def _handle_reward(ws, **rewards):
    data.reward(rewards)
    await send_dm(data)
    await send_players({"type": "reward", "data": rewards})


async def _handle_update_map(ws, **values):
    data.map.update(values)
    await send_players(data)


async def _handle_load_map(ws, name):
    if data.load_map(name):
        await send_all(data)
    else:
        await send(ws, "Karte nicht gefunden")


async def _handle_save_map(ws, name):
    data.save_map(name)
    await send(ws, "Karte gespeichert")


async def _handle_update_initiative(ws, initiative):
    data.initiative.update(initiative)
    await send_all(data)


DM_HANDLERS = {
    "init": _handle_init,
    "save": _handle_save,
    "long-rest": _handle_long_rest,
    "new-map": _handle_new_map,
    "next-initiative": _handle_next_initiative,
    "add-player": _handle_add_player,
    "update-player": _handle_update_player,
    "reward": _handle_reward,
    "update-map": _handle_update_map,
    "load-map": _handle_load_map,
    "save-map": _handle_save_map,
    "update-initiative": _handle_update_initiative,
}


async def handle_dm(ws, msg):
    if not msg:
        return

    if msg[0] == "!":
        msg = json.loads(msg[1:])
        msg_type, msg_data = msg["type"], msg["data"]

        if msg_type not in DM_HANDLERS:
            await send(ws, f"Error: Invalid msg type '{msg_type}'")
            return

        await DM_HANDLERS[msg_type](ws, **msg_data)
        return

    if msg not in DM_HANDLERS:
        await send(ws, f"Error: Invalid msg '{msg}'")
        return

    await DM_HANDLERS[msg](ws)
