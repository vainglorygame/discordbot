#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util");

module.exports = class UpdateGuildCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildupdate",
            aliases: ["vguild-update", "vgupdate"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildupdate",
            description: "Update your Guild members' data.",
            details: oneLine`
Update the match history for all your Guild members.
`,
            examples: ["vgupdate"]
        });
    }
    // internal / premium: immediately call backend player refresh
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-update");
        const guild = await api.getGuild(msg.author.id);
        if (guild == undefined) {
            await msg.reply("You are not registered in any guilds.");
            return;
        }
        // TODO progress report
        await Promise.map(guild.members,
            (member) => api.upsearchPlayer(member.player.name));
        await msg.reply("Your Guild members will be up to date soon.");
    }
};
