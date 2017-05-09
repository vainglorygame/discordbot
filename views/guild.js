#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const GuildOverviewView = module.exports;

// match detail view
module.exports = class extends View {
    async text(members) {
        // TODO remove when API supports order by fame
        members = members.sort((m1, m2) => m1.fame < m2.fame);
        return members.map((member) =>
            `${member.player.name} ${member.fame}`).join("\n");
    }

    async embed(guild) {
        const embed = util.vainsocialEmbed(`${guild.name} - ${guild.shard_id}`,
            "", "vainsocial-guild-view")
            .setDescription(await this.text(guild.members));
        return embed;
    };

    async respond(guild) {
        if (guild == undefined) {
            this.response = await util.respond(this.msg,
                strings.notRegistered, this.response);
            return this.response;
        }
        this.response = await util.respond(this.msg,
            await this.embed(guild), this.response);
        return this.response;
    };
}
