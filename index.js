const { Client, Intents } = require('discord.js');
const {token, rconPass, rconIP, rconPort, serverIP, updateInterval} = require('./config.json');
const Rcon = require('modern-rcon');
const fs = require('fs');

let isOnline = false;
let users = readJson();

// rcon init
const rcon = new Rcon(rconIP, port = rconPort, rconPass, timeout = 5000);

// File tools

function readJson() {
	const result = JSON.parse(fs.readFileSync('./bot_whitelist.json', 'utf8'));
	return new Map(Object.entries(result));
	
}

function writeJson(map) {
	let obj = Object.fromEntries(map);
	fs.writeFile('./bot_whitelist.json', JSON.stringify(obj), err => {
		if (err) {
			console.error(err);
		}
	});
}

// Minetools api calls
async function serverStatus(server) {
	const response = await fetch('https://api.minetools.eu/ping/' + server);
	const responsejson = await response.json();

	if (responsejson.error) {
		throw Error(responsejson.error);
	}
	return [server, responsejson.players.online, responsejson.players.max]
}

async function user(user) {
	const response = await fetch('https://api.minetools.eu/uuid/' + user);
	const responsejson = await response.json();

	if (responsejson.status === 'ERR') {
		throw Error('ERR');
	}
	return [responsejson.name, responsejson.id]
}


function whitelist(arg, username, userid) {
	if (users.has(userid)) {
		user(users.get(userid)).then(
			(value) => {
				rcon.send(`whitelist remove ${value[0]}`).then(
					(error) => {
						return("Issue communicating with server! (I blame Ruby)");
					}
				);
			},
		);
		users.delete(userid);
	}

	if (arg === 'add') {
		rcon.send(`whitelist add ${username}`).then(
			(error) => {
				return("Issue communicating with server! (I blame Ruby)")
			}
		);

		user(username).then(
			(value) => {
				users.set(userid, value[1]);
				console.log(users);
			},
			(error) => {
				return("That user doesn't exist!");
			}
		)

		return(`Successfully added user ${username} to the whitelist!`)
	}

	return('Successfully removed your user from the whitelist');
}

// Discord Bot
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const statusInterval = setInterval(setPresence, updateInterval * 1000);
function setPresence() {
	serverStatus(serverIP).then(
		(value) => {
			client.user.setPresence({
				status: 'online',
				activities: [{
					name: `on ${value[0]} ${value[1]}/${value[2]}`
				}]
			});
			isOnline = true;
		},
		(error) => {
			client.user.setPresence({
				status: 'idle',
				activities: {
					name: `${serverIP} offline`,
				}
			});
			isOnline = false;
		}
	);
}

client.once('ready', () => {
	console.log('Ready!');
	rcon.connect();
	setPresence();
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName, options } = interaction;

	if (commandName === 'status') {
		serverStatus(serverIP).then(
			(value) => {
				interaction.reply(`${serverIP}\nStatus: Online 🟢\nPlayers: ${value[1]}/${value[2]}`);
			},
			(error) => {
				interaction.reply(`${serverIP}\nStatus: Offline 🔴`);
			},
		)
	} else if (commandName === 'whitelist') {
		await interaction.reply(whitelist(options.getSubcommand(), options.getString('username'), interaction.user.id));
		writeJson(users);
	}
});

// login
client.login(token);
