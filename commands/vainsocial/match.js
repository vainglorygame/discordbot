#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    responses = require("../../responses");

module.exports = class ShowMatchCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-match",
            aliases: ["vm"],
            group: "vainsocial",
            memberName: "vainsocial-match",
            description: "Show a user's match in detail.",
            details: oneLine`
                todo
            `,
            examples: ["vm shutterfly 1"],
            argsType: "multiple",
            argsCount: 2,

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your in game name (Case Sensitive).",
                type: "string"
            }, {
                key: "number",
                label: "number",
                prompt: "Please specify how far you want to go back in history. Use 1 or leave out for the latest match.",
                type: "integer",
                default: 1
            } ]
        });
    }
    async run(msg, args) {
        await responses.showMatch(msg, args);
    }
};
