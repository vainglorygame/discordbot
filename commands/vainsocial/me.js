#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    request = require("request-promise"),
    util = require("../../util");

const API_FE_URL = process.env.API_FE_URL || "http://vainsocial.dev/bot/api";

module.exports = class RegisterUserCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-me",
            aliases: ["vme"],
            group: "vainsocial",
            memberName: "vainsocial-me",
            description: "Register a users's in game name.",
            details: oneLine`
Store your in game name for quicker access to other commands and for Guild management.
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
    // register a Discord account at VainSocial
    async run(msg, args) {
        const ign = args.name;
        util.trackAction(msg, "vainsocial-me", ign);
        await request.post(API_FE_URL + "/user", {
            forever: true,
            form: {
                name: ign,
                user_token: msg.author.id
            }
        });
        await msg.reply(oneLine`
You are now able to use ${util.usg(msg, "v")} to access your profile faster.
You now have access to Guild management features.
`);
    }
};
