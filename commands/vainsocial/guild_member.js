#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    Promise = require("bluebird"),
    api = require("../../api"),
    util = require("../../util"),
    GuildMemberView = require("../../views/guild_member");

module.exports = class ViewGuildMemberCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-guildmember",
            aliases: ["vguild-member", "vgm"],
            group: "vainsocial-guild",
            memberName: "vainsocial-guildmember",
            description: "View a Guild member in detail.",
            examples: ["vgm StormCallerSr"],
            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify a Guild member's name.",
                type: "string",
                min: 2,
                default: "?"
            } ]
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-member");
        const guildMemberView = new GuildMemberView(msg);
        try {
            const guild = await api.getGuild(msg.author.id);
            const member = guild.members.filter((m) => m.player.name == args.name)[0];
            if (member == undefined)
                throw { err: { error: "Player is not in the Guild." } };
            const player = await api.getPlayer(member.player.name);
            const matches = await api.getMatches(player.name);
            await guildMemberView.respond(member, player, matches);
        } catch (err) {
            console.error(err);
            return await guildMemberView.error(err.error.err);
        }
    }
};
