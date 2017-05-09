#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util"),
    GuildMembersProgressView = require("../../views/guild_progress");

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
        let playersData = {};
        const playersWaiters = args.map((name) => api.subscribeUpdates(name)),
            guildUpdateView = new GuildMembersProgressView(msg, playersData);
        // create waiter dict & data dict
        await Promise.map(playersWaiters, async (waiter, idx) => {
            await api.updatePlayer(args[idx]);
            let success = false;
            while (await waiter.next() != undefined) {
                playersData[args[idx]] = await api.getPlayer(args[idx]);
                await guildUpdateView.respond();
                success = true;
            }
        });
        await guildUpdateView.respond("Your Guild's fame is being updated…");
        await api.calculateGuild(guild.id, msg.author.id);
        await guildUpdateView.respond("Your Guild was updated.");
    }
};
