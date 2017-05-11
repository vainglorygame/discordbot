#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util"),
    GuildAddView = require("../../views/guild_progress");

module.exports = class AddGuildMemberCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildadd",
            aliases: ["vguild-add", "vgadd", "vga"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildadd",
            description: "Register a member to your Guild.",
            details: oneLine`
Register IGNs to your Guild.
`,
            examples: ["vgadd StormCallerSr", "vgadd StormCallerSr shutterfly"],
            argsType: "multiple"
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-add");
        let playersStatus = {};
        const playersWaiters = args.map((name) => api.subscribeUpdates(name)),
            guildAddView = new GuildAddView(msg, playersStatus);
        // create waiter dict & data dict
        await Promise.each(playersWaiters, async (waiter, idx) => {
            await api.upsearchPlayer(args[idx]);
            let success = false;
            try {
                playersStatus[args[idx]] = "Loading…";
                do {
                    try {
                        await api.getPlayer(args[idx]);
                        success = true;
                    } catch (err) { }
                    await guildAddView.respond();
                } while (["stats_update", "matches_update", undefined]
                    .indexOf(await waiter.next()));
            } catch (err) {
                console.error(err);
                playersStatus[args[idx]] = err.error.err;
                success = false;
            }
            if (success) {
                await api.addToGuild(msg.author.id, args[idx]);
                playersStatus[args[idx]] = "Loaded.";
            }
        });
        await guildAddView.respond("Your Guild members were added.");
    }
};
