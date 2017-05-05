#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    api = require("../../api"),
    util = require("../../util");

module.exports = class CalculateGuildFameCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildcalc",
            aliases: ["vguild-calc", "vgcalc", "vgc"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildcalc",
            description: "Update your Guild's fame.",
            details: oneLine`
Recalculate your Guild members' fame.
`,
            examples: ["vgcalc"]
        });
    }
    // internal / premium: immediately call backend fame refresh
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-calculate");
        const guild = await api.getGuild(msg.author.id);
        if (guild == undefined) {
            await msg.reply("You are not registered in any guilds.");
            return;
        }
        await msg.reply("Your Guild members' fame will be updated soon…");
        await api.calculateGuild(guild.id, msg.author.id);
        await msg.reply("Your Guild members' fame has been updated.");
    }
};
