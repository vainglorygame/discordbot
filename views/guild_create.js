#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const emoji = require("discord-emoji"),
    View = require("./view"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const GuildCreateView = module.exports;

// match detail view
module.exports = class extends View {
    constructor(msg, user_token) {
        super(msg);
        this.user_token = user_token;
    }

    async text() {
        return `Guild created. You can now use ${util.usg(this.msg, "vgadd ign1 ign2 ignN")} to add members to your Guild.`;
    }

    async help() {
        return `*${emoji.symbols.information_source} or ${util.usg(this.msg, "vgview")} to view your Guild*`
    }

    async buttons() {
        let reactions = {};
        reactions[emoji.symbols.information_source] = async () => {
            util.trackAction(this.msg, "reaction-guildview");
            await new GuildOverviewView(this.msg).respond(this.user_token);
        };
        return reactions;
    }

    // TODO move to super class
    async respond() {
        this.response = await util.respond(this.msg,
            await this.text(), this.response);
        if (!this.hasButtons) {
            await util.reactionButtons(this.response,
                await this.buttons());
            this.hasButtons = true;
        }
        return this.response;
    };
}
