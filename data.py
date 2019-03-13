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

    def add_player(self, json):
        self.players.append(Player(json))

    def update_player(self, i, values):
        self.players[i].update(values)

    def long_rest(self):
        for player in self.players:
            player.long_rest()

    def reward(self, rewards):
        for player in self.players:
            player.reward(rewards)

    def to_json(self):
        return {"players": [p.to_json() for p in self.players]}


class Player:
    def __init__(self, json):
        self.name = json.get("name", "Unbennant")
        self.cls = json.get("class", "Keine Klasse")
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
            "class": self.cls,
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
