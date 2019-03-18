import json
import os

DATA_DIR = "data"
DATA_FILE = os.path.join(DATA_DIR, "data.json")
BACKUP_FILE = os.path.join(DATA_DIR, "data.bkp.json")
MAPS_DIR = os.path.join(DATA_DIR, "maps")
MAP_IMAGES_DIR = "static/img/maps"
TRANSPARENT_BG = (
    "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
)

LEVEL_XP = [
    300,
    900,
    2700,
    6500,
    14000,
    23000,
    34000,
    48000,
    64000,
    85000,
    100_000,
    120_000,
    140_000,
    165_000,
    195_000,
    225_000,
    265_000,
    305_000,
    355_000,
]


class Data:
    def __init__(self, json=None):
        if json is None:
            json = {}

        self.players = [Player(p) for p in json.get("players", [])]
        self.map = Map(json.get("map", {}))

    def add_player(self, json):
        self.players.append(Player(json))

    def update_player(self, i, values):
        self.players[i].update(values)
    
    def move_unit(self, unit, x, y):
        self.map.units[unit].x = x
        self.map.units[unit].y = y

    def update_map(self, data):
        self.map.update(data)

    def long_rest(self):
        for player in self.players:
            player.long_rest()

    def reward(self, rewards):
        for player in self.players:
            player.reward(rewards)

    def load_map(self, name):
        path = os.path.join(MAPS_DIR, name)
        if not os.path.isfile(path):
            return False

        with open(path) as f:
            self.map = Map(json.load(f))

        return True

    def save_map(self, name):
        os.makedirs(MAPS_DIR, exist_ok=True)
        if not name.endswith(".map"):
            name += ".map"
        path = os.path.join(MAPS_DIR, name)

        with open(path, "w") as f:
            json.dump(self.map.to_json(), f)

    @property
    def map_images(self):
        if not os.path.isdir(MAP_IMAGES_DIR):
            return []
        return os.listdir(MAP_IMAGES_DIR)

    @property
    def maps(self):
        if not os.path.isdir(MAPS_DIR):
            return []
        return os.listdir(MAPS_DIR)

    def to_json(self):
        return {
            "players": [p.to_json() for p in self.players],
            "map": self.map.to_json(),
            "maps": self.maps,
            "map_images": self.map_images,
        }

    @staticmethod
    def load():
        if os.path.isfile(DATA_FILE):
            with open(DATA_FILE) as f:
                return Data(json.load(f))
        return Data()

    def dump(self, backup=False):
        os.makedirs(DATA_DIR, exist_ok=True)
        file_name = BACKUP_FILE if backup else DATA_FILE
        with open(file_name, "w") as f:
            return json.dump(self.to_json(), f)


class Player:
    def __init__(self, json):
        self.name = json.get("name", "Unbennant")
        self.cls = json.get("cls", "Keine Klasse")
        self.xp = json.get("xp", 0)
        self.hp = json.get("hp", 0)
        self.hp_total = json.get("hp_total", self.hp)
        self.hitdice = json.get("hitdice", 0)
        self.hitdice_total = json.get("hitdice_total", self.hitdice)
        self.copper = json.get("copper", 0)
        self.silver = json.get("silver", 0)
        self.gold = json.get("gold", 0)
        self.electrum = json.get("electrum", 0)
        self.platin = json.get("platin", 0)

    def update(self, values):
        for key, val in values.items():
            setattr(self, key, val)

    def long_rest(self):
        self.hp = self.hp_total
        self.hitdice = min(self.hitdice_total, self.hitdice + self.hitdice_total // 2)

    def reward(self, rewards):
        for key, val in rewards.items():
            curr = getattr(self, key, 0)
            setattr(self, key, curr + val)

    @property
    def level(self):
        for lvl, xp in enumerate(LEVEL_XP, 1):
            if self.xp < xp:
                return lvl
        return 20

    def to_json(self):
        return {
            "name": self.name,
            "level": self.level,
            "xp": self.xp,
            "cls": self.cls,
            "hp": self.hp,
            "hp_total": self.hp_total,
            "hitdice": self.hitdice,
            "hitdice_total": self.hitdice_total,
            "copper": self.copper,
            "silver": self.silver,
            "gold": self.gold,
            "electrum": self.electrum,
            "platin": self.platin,
        }


class Map:
    def __init__(self, json):
        self.bg_image = json.get("bg_image", TRANSPARENT_BG)
        self.lines = json.get("lines", [])
        self.grid_size = json.get("grid_size", 20)
        self.grid_x = json.get("grid_x", 0)
        self.grid_y = json.get("grid_y", 0)
        self.units = [Unit(u) for u in json.get("units", [])]

    def update(self, data):
        if "lines" in data:
            self.lines = data["lines"]
        if "bg_image" in data:
            self.bg_image = data["bg_image"]
        if "grid_size" in data:
            self.grid_size = data["grid_size"]
        if "grid_x" in data:
            self.grid_x = data["grid_x"]
        if "grid_y" in data:
            self.grid_y = data["grid_y"]
        if "units" in data:
            self.units = [Unit(u) for u in data["units"]]
    
    def to_json(self):
        return {
            "bg_image": self.bg_image,
            "lines": self.lines,
            "grid_size": self.grid_size,
            "grid_x": self.grid_x,
            "grid_y": self.grid_y,
            "units": [u.to_json() for u in self.units],
        }


class Unit:
    def __init__(self, json):
        self.x = json.get("x", 0)
        self.y = json.get("y", 0)
        self.size = json.get("size", 1)
        self.color = json.get("color", "red")
    
    def to_json(self):
        return {"x": self.x, "y": self.y, "size": self.size, "color": self.color}
