#!/usr/bin/env python3

import base64
import os

import aiohttp
from aiohttp import web

import ws_handler

DM_PASSWORD = base64.b64encode(b"1337dm").decode().replace("=", "")


def html_response(file):
    if os.path.isfile(file):
        with open(file) as f:
            return web.Response(text=f.read(), content_type="text/html")
    raise web.HTTPNotFound()


async def index_handler(request):
    return html_response("index.html")


async def player_handler(request):
    return html_response("player.html")


async def player_socket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ws_handler.player_websockets.append(ws)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == "close":
                await ws.close()
            else:
                await ws_handler.handle_player(ws, msg.data)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"Player websocket closed with exception {ws.exception()}")

    ws_handler.player_websockets.remove(ws)
    print("Player websocket closed")
    return ws


async def dm_handler(request):
    if request.query.get("password") == DM_PASSWORD:
        return html_response("dm.html")
    raise web.HTTPForbidden()


async def dm_socket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ws_handler.dm_websockets.append(ws)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == "close":
                await ws.close()
            else:
                await ws_handler.handle_dm(ws, msg.data)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"DM websocket closed with exception {ws.exception()}")

    ws_handler.dm_websockets.remove(ws)
    print("DM websocket closed")
    return ws


app = web.Application()
app.add_routes(
    [
        web.get("/", index_handler),
        web.get("/dm", dm_handler),
        web.get("/dm_socket", dm_socket_handler),
        web.get("/player", player_handler),
        web.get("/player_socket", player_socket_handler),
        web.static("/", "static"),
    ]
)
web.run_app(app)
