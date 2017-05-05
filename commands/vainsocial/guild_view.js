#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    api = require("../../api"),
    util = require("../../util");

module.exports = class ViewGuildCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildview",
            aliases: ["vguild-view", "vgview", "vgv"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildview",
            description: "View members of a Guild.",
            details: oneLine`
Show a summary of your Guild.
`,
            examples: ["vgview"],

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your Guild's name.",
                type: "string",
                min: 3,
                default: "?"
            } ]
        });
    }
    // show Guild details
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-view");
        // get this user's guild
        const guild = await api.getGuild(msg.author.id);
        if (guild == undefined) {
            await msg.reply("You are not registered in any guilds.");
            return;
        }
        // build response
        let response = "";
        response += `${guild.name} (${guild.shard_id})\n`;
        guild.members.forEach((member) => {
            response += `${member.player.name}: ${member.fame} VainSocial Fame\n`;
        });
        await msg.say(response);
    }
};
