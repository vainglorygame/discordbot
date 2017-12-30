#!/usr/bin/node
/* jshint esnext:true */
"use strict";

const emoji = require("discord-emoji"),
    Promise = require("bluebird"),
    View = require("./view"),
    MatchView = require("./match"),
    util = require("../util"),
    api = require("../api"),
    strings = require("../strings");

const MATCH_HISTORY_LEN = parseInt(process.env.MATCH_HISTORY_LEN) || 3;

const MatchesView = module.exports;

// match detail view
module.exports = class extends View {
    constructor(msg, ign) {
        super(msg);
        this.ign = ign;
    }

    async text(participant) {
        let winstr = "Won",
            hero = await api.mapActor(participant.actor),
            game_mode = await api.mapGameMode(participant.game_mode_id),
            emojiScore = strings.emojifyScore(participant.stats.impact_score);
        if (!participant.winner) winstr = "Lost";
        return `
${winstr} ${game_mode} with \`${hero}\`
KDA, CS | \`${participant.stats.kills}/${participant.stats.deaths}/${participant.stats.assists}\`, \`${Math.round(participant.stats.farm)}\`
Kill Participation | \`${Math.floor(100 * participant.stats.kill_participation)}%\`
Score | ${emojiScore} \`${Math.floor(100 * participant.stats.impact_score)}%\`
`;
    }

    async embed(matches) {
        const matchesPart = matches.slice(0, MATCH_HISTORY_LEN);

        // build embed
        let embed = util.vainsocialEmbed(this.ign,
            "player/" + this.ign, "vainsocial-matches")
            .setDescription(`Last ${matchesPart.length} casual and ranked matches.\n`
                + await this.help())
            .setTimestamp(new Date(matchesPart[0].created_at));
        await Promise.each(matchesPart, async (match, idx) =>
            embed.addField(`Match ${idx + 1}`, await this.text(match))
        );
        return embed;
    }

    async help() {
        return `*${emoji.symbols["1234"]} or ${util.usg(this.msg, "vm " + this.ign + " number")} for details*`
    }

    async buttons(matches) {
        const matchesPart = matches.slice(0, MATCH_HISTORY_LEN);

        let reactions = {};
        matchesPart.forEach((m, idx) =>
            reactions[strings.emojiCount[idx]] = async () => {
                util.trackAction(this.msg, "reaction-match", m.match_api_id);
                await new MatchView(this.msg).respond(m.match_api_id);
            });
        return reactions;
    }

    async respond() {
        const matches = await api.getMatches(this.ign);
        this.response = await util.respond(this.msg,
            await this.embed(matches), this.response);
        if (!this.hasButtons) {
            await util.reactionButtons(this.response,
                await this.buttons(matches), this.msg);
            this.hasButtons = true;
        }
        return this.response;
    }
}
