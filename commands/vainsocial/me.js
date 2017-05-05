#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    api = require("../../api"),
    util = require("../../util");

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
        const player = await api.getPlayer(ign);
        // TODO refactor and build a blocking function via processor
        // TODO respond loading
        if (player == undefined) {
            const waiter = api.subscribeUpdates(ign);
            await api.searchPlayer(ign);

            let success = false, notif;
            // wait until search success
            while (true) {
                notif = await waiter.next();
                if (notif == "stats_update") break;
                if (notif == undefined) {
                    // give up
                    await progress(`Ooops! Could not find ${user}.`, true);
                    return;
                }
            }
        }
        await api.setUser(msg.author.id, ign);
        await msg.reply(oneLine`
You are now able to use ${util.usg(msg, "v")} to access your profile faster.
You now have access to Guild management features.
`);
    }
};
