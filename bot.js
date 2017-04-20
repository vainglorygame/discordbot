#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const PREVIEW = process.env.PREVIEW || true;

const sqlite = require("sqlite"),
    path = require("path"),
    winston = require("winston"),
    loggly = require("winston-loggly-bulk"),
    Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    client = new Commando.Client({
        owners: ["227440521704898561", "208974925199966208"],
        // shutterfly, stormcaller
        commandPrefix: (PREVIEW? "?" : "!"),
        invite: "https://discord.gg/txTchJY",
        unknownCommandResponse: false
    }),
    responses = require("./responses");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN,
    LOGGLY_TOKEN = process.env.LOGGLY_TOKEN;

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            timestamp: true,
            colorize: true
        })
    ]
});

if (LOGGLY_TOKEN)
    logger.add(winston.transports.Loggly, {
        inputToken: LOGGLY_TOKEN,
        subdomain: "kvahuja",
        tags: ["frontend", "discordbot"],
        json: true
    });

client
    .on("error", logger.error)
    .on("warn", logger.warn)
    .on("debug", logger.info)
    .on("ready", () => {
        logger.info(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`);
        responses.rotateGameStatus(client);
    })
    .on('disconnect', () => { logger.warn('Disconnected!'); })
    .on('reconnecting', () => { logger.warn('Reconnecting...'); })
    .on('commandError', (cmd, err) => {
        if(err instanceof Commando.FriendlyError) return;
        logger.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
    })
    .on('commandBlocked', (msg, reason) => {
        logger.info(oneLine`
            Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ''}
            blocked; ${reason}
        `);
    })
    .on('commandPrefixChange', (guild, prefix) => {
        logger.info(oneLine`
            Prefix ${prefix === '' ? 'removed' : `changed to ${prefix || 'the default'}`}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    })
    .on('commandStatusChange', (guild, command, enabled) => {
        logger.info(oneLine`
            Command ${command.groupID}:${command.memberName}
            ${enabled ? 'enabled' : 'disabled'}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    })
    .on('groupStatusChange', (guild, group, enabled) => {
        logger.info(oneLine`
            Group ${group.id}
            ${enabled ? 'enabled' : 'disabled'}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    })

    // response reaction interface
    .on("messageReactionAdd", responses.onNewReaction);

client.setProvider(
    sqlite.open(path.join(__dirname, "settings.sqlite3")).then(
        db => new Commando.SQLiteProvider(db)));

client.registry
    .registerGroup('vainsocial', 'VainSocial')
    .registerDefaultTypes()
    .registerDefaultGroups()
    .registerDefaultCommands({ eval_: false, commandState: false })
    .registerCommandsIn(path.join(__dirname, 'commands'));


client.login(DISCORD_TOKEN);

process.on("unhandledRejection", err => {
    logger.error("Uncaught Promise Error", err);
});
