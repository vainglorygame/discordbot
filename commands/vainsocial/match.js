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
        let ign;
        try {
            ign = await util.ignForUser(args.name, msg.author.id);
        } catch (err) {
            return await new MatchView(msg, undefined).error(strings.unknown(msg));
        }

        const matchView = new MatchView(msg);
        try {
            const participations = await api.getMatches(ign);
            if (args.number > participations.length)
                return await msg.say(strings.tooFewMatches(ign));
            // wait for BE update
            const waiter = api.subscribeUpdates(ign);
            await api.upsearchPlayer(ign);

            do await matchView.respond(participations[args.number-1].match_api_id);
            while (await waiter.next() != undefined);
        } catch (err) {
            console.error(err);
            return await matchView.error(err.error.err);
        }
    }
};
