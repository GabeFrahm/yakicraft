const { Client, Intents } = require('discord.js');
const {token, rconPass, serverIP, updateInterval} = require('./config.json');

let isOnline = false;

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

	if (responsejson.error) {
		throw Error(responsejson.error);
	}
	return [responsejson.name, responsejson.id]
}

// Rcon functions
// TODO

// Discord Bot
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const statusInterval = setInterval(setPresence, updateInterval * 1000);
function setPresence() {
	serverStatus(serverIP).then(
		function(value) {
			client.user.setPresence({
				status: 'online',
				activities: [{
					name: `on ${value[0]} ${value[1]}/${value[2]}`
				}]
			});
			isOnline = true;
		},
		function(error) {
			client.user.setPresence({
				status: 'dnd',
				activities: {
					name: `${serverIP} offline`,
				}
			});
			isOnline = false;
		}
	);
	console.log("RUN PRESENCE!!!");
}

client.once('ready', () => {
	console.log('ready');
	setPresence();
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'status') {
		await interaction.reply('' + isOnline);
	} else if (commandName === 'whitelist') {
		// MAKE THIS INTO A FUNCTION
		// check to see if user id is in whitelist dictionary
		// if so: show current user and ask if want to override
		// write json
		// add to whitelist
		await interaction.reply('' + interaction.user.id);
	}
});

// login
client.login(token);
