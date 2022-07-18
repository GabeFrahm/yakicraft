const { Client, Intents, MessageEmbed } = require('discord.js');
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

async function whitelist(arg, username, userid) {
	let curuser = null;

	// STEP 1
	if (users.has(userid)) {
		user(users.get(userid)).then(
			(value) => {
				curuser = value[0];
			}
		);
	}

	if (arg === 'add') {

		// STEP 2
		user(username).then(
			(value) => {
				users.set(userid, value[1]);
				console.log(users);
			},
			(error) => {
				return("That user doesn't exist!");
			}
		)

		// STEP 3
		rcon.connect().then(
			(value) => {
				rcon.send(`whitelist add ${username}`);
			},
			(error) => {
						return("Issue communicating with server! (I blame Ruby)");
			}
		);
		return(`Successfully added user ${username} to the whitelist!`)
	}

	if(!curuser) {
		return("You don't have a user assigned to remove!")
	}

	users.delete(userid);
	return(`Successfully removed ${curuser} from the whitelist`);
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
	setPresence();
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName, options } = interaction;

	if (commandName === 'status') {
		serverStatus(serverIP).then(
			(value) => {
							const embed = new MessageEmbed()
								.setColor('#12D900')
								.setTitle(serverIP)
								.setDescription(`Status: Online 🟢\nPlayers: ${value[1]}/${value[2]}`);
				interaction.reply({ embeds: [embed] });
			},
			(error) => {
							const embed = new MessageEmbed()
								.setColor('#FF0000')
								.setTitle(serverIP)
								.setDescription(`Status: Offline 🔴`);
				interaction.reply({ embeds: [embed] });
			},
		)
	} else if (commandName === 'whitelist') {
		interaction.reply(await whitelist(options.getSubcommand(), options.getString('username'), interaction.user.id));
		writeJson(users);
	}
});

// login
client.login(token);
