#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    responses = require("../../responses");

module.exports = class ShowMatchesCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-history",
            aliases: ["vh"],
            group: "vainsocial",
            memberName: "vainsocial-matches",
            description: "Show a user's match history.",
            details: oneLine`
                todo
            `,
            examples: ["vh shutterfly"],
            argsType: "single",

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your in game name (Case Sensitive).",
                type: "string",
                min: 3,
                max: 16
            } ]
        });
    }
    async run(msg, args) {
        await responses.showMatches(msg, args);
    }
};
