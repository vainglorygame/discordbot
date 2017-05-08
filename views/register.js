#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const RegisterView = module.exports;

// user register view
module.exports = class extends View {
    async text() {
        return `You are now registered at VainSocial, ${this.msg.author.mention}.`;
    }
    async help() {
        return `*${emoji.symbols.repeat} or ${util.usg(this.msg, "v")} to view your profile, ${util.usg(this.msg, "vgcreate")} to create a Guild*`
    }
    async buttons() {
        let reactions = {};
        reactions[emoji.symbols.repeat] = async () => {
            util.trackAction(this.msg, "reaction-player");
            const ign = await util.ignForUser(undefined, this.msg.author.id);
            await new PlayerView(this.msg, ign).respond();
        };
        return reactions;
    }
    async respond() {
        await api.setUser(msg.author.id, ign);
        this.response = await util.respond(this.msg,
            await this.text(), this.response);
        if (!this.hasButtons) {
            await util.reactionButtons(this.response,
                await this.buttons(player, matches));
            this.hasButtons = true;
        }
        return this.response;
    };
}
