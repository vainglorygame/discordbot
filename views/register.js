#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const emoji = require("discord-emoji"),
    View = require("./view"),
    PlayerView = require("./player"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const RegisterView = module.exports;

// user register view
module.exports = class extends View {
    constructor(msg, ign) {
        super(msg);
        this.ign = ign;
    }

    async text() {
        return `You are now registered at VainSocial, ${this.msg.author.toString()}.`;
    }
    async help() {
        return `*${emoji.symbols.repeat} or ${util.usg(this.msg, "v")} to view your profile, ${util.usg(this.msg, "vgcreate")} to create a Guild*`
    }
    async buttons() {
        let reactions = {};
        reactions[emoji.symbols.repeat] = async () => {
            util.trackAction(this.msg, "reaction-player");
            await new PlayerView(this.msg, this.ign).respond();
        };
        return reactions;
    }
    async respond() {
        this.response = await util.respond(this.msg,
            await this.text() + "\n" + await this.help(), this.response);
        if (!this.hasButtons) {
            await util.reactionButtons(this.response,
                await this.buttons());
            this.hasButtons = true;
        }
        return this.response;
    };
}
