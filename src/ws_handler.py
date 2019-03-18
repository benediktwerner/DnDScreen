import atexit
import json
import os
from typing import List

import aiohttp

from data import Data, Map


data = Data.load()
atexit.register(lambda: data.dump(backup=True))

player_websockets: List[aiohttp.web.WebSocketResponse] = []
dm_websockets: List[aiohttp.web.WebSocketResponse] = []


async def send(ws, data):
    if isinstance(data, str):
        data = {"type": "msg", "data": data}
    elif isinstance(data, Data):
        data = {"type": "data", "data": data.to_json()}
    print("Sending:", data)
    await ws.send_str(json.dumps(data))


async def send_dm(msg):
    for dm in dm_websockets:
        await send(dm, msg)


async def send_players(msg):
    for player in player_websockets:
        await send(player, msg)


async def send_all(msg):
    await send_dm(msg)
    await send_players(msg)


async def handle_player(ws, msg):
    if msg[0] == "!":
        msg = json.loads(msg[1:])
        msg_type, msg_data = msg["type"], msg["data"]

        if msg_type == "move-unit":
            data.move_unit(**msg_data)
            await send_all(data)

        return
    elif msg in ("init", "update"):
        await send(ws, data)
        return

    await send(ws, f"Error: Invalid msg '{msg}'")


async def _handle_init(ws):
    await send(ws, data)


async def _handle_save(ws):
    data.dump()
    await send(ws, "Gespeichert")


async def _handle_long_rest(ws):
    data.long_rest()
    await send_all(data)


async def _handle_add_player(ws, **player):
    data.add_player(player)
    await send_all(data)


async def _handle_update_player(ws, id, values):
    data.update_player(id, values)
    await send_all(data)


async def _handle_reward(ws, **rewards):
    data.reward(rewards)
    await send_dm(data)
    await send_players({"type": "reward", "data": rewards})


async def _handle_update_map(ws, **values):
    data.update_map(values)
    await send_players(data)


async def _handle_load_map(ws, name):
    if data.load_map(name):
        await send_all(data)
    else:
        await send(ws, "Karte nicht gefunden")


async def _handle_save_map(ws, name):
    data.save_map(name)
    await send(ws, "Karte gespeichert")


DM_HANDLERS = {
    "init": _handle_init,
    "save": _handle_save,
    "long-rest": _handle_long_rest,
    "add-player": _handle_add_player,
    "update-player": _handle_update_player,
    "reward": _handle_reward,
    "update-map": _handle_update_map,
    "load-map": _handle_load_map,
    "save-map": _handle_save_map,
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
