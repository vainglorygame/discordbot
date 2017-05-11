#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    PlayerView = require("./player"),
    MatchesView = require("./matches"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const GuildMemberView = module.exports;

// combined fame + profile + last match
module.exports = class extends View {
    text(member) {
        return `${member.player.name} | ${member.status} | ${member.fame} VS Fame`;
    }

    async embed(member, player, matches) {
        const embed = util.vainsocialEmbed(`${member.player.name} - ${member.player.shard_id}`,
            "", "vainsocial-guild-memberview")
            .addField("Guild Profile", await this.text(member))
            .addField("Player Profile", await new PlayerView().text(player))
            .addField("Last Match", await new MatchesView().text(matches[0]));
        return embed;
    }

    async respond(member, player, matches) {
        this.response = await util.respond(this.msg,
            await this.embed(member, player, matches), this.response);
        return this.response;
    }
}
