#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util"),
    GuildAddView = require("../../views/guild_add");

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
    // register a VainSocial Guild to a Discord account
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-add");
        let playersData = {};
        const playersWaiters = args.map((name) => api.subscribeUpdates(name)),
            guildAddView = new GuildAddView(msg, playersData);
        // create waiter dict & data dict
        await Promise.map(playersWaiters, async (waiter, idx) => {
            await api.upsearchPlayer(args[idx]);
            let success = false;
            while (await waiter.next() != undefined) {
                playersData[args[idx]] = await api.getPlayer(args[idx]);
                await guildAddView.respond();
                success = true;
            }
            if (success) {
                await api.addToGuild(msg.author.id, args[idx]);
            }
        });
    }
};
