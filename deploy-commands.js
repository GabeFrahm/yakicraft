const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientID, testGuildID, token } = require('./config.json');

const commands = [
	new SlashCommandBuilder()
		.setName('whitelist')
		.setDescription('Add or remove a user from the whitelist!')
		.addSubcommand(option =>
			option.setName('add')
				.setDescription('Add a user to whitelist')
				.addStringOption(option2 =>
					option2.setName('username')
						.setDescription('username to be whitelisted')
						.setRequired(true)
				)
		)
		.addSubcommand(option =>
			option.setName('remove')
				.setDescription('Remove your user from the whitelist')
		),
		
	new SlashCommandBuilder()
		.setName('status')
		.setDescription('get server status and player count'),

	new SlashCommandBuilder()
		.setName('user')
		.setDescription('get the mc username associated with a Yakicord user or vice versa')
		.addSubcommand(option =>
			option.setName('yakicord')
				.setDescription('Get mc user associated with a Yakicord user')
				.addUserOption(option2 =>
					option2.setName('user')
						.setDescription('Yakicord user')
						.setRequired(true)
				)
		)
		.addSubcommand(option =>
			option.setName('mc')
				.setDescription('Get Yakicord user associated with an mc user')
				.addStringOption(option2 =>
					option2.setName('username')
						.setDescription('mc user')
						.setRequired(true)
				)
		)
]

	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientID, testGuildID), { body: commands })
	.then(() => console.log('Successfully registered commands'))
	.catch(console.error);

