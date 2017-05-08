#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    util = require("../../util"),
    api = require("../../api"),
    strings = require("../../strings"),
    MatchesView = require("../../views/matches");

module.exports = class ShowMatchesCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-history",
            aliases: ["vh"],
            group: "vainsocial",
            memberName: "vainsocial-matches",
            description: "Shows a user's match history.",
            examples: ["vh shutterfly"],
            argsType: "single",

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
        util.trackAction(msg, "vainsocial-matches", args.name);
        const ign = await util.ignForUser(args.name, msg.author.id);
        if (ign == undefined) return await strings.unknown(msg);

        // peek
        const matchesView = new MatchesView(msg, ign);
        // wait for BE update
        const waiter = api.subscribeUpdates(ign);
        await api.upsearchPlayer(ign);

        do await matchesView.respond();
        while (await waiter.next() != undefined);
    }
};
