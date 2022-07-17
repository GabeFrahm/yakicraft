const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientID, testGuildID, token } = require('./config.json');

const commands = [
	new SlashCommandBuilder().setName('whitelist').setDescription('Add or remove a user from the whitelist!'),
	new SlashCommandBuilder().setName('status').setDescription('get server status and player count')
]

	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientID, testGuildID), { body: commands })
	.then(() => console.log('Successfully registered commands'))
	.catch(console.error);

