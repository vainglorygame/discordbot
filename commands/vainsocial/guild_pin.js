#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    util = require("../../util"),
    api = require("../../api"),
    SimpleView = require("../../views/simple");

module.exports = class PinGuildCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildpin",
            aliases: ["vguild-pin", "vgpin"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildpin",
            description: "Share your Guild on a server.",
            examples: ["vgview"],

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your Guild's name.",
                type: "string",
                min: 2,
                default: "?"
            } ]
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-pin");
        const pinView = new SimpleView(msg);
        if (!msg.member.hasPermission('ADMINISTRATOR'))
            return await pinView.error("You need to be server administrator to pin a GUild.");
        let guild;
        try {
            guild = await api.getGuild(msg.author.id);
        } catch (err) {
            console.log(err);
            return await guildOverviewView.error(err.error.err);
        }
        msg.guild.settings.set("default-guild-name", guild.name);
        await pinView.respond(`Successfully pinned the Guild \`${guild.name}\` to your server.`);
    }
};
