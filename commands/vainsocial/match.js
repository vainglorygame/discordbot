#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const Commando = require("discord.js-commando"),
    oneLine = require("common-tags").oneLine,
    util = require("../../util"),
    api = require("../../api"),
    strings = require("../../strings"),
    MatchView = require("../../views/match");

module.exports = class ShowMatchCommand extends Commando.Command {
    constructor(client) {
        super(client, {
            name: "vainsocial-match",
            aliases: ["vm"],
            group: "vainsocial",
            memberName: "vainsocial-match",
            description: "Shows a user's match in detail.",
            examples: ["vm shutterfly 1"],
            argsType: "multiple",
            argsCount: 2,

            args: [ {
                key: "name",
                label: "name",
                prompt: "Please specify your in game name (Case Sensitive).",
                type: "string",
                default: "?",
                min: 3,
                max: 16
            }, {
                key: "number",
                label: "number",
                prompt: "Please specify how far you want to go back in history. Use 1 or leave out for the latest match.",
                type: "integer",
                default: 1,
                min: 1,
                max: 10
            } ]
        });
    }
    async run(msg, args) {
        util.trackAction(msg, "vainsocial-match", args.name);
        const ign = await util.ignForUser(args.name, msg.author.id);
        if (ign == undefined) return await msg.say(strings.unknown(msg));

        const participations = await api.getMatches(ign);
        if (args.number > participations.length)
            return await msg.say(strings.tooFewMatches(ign));
        const matchView = new MatchView(msg,
            participations[args.number-1].match_api_id);
        // wait for BE update
        const waiter = api.subscribeUpdates(ign);
        await api.upsearchPlayer(ign);

        do await matchView.respond();
        while (await waiter.next() != undefined);
    }
};
