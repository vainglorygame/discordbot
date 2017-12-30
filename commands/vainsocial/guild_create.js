#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    util = require("../../util"),
    api = require("../../api"),
    GuildCreateView = require("../../views/guild_create");

module.exports = class RegisterGuildCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildcreate",
            aliases: ["vguild-create", "vgcreate"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildcreate",
            description: "Register a new Guild.",
            details: oneLine`
Create a Guild with your VainSocial profile as leader.
`,
            examples: ["vguild-create MyAmazingGuild MAG eu"],

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your Guild's name.",
                type: "string",
                min: 3
            }, {
                key: "tag",
                label: "tag",
                prompt: "Please specify your Guild's tag.",
                type: "string",
                min: 2,
                max: 4
            }, {
                // TODO use enum
                key: "region",
                label: "region",
                prompt: "Please specify your Guild's region.",
                type: "string",
                min: 2,
                max: 10
            } ]
        });
    }
    // register a VainSocial Guild to a Discord account
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-create");
        const guildCreateView = new GuildCreateView(msg, msg.author.id);
        if (msg.guild.id != 283790513998659585)
            return await guildCreateView.error(oneLine`
Guilds creation is currently running in closed beta.
If you want to participate, join our development Discord: https://discord.gg/txTchJY
`);
        try {
            await api.post("/guild", {
                shard_id: args.region,
                name: args.name,
                identifier: args.tag,
                user_token: msg.author.id
            });
        } catch (err) {
            console.error(err);
            return await guildCreateView.error(err.error.err);
        }
        await guildCreateView.respond();
    }
};
