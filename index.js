const { Client, Intents, MessageEmbed } = require('discord.js');
const {token, rconPass, rconIP, rconPort, serverIP, updateInterval} = require('./config.json');
const async = require('async');
const Rcon = require('modern-rcon');
const fs = require('fs');

let isOnline = false;
let users = readJson();

// rcon init
const rcon = new Rcon(rconIP, port = rconPort, rconPass, timeout = 5000);

// File tools

function readJson() {
	let map;
	try {
		// Now that's a hell of a one liner
		map = new Map(Object.entries(JSON.parse(fs.readFileSync('./bot_whitelist.json', 'utf8'))));
	} catch (err) {
		map = new Map();
	}
	return map;
	
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

async function getUser(user) {
	const response = await fetch('https://api.minetools.eu/uuid/' + user);
	const responsejson = await response.json();

	if (responsejson.status === 'ERR') {
		throw Error('ERR');
	}
	return [responsejson.name, responsejson.id]
}

async function whitelist(arg, username, userID){
	// NOTE: users is an object full of Discord User IDs paired with Minecraft UUIDs

	// STEP 1: Get current user if it exists
	let message = new Promise((resolve, reject) => {
		let curuser = null;
		if (users.has(userID)) {
			curuser = users.get(userID);
		}

		let exit = false;
		async.series([
			function(callback) {
				// STEP 2: Check if server is online. If not return an error message
				rcon.send('list').then(
					(value) => {
						callback();
					},
					(error) => {
						resolve('Server is offline. Try again later');
						exit = true;
						callback();
					}
				);
			},

			function(callback) {
				// STEP 3: If arg == add, remove current user and add the new user. DO NOT DO
				// THESE THINGS IF THE USER IS ALREADY ON THE WHITELIST
				if (exit) {callback();}

				else if (arg === 'add') {
					let user = null;
					getUser(username).then(
						(value) => {
							user = value;
							if (Array.from(users.values()).indexOf(user[1]) != -1) {
								resolve('That user is already on the whitelist!');
								exit = true;
							}
							else {
								if (curuser) {
									users.delete(userID);
									getUser(curuser).then(
										(value) => {
											rcon.send(`whitelist remove ${value[0]}`);
										}
									);
								}
								rcon.send(`whitelist add ${user[0]}`);
								users.set(userID, user[1]);
								resolve(`Successfully added ${user[0]} to the whitelist`);
								callback();
							}
						},
						(error) => {
							resolve('That user doesn\'t exist!');
							exit = true;
						}
					);
				}
				else {callback();}
			},

			function(callback) {
				// STEP 4: if arg == remove and there is a current user, remove them. Otherwise return an error message.
				if (exit) {callback();}
				else if (arg === 'remove') {
					if (curuser) {
						getUser(curuser).then(
							(value) => {
								rcon.send(`whitelist remove ${value[0]}`);
								resolve(`Removed ${value[0]} from the whitelist.`);
								users.delete(userID);
								callback();
							}
						);
					}
					else {
						resolve('You don\'t have a user whitelisted!');
						exit = true;
					}
				}
				else { 
					callback(); 
				}
			}
		]);
	});

	return(message);
}

async function mcQuery(mcUser) {
	let promise = new Promise((resolve, reject) => {
		let mcUsers = Array.from(users.values());
		getUser(mcUser).then(
			(value) => {
				let index = mcUsers.indexOf(value[1]); 
				if (index >= 0) {
					// holy one liner! returns discord user
					client.users.fetch(Array.from(users.keys())[index]).then(
						(value) => { resolve(`${value} is ${mcUser}`); }
					);
				}
				else {
					resolve('That user isn\'t on the whitelist!');
				}
			},
			(error) => {
				resolve('That user doesn\'t exist');
			}
		)
	});

	return(promise);
}

async function userQuery(discordUser) {
	let promise = new Promise((resolve, reject) => {
		let mcUUID = users.get(discordUser.id);
		if (mcUUID) {
			getUser(mcUUID).then(
				(value) => {resolve(`${(value[0])} is ${discordUser}`);}
			)
		}
		else {
			resolve("This user doesn't have a name on the whitelist!");
		}
	});
	return(promise);
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
			if (!isOnline) {
				// re-establish rcon connection if server was offline
				rcon.connect();
			}
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
		await interaction.deferReply();
		whitelist(options.getSubcommand(), options.getString('username'), interaction.user.id).then(
			(value) => {interaction.editReply(value);}
		)
		.then(
			(value) => {writeJson(users);}
		);
	} else if (commandName === 'user') {
		if (options.getSubcommand() === 'mc') {
			await interaction.deferReply();
			mcQuery(options.getString('username')).then(
				(value) => {
					interaction.editReply({content: value, ephemeral: true });
				}
			)
		}
		else {
			await interaction.deferReply();
			userQuery(options.getUser('user')).then(
				(value) => {
					interaction.editReply({content: value, ephemeral: true });
				}
			)
		}
	}
});

// login
client.login(token);
