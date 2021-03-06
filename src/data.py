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
        self.initiative = Initiative(json.get("initiative", {}))

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

    def new_map(self):
        self.map = Map({})

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
            "initiative": self.initiative.to_json(),
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
        self.passive_perception = json.get("passive_perception", 0)
        self.armor_class = json.get("armor_class", 0)
        self.gold = json.get("gold", 0)

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
            "passive_perception": self.passive_perception,
            "armor_class": self.armor_class,
            "gold": self.gold,
        }


class Map:
    def __init__(self, json):
        self.bg_image = json.get("bg_image", TRANSPARENT_BG)
        self.bg_dm_only = json.get("bg_dm_only", False)
        self.lines = json.get("lines", [])
        self.grid_size = json.get("grid_size", 20)
        self.grid_x = json.get("grid_x", 0)
        self.grid_y = json.get("grid_y", 0)
        self.units = [Unit(u) for u in json.get("units", [])]
        self.visible_areas = json.get("visible_areas", [])

    def update(self, data):
        if "lines" in data:
            self.lines = data["lines"]
        if "bg_image" in data:
            self.bg_image = data["bg_image"]
        if "bg_dm_only" in data:
            self.bg_dm_only = data["bg_dm_only"]
        if "grid_size" in data:
            self.grid_size = data["grid_size"]
        if "grid_x" in data:
            self.grid_x = data["grid_x"]
        if "grid_y" in data:
            self.grid_y = data["grid_y"]
        if "units" in data:
            self.units = [Unit(u) for u in data["units"]]
        if "visible_areas" in data:
            self.visible_areas = data["visible_areas"]

    def to_json(self):
        return {
            "bg_image": self.bg_image,
            "bg_dm_only": self.bg_dm_only,
            "lines": self.lines,
            "grid_size": self.grid_size,
            "grid_x": self.grid_x,
            "grid_y": self.grid_y,
            "units": [u.to_json() for u in self.units],
            "visible_areas": self.visible_areas,
        }


class Unit:
    def __init__(self, json):
        self.x = json.get("x", 0)
        self.y = json.get("y", 0)
        self.size = json.get("size", 1)
        self.color = json.get("color", "red")
        self.symbol = json.get("symbol", "")
        self.hp = json.get("hp", 0)
        self.max_hp = json.get("max_hp", 0)

    def move(self, x, y):
        self.x = x
        self.y = y

    def to_json(self):
        return {
            "x": self.x,
            "y": self.y,
            "size": self.size,
            "color": self.color,
            "symbol": self.symbol,
            "hp": self.hp,
            "max_hp": self.max_hp,
        }


class Initiative:
    def __init__(self, json):
        self.units = [InitiativeUnit(u) for u in json.get("units", [])]
        self.activeIndex = json.get("activeIndex", 0)

    def next(self):
        if not self.units:
            return False

        self.activeIndex = (self.activeIndex + 1) % len(self.units)
        return True

    def update(self, data):
        self.activeIndex = 0
        self.units = [InitiativeUnit(u) for u in data]
        self.units.sort(key=lambda u: u.initiative, reverse=True)

    def to_json(self):
        return {
            "units": [u.to_json() for u in self.units],
            "activeIndex": self.activeIndex,
        }


class InitiativeUnit:
    def __init__(self, json):
        self.name = json.get("name", "Unnamed")
        self.initiative = json.get("initiative", 0)

    def to_json(self):
        return {"name": self.name, "initiative": self.initiative}
