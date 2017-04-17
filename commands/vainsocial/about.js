#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    responses = require("../../responses");

module.exports = class ShowAboutCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "about",
            group: "vainsocial",
            memberName: "about",
            description: "Shows invite links and developer contact details."
        });
    }
    async run(msg) {
        await responses.showAbout(msg);
    }
};
