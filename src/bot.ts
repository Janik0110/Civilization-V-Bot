import { readFile } from "fs/promises";
import { Client, Message, User } from "discord.js";

import Civilization from "./types/Civilization";
import Configuration from "./types/Configuration";

const client = new Client();

let civilizations: Civilization[];
let config: Configuration;

let players: Map<User, Civilization[]> = new Map();

const loadCivilizations = async () => {
  const buffer = await readFile("./src/civilizations.json");
  const data: Civilization[] = JSON.parse(buffer.toString());
  civilizations = data;
};

const loadConfiguration = async () => {
  const buffer = await readFile("./src/config.json");
  const data: Configuration = JSON.parse(buffer.toString());
  config = data;
};

const addPlayer = (user: User) => {
  const isAlreadyPlayer = Array.from(players.keys()).find((player) => player.id === user.id);
  if (isAlreadyPlayer !== undefined) return;

  players.set(user, []);
};

const removePlayer = (user: User) => {
  const isAlreadyPlayer = Array.from(players.keys()).find((player) => player.id === user.id);
  if (isAlreadyPlayer === undefined) return;

  players.delete(user);
};

client.on("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on("message", (msg: Message) => {
  if (msg.author.bot) {
    return;
  }

  const content = msg.content;

  if (content.startsWith("/config")) {
    const configString = content.substring(8);
    const [action, argument] = configString.split(" ");

    switch (action) {
      case "num-players":
        config.numPlayer = Number(argument);
        break;
      case "num-civilizations":
        config.numCivilizations = Number(argument);
        break;
      case "num-bans":
        config.numBans = Number(argument);
        break;
      case "show":
        msg.channel.send(
          `Number of players: ${config.numPlayer}\nCivilizations to pick from: ${config.numCivilizations}\nCivilizations to ban: ${config.numBans}`,
        );
        break;
      default:
        msg.channel.send("No configuration found!");
    }
    return;
  }

  if (content.startsWith("/player")) {
    const configString = content.substring(8);
    const [action, _] = configString.split(" ");

    switch (action) {
      case "add":
        const addMentions = msg.mentions.users.array();
        if (addMentions.length === 0) {
          msg.channel.send("Please provide players to add to the game!");
          return;
        }

        addMentions.forEach(addPlayer);
        break;
      case "remove":
        const removeMentions = msg.mentions.users.array();
        if (removeMentions.length === 0) {
          msg.channel.send("Please provide players to remove from the game!");
          return;
        }

        removeMentions.forEach(removePlayer);
        break;
      case "show":
        if (players.size === 0) {
          msg.channel.send("No players found!");
          return;
        }

        const string = Array.from(players.keys())
          .map((player) => player.toString())
          .reduce((acc, curr) => `${acc} ${curr}`);

        msg.channel.send(`Players: ${string}`);
        break;
      default:
        msg.channel.send("Please provide an action!");
        return;
    }
  }

  if (content === "/bans") {
    let result: string = "";
    for (const player of Array.from(players.keys())) {
      if (players.get(player)!.length === 0) {
        result += player.toString() + "\n";
      } else {
        result +=
          player.toString() +
          " " +
          players
            .get(player)!
            .map((civ) => civ.name)
            .reduce((acc, curr) => `${acc} ${curr}`) +
          "\n";
      }
    }
    msg.channel.send(result);
    return;
  }

  if (content.startsWith("/ban")) {
    const configString = content.substring(5);
    const civs = configString.split(" ");

    const user = msg.author;

    // Check if author is player
    if (!players.has(user)) return;

    for (const civString of civs) {
      // Check if player has bans left
      if (players.get(user)?.length === config.numBans) return;
      const civ = civilizations.find((civ) =>
        civ.name.toLowerCase().startsWith(civString.toLowerCase()),
      );

      if (civ === undefined) {
        msg.channel.send(`No civ with name of ${civString} found.`);
        continue;
      }

      const bannedCivs = Array.from(players.values()).reduce((acc, curr) => [...acc, ...curr]);
      if (bannedCivs.includes(civ)) {
        msg.channel.send(`The civ ${civ.name} was already banned.`);
        continue;
      }

      players.set(user, [...players.get(user)!, civ]);
    }
  }

  if (content.startsWith("/unban")) {
    const configString = content.substring(7);
    const civs = configString.split(" ");

    const user = msg.author;

    // Check if author is player
    if (!players.has(user)) return;

    for (const civString of civs) {
      let civsOfPlayer = players.get(user)!;
      if (civsOfPlayer.length === 0) continue;

      const civ = civilizations.find((civ) =>
        civ.name.toLowerCase().startsWith(civString.toLowerCase()),
      );

      if (civ === undefined) {
        msg.channel.send(`No civ with name of ${civString} found.`);
        continue;
      }

      civsOfPlayer = civsOfPlayer.filter((c) => c.id !== civ?.id);

      players.set(user, civsOfPlayer);
    }
  }

  if (content === "/generate") {
    for (const player of Array.from(players.keys())) {
      if (players.get(player)!.length !== config.numBans) {
        msg.channel.send(`${player.toString()} has to ban!`);
        return;
      }
    }

    const bannedCivs = Array.from(players.values()).reduce((acc, curr) => [...acc, ...curr]);

    const civsToPick: Civilization[] = [];

    for (let i = 0; i < config.numPlayer; i++) {
      for (let j = 0; j < config.numCivilizations; j++) {
        while (true) {
          const randomID = Math.floor((civilizations.length - 1) * Math.random());
          if (bannedCivs.map((c) => c.id).includes(randomID)) continue;

          civsToPick.push(civilizations[randomID]);
          break;
        }
      }
    }

    let result: string = "";
    for (const player of Array.from(players.keys())) {
      result += player.toString() + " ";
      for (let i = 0; i < config.numCivilizations; i++) {
        result += civsToPick[i].name + " ";
      }
      result += "\n";
    }
    msg.channel.send(result);
  }
});

loadConfiguration();
loadCivilizations();

client.login(process.env.BOT_TOKEN);
