#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const View = require("./view"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings"),
    oneLine = require("common-tags").oneLine;

const GuildMembersProgressView = module.exports;

module.exports = class extends View {
    constructor(msg, players) {
        super(msg);
        this.players = players;
    }

    // players: obj, key=ign, value=player
    async text(players) {
        return Object.entries(players).map((tuple) =>
            (tuple[1] == undefined)?
                `Loading ${tuple[0]}…`
                : `Loaded ${tuple[0]}.`
            ).join("\n");
    }

    async respond(extra="") {
        this.response = await util.respond(this.msg,
            await this.text(this.players) + "\n" + extra, this.response);
        return this.response;
    };
}
