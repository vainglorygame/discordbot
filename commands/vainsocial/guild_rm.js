#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util"),
    GuildRmView = require("../../views/guild_progress");

module.exports = class AddGuildMemberCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildrm",
            aliases: ["vguild-rm", "vgrm", "vgr"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildrm",
            description: "Remove a member from your Guild.",
            details: oneLine`
Remove an IGN from your Guild.
`,
            examples: ["vgrm StormCallerSr", "vgrm StormCallerSr shutterfly"],
            argsType: "multiple"
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-rm");
        let playersData = {};
        const guildRmView = new GuildRmView(msg, playersData);
        try {
            await Promise.each(args, async (name) => {
                await api.removeFromGuild(msg.author.id, name);
                await guildRmView.respond();
            });
        } catch (err) {
            return await guildRmView.error(err.error.err);
        }
        await guildRmView.respond("Your Guild members were removed.");
    }
};
