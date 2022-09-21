const { Client, Partials, Intents, MessageEmbed } = require('discord.js');
const {token, rconPass, rconIP, rconPort, serverIP, updateInterval, xapiKey, allowedRoles} = require('./config.json');
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

// Bedrock api calls
const XapiOptions = {
	headers: {
		'X-AUTH': xapiKey
	}
}

async function getBedUser(xuid) {
	const response = await fetch('https://xapi.us/v2/gamertag/' + xuid, XapiOptions);
	const responsetext = await response.text();
	if (responsetext.length == 0) {
		throw Error('ERR');
	} else {
		return(responsetext);
	}
}

async function getBedXuid(gamertag) {
	const response = await fetch('https://xapi.us/v2/xuid/' + gamertag, XapiOptions);
	const responsetext = await response.text();
	if (responsetext[0] === '{') {
		throw Error('ERR');
	} else {
		return(responsetext);
	}
}

function xuidToFloodUUID(xuid){
	// Floodgate UUIDs are slightly different than Xbox XUIDs...
	// number to hex
	let hexuser = Number(xuid).toString(16);

	// pad to 16 characters
	hexuser = hexuser.padStart(16, '0');

	// Finally, Floodgate UUID formatting
	hexuser = `00000000-0000-0000-${hexuser.substring(0,4)}-${hexuser.substring(4)}`;
	return hexuser;
}

async function whitelist(arg, username, userID, bedrock){
	// TODO: THIS METHOD NEEDS OPTIMIZATION. It's functional, but COULD BE
	// BETTER!!! (and more readable)
	// STEP 1: Get current user if it exists
	let message = new Promise((resolve, reject) => {
		let curuser = null;
		let user = null;
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
						resolve('Server is offline (I blame Ruby). Try again later');
						exit = true;
						callback();
					}
				);
			},

			function(callback) {
				// prepare to add
				if (exit) {callback();}

				else if (arg === 'add') {
					// JAVA USER
					if (!bedrock) {
						getUser(username).then(
							(value) => {
								user = value;
								let arr = Array.from(users.values()).filter( (el) => {
									return !!~el.indexOf( user[1] );
								});

								if (arr.length > 0 && arr[0][0] === 'Java') {
									resolve('That user is already on the whitelist!');
									exit = true;
								}
								else {
									if (curuser) {
										users.delete(userID);
										getUser(curuser[1]).then(
											(value) => {
												// REMOVING JAVA USER
												rcon.send(`whitelist remove ${value[0]}`).then(
													(value) => {callback();}
												);
											},
											(err) => {
												// REMOVING BEDROCK USER
												rcon.send(`fwhitelist remove ${xuidToFloodUUID(curuser[1])}`).then(
													() => {callback();}
												);
											}
										);
									}
									else {callback();}
								}
							},
							(error) => {
								resolve('That user doesn\'t exist!');
								exit = true;
								callback();
							}
						);
					} else {
						getBedXuid(username).then(
							(value) => {
								user = value;
								let arr = Array.from(users.values()).filter( (el) => {
									return !!~el.indexOf( user );
								});

								if (arr.length != 0 && arr[0][0] === 'Bedrock') {
									resolve('That user is already on the whitelist!');
									exit = true;
									callback();
								}
								else {
									if (curuser) {
										users.delete(userID);
										getUser(curuser[1]).then(
											(value) => {
												// REMOVING JAVA USER
												rcon.send(`whitelist remove ${value[0]}`).then(
													(value) => {callback();}
												);
											},
											(err) => {
												// REMOVING BEDROCK USER
												rcon.send(`fwhitelist remove ${xuidToFloodUUID(curuser[1])}`).then(
													(value) => {callback();}
												);
											}
										);
									}
									else {callback();}
								}
							},
							(err) => {
								resolve('That user doesn\'t exist!');
								exit = true;
								callback();
							}
						)
					}
				}
				else {callback();}
			},

			function(callback) {
				// add new user
				if (exit) {callback();}
				else if (arg === 'add') {
					if (bedrock) {
						// ADDING BEDROCK USER
						// Floodgate UUIDs are slightly different than Xbox XUIDs...
						rcon.send(`fwhitelist add ${xuidToFloodUUID(user)}`);
						users.set(userID, ['Bedrock', user]);
						resolve(`Successfully added ${username} to the whitelist`);
					}
					else {
						// ADDING JAVA USER
						rcon.send(`whitelist add ${user[0]}`);
						users.set(userID, ['Java', user[1]]);
						resolve(`Successfully added ${user[0]} to the whitelist`);
					}
					callback();
				}
				else {callback();}
			},

			function(callback) {
				// STEP 4: if arg == remove and there is a current user, remove them. Otherwise return an error message.
				if (exit) {callback();}
				else if (arg === 'remove') {
					if (curuser) {
						// JAVA REMOVE
						if (curuser[0] === 'Java') {
							getUser(curuser[1]).then(
								(value) => {
									rcon.send(`whitelist remove ${value[0]}`);
									resolve(`Removed ${value[0]} from the whitelist.`);
									users.delete(userID);
									callback();
								}
							);
						}
						// BEDROCK REMOVE
						else {
							getBedUser(curuser[1]).then(
								(value) => {
									rcon.send(`fwhitelist remove ${xuidToFloodUUID(curuser[1])}`);
									resolve(`Removed ${value} from the whitelist.`);
									users.delete(userID);
									callback();
								}
							);
						}
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

async function userQuery(discordUser) {
	let promise = new Promise((resolve, reject) => {
		let mcUUID = users.get(discordUser.id);
		if (mcUUID && mcUUID[0] === 'Java') {
			getUser(mcUUID[1]).then(
				(value) => {resolve(`${mcUUID[0]} user ${(value[0])} is ${discordUser}`);}
			)
		}
		else if (mcUUID && mcUUID[0] === 'Bedrock') {
			getBedUser(mcUUID[1]).then(
				(value) => {resolve(`${mcUUID[0]} user ${(value)} is ${discordUser}`);}
			)
		}
		else {
			resolve("This user doesn't have a name on the whitelist!");
		}
	});
	return(promise);
}
	

// Discord Bot
const client = new Client({ intents: [Intents.FLAGS.GUILDS, "GUILD_MEMBERS"], partials: ["GUILD_MEMBER"] });

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

// remove users from whitelist when subs expire
client.on('guildMemberUpdate', (oldMember, newMember) => {
	let allowed = false;
	newMember.roles.cache.forEach( (item) => {
		if (allowedRoles.includes(item.id)) {
			allowed = true
		}
	});

	// TODO: Create a queue system for this
	if (!allowed) {
		whitelist('remove', null, newMember.id, null);
	}
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
		whitelist(options.getSubcommand(), options.getString('username'), interaction.user.id, options.getBoolean('bedrock')).then(
			(value) => {interaction.editReply(value);}
		)
		.then(
			(value) => {writeJson(users);}
		);
	} else if (commandName === 'user') {
		if (options.getSubcommand() === 'mc') {
			/*
			await interaction.deferReply({ ephemeral: true });
			mcQuery(options.getString('username')).then(
				(value) => {
					interaction.editReply({content: value, ephemeral: true });
				}
			)
			*/
			interaction.reply('Todo haha :) (spam @ Gabe#4478 to do it)');
		}
		else {
			await interaction.deferReply({ ephemeral: true });
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
