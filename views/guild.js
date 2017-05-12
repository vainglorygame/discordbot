#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    GuildMemberView = require("./guild_member"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    Promise = require("bluebird"),
    oneLine = require("common-tags").oneLine;

const GuildOverviewView = module.exports;

// match detail view
module.exports = class extends View {
    text(members) {
        // TODO remove when API supports server side sort
        return members.sort((m1, m2) => m1.fame < m2.fame).map((m) =>
            new GuildMemberView().text(m)).join("\n");
    }

    async embed(guild) {
        const embed = util.vainsocialEmbed(`${guild.name} - ${guild.shard_id}`,
            "", "vainsocial-guild-view")
            .setDescription(await this.text(guild.members));
        return embed;
    }

    async respond(guild, extra="") {
        this.response = await util.respond(this.msg,
            await this.embed(guild), this.response);
        return this.response;
    }
}
