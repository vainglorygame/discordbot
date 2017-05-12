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
            }, {
                key: "guild",
                label: "guild",
                prompt: "Please specify a Guild's name.",
                type: "string",
                min: 2,
                default: "?"
            } ]
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-guild-member");
        const guildMemberView = new GuildMemberView(msg);
        // get IGN or default
        let ign;
        try {
            ign = await util.ignForUser(args.name, msg.author.id);
        } catch (err) {
            return await guildMemberView.error(strings.unknown(msg));
        }
        // get guild: name, server default, self
        let guildName = args.guild, guild;
        if (guildName == "?") {
            guildName = msg.guild.settings.get("default-guild-name");
        }

        try {
            let members;
            // TODO.
            if (guildName == undefined) members = (await api.getGuild(msg.author.id)).members;
            else members = await api.getGuildMembersByGuildName(guildName);
            console.log(guildName);
            if (members.length == 0)
                throw { error: { err: "Could not find that Guild." } };

            const member = members.filter((m) => m.player.name == args.name)[0];
            if (member == undefined)
                throw { error: { err: "Player is not in the Guild." } };
            const player = await api.getPlayer(member.player.name);
            const matches = await api.getMatches(player.name);
            await guildMemberView.respond(member, player, matches);
        } catch (err) {
            console.error(err);
            return await guildMemberView.error(err.error.err);
        }
    }
};
