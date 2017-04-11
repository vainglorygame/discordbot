#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const sqlite = require("sqlite"),
    path = require("path"),
    Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    client = new Commando.Client({
        owner: "227440521704898561",  // shutterfly
        commandPrefix: "?"
    });

const DISCORDTOKEN = process.env.DISCORDTOKEN || "Mjg5ODM2OTAwOTg5MDA5OTIw.C6SLKA.j8UETpPHztDV45xicf11hwpwNK8";

client
    .on("error", console.error)
    .on("warn", console.warn)
    .on("debug", console.log)
    .on("ready", () => {
        console.log(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`);
    })
    .on('disconnect', () => { console.warn('Disconnected!'); })
    .on('reconnecting', () => { console.warn('Reconnecting...'); })
    .on('commandError', (cmd, err) => {
        if(err instanceof Commando.FriendlyError) return;
        console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
    })
    .on('commandBlocked', (msg, reason) => {
        console.log(oneLine`
            Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ''}
            blocked; ${reason}
        `);
    })
    .on('commandPrefixChange', (guild, prefix) => {
        console.log(oneLine`
            Prefix ${prefix === '' ? 'removed' : `changed to ${prefix || 'the default'}`}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    })
    .on('commandStatusChange', (guild, command, enabled) => {
        console.log(oneLine`
            Command ${command.groupID}:${command.memberName}
            ${enabled ? 'enabled' : 'disabled'}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
    `);
    })
    .on('groupStatusChange', (guild, group, enabled) => {
        console.log(oneLine`
            Group ${group.id}
            ${enabled ? 'enabled' : 'disabled'}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    });

client.setProvider(
    sqlite.open(path.join(__dirname, "settings.sqlite3")).then(
        db => new Commando.SQLiteProvider(db)));

client.registry
    .registerGroup('vainsocial', 'VainSocial')
    .registerDefaults()
    .registerCommandsIn(path.join(__dirname, 'commands'));


client.login(DISCORDTOKEN);
