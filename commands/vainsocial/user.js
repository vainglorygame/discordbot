#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    emoji = require("discord-emoji"),
    util = require("../../util"),
    strings = require("../../strings"),
    api = require("../../api"),
    PlayerView = require("../../views/player");

module.exports = class ShowUserCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-user",
            aliases: ["v", "vu"],
            group: "vainsocial",
            memberName: "vainsocial-user",
            description: "Shows a player\'s profile.",
            details: oneLine`
Display VainSocial lifetime statistics from Vainglory
            `,
            examples: ["vu shutterfly"],

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your in game name (Case Sensitive).",
                type: "string",
                default: "?",
                min: 3,
                max: 16
            } ]
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-user", args.name);
        let ign;
        try {
            ign = await util.ignForUser(args.name, msg.author.id);
        } catch (err) {
            return await new PlayerView(msg, args.name).error(strings.unknown(msg));
        }

        const playerView = new PlayerView(msg, ign);
        try {
            // wait for BE update
            const waiter = api.subscribeUpdates(ign);
            await api.upsearchPlayer(ign);

            do await playerView.respond();
            while (await waiter.next() != undefined);
        } catch (err) {
            console.log(err);
            return await playerView.error(err.error.err);
        }
    }
};
