#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    responses = require("../../responses");

module.exports = class RememberUserCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-me",
            aliases: ["vme"],
            group: "vainsocial",
            memberName: "vainsocial-me",
            description: "Remembers a users's in game name.",
            details: oneLine`
Store your in game name for quicker access to other commands.
            `,
            examples: ["vme shutterfly"],

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
        await responses.rememberUser(msg, args);
    }
};
