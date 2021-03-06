#!/usr/bin/env python3

import os
import sys
import webbrowser

import aiohttp
from aiohttp import web

import ws_handler


def redirect_handler(target):
    async def handler(request):
        raise web.HTTPFound(target)

    return handler


async def player_socket_handler(request):
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    ws_handler.player_websockets.append(ws)

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                if msg.data == "close":
                    await ws.close()
                else:
                    await ws_handler.handle_player(ws, msg.data)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print("Player websocket closed with exception:")
                print(ws.exception())
    finally:
        ws_handler.player_websockets.remove(ws)
        print("Player websocket closed")

    return ws


async def dm_socket_handler(request):
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    ws_handler.dm_websockets.append(ws)

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                if msg.data == "close":
                    await ws.close()
                else:
                    await ws_handler.handle_dm(ws, msg.data)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print("DM websocket closed with exception:")
                print(ws.exception())
    finally:
        ws_handler.dm_websockets.remove(ws)
        print("DM websocket closed")

    return ws


app = web.Application()
app.add_routes(
    [
        web.get("/", redirect_handler("/pages/index.html")),
        web.get("/dm", redirect_handler("/pages/dm/dm.html")),
        web.get("/player", redirect_handler("/pages/player/player.html")),
        web.get("/dm_socket", dm_socket_handler),
        web.get("/player_socket", player_socket_handler),
        web.static("/pages", "pages"),
        web.static("/css", "static/css"),
        web.static("/js", "static/js"),
        web.static("/fonts", "static/fonts"),
        web.static("/img", "static/img"),
        web.static("/", "static/icons"),
    ]
)

if "-o" in sys.argv:
    webbrowser.open("http://localhost:8080")

web.run_app(app)
