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
        // obj of ign: player
        let playersData = {};
        // collect an array of IGNs
        let names, guild;
        const guildUpdateView = new GuildMembersProgressView(msg,
            playersData);
        try {
            guild = await api.getGuild(msg.author.id);
            names = guild.members.map((m) => m.player.name);
        } catch (err) {
            console.log(err);
            return await guildUpdateView.error(err.error.err);
        }
        // update all the IGNs
        const playersWaiters = names.map((name) => api.subscribeUpdates(name));
        // create waiter dict & data dict
        await Promise.each(playersWaiters, async (waiter, idx) => {
            await api.updatePlayer(names[idx]);
            let success = false;
            while (["stats_update", undefined].indexOf(await waiter.next())) {
                try {
                    playersData[names[idx]] = await api.getPlayer(names[idx]);
                } catch (err) {
                    playersData[names[idx]] = undefined;
                }
                await guildUpdateView.respond();
                success = true;
            }
        });
        await guildUpdateView.respond("Your Guild's fame is being updated…");
        try {
            await api.calculateGuild(guild.id, msg.author.id);
        } catch (err) {
            console.log(err);
            await guildUpdateView.error(err.error.err);
        }
        await guildUpdateView.respond("Your Guild was updated.");
    }
};
