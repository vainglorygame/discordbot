#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    api = require("../../api"),
    util = require("../../util"),
    RegisterView = require("../../views/register");

module.exports = class RegisterUserCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-me",
            aliases: ["vme", "vgme"],
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
        util.trackAction(msg, "vainsocial-me", args.name);
        const registerView = new RegisterView(msg, args.name);
        await api.upsearchPlayer(args.name);
        try {
            await api.subscribeUpdates(args.name).next();
            await api.setUser(msg.author.id, args.name);
        } catch (err) {
            console.log(err);
            return await registerView.error(err.error.err);
        }
        await registerView.respond();
    }
};
