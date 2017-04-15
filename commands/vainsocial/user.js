#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    responses = require("../../responses");

module.exports = class ShowUserCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-user",
            aliases: ["v", "vu"],
            group: "vainsocial",
            memberName: "vainsocial-user",
            description: "Show a player\'s profile.",
            details: oneLine`
                Display VainSocial lifetime statistics from Vainglory
            `,
            examples: ["vu shutterfly"],

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
        await responses.showUser(msg, args);
    }
};
