#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    util = require("../../util"),
    api = require("../../api"),
    GuildOverviewView = require("../../views/guild");

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
                min: 2,
                default: "?"
            } ]
        });
    }
    // show Guild details
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-view");
        const guildOverviewView = new GuildOverviewView(msg);
        try {
            const guild = await api.getGuild(msg.author.id);
            await guildOverviewView.respond(guild);
        } catch (err) {
            console.log(err);
            return await guildOverviewView.error(err.error.err);
        }
    }
};
